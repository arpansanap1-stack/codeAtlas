from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import Optional
import uuid
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import (
    ChatRequest,
    CodeChunk,
    FileContentResponse,
    GeminiKeyRequest,
    GeminiKeyResponse,
    GeminiSettingsResponse,
    GraphData,
    HealthResponse,
    OnboardingDocResponse,
    RepoChunksResponse,
    RepoGraphResponse,
    RepoIngestRequest,
    RepoIngestResponse,
    RepoStatus,
)
from app.services.ast_service import get_ast_service
from app.services.chat_service import get_chat_service
from app.services.embedding_service import get_embedding_service
from app.services.git_service import get_git_service
from app.services.graph_service import get_graph_service
from app.services.onboarding_service import get_onboarding_service

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("codeatlas.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Storage path initialized at: {settings.get_storage_path()}")
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title="CodeAtlas API",
    description="AI Codebase Explainer - Ingestion, AST Analysis, Hybrid RAG, & Onboarding Generator",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
def health_check():
    """Returns system status and version, including Gemini AI connectivity state."""
    gemini_active = bool(
        settings.GEMINI_API_KEY
        and not settings.GEMINI_API_KEY.startswith("your-gemini")
        and get_chat_service().is_configured()
    )
    supabase_active = bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_KEY
        and not settings.SUPABASE_URL.startswith("https://your-project")
    )
    return HealthResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        gemini_configured=gemini_active,
        supabase_configured=supabase_active,
        timestamp=datetime.now(timezone.utc),
    )


@app.get("/api/settings/gemini", response_model=GeminiSettingsResponse, tags=["Settings"])
def get_gemini_settings():
    """Returns the current Gemini configuration state and active models (read-only, configured via .env)."""
    key = settings.GEMINI_API_KEY or ""
    is_conf = bool(key and not key.startswith("your-gemini") and get_chat_service().is_configured())
    masked = None
    if is_conf and len(key) > 8:
        masked = key[:6] + "..." + key[-4:]
    elif is_conf:
        masked = "****"

    return GeminiSettingsResponse(
        configured=is_conf,
        chat_model=getattr(settings, "GEMINI_CHAT_MODEL", "gemini-flash-lite-latest"),
        embedding_model=getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        masked_key=masked,
    )


@app.post(
    "/api/repos/ingest",
    response_model=RepoIngestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Repositories"],
)
@app.post(
    "/api/v1/repos/ingest",
    response_model=RepoIngestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Repositories"],
)
def ingest_repository(payload: RepoIngestRequest):
    """
    Ingests a public GitHub repository:
    1. Validates the URL
    2. Performs shallow clone into local storage
    3. Traverses repository and filters out binaries, lockfiles, node_modules, and oversized files
    4. Caches full file contents for instant code viewing
    5. Extracts AST code chunks (Python, JS, TS, TSX) and fallback sliding window chunks
    6. Constructs directed dependency graph (React Flow format)
    7. Batch embeds code chunks with google-genai text-embedding-004
    8. Cleans up cloned disk storage and marks repository as completed
    """
    repo_url = payload.repo_url
    repo_id = str(uuid.uuid4())
    git_service = get_git_service()
    ast_service = get_ast_service()
    graph_service = get_graph_service()
    embedding_service = get_embedding_service()
    db = get_db()

    logger.info(f"Received ingestion request for '{repo_url}' [repo_id: {repo_id}]")

    db.create_repository(
        repo_id=repo_id,
        repo_url=repo_url,
        repo_name="processing",
        status=RepoStatus.CLONING.value,
    )

    try:
        # 1. Clone repository shallowly
        repo_dir, repo_name = git_service.clone_repository(
            repo_url=repo_url,
            repo_id=repo_id,
        )

        # 2. Filter valid source files and generate ASCII directory tree
        valid_files, total_size, ascii_tree = git_service.filter_and_index_files(
            repo_dir, repo_name=repo_name
        )
        valid_rel_paths = [f.relative_path for f in valid_files]

        # 3. Cache full file contents in database for zero-disk code viewing
        for file_node in valid_files:
            file_disk_path = repo_dir / file_node.relative_path
            try:
                content = file_disk_path.read_text(encoding="utf-8", errors="replace")
                db.save_file_content(repo_id, file_node.relative_path, content)
            except Exception as e:
                logger.debug(f"Could not read full file for {file_node.relative_path}: {e}")

        # 4. AST Chunking & Dependency Graph Construction
        db.update_repository(
            repo_id=repo_id,
            updates={"repo_name": repo_name, "status": RepoStatus.PARSING.value},
        )

        chunks = ast_service.chunk_repository(repo_dir, valid_rel_paths)
        graph_data = graph_service.build_dependency_graph(repo_dir, valid_rel_paths)

        db.update_repository(
            repo_id=repo_id,
            updates={
                "directory_tree": ascii_tree,
                "graph_data": graph_data.model_dump(),
                "status": RepoStatus.INDEXING.value,
            },
        )

        # 5. Batch vector embeddings & cleanup of cloned directory
        embedding_service.process_and_index_chunks(repo_id, chunks)

        logger.info(
            f"Ingestion complete for '{repo_name}': {len(valid_files)} files, "
            f"{len(chunks)} chunks, {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges."
        )

        return RepoIngestResponse(
            repo_id=repo_id,
            repo_url=repo_url,
            repo_name=repo_name,
            status=RepoStatus.COMPLETED,
            file_count=len(valid_files),
            total_size_bytes=total_size,
            chunk_count=len(chunks),
            graph_nodes_count=len(graph_data.nodes),
            graph_edges_count=len(graph_data.edges),
            directory_tree=ascii_tree,
            message="Repository cloned, AST parsed, embedded, and indexed successfully.",
        )

    except ValueError as e:
        logger.warning(f"Ingestion failed for {repo_url}: {e}")
        db.update_repository(
            repo_id=repo_id,
            updates={"status": RepoStatus.FAILED.value},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected error during ingestion of {repo_url}: {e}", exc_info=True)
        db.update_repository(
            repo_id=repo_id,
            updates={"status": RepoStatus.FAILED.value},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal ingestion error: {str(e)}",
        )


@app.get("/api/repos/{repo_id}", tags=["Repositories"])
def get_repository(repo_id: str):
    """Retrieves repository metadata, directory tree, and status by ID."""
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found.",
        )
    return repo


@app.get("/api/repos/{repo_id}/graph", response_model=RepoGraphResponse, tags=["Repositories"])
def get_repository_graph(repo_id: str):
    """Retrieves the React Flow formatted architecture dependency graph."""
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found.",
        )

    raw_graph = repo.get("graph_data") or {"nodes": [], "edges": []}
    return RepoGraphResponse(
        repo_id=repo_id,
        graph_data=GraphData(**raw_graph),
    )


@app.get("/api/repos/{repo_id}/chunks", response_model=RepoChunksResponse, tags=["Repositories"])
def get_repository_chunks(
    repo_id: str,
    limit: int = Query(50, ge=1, le=500, description="Max number of chunks to return"),
    offset: int = Query(0, ge=0, description="Chunk offset"),
):
    """Retrieves AST and fallback code chunks extracted for a repository."""
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found.",
        )

    chunks_data = db.get_code_chunks(repo_id, limit=limit, offset=offset)
    code_chunks = [CodeChunk(**c) for c in chunks_data]

    all_chunks = db.get_code_chunks(repo_id, limit=100000, offset=0)
    return RepoChunksResponse(
        repo_id=repo_id,
        total_chunks=len(all_chunks),
        chunks=code_chunks,
    )


@app.get("/api/repos/{repo_id}/file", response_model=FileContentResponse, tags=["Repositories"])
def get_file_content(
    repo_id: str,
    path: str = Query(..., description="Relative file path within repository"),
):
    """
    Fetches full file content from database or reconstructs from code chunks
    for the frontend Monaco code viewer.
    """
    db = get_db()
    content = db.get_file_content(repo_id, path)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{path}' not found for repository '{repo_id}'.",
        )

    return FileContentResponse(
        repo_id=repo_id,
        file_path=path,
        content=content,
    )


@app.post("/api/repos/{repo_id}/chat", tags=["AI Explainer"])
def chat_with_repo(repo_id: str, payload: ChatRequest):
    """
    Answers developer questions with strict [file_path:start_line-end_line] citations
    via Hybrid RAG (pgvector + FTS) and graph-expanded context, streamed over Server-Sent Events (SSE).
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    chat_service = get_chat_service()
    return StreamingResponse(
        chat_service.stream_chat_response(repo_id, payload.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post(
    "/api/repos/{repo_id}/onboarding",
    response_model=OnboardingDocResponse,
    tags=["Onboarding Documentation"],
)
def generate_onboarding_docs(repo_id: str):
    """
    Synthesizes and caches a structured ONBOARDING.md guide with valid Mermaid.js diagrams,
    core module walkthroughs with [file_path:start_line-end_line] citations, and Day-1 run guides.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    onboarding_service = get_onboarding_service()
    doc_record = onboarding_service.generate_onboarding_documentation(repo_id)

    return OnboardingDocResponse(
        repo_id=repo_id,
        markdown_content=doc_record["markdown_content"],
        updated_at=datetime.fromisoformat(doc_record["updated_at"]),
    )


@app.get(
    "/api/repos/{repo_id}/onboarding",
    response_model=OnboardingDocResponse,
    tags=["Onboarding Documentation"],
)
def get_onboarding_docs(repo_id: str):
    """
    Retrieves the cached ONBOARDING.md guide for a repository,
    or generates it on-demand if not yet synthesized.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    doc_record = db.get_onboarding_doc(repo_id)
    if not doc_record:
        onboarding_service = get_onboarding_service()
        doc_record = onboarding_service.generate_onboarding_documentation(repo_id)

    return OnboardingDocResponse(
        repo_id=repo_id,
        markdown_content=doc_record["markdown_content"],
        updated_at=datetime.fromisoformat(doc_record["updated_at"]),
    )

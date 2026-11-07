import logging
import uuid
from fastapi import APIRouter, HTTPException, Query, status

from app.db.supabase import get_db
from app.models.schemas import (
    CodeChunk,
    FileContentResponse,
    GraphData,
    RepoChunksResponse,
    RepoGraphResponse,
    RepoIngestRequest,
    RepoIngestResponse,
    RepoStatus,
)
from app.services.ast_service import get_ast_service
from app.services.embedding_service import get_embedding_service
from app.services.git_service import get_git_service
from app.services.graph_service import get_graph_service

logger = logging.getLogger("codeatlas.routers.repos")
router = APIRouter(prefix="/api/repos", tags=["Repositories"])


@router.post(
    "/ingest",
    response_model=RepoIngestResponse,
    status_code=status.HTTP_201_CREATED,
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
        repo_dir, repo_name = git_service.clone_repository(
            repo_url=repo_url,
            repo_id=repo_id,
        )

        valid_files, total_size, ascii_tree = git_service.filter_and_index_files(
            repo_dir, repo_name=repo_name
        )
        valid_rel_paths = [f.relative_path for f in valid_files]

        for file_node in valid_files:
            file_disk_path = repo_dir / file_node.relative_path
            try:
                content = file_disk_path.read_text(encoding="utf-8", errors="replace")
                db.save_file_content(repo_id, file_node.relative_path, content)
            except Exception as e:
                logger.debug(f"Could not read full file for {file_node.relative_path}: {e}")

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


@router.get("/{repo_id}")
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


@router.get("/{repo_id}/graph", response_model=RepoGraphResponse)
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


@router.get("/{repo_id}/chunks", response_model=RepoChunksResponse)
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


@router.get("/{repo_id}/file", response_model=FileContentResponse)
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

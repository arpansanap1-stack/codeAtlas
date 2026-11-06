from datetime import datetime
from enum import Enum
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class RepoStatus(str, Enum):
    PENDING = "pending"
    CLONING = "cloning"
    PARSING = "parsing"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


GITHUB_URL_REGEX = re.compile(
    r"^https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git|\/)?$"
)


def normalize_github_url(url: str) -> str:
    """
    Normalizes any GitHub URL variant into a clean https://github.com/<owner>/<repo>
    Handles http, trailing slashes, .git suffixes, branch/tree paths, and query parameters.
    """
    clean = url.strip()
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = "https://" + clean

    # Strip query parameters and hash anchors
    if "?" in clean:
        clean = clean.split("?")[0]
    if "#" in clean:
        clean = clean.split("#")[0]

    match = re.search(
        r"https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)",
        clean,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError(
            "Invalid GitHub URL. Must be in format: https://github.com/<owner>/<repo>"
        )

    owner = match.group(1)
    repo = match.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    repo = repo.rstrip("/")

    return f"https://github.com/{owner}/{repo}"


class RepoIngestRequest(BaseModel):
    repo_url: str = Field(
        ...,
        description="Public GitHub repository URL (e.g. https://github.com/fastapi/fastapi)",
        examples=["https://github.com/fastapi/fastapi"],
    )

    @field_validator("repo_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        return normalize_github_url(v)


class FileNode(BaseModel):
    relative_path: str
    size_bytes: int
    extension: str


class CodeChunk(BaseModel):
    file_path: str = Field(..., description="Relative file path within repository")
    symbol_name: str = Field(..., description="Name of the function, class, or chunk identifier")
    chunk_type: str = Field(
        ...,
        description="Declaration type: function, class, method, interface, type_alias, or fallback_block",
    )
    start_line: int = Field(..., description="1-based start line number")
    end_line: int = Field(..., description="1-based end line number")
    content: str = Field(..., description="Raw slice of code with contextual header")


class GraphNode(BaseModel):
    id: str = Field(..., description="Relative file path used as node ID")
    label: str = Field(..., description="Filename display label")
    folder: str = Field(..., description="Parent directory path")
    in_degree: int = Field(0, description="Number of internal incoming dependencies")
    out_degree: int = Field(0, description="Number of internal outgoing dependencies")
    summary: str = Field("", description="Architectural summary of the module")


class GraphEdge(BaseModel):
    id: str = Field(..., description="Unique edge ID (source->target)")
    source: str = Field(..., description="Source file relative path")
    target: str = Field(..., description="Target file relative path")


class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)


class RepoIngestResponse(BaseModel):
    repo_id: str = Field(..., description="UUID identifier assigned to this repository")
    repo_url: str
    repo_name: str
    status: RepoStatus
    file_count: int
    total_size_bytes: int
    chunk_count: int = Field(0, description="Total AST & fallback chunks extracted")
    graph_nodes_count: int = Field(0, description="Number of nodes in dependency graph")
    graph_edges_count: int = Field(0, description="Number of edges in dependency graph")
    directory_tree: str = Field(..., description="ASCII visualization of valid codebase files")
    message: str


class RepoGraphResponse(BaseModel):
    repo_id: str
    graph_data: GraphData


class RepoChunksResponse(BaseModel):
    repo_id: str
    total_chunks: int
    chunks: List[CodeChunk]


class ChatRequest(BaseModel):
    message: str = Field(..., description="Developer inquiry about the codebase")


class FileContentResponse(BaseModel):
    repo_id: str
    file_path: str
    content: str


class OnboardingDocResponse(BaseModel):
    repo_id: str
    markdown_content: str
    updated_at: datetime


class RepositoryRecord(BaseModel):
    id: str
    repo_url: str
    repo_name: str
    status: RepoStatus
    directory_tree: Optional[str] = None
    graph_data: Optional[Dict[str, Any]] = None
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    gemini_configured: bool = False
    supabase_configured: bool = False
    timestamp: datetime


class GeminiKeyRequest(BaseModel):
    api_key: str = Field(..., description="Google Gemini API Key from Google AI Studio")


class GeminiKeyResponse(BaseModel):
    status: str
    message: str
    configured: bool
    chat_model: str
    embedding_model: str


class GeminiSettingsResponse(BaseModel):
    configured: bool
    chat_model: str
    embedding_model: str
    masked_key: Optional[str] = None

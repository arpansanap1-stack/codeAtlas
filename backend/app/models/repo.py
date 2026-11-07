from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from app.models.common import RepoStatus, normalize_github_url


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
    selected_files: Optional[List[str]] = Field(
        default=None,
        description="Optional explicit user-selected files to constrain or focus the chat analysis",
    )


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

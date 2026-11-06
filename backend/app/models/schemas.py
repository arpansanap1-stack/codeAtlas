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


class ArchitectureExplanationResponse(BaseModel):
    repo_id: str
    level: str
    title: str
    markdown_content: str
    updated_at: datetime


class JourneyStep(BaseModel):
    step_number: int
    title: str
    file_path: str
    symbol_name: Optional[str] = None
    start_line: int
    end_line: int
    explanation: str
    outgoing_target: Optional[str] = None


class JourneyRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Flow or question to trace, e.g. 'Authentication Flow' or 'How does ingestion work?'",
    )


class JourneyResponse(BaseModel):
    repo_id: str
    topic: str
    summary: str
    steps: List[JourneyStep]


class SuggestedJourneyItem(BaseModel):
    topic: str
    description: str
    category: str


class SuggestedJourneysResponse(BaseModel):
    repo_id: str
    journeys: List[SuggestedJourneyItem]


class SuspiciousSnippet(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    symbol_name: Optional[str] = None
    reason: str
    code_snippet: str


class DebugRequest(BaseModel):
    error_message: str = Field(
        ...,
        min_length=3,
        description="Runtime error string, exception name, or stack trace",
        examples=["TypeError: Cannot read properties of undefined (reading 'token')"],
    )
    context_hint: Optional[str] = Field(
        None,
        description="Optional additional hint, e.g. 'happened after clicking submit'",
    )


class DebugResponse(BaseModel):
    repo_id: str
    error_type: str
    root_cause_analysis: str
    execution_path_explanation: str
    suspicious_locations: List[SuspiciousSnippet]
    suggested_fix: str
    confidence_score: float = 0.85


class ImpactRiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class DependentModule(BaseModel):
    file_path: str
    depth: int
    is_direct: bool
    import_symbol: Optional[str] = None


class ImpactAnalysisResponse(BaseModel):
    repo_id: str
    target_file: str
    risk_level: ImpactRiskLevel
    blast_radius_score: int
    direct_dependents: List[DependentModule]
    indirect_dependents: List[DependentModule]
    all_affected_file_paths: List[str]
    summary: str
    affected_subsystems: List[str]
    recommendations: List[str]


class ArchitectureSmellType(str, Enum):
    CIRCULAR_DEPENDENCY = "circular_dependency"
    GOD_FILE = "god_file"
    OVERSIZED_MODULE = "oversized_module"
    DEAD_MODULE = "dead_module"
    TIGHT_COUPLING = "tight_coupling"


class ArchitectureSmell(BaseModel):
    smell_type: ArchitectureSmellType
    severity: str = Field(..., description="'critical', 'warning', or 'info'")
    title: str
    description: str
    affected_files: List[str]
    refactoring_tip: str


class LanguageMetric(BaseModel):
    language: str
    file_count: int
    percentage: float


class ModuleMetric(BaseModel):
    file_path: str
    metric_label: str
    value: int
    details: Optional[str] = None


class CodebaseHealthResponse(BaseModel):
    repo_id: str
    health_score: int
    health_rating: str
    total_files: int
    total_lines: int
    graph_density: float
    languages: List[LanguageMetric]
    largest_modules: List[ModuleMetric]
    most_connected_files: List[ModuleMetric]
    circular_dependencies: List[List[str]]
    dead_files: List[str]
    smells: List[ArchitectureSmell]
    summary: str


class FileContributor(BaseModel):
    name: str
    email: str
    commits_count: int
    percentage: float


class CoChangedFile(BaseModel):
    file_path: str
    co_change_count: int
    coupling_strength: float = Field(
        ..., description="Co-change strength normalized between 0.0 and 1.0"
    )


class CommitHistoryItem(BaseModel):
    commit_hash: str
    author_name: str
    author_email: str
    date: str
    message: str
    insertions: int
    deletions: int


class FileGitIntelligenceResponse(BaseModel):
    repo_id: str
    file_path: str
    total_commits: int
    churn_rate: str = Field(..., description="'High', 'Moderate', or 'Low'")
    last_modified: str
    contributors: List[FileContributor]
    co_changed_files: List[CoChangedFile]
    recent_commits: List[CommitHistoryItem]
    evolution_summary: str





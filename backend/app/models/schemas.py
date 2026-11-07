"""
Pydantic v2 validation models & schemas for CodeAtlas.
Decomposed into domain submodules: common, repo, intelligence, and health.
All symbols are re-exported here for complete backward compatibility.
"""

from app.models.common import (
    GITHUB_URL_REGEX,
    GeminiKeyRequest,
    GeminiKeyResponse,
    GeminiSettingsResponse,
    HealthResponse,
    RepoStatus,
    normalize_github_url,
)
from app.models.health import (
    ArchitectureSmell,
    ArchitectureSmellType,
    CodebaseHealthReportResponse,
    CodebaseHealthResponse,
    LanguageMetric,
    ModuleMetric,
)
from app.models.intelligence import (
    ArchitectureExplanationResponse,
    CoChangedFile,
    CommitHistoryItem,
    DebugRequest,
    DebugResponse,
    DependentModule,
    FileContributor,
    FileGitIntelligenceResponse,
    ImpactAnalysisResponse,
    ImpactRiskLevel,
    JourneyRequest,
    JourneyResponse,
    JourneyStep,
    SuggestedJourneyItem,
    SuggestedJourneysResponse,
    SuspiciousSnippet,
)
from app.models.repo import (
    ChatRequest,
    CodeChunk,
    FileContentResponse,
    FileNode,
    GraphData,
    GraphEdge,
    GraphNode,
    OnboardingDocResponse,
    RepoChunksResponse,
    RepoGraphResponse,
    RepoIngestRequest,
    RepoIngestResponse,
    RepositoryRecord,
)

__all__ = [
    # Common
    "RepoStatus",
    "GITHUB_URL_REGEX",
    "normalize_github_url",
    "HealthResponse",
    "GeminiKeyRequest",
    "GeminiKeyResponse",
    "GeminiSettingsResponse",
    # Repo & Graph
    "RepoIngestRequest",
    "FileNode",
    "CodeChunk",
    "GraphNode",
    "GraphEdge",
    "GraphData",
    "RepoIngestResponse",
    "RepoGraphResponse",
    "RepoChunksResponse",
    "ChatRequest",
    "FileContentResponse",
    "OnboardingDocResponse",
    "RepositoryRecord",
    # Intelligence
    "ArchitectureExplanationResponse",
    "JourneyStep",
    "JourneyRequest",
    "JourneyResponse",
    "SuggestedJourneyItem",
    "SuggestedJourneysResponse",
    "SuspiciousSnippet",
    "DebugRequest",
    "DebugResponse",
    "ImpactRiskLevel",
    "DependentModule",
    "ImpactAnalysisResponse",
    "FileContributor",
    "CoChangedFile",
    "CommitHistoryItem",
    "FileGitIntelligenceResponse",
    # Health
    "ArchitectureSmellType",
    "ArchitectureSmell",
    "LanguageMetric",
    "ModuleMetric",
    "CodebaseHealthResponse",
    "CodebaseHealthReportResponse",
]

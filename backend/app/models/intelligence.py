from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


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

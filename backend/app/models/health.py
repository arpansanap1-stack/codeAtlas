from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


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


class CodebaseHealthReportResponse(BaseModel):
    repo_id: str
    repo_name: str
    health_score: int
    health_rating: str
    markdown_report: str
    generated_at: datetime

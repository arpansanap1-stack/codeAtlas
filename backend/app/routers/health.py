import logging
from fastapi import APIRouter, HTTPException, status

from app.db.supabase import get_db
from app.models.schemas import CodebaseHealthReportResponse, CodebaseHealthResponse
from app.services.health_service import get_health_service

logger = logging.getLogger("codeatlas.routers.health")
router = APIRouter(prefix="/api/repos", tags=["Codebase Health"])


@router.get(
    "/{repo_id}/health-metrics",
    response_model=CodebaseHealthResponse,
)
def get_codebase_health_metrics(repo_id: str):
    """
    Evaluates repository health, language distribution, module sizes,
    and detects architectural anti-patterns (circular dependencies, god modules,
    dead files, tightly coupled components).
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    health_service = get_health_service()
    return health_service.evaluate_codebase_health(repo_id=repo_id)


@router.get(
    "/{repo_id}/health-report",
    response_model=CodebaseHealthReportResponse,
)
def get_codebase_health_report(repo_id: str):
    """
    Generates a comprehensive downloadable Markdown health report that explains
    each architectural problem in detail (circular dependencies, god modules,
    oversized files, dead code, coupling), affected files, and actionable fixes.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    health_service = get_health_service()
    return health_service.generate_health_markdown_report(repo_id=repo_id)

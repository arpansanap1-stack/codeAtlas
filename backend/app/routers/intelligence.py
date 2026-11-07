from datetime import datetime
import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.db.supabase import get_db
from app.models.schemas import (
    ArchitectureExplanationResponse,
    DebugRequest,
    DebugResponse,
    FileGitIntelligenceResponse,
    ImpactAnalysisResponse,
    JourneyRequest,
    JourneyResponse,
    OnboardingDocResponse,
    SuggestedJourneysResponse,
)
from app.services.debugger_service import get_debugger_service
from app.services.explanation_service import get_explanation_service
from app.services.git_history_service import get_git_history_service
from app.services.impact_service import get_impact_service
from app.services.journey_service import get_journey_service
from app.services.onboarding_service import get_onboarding_service

logger = logging.getLogger("codeatlas.routers.intelligence")
router = APIRouter(prefix="/api/repos", tags=["Code Intelligence"])


@router.post(
    "/{repo_id}/onboarding",
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


@router.get(
    "/{repo_id}/onboarding",
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


@router.get(
    "/{repo_id}/explanation",
    response_model=ArchitectureExplanationResponse,
    tags=["Architecture Explanation"],
)
def get_architecture_explanation(
    repo_id: str,
    level: str = Query(
        "intermediate",
        pattern="^(beginner|intermediate|expert)$",
        description="Target audience depth: beginner, intermediate, or expert",
    ),
):
    """
    Generates a structured, multi-level architectural explanation of the codebase
    with clickable code citations, core modules, entry points, and data flow.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    explanation_service = get_explanation_service()
    return explanation_service.explain_architecture(repo_id=repo_id, level=level)


@router.get(
    "/{repo_id}/journeys",
    response_model=SuggestedJourneysResponse,
    tags=["Codebase Journey"],
)
def get_suggested_journeys(repo_id: str):
    """Returns suggested interactive code execution paths tailored to the repository."""
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    journey_service = get_journey_service()
    return journey_service.get_suggested_journeys(repo_id=repo_id)


@router.post(
    "/{repo_id}/journey",
    response_model=JourneyResponse,
    tags=["Codebase Journey"],
)
def generate_codebase_journey(repo_id: str, payload: JourneyRequest):
    """
    Generates an interactive step-by-step code journey through the repository
    (e.g. UI -> Route -> Service -> Database) with clickable citations and step explanations.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    journey_service = get_journey_service()
    return journey_service.generate_journey(repo_id=repo_id, topic=payload.topic)


@router.post(
    "/{repo_id}/debug",
    response_model=DebugResponse,
    tags=["AI Debugging"],
)
def debug_repository_error(repo_id: str, payload: DebugRequest):
    """
    Parses runtime errors and stack traces, maps them to AST declarations,
    explains root causes, pinpoints suspicious lines, and suggests code diff fixes.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    debugger_service = get_debugger_service()
    return debugger_service.diagnose_error(
        repo_id=repo_id,
        error_message=payload.error_message,
        context_hint=payload.context_hint,
    )


@router.get(
    "/{repo_id}/impact",
    response_model=ImpactAnalysisResponse,
    tags=["Impact Analysis"],
)
def get_file_impact_analysis(
    repo_id: str,
    file_path: str = Query(..., description="Target file path to evaluate blast radius for"),
):
    """
    Performs 'What Happens If I Change This?' impact analysis:
    Computes direct and transitive dependents, risk severity score,
    and affected subsystems using reverse graph dependency traversal.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    impact_service = get_impact_service()
    return impact_service.analyze_impact(repo_id=repo_id, target_file=file_path)


@router.get(
    "/{repo_id}/git-history",
    response_model=FileGitIntelligenceResponse,
    tags=["Git History Intelligence"],
)
def get_file_git_history(
    repo_id: str,
    file_path: str = Query(..., description="Relative file path within repository"),
):
    """
    Returns commit history, churn rate, top contributors, co-changed files,
    and evolutionary summary for a specific module.
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    history_service = get_git_history_service()
    return history_service.analyze_file_history(repo_id=repo_id, file_path=file_path)

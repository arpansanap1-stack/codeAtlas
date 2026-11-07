from datetime import datetime, timezone
from fastapi import APIRouter

from app.config import get_settings
from app.models.schemas import GeminiSettingsResponse, HealthResponse
from app.services.chat_service import get_chat_service

router = APIRouter(tags=["System"])


@router.get("/api/health", response_model=HealthResponse)
@router.get("/api/v1/health", response_model=HealthResponse)
def health_check():
    """Returns system status and version, including Gemini AI connectivity state."""
    settings = get_settings()
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


@router.get("/api/settings/gemini", response_model=GeminiSettingsResponse, tags=["Settings"])
def get_gemini_settings():
    """Returns the current Gemini configuration state and active models (read-only, configured via .env)."""
    settings = get_settings()
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

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import chat, health, intelligence, repos, system
from app.routers.chat import chat_with_repo
from app.routers.health import (
    get_codebase_health_metrics,
    get_codebase_health_report,
)
from app.routers.intelligence import (
    debug_repository_error,
    generate_codebase_journey,
    generate_onboarding_docs,
    get_architecture_explanation,
    get_file_git_history,
    get_file_impact_analysis,
    get_onboarding_docs,
    get_suggested_journeys,
)
from app.routers.repos import (
    get_file_content,
    get_repository,
    get_repository_chunks,
    get_repository_graph,
    ingest_repository,
)
from app.routers.system import (
    get_gemini_settings,
    health_check,
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("codeatlas.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Storage path initialized at: {settings.get_storage_path()}")
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title="CodeAtlas API",
    description="AI Codebase Explainer - Ingestion, AST Analysis, Hybrid RAG, & Onboarding Generator",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount domain routers
app.include_router(system.router)
app.include_router(repos.router)
app.include_router(chat.router)
app.include_router(intelligence.router)
app.include_router(health.router)

__all__ = [
    "app",
    "health_check",
    "get_gemini_settings",
    "ingest_repository",
    "get_repository",
    "get_repository_graph",
    "get_repository_chunks",
    "get_file_content",
    "chat_with_repo",
    "generate_onboarding_docs",
    "get_onboarding_docs",
    "get_architecture_explanation",
    "get_suggested_journeys",
    "generate_codebase_journey",
    "debug_repository_error",
    "get_file_impact_analysis",
    "get_file_git_history",
    "get_codebase_health_metrics",
    "get_codebase_health_report",
]

from functools import lru_cache
import os
from pathlib import Path
import tempfile
from typing import Any, List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_backend_dir = Path(__file__).resolve().parent.parent
_root_dir = _backend_dir.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeAtlas API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Storage directory for shallow cloned repositories
    STORAGE_BASE_DIR: str = ""

    # File filter configurations
    MAX_FILE_SIZE_BYTES: int = 500 * 1024  # 500 KB default threshold
    CLONE_TIMEOUT_SECONDS: int = 60

    # Supabase credentials (optional for initial offline testing)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-flash-lite-latest"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    model_config = SettingsConfigDict(
        env_file=(
            str(_backend_dir / ".env"),
            str(_root_dir / ".env"),
            "backend/.env",
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "debug", "dev")
        return False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    def get_storage_path(self) -> Path:
        """
        Returns resolved Path for cloned repos.
        Falls back to a standard temp directory if STORAGE_BASE_DIR is empty or unset.
        """
        if self.STORAGE_BASE_DIR and self.STORAGE_BASE_DIR.strip():
            storage_path = Path(self.STORAGE_BASE_DIR.strip())
        else:
            # Default to /tmp/codeatlas on POSIX or %TEMP%/codeatlas on Windows
            storage_path = Path(tempfile.gettempdir()) / "codeatlas"
        storage_path.mkdir(parents=True, exist_ok=True)
        return storage_path


@lru_cache()
def get_settings() -> Settings:
    return Settings()


from datetime import datetime
from enum import Enum
import re
from typing import Optional
from pydantic import BaseModel, Field


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

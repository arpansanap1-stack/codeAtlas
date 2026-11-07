import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.db.supabase import get_db
from app.models.schemas import ChatRequest
from app.services.chat_service import get_chat_service

logger = logging.getLogger("codeatlas.routers.chat")
router = APIRouter(prefix="/api/repos", tags=["AI Explainer"])


@router.post("/{repo_id}/chat")
def chat_with_repo(repo_id: str, payload: ChatRequest):
    """
    Answers developer questions with strict [file_path:start_line-end_line] citations
    via Hybrid RAG (pgvector + FTS) and graph-expanded context, streamed over Server-Sent Events (SSE).
    """
    db = get_db()
    repo = db.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found.",
        )

    chat_service = get_chat_service()
    return StreamingResponse(
        chat_service.stream_chat_response(
            repo_id=repo_id,
            user_query=payload.message,
            selected_files=payload.selected_files,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

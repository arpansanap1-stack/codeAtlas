import pytest
from app.db.supabase import get_db
from app.services.chat_service import ChatService
from app.models.schemas import ChatRequest


def test_chat_request_schema():
    req = ChatRequest(
        message="Compare these implementations",
        selected_files=["file1.py", "file2.py"],
    )
    assert req.message == "Compare these implementations"
    assert req.selected_files == ["file1.py", "file2.py"]


def test_chat_with_selected_files_context():
    db = get_db()
    db.supabase = None
    repo_id = "test-repo-chat-sel-context"

    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/chat-sel-test",
        repo_name="chat-sel-test",
        status="completed",
        directory_tree="chat-sel-test/\n├── auth.py\n└── token.py",
        graph_data={
            "nodes": [
                {"id": "auth.py", "label": "auth.py", "folder": "", "in_degree": 0, "out_degree": 1},
                {"id": "token.py", "label": "token.py", "folder": "", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "auth.py", "target": "token.py"},
            ],
        },
    )

    db.save_file_content(repo_id, "auth.py", "import token\ndef login():\n    return token.create_token()\n")
    db.save_file_content(repo_id, "token.py", "def create_token():\n    return 'jwt_xyz'\n")

    chat_svc = ChatService()
    chat_svc.client = None

    ctx = chat_svc.prepare_chat_context(
        repo_id=repo_id,
        user_query="Explain how these work together",
        selected_files=["auth.py", "token.py"],
    )

    assert "repo_name" in ctx
    assert ctx["repo_name"] == "chat-sel-test"

    user_prompt = ctx["user_prompt"]
    assert "Explicitly Selected Code Context" in user_prompt
    assert "auth.py" in user_prompt
    assert "token.py" in user_prompt
    assert "def login():" in user_prompt
    assert "def create_token():" in user_prompt

    # Citations
    citations = ctx["citations"]
    assert any("auth.py" in c for c in citations)
    assert any("token.py" in c for c in citations)

    # Fallback explanation
    fallback = ctx["fallback_text"]
    assert "Targeted Analysis of Selected Code" in fallback
    assert "auth.py" in fallback

import pytest
from app.db.supabase import get_db
from app.models.schemas import CodeChunk
from app.services.debugger_service import get_debugger_service, extract_trace_frames


def test_extract_trace_frames():
    # Test Python traceback extraction
    py_trace = """
Traceback (most recent call last):
  File "backend/app/main.py", line 42, in ingest_repository
    result = git_service.clone_repository(url)
  File "backend/app/services/git_service.py", line 85, in clone_repository
    raise ValueError("Invalid Git repo")
ValueError: Invalid Git repo
"""
    frames = extract_trace_frames(py_trace)
    assert len(frames) == 2
    assert frames[0]["file_path"] == "backend/app/main.py"
    assert frames[0]["line"] == 42
    assert frames[0]["symbol"] == "ingest_repository"
    assert frames[1]["file_path"] == "backend/app/services/git_service.py"
    assert frames[1]["line"] == 85

    # Test JS/TS stack trace extraction
    js_trace = """
TypeError: Cannot read properties of undefined (reading 'token')
    at AuthHandler (src/components/Login.tsx:24:15)
    at dispatchAction (src/lib/api.ts:80:12)
"""
    js_frames = extract_trace_frames(js_trace)
    assert len(js_frames) == 2
    assert js_frames[0]["file_path"] == "src/components/Login.tsx"
    assert js_frames[0]["line"] == 24
    assert js_frames[1]["file_path"] == "src/lib/api.ts"
    assert js_frames[1]["line"] == 80


def test_diagnose_runtime_error():
    db = get_db()
    repo_id = "test-repo-debug-1"

    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/web-app",
        repo_name="web-app",
        status="completed",
        directory_tree="web-app/\n├── src/components/Login.tsx\n└── src/lib/api.ts",
        graph_data={
            "nodes": [
                {"id": "src/components/Login.tsx", "label": "Login.tsx", "folder": "src/components", "in_degree": 0, "out_degree": 1},
                {"id": "src/lib/api.ts", "label": "api.ts", "folder": "src/lib", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "src/components/Login.tsx", "target": "src/lib/api.ts"}
            ],
        },
    )

    chunks = [
        CodeChunk(
            file_path="src/components/Login.tsx",
            symbol_name="AuthHandler",
            chunk_type="function_definition",
            start_line=20,
            end_line=35,
            content="export function AuthHandler() { const token = response.data.token; }",
        )
    ]
    db.save_code_chunks(repo_id, chunks)

    debugger = get_debugger_service()
    res = debugger.diagnose_error(
        repo_id=repo_id,
        error_message="TypeError: Cannot read properties of undefined (reading 'token')\n  at AuthHandler (src/components/Login.tsx:24:15)",
        context_hint="Occurred after clicking login without credentials",
    )

    assert res.repo_id == repo_id
    assert res.error_type == "TypeError"
    assert "src/components/Login.tsx" in res.root_cause_analysis
    assert len(res.suspicious_locations) >= 1
    assert res.suspicious_locations[0].file_path == "src/components/Login.tsx"
    assert res.suspicious_locations[0].start_line <= 24
    assert res.suspicious_locations[0].end_line >= 24
    assert "Proposed Fix" in res.suggested_fix

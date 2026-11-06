import pytest
from app.db.supabase import get_db
from app.models.schemas import CodeChunk
from app.services.explanation_service import get_explanation_service


def test_architecture_explanation_levels():
    db = get_db()
    repo_id = "test-repo-explain-1"

    # Seed repository
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/fastapi/fastapi",
        repo_name="fastapi",
        status="completed",
        directory_tree="fastapi/\n├── main.py\n├── routing.py\n└── models.py",
        graph_data={
            "nodes": [
                {"id": "main.py", "label": "main.py", "folder": "", "in_degree": 0, "out_degree": 2},
                {"id": "routing.py", "label": "routing.py", "folder": "", "in_degree": 1, "out_degree": 1},
                {"id": "models.py", "label": "models.py", "folder": "", "in_degree": 2, "out_degree": 0},
            ],
            "edges": [
                {"id": "main.py->routing.py", "source": "main.py", "target": "routing.py"},
                {"id": "routing.py->models.py", "source": "routing.py", "target": "models.py"},
            ],
        },
    )

    chunks = [
        CodeChunk(
            file_path="main.py",
            symbol_name="create_app",
            chunk_type="function_definition",
            start_line=10,
            end_line=25,
            content="def create_app():\n    return FastAPI()",
        ),
        CodeChunk(
            file_path="routing.py",
            symbol_name="APIRouter",
            chunk_type="class_definition",
            start_line=1,
            end_line=40,
            content="class APIRouter:\n    pass",
        ),
    ]
    db.save_code_chunks(repo_id, chunks)

    service = get_explanation_service()

    # 1. Test Beginner
    beg_res = service.explain_architecture(repo_id, level="beginner")
    assert beg_res.level == "beginner"
    assert "fastapi" in beg_res.markdown_content.lower()
    assert "Beginner Mode" in beg_res.markdown_content
    assert "[main.py:" in beg_res.markdown_content

    # 2. Test Intermediate
    mid_res = service.explain_architecture(repo_id, level="intermediate")
    assert mid_res.level == "intermediate"
    assert "Intermediate Mode" in mid_res.markdown_content

    # 3. Test Expert
    exp_res = service.explain_architecture(repo_id, level="expert")
    assert exp_res.level == "expert"
    assert "Expert Mode" in exp_res.markdown_content

    # 4. Test caching
    cached_res = service.explain_architecture(repo_id, level="beginner")
    assert cached_res.markdown_content == beg_res.markdown_content

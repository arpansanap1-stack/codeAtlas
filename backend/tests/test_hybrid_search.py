import pytest

from app.db.supabase import get_db
from app.models.schemas import CodeChunk
from app.services.chat_service import expand_graph_context
from app.services.embedding_service import generate_mock_embedding


def test_expand_graph_context():
    graph_data = {
        "nodes": [
            {"id": "src/index.ts", "label": "index.ts", "folder": "src"},
            {"id": "src/utils.ts", "label": "utils.ts", "folder": "src"},
            {"id": "src/components/Button.tsx", "label": "Button.tsx", "folder": "src/components"},
        ],
        "edges": [
            {"id": "src/index.ts->src/utils.ts", "source": "src/index.ts", "target": "src/utils.ts"},
            {"id": "src/index.ts->src/components/Button.tsx", "source": "src/index.ts", "target": "src/components/Button.tsx"},
        ],
    }

    context = expand_graph_context(graph_data, ["src/index.ts"])
    assert "src/index.ts" in context
    assert "Imports -> src/utils.ts, src/components/Button.tsx" in context


def test_hybrid_search_rrf():
    db = get_db()
    repo_id = "test-repo-hybrid-1"

    chunks = [
        CodeChunk(
            file_path="src/auth.ts",
            symbol_name="loginUser",
            chunk_type="function_definition",
            start_line=10,
            end_line=25,
            content="# File: src/auth.ts | Symbol: loginUser | Lines: 10-25\nfunction loginUser() { return 'token'; }",
        ),
        CodeChunk(
            file_path="src/database.ts",
            symbol_name="connectDB",
            chunk_type="function_definition",
            start_line=1,
            end_line=15,
            content="# File: src/database.ts | Symbol: connectDB | Lines: 1-15\nfunction connectDB() { return true; }",
        ),
    ]

    embeddings = [generate_mock_embedding(c.content) for c in chunks]
    db.save_code_chunks_with_embeddings(repo_id, chunks, embeddings)

    # Search for login query
    query_vector = generate_mock_embedding("how does login user authentication work?")
    results = db.match_code_chunks_hybrid(
        query_embedding=query_vector,
        query_text="loginUser",
        target_repo_id=repo_id,
        match_count=2,
    )

    assert len(results) > 0
    top_chunk = results[0]
    assert top_chunk["symbol_name"] == "loginUser"
    assert "rank_score" in top_chunk


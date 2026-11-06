import asyncio
import json
import pytest

from app.db.supabase import get_db
from app.main import get_file_content
from app.models.schemas import CodeChunk
from app.services.chat_service import get_chat_service
from app.services.embedding_service import generate_mock_embedding


@pytest.mark.anyio
async def test_streaming_chat_response():
    db = get_db()
    db.supabase = None
    repo_id = "test-repo-chat-1"

    # Seed repository
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/octocat/test-repo",
        repo_name="test-repo",
        status="completed",
        directory_tree="test-repo/\n└── src/\n    └── main.py",
        graph_data={"nodes": [], "edges": []},
    )

    chunks = [
        CodeChunk(
            file_path="src/main.py",
            symbol_name="start_server",
            chunk_type="function_definition",
            start_line=12,
            end_line=30,
            content="# File: src/main.py | Symbol: start_server | Lines: 12-30\ndef start_server():\n    print('Server listening on 8080')",
        )
    ]
    embeddings = [generate_mock_embedding(c.content) for c in chunks]
    db.save_code_chunks_with_embeddings(repo_id, chunks, embeddings)

    chat_service = get_chat_service()
    chat_service.client = None
    chat_service.embedding_service.client = None
    events = []
    async for event in chat_service.stream_chat_response(repo_id, "How is the server started?"):
        events.append(event)

    full_text = "".join(events)
    assert "data: " in full_text
    assert "data: [DONE]" in full_text
    assert "[src/main.py:12-30]" in full_text


def test_get_file_content():
    db = get_db()
    repo_id = "test-repo-file-1"

    db.save_file_content(
        repo_id=repo_id,
        file_path="src/index.ts",
        content="import React from 'react';\nexport const App = () => <div>Hello</div>;",
    )

    res = get_file_content(repo_id, "src/index.ts")
    assert res.file_path == "src/index.ts"
    assert "export const App" in res.content


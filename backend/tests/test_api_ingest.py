from unittest.mock import patch
from pathlib import Path
import tempfile
import pytest
from fastapi import HTTPException

from app.main import (
    health_check,
    ingest_repository,
    get_repository,
    get_repository_graph,
    get_repository_chunks,
)
from app.models.schemas import RepoIngestRequest


def test_health_check_endpoint():
    response = health_check()
    assert response.status == "ok"
    assert response.project == "CodeAtlas API"
    assert response.version == "0.1.0"


def test_ingest_invalid_url_raises_validation_error():
    with pytest.raises(Exception):
        RepoIngestRequest(repo_url="https://notgithub.com/user/repo")

    with pytest.raises(Exception):
        RepoIngestRequest(repo_url="invalid-url")


def test_ingest_successful_flow_with_ast_and_graph():
    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "demo-repo"
        repo_path.mkdir()
        (repo_path / "README.md").write_text("# Demo Repo\nWelcome to CodeAtlas", encoding="utf-8")
        src_dir = repo_path / "src"
        src_dir.mkdir()
        (src_dir / "utils.ts").write_text("export function formatText(text: string): string {\n    return text.trim();\n}", encoding="utf-8")
        (src_dir / "index.ts").write_text("import { formatText } from './utils';\nexport const run = () => formatText('hello');", encoding="utf-8")

        # Mock clone_repository to return local temp repo
        with patch("app.services.git_service.GitService.clone_repository") as mock_clone:
            mock_clone.return_value = (repo_path, "demo-repo")

            req = RepoIngestRequest(repo_url="https://github.com/octocat/demo-repo")
            response = ingest_repository(req)

            assert response.repo_name == "demo-repo"
            assert response.status.value == "completed"
            assert response.file_count == 3
            assert response.chunk_count >= 3
            assert response.graph_nodes_count == 3
            assert response.graph_edges_count == 1
            assert "demo-repo/" in response.directory_tree

            # Test GET /api/repos/{repo_id}/graph
            graph_res = get_repository_graph(response.repo_id)
            assert len(graph_res.graph_data.nodes) == 3
            assert len(graph_res.graph_data.edges) == 1
            assert graph_res.graph_data.edges[0].id == "src/index.ts->src/utils.ts"

            # Test GET /api/repos/{repo_id}/chunks
            chunks_res = get_repository_chunks(response.repo_id, limit=10, offset=0)
            assert chunks_res.total_chunks == response.chunk_count
            chunk_symbols = [c.symbol_name for c in chunks_res.chunks]
            assert "formatText" in chunk_symbols
            assert "run" in chunk_symbols


def test_get_nonexistent_repo():
    with pytest.raises(HTTPException) as excinfo:
        get_repository("non-existent-uuid")
    assert excinfo.value.status_code == 404

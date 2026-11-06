import pytest
from app.db.supabase import get_db
from app.services.git_history_service import get_git_history_service
from app.main import get_file_git_history


def test_git_history_analysis():
    db = get_db()
    repo_id = "test-repo-git-history"

    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/history-test",
        repo_name="history-test",
        status="completed",
        directory_tree="history-test/\n├── app.py\n└── utils.py",
        graph_data={
            "nodes": [
                {"id": "app.py", "label": "app.py", "folder": "", "in_degree": 0, "out_degree": 1},
                {"id": "utils.py", "label": "utils.py", "folder": "", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "app.py", "target": "utils.py"},
            ],
        },
    )

    db.save_file_content(repo_id, "app.py", "import utils\nprint(utils.helper())\n")
    db.save_file_content(repo_id, "utils.py", "def helper():\n    return 'ok'\n")

    service = get_git_history_service()
    res = service.analyze_file_history(repo_id, "app.py")

    assert res.repo_id == repo_id
    assert res.file_path == "app.py"
    assert res.total_commits >= 1
    assert res.churn_rate in ("Low", "Moderate", "High")
    assert len(res.contributors) >= 1
    assert res.contributors[0].name != ""
    assert res.contributors[0].percentage > 0
    assert len(res.recent_commits) >= 1
    assert "app.py" in res.evolution_summary


def test_git_history_endpoint():
    res = get_file_git_history("test-repo-git-history", "app.py")
    assert res.repo_id == "test-repo-git-history"
    assert res.file_path == "app.py"
    assert len(res.contributors) >= 1

import pytest
from app.db.supabase import get_db
from app.models.schemas import ImpactRiskLevel
from app.services.impact_service import get_impact_service


def test_impact_analysis_direct_and_transitive():
    db = get_db()
    repo_id = "test-repo-impact-1"

    # Dependency structure:
    # app/api/auth.py -> app/services/auth_service.py -> app/models/user.py
    # app/api/users.py -> app/services/auth_service.py
    # app/main.py -> app/api/auth.py
    #
    # Therefore, modifying app/services/auth_service.py:
    # Direct callers (depth 1): app/api/auth.py, app/api/users.py
    # Indirect callers (depth 2): app/main.py (via app/api/auth.py)
    # Total affected = 3
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/api-service",
        repo_name="api-service",
        status="completed",
        directory_tree="api-service/\n├── app/main.py\n├── app/api/auth.py\n├── app/api/users.py\n├── app/services/auth_service.py\n└── app/models/user.py",
        graph_data={
            "nodes": [
                {"id": "app/main.py", "label": "main.py", "folder": "app", "in_degree": 0, "out_degree": 1},
                {"id": "app/api/auth.py", "label": "auth.py", "folder": "app/api", "in_degree": 1, "out_degree": 1},
                {"id": "app/api/users.py", "label": "users.py", "folder": "app/api", "in_degree": 0, "out_degree": 1},
                {"id": "app/services/auth_service.py", "label": "auth_service.py", "folder": "app/services", "in_degree": 2, "out_degree": 1},
                {"id": "app/models/user.py", "label": "user.py", "folder": "app/models", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "app/main.py", "target": "app/api/auth.py"},
                {"id": "e2", "source": "app/api/auth.py", "target": "app/services/auth_service.py"},
                {"id": "e3", "source": "app/api/users.py", "target": "app/services/auth_service.py"},
                {"id": "e4", "source": "app/services/auth_service.py", "target": "app/models/user.py"},
            ],
        },
    )

    impact_svc = get_impact_service()

    # 1. Analyze impact of auth_service.py
    res = impact_svc.analyze_impact(repo_id, "app/services/auth_service.py")
    assert res.repo_id == repo_id
    assert res.target_file == "app/services/auth_service.py"
    assert res.blast_radius_score == 3
    assert res.risk_level == ImpactRiskLevel.MODERATE

    direct_paths = [m.file_path for m in res.direct_dependents]
    assert "app/api/auth.py" in direct_paths
    assert "app/api/users.py" in direct_paths

    indirect_paths = [m.file_path for m in res.indirect_dependents]
    assert "app/main.py" in indirect_paths
    assert len(res.all_affected_file_paths) == 3

    # 2. Analyze impact of root main.py (0 callers)
    root_res = impact_svc.analyze_impact(repo_id, "app/main.py")
    assert root_res.blast_radius_score == 0
    assert root_res.risk_level == ImpactRiskLevel.LOW
    assert len(root_res.direct_dependents) == 0

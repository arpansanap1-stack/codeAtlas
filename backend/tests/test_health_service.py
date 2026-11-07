import pytest
from app.db.supabase import get_db
from app.models.schemas import ArchitectureSmellType
from app.services.health_service import find_graph_cycles, get_health_service


def test_find_graph_cycles_detection():
    nodes = [{"id": "a.py"}, {"id": "b.py"}, {"id": "c.py"}, {"id": "d.py"}]
    edges = [
        {"source": "a.py", "target": "b.py"},
        {"source": "b.py", "target": "c.py"},
        {"source": "c.py", "target": "a.py"},  # Cycle: a -> b -> c -> a
        {"source": "c.py", "target": "d.py"},
    ]

    cycles = find_graph_cycles(nodes, edges)
    assert len(cycles) == 1
    cycle = cycles[0]
    assert cycle[0] == cycle[-1]  # Loop closed
    assert "a.py" in cycle
    assert "b.py" in cycle
    assert "c.py" in cycle


def test_codebase_health_evaluation():
    db = get_db()
    repo_id = "test-repo-health-1"

    # Seed repository with smells:
    # 1. Circular dependency: svc1.py -> svc2.py -> svc1.py
    # 2. God file: hub.py with high fan-in + fan-out
    # 3. Dead file: orphan.py with in_degree == 0 (non-entrypoint)
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/health-test",
        repo_name="health-test",
        status="completed",
        directory_tree="health-test/\n├── main.py\n├── hub.py\n├── svc1.py\n├── svc2.py\n└── orphan.py",
        graph_data={
            "nodes": [
                {"id": "main.py", "label": "main.py", "folder": "", "in_degree": 0, "out_degree": 2},
                {"id": "hub.py", "label": "hub.py", "folder": "", "in_degree": 4, "out_degree": 4},
                {"id": "svc1.py", "label": "svc1.py", "folder": "", "in_degree": 2, "out_degree": 2},
                {"id": "svc2.py", "label": "svc2.py", "folder": "", "in_degree": 2, "out_degree": 2},
                {"id": "orphan.py", "label": "orphan.py", "folder": "", "in_degree": 0, "out_degree": 1},
                {"id": "leaf1.py", "label": "leaf1.py", "folder": "", "in_degree": 1, "out_degree": 0},
                {"id": "leaf2.py", "label": "leaf2.py", "folder": "", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "main.py", "target": "hub.py"},
                {"id": "e2", "source": "main.py", "target": "svc1.py"},
                {"id": "e3", "source": "svc1.py", "target": "svc2.py"},
                {"id": "e4", "source": "svc2.py", "target": "svc1.py"},  # Cycle: svc1 -> svc2 -> svc1
                {"id": "e5", "source": "hub.py", "target": "leaf1.py"},
                {"id": "e6", "source": "hub.py", "target": "leaf2.py"},
                {"id": "e7", "source": "orphan.py", "target": "hub.py"},
            ],
        },
    )

    db.save_file_content(repo_id, "main.py", "import hub\nimport svc1\n# main entry\n")
    db.save_file_content(repo_id, "hub.py", "# large hub\n" * 400)  # > 350 lines -> oversized module

    health_svc = get_health_service()
    res = health_svc.evaluate_codebase_health(repo_id)

    assert res.repo_id == repo_id
    assert res.total_files == 7
    assert len(res.languages) >= 1
    assert res.languages[0].language == "Python"
    assert res.health_score < 100  # Points deducted due to smells

    smell_types = [s.smell_type for s in res.smells]
    # Circular dependency detected
    assert ArchitectureSmellType.CIRCULAR_DEPENDENCY in smell_types or ArchitectureSmellType.TIGHT_COUPLING in smell_types
    # God file or Oversized file detected
    assert ArchitectureSmellType.GOD_FILE in smell_types or ArchitectureSmellType.OVERSIZED_MODULE in smell_types
    # Orphan detected
    assert "orphan.py" in res.dead_files


def test_health_metrics_api_endpoint():
    from app.main import get_codebase_health_metrics

    res = get_codebase_health_metrics("test-repo-health-1")
    assert res.repo_id == "test-repo-health-1"
    assert res.health_score > 0
    assert res.health_rating != ""
    assert len(res.languages) >= 1
    assert len(res.smells) > 0


def test_health_markdown_report_generation_and_api():
    from app.main import get_codebase_health_report

    health_svc = get_health_service()
    report_res = health_svc.generate_health_markdown_report("test-repo-health-1")

    assert report_res.repo_id == "test-repo-health-1"
    assert report_res.repo_name == "health-test"
    assert report_res.health_score > 0
    assert "Architecture Health & Codebase Quality Audit Report" in report_res.markdown_report
    assert "1. Executive Summary" in report_res.markdown_report
    assert "2. Scorecard & Vital Structural Metrics" in report_res.markdown_report
    assert "3. In-Depth Problem Explanations" in report_res.markdown_report
    assert "Why This Is a" in report_res.markdown_report
    assert "Recommended Remediation" in report_res.markdown_report
    assert "7. Prioritized Engineering Remediation Roadmap" in report_res.markdown_report

    # Test the API endpoint
    api_res = get_codebase_health_report("test-repo-health-1")
    assert api_res.repo_id == "test-repo-health-1"
    assert api_res.markdown_report == report_res.markdown_report





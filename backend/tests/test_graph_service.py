from pathlib import Path
import tempfile
import pytest

from app.services.graph_service import GraphService


def test_python_import_resolution():
    service = GraphService()
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        app_dir = root / "app"
        services_dir = app_dir / "services"
        services_dir.mkdir(parents=True)

        main_py = app_dir / "main.py"
        main_py.write_text("from app.services.git_service import get_git_service\nfrom .config import settings", encoding="utf-8")

        config_py = app_dir / "config.py"
        config_py.write_text("class Settings:\n    pass", encoding="utf-8")

        git_py = services_dir / "git_service.py"
        git_py.write_text("def get_git_service():\n    pass", encoding="utf-8")

        valid_files = ["app/main.py", "app/config.py", "app/services/git_service.py"]
        graph = service.build_dependency_graph(root, valid_files)

        assert len(graph.nodes) == 3
        edge_ids = [e.id for e in graph.edges]
        assert "app/main.py->app/services/git_service.py" in edge_ids
        assert "app/main.py->app/config.py" in edge_ids

        main_node = next(n for n in graph.nodes if n.id == "app/main.py")
        assert main_node.out_degree == 2
        assert main_node.in_degree == 0

        git_node = next(n for n in graph.nodes if n.id == "app/services/git_service.py")
        assert git_node.in_degree == 1


def test_js_ts_import_resolution():
    service = GraphService()
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        src = root / "src"
        components = src / "components"
        components.mkdir(parents=True)

        app_tsx = src / "App.tsx"
        app_tsx.write_text("import { Button } from './components/Button';\nimport { helper } from './utils';", encoding="utf-8")

        button_tsx = components / "Button.tsx"
        button_tsx.write_text("export const Button = () => null;", encoding="utf-8")

        utils_ts = src / "utils.ts"
        utils_ts.write_text("export const helper = 42;", encoding="utf-8")

        valid_files = ["src/App.tsx", "src/components/Button.tsx", "src/utils.ts"]
        graph = service.build_dependency_graph(root, valid_files)

        edge_ids = [e.id for e in graph.edges]
        assert "src/App.tsx->src/components/Button.tsx" in edge_ids
        assert "src/App.tsx->src/utils.ts" in edge_ids

        btn_node = next(n for n in graph.nodes if n.id == "src/components/Button.tsx")
        assert btn_node.folder == "src/components"
        assert btn_node.label == "Button.tsx"
        assert btn_node.in_degree == 1


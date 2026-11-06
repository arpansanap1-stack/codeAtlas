import ast
import logging
import os
from pathlib import Path
import re
from typing import Dict, List, Optional, Set, Tuple

from app.models.schemas import GraphData, GraphEdge, GraphNode

logger = logging.getLogger("codeatlas.graph")

JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

JS_IMPORT_PATTERN = re.compile(
    r"""(?:import|export)\s+(?:.*?from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)"""
)


class GraphService:
    def __init__(self):
        pass

    def _extract_python_imports(self, content: str) -> List[Tuple[str, int]]:
        """
        Extracts imported module names and relative level from Python AST.
        Returns list of (module_str, relative_level):
          - ("app.models.schemas", 0) for `from app.models.schemas import CodeChunk`
          - ("git_service", 1) for `from .git_service import ...`
          - ("os", 0) for `import os`
        """
        imports: List[Tuple[str, int]] = []
        try:
            tree = ast.parse(content)
        except Exception as e:
            logger.debug(f"Python AST import parse skipped: {e}")
            return imports

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append((alias.name, 0))
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                level = node.level
                imports.append((module, level))

        return imports

    def _extract_js_ts_imports(self, content: str) -> List[str]:
        """Extracts imported module paths from JS/TS code (import, export from, require, import())."""
        import_paths: List[str] = []
        for m in JS_IMPORT_PATTERN.finditer(content):
            matched = m.group(1) or m.group(2) or m.group(3)
            if matched:
                import_paths.append(matched.strip("'\"`"))
        return import_paths

    def _resolve_python_import(
        self,
        source_rel_path: str,
        module_name: str,
        relative_level: int,
        valid_paths_set: Set[str],
    ) -> Optional[str]:
        """Resolves a Python import statement against the repository's valid files."""
        if relative_level > 0:
            source_dir = Path(source_rel_path).parent
            curr_dir = source_dir
            for _ in range(relative_level - 1):
                curr_dir = curr_dir.parent

            if module_name:
                mod_subpath = module_name.replace(".", "/")
                candidate_py = (curr_dir / f"{mod_subpath}.py").as_posix()
                candidate_init = (curr_dir / mod_subpath / "__init__.py").as_posix()
            else:
                candidate_py = (curr_dir / "__init__.py").as_posix()
                candidate_init = candidate_py

            if candidate_py in valid_paths_set:
                return candidate_py
            if candidate_init in valid_paths_set:
                return candidate_init

        if module_name:
            mod_subpath = module_name.replace(".", "/")
            candidate_py = f"{mod_subpath}.py"
            candidate_init = f"{mod_subpath}/__init__.py"

            if candidate_py in valid_paths_set:
                return candidate_py
            if candidate_init in valid_paths_set:
                return candidate_init

            for valid_path in valid_paths_set:
                if valid_path.endswith(f"/{candidate_py}") or valid_path.endswith(f"/{candidate_init}"):
                    return valid_path

        return None

    def _resolve_js_ts_import(
        self,
        source_rel_path: str,
        import_path: str,
        valid_paths_set: Set[str],
    ) -> Optional[str]:
        """Resolves a JavaScript / TypeScript relative or alias import."""
        if not (import_path.startswith("./") or import_path.startswith("../") or import_path.startswith("@/")):
            return None

        source_dir = Path(source_rel_path).parent

        if import_path.startswith("@/"):
            normalized_rel = import_path[2:]
            candidates = [normalized_rel] + [f"{normalized_rel}{ext}" for ext in JS_EXTENSIONS]
            for c in candidates:
                posix_c = Path(c).as_posix()
                if posix_c in valid_paths_set:
                    return posix_c
                src_c = f"src/{posix_c}"
                if src_c in valid_paths_set:
                    return src_c
            return None

        resolved = (source_dir / import_path).as_posix()
        candidates = [resolved] + [f"{resolved}{ext}" for ext in JS_EXTENSIONS]

        for cand in candidates:
            normalized = Path(cand).as_posix()
            while "/./" in normalized:
                normalized = normalized.replace("/./", "/")
            parts = normalized.split("/")
            clean_parts = []
            for p in parts:
                if p == "..":
                    if clean_parts:
                        clean_parts.pop()
                elif p and p != ".":
                    clean_parts.append(p)
            clean_path = "/".join(clean_parts)

            if clean_path in valid_paths_set:
                return clean_path

        return None

    def build_dependency_graph(
        self,
        repo_dir: Path,
        valid_relative_paths: List[str],
    ) -> GraphData:
        """Constructs a directed dependency graph suitable for React Flow."""
        valid_paths_set = set(valid_relative_paths)
        raw_edges: Set[Tuple[str, str]] = set()

        in_degree_map: Dict[str, int] = {p: 0 for p in valid_relative_paths}
        out_degree_map: Dict[str, int] = {p: 0 for p in valid_relative_paths}

        for rel_path in valid_relative_paths:
            full_path = repo_dir / rel_path
            ext = full_path.suffix.lower()

            try:
                content = full_path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            resolved_targets: Set[str] = set()

            if ext == ".py":
                py_imports = self._extract_python_imports(content)
                for mod_name, rel_level in py_imports:
                    target = self._resolve_python_import(
                        source_rel_path=rel_path,
                        module_name=mod_name,
                        relative_level=rel_level,
                        valid_paths_set=valid_paths_set,
                    )
                    if target and target != rel_path:
                        resolved_targets.add(target)

            elif ext in (".js", ".jsx", ".ts", ".tsx"):
                js_imports = self._extract_js_ts_imports(content)
                for imp in js_imports:
                    target = self._resolve_js_ts_import(
                        source_rel_path=rel_path,
                        import_path=imp,
                        valid_paths_set=valid_paths_set,
                    )
                    if target and target != rel_path:
                        resolved_targets.add(target)

            for target in resolved_targets:
                if (rel_path, target) not in raw_edges:
                    raw_edges.add((rel_path, target))
                    out_degree_map[rel_path] = out_degree_map.get(rel_path, 0) + 1
                    in_degree_map[target] = in_degree_map.get(target, 0) + 1

        nodes: List[GraphNode] = []
        for rel_path in sorted(valid_relative_paths):
            p = Path(rel_path)
            parent_folder = p.parent.as_posix()
            if parent_folder == ".":
                parent_folder = "root"

            nodes.append(
                GraphNode(
                    id=rel_path,
                    label=p.name,
                    folder=parent_folder,
                    in_degree=in_degree_map.get(rel_path, 0),
                    out_degree=out_degree_map.get(rel_path, 0),
                    summary="",
                )
            )

        edges: List[GraphEdge] = [
            GraphEdge(
                id=f"{source}->{target}",
                source=source,
                target=target,
            )
            for source, target in sorted(raw_edges)
        ]

        logger.info(
            f"Built dependency graph: {len(nodes)} nodes, {len(edges)} edges."
        )
        return GraphData(nodes=nodes, edges=edges)


_graph_service_instance: Optional[GraphService] = None


def get_graph_service() -> GraphService:
    global _graph_service_instance
    if _graph_service_instance is None:
        _graph_service_instance = GraphService()
    return _graph_service_instance

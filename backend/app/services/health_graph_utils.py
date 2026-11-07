import collections
from typing import Any, Dict, List, Set, Tuple

ENTRYPOINT_PATTERNS = (
    "main.",
    "index.",
    "app.",
    "server.",
    "cli.",
    "manage.",
    "layout.",
    "page.",
    "route.",
    "config.",
    "test_",
    "_test.",
    ".spec.",
)

SOURCE_CODE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".cs",
}

IGNORED_DEAD_FILE_PATTERNS = (
    "__init__.",
    ".d.ts",
    ".config.",
    "schema.sql",
    "scripts/",
    "types/",
)


def find_graph_cycles(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[List[str]]:
    """
    Finds elementary directed cycles in the dependency graph using depth-first search.
    Deduplicates cyclic permutations so cycles like A->B->A are recorded once.
    """
    adj: Dict[str, List[str]] = collections.defaultdict(list)
    for e in edges:
        src = e.get("source")
        tgt = e.get("target")
        if src and tgt and src != tgt:
            adj[src].append(tgt)

    cycles: List[List[str]] = []
    seen_canonical_cycles: Set[Tuple[str, ...]] = set()

    def canonical_repr(cycle: List[str]) -> Tuple[str, ...]:
        # Normalize cycle to start with its lexically smallest node
        min_idx = cycle.index(min(cycle))
        shifted = cycle[min_idx:] + cycle[:min_idx]
        return tuple(shifted)

    visited: Set[str] = set()
    rec_stack: List[str] = []
    rec_set: Set[str] = set()

    def dfs(curr: str):
        visited.add(curr)
        rec_stack.append(curr)
        rec_set.add(curr)

        for nbr in adj.get(curr, []):
            if nbr in rec_set:
                # Cycle found
                cycle_start_idx = rec_stack.index(nbr)
                cycle = rec_stack[cycle_start_idx:]
                canon = canonical_repr(cycle)
                if canon not in seen_canonical_cycles and len(cycle) >= 2:
                    seen_canonical_cycles.add(canon)
                    # Close the loop visually
                    cycles.append(cycle + [nbr])
            elif nbr not in visited:
                dfs(nbr)

        rec_stack.pop()
        rec_set.remove(curr)

    for n in nodes:
        nid = n.get("id")
        if nid and nid not in visited:
            dfs(nid)

    return cycles[:10]  # Cap to top 10 cycles for clarity


def map_extension_to_language(path: str) -> str:
    ext = path.split(".")[-1].lower() if "." in path else "other"
    mapping = {
        "py": "Python",
        "ts": "TypeScript",
        "tsx": "TypeScript (React)",
        "js": "JavaScript",
        "jsx": "JavaScript (React)",
        "sql": "SQL",
        "json": "JSON",
        "yaml": "YAML",
        "yml": "YAML",
        "md": "Markdown",
        "html": "HTML",
        "css": "CSS",
        "sh": "Shell",
        "bash": "Shell",
        "go": "Go",
        "rs": "Rust",
        "java": "Java",
    }
    return mapping.get(ext, ext.upper())

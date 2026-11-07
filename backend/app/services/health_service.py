import collections
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import (
    ArchitectureSmell,
    ArchitectureSmellType,
    CodebaseHealthReportResponse,
    CodebaseHealthResponse,
    LanguageMetric,
    ModuleMetric,
)

logger = logging.getLogger("codeatlas.health")

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


class HealthService:
    """
    Computes architectural health metrics and detects anti-patterns (smells):
    - Circular dependencies
    - God modules
    - Oversized files
    - Unused / orphaned modules
    - Tightly coupled components
    """

    def __init__(self):
        self.settings = get_settings()

    def evaluate_codebase_health(self, repo_id: str) -> CodebaseHealthResponse:
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        repo_name = repo.get("repo_name", "Codebase")
        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        chunks = db.get_code_chunks(repo_id, limit=500, offset=0)

        # 1. Total Files & Lines Metrics
        total_files = len(nodes)
        file_chunks_map: Dict[str, List[Dict[str, Any]]] = collections.defaultdict(list)
        for c in chunks:
            file_chunks_map[c.get("file_path", "")].append(c)

        total_lines = 0
        file_line_counts: Dict[str, int] = {}
        for n in nodes:
            fid = n.get("id", "")
            cached_content = db.get_file_content(repo_id, fid)
            if cached_content:
                lines = len(cached_content.splitlines())
            else:
                c_list = file_chunks_map.get(fid, [])
                lines = max((c.get("end_line", 20) for c in c_list), default=25)
            file_line_counts[fid] = lines
            total_lines += lines

        # 2. Languages Distribution
        lang_counts: Dict[str, int] = collections.defaultdict(int)
        for n in nodes:
            fid = n.get("id", "")
            lang = map_extension_to_language(fid)
            lang_counts[lang] += 1

        languages: List[LanguageMetric] = []
        for lang, count in sorted(lang_counts.items(), key=lambda x: x[1], reverse=True):
            pct = round((count / max(1, total_files)) * 100, 1)
            languages.append(LanguageMetric(language=lang, file_count=count, percentage=pct))

        # 3. Largest Modules
        sorted_by_lines = sorted(file_line_counts.items(), key=lambda x: x[1], reverse=True)
        largest_modules: List[ModuleMetric] = [
            ModuleMetric(
                file_path=fp,
                metric_label="Lines of Code",
                value=lines,
                details=f"{len(file_chunks_map.get(fp, []))} syntax chunks",
            )
            for fp, lines in sorted_by_lines[:5]
        ]

        # 4. Most Connected Files (Degree Centrality Hotspots)
        sorted_by_degree = sorted(
            nodes,
            key=lambda x: x.get("in_degree", 0) + x.get("out_degree", 0),
            reverse=True,
        )
        most_connected_files: List[ModuleMetric] = [
            ModuleMetric(
                file_path=n.get("id", ""),
                metric_label="Connected Edges",
                value=n.get("in_degree", 0) + n.get("out_degree", 0),
                details=f"Fan-In (Importers): {n.get('in_degree', 0)} | Fan-Out (Imports): {n.get('out_degree', 0)}",
            )
            for n in sorted_by_degree[:5]
            if n.get("id")
        ]

        # 5. Graph Density Indicator
        max_possible_edges = total_files * (total_files - 1) if total_files > 1 else 1
        graph_density = round(len(edges) / max(1, max_possible_edges), 4)

        # 6. Smell Detection:
        smells: List[ArchitectureSmell] = []

        # A. Circular Dependencies Detection
        cycles = find_graph_cycles(nodes, edges)
        for cyc in cycles:
            path_str = " -> ".join(p.split("/")[-1] for p in cyc)
            smells.append(
                ArchitectureSmell(
                    smell_type=ArchitectureSmellType.CIRCULAR_DEPENDENCY,
                    severity="critical",
                    title=f"Circular Dependency Cycle ({len(cyc)-1} hops)",
                    description=f"Mutual dependency detected along: `{path_str}`. Circular imports complicate testing and can cause runtime initialization failures.",
                    affected_files=list(dict.fromkeys(cyc[:-1])),
                    refactoring_tip="Extract shared interfaces or state into a separate independent utility module, or use dependency injection.",
                )
            )

        # B. God File Detection (Excessive Coupling)
        for n in nodes:
            in_d = n.get("in_degree", 0)
            out_d = n.get("out_degree", 0)
            tot_d = in_d + out_d
            fid = n.get("id", "")
            fname = fid.split("/")[-1]

            if tot_d >= 8 or in_d >= 6 or out_d >= 8:
                smells.append(
                    ArchitectureSmell(
                        smell_type=ArchitectureSmellType.GOD_FILE,
                        severity="warning" if tot_d < 12 else "critical",
                        title=f"God Module Candidate: {fname}",
                        description=f"`{fid}` is over-coupled with {tot_d} dependencies ({in_d} incoming callers, {out_d} outgoing imports). High coupling elevates regression risk when modified.",
                        affected_files=[fid],
                        refactoring_tip="Decompose this module into specialized single-purpose domain classes or layered facades.",
                    )
                )

        # C. Oversized Module Detection (>350 lines or >12 chunks)
        for fp, lines in sorted_by_lines:
            if lines > 350:
                smells.append(
                    ArchitectureSmell(
                        smell_type=ArchitectureSmellType.OVERSIZED_MODULE,
                        severity="warning",
                        title=f"Oversized Module: {fp.split('/')[-1]} ({lines} lines)",
                        description=f"`{fp}` exceeds recommended file size guidelines ({lines} LOC). Large files correlate with higher defect density and cognitive load.",
                        affected_files=[fp],
                        refactoring_tip="Split responsibilities across distinct helper files or extract UI subcomponents.",
                    )
                )

        # D. Potential Dead Files (in_degree == 0 and not an entrypoint)
        dead_files: List[str] = []
        for n in nodes:
            in_d = n.get("in_degree", 0)
            fid = n.get("id", "")
            fname = fid.split("/")[-1].lower()

            # Skip recognized entrypoints, configs, or tests
            if in_d == 0 and not any(pat in fname for pat in ENTRYPOINT_PATTERNS) and not any(pat in fid.lower() for pat in ENTRYPOINT_PATTERNS):
                dead_files.append(fid)
                smells.append(
                    ArchitectureSmell(
                        smell_type=ArchitectureSmellType.DEAD_MODULE,
                        severity="info",
                        title=f"Potential Orphaned Module: {fname}",
                        description=f"`{fid}` has 0 incoming imports and does not match standard entrypoint or test conventions.",
                        affected_files=[fid],
                        refactoring_tip="Verify if this module is invoked dynamically via reflection/CLI, or prune it if it is unused legacy code.",
                    )
                )

        # E. Tightly Coupled Pairs (Bidirectional Imports)
        edge_set = {(e.get("source"), e.get("target")) for e in edges if e.get("source") and e.get("target")}
        seen_pairs: Set[Tuple[str, str]] = set()
        for src, tgt in edge_set:
            if (tgt, src) in edge_set and src != tgt:
                pair_key = tuple(sorted([src, tgt]))
                if pair_key not in seen_pairs:
                    seen_pairs.add(pair_key)
                    smells.append(
                        ArchitectureSmell(
                            smell_type=ArchitectureSmellType.TIGHT_COUPLING,
                            severity="critical",
                            title=f"Tight Mutual Coupling: {src.split('/')[-1]} ⇄ {tgt.split('/')[-1]}",
                            description=f"`{src}` and `{tgt}` directly import each other, creating an inseparable 2-node cycle.",
                            affected_files=[src, tgt],
                            refactoring_tip="Invert the dependency using an abstract protocol/interface or merge closely related logic into a single cohesive module.",
                        )
                    )

        # 7. Compute Algorithmic Health Score (0 - 100)
        score = 100
        critical_count = sum(1 for s in smells if s.severity == "critical")
        warning_count = sum(1 for s in smells if s.severity == "warning")
        info_count = sum(1 for s in smells if s.severity == "info")

        score -= min(35, critical_count * 15)
        score -= min(25, warning_count * 6)
        score -= min(15, info_count * 3)
        score = max(25, min(100, score))

        if score >= 85:
            rating = "Excellent"
        elif score >= 70:
            rating = "Healthy"
        elif score >= 50:
            rating = "Needs Attention"
        else:
            rating = "Degraded"

        summary = (
            f"Evaluated {total_files} modules ({total_lines:,} lines of code) across {len(languages)} languages. "
            f"Codebase Health Score is {score}/100 ({rating}), with {len(smells)} architectural smell(s) detected "
            f"({critical_count} critical, {warning_count} warning, {info_count} info)."
        )

        return CodebaseHealthResponse(
            repo_id=repo_id,
            health_score=score,
            health_rating=rating,
            total_files=total_files,
            total_lines=total_lines,
            graph_density=graph_density,
            languages=languages,
            largest_modules=largest_modules,
            most_connected_files=most_connected_files,
            circular_dependencies=cycles,
            dead_files=dead_files,
            smells=smells,
            summary=summary,
        )

    def generate_health_markdown_report(self, repo_id: str) -> CodebaseHealthReportResponse:
        """
        Synthesizes a comprehensive, developer-ready Markdown architectural health
        audit report that thoroughly explains each identified problem, its technical risks,
        the affected files, and actionable remediation steps.
        """
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        repo_name = repo.get("repo_name", repo_id)
        health = self.evaluate_codebase_health(repo_id)

        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d %H:%M UTC")

        critical_count = sum(1 for s in health.smells if s.severity == "critical")
        warning_count = sum(1 for s in health.smells if s.severity == "warning")
        info_count = sum(1 for s in health.smells if s.severity == "info")

        def explain_smell_problem(smell: ArchitectureSmell) -> str:
            stype = smell.smell_type
            if stype == ArchitectureSmellType.CIRCULAR_DEPENDENCY:
                return (
                    "**Why This Is a Critical Problem:**\n"
                    "- **Initialization Failures & Deadlocks**: When modules depend on each other cyclically, runtimes (Python, Node.js, etc.) cannot determine a deterministic evaluation order. This frequently leads to runtime crashes such as `ImportError: cannot import name ... from partially initialized module` or `undefined` imports at load time.\n"
                    "- **Testing & Mocking Bottlenecks**: Circular dependencies cannot be tested in isolation. Mocking one file inevitably requires instantiating the entire cycle, causing fragile and tightly entangled unit tests.\n"
                    "- **Cognitive Overhead**: Developers cannot reason about either module independently, as a change to one triggers cascading behavioral side-effects back onto itself."
                )
            elif stype == ArchitectureSmellType.GOD_FILE:
                return (
                    "**Why This Is a High-Risk Problem:**\n"
                    "- **Massive Blast Radius**: A 'God File' accumulates excessive incoming callers (high fan-in) and outgoing dependencies (high fan-out). Changing a single function signature or internal logic can break dozens of distant parts of the system.\n"
                    "- **Frequent Merge Conflicts**: Because many features and developers touch this central hub simultaneously, it becomes a frequent source of painful Git merge conflicts.\n"
                    "- **SRP Violation**: Violates the Single Responsibility Principle by combining orchestrations, utilities, state, and domain operations into a single unmanageable monolith."
                )
            elif stype == ArchitectureSmellType.OVERSIZED_MODULE:
                return (
                    "**Why This Is a Code Quality Problem:**\n"
                    "- **Increased Defect Density**: Software engineering research consistently shows that defect density increases non-linearly with file size (>350-500 LOC). Large files hide edge cases and make thorough code reviews difficult.\n"
                    "- **Poor Cohesion**: Monstrous files usually bundle multiple loosely related capabilities that should belong to dedicated submodules or subcomponents.\n"
                    "- **Developer Fatigue & Navigation Latency**: Scrolling through thousands of lines impedes developer velocity and degrades IDE static analysis responsiveness."
                )
            elif stype == ArchitectureSmellType.TIGHT_COUPLING:
                return (
                    "**Why This Is a Dangerous Architecture Flaw:**\n"
                    "- **Inseparable 2-Node Cluster**: Bidirectional imports mean that Module A cannot exist without Module B, and Module B cannot exist without Module A. They are functionally a single split file masquerading as two separate modules.\n"
                    "- **Refactoring Lock-In**: Extracting or replacing either module requires simultaneous refactoring of both, preventing incremental migration or isolated upgrades."
                )
            elif stype == ArchitectureSmellType.DEAD_MODULE:
                return (
                    "**Why This Is an Architectural Liability:**\n"
                    "- **Code Bloat & Bundle Waste**: Orphaned modules that are never imported increase total bundle size (in client apps) and increase deployment artifact footprints.\n"
                    "- **Cognitive Distraction & Bit-Rot**: When new developers explore the repository, unreferenced dead code creates false assumptions about active system workflows and accumulates bit-rot without automated test coverage."
                )
            return (
                "**Why This Is an Architecture Problem:**\n"
                f"- {smell.description}\n"
                "- Reduces architectural modularity, hampers long-term maintainability, and increases the difficulty of onboarding new developers."
            )

        lines: List[str] = [
            f"# 🏥 Architecture Health & Codebase Quality Audit Report: {repo_name}",
            "",
            f"> **Repository Name:** `{repo_name}` (`{repo_id}`)  ",
            f"> **Health Score:** **{health.health_score} / 100** — `{health.health_rating}`  ",
            f"> **Audit Generated:** `{date_str}` via **CodeAtlas Architectural Diagnostics Engine**  ",
            "",
            "---",
            "",
            "## 📋 1. Executive Summary",
            "",
            health.summary,
            "",
        ]

        if health.health_score >= 85:
            lines.extend([
                "### Architectural Verdict: 🟢 Excellent Modularity",
                "The repository exhibits clean separation of concerns, high modular cohesion, and minimal structural anti-patterns. Dependency graphs are largely acyclic and component fan-out is well-contained.",
                "",
            ])
        elif health.health_score >= 70:
            lines.extend([
                "### Architectural Verdict: 🔵 Healthy with Minor Improvement Areas",
                "The codebase is in good structural health overall. However, a small number of architectural hotspots or oversized files have been detected. Proactive refactoring now will prevent technical debt from compounding.",
                "",
            ])
        elif health.health_score >= 50:
            lines.extend([
                "### Architectural Verdict: 🟡 Needs Attention — Moderate Architecture Debt",
                "Several architectural warning signs were discovered, including high coupling, oversized modules, or circular dependencies. These anti-patterns elevate regression risks and increase cognitive onboarding load.",
                "",
            ])
        else:
            lines.extend([
                "### Architectural Verdict: 🔴 Degraded — Critical Architecture Debt",
                "The codebase contains multiple critical architectural anti-patterns, such as circular dependency loops and over-coupled God modules. These issues threaten runtime stability, prevent isolated testing, and require structural refactoring.",
                "",
            ])

        lines.extend([
            "---",
            "",
            "## 📊 2. Scorecard & Vital Structural Metrics",
            "",
            "| Metric | Value | Architectural Interpretation |",
            "| :--- | :--- | :--- |",
            f"| **Overall Health Score** | **{health.health_score}/100** ({health.health_rating}) | Weighted health index based on coupling, cycles, and modularity |",
            f"| **Total Modules Analyzed** | **{health.total_files} files** | Total distinct source code files indexed in dependency graph |",
            f"| **Total Lines of Code** | **{health.total_lines:,} LOC** | Aggregate volume of codebase lines |",
            f"| **Graph Coupling Density** | **{(health.graph_density * 100):.2f}%** | Ratio of actual import edges to total theoretically possible edges |",
            f"| **Total Architecture Smells** | **{len(health.smells)} issues** | Detected anti-patterns across all severity tiers |",
            f"| ↳ Critical Smells | `{critical_count}` | Urgent issues (cycles, tight coupling) risking runtime crashes |",
            f"| ↳ Warning Smells | `{warning_count}` | Moderately severe issues (God files, oversized modules) |",
            f"| ↳ Informational / Dead Code | `{info_count}` | Minor hygiene issues (orphaned/unreferenced files) |",
            f"| **Circular Dependency Loops** | **{len(health.circular_dependencies)} cycles** | Mutually recursive import cycles detected in static topology |",
            "",
            "---",
            "",
            "## ⚠️ 3. In-Depth Problem Explanations & Diagnostic Breakdown",
            "",
            "This section details each architectural problem identified in the repository, explaining the precise technical risks it poses and providing actionable refactoring strategies.",
            "",
        ])

        if not health.smells:
            lines.extend([
                "> 🛡️ **Zero Architectural Smells Detected!**",
                "> The codebase maintains clean architectural boundaries with no circular imports, no monolithic God files, and well-proportioned module sizes.",
                "",
            ])
        else:
            for idx, smell in enumerate(health.smells, 1):
                sev_emoji = "🔴" if smell.severity == "critical" else ("🟡" if smell.severity == "warning" else "🔵")
                lines.extend([
                    f"### Problem #{idx}: {sev_emoji} [{smell.severity.upper()}] {smell.title}",
                    "",
                    f"- **Smell Category:** `{smell.smell_type.value}`",
                    f"- **Severity Level:** **{smell.severity.upper()}**",
                    f"- **Observable Symptom:** {smell.description}",
                    "",
                    explain_smell_problem(smell),
                    "",
                    "**Affected Modules & File Paths:**",
                ])
                for fpath in smell.affected_files:
                    lines.append(f"- `[{fpath}]`")
                lines.extend([
                    "",
                    "**Recommended Remediation / Fix Strategy:**",
                    f"> 💡 **Actionable Tip:** {smell.refactoring_tip}",
                    "",
                    "---",
                    "",
                ])

        lines.extend([
            "## 🔄 4. Circular Dependency Loops Deep-Dive",
            "",
        ])
        if not health.circular_dependencies:
            lines.extend([
                "✅ **No circular dependency cycles found.** The import graph forms a clean Directed Acyclic Graph (DAG).",
                "",
            ])
        else:
            lines.extend([
                f"Detected **{len(health.circular_dependencies)} circular loop(s)** in the codebase import graph. Circular cycles undermine module independence and frequently cause runtime import deadlocks.",
                "",
            ])
            for c_idx, cycle in enumerate(health.circular_dependencies, 1):
                path_display = " ➔ ".join(f"`{f}`" for f in cycle)
                lines.extend([
                    f"#### Cycle #{c_idx} ({len(cycle)-1} hops):",
                    f"> {path_display}",
                    "",
                    "**How to break this cycle:**",
                    f"1. Identify the shared data structures or functions shared between `{cycle[0]}` and `{cycle[-2] if len(cycle) > 2 else cycle[1]}`.",
                    "2. Extract those shared entities into a separate, lower-level interface or types module (e.g. `types.ts` or `schemas.py`).",
                    "3. Update both modules to import from the new extracted module rather than importing each other directly.",
                    "",
                ])

        lines.extend([
            "---",
            "",
            "## 🔥 5. Hotspots & Architectural Blast Radius",
            "",
            "### Top Most Connected Hub Files (Highest Blast Radius)",
            "Files with high degree centrality (fan-in + fan-out) represent core architectural junctions. Any bug or interface change in these modules radiates across dependent systems.",
            "",
            "| Module Path | Degree Centrality | Details |",
            "| :--- | :--- | :--- |",
        ])
        for hub in health.most_connected_files:
            lines.append(f"| `{hub.file_path}` | **{hub.value} edges** | {hub.details or 'Connected hub'} |")

        lines.extend([
            "",
            "### Largest Modules by Lines of Code",
            "Modules with excessive length are prime candidates for SRP decomposition.",
            "",
            "| Module Path | Lines of Code | Complexity Chunks |",
            "| :--- | :--- | :--- |",
        ])
        for mod in health.largest_modules:
            lines.append(f"| `{mod.file_path}` | **{mod.value} lines** | {mod.details or '-'} |")

        if health.dead_files:
            lines.extend([
                "",
                "### Potential Orphaned / Dead Modules",
                "These modules have 0 incoming imports and do not match standard entrypoint patterns (such as `main.py`, `index.ts`, `page.tsx`). Audit them to confirm if they are dynamically invoked, test files, or dead code.",
                "",
            ])
            for df in health.dead_files:
                lines.append(f"- `[{df}]`")

        lines.extend([
            "",
            "---",
            "",
            "## 💻 6. Language & Technology Stack Composition",
            "",
            "| Language | Files Count | Percentage Share |",
            "| :--- | :--- | :--- |",
        ])
        for lang in health.languages:
            lines.append(f"| **{lang.language}** | {lang.file_count} files | {lang.percentage}% |")

        lines.extend([
            "",
            "---",
            "",
            "## 🎯 7. Prioritized Engineering Remediation Roadmap",
            "",
            "To systematically elevate this codebase's health score and eliminate structural risks, follow this 3-phase remediation plan:",
            "",
            "### 🔴 Phase 1: High-Priority Safety Interventions (P0 — Days 1–3)",
            "- **Break Circular Imports**: Eliminate all detected circular cycles by extracting shared interfaces or applying the Dependency Inversion Principle.",
            "- **Decouple Mutual Pairs**: Invert dependencies on tightly coupled 2-node file pairs to enable isolated testing.",
            "",
            "### 🟡 Phase 2: Hub & Blast Radius Reduction (P1 — Week 1)",
            "- **Refactor God Modules**: Introduce domain facades or divide multi-responsibility files into cohesive sub-services.",
            "- **Protect Hub Callers**: Ensure unit tests thoroughly mock high fan-in dependencies to prevent upstream regression cascades.",
            "",
            "### 🔵 Phase 3: Maintainability & Code Hygiene (P2 — Ongoing)",
            "- **Split Oversized Files**: Break files exceeding 350 LOC into modular presentation/logic subcomponents.",
            "- **Clean Dead Code**: Verify and prune unused modules to reduce bundle weight and cognitive debt.",
            "",
            "---",
            "",
            "> *Report compiled automatically by **CodeAtlas**. For interactive visualization, visual cycle exploration, and Monaco line-by-line inspection, launch the CodeAtlas Web Workspace.*",
        ])

        report_markdown = "\n".join(lines)
        return CodebaseHealthReportResponse(
            repo_id=repo_id,
            repo_name=repo_name,
            health_score=health.health_score,
            health_rating=health.health_rating,
            markdown_report=report_markdown,
            generated_at=now,
        )


_health_service_instance: Optional[HealthService] = None


def get_health_service() -> HealthService:
    global _health_service_instance
    if _health_service_instance is None:
        _health_service_instance = HealthService()
    return _health_service_instance

import collections
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
from app.services.health_graph_utils import (
    ENTRYPOINT_PATTERNS,
    IGNORED_DEAD_FILE_PATTERNS,
    SOURCE_CODE_EXTENSIONS,
    find_graph_cycles,
    map_extension_to_language,
)
from app.services.health_report_generator import generate_health_markdown_report_content

logger = logging.getLogger("codeatlas.health")


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

            # Only analyze actual source code files (exclude markdown, configs, text, json, sql, assets)
            ext = "." + fid.split(".")[-1].lower() if "." in fid else ""
            if ext not in SOURCE_CODE_EXTENSIONS:
                continue

            # Skip package inits, type declarations, test files, scripts, or recognized entrypoint patterns
            if any(pat in fname for pat in IGNORED_DEAD_FILE_PATTERNS) or any(pat in fid.lower() for pat in IGNORED_DEAD_FILE_PATTERNS):
                continue
            if any(pat in fname for pat in ENTRYPOINT_PATTERNS) or any(pat in fid.lower() for pat in ENTRYPOINT_PATTERNS):
                continue

            if in_d == 0:
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
        return generate_health_markdown_report_content(health, repo_name, repo_id)


_health_service_instance: Optional[HealthService] = None


def get_health_service() -> HealthService:
    global _health_service_instance
    if _health_service_instance is None:
        _health_service_instance = HealthService()
    return _health_service_instance

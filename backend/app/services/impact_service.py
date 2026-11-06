import collections
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set
from google import genai

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import (
    DependentModule,
    ImpactAnalysisResponse,
    ImpactRiskLevel,
)

logger = logging.getLogger("codeatlas.impact")


class ImpactService:
    """
    Computes architectural impact analysis and blast radius for a given module:
    - Direct dependents (files directly importing the target).
    - Transitive downstream dependents (reverse dependency BFS traversal).
    - Quantitative risk score and categorical severity (Low, Moderate, High, Critical).
    - Subsystem exposure analysis (APIs, UI views, data transactions).
    """

    def __init__(self):
        self.settings = get_settings()

    def analyze_impact(self, repo_id: str, target_file: str) -> ImpactAnalysisResponse:
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])

        # Validate target file exists in repository
        all_node_ids = {n.get("id") for n in nodes if n.get("id")}
        matched_target = target_file
        if target_file not in all_node_ids:
            # Suffix match fallback
            matched = next((nid for nid in all_node_ids if nid and (nid.endswith(target_file) or target_file.endswith(nid))), None)
            if matched:
                matched_target = matched
            else:
                # Still compute with the provided path even if isolated
                matched_target = target_file

        # Build reverse adjacency map: target_imported -> list of callers (sources)
        # In our graph format: edge.source imports edge.target.
        # Therefore, if edge.target == matched_target, edge.source depends on it!
        reverse_adj: Dict[str, List[str]] = collections.defaultdict(list)
        for e in edges:
            src = e.get("source")
            tgt = e.get("target")
            if src and tgt:
                reverse_adj[tgt].append(src)

        # BFS to discover direct and transitive dependents
        direct_modules: List[DependentModule] = []
        indirect_modules: List[DependentModule] = []
        all_affected: Set[str] = set()

        queue = collections.deque([(matched_target, 0)])
        visited: Set[str] = {matched_target}

        while queue:
            curr, depth = queue.popleft()

            callers = reverse_adj.get(curr, [])
            for caller in callers:
                if caller not in visited:
                    visited.add(caller)
                    all_affected.add(caller)
                    new_depth = depth + 1

                    dep_module = DependentModule(
                        file_path=caller,
                        depth=new_depth,
                        is_direct=(new_depth == 1),
                        import_symbol=None,
                    )

                    if new_depth == 1:
                        direct_modules.append(dep_module)
                    else:
                        indirect_modules.append(dep_module)

                    queue.append((caller, new_depth))

        blast_score = len(all_affected)

        # Determine Risk Level
        if blast_score == 0:
            risk_level = ImpactRiskLevel.LOW
        elif blast_score <= 2:
            risk_level = ImpactRiskLevel.LOW
        elif blast_score <= 5:
            risk_level = ImpactRiskLevel.MODERATE
        elif blast_score <= 10:
            risk_level = ImpactRiskLevel.HIGH
        else:
            risk_level = ImpactRiskLevel.CRITICAL

        # Identify Affected Subsystems
        affected_subsystems_set: Set[str] = set()
        for f in all_affected:
            f_lower = f.lower()
            if any(kw in f_lower for kw in ("api", "router", "endpoint", "controller")):
                affected_subsystems_set.add("Public API & Ingress Routes")
            if any(kw in f_lower for kw in ("component", "ui", "page", "view", "drawer", "modal")):
                affected_subsystems_set.add("Frontend UI & User Interfaces")
            if any(kw in f_lower for kw in ("service", "worker", "pipeline", "processor")):
                affected_subsystems_set.add("Domain Services & Pipelines")
            if any(kw in f_lower for kw in ("db", "database", "model", "schema", "storage")):
                affected_subsystems_set.add("Persistence & Data Layer")

        if not affected_subsystems_set:
            affected_subsystems_set.add("Internal Leaf Utility")

        affected_subsystems = sorted(list(affected_subsystems_set))

        # Generate Human-Friendly Summary
        filename = matched_target.split("/")[-1]
        if blast_score == 0:
            summary = (
                f"`{filename}` is an isolated leaf module with 0 downstream dependents. "
                "Changes here have zero blast radius and will not affect other parts of the application."
            )
        elif blast_score == 1:
            summary = (
                f"Modifying `{filename}` has a minimal blast radius, directly impacting 1 downstream module (`{direct_modules[0].file_path}`)."
            )
        else:
            summary = (
                f"Modifying `{filename}` has a {risk_level.value.upper()} impact score, directly affecting "
                f"{len(direct_modules)} modules and transitively reaching {len(indirect_modules)} additional downstream components."
            )

        # Formulate Recommendations
        recommendations = []
        if blast_score > 0:
            recommendations.append(
                f"Verify downstream callers: run tests targeting direct dependents ({', '.join(m.file_path.split('/')[-1] for m in direct_modules[:3])})."
            )
            recommendations.append(
                "Maintain interface stability: avoid breaking changes to exported function signatures or parameter types."
            )
        if blast_score >= 5:
            recommendations.append(
                "High coupling detected: consider deprecating old methods with fallback bridges rather than modifying in-place."
            )
            recommendations.append(
                "Regression safeguard: perform end-to-end integration testing before merging changes to this module."
            )
        if blast_score == 0:
            recommendations.append("Safe to refactor freely without breaking downstream imports.")

        return ImpactAnalysisResponse(
            repo_id=repo_id,
            target_file=matched_target,
            risk_level=risk_level,
            blast_radius_score=blast_score,
            direct_dependents=direct_modules,
            indirect_dependents=indirect_modules,
            all_affected_file_paths=sorted(list(all_affected)),
            summary=summary,
            affected_subsystems=affected_subsystems,
            recommendations=recommendations,
        )


_impact_service_instance: Optional[ImpactService] = None


def get_impact_service() -> ImpactService:
    global _impact_service_instance
    if _impact_service_instance is None:
        _impact_service_instance = ImpactService()
    return _impact_service_instance

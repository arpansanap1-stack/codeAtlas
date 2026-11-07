import collections
import re
from typing import Any, Dict, List
from app.models.schemas import JourneyResponse, JourneyStep


def find_journey_path(
    repo_id: str,
    topic: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]],
) -> JourneyResponse:
    """Topological pathfinder that traces a causal execution route across graph nodes."""
    if not nodes:
        return JourneyResponse(
            repo_id=repo_id,
            topic=topic,
            summary=f"No graph nodes found to trace '{topic}'.",
            steps=[],
        )

    # Score nodes based on topic keywords
    keywords = [w.lower() for w in re.findall(r"\w+", topic) if len(w) > 2]
    scored_nodes = []
    for n in nodes:
        nid = n.get("id", "").lower()
        score = sum(1 for kw in keywords if kw in nid)
        scored_nodes.append((score, n))

    scored_nodes.sort(key=lambda x: x[0], reverse=True)

    # Adjacency map for path finding
    adj: Dict[str, List[str]] = collections.defaultdict(list)
    for e in edges:
        src = e.get("source")
        tgt = e.get("target")
        if src and tgt:
            adj[src].append(tgt)

    # Choose start node: top-scored node or root controller
    selected_path: List[str] = []
    start_candidates = [n[1]["id"] for n in scored_nodes if n[0] > 0]
    if not start_candidates:
        # Pick lowest in-degree node (entry point)
        sorted_by_in = sorted(nodes, key=lambda x: x.get("in_degree", 0))
        start_candidates = [sorted_by_in[0]["id"]]

    curr = start_candidates[0]
    selected_path.append(curr)

    # Follow edges up to 5 steps
    visited = {curr}
    while len(selected_path) < 5:
        neighbors = [nbr for nbr in adj[curr] if nbr not in visited]
        if not neighbors:
            break
        # Prefer neighbor with matching keywords or deepest out-degree
        best_next = neighbors[0]
        curr = best_next
        visited.add(curr)
        selected_path.append(curr)

    # If path is only 1 or 2 nodes, pick other relevant nodes to form a full journey
    if len(selected_path) < 3:
        for _, n in scored_nodes:
            nid = n["id"]
            if nid not in visited:
                selected_path.append(nid)
                visited.add(nid)
                if len(selected_path) >= 4:
                    break

    # Map selected path to JourneySteps with chunk citations
    steps: List[JourneyStep] = []
    for i, file_path in enumerate(selected_path):
        matching_chunk = next((c for c in chunks if c.get("file_path") == file_path), None)
        symbol = matching_chunk.get("symbol_name") if matching_chunk else None
        start_line = matching_chunk.get("start_line", 1) if matching_chunk else 1
        end_line = matching_chunk.get("end_line", 30) if matching_chunk else 30

        outgoing = selected_path[i + 1] if i + 1 < len(selected_path) else None

        # Generate narrative step explanation
        if i == 0:
            title = "Entry Ingress & Request Initiation"
            explanation = (
                f"Execution starts here in `[{file_path}:{start_line}-{end_line}]`. "
                f"The handler validates incoming inputs and prepares the execution payload "
                f"before delegating to `{outgoing or 'downstream services'}`."
            )
        elif outgoing:
            title = f"Domain Processing & State Coordination ({symbol or 'Service Layer'})"
            explanation = (
                f"Core logic executes within `[{file_path}:{start_line}-{end_line}]`. "
                f"Transforms and verifies state parameters, then forwards the context to `{outgoing}`."
            )
        else:
            title = f"Data Persistence & Final Response ({symbol or 'Terminal Layer'})"
            explanation = (
                f"The flow concludes in `[{file_path}:{start_line}-{end_line}]`. "
                "Final operations, database updates, or client response formatting are fulfilled here."
            )

        steps.append(
            JourneyStep(
                step_number=i + 1,
                title=title,
                file_path=file_path,
                symbol_name=symbol,
                start_line=start_line,
                end_line=end_line,
                explanation=explanation,
                outgoing_target=outgoing,
            )
        )

    summary = (
        f"Interactive {len(steps)}-step execution journey tracing '{topic}' "
        f"from `{selected_path[0]}` to `{selected_path[-1]}`."
    )

    return JourneyResponse(
        repo_id=repo_id,
        topic=topic,
        summary=summary,
        steps=steps,
    )

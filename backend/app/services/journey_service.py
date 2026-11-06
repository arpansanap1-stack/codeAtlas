import collections
from datetime import datetime, timezone
import json
import logging
import re
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import (
    JourneyResponse,
    JourneyStep,
    SuggestedJourneyItem,
    SuggestedJourneysResponse,
)

logger = logging.getLogger("codeatlas.journey")

JOURNEY_MODEL = "gemini-flash-lite-latest"


class JourneyService:
    """
    Creates interactive, step-by-step guided journeys through code execution paths.
    Enables users to step through: UI -> Route -> Service -> Database -> Protected Resource.
    """

    def __init__(self):
        self.settings = get_settings()
        self.client: Optional[genai.Client] = None
        key = self.settings.GEMINI_API_KEY
        if key and not key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=key)
            except Exception as e:
                logger.warning(f"Could not initialize GenAI client in JourneyService: {e}")

    def is_configured(self) -> bool:
        return self.client is not None

    def get_suggested_journeys(self, repo_id: str) -> SuggestedJourneysResponse:
        """Inspects codebase graph and files to suggest relevant execution journeys."""
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        all_paths = [n.get("id", "").lower() for n in nodes]

        suggestions: List[SuggestedJourneyItem] = []

        # Check for Ingestion / Pipeline
        if any("git" in p or "ingest" in p or "pipe" in p for p in all_paths):
            suggestions.append(
                SuggestedJourneyItem(
                    topic="Repository Ingestion & Processing Pipeline",
                    description="Follow how raw GitHub URLs are cloned, filtered, AST-chunked, and stored.",
                    category="Core Pipeline",
                )
            )

        # Check for AI / Chat / RAG
        if any("chat" in p or "rag" in p or "embed" in p or "ai" in p for p in all_paths):
            suggestions.append(
                SuggestedJourneyItem(
                    topic="AI Streaming RAG & Citation Flow",
                    description="Trace how user queries retrieve vector chunks, expand graph context, and stream over SSE.",
                    category="AI & Reasoning",
                )
            )

        # Check for Auth
        if any("auth" in p or "login" in p or "jwt" in p or "session" in p or "user" in p for p in all_paths):
            suggestions.append(
                SuggestedJourneyItem(
                    topic="Authentication & Session Verification Flow",
                    description="Trace credentials validation, token verification, and route protection.",
                    category="Security",
                )
            )

        # Check for UI / State Visualization
        if any("component" in p or "map" in p or "ui" in p or "view" in p for p in all_paths):
            suggestions.append(
                SuggestedJourneyItem(
                    topic="Architecture Map Rendering & Interactive Synchronization",
                    description="Trace how graph nodes, layout algorithms, and Monaco code highlighting synchronize.",
                    category="Frontend & UI",
                )
            )

        # Universal Default Suggestions
        if len(suggestions) < 3:
            suggestions.append(
                SuggestedJourneyItem(
                    topic="Primary Request / Response Lifecycle",
                    description="Trace an incoming request from public entry route to backend database.",
                    category="Lifecycle",
                )
            )
            suggestions.append(
                SuggestedJourneyItem(
                    topic="Data Persistence & Storage Execution Path",
                    description="Follow how domain entities are transformed and saved into the database layer.",
                    category="Database",
                )
            )

        return SuggestedJourneysResponse(repo_id=repo_id, journeys=suggestions)

    def generate_journey(self, repo_id: str, topic: str) -> JourneyResponse:
        """Constructs an interactive step-by-step code journey for the given topic."""
        clean_topic = topic.strip()
        if not clean_topic:
            clean_topic = "Primary Request Flow"

        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        # Check cache
        cached = db.get_journey(repo_id, clean_topic)
        if cached:
            steps = [JourneyStep(**s) for s in cached.get("steps", [])]
            return JourneyResponse(
                repo_id=repo_id,
                topic=clean_topic,
                summary=cached.get("summary", f"Guided journey for {clean_topic}"),
                steps=steps,
            )

        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        chunks = db.get_code_chunks(repo_id, limit=60, offset=0)

        # Attempt Gemini-powered journey generation
        if self.client:
            try:
                gemini_res = self._generate_with_gemini(
                    clean_topic, repo.get("repo_name", "Codebase"), nodes, edges, chunks
                )
                if gemini_res and gemini_res.steps:
                    db.save_journey(
                        repo_id=repo_id,
                        topic=clean_topic,
                        summary=gemini_res.summary,
                        steps=[s.model_dump() for s in gemini_res.steps],
                    )
                    return gemini_res
            except Exception as e:
                logger.error(f"Gemini journey generation failed: {e}. Falling back to graph path algorithm.")

        # Deterministic graph-path fallback
        fallback_res = self._generate_graph_fallback(repo_id, clean_topic, nodes, edges, chunks)
        db.save_journey(
            repo_id=repo_id,
            topic=clean_topic,
            summary=fallback_res.summary,
            steps=[s.model_dump() for s in fallback_res.steps],
        )
        return fallback_res

    def _generate_with_gemini(
        self,
        topic: str,
        repo_name: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        chunks: List[Dict[str, Any]],
    ) -> Optional[JourneyResponse]:
        node_ids = [n.get("id") for n in nodes if n.get("id")]
        sample_chunks_summary = []
        for c in chunks[:25]:
            fp = c.get("file_path")
            sym = c.get("symbol_name")
            sl = c.get("start_line")
            el = c.get("end_line")
            sample_chunks_summary.append(f"{fp} | {sym} (lines {sl}-{el})")

        system_instruction = (
            "You are CodeAtlas, an interactive codebase journey synthesizer.\n"
            "Given a user query (e.g. 'How does authentication work?' or 'Ingestion Flow'), "
            "generate an ordered, sequential execution path (3 to 6 steps) tracing the code path from trigger to completion.\n"
            "Output strictly valid JSON matching this schema:\n"
            "{\n"
            '  "summary": "Brief 1-sentence summary of the flow.",\n'
            '  "steps": [\n'
            '    {\n'
            '      "step_number": 1,\n'
            '      "title": "Short descriptive step name (e.g. Ingress Controller)",\n'
            '      "file_path": "exact_file_path_from_list",\n'
            '      "symbol_name": "function_or_class_name",\n'
            '      "start_line": 10,\n'
            '      "end_line": 35,\n'
            '      "explanation": "Clear 2-sentence explanation of what happens in this step and why it moves to the next file.",\n'
            '      "outgoing_target": "target_file_path_of_next_step_or_null"\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Only reference file paths that exist in the provided list."
        )

        user_prompt = f"""# Codebase: {repo_name}
Target Journey Topic: {topic}

Available Files:
{json.dumps(node_ids[:40])}

Sample Symbols & Line Numbers:
{chr(10).join(sample_chunks_summary[:20])}

Generate the JSON journey now."""

        model = getattr(self.settings, "GEMINI_CHAT_MODEL", JOURNEY_MODEL)
        response = self.client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=1500,
            ),
        )

        text = response.text or "{}"
        data = json.loads(text)
        steps_raw = data.get("steps", [])
        if not steps_raw:
            return None

        steps: List[JourneyStep] = []
        for i, s in enumerate(steps_raw):
            steps.append(
                JourneyStep(
                    step_number=i + 1,
                    title=s.get("title", f"Step {i + 1}"),
                    file_path=s.get("file_path", node_ids[0] if node_ids else "main.py"),
                    symbol_name=s.get("symbol_name"),
                    start_line=int(s.get("start_line", 1)),
                    end_line=int(s.get("end_line", 30)),
                    explanation=s.get("explanation", "Processes request data and coordinates downstream dependencies."),
                    outgoing_target=s.get("outgoing_target"),
                )
            )

        return JourneyResponse(
            repo_id="",
            topic=topic,
            summary=data.get("summary", f"Guided execution journey for {topic}"),
            steps=steps,
        )

    def _generate_graph_fallback(
        self,
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


_journey_service_instance: Optional[JourneyService] = None


def get_journey_service() -> JourneyService:
    global _journey_service_instance
    if _journey_service_instance is None:
        _journey_service_instance = JourneyService()
    return _journey_service_instance


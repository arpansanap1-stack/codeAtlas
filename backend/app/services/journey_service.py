import json
import logging
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import (
    JourneyResponse,
    JourneyStep,
    SuggestedJourneysResponse,
)
from app.services.journey_suggestions import build_suggested_journeys
from app.services.journey_pathfinder import find_journey_path

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
        suggestions = build_suggested_journeys(nodes)
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
        return find_journey_path(
            repo_id=repo_id,
            topic=topic,
            nodes=nodes,
            edges=edges,
            chunks=chunks,
        )


_journey_service_instance: Optional[JourneyService] = None


def get_journey_service() -> JourneyService:
    global _journey_service_instance
    if _journey_service_instance is None:
        _journey_service_instance = JourneyService()
    return _journey_service_instance


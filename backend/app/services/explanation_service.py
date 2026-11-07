import logging
from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import ArchitectureExplanationResponse
from app.services.explanation_templates import build_fallback_explanation

logger = logging.getLogger("codeatlas.explanation")

EXPLANATION_MODEL = "gemini-flash-lite-latest"


class ExplanationService:
    """
    Synthesizes multi-level architecture explanations:
    - Beginner: Conceptual mental models, analogies, entry point clarity, zero jargon.
    - Intermediate: Standard architecture patterns, request lifecycles, data contracts.
    - Expert: Concurrency, scalability, dependency boundaries, design trade-offs.
    """

    def __init__(self):
        self.settings = get_settings()
        self.client: Optional[genai.Client] = None
        key = self.settings.GEMINI_API_KEY
        if key and not key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=key)
            except Exception as e:
                logger.warning(f"Could not initialize GenAI client in ExplanationService: {e}")

    def is_configured(self) -> bool:
        return self.client is not None

    def explain_architecture(
        self, repo_id: str, level: str = "intermediate"
    ) -> ArchitectureExplanationResponse:
        level_clean = level.lower().strip()
        if level_clean not in ("beginner", "intermediate", "expert"):
            level_clean = "intermediate"

        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        # Check cache
        cached = db.get_architecture_explanation(repo_id, level_clean)
        if cached:
            return ArchitectureExplanationResponse(
                repo_id=repo_id,
                level=level_clean,
                title=cached.get("title", f"{repo.get('repo_name', 'Repository')} Architecture Explanation"),
                markdown_content=cached["markdown_content"],
                updated_at=datetime.fromisoformat(cached["updated_at"]),
            )

        repo_name = repo.get("repo_name", "Codebase")
        directory_tree = repo.get("directory_tree", "")
        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])

        # Gather sample chunks & manifest
        chunks = db.get_code_chunks(repo_id, limit=30, offset=0)
        readme_content = db.get_file_content(repo_id, "README.md") or db.get_file_content(repo_id, "readme.md") or ""

        # Identify Entry Points (0 in-degree or entry-point naming convention)
        entry_points = []
        for n in nodes:
            label = n.get("label", "").lower()
            in_deg = n.get("in_degree", 0)
            if in_deg == 0 or any(kw in label for kw in ("main.", "index.", "app.", "server.", "cli.")):
                entry_points.append(n.get("id"))
        entry_points = entry_points[:5]

        # Top hub modules (high in-degree)
        sorted_by_in_deg = sorted(nodes, key=lambda x: x.get("in_degree", 0), reverse=True)
        top_hubs = [n.get("id") for n in sorted_by_in_deg[:5] if n.get("id")]

        # Attempt Gemini synthesis if client is available
        if self.client:
            try:
                markdown = self._generate_with_gemini(
                    repo_name=repo_name,
                    level=level_clean,
                    directory_tree=directory_tree,
                    nodes=nodes,
                    edges=edges,
                    entry_points=entry_points,
                    top_hubs=top_hubs,
                    chunks=chunks,
                    readme_content=readme_content,
                )
                if markdown and len(markdown.strip()) > 100:
                    title = f"{repo_name} — Architecture Walkthrough ({level_clean.capitalize()} Mode)"
                    saved = db.save_architecture_explanation(
                        repo_id=repo_id,
                        level=level_clean,
                        title=title,
                        markdown_content=markdown,
                    )
                    return ArchitectureExplanationResponse(
                        repo_id=repo_id,
                        level=level_clean,
                        title=title,
                        markdown_content=saved["markdown_content"],
                        updated_at=datetime.fromisoformat(saved["updated_at"]),
                    )
            except Exception as e:
                logger.error(f"Gemini architecture explanation failed: {e}. Falling back to deterministic synthesizer.")

        # Fallback deterministic synthesizer
        markdown = self._generate_fallback(
            repo_name=repo_name,
            level=level_clean,
            directory_tree=directory_tree,
            nodes=nodes,
            edges=edges,
            entry_points=entry_points,
            top_hubs=top_hubs,
            chunks=chunks,
        )

        title = f"{repo_name} — Architecture Walkthrough ({level_clean.capitalize()} Mode)"
        saved = db.save_architecture_explanation(
            repo_id=repo_id,
            level=level_clean,
            title=title,
            markdown_content=markdown,
        )

        return ArchitectureExplanationResponse(
            repo_id=repo_id,
            level=level_clean,
            title=title,
            markdown_content=saved["markdown_content"],
            updated_at=datetime.fromisoformat(saved["updated_at"]),
        )

    def _generate_with_gemini(
        self,
        repo_name: str,
        level: str,
        directory_tree: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        entry_points: List[str],
        top_hubs: List[str],
        chunks: List[Dict[str, Any]],
        readme_content: str,
    ) -> str:
        level_prompts = {
            "beginner": (
                "Audience: Beginners, junior developers, or product engineers new to this stack.\n"
                "- Tone: Friendly, highly accessible, structured, using clear analogies.\n"
                "- Avoid unnecessary jargon. Explain *why* components exist and what they achieve.\n"
                "- Emphasize the mental model and the 3-step beginner onboarding path."
            ),
            "intermediate": (
                "Audience: Mid-level engineers and full-stack developers familiar with modern web architecture.\n"
                "- Tone: Pragmatic, professional, code-centric.\n"
                "- Detail design patterns, API boundaries, state lifecycles, and data transformations.\n"
                "- Explicitly diagram how data moves through layers."
            ),
            "expert": (
                "Audience: Staff/Principal Architects, Tech Leads, and Systems Engineers.\n"
                "- Tone: Analytical, rigorous, deep-dive into engineering mechanics.\n"
                "- Detail concurrency models, database isolation, network roundtrips, potential latency bottlenecks, and coupling trade-offs.\n"
                "- Critically analyze architectural boundaries and blast radius."
            ),
        }

        # Format sample chunk citations
        sample_citations = []
        for c in chunks[:12]:
            fp = c.get("file_path", "")
            sl = c.get("start_line", 1)
            el = c.get("end_line", 20)
            sym = c.get("symbol_name", "module")
            sample_citations.append(f"- {sym} in `[{fp}:{sl}-{el}]`")

        system_instruction = (
            "You are CodeAtlas, a Senior Staff Software Architect explaining a software system.\n"
            f"{level_prompts.get(level, level_prompts['intermediate'])}\n\n"
            "STRICT CITATION RULE (CRITICAL):\n"
            "Every time you mention a file, class, function, or entry point, you MUST provide a clickable citation in the exact format: `[file_path:start_line-end_line]`.\n"
            "Include valid Mermaid.js diagrams (`flowchart TD` or `flowchart LR`) for data flow.\n"
            "Output must be structured Markdown with the following exact 6 sections:\n"
            "1. 🎯 What This Project Does\n"
            "2. 🚪 Entry Points & Execution Starting Points\n"
            "3. 🔄 Request & Data Flow (with Mermaid diagram)\n"
            "4. 🧩 Core Modules & Responsibilities\n"
            "5. 📡 Component Communication & Inter-Module Protocols\n"
            "6. 🚀 Where a New Developer Should Start (Day-1 Roadmap)"
        )

        user_prompt = f"""# Codebase: {repo_name}
Target Explanation Level: {level.upper()}

## Key Entry Points:
{', '.join(entry_points) or 'Auto-detected root files'}

## High-Degree Central Modules:
{', '.join(top_hubs) or 'Root components'}

## Available Citations & Symbols:
{chr(10).join(sample_citations[:10])}

## ASCII Directory Tree (truncated):
```text
{chr(10).join(directory_tree.splitlines()[:40])}
```

## README Excerpt:
{readme_content[:1000]}

Generate the complete 6-section {level.capitalize()} Architecture Explanation now."""

        model = getattr(self.settings, "GEMINI_CHAT_MODEL", EXPLANATION_MODEL)
        response = self.client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
                max_output_tokens=2048,
            ),
        )
        return response.text or ""

    def _generate_fallback(
        self,
        repo_name: str,
        level: str,
        directory_tree: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        entry_points: List[str],
        top_hubs: List[str],
        chunks: List[Dict[str, Any]],
    ) -> str:
        """Deterministic, rich fallback generator for offline tests and non-Gemini runs."""
        return build_fallback_explanation(
            repo_name=repo_name,
            level=level,
            directory_tree=directory_tree,
            nodes=nodes,
            edges=edges,
            entry_points=entry_points,
            top_hubs=top_hubs,
            chunks=chunks,
        )


_explanation_service_instance: Optional[ExplanationService] = None


def get_explanation_service() -> ExplanationService:
    global _explanation_service_instance
    if _explanation_service_instance is None:
        _explanation_service_instance = ExplanationService()
    return _explanation_service_instance


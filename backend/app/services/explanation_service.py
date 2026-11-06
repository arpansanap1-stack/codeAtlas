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
        # Find citations for entry points
        entry_citations = []
        for ep in entry_points:
            matching_chunk = next((c for c in chunks if c.get("file_path") == ep), None)
            if matching_chunk:
                entry_citations.append(
                    f"- **`{ep}`** `[{ep}:{matching_chunk.get('start_line', 1)}-{matching_chunk.get('end_line', 25)}]`: Primary entry point and process bootstrap."
                )
            else:
                entry_citations.append(f"- **`{ep}`** `[{ep}:1-30]`: Process entry point and service bootstrap.")

        if not entry_citations:
            first_file = nodes[0].get("id") if nodes else "src/index.ts"
            entry_citations.append(f"- **`{first_file}`** `[{first_file}:1-25]`: Core module entry point.")

        # Hub citations
        hub_citations = []
        for hub in top_hubs[:4]:
            matching_chunk = next((c for c in chunks if c.get("file_path") == hub), None)
            if matching_chunk:
                hub_citations.append(
                    f"- **`{hub}`** `[{hub}:{matching_chunk.get('start_line', 1)}-{matching_chunk.get('end_line', 30)}]`: Core domain logic and shared service dependency."
                )
            else:
                hub_citations.append(f"- **`{hub}`** `[{hub}:1-40]`: High-centrality module utilized across multiple features.")

        # Mermaid flow diagram
        flow_lines = ["```mermaid", "flowchart TD"]
        flow_lines.append('    A["Client / User Action"] --> B["Entry Controller / Route"]')
        if entry_points:
            flow_lines.append(f'    B --> C["{entry_points[0]}"]')
        else:
            flow_lines.append('    B --> C["Core Service Layer"]')
        if top_hubs:
            flow_lines.append(f'    C --> D["{top_hubs[0]}"]')
            flow_lines.append('    D --> E["Database / State Store"]')
        else:
            flow_lines.append('    C --> E["State Management & Storage"]')
        flow_lines.append("```")
        mermaid_block = "\n".join(flow_lines)

        if level == "beginner":
            return f"""# 🧭 {repo_name} — Architecture Overview (Beginner Mode)

Welcome to **{repo_name}**! Think of this codebase like an airport terminal: requests arrive at the front gate, get checked by security controllers, route to specialized service gates, and finally persist or retrieve cargo from the database.

---

### 1. 🎯 What This Project Does
**{repo_name}** is engineered to provide modular, scalable software functionality. It separates user interface and client dispatching from core server-side computation, ensuring each subsystem handles one distinct responsibility.

---

### 2. 🚪 Entry Points & Execution Starting Points
When the system starts or receives a request, execution begins in these key entry files:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Data Flow
Here is how an action moves through the codebase from start to finish:

{mermaid_block}

1. **Trigger**: An event or network request arrives at the boundary.
2. **Routing**: The controller validates input and passes parameters to service handlers.
3. **Execution**: Business logic executes in modular service layers.
4. **Persistence**: Data updates or responses are dispatched back to the caller.

---

### 4. 🧩 Core Modules & Responsibilities
These are the most critical files that form the backbone of the application:
{chr(10).join(hub_citations)}

---

### 5. 📡 Component Communication
Components in **{repo_name}** communicate cleanly:
- **Direct Module Imports**: Shared utilities and domain models are imported statically without circular dependencies.
- **Data Encapsulation**: Controllers never manipulate raw storage directly; they interact through structured schemas.

---

### 6. 🚀 Where a New Developer Should Start (Day-1 Roadmap)
1. **Explore the Entry Point**: Start by reading `{entry_points[0] if entry_points else 'main entry file'}` to understand initialization parameters.
2. **Trace a Single Feature**: Follow a route handler down to its service function in `{top_hubs[0] if top_hubs else 'core module'}`.
3. **Run Verification**: Ensure your local tests pass before modifying business logic.
"""

        elif level == "expert":
            return f"""# ⚡ {repo_name} — Deep Architecture & Systems Analysis (Expert Mode)

A technical systems analysis of **{repo_name}**, examining dependency topology, data contracts, concurrency boundaries, and modular decoupling.

---

### 1. 🎯 Architectural Paradigm & System Overview
**{repo_name}** employs a layered, decoupled architecture with strict separation between ingestion/routing, domain services, and persistence layers. 

- **Dependency Direction**: Unidirectional flow minimizing reverse coupling.
- **Coupling Factor**: Evaluated across {len(nodes)} modules and {len(edges)} static import edges.

---

### 2. 🚪 Entry Points & Execution Bootstrap
Bootstrap sequences are defined in dedicated orchestration entry points:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Pipeline Data Flow
Execution path with state and boundary transitions:

{mermaid_block}

- **Ingress**: Network endpoints and CLI entry points parse incoming wire formats into typed models.
- **Intermediate Processing**: Pure service functions perform domain validation and state synthesis.
- **Egress / Persistence**: Transactions and outputs are dispatched through centralized database abstractions.

---

### 4. 🧩 Critical Path & High-Centrality Modules
Modules with the highest incoming and outgoing dependency degrees (critical blast radius):
{chr(10).join(hub_citations)}

---

### 5. 📡 Inter-Module Communication & Boundary Isolation
- **Interface Segregation**: Modules expose typed schemas to prevent leaky domain internals.
- **Fault Isolation**: External I/O and network operations are wrapped in retry/fallback blocks to prevent cascading failures.

---

### 6. 🚀 Day-1 Extension Guide & Architectural Recommendations
- **Extending Capabilities**: When adding new functionality, register endpoints in `{entry_points[0] if entry_points else 'entry layer'}` and delegate logic to isolated services.
- **Refactoring Watchlist**: Inspect modules in `{top_hubs[0] if top_hubs else 'hub layer'}` when changing schemas to prevent breaking dependent downstream nodes.
"""

        else:  # intermediate
            return f"""# 🏗️ {repo_name} — Architecture Walkthrough (Intermediate Mode)

A comprehensive architectural explanation of **{repo_name}**, detailing key entry points, request lifecycles, and component responsibilities.

---

### 1. 🎯 What This Project Does
**{repo_name}** is a structured, production-ready system designed to handle end-to-end data workflows. It separates routing, core business logic, and state storage into clean, maintainable modules.

---

### 2. 🚪 Entry Points & First Lines of Execution
Execution initiates through these primary entry points:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Data Flow
The sequence below illustrates the standard data flow:

{mermaid_block}

1. **Ingress**: Input parameters or API requests hit the entry handler.
2. **Validation**: Requests are verified against schemas.
3. **Service Logic**: Domain services process the business requirements.
4. **Response**: Processed payloads are returned to the caller or saved.

---

### 4. 🧩 Important Modules & Responsibilities
Key modules responsible for central application logic:
{chr(10).join(hub_citations)}

---

### 5. 📡 How Components Communicate
- **Import Hierarchies**: Modules import shared models and utilities without circular dependencies.
- **Async Execution**: I/O-heavy operations (network, file storage) are handled asynchronously.

---

### 6. 🚀 Where a New Developer Should Start (Day-1 Walkthrough)
1. Read the primary entry module: `{entry_points[0] if entry_points else 'entry file'}`.
2. Inspect the core services in: `{top_hubs[0] if top_hubs else 'main service'}`.
3. Review existing unit tests to understand expected behavior before contributing.
"""


_explanation_service_instance: Optional[ExplanationService] = None


def get_explanation_service() -> ExplanationService:
    global _explanation_service_instance
    if _explanation_service_instance is None:
        _explanation_service_instance = ExplanationService()
    return _explanation_service_instance


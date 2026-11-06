from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db

logger = logging.getLogger("codeatlas.onboarding")

ROOT_CONFIG_FILES = [
    "README.md",
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "Dockerfile",
    "docker-compose.yml",
    ".env.example",
    "tsconfig.json",
    "go.mod",
    "Cargo.toml",
]

ONBOARDING_MODEL = "gemini-flash-lite-latest"


class OnboardingService:
    def __init__(self):
        self.settings = get_settings()
        self.client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self):
        api_key = self.settings.GEMINI_API_KEY
        if api_key and not api_key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=api_key)
                logger.info("Google GenAI client initialized for OnboardingService.")
            except Exception as e:
                logger.warning(f"Failed to initialize GenAI client: {e}")
                self.client = None
        else:
            self.client = None
            logger.info("GEMINI_API_KEY not configured. Using deterministic high-signal synthesizer.")

    def set_api_key(self, api_key: str) -> None:
        """Dynamically reconfigures the Gemini client with a new API key."""
        self.settings.GEMINI_API_KEY = api_key
        if api_key and not api_key.startswith("your-gemini"):
            self.client = genai.Client(api_key=api_key)
            logger.info("Google GenAI client reconfigured for OnboardingService.")
        else:
            self.client = None
            logger.info("Google GenAI client cleared for OnboardingService.")

    def is_configured(self) -> bool:
        return self.client is not None

    def gather_high_signal_context(self, repo_id: str) -> Dict[str, Any]:
        """
        Gathers:
        1. Full ASCII directory tree
        2. Manifest/Configuration files content
        3. Top 6 core architectural files by graph centrality (in_degree + out_degree) and their chunks
        """
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        repo_name = repo.get("repo_name", "Codebase")
        directory_tree = repo.get("directory_tree", "")
        graph_data = repo.get("graph_data", {}) or {}

        # 1. Gather Root Manifest / Configuration files (limit to 30 lines each to optimize tokens)
        manifests: Dict[str, str] = {}
        for config_filename in ROOT_CONFIG_FILES:
            content = db.get_file_content(repo_id, config_filename)
            if content:
                lines = content.splitlines()
                truncated = "\n".join(lines[:30])
                if len(lines) > 30:
                    truncated += f"\n... [truncated {len(lines) - 30} lines for token optimization]"
                manifests[config_filename] = truncated

        # 2. Extract Top 4 core files by degree centrality
        nodes: List[Dict[str, Any]] = graph_data.get("nodes", [])
        sorted_nodes = sorted(
            nodes,
            key=lambda n: n.get("in_degree", 0) + n.get("out_degree", 0),
            reverse=True,
        )
        top_4_nodes = sorted_nodes[:4]
        top_files_summary: List[Dict[str, Any]] = []

        for node in top_4_nodes:
            file_path = node.get("id")
            if not file_path:
                continue
            chunks = db.get_code_chunks_for_file(repo_id, file_path)
            symbols = [c.get("symbol_name") for c in chunks if c.get("symbol_name")]
            chunk_snippets = [
                f"- Symbol: `{c.get('symbol_name')}` [{c.get('file_path')}:{c.get('start_line')}-{c.get('end_line')}] ({c.get('chunk_type')})"
                for c in chunks[:3]
            ]
            top_files_summary.append(
                {
                    "file_path": file_path,
                    "in_degree": node.get("in_degree", 0),
                    "out_degree": node.get("out_degree", 0),
                    "symbols": symbols,
                    "snippets": chunk_snippets,
                }
            )

        # 3. Extract architectural edges
        edges = graph_data.get("edges", [])

        return {
            "repo_id": repo_id,
            "repo_name": repo_name,
            "directory_tree": directory_tree,
            "manifests": manifests,
            "top_files": top_files_summary,
            "edges": edges,
        }

    def generate_fallback_onboarding_markdown(self, context: Dict[str, Any]) -> str:
        """
        Synthesizes a production-grade, structured ONBOARDING.md with valid Mermaid.js diagrams
        and exact line citations for offline or test environments.
        """
        repo_name = context["repo_name"]
        directory_tree = context["directory_tree"]
        manifests = context["manifests"]
        top_files = context["top_files"]
        edges = context["edges"]

        # Detect tech stack hints from manifests
        tech_stack = []
        if "package.json" in manifests:
            tech_stack.append("JavaScript/TypeScript (Node.js ecosystem)")
        if "requirements.txt" in manifests or "pyproject.toml" in manifests:
            tech_stack.append("Python")
        if "Dockerfile" in manifests:
            tech_stack.append("Docker")
        if not tech_stack:
            tech_stack.append("Polyglot source codebase")

        # Build clean Mermaid diagram
        mermaid_lines = ["```mermaid", "graph TD"]
        edge_count = 0
        for edge in edges[:15]:
            src = edge.get("source", "").replace("/", "_").replace(".", "_").replace("-", "_")
            tgt = edge.get("target", "").replace("/", "_").replace(".", "_").replace("-", "_")
            src_label = edge.get("source", "")
            tgt_label = edge.get("target", "")
            if src and tgt:
                mermaid_lines.append(f'    {src}["{src_label}"] --> {tgt}["{tgt_label}"]')
                edge_count += 1

        if edge_count == 0:
            mermaid_lines.append('    Client["Client / Entrypoint"] --> Core["Core Application Logic"]')
            mermaid_lines.append('    Core --> Data["Data / State Management"]')

        mermaid_lines.append("```")
        mermaid_diagram = "\n".join(mermaid_lines)

        # Build Core Modules section
        modules_lines = []
        for file_info in top_files:
            fp = file_info["file_path"]
            in_deg = file_info["in_degree"]
            out_deg = file_info["out_degree"]
            modules_lines.append(f"### `{fp}` (Centrality: In={in_deg}, Out={out_deg})")
            if file_info["snippets"]:
                modules_lines.extend(file_info["snippets"])
            else:
                modules_lines.append(f"- Module entry point located at `[{fp}:1-30]`")
            modules_lines.append("")

        core_modules_text = "\n".join(modules_lines) if modules_lines else "- No complex internal modules detected."

        md = f"""# Developer Onboarding Guide: {repo_name}

Welcome to **{repo_name}**! This document provides an architectural walkthrough, system data flow diagram, module index, and Day-1 guide for onboarding engineers.

---

## 1. Executive Architecture Overview & Tech Stack

**Primary Technology Stack:**
{chr(10).join(f"- {t}" for t in tech_stack)}

{repo_name} is organized as a modular codebase designed for high maintainability, clear separation of concerns, and reproducible execution.

---

## 2. System Data Flow Diagram

The diagram below illustrates the architectural relationships and module dependencies discovered via Abstract Syntax Tree (AST) static analysis:

{mermaid_diagram}

---

## 3. Core Modules & Entry Points

Key architectural files ranked by dependency centrality across the codebase:

{core_modules_text}

---

## 4. Directory Structure Walkthrough

```text
{directory_tree}
```

---

## 5. Day-1 Local Setup & Run Guide

### Prerequisites
- Install appropriate runtime (Node.js 20+ or Python 3.11+)
- Clone the repository and configure environment variables

### Setup Steps
```bash
# 1. Navigate to project root
cd {repo_name}

# 2. Install dependencies
# For Node.js projects:
npm install
# For Python projects:
pip install -r requirements.txt

# 3. Copy environment configuration
cp .env.example .env

# 4. Start development server
npm run dev   # or: uvicorn app.main:app --reload
```

---

## 6. "Where to Make Changes" Playbook

- **Adding New Features / Business Logic:**
  Implement new modules alongside existing domains and expose functions with typed signatures.
- **Updating Data Models / Schemas:**
  Locate core model declarations and ensure new fields maintain backward compatibility.
- **Routing & Endpoints:**
  Register new route handlers in the primary application entrypoint.
- **Writing Tests:**
  Add unit tests mirroring the directory hierarchy under the test suite.
"""
        return md.strip()

    def generate_onboarding_documentation(self, repo_id: str) -> Dict[str, Any]:
        """
        Executes high-signal context gathering, prompts Gemini for structured synthesis,
        and caches the result in the onboarding_docs table.
        """
        db = get_db()
        context = self.gather_high_signal_context(repo_id)
        repo_name = context["repo_name"]

        # If Gemini client is active, prompt the LLM
        if self.client:
            try:
                system_instruction = (
                    "You are a Staff Technical Writer and Principal Software Architect.\n"
                    "Your mission is to generate a comprehensive, beautifully styled, and developer-ready "
                    "ONBOARDING.md for developers joining the repository.\n\n"
                    "STRICT FORMATTING REQUIREMENTS:\n"
                    "1. Always include all 6 mandatory sections:\n"
                    "   - 1. Executive Architecture Overview & Tech Stack\n"
                    "   - 2. System Data Flow Diagram (valid mermaid graph TD syntax with quotes around labels)\n"
                    "   - 3. Core Modules & Entry Points (with clickable [file_path:start_line-end_line] citations)\n"
                    "   - 4. Directory Structure Walkthrough\n"
                    "   - 5. Day-1 Local Setup & Run Guide\n"
                    "   - 6. 'Where to Make Changes' Playbook\n"
                    "2. Mermaid diagrams MUST be syntactically valid (use `graph TD`). Avoid special characters inside node IDs.\n"
                    "3. Every module reference MUST cite its exact lines in `[file_path:start_line-end_line]` format.\n"
                )

                prompt = f"""# Repository Context for Onboarding Documentation: {repo_name}

## 1. Directory Tree:
```text
{context['directory_tree']}
```

## 2. Manifest & Config Files:
{json.dumps(context['manifests'], indent=2)}

## 3. Top Core Files by Dependency Centrality:
{json.dumps(context['top_files'], indent=2)}

## 4. Architecture Dependency Edges:
{json.dumps(context['edges'][:25], indent=2)}

Please synthesize the complete ONBOARDING.md now following the 6 mandatory sections.
"""

                model = getattr(self.settings, "GEMINI_CHAT_MODEL", ONBOARDING_MODEL)
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                        max_output_tokens=2500,
                    ),
                )

                if response.text and len(response.text.strip()) > 100:
                    markdown_content = response.text.strip()
                    record = db.save_onboarding_doc(repo_id, markdown_content)
                    return record

            except Exception as e:
                logger.error(f"GenAI onboarding documentation generation failed: {e}. Using fallback synthesizer.")

        # Fallback synthesizer
        markdown_content = self.generate_fallback_onboarding_markdown(context)
        record = db.save_onboarding_doc(repo_id, markdown_content)
        return record


_onboarding_service_instance: Optional[OnboardingService] = None


def get_onboarding_service() -> OnboardingService:
    global _onboarding_service_instance
    if _onboarding_service_instance is None:
        _onboarding_service_instance = OnboardingService()
    return _onboarding_service_instance


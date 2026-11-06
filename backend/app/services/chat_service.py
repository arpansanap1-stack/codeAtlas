import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.services.embedding_service import get_embedding_service

logger = logging.getLogger("codeatlas.chat")

CHAT_MODEL = "gemini-flash-lite-latest"


def expand_graph_context(graph_data: Dict[str, Any], top_file_paths: List[str]) -> str:
    """
    Expands context by inspecting graph_data to discover direct dependencies
    of the top retrieved files.
    """
    if not graph_data or not top_file_paths:
        return "No graph dependency context available."

    edges = graph_data.get("edges", [])
    top_3_files = list(dict.fromkeys(top_file_paths))[:3]

    lines = ["### Architectural Dependencies of Relevant Files:"]
    found_any = False

    for file_path in top_3_files:
        imports = [e["target"] for e in edges if e.get("source") == file_path]
        imported_by = [e["source"] for e in edges if e.get("target") == file_path]

        dep_info = []
        if imports:
            dep_info.append(f"Imports -> {', '.join(imports)}")
        if imported_by:
            dep_info.append(f"Imported by -> {', '.join(imported_by)}")

        if dep_info:
            found_any = True
            lines.append(f"- **{file_path}**: {' | '.join(dep_info)}")

    if not found_any:
        return "No direct internal module dependencies found for top files."

    return "\n".join(lines)


class ChatService:
    def __init__(self):
        self.settings = get_settings()
        self.embedding_service = get_embedding_service()
        self.client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self):
        api_key = self.settings.GEMINI_API_KEY
        if api_key and not api_key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=api_key)
                logger.info("Google GenAI client initialized for ChatService.")
            except Exception as e:
                logger.warning(f"Failed to initialize GenAI client: {e}")
                self.client = None
        else:
            self.client = None
            logger.info("GEMINI_API_KEY not configured. Using fallback local response generator.")

    def set_api_key(self, api_key: str) -> None:
        """Dynamically reconfigures the Gemini client with a new API key."""
        self.settings.GEMINI_API_KEY = api_key
        if api_key and not api_key.startswith("your-gemini"):
            self.client = genai.Client(api_key=api_key)
            logger.info("Google GenAI client reconfigured for ChatService.")
        else:
            self.client = None
            logger.info("Google GenAI client cleared for ChatService.")

    def is_configured(self) -> bool:
        return self.client is not None

    def prepare_chat_context(
        self,
        repo_id: str,
        user_query: str,
        selected_files: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Prepares prompt, directory tree, dependency graph context, and targeted
        selected-files or hybrid-search chunks for chat synthesis.
        """
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        repo_name = repo.get("repo_name", "Codebase")
        directory_tree = repo.get("directory_tree", "")
        graph_data = repo.get("graph_data", {})

        # Targeted Multi-File Context if user selected files
        targeted_files_context = ""
        targeted_citations: List[str] = []
        if selected_files and len(selected_files) > 0:
            targeted_sections = []
            for sel_path in selected_files[:5]:
                clean_path = sel_path.replace("\\", "/").lstrip("/")
                f_content = db.get_file_content(repo_id, clean_path)
                if f_content:
                    lines = f_content.splitlines()
                    line_count = len(lines)
                    preview = "\n".join(lines[:80])
                    if line_count > 80:
                        preview += f"\n... [{line_count - 80} more lines omitted]"
                    targeted_sections.append(
                        f"### File: {clean_path} (Lines 1-{min(80, line_count)})\n```\n{preview}\n```"
                    )
                    targeted_citations.append(f"[{clean_path}:1-{min(40, line_count)}]")
            if targeted_sections:
                targeted_files_context = (
                    "## 🎯 Explicitly Selected Code Context (Focus on These):\n"
                    + "\n\n".join(targeted_sections)
                )

        # Target chunks directly if selected_files provided, else execute hybrid search
        if selected_files and len(selected_files) > 0:
            retrieved_chunks = []
            for sel_path in selected_files[:5]:
                clean_path = sel_path.replace("\\", "/").lstrip("/")
                file_chunks = db.get_code_chunks_for_file(repo_id, clean_path)
                retrieved_chunks.extend(file_chunks[:3])
        else:
            query_vector = self.embedding_service.embed_query(user_query)
            retrieved_chunks = db.match_code_chunks_hybrid(
                query_embedding=query_vector,
                query_text=user_query,
                target_repo_id=repo_id,
                match_count=5,
            )

        top_files = [c["file_path"] for c in retrieved_chunks if "file_path" in c]
        if selected_files:
            top_files = list(dict.fromkeys(selected_files + top_files))
        graph_context = expand_graph_context(graph_data, top_files)

        citations = [
            f"[{c['file_path']}:{c['start_line']}-{c['end_line']}]"
            for c in retrieved_chunks
            if "file_path" in c and "start_line" in c and "end_line" in c
        ]
        citations.extend(targeted_citations)

        chunks_context_lines = []
        for c in retrieved_chunks:
            chunk_text = c.get("content", "").strip()
            if len(chunk_text) > 1200:
                chunk_text = chunk_text[:1200] + "\n... [truncated]"
            chunks_context_lines.append(chunk_text)
        chunks_context = "\n\n---\n\n".join(chunks_context_lines)

        compact_tree_lines = directory_tree.splitlines()[:50]
        compact_tree = "\n".join(compact_tree_lines)
        if len(directory_tree.splitlines()) > 50:
            compact_tree += "\n... [additional files omitted for brevity]"

        system_instruction = (
            "You are CodeAtlas, a Senior Staff Full-Stack AI Engineer and expert codebase explainer.\n"
            "Your objective is to answer questions about the repository concisely and with complete accuracy.\n\n"
            "STRICT CITATION RULES (CRITICAL):\n"
            "1. You MUST cite code references using clickable citation brackets in the exact format: `[file_path:start_line-end_line]`.\n"
            "   Example: 'The authentication service initializes in `[app/services/auth.py:14-28]`.'\n"
            "2. Never mention a function, class, or architecture element without citing its exact file path and line numbers.\n"
            "3. If the user provided selected code files, focus your answer on those specific files, explaining how they work together, comparing them, or analyzing their interactions.\n"
            "4. Keep responses focused, concise, and structured with clean Markdown."
        )

        user_prompt = f"""# Codebase: {repo_name}

## Directory Tree:
```text
{compact_tree}
```

## Architecture Dependency Context:
{graph_context}

{targeted_files_context}

## Retrieved Relevant Code Chunks:
{chunks_context}

## Developer Question:
{user_query}
"""

        summary_lines = [
            f"Based on the analysis of **{repo_name}**, here is the explanation for your query:\n\n",
        ]

        if selected_files:
            summary_lines.append(
                f"### 🎯 Targeted Analysis of Selected Code ({len(selected_files)} modules):\n"
            )
            for idx, sel_f in enumerate(selected_files):
                summary_lines.append(
                    f"- **Module {idx + 1}**: `[{sel_f}:1-20]` represents a core component within the requested flow.\n"
                )
            summary_lines.append(f"\n{graph_context}\n\n")
            summary_lines.append(
                f"These modules communicate across the architectural boundaries defined above. Check the exact interfaces at `[{selected_files[0]}:1-30]`."
            )
        elif retrieved_chunks:
            summary_lines.append("### Relevant Code References:\n")
            for c in retrieved_chunks[:3]:
                summary_lines.append(
                    f"- **{c.get('symbol_name', 'Declaration')}** is defined in `[{c.get('file_path')}:{c.get('start_line')}-{c.get('end_line')}]` ({c.get('chunk_type')}).\n"
                )

            summary_lines.append(f"\n{graph_context}\n\n")
            summary_lines.append(
                f"For further details on this module, check the declaration located at `[{retrieved_chunks[0].get('file_path')}:{retrieved_chunks[0].get('start_line')}-{retrieved_chunks[0].get('end_line')}]`."
            )
        else:
            summary_lines.append(
                "No specific code declarations matched this query in the repository."
            )

        fallback_text = "".join(summary_lines)

        return {
            "repo_name": repo_name,
            "user_prompt": user_prompt,
            "system_instruction": system_instruction,
            "citations": list(set(citations)),
            "fallback_text": fallback_text,
        }

    async def stream_chat_response(
        self,
        repo_id: str,
        user_query: str,
        selected_files: Optional[List[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Executes hybrid search or targeted multi-file context injection,
        expands graph context, constructs strict citation prompt,
        and yields Server-Sent Events (SSE) streaming data chunks.
        """
        try:
            ctx = self.prepare_chat_context(repo_id, user_query, selected_files)
        except Exception as e:
            err_event = json.dumps({"error": str(e)})
            yield f"data: {err_event}\n\n"
            yield "data: [DONE]\n\n"
            return

        user_prompt = ctx["user_prompt"]
        system_instruction = ctx["system_instruction"]
        citations = ctx["citations"]
        fallback_text = ctx["fallback_text"]

        # Stream response (via Gemini or fallback generator)
        if self.client:
            try:
                model = getattr(self.settings, "GEMINI_CHAT_MODEL", CHAT_MODEL)
                response_stream = self.client.models.generate_content_stream(
                    model=model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                        max_output_tokens=1024,
                    ),
                )

                for chunk in response_stream:
                    if chunk.text:
                        data = json.dumps({"content": chunk.text})
                        yield f"data: {data}\n\n"
                        await asyncio.sleep(0.01)

                done_data = json.dumps({"done": True, "citations": citations})
                yield f"data: {done_data}\n\n"
                yield "data: [DONE]\n\n"
                return

            except Exception as e:
                logger.error(f"GenAI generate_content_stream error: {e}. Falling back to local synthesizer.")

        # Stream words with small delays to simulate realistic SSE streaming
        words = fallback_text.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            data = json.dumps({"content": token})
            yield f"data: {data}\n\n"
            await asyncio.sleep(0)

        done_data = json.dumps({"done": True, "citations": citations})
        yield f"data: {done_data}\n\n"
        yield "data: [DONE]\n\n"


_chat_service_instance: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    global _chat_service_instance
    if _chat_service_instance is None:
        _chat_service_instance = ChatService()
    return _chat_service_instance


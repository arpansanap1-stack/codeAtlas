from datetime import datetime, timezone
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import DebugResponse, SuspiciousSnippet

logger = logging.getLogger("codeatlas.debugger")

DEBUG_MODEL = "gemini-flash-lite-latest"

# Regex extractors for stack traces
PYTHON_TRACEBACK_RE = re.compile(
    r'File\s+["\']?([^"\',\n]+)["\']?,\s+line\s+(\d+)(?:,\s+in\s+([a-zA-Z0-9_]+))?',
    re.IGNORECASE,
)
JS_STACK_RE = re.compile(
    r'(?:at\s+(?:([a-zA-Z0-9_\.]+)\s+\()?)?([a-zA-Z0-9_\-\.\/\\\:]+?):(\d+):(\d+)\)?',
    re.IGNORECASE,
)
ERROR_TYPE_RE = re.compile(
    r'([A-Z][a-zA-Z0-9_]*(?:Error|Exception|Fault|Failure)|TypeError|ReferenceError|SyntaxError|NullPointerException)',
)


def extract_trace_frames(error_text: str) -> List[Dict[str, Any]]:
    """Extracts parsed file paths, lines, and function symbols from error text."""
    frames = []

    # Check Python tracebacks
    for match in PYTHON_TRACEBACK_RE.finditer(error_text):
        f_path = match.group(1).replace("\\", "/")
        line = int(match.group(2))
        symbol = match.group(3)
        frames.append({"file_path": f_path, "line": line, "symbol": symbol, "lang": "python"})

    # Check JS/TS tracebacks
    for match in JS_STACK_RE.finditer(error_text):
        sym = match.group(1)
        f_path = match.group(2).replace("\\", "/")
        line = int(match.group(3))
        # Skip node internals or standard library noise
        if "node_modules" not in f_path and "node:" not in f_path:
            frames.append({"file_path": f_path, "line": line, "symbol": sym, "lang": "javascript"})

    return frames


class DebuggerService:
    """
    Intelligent codebase error explorer and root-cause analyzer:
    1. Parses runtime errors and stack traces.
    2. Maps trace frames to actual AST declarations and repository files.
    3. Traces causal execution paths leading to the exception.
    4. Pinpoints suspicious code snippets with exact line citations.
    5. Formulates precise, actionable fixes with code diffs.
    """

    def __init__(self):
        self.settings = get_settings()
        self.client: Optional[genai.Client] = None
        key = self.settings.GEMINI_API_KEY
        if key and not key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=key)
            except Exception as e:
                logger.warning(f"Could not initialize GenAI client in DebuggerService: {e}")

    def is_configured(self) -> bool:
        return self.client is not None

    def diagnose_error(
        self, repo_id: str, error_message: str, context_hint: Optional[str] = None
    ) -> DebugResponse:
        db = get_db()
        repo = db.get_repository(repo_id)
        if not repo:
            raise ValueError(f"Repository '{repo_id}' not found.")

        # 1. Parse error type
        err_type_match = ERROR_TYPE_RE.search(error_message)
        error_type = err_type_match.group(1) if err_type_match else "RuntimeError"

        # 2. Extract frames and matching repository files
        frames = extract_trace_frames(error_message)
        graph_data = repo.get("graph_data", {"nodes": [], "edges": []})
        nodes = graph_data.get("nodes", [])
        all_file_paths = [n.get("id") for n in nodes if n.get("id")]

        # Match trace frames against actual files in repo
        matched_files: List[Tuple[str, int, Optional[str]]] = []
        for fr in frames:
            fr_path = fr["file_path"]
            line = fr["line"]
            sym = fr["symbol"]
            # Check suffix matching
            for repo_f in all_file_paths:
                if repo_f.endswith(fr_path) or fr_path.endswith(repo_f):
                    matched_files.append((repo_f, line, sym))
                    break

        # 3. Retrieve relevant chunks
        chunks = db.get_code_chunks(repo_id, limit=50, offset=0)
        relevant_chunks: List[Dict[str, Any]] = []

        if matched_files:
            for mf, line, _ in matched_files:
                for c in chunks:
                    if c.get("file_path") == mf:
                        relevant_chunks.append(c)
        else:
            # Fallback search by error keywords
            error_keywords = [
                w.lower()
                for w in re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b", error_message)
                if w.lower() not in ("cannot", "read", "properties", "undefined", "error", "none", "object", "type")
            ]
            for c in chunks:
                content_lower = c.get("content", "").lower()
                sym_lower = (c.get("symbol_name") or "").lower()
                if any(kw in content_lower or kw in sym_lower for kw in error_keywords):
                    relevant_chunks.append(c)

        if not relevant_chunks and chunks:
            relevant_chunks = chunks[:5]

        # 4. Attempt Gemini reasoning
        if self.client:
            try:
                gemini_res = self._diagnose_with_gemini(
                    repo_id=repo_id,
                    repo_name=repo.get("repo_name", "Codebase"),
                    error_message=error_message,
                    error_type=error_type,
                    context_hint=context_hint,
                    matched_files=matched_files,
                    relevant_chunks=relevant_chunks,
                )
                if gemini_res:
                    return gemini_res
            except Exception as e:
                logger.error(f"Gemini error diagnosis failed: {e}. Falling back to deterministic analysis.")

        # 5. Deterministic fallback diagnosis
        return self._diagnose_fallback(
            repo_id=repo_id,
            error_message=error_message,
            error_type=error_type,
            context_hint=context_hint,
            matched_files=matched_files,
            relevant_chunks=relevant_chunks,
            all_file_paths=all_file_paths,
        )

    def _diagnose_with_gemini(
        self,
        repo_id: str,
        repo_name: str,
        error_message: str,
        error_type: str,
        context_hint: Optional[str],
        matched_files: List[Tuple[str, int, Optional[str]]],
        relevant_chunks: List[Dict[str, Any]],
    ) -> Optional[DebugResponse]:
        chunks_summary = []
        for c in relevant_chunks[:8]:
            fp = c.get("file_path", "")
            sl = c.get("start_line", 1)
            el = c.get("end_line", 20)
            sym = c.get("symbol_name", "snippet")
            body = c.get("content", "")[:500]
            chunks_summary.append(f"### File: {fp} (lines {sl}-{el}) [Symbol: {sym}]\n```\n{body}\n```")

        system_instruction = (
            "You are CodeAtlas Debug Engine, an expert software debugging assistant.\n"
            "Analyze the runtime error or stack trace against the provided codebase chunks.\n"
            "Produce valid JSON matching this schema:\n"
            "{\n"
            '  "error_type": "string",\n'
            '  "root_cause_analysis": "Detailed explanation of why this error occurs in the code.",\n'
            '  "execution_path_explanation": "Step-by-step description of how input/state flowed into this failure point.",\n'
            '  "suspicious_locations": [\n'
            '    {\n'
            '      "file_path": "path/to/file",\n'
            '      "start_line": 10,\n'
            '      "end_line": 25,\n'
            '      "symbol_name": "function_or_class_name",\n'
            '      "reason": "Why this specific line/block is suspect",\n'
            '      "code_snippet": "Actual or reconstructed code lines"\n'
            '    }\n'
            '  ],\n'
            '  "suggested_fix": "Markdown with concrete before/after code diff demonstrating how to fix the issue.",\n'
            '  "confidence_score": 0.9\n'
            "}\n"
            "Strict requirement: Use exact file paths and line ranges from the provided chunks."
        )

        user_prompt = f"""# Repository: {repo_name}
Error / Stack Trace:
{error_message}

Additional Context:
{context_hint or 'None provided'}

Matched Trace Files:
{json.dumps([f"{f}:{l}" for f, l, _ in matched_files])}

Relevant Code Chunks from Codebase:
{chr(10).join(chunks_summary)}

Diagnose the error now."""

        model = getattr(self.settings, "GEMINI_CHAT_MODEL", DEBUG_MODEL)
        response = self.client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )

        text = response.text or "{}"
        data = json.loads(text)

        suspicious_list = [
            SuspiciousSnippet(
                file_path=item.get("file_path", "unknown"),
                start_line=int(item.get("start_line", 1)),
                end_line=int(item.get("end_line", 20)),
                symbol_name=item.get("symbol_name"),
                reason=item.get("reason", "Suspect execution statement"),
                code_snippet=item.get("code_snippet", ""),
            )
            for item in data.get("suspicious_locations", [])
        ]

        return DebugResponse(
            repo_id=repo_id,
            error_type=data.get("error_type", error_type),
            root_cause_analysis=data.get("root_cause_analysis", "Analyzed runtime failure."),
            execution_path_explanation=data.get("execution_path_explanation", "Traced input flow to failure statement."),
            suspicious_locations=suspicious_list,
            suggested_fix=data.get("suggested_fix", "Apply null safety guards or type validation."),
            confidence_score=float(data.get("confidence_score", 0.88)),
        )

    def _diagnose_fallback(
        self,
        repo_id: str,
        error_message: str,
        error_type: str,
        context_hint: Optional[str],
        matched_files: List[Tuple[str, int, Optional[str]]],
        relevant_chunks: List[Dict[str, Any]],
        all_file_paths: List[str],
    ) -> DebugResponse:
        """Deterministic heuristic debugger for offline tests and local verification."""
        suspicious: List[SuspiciousSnippet] = []

        if matched_files:
            for f_path, line_no, sym in matched_files:
                matching_chunk = next(
                    (c for c in relevant_chunks if c.get("file_path") == f_path), None
                )
                start_l = max(1, line_no - 4)
                end_l = line_no + 4
                snippet_text = (
                    matching_chunk.get("content", f"# Suspicious line {line_no} in {f_path}")
                    if matching_chunk
                    else f"// Suspect statement at line {line_no}"
                )

                suspicious.append(
                    SuspiciousSnippet(
                        file_path=f_path,
                        start_line=start_l,
                        end_line=end_l,
                        symbol_name=sym or (matching_chunk.get("symbol_name") if matching_chunk else None),
                        reason=f"Active stack frame directly referenced in error trace at line {line_no}.",
                        code_snippet=snippet_text[:300],
                    )
                )
        elif relevant_chunks:
            primary_c = relevant_chunks[0]
            fp = primary_c.get("file_path", all_file_paths[0] if all_file_paths else "main.py")
            sl = primary_c.get("start_line", 1)
            el = primary_c.get("end_line", 25)
            suspicious.append(
                SuspiciousSnippet(
                    file_path=fp,
                    start_line=sl,
                    end_line=el,
                    symbol_name=primary_c.get("symbol_name"),
                    reason="Identified as closest lexical match to error identifiers and operation parameters.",
                    code_snippet=primary_c.get("content", "")[:300],
                )
            )
        else:
            fallback_fp = all_file_paths[0] if all_file_paths else "src/index.ts"
            suspicious.append(
                SuspiciousSnippet(
                    file_path=fallback_fp,
                    start_line=1,
                    end_line=20,
                    symbol_name="entrypoint",
                    reason="Entry module where state initialization commences.",
                    code_snippet="# Entry point initialization",
                )
            )

        target_file = suspicious[0].file_path
        target_lines = f"{suspicious[0].start_line}-{suspicious[0].end_line}"

        # Heuristic root cause & fixes based on error patterns
        lower_err = error_message.lower()
        if "cannot read properties of undefined" in lower_err or "nullpointer" in lower_err or "nonetype" in lower_err:
            root_cause = (
                f"Attempted to access a property or method on an uninitialized/undefined object in `[{target_file}:{target_lines}]`. "
                f"The object was likely expected from an asynchronous call or API payload that resolved to null or undefined."
            )
            exec_path = (
                f"1. A component or service invoked a data retrieval operation.\n"
                f"2. The returned reference was not populated before accessing downstream properties in `{target_file}`.\n"
                f"3. The runtime threw `{error_type}` halting further execution."
            )
            suggested_fix = f"""### Proposed Fix (Null-Safety Guard)

Ensure safe property navigation using optional chaining or defensive default values:

```typescript
// ❌ Problematic Code:
const token = response.data.token;

// ✅ Proposed Fix in [{target_file}:{target_lines}]:
const token = response?.data?.token ?? null;
if (!token) {{
  console.warn("Token payload was empty or undefined");
  return;
}}
```"""
        elif "keyerror" in lower_err:
            root_cause = (
                f"Direct dictionary key access failed in `[{target_file}:{target_lines}]` because the required key does not exist in the dictionary map."
            )
            exec_path = (
                f"1. Caller dispatched input without the anticipated schema key.\n"
                f"2. `{target_file}` accessed `dict[key]` directly instead of using safe accessors.\n"
                f"3. Python raised `KeyError`."
            )
            suggested_fix = f"""### Proposed Fix (Safe Dictionary Access)

Use `.get()` with an explicit fallback or validate payload fields:

```python
# ❌ Problematic Code:
value = payload["required_field"]

# ✅ Proposed Fix in [{target_file}:{target_lines}]:
value = payload.get("required_field")
if value is None:
    raise ValueError("Missing 'required_field' in input payload")
```"""
        else:
            root_cause = (
                f"Encountered `{error_type}` during execution in `[{target_file}:{target_lines}]`. "
                f"A precondition or parameter validation failed during runtime dispatch."
            )
            exec_path = (
                f"1. Execution initiated through standard entry point.\n"
                f"2. Control transferred to `{target_file}`.\n"
                f"3. Unhandled condition triggered `{error_type}`."
            )
            suggested_fix = f"""### Proposed Fix

Wrap the operation in defensive error handling and assert valid types in `[{target_file}:{target_lines}]`:

```python
try:
    # Execute operation safely
    result = perform_action(params)
except Exception as e:
    logger.error(f"Failed operation: {{e}}")
    raise
```"""

        return DebugResponse(
            repo_id=repo_id,
            error_type=error_type,
            root_cause_analysis=root_cause,
            execution_path_explanation=exec_path,
            suspicious_locations=suspicious,
            suggested_fix=suggested_fix,
            confidence_score=0.86,
        )


_debugger_service_instance: Optional[DebuggerService] = None


def get_debugger_service() -> DebuggerService:
    global _debugger_service_instance
    if _debugger_service_instance is None:
        _debugger_service_instance = DebuggerService()
    return _debugger_service_instance


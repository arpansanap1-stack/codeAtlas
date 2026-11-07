from typing import Any, Dict, List, Optional, Tuple
from app.models.schemas import DebugResponse, SuspiciousSnippet


def diagnose_fallback_heuristics(
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

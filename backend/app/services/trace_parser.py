import re
from typing import Any, Dict, List

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

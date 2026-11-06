import ast
import logging
from pathlib import Path
import re
from typing import Dict, List, Optional, Tuple

from app.models.schemas import CodeChunk

logger = logging.getLogger("codeatlas.ast")

AST_SUPPORTED_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
}

WINDOW_SIZE_LINES = 80
WINDOW_OVERLAP_LINES = 15

# JS/TS Top-Level Declaration Patterns
JS_TS_PATTERNS = [
    # export async function name(...) / function name(...)
    (re.compile(r"^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)"), "function_definition"),
    # export class Name / class Name
    (re.compile(r"^(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_$]+)"), "class_definition"),
    # export interface Name / interface Name
    (re.compile(r"^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)"), "interface_declaration"),
    # export type Name = / type Name =
    (re.compile(r"^(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*="), "type_alias_declaration"),
    # export const name = (...) => / const name: Type = (...) =>
    (
        re.compile(
            r"^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)(?:\s*:\s*[^{=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)(?:\s*:\s*[^{=>]+)?\s*=>"
        ),
        "arrow_function",
    ),
    # export const name = function(...)
    (re.compile(r"^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)(?:\s*:\s*[^{=]+)?\s*=\s*(?:async\s*)?function"), "function_definition"),
]


class ASTService:
    def __init__(self):
        pass

    def _format_chunk(
        self,
        file_path: str,
        symbol_name: str,
        chunk_type: str,
        start_line: int,
        end_line: int,
        raw_code: str,
    ) -> CodeChunk:
        """Constructs a CodeChunk with the mandatory context header prepended."""
        header = f"# File: {file_path} | Symbol: {symbol_name} | Lines: {start_line}-{end_line}\n"
        content = header + raw_code.rstrip()
        return CodeChunk(
            file_path=file_path,
            symbol_name=symbol_name,
            chunk_type=chunk_type,
            start_line=start_line,
            end_line=end_line,
            content=content,
        )

    def _extract_python_declarations(
        self, content: str, file_path: str, lines: List[str]
    ) -> List[CodeChunk]:
        """Extracts top-level and method declarations from Python AST."""
        chunks: List[CodeChunk] = []
        try:
            tree = ast.parse(content)
        except Exception as e:
            logger.debug(f"Native Python AST parse failed for {file_path}: {e}")
            return chunks

        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                s_line = node.lineno
                e_line = node.end_lineno or s_line
                raw_code = "\n".join(lines[s_line - 1 : e_line])
                chunks.append(
                    self._format_chunk(
                        file_path=file_path,
                        symbol_name=node.name,
                        chunk_type="function_definition",
                        start_line=s_line,
                        end_line=e_line,
                        raw_code=raw_code,
                    )
                )

            elif isinstance(node, ast.ClassDef):
                s_line = node.lineno
                e_line = node.end_lineno or s_line
                raw_code = "\n".join(lines[s_line - 1 : e_line])
                chunks.append(
                    self._format_chunk(
                        file_path=file_path,
                        symbol_name=node.name,
                        chunk_type="class_definition",
                        start_line=s_line,
                        end_line=e_line,
                        raw_code=raw_code,
                    )
                )

                # Extract methods inside class body
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        ms_line = item.lineno
                        me_line = item.end_lineno or ms_line
                        m_code = "\n".join(lines[ms_line - 1 : me_line])
                        chunks.append(
                            self._format_chunk(
                                file_path=file_path,
                                symbol_name=f"{node.name}.{item.name}",
                                chunk_type="method_definition",
                                start_line=ms_line,
                                end_line=me_line,
                                raw_code=m_code,
                            )
                        )

        return chunks

    def _extract_js_ts_declarations(
        self, content: str, file_path: str, lines: List[str]
    ) -> List[CodeChunk]:
        """Extracts declarations from JavaScript and TypeScript/TSX code."""
        chunks: List[CodeChunk] = []
        total = len(lines)
        i = 0

        while i < total:
            line = lines[i].strip()
            matched = False

            for pattern, chunk_type in JS_TS_PATTERNS:
                m = pattern.match(line)
                if m:
                    symbol_name = m.group(1)
                    start_line = i + 1

                    # Track brace depth to find exact end line
                    depth = 0
                    started = False
                    end_line = start_line

                    for j in range(i, min(i + 400, total)):
                        curr = lines[j]
                        for char in curr:
                            if char == "{":
                                depth += 1
                                started = True
                            elif char == "}":
                                depth -= 1
                        if started and depth <= 0:
                            end_line = j + 1
                            break
                    else:
                        end_line = min(i + 50, total)

                    raw_code = "\n".join(lines[start_line - 1 : end_line])
                    chunks.append(
                        self._format_chunk(
                            file_path=file_path,
                            symbol_name=symbol_name,
                            chunk_type=chunk_type,
                            start_line=start_line,
                            end_line=end_line,
                            raw_code=raw_code,
                        )
                    )

                    i = max(i + 1, end_line)
                    matched = True
                    break

            if not matched:
                i += 1

        return chunks

    def fallback_sliding_window_chunker(
        self, file_path: str, lines: List[str]
    ) -> List[CodeChunk]:
        """
        Sliding-window chunker for non-AST files or files without top-level functions.
        Chunks 80 lines with 15 lines overlap so line citations remain exact.
        """
        chunks: List[CodeChunk] = []
        total_lines = len(lines)
        if total_lines == 0:
            return chunks

        stride = WINDOW_SIZE_LINES - WINDOW_OVERLAP_LINES
        start = 0

        while start < total_lines:
            end = min(start + WINDOW_SIZE_LINES, total_lines)
            raw_code = "\n".join(lines[start:end])
            chunk_name = f"block_{start + 1}_{end}"

            chunks.append(
                self._format_chunk(
                    file_path=file_path,
                    symbol_name=chunk_name,
                    chunk_type="fallback_block",
                    start_line=start + 1,
                    end_line=end,
                    raw_code=raw_code,
                )
            )

            if end >= total_lines:
                break
            start += stride

        return chunks

    def chunk_file(self, full_file_path: Path, relative_file_path: str) -> List[CodeChunk]:
        """Chunks a single file using syntax-aware AST parsing or sliding-window fallback."""
        try:
            content = full_file_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Could not read file {relative_file_path}: {e}")
            return []

        lines = content.splitlines()
        if not lines:
            return []

        ext = full_file_path.suffix.lower()
        lang_key = AST_SUPPORTED_EXTENSIONS.get(ext)

        if not lang_key:
            return self.fallback_sliding_window_chunker(relative_file_path, lines)

        if lang_key == "python":
            ast_chunks = self._extract_python_declarations(
                content, relative_file_path, lines
            )
        else:
            ast_chunks = self._extract_js_ts_declarations(
                content, relative_file_path, lines
            )

        # Fallback to sliding window if no declarations could be parsed
        if not ast_chunks:
            return self.fallback_sliding_window_chunker(relative_file_path, lines)

        return ast_chunks

    def chunk_repository(
        self, repo_dir: Path, valid_relative_paths: List[str]
    ) -> List[CodeChunk]:
        """Iterates over all valid codebase files and produces a comprehensive list of CodeChunks."""
        all_chunks: List[CodeChunk] = []
        for rel_path in valid_relative_paths:
            full_path = repo_dir / rel_path
            if full_path.is_file():
                chunks = self.chunk_file(full_path, rel_path)
                all_chunks.extend(chunks)

        logger.info(
            f"Chunked {len(valid_relative_paths)} files into {len(all_chunks)} code chunks."
        )
        return all_chunks


_ast_service_instance: Optional[ASTService] = None


def get_ast_service() -> ASTService:
    global _ast_service_instance
    if _ast_service_instance is None:
        _ast_service_instance = ASTService()
    return _ast_service_instance

from pathlib import Path
import tempfile
import pytest

from app.services.ast_service import ASTService


def test_python_ast_extraction():
    service = ASTService()
    with tempfile.TemporaryDirectory() as tmpdir:
        py_file = Path(tmpdir) / "sample.py"
        py_code = """
import os

def calculate_sum(a: int, b: int) -> int:
    return a + b

class MathEngine:
    def multiply(self, x: int, y: int) -> int:
        return x * y

@decorator
def decorated_action():
    pass
"""
        py_file.write_text(py_code.strip(), encoding="utf-8")
        chunks = service.chunk_file(py_file, "sample.py")

        symbols = [c.symbol_name for c in chunks]
        assert "calculate_sum" in symbols
        assert "MathEngine" in symbols
        assert "MathEngine.multiply" in symbols
        assert "decorated_action" in symbols

        # Verify context header formatting
        calc_chunk = next(c for c in chunks if c.symbol_name == "calculate_sum")
        assert calc_chunk.chunk_type == "function_definition"
        assert f"# File: sample.py | Symbol: calculate_sum | Lines: {calc_chunk.start_line}-{calc_chunk.end_line}" in calc_chunk.content


def test_js_ts_ast_extraction():
    service = ASTService()
    with tempfile.TemporaryDirectory() as tmpdir:
        ts_file = Path(tmpdir) / "types.ts"
        ts_code = """
export interface UserConfig {
    id: string;
    name: string;
}

export function getUser(): UserConfig {
    return { id: "1", name: "Alice" };
}

export const formatUser = (user: UserConfig): string => {
    return `${user.name} (${user.id})`;
};
"""
        ts_file.write_text(ts_code.strip(), encoding="utf-8")
        chunks = service.chunk_file(ts_file, "types.ts")

        symbols = [c.symbol_name for c in chunks]
        assert "UserConfig" in symbols
        assert "getUser" in symbols
        assert "formatUser" in symbols

        interface_chunk = next(c for c in chunks if c.symbol_name == "UserConfig")
        assert interface_chunk.chunk_type == "interface_declaration"

        arrow_chunk = next(c for c in chunks if c.symbol_name == "formatUser")
        assert arrow_chunk.chunk_type == "arrow_function"


def test_fallback_sliding_window_chunker():
    service = ASTService()
    with tempfile.TemporaryDirectory() as tmpdir:
        md_file = Path(tmpdir) / "README.md"
        # Generate 120 lines
        lines = [f"Line {i}: documentation content" for i in range(1, 121)]
        md_file.write_text("\n".join(lines), encoding="utf-8")

        chunks = service.chunk_file(md_file, "README.md")
        assert len(chunks) == 2  # 80 lines chunk 1, stride 65 -> chunk 2 covers remaining lines
        assert chunks[0].start_line == 1
        assert chunks[0].end_line == 80
        assert chunks[0].chunk_type == "fallback_block"
        assert chunks[1].start_line == 66
        assert chunks[1].end_line == 120
        assert "# File: README.md | Symbol: block_1_80 | Lines: 1-80" in chunks[0].content


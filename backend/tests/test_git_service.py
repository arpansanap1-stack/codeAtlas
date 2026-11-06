import os
from pathlib import Path
import tempfile
import pytest

from app.services.git_service import (
    parse_github_url,
    is_binary_file,
    build_ascii_tree,
    GitService,
    IGNORED_DIRS,
    IGNORED_FILES,
)


def test_parse_github_url_valid():
    owner, repo = parse_github_url("https://github.com/fastapi/fastapi")
    assert owner == "fastapi"
    assert repo == "fastapi"

    owner, repo = parse_github_url("https://github.com/facebook/react.git")
    assert owner == "facebook"
    assert repo == "react"


def test_parse_github_url_invalid():
    with pytest.raises(ValueError):
        parse_github_url("https://gitlab.com/owner/repo")

    with pytest.raises(ValueError):
        parse_github_url("not-a-url")

    with pytest.raises(ValueError):
        parse_github_url("https://github.com/onlyowner")


def test_is_binary_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Text file
        txt_path = Path(tmpdir) / "test.txt"
        txt_path.write_text("Hello World", encoding="utf-8")
        assert is_binary_file(txt_path) is False

        # Known binary extension
        png_path = Path(tmpdir) / "image.png"
        png_path.write_bytes(b"\x89PNG\r\n\x1a\n")
        assert is_binary_file(png_path) is True

        # Null byte in non-binary extension
        fake_txt = Path(tmpdir) / "fake.txt"
        fake_txt.write_bytes(b"hello\x00world")
        assert is_binary_file(fake_txt) is True


def test_build_ascii_tree():
    paths = [
        "src/components/Button.tsx",
        "src/index.ts",
        "README.md",
    ]
    tree = build_ascii_tree("test-repo", paths)
    assert "test-repo/" in tree
    assert "src/" in tree
    assert "Button.tsx" in tree
    assert "README.md" in tree
    assert "├── " in tree or "└── " in tree


def test_filter_and_index_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir) / "sample-repo"
        root.mkdir()

        # Valid files
        (root / "main.py").write_text("print('hello')", encoding="utf-8")
        src_dir = root / "src"
        src_dir.mkdir()
        (src_dir / "utils.py").write_text("def add(a, b): return a + b", encoding="utf-8")

        # Noise files (should be ignored)
        git_dir = root / ".git"
        git_dir.mkdir()
        (git_dir / "config").write_text("git config", encoding="utf-8")

        node_dir = root / "node_modules"
        node_dir.mkdir()
        (node_dir / "pkg.js").write_text("module.exports = {}", encoding="utf-8")

        (root / "package-lock.json").write_text("{}", encoding="utf-8")
        (root / "test.png").write_bytes(b"\x89PNG\r\n\x1a\n")

        service = GitService()
        valid_files, total_size, ascii_tree = service.filter_and_index_files(root)

        rel_paths = [f.relative_path for f in valid_files]
        assert "main.py" in rel_paths
        assert "src/utils.py" in rel_paths
        assert not any(".git" in p for p in rel_paths)
        assert not any("node_modules" in p for p in rel_paths)
        assert "package-lock.json" not in rel_paths
        assert "test.png" not in rel_paths
        assert total_size > 0
        assert "sample-repo/" in ascii_tree


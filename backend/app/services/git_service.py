import os
from pathlib import Path
import re
import shutil
from typing import Any, Dict, List, Set, Tuple
import git
from git.exc import GitCommandError

from app.config import get_settings
from app.models.schemas import GITHUB_URL_REGEX, FileNode, normalize_github_url

# Directories to exclude from indexing
IGNORED_DIRS: Set[str] = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".idea",
    ".vscode",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    "target",
    "vendor",
    "bin",
    "obj",
    ".nuxt",
    ".output",
    ".serverless",
    "Pods",
}

# Lockfiles and generated files to exclude
IGNORED_FILES: Set[str] = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "pipfile.lock",
    "bun.lockb",
    "cargo.lock",
    "composer.lock",
    "gemfile.lock",
}

# Binary, media, and archive extensions to exclude
BINARY_EXTENSIONS: Set[str] = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp", ".tiff", ".psd",
    # Audio/Video
    ".mp3", ".mp4", ".mov", ".avi", ".mkv", ".wav", ".flac", ".ogg", ".webm",
    # Fonts
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    # Archives / Executables / Binaries
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".exe", ".dll", ".so", ".dylib",
    ".bin", ".pyc", ".pyo", ".pyd", ".wasm", ".class", ".o", ".a",
    # Documents / Datasets
    ".pdf", ".docx", ".xlsx", ".pptx", ".sqlite", ".db", ".parquet", ".arrow", ".pkl",
    ".h5", ".onnx", ".pb", ".tflite",
}


def parse_github_url(url: str) -> Tuple[str, str]:
    """
    Validates GitHub URL and extracts (owner, repo_name).
    Raises ValueError if invalid.
    """
    clean_url = normalize_github_url(url)
    match = re.search(
        r"https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)",
        clean_url,
    )
    if not match:
        raise ValueError(
            f"Invalid GitHub URL: '{url}'. Expected format: https://github.com/<owner>/<repo>"
        )
    owner, repo_name = match.groups()
    return owner, repo_name


def is_binary_file(file_path: Path) -> bool:
    """
    Determines if a file is binary using extension heuristics and null-byte inspection.
    """
    if file_path.suffix.lower() in BINARY_EXTENSIONS:
        return True

    # Read first 1024 bytes and check for null byte
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return True
    except (IOError, PermissionError):
        return True

    return False


def build_ascii_tree(repo_name: str, relative_file_paths: List[str]) -> str:
    """
    Constructs a clean ASCII directory tree from a list of relative file paths.
    """
    # Build nested dictionary
    tree: Dict[str, Any] = {}
    for rel_path in sorted(relative_file_paths):
        parts = Path(rel_path).parts
        curr = tree
        for part in parts:
            curr = curr.setdefault(part, {})

    lines: List[str] = [f"{repo_name}/"]

    def _render_node(node: Dict[str, Any], prefix: str = ""):
        # Sort directories first, then files
        entries = sorted(node.keys(), key=lambda name: (0 if node[name] else 1, name.lower()))
        total = len(entries)

        for index, name in enumerate(entries):
            is_last = index == total - 1
            connector = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "
            is_dir = bool(node[name])

            display_name = f"{name}/" if is_dir else name
            lines.append(f"{prefix}{connector}{display_name}")

            if is_dir:
                _render_node(node[name], prefix + child_prefix)

    _render_node(tree)
    return "\n".join(lines)


class GitService:
    def __init__(self):
        self.settings = get_settings()

    def clone_repository(self, repo_url: str, repo_id: str) -> Tuple[Path, str]:
        """
        Shallow clones a public GitHub repo into the configured storage directory.
        Raises ValueError if URL is invalid or repo cannot be accessed.
        """
        owner, repo_name = parse_github_url(repo_url)
        base_dir = self.settings.get_storage_path()
        target_dir = base_dir / repo_id

        # Clean existing destination if it exists
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)

        target_dir.mkdir(parents=True, exist_ok=True)

        try:
            # git clone --depth 1 --single-branch
            git.Repo.clone_from(
                url=repo_url,
                to_path=target_dir,
                depth=1,
                single_branch=True,
                env={"GIT_TERMINAL_PROMPT": "0"},  # Prevent blocking on private auth prompt
            )
        except GitCommandError as e:
            # Clean up aborted clone directory
            shutil.rmtree(target_dir, ignore_errors=True)
            err_msg = str(e.stderr or e).lower()
            if "not found" in err_msg or "authentication required" in err_msg or "repository not found" in err_msg:
                raise ValueError(
                    f"Repository '{repo_url}' could not be cloned. "
                    "Ensure the repository is public and the URL is spelled correctly."
                ) from e
            raise ValueError(f"Git clone failed: {e.stderr or str(e)}") from e
        except Exception as e:
            shutil.rmtree(target_dir, ignore_errors=True)
            raise ValueError(f"Failed to clone repository: {str(e)}") from e

        return target_dir, repo_name

    def filter_and_index_files(
        self, repo_dir: Path, repo_name: str = ""
    ) -> Tuple[List[FileNode], int, str]:
        """
        Walks cloned repository directory, excludes ignored directories, lockfiles,
        binaries, and oversized files (> 500KB), and returns (valid_files, total_size, ascii_tree).
        """
        display_root = repo_name if repo_name else repo_dir.name
        valid_file_nodes: List[FileNode] = []
        valid_relative_paths: List[str] = []
        total_size_bytes = 0
        max_bytes = self.settings.MAX_FILE_SIZE_BYTES

        for root, dirs, files in os.walk(repo_dir, topdown=True):
            # Prune ignored directories in-place
            dirs[:] = [
                d for d in dirs
                if d not in IGNORED_DIRS and not d.startswith(".")
            ]

            for file_name in files:
                # Filter ignored lockfiles
                if file_name.lower() in IGNORED_FILES:
                    continue

                file_path = Path(root) / file_name

                # Filter binary or oversized files
                try:
                    file_size = file_path.stat().st_size
                except (IOError, PermissionError):
                    continue

                if file_size > max_bytes or file_size == 0:
                    continue

                if is_binary_file(file_path):
                    continue

                rel_path = file_path.relative_to(repo_dir).as_posix()
                valid_relative_paths.append(rel_path)
                valid_file_nodes.append(
                    FileNode(
                        relative_path=rel_path,
                        size_bytes=file_size,
                        extension=file_path.suffix.lower(),
                    )
                )
                total_size_bytes += file_size

        ascii_tree = build_ascii_tree(display_root, valid_relative_paths)
        return valid_file_nodes, total_size_bytes, ascii_tree


_git_service_instance = None


def get_git_service() -> GitService:
    global _git_service_instance
    if _git_service_instance is None:
        _git_service_instance = GitService()
    return _git_service_instance


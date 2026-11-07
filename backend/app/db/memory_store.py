from datetime import datetime, timezone
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("codeatlas.db.memory")


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes cosine similarity between two float vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


class MemoryStore:
    """
    In-memory storage and search engine used as an offline fallback
    when Supabase credentials are not provisioned.
    """

    def __init__(self):
        self.repos: Dict[str, Dict[str, Any]] = {}
        self.chunks: Dict[str, List[Dict[str, Any]]] = {}
        self.files: Dict[str, Dict[str, str]] = {}  # repo_id -> {file_path: content}
        self.onboarding: Dict[str, Dict[str, Any]] = {}
        self.explanations: Dict[str, Dict[str, Dict[str, Any]]] = {}  # repo_id -> {level: data}
        self.journeys: Dict[str, Dict[str, Dict[str, Any]]] = {}  # repo_id -> {topic: data}

    def save_repo(self, repo_id: str, record: Dict[str, Any]) -> None:
        self.repos[repo_id] = record

    def get_repo(self, repo_id: str) -> Optional[Dict[str, Any]]:
        return self.repos.get(repo_id)

    def update_repo(self, repo_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if repo_id in self.repos:
            self.repos[repo_id].update(updates)
            return self.repos[repo_id]
        return None

    def save_file(self, repo_id: str, file_path: str, content: str) -> None:
        if repo_id not in self.files:
            self.files[repo_id] = {}
        self.files[repo_id][file_path] = content

    def get_file(self, repo_id: str, file_path: str) -> Optional[str]:
        if repo_id in self.files:
            return self.files[repo_id].get(file_path)
        return None

    def add_chunks(self, repo_id: str, records: List[Dict[str, Any]]) -> None:
        if repo_id not in self.chunks:
            self.chunks[repo_id] = []
        self.chunks[repo_id].extend(records)

    def get_chunks(self, repo_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        repo_chunks = self.chunks.get(repo_id, [])
        return repo_chunks[offset : offset + limit]

    def get_file_chunks(self, repo_id: str, file_path: str) -> List[Dict[str, Any]]:
        repo_chunks = self.chunks.get(repo_id, [])
        return [c for c in repo_chunks if c.get("file_path") == file_path]

    def match_hybrid(
        self,
        query_embedding: List[float],
        query_text: str,
        target_repo_id: str,
        match_count: int = 8,
        rrf_k: int = 60,
    ) -> List[Dict[str, Any]]:
        repo_chunks = self.chunks.get(target_repo_id, [])
        if not repo_chunks:
            return []

        # Vector semantic scores
        semantic_scores: List[Tuple[Dict[str, Any], float]] = []
        for c in repo_chunks:
            emb = c.get("embedding")
            sim = cosine_similarity(query_embedding, emb) if emb else 0.0
            semantic_scores.append((c, sim))
        semantic_scores.sort(key=lambda x: x[1], reverse=True)

        # Keyword text scores (simple token matching)
        query_terms = set(re.findall(r"\w+", query_text.lower()))
        keyword_scores: List[Tuple[Dict[str, Any], float]] = []
        for c in repo_chunks:
            text = (
                (c.get("symbol_name") or "")
                + " "
                + (c.get("file_path") or "")
                + " "
                + (c.get("content") or "")
            ).lower()
            matches = sum(1 for term in query_terms if term in text)
            keyword_scores.append((c, float(matches)))
        keyword_scores.sort(key=lambda x: x[1], reverse=True)

        # Reciprocal Rank Fusion
        rrf_scores: Dict[int, float] = {}
        for rank, (chunk, _) in enumerate(semantic_scores):
            cid = id(chunk)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank + 1))

        for rank, (chunk, _) in enumerate(keyword_scores):
            cid = id(chunk)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank + 1))

        sorted_chunks = sorted(repo_chunks, key=lambda c: rrf_scores.get(id(c), 0.0), reverse=True)
        return sorted_chunks[:match_count]

    def save_onboarding(self, repo_id: str, markdown_content: str) -> Dict[str, Any]:
        data = {
            "repo_id": repo_id,
            "markdown_content": markdown_content,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.onboarding[repo_id] = data
        return data

    def get_onboarding(self, repo_id: str) -> Optional[Dict[str, Any]]:
        return self.onboarding.get(repo_id)

    def save_explanation(self, repo_id: str, level: str, title: str, markdown_content: str) -> Dict[str, Any]:
        data = {
            "repo_id": repo_id,
            "level": level,
            "title": title,
            "markdown_content": markdown_content,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if repo_id not in self.explanations:
            self.explanations[repo_id] = {}
        self.explanations[repo_id][level] = data
        return data

    def get_explanation(self, repo_id: str, level: str) -> Optional[Dict[str, Any]]:
        if repo_id in self.explanations:
            return self.explanations[repo_id].get(level)
        return None

    def save_journey_record(self, repo_id: str, topic: str, summary: str, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        data = {
            "repo_id": repo_id,
            "topic": topic,
            "summary": summary,
            "steps": steps,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if repo_id not in self.journeys:
            self.journeys[repo_id] = {}
        self.journeys[repo_id][topic.lower().strip()] = data
        return data

    def get_journey_record(self, repo_id: str, topic: str) -> Optional[Dict[str, Any]]:
        if repo_id in self.journeys:
            return self.journeys[repo_id].get(topic.lower().strip())
        return None

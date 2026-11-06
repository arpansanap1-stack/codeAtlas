from datetime import datetime, timezone
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple
from app.config import get_settings
from app.models.schemas import CodeChunk

logger = logging.getLogger("codeatlas.db")


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


class DatabaseClient:
    """
    Supabase client wrapper with fallback in-memory store for local testing
    when Supabase credentials have not yet been provisioned.
    """

    def __init__(self):
        settings = get_settings()
        self.supabase = None
        self._memory_repos: Dict[str, Dict[str, Any]] = {}
        self._memory_chunks: Dict[str, List[Dict[str, Any]]] = {}
        self._memory_files: Dict[str, Dict[str, str]] = {}  # repo_id -> {file_path: content}
        self._memory_onboarding: Dict[str, Dict[str, Any]] = {}
        self._memory_explanations: Dict[str, Dict[str, Dict[str, Any]]] = {}  # repo_id -> {level: data}
        self._memory_journeys: Dict[str, Dict[str, Dict[str, Any]]] = {}  # repo_id -> {topic: data}

        if (
            settings.SUPABASE_URL
            and settings.SUPABASE_KEY
            and not settings.SUPABASE_URL.startswith("https://your-project")
        ):
            try:
                from supabase import create_client, Client
                self.supabase: Optional[Client] = create_client(
                    settings.SUPABASE_URL, settings.SUPABASE_KEY
                )
                logger.info("Successfully connected to Supabase database.")
            except Exception as e:
                logger.warning(
                    f"Failed to initialize Supabase client ({e}). Falling back to in-memory store."
                )
                self.supabase = None
        else:
            logger.info(
                "Supabase credentials not configured or set to placeholder. Using in-memory store."
            )

    def create_repository(
        self,
        repo_id: str,
        repo_url: str,
        repo_name: str,
        status: str = "pending",
        directory_tree: Optional[str] = None,
        graph_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": repo_id,
            "repo_url": repo_url,
            "repo_name": repo_name,
            "status": status,
            "directory_tree": directory_tree,
            "graph_data": graph_data or {"nodes": [], "edges": []},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.supabase:
            try:
                res = self.supabase.table("repositories").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Error inserting repository into Supabase: {e}")
                self._memory_repos[repo_id] = record
                return record

        self._memory_repos[repo_id] = record
        return record

    def update_repository(self, repo_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if self.supabase:
            try:
                res = (
                    self.supabase.table("repositories")
                    .update(updates)
                    .eq("id", repo_id)
                    .execute()
                )
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Error updating repository in Supabase: {e}")

        if repo_id in self._memory_repos:
            self._memory_repos[repo_id].update(updates)
            return self._memory_repos[repo_id]

        updates["id"] = repo_id
        self._memory_repos[repo_id] = updates
        return updates

    def get_repository(self, repo_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            try:
                res = (
                    self.supabase.table("repositories")
                    .select("*")
                    .eq("id", repo_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Error fetching repository from Supabase: {e}")

        return self._memory_repos.get(repo_id)

    def save_file_content(self, repo_id: str, file_path: str, content: str) -> None:
        """Stores complete file content for quick retrieval by the code viewer."""
        if repo_id not in self._memory_files:
            self._memory_files[repo_id] = {}
        self._memory_files[repo_id][file_path] = content

        if self.supabase:
            try:
                self.supabase.table("repository_files").upsert(
                    {"repo_id": repo_id, "file_path": file_path, "content": content},
                    on_conflict="repo_id,file_path",
                ).execute()
            except Exception as e:
                logger.debug(f"Could not upsert into repository_files: {e}")

    def get_file_content(self, repo_id: str, file_path: str) -> Optional[str]:
        """
        Retrieves file content from repository_files or reconstructs from code_chunks.
        """
        # 1. Check memory store
        if repo_id in self._memory_files and file_path in self._memory_files[repo_id]:
            return self._memory_files[repo_id][file_path]

        # 2. Check Supabase repository_files table
        if self.supabase:
            try:
                res = (
                    self.supabase.table("repository_files")
                    .select("content")
                    .eq("repo_id", repo_id)
                    .eq("file_path", file_path)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]["content"]
            except Exception as e:
                logger.debug(f"Could not select from repository_files: {e}")

        # 3. Fallback: Reconstruct from code chunks
        chunks = self.get_code_chunks_for_file(repo_id, file_path)
        if not chunks:
            return None

        # Reconstruct by stripping context headers and ordering by start_line
        sorted_chunks = sorted(chunks, key=lambda c: c.get("start_line", 0))
        lines: List[str] = []
        for ch in sorted_chunks:
            chunk_content = ch.get("content", "")
            # Strip context header if present
            header_match = re.match(r"^# File:.*?Lines: \d+-\d+\n?", chunk_content)
            body = chunk_content[header_match.end() :] if header_match else chunk_content
            lines.append(body.rstrip())

        return "\n\n".join(lines)

    def save_code_chunks(self, repo_id: str, chunks: List[CodeChunk]) -> int:
        """Saves code chunks without embeddings."""
        records = [
            {
                "repo_id": repo_id,
                "file_path": c.file_path,
                "symbol_name": c.symbol_name,
                "chunk_type": c.chunk_type,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "content": c.content,
            }
            for c in chunks
        ]

        if self.supabase and records:
            try:
                batch_size = 50
                for i in range(0, len(records), batch_size):
                    batch = records[i : i + batch_size]
                    self.supabase.table("code_chunks").insert(batch).execute()
            except Exception as e:
                logger.error(f"Error inserting code_chunks into Supabase: {e}")

        if repo_id not in self._memory_chunks:
            self._memory_chunks[repo_id] = []
        self._memory_chunks[repo_id].extend(records)
        return len(records)

    def save_code_chunks_with_embeddings(
        self,
        repo_id: str,
        chunks: List[CodeChunk],
        embeddings: List[List[float]],
    ) -> int:
        """Saves code chunks along with vector embeddings."""
        records = [
            {
                "repo_id": repo_id,
                "file_path": c.file_path,
                "symbol_name": c.symbol_name,
                "chunk_type": c.chunk_type,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "content": c.content,
                "embedding": emb,
            }
            for c, emb in zip(chunks, embeddings)
        ]

        if self.supabase and records:
            try:
                # Insert in batches of 50
                batch_size = 50
                for i in range(0, len(records), batch_size):
                    batch = records[i : i + batch_size]
                    self.supabase.table("code_chunks").insert(batch).execute()
            except Exception as e:
                logger.error(f"Error inserting code_chunks with embeddings into Supabase: {e}")

        # Update in-memory store
        if repo_id not in self._memory_chunks:
            self._memory_chunks[repo_id] = []
        self._memory_chunks[repo_id].extend(records)
        return len(records)

    def get_code_chunks(
        self, repo_id: str, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        if self.supabase:
            try:
                res = (
                    self.supabase.table("code_chunks")
                    .select("file_path, symbol_name, chunk_type, start_line, end_line, content")
                    .eq("repo_id", repo_id)
                    .range(offset, offset + limit - 1)
                    .execute()
                )
                if res.data:
                    return res.data
            except Exception as e:
                logger.error(f"Error fetching code_chunks from Supabase: {e}")

        repo_chunks = self._memory_chunks.get(repo_id, [])
        return repo_chunks[offset : offset + limit]

    def get_code_chunks_for_file(self, repo_id: str, file_path: str) -> List[Dict[str, Any]]:
        """Retrieves all chunks belonging to a specific file."""
        if self.supabase:
            try:
                res = (
                    self.supabase.table("code_chunks")
                    .select("file_path, symbol_name, chunk_type, start_line, end_line, content")
                    .eq("repo_id", repo_id)
                    .eq("file_path", file_path)
                    .order("start_line")
                    .execute()
                )
                if res.data:
                    return res.data
            except Exception as e:
                logger.debug(f"Error querying code_chunks for file: {e}")

        repo_chunks = self._memory_chunks.get(repo_id, [])
        return [c for c in repo_chunks if c.get("file_path") == file_path]

    def match_code_chunks_hybrid(
        self,
        query_embedding: List[float],
        query_text: str,
        target_repo_id: str,
        match_count: int = 8,
        rrf_k: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Executes Reciprocal Rank Fusion (RRF) hybrid search.
        Uses Supabase RPC function when available, or Python in-memory RRF fallback.
        """
        # 1. Supabase RPC execution
        if self.supabase:
            try:
                res = self.supabase.rpc(
                    "match_code_chunks_hybrid",
                    {
                        "query_embedding": query_embedding,
                        "query_text": query_text,
                        "target_repo_id": target_repo_id,
                        "match_count": match_count,
                        "rrf_k": rrf_k,
                    },
                ).execute()
                if res.data:
                    return res.data
            except Exception as e:
                logger.warning(
                    f"Supabase RPC match_code_chunks_hybrid failed ({e}). Using in-memory hybrid search."
                )

        # 2. In-Memory RRF Hybrid Search Fallback
        repo_chunks = self._memory_chunks.get(target_repo_id, [])
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

        # Reciprocal Rank Fusion calculation
        rrf_scores: Dict[int, float] = {}
        chunk_map: Dict[int, Dict[str, Any]] = {}

        for rank, (chunk, _) in enumerate(semantic_scores[: match_count * 2], 1):
            chunk_id = id(chunk)
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (rrf_k + rank))

        for rank, (chunk, _) in enumerate(keyword_scores[: match_count * 2], 1):
            chunk_id = id(chunk)
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (rrf_k + rank))

        sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        results: List[Dict[str, Any]] = []
        for chunk_id, rrf_score in sorted_chunks[:match_count]:
            chunk_data = dict(chunk_map[chunk_id])
            chunk_data["rank_score"] = rrf_score
            results.append(chunk_data)

        return results

    def save_onboarding_doc(self, repo_id: str, markdown_content: str) -> Dict[str, Any]:
        """Saves or updates generated onboarding documentation in Supabase or memory."""
        now_iso = datetime.now(timezone.utc).isoformat()
        record = {
            "repo_id": repo_id,
            "markdown_content": markdown_content,
            "updated_at": now_iso,
        }

        if self.supabase:
            try:
                res = (
                    self.supabase.table("onboarding_docs")
                    .upsert(record, on_conflict="repo_id")
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Error saving onboarding doc to Supabase: {e}")

        self._memory_onboarding[repo_id] = record
        return record

    def get_onboarding_doc(self, repo_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached onboarding documentation by repository ID."""
        if self.supabase:
            try:
                res = (
                    self.supabase.table("onboarding_docs")
                    .select("*")
                    .eq("repo_id", repo_id)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Error fetching onboarding doc from Supabase: {e}")

        return self._memory_onboarding.get(repo_id)

    def save_architecture_explanation(
        self, repo_id: str, level: str, title: str, markdown_content: str
    ) -> Dict[str, Any]:
        """Caches an architecture explanation by repo_id and level."""
        record = {
            "repo_id": repo_id,
            "level": level,
            "title": title,
            "markdown_content": markdown_content,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if repo_id not in self._memory_explanations:
            self._memory_explanations[repo_id] = {}
        self._memory_explanations[repo_id][level] = record
        return record

    def get_architecture_explanation(
        self, repo_id: str, level: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieves cached architecture explanation for a repository and level."""
        return self._memory_explanations.get(repo_id, {}).get(level)

    def save_journey(
        self, repo_id: str, topic: str, summary: str, steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Caches an interactive code journey by repo_id and normalized topic."""
        norm_topic = topic.strip().lower()
        record = {
            "repo_id": repo_id,
            "topic": topic,
            "summary": summary,
            "steps": steps,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if repo_id not in self._memory_journeys:
            self._memory_journeys[repo_id] = {}
        self._memory_journeys[repo_id][norm_topic] = record
        return record

    def get_journey(self, repo_id: str, topic: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached journey by repository and topic."""
        norm_topic = topic.strip().lower()
        return self._memory_journeys.get(repo_id, {}).get(norm_topic)



_db_instance: Optional[DatabaseClient] = None


def get_db() -> DatabaseClient:
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseClient()
    return _db_instance

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional
from app.config import get_settings
from app.db.memory_store import MemoryStore, cosine_similarity
from app.models.schemas import CodeChunk

logger = logging.getLogger("codeatlas.db")


class DatabaseClient:
    """
    Supabase client wrapper with fallback in-memory store for local testing
    when Supabase credentials have not yet been provisioned.
    """

    def __init__(self):
        settings = get_settings()
        self.supabase = None
        self._memory_store = MemoryStore()

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

    @property
    def _memory_repos(self) -> Dict[str, Dict[str, Any]]:
        return self._memory_store.repos

    @property
    def _memory_chunks(self) -> Dict[str, List[Dict[str, Any]]]:
        return self._memory_store.chunks

    @property
    def _memory_files(self) -> Dict[str, Dict[str, str]]:
        return self._memory_store.files

    @property
    def _memory_onboarding(self) -> Dict[str, Dict[str, Any]]:
        return self._memory_store.onboarding

    @property
    def _memory_explanations(self) -> Dict[str, Dict[str, Dict[str, Any]]]:
        return self._memory_store.explanations

    @property
    def _memory_journeys(self) -> Dict[str, Dict[str, Dict[str, Any]]]:
        return self._memory_store.journeys

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

        self._memory_store.save_repo(repo_id, record)
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

        res = self._memory_store.update_repo(repo_id, updates)
        return res or {"id": repo_id, **updates}

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

        return self._memory_store.get_repo(repo_id)

    def save_file_content(self, repo_id: str, file_path: str, content: str) -> None:
        """Stores complete file content for quick retrieval by the code viewer."""
        self._memory_store.save_file(repo_id, file_path, content)

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
        cached = self._memory_store.get_file(repo_id, file_path)
        if cached:
            return cached

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

        chunks = self.get_code_chunks_for_file(repo_id, file_path)
        if not chunks:
            return None

        sorted_chunks = sorted(chunks, key=lambda c: c.get("start_line", 0))
        lines: List[str] = []
        for ch in sorted_chunks:
            chunk_content = ch.get("content", "")
            header_match = re.match(r"^# File:.*?Lines: \d+-\d+\n?", chunk_content)
            body = chunk_content[header_match.end() :] if header_match else chunk_content
            lines.append(body.rstrip())

        return "\n\n".join(lines)

    def save_code_chunks(self, repo_id: str, chunks: List[CodeChunk]) -> int:
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

        self._memory_store.add_chunks(repo_id, records)
        return len(records)

    def save_code_chunks_with_embeddings(
        self,
        repo_id: str,
        chunks: List[CodeChunk],
        embeddings: List[List[float]],
    ) -> int:
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
                batch_size = 50
                for i in range(0, len(records), batch_size):
                    batch = records[i : i + batch_size]
                    self.supabase.table("code_chunks").insert(batch).execute()
            except Exception as e:
                logger.error(f"Error inserting code_chunks with embeddings into Supabase: {e}")

        self._memory_store.add_chunks(repo_id, records)
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

        return self._memory_store.get_chunks(repo_id, limit, offset)

    def get_code_chunks_for_file(self, repo_id: str, file_path: str) -> List[Dict[str, Any]]:
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

        return self._memory_store.get_file_chunks(repo_id, file_path)

    def match_code_chunks_hybrid(
        self,
        query_embedding: List[float],
        query_text: str,
        target_repo_id: str,
        match_count: int = 8,
        rrf_k: int = 60,
    ) -> List[Dict[str, Any]]:
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

        return self._memory_store.match_hybrid(
            query_embedding=query_embedding,
            query_text=query_text,
            target_repo_id=target_repo_id,
            match_count=match_count,
            rrf_k=rrf_k,
        )

    def save_onboarding_doc(self, repo_id: str, markdown_content: str) -> Dict[str, Any]:
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

        return self._memory_store.save_onboarding(repo_id, markdown_content)

    def get_onboarding_doc(self, repo_id: str) -> Optional[Dict[str, Any]]:
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

        return self._memory_store.get_onboarding(repo_id)

    def save_architecture_explanation(
        self, repo_id: str, level: str, title: str, markdown_content: str
    ) -> Dict[str, Any]:
        return self._memory_store.save_explanation(repo_id, level, title, markdown_content)

    def get_architecture_explanation(
        self, repo_id: str, level: str
    ) -> Optional[Dict[str, Any]]:
        return self._memory_store.get_explanation(repo_id, level)

    def save_journey(
        self, repo_id: str, topic: str, summary: str, steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return self._memory_store.save_journey_record(repo_id, topic, summary, steps)

    def get_journey(self, repo_id: str, topic: str) -> Optional[Dict[str, Any]]:
        return self._memory_store.get_journey_record(repo_id, topic)


_db_instance: Optional[DatabaseClient] = None


def get_db() -> DatabaseClient:
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseClient()
    return _db_instance

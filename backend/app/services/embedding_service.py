import asyncio
import hashlib
import logging
import math
import shutil
import time
from typing import List, Optional
from google import genai
from google.genai import types

from app.config import get_settings
from app.db.supabase import get_db
from app.models.schemas import CodeChunk, RepoStatus

logger = logging.getLogger("codeatlas.embedding")

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
BATCH_SIZE = 50
MAX_RETRIES = 3


def generate_mock_embedding(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """
    Generates a deterministic L2-normalized unit vector for offline/test environments
    when GEMINI_API_KEY is not provisioned.
    """
    hasher = hashlib.sha256(text.encode("utf-8"))
    seed = int.from_bytes(hasher.digest()[:8], "big")
    
    # Generate pseudo-random components based on seed
    vector: List[float] = []
    current = seed
    for _ in range(dim):
        current = (current * 6364136223846793005 + 1442695040888963407) & 0xFFFFFFFFFFFFFFFF
        val = (current / 0xFFFFFFFFFFFFFFFF) * 2.0 - 1.0
        vector.append(val)

    # Normalize vector to unit length (L2 norm)
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0:
        norm = 1.0
    return [round(x / norm, 6) for x in vector]


class EmbeddingService:
    def __init__(self):
        self.settings = get_settings()
        self.client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self):
        api_key = self.settings.GEMINI_API_KEY
        if api_key and not api_key.startswith("your-gemini"):
            try:
                self.client = genai.Client(api_key=api_key)
                logger.info("Google GenAI client initialized for embeddings.")
            except Exception as e:
                logger.warning(f"Failed to initialize GenAI client: {e}. Fallback to mock embeddings.")
                self.client = None
        else:
            self.client = None
            logger.info("GEMINI_API_KEY not configured. Using deterministic fallback embeddings.")

    def set_api_key(self, api_key: str) -> None:
        """Dynamically reconfigures the Gemini client with a new API key."""
        self.settings.GEMINI_API_KEY = api_key
        if api_key and not api_key.startswith("your-gemini"):
            self.client = genai.Client(api_key=api_key)
            logger.info("Google GenAI client reconfigured for embeddings.")
        else:
            self.client = None
            logger.info("Google GenAI client cleared for embeddings.")

    def is_configured(self) -> bool:
        return self.client is not None

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generates 768-dimensional embeddings for a batch of strings.
        Cleans and truncates input to minimize token usage and includes exponential backoff retry.
        """
        if not texts:
            return []

        if not self.client:
            return [generate_mock_embedding(t) for t in texts]

        # Token optimization: truncate oversized code to 1500 chars & strip excess whitespace
        clean_texts = [t[:1500].strip() or "code" for t in texts]
        model = getattr(self.settings, "GEMINI_EMBEDDING_MODEL", EMBEDDING_MODEL)

        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.models.embed_content(
                    model=model,
                    contents=clean_texts,
                    config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
                )
                embeddings = [e.values for e in response.embeddings]
                return embeddings
            except Exception as e:
                logger.warning(
                    f"GenAI embed_content error (attempt {attempt + 1}/{MAX_RETRIES}) with {model}: {e}"
                )
                if attempt < MAX_RETRIES - 1:
                    time.sleep(1.5**attempt)
                else:
                    logger.error("Max retries exceeded for embedding batch. Falling back to deterministic unit embeddings.")
                    return [generate_mock_embedding(t) for t in clean_texts]

        return [generate_mock_embedding(t) for t in clean_texts]

    def embed_query(self, query: str) -> List[float]:
        """Embeds a single query string for hybrid vector search."""
        results = self.embed_texts([query])
        return results[0] if results else generate_mock_embedding(query)

    def process_and_index_chunks(
        self,
        repo_id: str,
        chunks: List[CodeChunk],
    ) -> int:
        """
        Batch embeds CodeChunks in groups of 50, updates database records with embeddings,
        cleans up the cloned disk directory in /tmp/codeatlas/{repo_id}, and sets status to 'completed'.
        """
        db = get_db()
        total_chunks = len(chunks)
        logger.info(f"Generating embeddings for {total_chunks} chunks in batches of {BATCH_SIZE}...")

        embedded_chunks_count = 0

        for i in range(0, total_chunks, BATCH_SIZE):
            batch = chunks[i : i + BATCH_SIZE]
            texts_to_embed = [c.content for c in batch]
            embeddings = self.embed_texts(texts_to_embed)

            # Store embeddings directly in database
            db.save_code_chunks_with_embeddings(repo_id, batch, embeddings)
            embedded_chunks_count += len(batch)
            logger.info(f"Indexed chunks {embedded_chunks_count}/{total_chunks} for repo {repo_id}")

        # Clean up temporary cloned repository from disk
        storage_base = self.settings.get_storage_path()
        target_dir = storage_base / repo_id
        if target_dir.exists():
            try:
                shutil.rmtree(target_dir, ignore_errors=True)
                logger.info(f"Cleaned up disk cache for repo {repo_id} at {target_dir}")
            except Exception as e:
                logger.warning(f"Could not delete temp directory {target_dir}: {e}")

        # Mark repository status as completed
        db.update_repository(repo_id=repo_id, updates={"status": RepoStatus.COMPLETED.value})
        logger.info(f"Repository {repo_id} marked as COMPLETED.")

        return embedded_chunks_count


_embedding_service_instance: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance


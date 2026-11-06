import math
import pytest

from app.services.embedding_service import EmbeddingService, generate_mock_embedding, EMBEDDING_DIM


def test_mock_embedding_dimensions_and_norm():
    vec = generate_mock_embedding("def calculate_tax(): pass")
    assert len(vec) == EMBEDDING_DIM
    assert len(vec) == 768

    # L2 norm should be ~1.0
    norm = math.sqrt(sum(x * x for x in vec))
    assert pytest.approx(norm, 0.01) == 1.0


def test_embedding_service_batch_embedding():
    service = EmbeddingService()
    texts = [
        "export function add(a, b) { return a + b; }",
        "class UserModel { constructor() {} }",
        "import React from 'react';",
    ]
    embeddings = service.embed_texts(texts)
    assert len(embeddings) == 3
    for emb in embeddings:
        assert len(emb) == 768


def test_embedding_service_query():
    service = EmbeddingService()
    query_emb = service.embed_query("how does user authentication work?")
    assert len(query_emb) == 768


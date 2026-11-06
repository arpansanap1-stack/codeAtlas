-- ==============================================================================
-- CodeAtlas Database Schema
-- Target: PostgreSQL with pgvector extension (Supabase compatible)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_url TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'cloning', 'parsing', 'indexing', 'completed', 'failed')),
    directory_tree TEXT,
    graph_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching repositories by URL and status
CREATE INDEX IF NOT EXISTS idx_repositories_repo_url ON repositories(repo_url);
CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories(status);

-- 3. Code Chunks table (AST-parsed chunks with full-text search and embeddings)
CREATE TABLE IF NOT EXISTS code_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    symbol_name TEXT,
    chunk_type TEXT NOT NULL,
    start_line INT NOT NULL,
    end_line INT NOT NULL,
    content TEXT NOT NULL,
    fts TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(symbol_name, '') || ' ' || coalesce(file_path, '') || ' ' || coalesce(content, ''))
    ) STORED,
    embedding VECTOR(768)
);

-- Indexes for code_chunks table
CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_id ON code_chunks(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path ON code_chunks(repo_id, file_path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_fts ON code_chunks USING GIN(fts);

-- Vector similarity index using HNSW (Cosine Distance for 768-dim embeddings)
CREATE INDEX IF NOT EXISTS idx_code_chunks_embedding 
    ON code_chunks 
    USING hnsw (embedding vector_cosine_ops);

-- 4. Repository Files table (stores complete file contents for frontend code viewer)
CREATE TABLE IF NOT EXISTS repository_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_repository_files_lookup ON repository_files(repo_id, file_path);

-- 5. Onboarding Docs table (Markdown + Mermaid generated guides)
CREATE TABLE IF NOT EXISTS onboarding_docs (
    repo_id UUID PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
    markdown_content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_onboarding_docs_timestamp ON onboarding_docs;
CREATE TRIGGER trg_update_onboarding_docs_timestamp
    BEFORE UPDATE ON onboarding_docs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 6. Hybrid Search RPC: Reciprocal Rank Fusion (RRF)
-- Combines pgvector cosine similarity with PostgreSQL Full-Text Search (TSVECTOR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION match_code_chunks_hybrid(
    query_embedding VECTOR(768),
    query_text TEXT,
    target_repo_id UUID,
    match_count INT DEFAULT 8,
    rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    repo_id UUID,
    file_path TEXT,
    symbol_name TEXT,
    chunk_type TEXT,
    start_line INT,
    end_line INT,
    content TEXT,
    similarity FLOAT,
    rank_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT
            cc.id,
            (1.0 - (cc.embedding <=> query_embedding))::FLOAT AS sim,
            ROW_NUMBER() OVER (ORDER BY cc.embedding <=> query_embedding) AS rank
        FROM code_chunks cc
        WHERE cc.repo_id = target_repo_id
          AND cc.embedding IS NOT NULL
        LIMIT match_count * 2
    ),
    keyword_search AS (
        SELECT
            cc.id,
            ts_rank(cc.fts, plainto_tsquery('english', query_text))::FLOAT AS rank_score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank(cc.fts, plainto_tsquery('english', query_text)) DESC
            ) AS rank
        FROM code_chunks cc
        WHERE cc.repo_id = target_repo_id
          AND cc.fts @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 2
    ),
    fused AS (
        SELECT
            COALESCE(s.id, k.id) AS chunk_id,
            COALESCE(s.sim, 0.0) AS sim,
            (
                COALESCE(1.0 / (rrf_k + s.rank), 0.0) +
                COALESCE(1.0 / (rrf_k + k.rank), 0.0)
            ) AS rrf_score
        FROM semantic_search s
        FULL OUTER JOIN keyword_search k ON s.id = k.id
    )
    SELECT
        cc.id,
        cc.repo_id,
        cc.file_path,
        cc.symbol_name,
        cc.chunk_type,
        cc.start_line,
        cc.end_line,
        cc.content,
        f.sim::FLOAT AS similarity,
        f.rrf_score::FLOAT AS rank_score
    FROM fused f
    JOIN code_chunks cc ON cc.id = f.chunk_id
    ORDER BY f.rrf_score DESC
    LIMIT match_count;
END;
$$;

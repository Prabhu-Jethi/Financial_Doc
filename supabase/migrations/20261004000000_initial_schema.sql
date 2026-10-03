-- ====================================================================
-- Initial Schema for Financial Document Intelligence Engine
-- Step 3: Storage and Schema Definition (Architecture.md § 6 & Trd.md § 6)
-- ====================================================================

-- 1. Enable pgvector extension for dense embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Corpus Versions (Tracks indexing versions and publication states)
CREATE TABLE IF NOT EXISTS corpus_versions (
    version_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'ready', 'retired')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Documents (Filing metadata, hashes, filing dates, and paths)
CREATE TABLE IF NOT EXISTS documents (
    document_id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    ticker TEXT NOT NULL,
    report_type TEXT NOT NULL,
    report_fiscal_year INTEGER NOT NULL,
    period_ended DATE,
    filing_date DATE,
    source_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    file_hash_sha256 TEXT NOT NULL UNIQUE,
    parse_version TEXT NOT NULL DEFAULT 'v1.0-unparsed',
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'parsing', 'ready', 'needs_review', 'failed')),
    warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Pages (Physical PDF page index vs. printed page labels)
CREATE TABLE IF NOT EXISTS pages (
    page_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    physical_page_index INTEGER NOT NULL,
    printed_page TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_page UNIQUE (document_id, physical_page_index)
);

-- 5. Tables (Structured tables extracted from Item 7 & Item 8)
CREATE TABLE IF NOT EXISTS tables (
    table_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    page_id TEXT REFERENCES pages(page_id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    section TEXT,
    printed_page TEXT,
    currency TEXT DEFAULT 'USD',
    scale TEXT,
    headers JSONB DEFAULT '[]'::jsonb,
    raw_matrix JSONB DEFAULT '[]'::jsonb,
    footnote_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Cells (Atomic cell coordinates, raw values, and normalized decimals)
CREATE TABLE IF NOT EXISTS cells (
    cell_id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables(table_id) ON DELETE CASCADE,
    row_idx INTEGER NOT NULL,
    col_idx INTEGER NOT NULL,
    raw_value TEXT,
    normalized_decimal NUMERIC,
    header_path TEXT,
    period_label TEXT,
    unit TEXT,
    CONSTRAINT uq_table_cell UNIQUE (table_id, row_idx, col_idx)
);

-- 7. Verified Financial Facts (Canonical audited metrics with period and cell evidence)
CREATE TABLE IF NOT EXISTS facts (
    fact_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    canonical_metric TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    reporting_period TEXT NOT NULL,
    reported_value TEXT NOT NULL,
    normalized_decimal NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    scale TEXT NOT NULL DEFAULT 'millions',
    statement_scope TEXT,
    cell_id TEXT REFERENCES cells(cell_id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('candidate', 'verified', 'needs_review', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Chunks (Bounded narrative passages & table row groups with vector embeddings)
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    page_id TEXT REFERENCES pages(page_id) ON DELETE SET NULL,
    table_id TEXT REFERENCES tables(table_id) ON DELETE SET NULL,
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('narrative', 'table_row_group', 'section_header')),
    content TEXT NOT NULL,
    embedding vector(1536), -- Standard embedding dimensions
    metadata JSONB DEFAULT '{}'::jsonb,
    corpus_version TEXT REFERENCES corpus_versions(version_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Persisted Answers (Audit trail of generated query answers)
CREATE TABLE IF NOT EXISTS answers (
    answer_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('answered', 'partial', 'needs_clarification', 'insufficient_evidence', 'out_of_scope')),
    question TEXT NOT NULL,
    company TEXT NOT NULL,
    reporting_periods JSONB DEFAULT '[]'::jsonb,
    answer_text TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    fact_ids JSONB DEFAULT '[]'::jsonb,
    missing_information JSONB DEFAULT '[]'::jsonb,
    corpus_version TEXT,
    model_version TEXT,
    timings_ms JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Auditable Calculation Ledger (Explicit formulas, operands, and results per rules.md § 5)
CREATE TABLE IF NOT EXISTS calculations (
    calculation_id TEXT PRIMARY KEY,
    answer_id TEXT REFERENCES answers(answer_id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    formula TEXT NOT NULL,
    operands JSONB NOT NULL,
    raw_computed_value NUMERIC NOT NULL,
    display_value TEXT NOT NULL,
    unit TEXT NOT NULL,
    rounding TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_pages_doc ON pages(document_id);
CREATE INDEX IF NOT EXISTS idx_tables_doc ON tables(document_id);
CREATE INDEX IF NOT EXISTS idx_cells_table ON cells(table_id);
CREATE INDEX IF NOT EXISTS idx_facts_doc_metric ON facts(document_id, canonical_metric);
CREATE INDEX IF NOT EXISTS idx_facts_period ON facts(reporting_period);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_answers_req ON answers(request_id);

-- ============================================================================
-- SUPABASE POSTGRESQL MIGRATION: HARDEN ROW LEVEL SECURITY & TENANT ISOLATION
-- Fixes overly permissive documents policy and enables RLS on all core tables
-- ============================================================================

-- 1. Ensure user_id column exists on documents and make hash uniqueness per-tenant
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- Replace global file_hash_sha256 uniqueness with per-user uniqueness so
-- two users uploading the same PDF do not collide or leak each other's doc_id
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_file_hash_sha256_key;
DROP INDEX IF EXISTS idx_documents_hash;
CREATE INDEX IF NOT EXISTS idx_documents_hash ON public.documents(file_hash_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_public_hash
    ON public.documents (file_hash_sha256) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_user_hash
    ON public.documents (user_id, file_hash_sha256) WHERE user_id IS NOT NULL;

-- 2. Replace permissive documents SELECT policy with strict owner + public SEC isolation
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read curated documents" ON public.documents;
DROP POLICY IF EXISTS "Users read public filings or own uploads" ON public.documents;
DROP POLICY IF EXISTS "Guests read public filings only" ON public.documents;

-- Authenticated users can only read public SEC benchmark filings OR their own uploads
CREATE POLICY "Users read public filings or own uploads"
ON public.documents
FOR SELECT
TO authenticated
USING (
    (source_url != 'user_upload' AND LEFT(document_id, 4) != 'doc_' AND user_id IS NULL)
    OR auth.uid()::text = user_id::text
);

-- Unauthenticated guests (anon) can ONLY read public SEC benchmark filings
CREATE POLICY "Guests read public filings only"
ON public.documents
FOR SELECT
TO anon
USING (
    source_url != 'user_upload' AND LEFT(document_id, 4) != 'doc_' AND user_id IS NULL
);

-- Keep service_role full management on documents
DROP POLICY IF EXISTS "Service role manages curated documents" ON public.documents;
CREATE POLICY "Service role manages curated documents"
ON public.documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Enable RLS on all remaining core tables so direct PostgREST access cannot bypass FastAPI
ALTER TABLE public.corpus_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Restrict direct table access to backend service_role only
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'corpus_versions',
        'pages',
        'tables',
        'cells',
        'facts',
        'chunks',
        'answers',
        'calculations'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %I" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Service role full access on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END $$;

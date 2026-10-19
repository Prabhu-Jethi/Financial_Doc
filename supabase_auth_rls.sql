-- ============================================================================
-- SUPABASE POSTGRESQL MIGRATION: AUTHENTICATION, OWNERSHIP & ROW LEVEL SECURITY
-- Enforces User-Isolated Query History & Authenticated Curated Document Access
-- ============================================================================

-- 1. Create User-Owned Query History Table
CREATE TABLE IF NOT EXISTS public.user_query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    question TEXT NOT NULL,
    company TEXT DEFAULT 'All',
    reporting_periods TEXT[] DEFAULT ARRAY[]::TEXT[],
    answer_text TEXT,
    citations JSONB DEFAULT '[]'::jsonb,
    calculations JSONB DEFAULT '[]'::jsonb,
    timings_ms JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for high-speed chronological history fetching per user
CREATE INDEX IF NOT EXISTS idx_user_query_history_user_created 
ON public.user_query_history(user_id, created_at DESC);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_query_history ENABLE ROW LEVEL SECURITY;

-- 3. Enforce Strict User Ownership Policies (No User A can see User B's history)
DROP POLICY IF EXISTS "Users can only read own query history" ON public.user_query_history;
CREATE POLICY "Users can only read own query history"
ON public.user_query_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own query history" ON public.user_query_history;
CREATE POLICY "Users can only insert own query history"
ON public.user_query_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete own query history" ON public.user_query_history;
CREATE POLICY "Users can only delete own query history"
ON public.user_query_history
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Secure Shared Curated Reports & Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Curated documents are readable by any authenticated user
DROP POLICY IF EXISTS "Authenticated users can read curated documents" ON public.documents;
CREATE POLICY "Authenticated users can read curated documents"
ON public.documents
FOR SELECT
TO authenticated
USING (true);

-- Only elevated service_role can ingest new curated filings
DROP POLICY IF EXISTS "Service role manages curated documents" ON public.documents;
CREATE POLICY "Service role manages curated documents"
ON public.documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Enable Real-Time Replication for User Query History
-- Allows multiple browser tabs or devices to sync query history instantaneously
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'user_query_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_query_history;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
--  Scholr — db/application_tracker.sql
--  Admission Application Tracker (MVP) Database migration
-- ═══════════════════════════════════════════════════════════

-- 1. Create the parent_application_progress table
CREATE TABLE IF NOT EXISTS public.parent_application_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_identifier TEXT,
  status TEXT DEFAULT 'exploring',
  checklist_progress JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_identifier, school_id)
);

COMMENT ON TABLE public.parent_application_progress IS
  'Scholr — Parent admission progress logs, document statuses, and checklist markers per device.';

-- 2. Enable Row Level Security (RLS) for anon/auth future compatibility
ALTER TABLE public.parent_application_progress ENABLE ROW LEVEL SECURITY;

-- 3. Set up RLS Policies
DROP POLICY IF EXISTS "Allow public select on parent_application_progress" ON public.parent_application_progress;
CREATE POLICY "Allow public select on parent_application_progress"
  ON public.parent_application_progress FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on parent_application_progress" ON public.parent_application_progress;
CREATE POLICY "Allow public insert on parent_application_progress"
  ON public.parent_application_progress FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on parent_application_progress" ON public.parent_application_progress;
CREATE POLICY "Allow public update on parent_application_progress"
  ON public.parent_application_progress FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on parent_application_progress" ON public.parent_application_progress;
CREATE POLICY "Allow public delete on parent_application_progress"
  ON public.parent_application_progress FOR DELETE
  TO anon, authenticated USING (true);

-- 4. High-Performance Indices
CREATE INDEX IF NOT EXISTS idx_parent_progress_user ON public.parent_application_progress (user_identifier);
CREATE INDEX IF NOT EXISTS idx_parent_progress_school ON public.parent_application_progress (school_id);

-- ═══════════════════════════════════════════════════════════
--  Scholr — saved_schools table (Level 5)
--  Run this in: Supabase Dashboard > SQL Editor > New Query
--  This enables active school shortlists, decision states, and
--  custom user notes for each saved school.
-- ═══════════════════════════════════════════════════════════

-- Create the saved_schools table
CREATE TABLE IF NOT EXISTS public.saved_schools (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  device_id           TEXT          NOT NULL,
  decision_status     TEXT          NOT NULL DEFAULT 'exploring' CHECK (decision_status IN ('exploring', 'preferred', 'backup', 'rejected')),
  saved_school_notes  TEXT,
  decision_tags       TEXT[],
  shortlist_rank      INTEGER,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, school_id)
);

-- Documentation comment
COMMENT ON TABLE public.saved_schools IS
  'Scholr — Tracks user shortlisted schools, decision statuses, custom notes, and rankings per device.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_schools ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon) to select saved schools (we will filter by device_id in JS)
CREATE POLICY "Allow public select on saved_schools"
  ON public.saved_schools FOR SELECT
  TO anon USING (true);

-- Allow anyone (anon) to insert a new saved school
CREATE POLICY "Allow public insert on saved_schools"
  ON public.saved_schools FOR INSERT
  TO anon WITH CHECK (true);

-- Allow anyone (anon) to update their saved school metadata
CREATE POLICY "Allow public update on saved_schools"
  ON public.saved_schools FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Allow anyone (anon) to delete a saved school link
CREATE POLICY "Allow public delete on saved_schools"
  ON public.saved_schools FOR DELETE
  TO anon USING (true);

-- Create index for faster lookups by device_id and school_id
CREATE INDEX IF NOT EXISTS idx_saved_schools_device_id ON public.saved_schools (device_id);
CREATE INDEX IF NOT EXISTS idx_saved_schools_school_id ON public.saved_schools (school_id);

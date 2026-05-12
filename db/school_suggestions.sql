-- ═══════════════════════════════════════════════════════════
--  Scholr — school_suggestions table
--  Run this in: Supabase Dashboard > SQL Editor > New Query
--  This enables the "Suggest a School" and "Suggest an Update"
--  community feedback flows.
-- ═══════════════════════════════════════════════════════════

-- school_suggestions: captures new school suggestions from users
CREATE TABLE IF NOT EXISTS public.school_suggestions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name   TEXT          NOT NULL,
  city          TEXT          NOT NULL,
  website       TEXT,
  submitter_email TEXT,
  status        TEXT          NOT NULL DEFAULT 'pending',  -- pending | reviewed | added | rejected
  submitted_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  notes         TEXT
);

COMMENT ON TABLE public.school_suggestions IS
  'Scholr — community-submitted school suggestions awaiting review.';

-- suggestions: captures "Suggest an Update" corrections for existing schools
CREATE TABLE IF NOT EXISTS public.suggestions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID          REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name   TEXT          NOT NULL,
  type          TEXT          NOT NULL,   -- fees | facilities | contact | admission | general | other
  detail        TEXT          NOT NULL,
  email         TEXT,
  status        TEXT          NOT NULL DEFAULT 'pending',  -- pending | reviewed | applied | rejected
  submitted_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

COMMENT ON TABLE public.suggestions IS
  'Scholr — community-submitted corrections and updates for existing school profiles.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.school_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions         ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon role) to INSERT new suggestions — but not read or modify others'.
CREATE POLICY "Allow public insert on school_suggestions"
  ON public.school_suggestions FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Allow public insert on suggestions"
  ON public.suggestions FOR INSERT
  TO anon WITH CHECK (true);

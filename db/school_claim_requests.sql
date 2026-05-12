-- ═══════════════════════════════════════════════════════════
--  Scholr — school_claim_requests table
--  Run this in: Supabase Dashboard > SQL Editor > New Query
--  This enables the "Claim This School" flow for Level 2.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.school_claim_requests (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which school is being claimed
  school_id         UUID          REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name       TEXT          NOT NULL,

  -- Claimant contact info
  contact_name      TEXT,                     -- optional — "Your name"
  official_email    TEXT          NOT NULL,   -- required — must be school domain preferred
  contact_phone     TEXT          NOT NULL,   -- required — direct number
  designation       TEXT          NOT NULL,   -- Principal | Director | Administrator | Other

  -- Optional verification hint from submitter
  verification_note TEXT,                     -- e.g. "school website link, admin portal"

  -- Submission metadata
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  status            TEXT          NOT NULL DEFAULT 'pending',  -- pending | approved | rejected

  -- Moderation fields (admin fills these)
  reviewed          BOOLEAN       NOT NULL DEFAULT FALSE,
  approved          BOOLEAN,                  -- null = not yet decided
  reviewed_at       TIMESTAMPTZ,
  reviewer_notes    TEXT
);

COMMENT ON TABLE public.school_claim_requests IS
  'Scholr — requests from school administrators to claim and manage their school profile.';

-- Row Level Security
ALTER TABLE public.school_claim_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can submit a claim, but cannot read other claims
CREATE POLICY "Allow public insert on school_claim_requests"
  ON public.school_claim_requests FOR INSERT
  TO anon WITH CHECK (true);

-- ── Optional: index for quick lookup by school + status ──────
CREATE INDEX IF NOT EXISTS idx_claim_requests_school_id
  ON public.school_claim_requests (school_id);

CREATE INDEX IF NOT EXISTS idx_claim_requests_status
  ON public.school_claim_requests (status);

-- Add is_claimed flag to schools table for the trust indicator
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT false;

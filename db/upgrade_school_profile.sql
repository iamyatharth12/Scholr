-- ═══════════════════════════════════════════════════════════
--  Scholr — School Profile Upgrade Migration
--  Run in: Supabase Dashboard > SQL Editor > New Query
--
--  Adds: website, phone, email, maps_link,
--        admissions_open, verified, updated_at
-- ═══════════════════════════════════════════════════════════

-- 1. Add new contact columns (idempotent — safe to run multiple times)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS maps_link      TEXT,
  ADD COLUMN IF NOT EXISTS admissions_open BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- 2. Back-fill verified from existing data_source column
UPDATE public.schools
SET verified = TRUE
WHERE data_source ILIKE 'verified'
  AND verified IS DISTINCT FROM TRUE;

-- 3. Back-fill updated_at from last_updated (if exists)
UPDATE public.schools
SET updated_at = last_updated
WHERE last_updated IS NOT NULL
  AND updated_at IS NULL;

-- 4. Sample: fill in contact details for existing schools
--    Replace UUIDs with actual IDs from your Supabase table.
--    (Run SELECT id, name FROM schools; first to get IDs)

-- Example — Don Bosco School (replace with real UUID):
-- UPDATE public.schools
-- SET
--   website        = 'https://donboscoguwahati.in',
--   phone          = '+91 361 266 0801',
--   email          = 'info@donboscoguwahati.in',
--   admissions_open = TRUE
-- WHERE name = 'Don Bosco School' AND city = 'Guwahati';

-- Example — DPS Guwahati:
-- UPDATE public.schools
-- SET
--   website        = 'https://www.dpsguwahati.com',
--   phone          = '+91 361 284 0800',
--   admissions_open = FALSE
-- WHERE name = 'Delhi Public School Guwahati';


-- 5. Comment
COMMENT ON COLUMN public.schools.website         IS 'Official school website URL';
COMMENT ON COLUMN public.schools.phone           IS 'Primary contact phone number';
COMMENT ON COLUMN public.schools.email           IS 'Official contact email address';
COMMENT ON COLUMN public.schools.maps_link       IS 'Google Maps link (overrides auto-generated one)';
COMMENT ON COLUMN public.schools.admissions_open IS 'TRUE = open, FALSE = closed, NULL = unknown';
COMMENT ON COLUMN public.schools.verified        IS 'TRUE if Scholr team has verified this record';
COMMENT ON COLUMN public.schools.updated_at      IS 'Timestamp of last data update';

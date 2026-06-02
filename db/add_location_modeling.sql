-- ═══════════════════════════════════════════════════════════
--  Scholr — Local Discovery Location Modeling Upgrade
--  Run this in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- 1. ADD COLUMNS (Safe, idempotent alters)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state    TEXT DEFAULT 'Assam',
  ADD COLUMN IF NOT EXISTS country  TEXT DEFAULT 'India';

-- 2. COMMENTS
COMMENT ON COLUMN public.schools.district IS 'Local district (e.g., Kamrup Metropolitan, Nagaon, Sonitpur)';
COMMENT ON COLUMN public.schools.state    IS 'State region (default Assam)';
COMMENT ON COLUMN public.schools.country  IS 'Country (default India)';

-- 3. BACK-FILL: Populate geographical metadata for all target cities
--    Guwahati Schools
UPDATE public.schools
SET 
  district = 'Kamrup Metropolitan',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Guwahati';

--    Nagaon Schools
UPDATE public.schools
SET 
  district = 'Nagaon',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Nagaon';

--    Tezpur / Sonitpur Schools
UPDATE public.schools
SET 
  district = 'Sonitpur',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Tezpur' OR city ILIKE 'Sonitpur';

--    Dibrugarh Schools
UPDATE public.schools
SET 
  district = 'Dibrugarh',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Dibrugarh';

--    Jorhat Schools
UPDATE public.schools
SET 
  district = 'Jorhat',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Jorhat';

--    Silchar Schools
UPDATE public.schools
SET 
  district = 'Cachar',
  state = 'Assam',
  country = 'India'
WHERE city ILIKE 'Silchar';

-- 4. CLEANUP SANITY CHECK
--    Ensure defaults are set for any other unassigned records
UPDATE public.schools
SET state = 'Assam' WHERE state IS NULL;

UPDATE public.schools
SET country = 'India' WHERE country IS NULL;

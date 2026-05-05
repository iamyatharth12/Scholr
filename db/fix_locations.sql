-- ═══════════════════════════════════════════════════════════
-- Scholr — Location Cleanup Script
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- This script normalizes the location column by extracting
-- only the Area (the part before the first comma) and trimming spaces.
-- Example: "Panbazar, Guwahati" -> "Panbazar"

UPDATE public.schools
SET location = TRIM(SPLIT_PART(location, ',', 1))
WHERE location LIKE '%,%';

-- Verification Query:
-- Run this to verify the locations look correct:
-- SELECT id, name, location, city FROM public.schools;

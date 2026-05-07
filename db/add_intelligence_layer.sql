-- ═══════════════════════════════════════════════════════════
--  Scholr — School Intelligence Layer Migration
--  Run in: Supabase Dashboard > SQL Editor > New Query
--
--  Adds: best_for (text[]), smart_summary (text),
--        fee_category (text)
-- ═══════════════════════════════════════════════════════════

-- 1. Add new intelligence columns (safe to re-run)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS best_for      TEXT[],
  ADD COLUMN IF NOT EXISTS smart_summary TEXT,
  ADD COLUMN IF NOT EXISTS fee_category  TEXT;

-- 2. Comments
COMMENT ON COLUMN public.schools.best_for      IS 'Array of recommendation tags e.g. {Best for Academics, Strong Sports Culture}';
COMMENT ON COLUMN public.schools.smart_summary IS 'Concise, neutral summary of the school strengths for parents';
COMMENT ON COLUMN public.schools.fee_category  IS 'Budget Friendly | Mid Range | Premium';

-- 3. Back-fill fee_category from existing fees column
UPDATE public.schools
SET fee_category = CASE
  WHEN fees ~ '^₹?([0-9]+)k' AND
       (REGEXP_MATCH(fees, '^₹?([0-9]+)k'))[1]::int < 25   THEN 'Budget Friendly'
  WHEN fees ~ '^₹?([0-9]+)k' AND
       (REGEXP_MATCH(fees, '^₹?([0-9]+)k'))[1]::int <= 75  THEN 'Mid Range'
  WHEN fees ~ '^₹?([0-9.]+)L'                              THEN 'Premium'
  ELSE 'Mid Range'
END
WHERE fee_category IS NULL;

-- 4. Seed sample best_for + smart_summary data
--    (update names to match your actual school names)

UPDATE public.schools SET
  best_for = ARRAY['Best for Academics', 'Discipline Focused', 'Good Transport Access'],
  smart_summary = 'ICSE school with a strong emphasis on holistic development and academic discipline. Suitable for parents who value structured learning, extracurricular diversity, and an established institutional reputation.'
WHERE name = 'Don Bosco School' AND city = 'Guwahati';

UPDATE public.schools SET
  best_for = ARRAY['Best for Academics', 'Modern Infrastructure', 'Good Transport Access'],
  smart_summary = 'CBSE school with modern campus infrastructure and a competitive academic environment. A practical choice for parents seeking a structured curriculum with strong co-curricular opportunities.'
WHERE name = 'Delhi Public School Guwahati';

UPDATE public.schools SET
  best_for = ARRAY['Budget Friendly', 'Good Transport Access'],
  smart_summary = 'Government-aided CBSE school offering quality education at an accessible fee point. Consistently performs well in board results and caters primarily to central government employees'' families.'
WHERE name = 'Kendriya Vidyalaya No. 1 Guwahati';

UPDATE public.schools SET
  best_for = ARRAY['Best for Academics', 'Discipline Focused'],
  smart_summary = 'CBSE school that integrates transcendental meditation with mainstream academics. Suitable for parents interested in a values-based environment with a focus on mental wellness and disciplined routines.'
WHERE name = 'Maharishi Vidya Mandir';

UPDATE public.schools SET
  best_for = ARRAY['Strong Sports Culture', 'Large Campus', 'Modern Infrastructure'],
  smart_summary = 'Co-educational boarding school set on a sprawling campus in Northeast India. Offers a wide range of sports and extracurricular programmes. Best suited for families open to a full-time residential schooling model.'
WHERE name = 'Assam Valley School';

UPDATE public.schools SET
  best_for = ARRAY['Budget Friendly'],
  smart_summary = 'CBSE day school with a focus on academic discipline and affordability. A solid neighbourhood option for families prioritising consistent board performance without a premium fee structure.'
WHERE name = 'South Point School';

UPDATE public.schools SET
  best_for = ARRAY['Discipline Focused', 'Modern Infrastructure'],
  smart_summary = 'Northeast India''s first day-boarding school, blending structured daily routines with modern facilities. A good fit for parents who want supervision-intensive schooling without full residential commitment.'
WHERE name = 'Sanskriti The Gurukul';

UPDATE public.schools SET
  best_for = ARRAY['Budget Friendly'],
  smart_summary = 'State board school offering a straightforward curriculum at a low cost. A practical choice for families prioritising affordability and proximity over premium facilities.'
WHERE name = 'Pathfinder Higher Secondary School';

UPDATE public.schools SET
  best_for = ARRAY['Best for Academics', 'Good Transport Access'],
  smart_summary = 'Established CBSE institution with a track record of strong board results. Well-suited for parents seeking a balance of academic rigour, co-curricular activities, and reliable transport logistics.'
WHERE name = 'Birla Public School';

UPDATE public.schools SET
  best_for = ARRAY['Budget Friendly', 'Discipline Focused'],
  smart_summary = 'Value-driven CBSE school rooted in the ideals of Swami Vivekananda. Suitable for families who appreciate a culturally conscious environment with an emphasis on character building alongside academics.'
WHERE name = 'Vivekananda Kendra Vidyalaya';

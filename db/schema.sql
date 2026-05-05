-- ═══════════════════════════════════════════════════════════
--  Scholr — schools table
--  Run this in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- 1. ENABLE the pgcrypto extension (needed for gen_random_uuid)
--    Supabase enables this by default, but included for safety.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- 2. CREATE the schools table
CREATE TABLE IF NOT EXISTS public.schools (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL,
  city        TEXT          NOT NULL,
  location    TEXT,
  board       TEXT,
  fees        TEXT,
  distance    TEXT,
  rating      FLOAT,
  tags        TEXT[],
  description TEXT,
  facilities  TEXT[],
  last_updated TIMESTAMPTZ  DEFAULT NOW(),
  data_source TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- 3. OPTIONAL: add a comment for documentation
COMMENT ON TABLE public.schools IS
  'Scholr — directory of schools with board, fees, rating, location data, and extended metadata.';


-- ═══════════════════════════════════════════════════════════
--  SEED DATA — 10 real schools in Guwahati, Assam
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.schools
  (name, city, location, board, fees, distance, rating, tags, description, facilities, last_updated, data_source)
VALUES
  (
    'Don Bosco School',
    'Guwahati',
    'Maligaon',
    'ICSE',
    '₹40k–₹70k/yr',
    '2.1 km',
    4.7,
    ARRAY['Top Rated', 'Popular', 'Est. 1957'],
    'Don Bosco School is a premier English medium educational institution managed by the Salesians of Don Bosco, known for holistic development and academic excellence since its inception.',
    ARRAY['Smart Classrooms', 'Library', 'Sports Ground', 'Computer Lab', 'Transport'],
    NOW(),
    'Verified'
  ),
  (
    'Delhi Public School Guwahati',
    'Guwahati',
    'Narengi',
    'CBSE',
    '₹55k–₹85k/yr',
    '5.4 km',
    4.5,
    ARRAY['Top Rated', 'Popular'],
    'Delhi Public School Guwahati offers an environment that fosters intellectual and personal growth. It is committed to providing quality education in a highly competitive framework.',
    ARRAY['Air-Conditioned Classes', 'Swimming Pool', 'Digital Library', 'Hostel', 'Transport'],
    NOW(),
    'Verified'
  ),
  (
    'Kendriya Vidyalaya No. 1 Guwahati',
    'Guwahati',
    'Maligaon',
    'CBSE',
    '₹8k–₹20k/yr',
    '2.0 km',
    4.2,
    ARRAY['Budget Friendly', 'Government'],
    'KV No. 1 Guwahati is a premier government institution catering to the educational needs of children of transferable Central Government employees including Defence and Para-military personnel.',
    ARRAY['Library', 'Playground', 'Science Labs', 'Auditorium'],
    NOW(),
    'Verified'
  ),
  (
    'Maharishi Vidya Mandir',
    'Guwahati',
    'Six Mile',
    'CBSE',
    '₹30k–₹55k/yr',
    '4.8 km',
    4.3,
    ARRAY['Popular', 'Multi-Branch'],
    'Maharishi Vidya Mandir integrates modern education with traditional Indian values and transcendental meditation to ensure the complete development of student consciousness.',
    ARRAY['Smart Classrooms', 'Meditation Hall', 'Library', 'Sports Ground'],
    NOW() - INTERVAL '5 days',
    'Estimated'
  ),
  (
    'Assam Valley School',
    'Guwahati',
    'Balipara',
    'ICSE',
    '₹1.5L–₹2.5L/yr',
    '8.2 km',
    4.8,
    ARRAY['Top Rated', 'Boarding', 'Premium'],
    'The Assam Valley School is one of the most exclusive co-educational boarding schools in Northeast India, spread across a sprawling 270-acre campus equipped with world-class facilities.',
    ARRAY['Boarding', 'Equestrian Club', 'Golf Course', 'Robotics Lab', 'Swimming Pool'],
    NOW() - INTERVAL '2 days',
    'Verified'
  ),
  (
    'South Point School',
    'Guwahati',
    'Hatigaon',
    'CBSE',
    '₹25k–₹45k/yr',
    '3.3 km',
    4.1,
    ARRAY['Budget Friendly', 'Closest'],
    'South Point School focuses on delivering quality education with an emphasis on discipline, moral values, and academic rigor in a conducive learning environment.',
    ARRAY['Smart Classrooms', 'Library', 'Science Labs', 'Transport'],
    NOW() - INTERVAL '15 days',
    'Estimated'
  ),
  (
    'Sanskriti The Gurukul',
    'Guwahati',
    'Bhetapara',
    'CBSE',
    '₹45k–₹70k/yr',
    '3.9 km',
    4.4,
    ARRAY['Popular', 'Co-Ed'],
    'Sanskriti The Gurukul is Northeast India’s first day-boarding school, dedicated to providing a nurturing environment where students can discover their true potential.',
    ARRAY['Day Boarding', 'Cafeteria', 'Digital Library', 'Indoor Sports', 'Art Studio'],
    NOW() - INTERVAL '1 day',
    'Verified'
  ),
  (
    'Pathfinder Higher Secondary School',
    'Guwahati',
    'Dispur',
    'State',
    '₹12k–₹25k/yr',
    '1.5 km',
    3.8,
    ARRAY['Budget Friendly', 'State Board'],
    'Pathfinder Higher Secondary School offers a robust curriculum aligned with the state board, ensuring accessible and quality education for all its students.',
    ARRAY['Library', 'Playground', 'Computer Lab'],
    NOW() - INTERVAL '30 days',
    'Estimated'
  ),
  (
    'Birla Public School',
    'Guwahati',
    'Athgaon',
    'CBSE',
    '₹50k–₹80k/yr',
    '4.2 km',
    4.6,
    ARRAY['Top Rated', 'Est. 1985'],
    'Birla Public School stands as a beacon of quality education, blending modern pedagogical practices with strong traditional roots to shape the leaders of tomorrow.',
    ARRAY['Smart Classrooms', 'Library', 'Auditorium', 'Sports Ground', 'Transport'],
    NOW(),
    'Verified'
  ),
  (
    'Vivekananda Kendra Vidyalaya',
    'Guwahati',
    'Jalukbari',
    'CBSE',
    '₹15k–₹30k/yr',
    '2.7 km',
    4.0,
    ARRAY['Budget Friendly', 'Cultural Heritage'],
    'Vivekananda Kendra Vidyalaya operates with a vision to impart man-making and nation-building education based on the ideals of Swami Vivekananda.',
    ARRAY['Library', 'Science Labs', 'Yoga Hall', 'Playground'],
    NOW() - INTERVAL '12 days',
    'Estimated'
  );

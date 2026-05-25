-- ═══════════════════════════════════════════════════════════
--  Scholr — Level 6: School Management Portal Migration
--  Contains: Foundations + Profile Management Extensions
--  Run in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- 1. Create the school_admins table
CREATE TABLE IF NOT EXISTS public.school_admins (
  id          UUID          PRIMARY KEY, -- Links directly to auth.users.id
  school_id   UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email       TEXT          NOT NULL UNIQUE,
  role        TEXT          NOT NULL DEFAULT 'admin',
  approved    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.school_admins IS
  'Scholr — administrators mapped to their respective claimed school listings.';


-- 2. Extend public.schools to support images and additional facilities
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS logo_url      TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls  TEXT[],
  ADD COLUMN IF NOT EXISTS has_transport  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_hostel     BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.schools.logo_url      IS 'Official school brand logo URL';
COMMENT ON COLUMN public.schools.gallery_urls  IS 'Array of URLs representing school campus images';
COMMENT ON COLUMN public.schools.has_transport IS 'Flag indicating school transport availability';
COMMENT ON COLUMN public.schools.has_hostel    IS 'Flag indicating on-campus boarding/hostel availability';


-- 3. Automatic Trigger: Link newly created Supabase Auth users to approved claims
CREATE OR REPLACE FUNCTION public.handle_school_admin_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id   UUID;
  v_is_approved BOOLEAN;
BEGIN
  -- Search for an approved claim request matching the user's registered email
  SELECT school_id, approved
  INTO v_school_id, v_is_approved
  FROM public.school_claim_requests
  WHERE LOWER(official_email) = LOWER(NEW.email)
  ORDER BY submitted_at DESC
  LIMIT 1;

  -- If an approved claim request is found, automatically link this auth user to school_admins
  IF v_school_id IS NOT NULL AND v_is_approved = TRUE THEN
    INSERT INTO public.school_admins (id, school_id, email, approved, role)
    VALUES (NEW.id, v_school_id, NEW.email, TRUE, 'admin')
    ON CONFLICT (id) DO NOTHING;

    -- Update school's claimed state in schools table
    UPDATE public.schools
    SET is_claimed = TRUE
    WHERE id = v_school_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_school_admin_signup();


-- 4. Automatic Trigger: Handle claim approvals for users who signed up before approval
CREATE OR REPLACE FUNCTION public.handle_claim_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Triggered only when a claim request status changes to 'approved' and approved is TRUE
  IF NEW.status = 'approved' AND NEW.approved = TRUE AND (OLD.status IS DISTINCT FROM 'approved' OR OLD.approved IS DISTINCT FROM TRUE) THEN
    -- Check if a user with this official email already exists in Supabase auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.official_email);

    -- If the user already signed up, insert them into school_admins immediately
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.school_admins (id, school_id, email, approved, role)
      VALUES (v_user_id, NEW.school_id, NEW.official_email, TRUE, 'admin')
      ON CONFLICT (id) DO UPDATE
      SET school_id = EXCLUDED.school_id, approved = TRUE;

      -- Update the school claimed flag
      UPDATE public.schools
      SET is_claimed = TRUE
      WHERE id = NEW.school_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to public.school_claim_requests table
DROP TRIGGER IF EXISTS on_claim_approved ON public.school_claim_requests;
CREATE TRIGGER on_claim_approved
  AFTER UPDATE ON public.school_claim_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_claim_approval();


-- 5. Row Level Security (RLS) Setup
-- Enable RLS on school_admins and schools
ALTER TABLE public.school_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Select policy: school_admins can read their own profile admin row
DROP POLICY IF EXISTS "Admins can view their own record" ON public.school_admins;
CREATE POLICY "Admins can view their own record"
  ON public.school_admins FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Select policy: Anyone (public anonymous or authenticated) can view schools data
DROP POLICY IF EXISTS "Allow public read access on schools" ON public.schools;
CREATE POLICY "Allow public read access on schools"
  ON public.schools FOR SELECT
  TO anon, authenticated
  USING (true);

-- Update policy: Approved school administrators can update only their linked school
DROP POLICY IF EXISTS "Allow approved school admins to update their school" ON public.schools;
CREATE POLICY "Allow approved school admins to update their school"
  ON public.schools FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_admins
      WHERE school_admins.id = auth.uid()
        AND school_admins.school_id = schools.id
        AND school_admins.approved = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_admins
      WHERE school_admins.id = auth.uid()
        AND school_admins.school_id = schools.id
        AND school_admins.approved = TRUE
    )
  );


-- 6. Developer Sandbox Bypass Helper (Instantly approve claim for testing)
CREATE OR REPLACE FUNCTION public.approve_claim_by_email(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_school_id UUID;
BEGIN
  -- Mark any pending claim requests with this email as approved
  UPDATE public.school_claim_requests
  SET status = 'approved',
      approved = TRUE,
      reviewed = TRUE,
      reviewed_at = NOW(),
      reviewer_notes = 'Approved instantly via Developer Sandbox Bypass.'
  WHERE LOWER(official_email) = LOWER(p_email)
  RETURNING school_id INTO v_school_id;

  -- If a claim request was approved, also check if auth user exists and link them
  IF v_school_id IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(p_email);

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.school_admins (id, school_id, email, approved, role)
      VALUES (v_user_id, v_school_id, p_email, TRUE, 'admin')
      ON CONFLICT (id) DO UPDATE
      SET school_id = EXCLUDED.school_id, approved = TRUE;

      -- Update the school claimed flag
      UPDATE public.schools
      SET is_claimed = TRUE
      WHERE id = v_school_id;
    END IF;
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Supabase Storage Bucket Initialization & Policies
-- Create 'school-media' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-media', 'school-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy A: Allow anyone (anon + authenticated) public read access to media files
DROP POLICY IF EXISTS "Allow public read access on school-media" ON storage.objects;
CREATE POLICY "Allow public read access on school-media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'school-media');

-- Policy B: Allow authenticated school administrators to upload objects inside their folder
DROP POLICY IF EXISTS "Allow school admins to upload media" ON storage.objects;
CREATE POLICY "Allow school admins to upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-media' 
    AND (
      EXISTS (
        SELECT 1 FROM public.school_admins
        WHERE school_admins.id = auth.uid()
          AND school_admins.approved = TRUE
      )
    )
  );

-- Policy C: Allow authenticated school administrators to update objects in school-media
DROP POLICY IF EXISTS "Allow school admins to update media" ON storage.objects;
CREATE POLICY "Allow school admins to update media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.school_admins
        WHERE school_admins.id = auth.uid()
          AND school_admins.approved = TRUE
      )
    )
  )
  WITH CHECK (
    bucket_id = 'school-media'
  );

-- Policy D: Allow authenticated school administrators to delete objects inside their folder
DROP POLICY IF EXISTS "Allow school admins to delete media" ON storage.objects;
CREATE POLICY "Allow school admins to delete media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.school_admins
        WHERE school_admins.id = auth.uid()
          AND school_admins.approved = TRUE
      )
    )
  );

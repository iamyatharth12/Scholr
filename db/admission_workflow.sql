-- ═══════════════════════════════════════════════════════════
--  Scholr — Level 7: Admission Workflow System Migration
--  Run in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- 1. Extend public.schools to support admission contacts and configuration fields
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS apply_url               TEXT,
  ADD COLUMN IF NOT EXISTS admission_website       TEXT,
  ADD COLUMN IF NOT EXISTS admission_office_phone   TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_contact        TEXT,
  ADD COLUMN IF NOT EXISTS inquiry_form_url         TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_notes        TEXT,
  ADD COLUMN IF NOT EXISTS seat_availability        TEXT;

COMMENT ON COLUMN public.schools.apply_url             IS 'Direct web address to start school application form';
COMMENT ON COLUMN public.schools.admission_website     IS 'Specific admissions landing page URL';
COMMENT ON COLUMN public.schools.admission_office_phone IS 'Dedicated phone number for the admissions registrar office';
COMMENT ON COLUMN public.schools.whatsapp_contact      IS 'WhatsApp link or number for quick chat inquiries';
COMMENT ON COLUMN public.schools.inquiry_form_url      IS 'URL to digital lead inquiry or prospectus form';
COMMENT ON COLUMN public.schools.eligibility_notes     IS 'Age, marks, or background eligibility requirements for candidates';
COMMENT ON COLUMN public.schools.seat_availability     IS 'Optional seat capacity or vacancies remaining';


-- 2. Create the school_admission_requirements table
CREATE TABLE IF NOT EXISTS public.school_admission_requirements (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requirement_name  TEXT          NOT NULL,
  required          BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, requirement_name)
);

COMMENT ON TABLE public.school_admission_requirements IS
  'Scholr — School-specific lists of required documents (e.g. Birth Certificate, Aadhaar).';


-- 3. Create the parent_application_progress table
CREATE TABLE IF NOT EXISTS public.parent_application_progress (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_identifier     TEXT          NOT NULL, -- maps to the device ID (scholr_device_id)
  status              TEXT          NOT NULL DEFAULT 'Exploring',
  checklist_progress  JSONB         NOT NULL DEFAULT '{}'::JSONB, -- checkbox states for document checklist and steps
  notes               TEXT          DEFAULT '',
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_identifier, school_id)
);

COMMENT ON TABLE public.parent_application_progress IS
  'Scholr — Parent admission progress logs, document statuses, and checklist markers per device.';


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.school_admission_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_application_progress ENABLE ROW LEVEL SECURITY;


-- 5. Set up RLS Policies for parent_application_progress (permissive for lightweight anon storage)
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


-- 6. Set up RLS Policies for school_admission_requirements
DROP POLICY IF EXISTS "Allow public select on school_admission_requirements" ON public.school_admission_requirements;
CREATE POLICY "Allow public select on school_admission_requirements"
  ON public.school_admission_requirements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow approved school admins to modify requirements" ON public.school_admission_requirements;
CREATE POLICY "Allow approved school admins to modify requirements"
  ON public.school_admission_requirements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_admins
      WHERE school_admins.id = auth.uid()
        AND school_admins.school_id = school_admission_requirements.school_id
        AND school_admins.approved = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_admins
      WHERE school_admins.id = auth.uid()
        AND school_admins.school_id = school_admission_requirements.school_id
        AND school_admins.approved = TRUE
    )
  );

-- To facilitate easy sandbox developer testing, allow anon to configure requirements too if they want
DROP POLICY IF EXISTS "Allow public modifications for developer sandbox testing" ON public.school_admission_requirements;
CREATE POLICY "Allow public modifications for developer sandbox testing"
  ON public.school_admission_requirements FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);


-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parent_progress_user ON public.parent_application_progress (user_identifier);
CREATE INDEX IF NOT EXISTS idx_parent_progress_school ON public.parent_application_progress (school_id);
CREATE INDEX IF NOT EXISTS idx_admission_reqs_school ON public.school_admission_requirements (school_id);


-- 8. Redefine/Upgrade the apply_approved_update Moderation Trigger Function
CREATE OR REPLACE FUNCTION public.apply_approved_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Execute merging only when reviewed = TRUE and approved = TRUE
  IF NEW.reviewed = TRUE AND NEW.approved = TRUE AND (OLD.approved IS DISTINCT FROM TRUE OR OLD.reviewed IS DISTINCT FROM TRUE) THEN
    
    UPDATE public.schools
    SET
      name = COALESCE((NEW.payload->>'name'), name),
      board = COALESCE((NEW.payload->>'board'), board),
      fees = COALESCE((NEW.payload->>'fees'), fees),
      location = COALESCE((NEW.payload->>'location'), location),
      description = COALESCE((NEW.payload->>'description'), description),
      website = COALESCE((NEW.payload->>'website'), website),
      email = COALESCE((NEW.payload->>'email'), email),
      phone = COALESCE((NEW.payload->>'phone'), phone),
      maps_link = COALESCE((NEW.payload->>'maps_link'), maps_link),
      logo_url = COALESCE((NEW.payload->>'logo_url'), logo_url),
      
      -- Level 7 Admission Configuration columns
      apply_url = COALESCE((NEW.payload->>'apply_url'), apply_url),
      admission_website = COALESCE((NEW.payload->>'admission_website'), admission_website),
      admission_office_phone = COALESCE((NEW.payload->>'admission_office_phone'), admission_office_phone),
      whatsapp_contact = COALESCE((NEW.payload->>'whatsapp_contact'), whatsapp_contact),
      inquiry_form_url = COALESCE((NEW.payload->>'inquiry_form_url'), inquiry_form_url),
      eligibility_notes = COALESCE((NEW.payload->>'eligibility_notes'), eligibility_notes),
      seat_availability = COALESCE((NEW.payload->>'seat_availability'), seat_availability),
      
      admissions_open = CASE 
        WHEN (NEW.payload->'admissions_open') IS NOT NULL 
        THEN (NEW.payload->'admissions_open')::BOOLEAN 
        ELSE admissions_open 
      END,
      
      application_start_date = CASE 
        WHEN (NEW.payload->'application_start_date') IS NOT NULL AND (NEW.payload->>'application_start_date') IS DISTINCT FROM ''
        THEN (NEW.payload->>'application_start_date')::DATE 
        ELSE application_start_date 
      END,
      
      application_deadline = CASE 
        WHEN (NEW.payload->'application_deadline') IS NOT NULL AND (NEW.payload->>'application_deadline') IS DISTINCT FROM ''
        THEN (NEW.payload->>'application_deadline')::DATE 
        ELSE application_deadline 
      END,
      
      interview_date = CASE 
        WHEN (NEW.payload->'interview_date') IS NOT NULL AND (NEW.payload->>'interview_date') IS DISTINCT FROM ''
        THEN (NEW.payload->>'interview_date')::DATE 
        ELSE interview_date 
      END,
      
      result_date = CASE 
        WHEN (NEW.payload->'result_date') IS NOT NULL AND (NEW.payload->>'result_date') IS DISTINCT FROM ''
        THEN (NEW.payload->>'result_date')::DATE 
        ELSE result_date 
      END,
      
      session_start_date = CASE 
        WHEN (NEW.payload->'session_start_date') IS NOT NULL AND (NEW.payload->>'session_start_date') IS DISTINCT FROM ''
        THEN (NEW.payload->>'session_start_date')::DATE 
        ELSE session_start_date 
      END,
      
      admission_notes = COALESCE((NEW.payload->>'admission_notes'), admission_notes),
      
      has_transport = CASE 
        WHEN (NEW.payload->'has_transport') IS NOT NULL 
        THEN (NEW.payload->'has_transport')::BOOLEAN 
        ELSE has_transport 
      END,
      
      has_hostel = CASE 
        WHEN (NEW.payload->'has_hostel') IS NOT NULL 
        THEN (NEW.payload->'has_hostel')::BOOLEAN 
        ELSE has_hostel 
      END,
      
      -- Dynamic JSONB arrays parsing
      facilities = CASE 
        WHEN (NEW.payload->'facilities') IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.payload->'facilities')) 
        ELSE facilities 
      END,
      
      best_for = CASE 
        WHEN (NEW.payload->'best_for') IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.payload->'best_for')) 
        ELSE best_for 
      END,
      
      gallery_urls = CASE 
        WHEN (NEW.payload->'gallery_urls') IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.payload->'gallery_urls')) 
        ELSE gallery_urls 
      END,
      
      updated_at = NOW()
    WHERE id = NEW.school_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

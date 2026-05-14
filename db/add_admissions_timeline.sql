-- Add Admissions Timeline columns to schools table
ALTER TABLE public.schools
ADD COLUMN admissions_open BOOLEAN DEFAULT false,
ADD COLUMN application_start_date DATE,
ADD COLUMN application_deadline DATE,
ADD COLUMN interview_date DATE,
ADD COLUMN result_date DATE,
ADD COLUMN session_start_date DATE,
ADD COLUMN admission_notes TEXT;

-- Update some existing schools with mock dates for testing
UPDATE public.schools
SET 
  admissions_open = true,
  application_start_date = CURRENT_DATE - INTERVAL '5 days',
  application_deadline = CURRENT_DATE + INTERVAL '10 days',
  interview_date = CURRENT_DATE + INTERVAL '20 days',
  result_date = CURRENT_DATE + INTERVAL '30 days',
  session_start_date = '2027-04-01',
  admission_notes = 'Applications are currently open for the 2027-2028 academic session. Please submit your documents before the deadline.'
WHERE id IN (
  SELECT id FROM public.schools LIMIT 2
);

UPDATE public.schools
SET 
  admissions_open = false,
  application_start_date = CURRENT_DATE + INTERVAL '15 days',
  application_deadline = CURRENT_DATE + INTERVAL '45 days',
  interview_date = CURRENT_DATE + INTERVAL '60 days',
  result_date = CURRENT_DATE + INTERVAL '75 days',
  session_start_date = '2027-04-01',
  admission_notes = 'Admissions will open soon for the upcoming session.'
WHERE id IN (
  SELECT id FROM public.schools OFFSET 2 LIMIT 1
);

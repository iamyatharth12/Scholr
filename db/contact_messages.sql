-- ═══════════════════════════════════════════════════════════
--  Scholr — contact_messages table
--  Run this in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- Ensure the pgcrypto extension is active for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table: contact_messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL,
  email       TEXT          NOT NULL,
  subject     TEXT,
  category    TEXT,
  message     TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  status      TEXT          DEFAULT 'open'
);

COMMENT ON TABLE public.contact_messages IS
  'Scholr — user-submitted support inquiries and contact messages.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (anon role)
CREATE POLICY "Allow public insert on contact_messages"
  ON public.contact_messages FOR INSERT
  TO anon WITH CHECK (true);

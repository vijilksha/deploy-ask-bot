-- Add comments column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS comments TEXT;
-- Add new columns to contacts table to match Excel schema
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS empid text,
ADD COLUMN IF NOT EXISTS fullname text,
ADD COLUMN IF NOT EXISTS type_of_hire text,
ADD COLUMN IF NOT EXISTS cohort_code text,
ADD COLUMN IF NOT EXISTS project text,
ADD COLUMN IF NOT EXISTS role_assigned text,
ADD COLUMN IF NOT EXISTS billable_status text,
ADD COLUMN IF NOT EXISTS account_name text,
ADD COLUMN IF NOT EXISTS eid text,
ADD COLUMN IF NOT EXISTS edl_comments_on_nbl text,
ADD COLUMN IF NOT EXISTS edl_comments_on_role text;

-- Update name to match fullname if empty
UPDATE contacts SET fullname = name WHERE fullname IS NULL;
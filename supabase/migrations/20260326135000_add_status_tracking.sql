-- Add last_status column to tasks and constraints
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

ALTER TABLE constraints ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE constraints ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

-- Enable permissions for all authenticated users to update these columns
-- (Existing policies already cover ALL columns for authenticated users, but good to keep in mind)

-- Add last_status columns to weekly_plans
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

-- Manual migration: Add last_status tracking to tasks, constraints, and weekly_plans
-- Copy this and run in Supabase SQL Editor if db push is not working

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

ALTER TABLE constraints ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE constraints ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS last_status TEXT;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS last_status_date TIMESTAMPTZ;

-- Add status_comments (JSONB array) to tasks, constraints, and weekly_plans
-- Each entry: { author: string, text: string, date: string (ISO) }

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_comments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE constraints ADD COLUMN IF NOT EXISTS status_comments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS status_comments JSONB DEFAULT '[]'::jsonb;

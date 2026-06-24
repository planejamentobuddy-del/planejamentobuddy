-- Add cost column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;

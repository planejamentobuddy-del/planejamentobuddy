-- Migration: Add cross_project_predecessors column to tasks table
-- Run this in Supabase SQL Editor

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS cross_project_predecessors jsonb DEFAULT '[]'::jsonb;

-- Each element in the array has the shape:
-- { "taskId": "uuid", "projectId": "uuid", "lagDays": 0 }

COMMENT ON COLUMN tasks.cross_project_predecessors IS
  'Array of cross-project predecessor links: [{taskId, projectId, lagDays}]';

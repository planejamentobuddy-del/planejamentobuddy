-- Add status column to projects table to support archiving
ALTER TABLE public.projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

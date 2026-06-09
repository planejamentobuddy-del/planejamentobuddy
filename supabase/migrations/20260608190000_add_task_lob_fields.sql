-- Add optional fields for Linha de Balanço (Line of Balance) to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS discipline TEXT,
ADD COLUMN IF NOT EXISTS frentes JSONB DEFAULT '[]'::jsonb;

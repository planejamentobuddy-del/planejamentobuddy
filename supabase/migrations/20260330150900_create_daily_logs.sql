-- Create daily_logs table for project diary
CREATE TABLE IF NOT EXISTS daily_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage daily logs
CREATE POLICY "Allow authenticated to manage daily_logs" 
ON public.daily_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

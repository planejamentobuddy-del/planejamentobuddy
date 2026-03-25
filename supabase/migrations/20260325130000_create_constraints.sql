-- Create constraints table
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- labor, material, equipment, design, permit, other
    status TEXT NOT NULL DEFAULT 'open', -- open, closed
    responsible TEXT,
    due_date DATE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view constraints for their projects" 
ON constraints FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = constraints.project_id 
        AND created_by = auth.uid()
    )
);

CREATE POLICY "Users can insert constraints for their projects" 
ON constraints FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_id 
        AND created_by = auth.uid()
    )
);

CREATE POLICY "Users can update constraints for their projects" 
ON constraints FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = constraints.project_id 
        AND created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete constraints for their projects" 
ON constraints FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = constraints.project_id 
        AND created_by = auth.uid()
    )
);

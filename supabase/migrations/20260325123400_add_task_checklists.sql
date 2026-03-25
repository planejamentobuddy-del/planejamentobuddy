ALTER TABLE tasks ADD COLUMN checklists JSONB DEFAULT '[]'::jsonb;

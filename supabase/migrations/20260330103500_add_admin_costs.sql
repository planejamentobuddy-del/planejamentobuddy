-- Add admin costs fields to projects table
ALTER TABLE projects 
ADD COLUMN admin_cost_total numeric DEFAULT 0,
ADD COLUMN admin_cost_received numeric DEFAULT 0;

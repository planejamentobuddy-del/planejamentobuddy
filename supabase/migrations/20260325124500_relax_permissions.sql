
-- Relax RLS policies for collaborative editing
-- This migration allows all authenticated users to manage projects, tasks, and weekly plans.

-- Projects
DROP POLICY IF EXISTS "Allow admins to manage projects" ON public.projects;
CREATE POLICY "Allow authenticated to manage projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks
DROP POLICY IF EXISTS "Allow admins to manage tasks" ON public.tasks;
CREATE POLICY "Allow authenticated to manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Weekly Plans
DROP POLICY IF EXISTS "Allow admins to manage weekly_plans" ON public.weekly_plans;
CREATE POLICY "Allow authenticated to manage weekly_plans" ON public.weekly_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Weekly History
DROP POLICY IF EXISTS "Allow admins to manage weekly_history" ON public.weekly_history;
CREATE POLICY "Allow authenticated to manage weekly_history" ON public.weekly_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

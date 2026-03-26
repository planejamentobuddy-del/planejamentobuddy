-- Relax RLS policies for project management tables to allow a unified collaborative environment
-- Everyone can SELECT, INSERT, UPDATE, DELETE in Projects, Tasks, Plans, History, Constraints

-- Projects
DROP POLICY IF EXISTS "Allow authenticated to select projects" ON public.projects;
DROP POLICY IF EXISTS "Allow admins to manage projects" ON public.projects;
DROP POLICY IF EXISTS "Allow authenticated to manage projects" ON public.projects;
CREATE POLICY "Allow authenticated to manage projects" ON public.projects FOR ALL TO authenticated USING (true);

-- Tasks
DROP POLICY IF EXISTS "Allow authenticated to select tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow admins to manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow authenticated to manage tasks" ON public.tasks;
CREATE POLICY "Allow authenticated to manage tasks" ON public.tasks FOR ALL TO authenticated USING (true);

-- Weekly Plans
DROP POLICY IF EXISTS "Allow authenticated to select weekly_plans" ON public.weekly_plans;
DROP POLICY IF EXISTS "Allow admins to manage weekly_plans" ON public.weekly_plans;
DROP POLICY IF EXISTS "Allow authenticated to manage weekly_plans" ON public.weekly_plans;
CREATE POLICY "Allow authenticated to manage weekly_plans" ON public.weekly_plans FOR ALL TO authenticated USING (true);

-- Weekly History
DROP POLICY IF EXISTS "Allow authenticated to select weekly_history" ON public.weekly_history;
DROP POLICY IF EXISTS "Allow admins to manage weekly_history" ON public.weekly_history;
DROP POLICY IF EXISTS "Allow authenticated to manage weekly_history" ON public.weekly_history;
CREATE POLICY "Allow authenticated to manage weekly_history" ON public.weekly_history FOR ALL TO authenticated USING (true);

-- Constraints
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'constraints') THEN
        DROP POLICY IF EXISTS "Allow authenticated to manage constraints" ON public.constraints;
        CREATE POLICY "Allow authenticated to manage constraints" ON public.constraints FOR ALL TO authenticated USING (true);
    END IF;
END $$;


-- Tables for Project Management (Updated)

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  percent_complete INTEGER NOT NULL DEFAULT 0,
  responsible TEXT,
  predecessors TEXT[] DEFAULT '{}',
  has_restriction BOOLEAN NOT NULL DEFAULT false,
  restriction_type TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  observations TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly Plans table
CREATE TABLE public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  responsible TEXT,
  week TEXT NOT NULL,
  week_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  reason TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly History table
CREATE TABLE public.weekly_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  week TEXT NOT NULL,
  week_label TEXT NOT NULL,
  planned INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  ppc INTEGER NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Simplified for development, can be tightened later)
CREATE POLICY "Allow authenticated to select projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage projects" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow authenticated to select tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow authenticated to select weekly_plans" ON public.weekly_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage weekly_plans" ON public.weekly_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow authenticated to select weekly_history" ON public.weekly_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage weekly_history" ON public.weekly_history FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

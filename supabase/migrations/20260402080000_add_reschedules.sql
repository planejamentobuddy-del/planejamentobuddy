-- ============================================================
-- Migration: Add Task Rescheduling System
-- ============================================================

-- 1. Add new columns to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS planned_start DATE,
  ADD COLUMN IF NOT EXISTS planned_end DATE,
  ADD COLUMN IF NOT EXISTS current_start DATE,
  ADD COLUMN IF NOT EXISTS current_end DATE,
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill existing tasks: copy current start/end as baseline
UPDATE public.tasks
SET
  planned_start = start_date,
  planned_end   = end_date,
  current_start = start_date,
  current_end   = end_date
WHERE planned_start IS NULL;

-- 3. Create immutable audit log table for reschedules
CREATE TABLE IF NOT EXISTS public.task_reschedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  project_id            UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  rescheduled_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  rescheduled_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rescheduled_by_name   TEXT,
  reason_category       TEXT NOT NULL,
  reason_detail         TEXT,
  previous_start        DATE NOT NULL,
  previous_end          DATE NOT NULL,
  new_start             DATE NOT NULL,
  new_end               DATE NOT NULL,
  is_cascade            BOOLEAN NOT NULL DEFAULT false
);

-- 4. Enable RLS on the new table
ALTER TABLE public.task_reschedules ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — all authenticated users can select and insert
CREATE POLICY "Allow authenticated to select task_reschedules"
  ON public.task_reschedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert task_reschedules"
  ON public.task_reschedules FOR INSERT TO authenticated WITH CHECK (true);

-- Only admins can update or delete reschedule records
CREATE POLICY "Allow admins to manage task_reschedules"
  ON public.task_reschedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

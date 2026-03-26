-- Relax task_id requirement in weekly_plans to allow ad-hoc tasks
ALTER TABLE public.weekly_plans ALTER COLUMN task_id DROP NOT NULL;

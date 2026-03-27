-- Add order_index to tasks table to support manual reordering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Initialize order_index for existing tasks based on their creation order
WITH ranked_tasks AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id, parent_id ORDER BY created_at ASC) as rnk
    FROM public.tasks
)
UPDATE public.tasks
SET order_index = ranked_tasks.rnk
FROM ranked_tasks
WHERE public.tasks.id = ranked_tasks.id;

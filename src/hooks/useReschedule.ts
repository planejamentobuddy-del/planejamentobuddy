import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskReschedule } from '@/types/project';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ── Helper: add N business days to a date string ──
function addBusinessDays(startDateStr: string, duration: number): string {
  if (!startDateStr || duration < 1) return startDateStr;
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  let added = 1;
  while (added < duration) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().split('T')[0];
}

function countBusinessDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);
  if (start >= end) return 1;
  let days = 1;
  const current = new Date(start);
  while (current.getTime() < end.getTime()) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

export interface RescheduleParams {
  task: Task;
  newStart: string;
  newEnd: string;
  reasonCategory: string;
  reasonDetail?: string;
  cascade: boolean;
  allTasks: Task[];
  onTasksUpdated: (updatedTasks: Task[]) => void;
}

export function useReschedule() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // ── Fetch reschedules for a specific task ──
  const getTaskReschedules = useCallback(async (taskId: string): Promise<TaskReschedule[]> => {
    const { data, error } = await supabase
      .from('task_reschedules')
      .select('*')
      .eq('task_id', taskId)
      .order('rescheduled_at', { ascending: false });

    if (error) {
      console.error('[useReschedule] fetch error:', error);
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      projectId: r.project_id,
      rescheduledAt: r.rescheduled_at,
      rescheduledByName: r.rescheduled_by_name || 'Usuário',
      reasonCategory: r.reason_category,
      reasonDetail: r.reason_detail || undefined,
      previousStart: r.previous_start,
      previousEnd: r.previous_end,
      newStart: r.new_start,
      newEnd: r.new_end,
      isCascade: r.is_cascade,
    }));
  }, []);

  // ── Reschedule stats for a project ──
  const getRescheduleStats = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('task_reschedules')
      .select('task_id, task:task_id(name)')
      .eq('project_id', projectId);

    if (error || !data) return { total: 0, tasksAffected: 0, topTasks: [] };

    const total = data.length;
    const countMap = new Map<string, { name: string; count: number }>();
    data.forEach((r: any) => {
      const name = r.task?.name || 'Tarefa';
      const prev = countMap.get(r.task_id) || { name, count: 0 };
      countMap.set(r.task_id, { name, count: prev.count + 1 });
    });

    const topTasks = Array.from(countMap.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { total, tasksAffected: countMap.size, topTasks };
  }, []);

  // ── Preview which tasks would be affected by cascade ──
  const getCascadePreview = useCallback((
    task: Task,
    newEnd: string,
    allTasks: Task[]
  ): Array<{ task: Task; newStart: string; newEnd: string }> => {
    const results: Array<{ task: Task; newStart: string; newEnd: string }> = [];
    const visited = new Set<string>();

    const process = (predecessorId: string, predecessorNewEnd: string) => {
      const successors = allTasks.filter(t =>
        t.predecessors.includes(predecessorId) && !visited.has(t.id)
      );
      for (const succ of successors) {
        visited.add(succ.id);
        const succNewStart = addBusinessDays(predecessorNewEnd, 2);
        const dur = succ.duration || 1;
        const succNewEnd = addBusinessDays(succNewStart, dur);
        results.push({ task: succ, newStart: succNewStart, newEnd: succNewEnd });
        process(succ.id, succNewEnd);
      }
    };

    process(task.id, newEnd);
    return results;
  }, []);

  // ── Main reschedule function ──
  const rescheduleTask = useCallback(async ({
    task,
    newStart,
    newEnd,
    reasonCategory,
    reasonDetail,
    cascade,
    allTasks,
    onTasksUpdated,
  }: RescheduleParams): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar autenticado para reprogramar.');
      return false;
    }

    setLoading(true);
    try {
      const previousStart = task.currentStart || task.startDate;
      const previousEnd = task.currentEnd || task.endDate;
      const newDuration = countBusinessDays(newStart, newEnd);

      // -- Fetch user name from profile --
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      const userName = profile?.full_name || user.email || 'Usuário';

      // -- Determine if base task is already rescheduled (to preserve plannedStart/plannedEnd) --
      const plannedStart = task.plannedStart || previousStart;
      const plannedEnd = task.plannedEnd || previousEnd;

      // -- Update the main task --
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          start_date: newStart,
          end_date: newEnd,
          current_start: newStart,
          current_end: newEnd,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          duration: newDuration,
          status: 'rescheduled',
          reschedule_count: (task.rescheduleCount || 0) + 1,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // -- Insert audit record --
      const { error: auditError } = await supabase
        .from('task_reschedules')
        .insert({
          task_id: task.id,
          project_id: task.projectId,
          rescheduled_by: user.id,
          rescheduled_by_name: userName,
          reason_category: reasonCategory,
          reason_detail: reasonDetail || null,
          previous_start: previousStart,
          previous_end: previousEnd,
          new_start: newStart,
          new_end: newEnd,
          is_cascade: false,
        });

      if (auditError) throw auditError;

      const updatedTasks: Task[] = [
        {
          ...task,
          startDate: newStart,
          endDate: newEnd,
          currentStart: newStart,
          currentEnd: newEnd,
          plannedStart,
          plannedEnd,
          duration: newDuration,
          status: 'rescheduled',
          rescheduleCount: (task.rescheduleCount || 0) + 1,
        },
      ];

      // -- Cascade to successors --
      if (cascade) {
        const preview = getCascadePreview(task, newEnd, allTasks);
        for (const { task: succ, newStart: sStart, newEnd: sEnd } of preview) {
          const succDur = countBusinessDays(sStart, sEnd);
          const succPrevStart = succ.currentStart || succ.startDate;
          const succPrevEnd = succ.currentEnd || succ.endDate;
          const succPlannedStart = succ.plannedStart || succPrevStart;
          const succPlannedEnd = succ.plannedEnd || succPrevEnd;

          await supabase.from('tasks').update({
            start_date: sStart,
            end_date: sEnd,
            current_start: sStart,
            current_end: sEnd,
            planned_start: succPlannedStart,
            planned_end: succPlannedEnd,
            duration: succDur,
            status: 'rescheduled',
            reschedule_count: (succ.rescheduleCount || 0) + 1,
          }).eq('id', succ.id);

          await supabase.from('task_reschedules').insert({
            task_id: succ.id,
            project_id: succ.projectId,
            rescheduled_by: user.id,
            rescheduled_by_name: userName,
            reason_category: 'Dependência',
            reason_detail: `Ajuste automático por dependência de "${task.name}"`,
            previous_start: succPrevStart,
            previous_end: succPrevEnd,
            new_start: sStart,
            new_end: sEnd,
            is_cascade: true,
          });

          updatedTasks.push({
            ...succ,
            startDate: sStart,
            endDate: sEnd,
            currentStart: sStart,
            currentEnd: sEnd,
            plannedStart: succPlannedStart,
            plannedEnd: succPlannedEnd,
            duration: succDur,
            status: 'rescheduled',
            rescheduleCount: (succ.rescheduleCount || 0) + 1,
          });
        }
      }

      onTasksUpdated(updatedTasks);
      toast.success(
        cascade && updatedTasks.length > 1
          ? `Tarefa reprogramada! ${updatedTasks.length - 1} tarefa(s) dependente(s) ajustada(s).`
          : 'Tarefa reprogramada com sucesso!'
      );
      return true;
    } catch (err: any) {
      console.error('[rescheduleTask] error:', err);
      toast.error('Erro ao reprogramar: ' + (err.message || 'Tente novamente.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, getCascadePreview]);

  return { rescheduleTask, getTaskReschedules, getRescheduleStats, getCascadePreview, loading };
}

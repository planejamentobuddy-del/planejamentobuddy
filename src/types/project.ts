export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  parentId?: string; // if set, this is a subtask of that parent
  name: string;
  startDate: string;
  endDate: string;
  duration: number; // days
  percentComplete: number;
  responsible: string;
  predecessors: string[]; // task IDs
  hasRestriction: boolean;
  restrictionType: string;
  status: TaskStatus;
  observations?: string;
  checklists?: ChecklistItem[];
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export interface WeeklyPlan {
  id: string;
  projectId: string;
  taskId: string;
  taskName: string;
  responsible: string;
  week: string; // ISO week string e.g. "2024-W03"
  weekLabel: string;
  status: 'planned' | 'completed' | 'not_completed';
  reason: string;
  observations: string;
}

export interface WeeklyHistory {
  id: string;
  projectId: string;
  week: string;
  weekLabel: string;
  planned: number;
  completed: number;
  ppc: number;
  closedAt: string;
}

export const DELAY_REASONS = [
  'Falta de material',
  'Mão de obra',
  'Clima',
  'Planejamento',
  'Dependência',
  'Outros',
] as const;

export type DelayReason = typeof DELAY_REASONS[number];

export function getProjectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, t) => sum + t.percentComplete, 0) / tasks.length);
}

export function getProjectStatus(tasks: Task[]): 'ok' | 'warning' | 'danger' {
  if (tasks.length === 0) return 'ok';
  const delayed = tasks.filter(t => t.status === 'delayed').length;
  const ratio = delayed / tasks.length;
  if (ratio > 0.3) return 'danger';
  if (ratio > 0.1) return 'warning';
  // Check if any task is past due
  const now = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.endDate < now && t.percentComplete < 100).length;
  if (overdue > tasks.length * 0.3) return 'danger';
  if (overdue > 0) return 'warning';
  return 'ok';
}

export function getEstimatedEndDate(project: Project, tasks: Task[]): string {
  if (tasks.length === 0) return project.endDate;
  const progress = getProjectProgress(tasks);
  if (progress >= 100) return new Date().toISOString().split('T')[0];
  if (progress === 0) return project.endDate;
  
  const start = new Date(project.startDate).getTime();
  const now = Date.now();
  const elapsed = now - start;
  const totalEstimated = elapsed / (progress / 100);
  const estimatedEnd = new Date(start + totalEstimated);
  return estimatedEnd.toISOString().split('T')[0];
}

export function getCurrentWeek(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${now.getFullYear()}-S${weekNum.toString().padStart(2, '0')}`;
}

/**
 * CPM Forward / Backward Pass — returns the set of task IDs on the critical path.
 * A task is critical when its Total Float (LS − ES) equals zero.
 */
export function getCriticalTaskIds(allTasks: Task[]): Set<string> {
  if (allTasks.length === 0) return new Set();

  // Only consider leaf tasks (non-parent) for the network
  const parentIds = new Set(allTasks.filter(t => t.parentId).map(t => t.parentId!));
  const leaves = allTasks.filter(t => !parentIds.has(t.id));
  if (leaves.length === 0) return new Set();

  const toDay = (s: string) => {
    const d = new Date(s + 'T12:00:00');
    return Math.round(d.getTime() / 86400000);
  };

  const idToIdx = new Map<string, number>();
  leaves.forEach((t, i) => idToIdx.set(t.id, i));

  const n = leaves.length;
  const dur = leaves.map(t => Math.max(1, t.duration));
  const es = new Array(n).fill(0);
  const ef = new Array(n).fill(0);

  // Build adjacency: for each task, who are its predecessors (index)
  const predIndices: number[][] = leaves.map(t =>
    (t.predecessors || [])
      .filter(pid => idToIdx.has(pid))
      .map(pid => idToIdx.get(pid)!)
  );

  // Forward Pass — topological order (simple iterative since DAG is small)
  // Initialize ES from actual start dates
  const projectMinDay = Math.min(...leaves.map(t => toDay(t.startDate)));
  leaves.forEach((t, i) => {
    es[i] = toDay(t.startDate) - projectMinDay;
  });

  // Enforce predecessor constraints
  let changed = true;
  let iterations = 0;
  while (changed && iterations < n * 2) {
    changed = false;
    iterations++;
    for (let i = 0; i < n; i++) {
      for (const pi of predIndices[i]) {
        const newEs = es[pi] + dur[pi];
        if (newEs > es[i]) {
          es[i] = newEs;
          changed = true;
        }
      }
    }
  }

  // Compute EF
  for (let i = 0; i < n; i++) {
    ef[i] = es[i] + dur[i];
  }

  // Backward Pass
  const projectEnd = Math.max(...ef);
  const lf = new Array(n).fill(projectEnd);
  const ls = new Array(n).fill(0);

  // Build successor indices
  const succIndices: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (const pi of predIndices[i]) {
      succIndices[pi].push(i);
    }
  }

  // Tasks with no successors: LF = projectEnd
  // Tasks with successors: LF = min(LS of successors)
  changed = true;
  iterations = 0;
  while (changed && iterations < n * 2) {
    changed = false;
    iterations++;
    for (let i = 0; i < n; i++) {
      ls[i] = lf[i] - dur[i];
    }
    for (let i = 0; i < n; i++) {
      for (const si of succIndices[i]) {
        const newLf = ls[si];
        if (newLf < lf[i]) {
          lf[i] = newLf;
          changed = true;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    ls[i] = lf[i] - dur[i];
  }

  // Critical = Total Float (LS - ES) === 0
  const critical = new Set<string>();
  for (let i = 0; i < n; i++) {
    const totalFloat = ls[i] - es[i];
    if (totalFloat <= 0) {
      critical.add(leaves[i].id);
      // Also mark the parent (stage) as critical
      if (leaves[i].parentId) {
        critical.add(leaves[i].parentId!);
      }
    }
  }

  return critical;
}

/** @deprecated Use getCriticalTaskIds instead */
export function isCriticalPath(task: Task, allTasks: Task[]): boolean {
  return getCriticalTaskIds(allTasks).has(task.id);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export interface CurvePoint {
  label: string;
  planejado: number;
  realizado: number;
  timestamp: number;
}

/**
 * Calculates S-Curve points (Planned vs Actual) for a set of tasks.
 * Uses duration-weighted linear interpolation.
 */
export function calculateSCurve(tasks: Task[], project: Project): CurvePoint[] {
  // Filter tasks that are "subetapas" (have parentId) or are leaf tasks
  const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId!));
  const subtasks = tasks.filter(t => !parentIds.has(t.id) && t.startDate && t.endDate);
  
  if (subtasks.length === 0) return [];

  // Calculate total project range based on tasks
  const taskDates = subtasks.flatMap(t => [
    new Date(t.startDate + 'T12:00:00').getTime(), 
    new Date(t.endDate + 'T12:00:00').getTime()
  ]).sort((a, b) => a - b);
  
  const start = taskDates[0];
  const end = taskDates[taskDates.length - 1];
  
  if (!start || !end || isNaN(start) || isNaN(end)) return [];

  const totalWeight = subtasks.reduce((sum, t) => sum + Math.max(1, t.duration), 0);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const nowTs = now.getTime();

  const points: CurvePoint[] = [];
  
  // We'll generate daily points but sample them if the project is long
  const durationDays = Math.ceil((end - start) / 86400000);
  const stepDays = Math.max(1, Math.ceil(durationDays / 40)); // Target ~40 points
  const stepMs = stepDays * 86400000;

  for (let current = start; current <= end + 86400000; current += stepMs) {
    const currentSafe = Math.min(current, end);
    let totalPlannedWeight = 0;
    let totalActualWeight = 0;

    subtasks.forEach(t => {
      const tStart = new Date(t.startDate + 'T12:00:00').getTime();
      const tEnd = new Date(t.endDate + 'T12:00:00').getTime();
      const tWeight = Math.max(1, t.duration);
      const tDuration = Math.max(1, tEnd - tStart);

      // --- Planned Progress ---
      let pTask = 0;
      if (currentSafe >= tEnd) pTask = 1;
      else if (currentSafe > tStart) pTask = (currentSafe - tStart) / tDuration;
      totalPlannedWeight += pTask * tWeight;

      // --- Actual Progress ---
      let aTask = 0;
      const progressFactor = t.percentComplete / 100;
      
      if (currentSafe <= tStart) {
        aTask = 0;
      } else if (currentSafe >= nowTs) {
        aTask = progressFactor;
      } else {
        const timeSinceStart = currentSafe - tStart;
        const timeUntilToday = Math.max(86400000, nowTs - tStart); 
        aTask = progressFactor * (timeSinceStart / timeUntilToday);
      }
      totalActualWeight += aTask * tWeight;
    });

    points.push({
      label: new Date(currentSafe).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      planejado: Math.round((totalPlannedWeight / totalWeight) * 100),
      realizado: Math.round((totalActualWeight / totalWeight) * 100),
      timestamp: currentSafe,
    });

    if (currentSafe >= end) break;
  }

  return points;
}

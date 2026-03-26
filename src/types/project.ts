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
  taskId?: string;
  taskName: string;
  responsible: string;
  week: string; // ISO week string e.g. "2024-W03"
  weekLabel: string;
  status: 'planned' | 'in_progress' | 'completed' | 'not_completed';
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

export const CONSTRAINT_CATEGORIES = [
  { id: 'labor', label: 'Mão de obra', color: 'text-blue-500 bg-blue-500/10' },
  { id: 'material', label: 'Materiais', color: 'text-orange-500 bg-orange-500/10' },
  { id: 'equipment', label: 'Equipamentos', color: 'text-purple-500 bg-purple-500/10' },
  { id: 'design', label: 'Projeto/Definição', color: 'text-cyan-500 bg-cyan-500/10' },
  { id: 'permit', label: 'Legal/Documentação', color: 'text-red-500 bg-red-500/10' },
  { id: 'other', label: 'Outros', color: 'text-slate-500 bg-slate-500/10' },
] as const;

export type ConstraintCategory = typeof CONSTRAINT_CATEGORIES[number]['id'];

export interface Constraint {
  id: string;
  projectId: string;
  taskId?: string; // Vinculado a uma tarefa específica
  description: string;
  category: ConstraintCategory;
  status: 'open' | 'closed';
  responsible: string;
  dueDate: string;
  closedAt?: string;
  createdAt: string;
}

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

  // Map ancestors to their leaf task indices
  const ancestorToLeaves = new Map<string, number[]>();
  parentIds.forEach(pId => ancestorToLeaves.set(pId, []));
  leaves.forEach((task, leafIdx) => {
    let pId = task.parentId;
    while (pId) {
      ancestorToLeaves.get(pId)?.push(leafIdx);
      const parent = allTasks.find(x => x.id === pId);
      pId = parent?.parentId;
    }
  });

  const n = leaves.length;
  const idToIdx = new Map<string, number>();
  leaves.forEach((t, i) => idToIdx.set(t.id, i));

  // Build Adjacency
  const predIndices: number[][] = leaves.map(t => {
    const indices = new Set<number>();
    (t.predecessors || []).forEach(pid => {
      if (idToIdx.has(pid)) indices.add(idToIdx.get(pid)!);
      else if (ancestorToLeaves.has(pid)) {
        ancestorToLeaves.get(pid)?.forEach(idx => indices.add(idx));
      }
    });
    return Array.from(indices);
  });

  const succIndices: number[][] = Array.from({ length: n }, () => []);
  predIndices.forEach((preds, i) => {
    preds.forEach(pi => succIndices[pi].push(i));
  });

  // 1. Topological Sort (Kahn's algorithm)
  const inDegree = predIndices.map(p => p.length);
  const queue: number[] = [];
  inDegree.forEach((deg, i) => { if (deg === 0) queue.push(i); });

  const sorted: number[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    sorted.push(u);
    succIndices[u].forEach(v => {
      inDegree[v]--;
      if (inDegree[v] === 0) queue.push(v);
    });
  }

  // Detect Cycles (Safety)
  if (sorted.length < n) {
    console.error("[CPM] Circular dependency detected! Critical path might be incomplete.");
  }

  const es = new Array(n).fill(0);
  const ef = new Array(n).fill(0);
  const dur = leaves.map(t => Math.max(1, t.duration));

  // 2. Forward Pass
  sorted.forEach(i => {
    if (predIndices[i].length > 0) {
      es[i] = Math.max(...predIndices[i].map(pi => ef[pi]));
    } else {
      es[i] = 0; // Strict CPM roots
    }
    ef[i] = es[i] + dur[i];
  });

  // 3. Backward Pass
  const projectDuration = Math.max(0, ...ef);
  const lf = new Array(n).fill(projectDuration);
  const ls = new Array(n).fill(0);

  [...sorted].reverse().forEach(i => {
    if (succIndices[i].length > 0) {
      lf[i] = Math.min(...succIndices[i].map(si => ls[si]));
    } else {
      lf[i] = projectDuration;
    }
    ls[i] = lf[i] - dur[i];
  });

  // 4. Results & Debugging
  const critical = new Set<string>();
  const allTasksMap = new Map<string, Task>();
  allTasks.forEach(t => allTasksMap.set(t.id, t));

  console.groupCollapsed(`[CPM Debug] Project Duration: ${projectDuration} days`);
  for (let i = 0; i < n; i++) {
    const float = ls[i] - es[i];
    const leaf = leaves[i];
    
    console.log(
      `Task: ${leaf.name.padEnd(25)} | ES: ${es[i].toString().padStart(3)} | EF: ${ef[i].toString().padStart(3)} | ` +
      `LS: ${ls[i].toString().padStart(3)} | LF: ${lf[i].toString().padStart(3)} | Float: ${float.toString().padStart(3)}`
    );

    if (float <= 0) {
      critical.add(leaf.id);
      let currP = leaf.parentId;
      while (currP) {
        if (critical.has(currP)) break;
        critical.add(currP);
        currP = allTasksMap.get(currP)?.parentId;
      }
    }
  }
  console.groupEnd();

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

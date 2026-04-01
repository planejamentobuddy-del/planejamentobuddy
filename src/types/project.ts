export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
  adminCostTotal?: number;
  adminCostReceived?: number; // computed from payment_receipts sum
}

export interface ProjectResource {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  monthlyCost?: number;
  contact?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface PaymentReceipt {
  id: string;
  projectId: string;
  amount: number;
  description: string;
  receivedAt: string; // date string YYYY-MM-DD
  createdAt: string;
  createdBy: string | null;
}


export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface StatusComment {
  author: string;
  text: string;
  date: string; // ISO timestamp
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
  lastStatus?: string;
  lastStatusDate?: string;
  statusComments?: StatusComment[];
  checklists?: ChecklistItem[];
  orderIndex?: number;
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
  lastStatus?: string;
  lastStatusDate?: string;
  statusComments?: StatusComment[];
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

export interface DailyLog {
  id: string;
  projectId: string;
  date: string;
  content: string;
  createdAt: string;
  createdBy: string | null;
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
  lastStatus?: string;
  lastStatusDate?: string;
  statusComments?: StatusComment[];
}

export function getProjectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  
  // Calculate leaf tasks (tasks that are not referenced as parentId by any other task)
  const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId!));
  const leaves = tasks.filter(t => !parentIds.has(t.id));
  
  if (leaves.length === 0) return 0;

  // Use duration-weighted average for consistency with S-Curve, considering only leaf tasks
  const totalDuration = leaves.reduce((sum, t) => sum + Math.max(1, t.duration), 0);
  const weightedSum = leaves.reduce((sum, t) => sum + (t.percentComplete * Math.max(1, t.duration)), 0);
  
  return totalDuration > 0 ? Math.round(weightedSum / totalDuration) : 0;
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

export function getProjectPlannedEnd(tasks: Task[]): string {
  if (tasks.length === 0) return '';
  const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId!));
  const leaves = tasks.filter(t => !parentIds.has(t.id));
  const ends = leaves.map(t => t.endDate).filter(Boolean).sort();
  return ends.length > 0 ? ends[ends.length - 1] : '';
}

/**
 * Parses a date string safely, handling both YYYY-MM-DD and DD/MM/YYYY
 */
export function safeParseDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  
  // If it's pure ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }
  
  // If it's BR format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }

  // Fallback for full ISO strings or other formats
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  
  // Force noon to avoid timezone shift issues in calculations
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function getEstimatedEndDate(project: Project, tasks: Task[], providedSpi?: number): string {
  if (tasks.length === 0) return project.endDate;
  const progress = getProjectProgress(tasks);
  if (progress >= 100) return new Date().toISOString().split('T')[0];
  if (progress === 0) return project.endDate;

  const start = safeParseDate(project.startDate);
  const plannedEnd = safeParseDate(project.endDate);
  const plannedDuration = plannedEnd - start;

  // Use provided SPI or calculate a simple one if not available
  let spi = providedSpi;
  if (spi === undefined || spi === null) {
    const elapsed = Date.now() - start;
    const effectiveProgress = Math.max(0.1, progress); 
    const linearTotalDuration = Math.max(0, elapsed) / (effectiveProgress / 100);
    const linearSpi = plannedDuration / linearTotalDuration;
    spi = linearSpi;
  }

  // SPI-based estimation: Estimated Duration = Planned Duration / SPI
  // Cap SPI to avoid infinite or zero dates
  const safeSpi = Math.max(0.1, Math.min(10, spi || 1));
  const estimatedDuration = plannedDuration / safeSpi;
  
  const estimatedEnd = new Date(start + estimatedDuration);
  const y = estimatedEnd.getFullYear();
  const m = String(estimatedEnd.getMonth() + 1).padStart(2, '0');
  const d = String(estimatedEnd.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentWeek(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const dayNum = d.getDay() || 7; // Segunda=1, ..., Domingo=7
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-S${weekNo.toString().padStart(2, '0')}`;
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
    return Math.round(safeParseDate(s) / 86400000);
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

  const dateToNum = (s: string) => new Date(s + 'T12:00:00').getTime() / 86400000;
  const projectStartNum = allTasks.length > 0 
    ? Math.min(...allTasks.filter(t => t.startDate).map(t => dateToNum(t.startDate)))
    : 0;

  const es = new Array(n).fill(0);
  const ef = new Array(n).fill(0);
  const dur = leaves.map(t => Math.max(1, t.duration));

  // 2. Forward Pass
  sorted.forEach(i => {
    const taskES = dateToNum(leaves[i].startDate) - projectStartNum;
    if (predIndices[i].length > 0) {
      es[i] = Math.max(taskES, ...predIndices[i].map(pi => ef[pi]));
    } else {
      es[i] = taskES; 
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
  
  // Collect all timestamps we want to calculate
  const timePoints: number[] = [];
  const durationMs = end - start;
  const stepDays = Math.max(1, Math.ceil((durationMs / 86400000) / 40));
  const stepMs = stepDays * 86400000;

  for (let c = start; c <= end; c += stepMs) {
    timePoints.push(c);
  }
  timePoints.push(end);
  if (nowTs > start && nowTs < end) {
    timePoints.push(nowTs);
  }

  // Deduplicate and sort
  const uniqueTimePoints = Array.from(new Set(timePoints)).sort((a, b) => a - b);
  
  uniqueTimePoints.forEach(currentSafe => {
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
  });

  return points;
}

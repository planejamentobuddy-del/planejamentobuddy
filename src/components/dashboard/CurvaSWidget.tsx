import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { Project, Task } from '@/types/project';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CurvaSProps {
  projects: Project[];
  allTasks: Task[];
  /** Compact mode for printable reports (no interactivity) */
  printMode?: boolean;
}

type Granularity = 'weekly' | 'monthly';

interface DataPoint {
  label: string;          // 'Jan/25', 'Sem 01/25'
  date: string;           // YYYY-MM-DD
  planned: number;        // 0-100, cumulative planned %
  executed: number;       // 0-100, cumulative executed %
  [key: string]: any;     // per-project lines: 'planned_ProjectId', 'exec_ProjectId'
}

// Project colors palette
const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

// ─────────────────────────────────────────────────────────────────────────────
// Core calculation
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  return new Date(str + 'T12:00:00');
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Generate a series of period-start dates (weekly or monthly) */
function generatePeriods(startDate: Date, endDate: Date, gran: Granularity): Date[] {
  const periods: Date[] = [];
  let cur = new Date(startDate);

  // Align to start of period
  if (gran === 'weekly') {
    const day = cur.getDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    cur.setDate(cur.getDate() + mondayOffset);
  } else {
    cur.setDate(1);
  }

  while (cur <= endDate) {
    periods.push(new Date(cur));
    if (gran === 'weekly') {
      cur.setDate(cur.getDate() + 7);
    } else {
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return periods;
}

function formatPeriodLabel(d: Date, gran: Granularity): string {
  if (gran === 'monthly') {
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '').replace(/^\w/, c => c.toUpperCase());
  }
  // Weekly: show week number
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `Sem ${String(week).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * For a given task, compute cumulative weight contribution at a point in time.
 * Weight = task.duration (days).
 * Planned contribution = weight × min(days elapsed / duration, 1)
 * Executed contribution = weight × (percentComplete / 100)
 */
function taskContributionAt(task: Task, atDate: Date): { plannedWeight: number; executedWeight: number } {
  const weight = Math.max(task.duration || 1, 1);
  const start = parseDate(task.startDate);
  const end   = parseDate(task.endDate);

  // Planned: how much of this task should be done by atDate
  const totalDays = Math.max((end.getTime() - start.getTime()) / 86400000, 1);
  const elapsed   = (atDate.getTime() - start.getTime()) / 86400000;
  const plannedFrac = Math.max(0, Math.min(1, elapsed / totalDays));

  // Executed: actual progress
  const executedFrac = (task.percentComplete || 0) / 100;

  return {
    plannedWeight: weight * plannedFrac,
    executedWeight: weight * executedFrac,
  };
}

function computeCurva(
  projects: Project[],
  allTasks: Task[],
  gran: Granularity
): DataPoint[] {
  // Only leaf tasks (subtasks) carry real data; parent tasks aggregate
  // Use all tasks that have valid dates
  const validTasks = allTasks.filter(t =>
    t.startDate && t.endDate && t.projectId &&
    projects.some(p => p.id === t.projectId && p.status !== 'archived')
  );

  if (validTasks.length === 0) return [];

  // Find global date range
  const allStarts = validTasks.map(t => parseDate(t.startDate).getTime());
  const allEnds   = validTasks.map(t => parseDate(t.endDate).getTime());
  const globalStart = new Date(Math.min(...allStarts));
  const globalEnd   = new Date(Math.max(...allEnds));

  const periods = generatePeriods(globalStart, globalEnd, gran);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Total weight per project
  const totalWeightAll = validTasks.reduce((s, t) => s + Math.max(t.duration || 1, 1), 0);
  const totalWeightByProject: Record<string, number> = {};
  projects.forEach(p => {
    const ptasks = validTasks.filter(t => t.projectId === p.id);
    totalWeightByProject[p.id] = ptasks.reduce((s, t) => s + Math.max(t.duration || 1, 1), 0);
  });

  return periods.map(periodStart => {
    // Use end of period for computation (so task that ends in this period is fully counted)
    const atDate = gran === 'weekly'
      ? addDays(periodStart, 6)
      : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0); // last day of month

    const effectiveDate = atDate > today ? today : atDate; // don't project "executed" into future

    let totalPlanned = 0;
    let totalExecuted = 0;

    const point: DataPoint = {
      label: formatPeriodLabel(periodStart, gran),
      date: toYMD(periodStart),
      planned: 0,
      executed: 0,
    };

    projects.forEach(p => {
      if (p.status === 'archived') return;
      const ptasks = validTasks.filter(t => t.projectId === p.id);
      const tw = totalWeightByProject[p.id];
      if (!tw) return;

      let projPlanned = 0;
      let projExecuted = 0;

      ptasks.forEach(t => {
        const { plannedWeight, executedWeight } = taskContributionAt(t, atDate);
        projPlanned  += plannedWeight;
        // Only count executed up to today
        if (atDate <= today) {
          const { executedWeight: ew } = taskContributionAt(t, effectiveDate);
          projExecuted += ew;
        } else {
          // Future: executed stays at current value
          projExecuted += t.percentComplete / 100 * Math.max(t.duration || 1, 1);
        }
        totalPlanned  += plannedWeight;
        totalExecuted += atDate <= today
          ? taskContributionAt(t, effectiveDate).executedWeight
          : t.percentComplete / 100 * Math.max(t.duration || 1, 1);
      });

      // Per-project lines (as % of that project's total weight)
      point[`planned_${p.id}`] = tw > 0 ? Math.round((projPlanned / tw) * 1000) / 10 : 0;
      point[`exec_${p.id}`]    = tw > 0 ? Math.round((projExecuted / tw) * 1000) / 10 : 0;
    });

    // Total consolidated (as % of all tasks weight)
    if (totalWeightAll > 0) {
      point.planned  = Math.round((totalPlanned / totalWeightAll) * 1000) / 10;
      point.executed = Math.round((totalExecuted / totalWeightAll) * 1000) / 10;
    }

    return point;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, projects }: any) {
  if (!active || !payload?.length) return null;

  const planned  = payload.find((p: any) => p.dataKey === 'planned')?.value ?? null;
  const executed = payload.find((p: any) => p.dataKey === 'executed')?.value ?? null;
  const variance = planned !== null && executed !== null ? executed - planned : null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 min-w-[200px]">
      <p className="text-xs font-bold text-foreground mb-2">{label}</p>

      {/* Consolidated */}
      {planned !== null && (
        <div className="flex justify-between gap-4 text-xs mb-1">
          <span className="text-blue-500 font-semibold">◆ Programado</span>
          <span className="font-bold">{planned.toFixed(1)}%</span>
        </div>
      )}
      {executed !== null && (
        <div className="flex justify-between gap-4 text-xs mb-1">
          <span className="text-emerald-500 font-semibold">◆ Executado</span>
          <span className="font-bold">{executed.toFixed(1)}%</span>
        </div>
      )}
      {variance !== null && (
        <div className={`flex justify-between gap-4 text-xs font-bold mt-1 pt-1 border-t border-border ${
          variance >= 0 ? 'text-emerald-600' : 'text-red-600'
        }`}>
          <span>{variance >= 0 ? '↑ Adiantado' : '↓ Atrasado'}</span>
          <span>{Math.abs(variance).toFixed(1)}%</span>
        </div>
      )}

      {/* Per-project breakdown */}
      {projects.length > 1 && payload.some((p: any) => p.dataKey.startsWith('planned_')) && (
        <div className="mt-2 pt-2 border-t border-border space-y-0.5">
          <p className="text-[10px] text-muted-foreground font-semibold mb-1">POR OBRA</p>
          {projects.map((proj: Project, i: number) => {
            const pl = payload.find((p: any) => p.dataKey === `planned_${proj.id}`)?.value;
            const ex = payload.find((p: any) => p.dataKey === `exec_${proj.id}`)?.value;
            if (pl == null) return null;
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
            return (
              <div key={proj.id} className="flex items-center justify-between gap-2 text-[10px]">
                <span style={{ color }} className="font-medium truncate max-w-[100px]" title={proj.name}>
                  ● {proj.name}
                </span>
                <span className="text-muted-foreground">{pl?.toFixed(0)}% / {ex?.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CurvaSWidget({ projects, allTasks, printMode = false }: CurvaSProps) {
  const [gran, setGran] = useState<Granularity>('monthly');
  const [showPerProject, setShowPerProject] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'archived'),
    [projects]
  );

  const activeTasks = useMemo(
    () => allTasks.filter(t => activeProjects.some(p => p.id === t.projectId)),
    [allTasks, activeProjects]
  );

  const data = useMemo(
    () => computeCurva(activeProjects, activeTasks, gran),
    [activeProjects, activeTasks, gran]
  );

  // Today's reference line
  const todayLabel = useMemo(() => {
    const today = new Date();
    if (gran === 'monthly') {
      return today.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', '').replace(/^\w/, c => c.toUpperCase());
    }
    const jan1 = new Date(today.getFullYear(), 0, 1);
    const week = Math.ceil(((today.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `Sem ${String(week).padStart(2, '0')}/${String(today.getFullYear()).slice(2)}`;
  }, [gran]);

  // Current variance
  const currentVariance = useMemo(() => {
    if (!data.length) return null;
    const todayPt = data.find(d => d.label === todayLabel) || data[data.length - 1];
    return todayPt ? todayPt.executed - todayPt.planned : null;
  }, [data, todayLabel]);

  if (!activeProjects.length || activeTasks.length === 0) return null;
  if (data.length === 0) return null;

  const chartHeight = printMode ? 260 : 320;

  return (
    <div className={`bg-card rounded-2xl border border-border shadow-sm ${printMode ? 'p-4' : 'p-5'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground text-sm">Curva S — Progresso Integrado</h3>
            <p className="text-xs text-muted-foreground">
              {activeProjects.length} obra{activeProjects.length !== 1 ? 's' : ''} integrada{activeProjects.length !== 1 ? 's' : ''} • Programado vs Executado
            </p>
          </div>
        </div>

        {!printMode && (
          <div className="flex items-center gap-2">
            {/* Variance badge */}
            {currentVariance !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg ${
                currentVariance >= 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-red-500/10 text-red-600'
              }`}>
                {currentVariance >= 0
                  ? <TrendingUp className="w-3.5 h-3.5" />
                  : <TrendingDown className="w-3.5 h-3.5" />
                }
                {currentVariance >= 0 ? '+' : ''}{currentVariance.toFixed(1)}% hoje
              </div>
            )}

            {/* Per-project toggle */}
            {activeProjects.length > 1 && (
              <button
                onClick={() => setShowPerProject(v => !v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  showPerProject
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Por obra
              </button>
            )}

            {/* Granularity switcher */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {(['monthly', 'weekly'] as Granularity[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGran(g)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${
                    gran === g
                      ? 'bg-card shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g === 'monthly' ? 'Mensal' : 'Semanal'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradExecuted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            interval={gran === 'weekly' ? Math.floor(data.length / 12) : 0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
            width={38}
          />

          <Tooltip content={<CustomTooltip projects={activeProjects} />} />

          {/* Today reference line */}
          <ReferenceLine
            x={todayLabel}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'HOJE', position: 'top', fontSize: 9, fill: '#ef4444', fontWeight: 700 }}
          />

          {/* Per-project lines (dimmed, optional) */}
          {showPerProject && activeProjects.map((proj, i) => {
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
            return (
              <React.Fragment key={proj.id}>
                <Line
                  dataKey={`planned_${proj.id}`}
                  name={`${proj.name} (prog.)`}
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  opacity={0.5}
                  legendType="none"
                />
                <Line
                  dataKey={`exec_${proj.id}`}
                  name={`${proj.name} (exec.)`}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  opacity={0.6}
                  legendType="none"
                />
              </React.Fragment>
            );
          })}

          {/* Consolidated Planned — Area + Line */}
          <Area
            dataKey="planned"
            name="Programado"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#gradPlanned)"
            dot={false}
            activeDot={{ r: 5, fill: '#3b82f6' }}
          />

          {/* Consolidated Executed — Area + Line */}
          <Area
            dataKey="executed"
            name="Executado"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#gradExecuted)"
            dot={false}
            activeDot={{ r: 5, fill: '#10b981' }}
          />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>{value}</span>
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Per-project legend when expanded */}
      {showPerProject && !printMode && activeProjects.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
          {activeProjects.map((proj, i) => (
            <div key={proj.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
              />
              {proj.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

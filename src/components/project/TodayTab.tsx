import { useState, useMemo } from 'react';
import { Project, Task, getCriticalTaskIds, safeParseDate } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { RescheduleModal } from '@/components/project/RescheduleModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
  ShieldAlert,
  TrendingUp,
  Flame,
  Activity,
  User,
  BarChart3,
  Zap,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function diffDays(a: string, b: string): number {
  return Math.round((safeParseDate(b) - safeParseDate(a)) / 86400000);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
}

function SectionHeader({ icon, title, count, color }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 mb-4`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
      </div>
      {count > 0 && (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
          {count}
        </span>
      )}
    </div>
  );
}

interface QuickActionsProps {
  task: Task;
  onUpdateProgress: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReschedule: (task: Task) => void;
}

function QuickActions({ task, onUpdateProgress, onComplete, onReschedule }: QuickActionsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1.5 rounded-lg border-blue-400/40 text-blue-600 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
        onClick={() => onUpdateProgress(task)}
      >
        <BarChart3 className="w-3 h-3" />
        Atualizar %
      </Button>
      {task.percentComplete < 100 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1.5 rounded-lg border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all"
          onClick={() => onComplete(task)}
        >
          <CheckCircle2 className="w-3 h-3" />
          Concluir
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1.5 rounded-lg border-amber-400/40 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all"
        onClick={() => onReschedule(task)}
      >
        <CalendarClock className="w-3 h-3" />
        Reprogramar
      </Button>
    </div>
  );
}

// ─── Progress Update Dialog ───────────────────────────────────────────────────

interface ProgressDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (task: Task, percent: number) => void;
}

function ProgressDialog({ task, open, onClose, onConfirm }: ProgressDialogProps) {
  const [value, setValue] = useState<number[]>([task?.percentComplete ?? 0]);

  // reset when task changes
  useMemo(() => {
    if (task) setValue([task.percentComplete]);
  }, [task]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Atualizar Progresso
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">{task.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <div className="text-center">
            <span className="text-5xl font-black text-foreground tabular-nums">{value[0]}</span>
            <span className="text-2xl font-bold text-muted-foreground">%</span>
          </div>

          <Slider
            value={value}
            onValueChange={setValue}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />

          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>

          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${value[0]}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border/40 mt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => { onConfirm(task, value[0]); onClose(); }}
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Salvar {value[0]}%
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isCritical?: boolean;
  delayDays?: number;
  onUpdateProgress: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReschedule: (task: Task) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Não iniciado', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  delayed: { label: 'Atrasada', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  rescheduled: { label: 'Reprogramada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

function TaskCard({ task, isCritical, delayDays, onUpdateProgress, onComplete, onReschedule }: TaskCardProps) {
  const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.not_started;

  return (
    <div className={`
      relative rounded-2xl border p-4 space-y-3 transition-all hover:shadow-md
      ${isCritical
        ? 'border-red-400/40 bg-red-500/[0.03] dark:bg-red-900/[0.07]'
        : delayDays && delayDays > 0
        ? 'border-amber-400/40 bg-amber-500/[0.03] dark:bg-amber-900/[0.07]'
        : 'border-border/50 bg-card'
      }
    `}>
      {isCritical && (
        <div className="absolute top-3 right-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-500/10 border border-red-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" /> Crítica
          </span>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-3 pr-20">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="font-bold text-sm text-foreground leading-tight truncate">{task.name}</span>
          {task.responsible && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              {task.responsible}
            </span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>

        {task.hasRestriction && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <ShieldAlert className="w-3 h-3" />
            Impedida
          </span>
        )}

        <span className="text-[11px] text-muted-foreground font-mono">
          {fmtDate(task.startDate)} → {fmtDate(task.endDate)}
        </span>

        {delayDays !== undefined && delayDays > 0 && (
          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            +{delayDays}d atraso
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="font-medium">Progresso</span>
          <span className="font-bold text-foreground tabular-nums">{task.percentComplete}%</span>
        </div>
        <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              task.status === 'completed' ? 'bg-emerald-500' :
              isCritical ? 'bg-red-500' :
              task.status === 'delayed' ? 'bg-amber-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${task.percentComplete}%` }}
          />
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions
        task={task}
        onUpdateProgress={onUpdateProgress}
        onComplete={onComplete}
        onReschedule={onReschedule}
      />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6 text-sm text-muted-foreground/60 italic border border-dashed border-border/40 rounded-2xl">
      {message}
    </div>
  );
}

// ─── Main TodayTab ────────────────────────────────────────────────────────────

export default function TodayTab({ project }: { project: Project }) {
  const { getTasksForProject, updateTask } = useProjects();
  const allTasks = useMemo(() => getTasksForProject(project.id), [getTasksForProject, project.id]);

  const todayStr = today();

  // Compute critical set
  const criticalSet = useMemo(() => getCriticalTaskIds(allTasks), [allTasks]);

  // Leaf tasks only (not parent/summary tasks)
  const parentIds = useMemo(() => {
    const s = new Set<string>();
    allTasks.forEach(t => { if (t.parentId) s.add(t.parentId); });
    return s;
  }, [allTasks]);

  const leafTasks = useMemo(() =>
    allTasks.filter(t => !parentIds.has(t.id) && t.startDate && t.endDate),
    [allTasks, parentIds]
  );

  // 1. Critical tasks (on critical path, not completed, in_progress or delayed or not_started that should have started)
  const criticalTasks = useMemo(() =>
    leafTasks
      .filter(t =>
        criticalSet.has(t.id) &&
        t.status !== 'completed' &&
        t.startDate <= todayStr
      )
      .sort((a, b) => {
        const dA = diffDays(a.endDate, todayStr);
        const dB = diffDays(b.endDate, todayStr);
        return dB - dA; // maior atraso primeiro
      }),
    [leafTasks, criticalSet, todayStr]
  );

  // 2. Scheduled for today: startDate <= today <= endDate, not completed
  const scheduledToday = useMemo(() =>
    leafTasks.filter(t =>
      t.status !== 'completed' &&
      t.startDate <= todayStr &&
      t.endDate >= todayStr &&
      !criticalSet.has(t.id) // already shown in critical section
    ),
    [leafTasks, todayStr, criticalSet]
  );

  // 3. Delayed: endDate < today AND percentComplete < 100
  const delayedTasks = useMemo(() =>
    leafTasks
      .filter(t =>
        t.endDate < todayStr &&
        t.percentComplete < 100 &&
        !criticalSet.has(t.id) // already shown in critical section
      )
      .sort((a, b) => diffDays(a.endDate, todayStr) - diffDays(b.endDate, todayStr))
      .reverse(), // most delayed first
    [leafTasks, todayStr, criticalSet]
  );

  // Total critical (including those also delayed)
  const totalCriticalCount = criticalTasks.length;
  const totalDelayedCount = delayedTasks.length +
    criticalTasks.filter(t => t.endDate < todayStr).length;
  const totalAttentionCount = criticalTasks.length + scheduledToday.length + delayedTasks.length;

  // ─── Modal state ─────────────────────────────────────────────────────────

  const [progressTask, setProgressTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);

  const handleUpdateProgress = (task: Task) => {
    setProgressTask(task);
    setShowProgressDialog(true);
  };

  const handleConfirmProgress = async (task: Task, percent: number) => {
    const newStatus = percent >= 100 ? 'completed' : task.startDate <= todayStr ? 'in_progress' : task.status;
    await updateTask({ ...task, percentComplete: percent, status: newStatus as any });
    toast.success(`Progresso de "${task.name}" atualizado para ${percent}%`);
  };

  const handleComplete = async (task: Task) => {
    await updateTask({ ...task, percentComplete: 100, status: 'completed' });
    toast.success(`"${task.name}" marcada como concluída! ✅`);
  };

  const handleReschedule = (task: Task) => {
    setRescheduleTask(task);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* ── Summary banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-white/[0.07] shadow-xl p-6">
        {/* decorative glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50 font-semibold uppercase tracking-widest">Hoje na Obra</p>
              <p className="text-sm text-white/80 font-medium">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>

          {totalAttentionCount === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <p className="text-white/90 font-semibold text-sm">
                Tudo em dia! Nenhuma tarefa requer atenção hoje. 🎉
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.05] rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-white tabular-nums">{totalAttentionCount}</p>
                <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1 font-semibold">Precisam atenção</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-red-400 tabular-nums">{totalCriticalCount}</p>
                <p className="text-[11px] text-red-300/70 uppercase tracking-widest mt-1 font-semibold">Críticas</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400 tabular-nums">{totalDelayedCount}</p>
                <p className="text-[11px] text-amber-300/70 uppercase tracking-widest mt-1 font-semibold">Atrasadas</p>
              </div>
            </div>
          )}

          {totalAttentionCount > 0 && (
            <p className="text-white/60 text-sm text-center">
              {totalCriticalCount > 0 && totalDelayedCount > 0
                ? `Hoje você tem ${totalCriticalCount} tarefa${totalCriticalCount > 1 ? 's' : ''} crítica${totalCriticalCount > 1 ? 's' : ''} e ${totalDelayedCount} atrasada${totalDelayedCount > 1 ? 's' : ''}`
                : totalCriticalCount > 0
                ? `Hoje você tem ${totalCriticalCount} tarefa${totalCriticalCount > 1 ? 's críticas' : ' crítica'} para acompanhar`
                : `Hoje você tem ${totalDelayedCount} tarefa${totalDelayedCount > 1 ? 's atrasadas' : ' atrasada'} para resolver`
              }
            </p>
          )}
        </div>
      </div>

      {/* ── Section 1: Tarefas Críticas ────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Flame className="w-4 h-4 text-red-500" />}
          title="Tarefas Críticas de Hoje"
          count={criticalTasks.length}
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        {criticalTasks.length === 0 ? (
          <EmptyState message="Nenhuma tarefa crítica ativa no momento" />
        ) : (
          <div className="grid gap-3">
            {criticalTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isCritical
                delayDays={task.endDate < todayStr ? diffDays(task.endDate, todayStr) : undefined}
                onUpdateProgress={handleUpdateProgress}
                onComplete={handleComplete}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Previstas para Hoje ────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Clock className="w-4 h-4 text-blue-500" />}
          title="Previstas para Hoje"
          count={scheduledToday.length}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        {scheduledToday.length === 0 ? (
          <EmptyState message="Nenhuma tarefa adicional prevista para hoje" />
        ) : (
          <div className="grid gap-3">
            {scheduledToday.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdateProgress={handleUpdateProgress}
                onComplete={handleComplete}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Tarefas Atrasadas ──────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          title="Tarefas Atrasadas"
          count={delayedTasks.length}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        {delayedTasks.length === 0 ? (
          <EmptyState message="Nenhuma tarefa atrasada fora do caminho crítico" />
        ) : (
          <div className="grid gap-3">
            {delayedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                delayDays={diffDays(task.endDate, todayStr)}
                onUpdateProgress={handleUpdateProgress}
                onComplete={handleComplete}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        )}
      </section>

      {/* Filler if everything is ok */}
      {totalAttentionCount === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Obra no ritmo!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Todas as tarefas estão dentro do planejado. Continue assim!
            </p>
          </div>
        </div>
      )}

      {/* ── Legend bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground font-semibold px-5 py-3.5 bg-muted/20 rounded-2xl border border-border/30">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-red-500" />
          <span className="uppercase tracking-widest text-[9px]">Caminho Crítico</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span className="uppercase tracking-widest text-[9px]">Prevista Hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="uppercase tracking-widest text-[9px]">Atrasada</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
          <span className="uppercase tracking-widest text-[9px]">Impedida</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="uppercase tracking-widest text-[9px]">Atualizado em tempo real</span>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ProgressDialog
        task={progressTask}
        open={showProgressDialog}
        onClose={() => { setShowProgressDialog(false); setProgressTask(null); }}
        onConfirm={handleConfirmProgress}
      />

      <RescheduleModal
        task={rescheduleTask}
        isOpen={rescheduleTask !== null}
        onClose={() => setRescheduleTask(null)}
        projectId={project.id}
      />
    </div>
  );
}

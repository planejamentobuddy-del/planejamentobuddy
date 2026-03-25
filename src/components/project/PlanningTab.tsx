import { useState, useMemo } from 'react';
import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Plus, Trash2, ChevronRight, ChevronDown, AlertTriangle, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function isOverdue(task: Task): boolean {
  if (task.percentComplete >= 100) return false;
  const now = new Date().toISOString().split('T')[0];
  return task.endDate < now;
}

function getAutoStatus(percent: number, overdue: boolean): string {
  if (overdue) return 'Atrasado';
  if (percent === 0) return 'Não iniciado';
  if (percent >= 100) return 'Concluído';
  return 'Em andamento';
}

function getStatusColor(percent: number, overdue: boolean): string {
  if (overdue) return 'hsl(0 72% 51%)';
  if (percent >= 100) return 'hsl(152 60% 42%)';
  if (percent > 0) return 'hsl(243 76% 58%)';
  return 'hsl(220 15% 80%)';
}

function ProgressBar({ percent, overdue }: { percent: number; overdue: boolean }) {
  const color = getStatusColor(percent, overdue);
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatusBadge({ percent, overdue }: { percent: number; overdue: boolean }) {
  const label = getAutoStatus(percent, overdue);
  let classes = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ';
  if (overdue) classes += 'bg-destructive/10 text-destructive';
  else if (percent >= 100) classes += 'bg-[hsl(152_60%_42%/0.1)] text-[hsl(152,60%,42%)]';
  else if (percent > 0) classes += 'bg-primary/10 text-primary';
  else classes += 'bg-muted text-muted-foreground';

  return (
    <span className={classes}>
      {overdue && <AlertTriangle className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default function PlanningTab({ project }: { project: Project }) {
  const { getTasksForProject, addTask, updateTask, deleteTask } = useProjects();
  const allTasks = getTasksForProject(project.id);

  // Separate stages (no parentId) and subtasks
  const stages = useMemo(() => allTasks.filter(t => !t.parentId), [allTasks]);
  const getSubtasks = (stageId: string) => allTasks.filter(t => t.parentId === stageId);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));

  const toggleExpand = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Compute stage aggregates from subtasks
  const getStageAggregates = (stageId: string) => {
    const subs = getSubtasks(stageId);
    if (subs.length === 0) return null;
    const percent = Math.round(subs.reduce((s, t) => s + t.percentComplete, 0) / subs.length);
    const starts = subs.map(t => t.startDate).filter(Boolean).sort();
    const ends = subs.map(t => t.endDate).filter(Boolean).sort();
    const startDate = starts[0] || '';
    const endDate = ends[ends.length - 1] || '';
    const duration = startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0;
    const hasOverdue = subs.some(t => isOverdue(t));
    return { percent, startDate, endDate, duration, hasOverdue };
  };

  const handleAddStage = () => {
    const start = project.startDate;
    const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().split('T')[0];
    const task = addTask({
      projectId: project.id,
      name: 'Nova Etapa',
      startDate: start,
      endDate: end,
      duration: 7,
      percentComplete: 0,
      responsible: '',
      predecessors: [],
      hasRestriction: false,
      restrictionType: '',
      status: 'not_started',
      observations: '',
    });
    setExpandedStages(prev => new Set([...prev, task.id]));
  };

  const handleAddSubtask = (stageId: string) => {
    const stage = allTasks.find(t => t.id === stageId);
    const start = stage?.startDate || project.startDate;
    const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().split('T')[0];
    addTask({
      projectId: project.id,
      parentId: stageId,
      name: 'Nova Subetapa',
      startDate: start,
      endDate: end,
      duration: 7,
      percentComplete: 0,
      responsible: '',
      predecessors: [],
      hasRestriction: false,
      restrictionType: '',
      status: 'not_started',
      observations: '',
    });
    setExpandedStages(prev => new Set([...prev, stageId]));
  };

  const handleSubtaskChange = (task: Task, field: keyof Task, value: any) => {
    const updated = { ...task, [field]: value };
    if (field === 'startDate' || field === 'endDate') {
      const s = new Date(updated.startDate).getTime();
      const e = new Date(updated.endDate).getTime();
      updated.duration = Math.max(1, Math.round((e - s) / 86400000));
    }
    if (field === 'duration') {
      const s = new Date(updated.startDate).getTime();
      updated.endDate = new Date(s + value * 86400000).toISOString().split('T')[0];
    }
    if (field === 'percentComplete') {
      updated.percentComplete = Math.min(100, Math.max(0, value));
      if (updated.percentComplete >= 100) updated.status = 'completed';
      else if (updated.percentComplete > 0) updated.status = 'in_progress';
      else updated.status = 'not_started';
    }
    updateTask(updated);
  };

  const handleDeleteStage = (stageId: string) => {
    // Delete subtasks first
    getSubtasks(stageId).forEach(sub => deleteTask(sub.id));
    deleteTask(stageId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Planejamento</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie etapas e subetapas da obra</p>
        </div>
        <Button onClick={handleAddStage} className="gap-2 rounded-full px-5 shadow-sm">
          <Plus className="w-4 h-4" /> Adicionar Etapa
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_120px_120px_1fr_48px] gap-0 bg-muted/40 border-b px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Etapa / Atividade</span>
          <span>Responsável</span>
          <span>Início</span>
          <span>Término</span>
          <span>Dias</span>
          <span>% Execução</span>
          <span>Status</span>
          <span>Observações</span>
          <span></span>
        </div>

        {/* Stages */}
        {stages.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma etapa cadastrada.</p>
            <p className="text-xs mt-1">Clique em "Adicionar Etapa" para começar.</p>
          </div>
        )}

        {stages.map(stage => {
          const subtasks = getSubtasks(stage.id);
          const agg = getStageAggregates(stage.id);
          const isExpanded = expandedStages.has(stage.id);
          const stagePercent = agg ? agg.percent : stage.percentComplete;
          const stageOverdue = agg ? agg.hasOverdue : isOverdue(stage);

          return (
            <div key={stage.id} className="border-b last:border-b-0">
              {/* Stage Row */}
              <div
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_80px_120px_120px_1fr_48px] gap-0 items-center px-4 py-2.5 transition-colors ${
                  stageOverdue ? 'bg-destructive/5' : 'hover:bg-muted/20'
                }`}
              >
                {/* Name with expand toggle */}
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => toggleExpand(stage.id)}
                    className="p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                  <Input
                    className="h-8 text-sm font-semibold border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                    value={stage.name}
                    onChange={e => {
                      updateTask({ ...stage, name: e.target.value });
                    }}
                  />
                  {stageOverdue && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                </div>

                {/* Responsible (editable on stage) */}
                <div className="pr-2">
                  <Input
                    className="h-8 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                    value={stage.responsible}
                    onChange={e => updateTask({ ...stage, responsible: e.target.value })}
                    placeholder="—"
                  />
                </div>

                {/* Dates - computed from subtasks */}
                <span className="text-sm text-muted-foreground px-2">
                  {agg?.startDate ? new Date(agg.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
                <span className="text-sm text-muted-foreground px-2">
                  {agg?.endDate ? new Date(agg.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </span>

                {/* Duration - computed */}
                <span className="text-sm text-muted-foreground px-2">
                  {agg ? `${agg.duration}d` : '—'}
                </span>

                {/* Progress - computed */}
                <div className="px-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${stageOverdue ? 'text-destructive' : 'text-foreground'}`}>
                      {stagePercent}%
                    </span>
                  </div>
                  <ProgressBar percent={stagePercent} overdue={stageOverdue} />
                </div>

                {/* Status - computed */}
                <div className="px-2">
                  <StatusBadge percent={stagePercent} overdue={stageOverdue} />
                </div>

                {/* Observations */}
                <div className="pr-2">
                  <Input
                    className="h-8 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                    value={stage.observations || ''}
                    onChange={e => updateTask({ ...stage, observations: e.target.value })}
                    placeholder="—"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteStage(stage.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Subtasks */}
              {isExpanded && (
                <div className="bg-muted/10">
                  {subtasks.map(sub => {
                    const subOverdue = isOverdue(sub);
                    return (
                      <div
                        key={sub.id}
                        className={`grid grid-cols-[2fr_1fr_1fr_1fr_80px_120px_120px_1fr_48px] gap-0 items-center px-4 py-1.5 border-t border-dashed transition-colors ${
                          subOverdue ? 'bg-destructive/5' : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Name indented */}
                        <div className="flex items-center gap-2 pl-9 pr-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <Input
                            className="h-7 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                            value={sub.name}
                            onChange={e => handleSubtaskChange(sub, 'name', e.target.value)}
                          />
                          {subOverdue && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        </div>

                        {/* Responsible */}
                        <div className="pr-2">
                          <Input
                            className="h-7 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                            value={sub.responsible}
                            onChange={e => handleSubtaskChange(sub, 'responsible', e.target.value)}
                            placeholder="—"
                          />
                        </div>

                        {/* Start Date */}
                        <div className="pr-2">
                          <Input
                            type="date"
                            className="h-7 text-xs border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-1"
                            value={sub.startDate}
                            onChange={e => handleSubtaskChange(sub, 'startDate', e.target.value)}
                          />
                        </div>

                        {/* End Date */}
                        <div className="pr-2">
                          <Input
                            type="date"
                            className="h-7 text-xs border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-1"
                            value={sub.endDate}
                            onChange={e => handleSubtaskChange(sub, 'endDate', e.target.value)}
                          />
                        </div>

                        {/* Duration */}
                        <div className="pr-2">
                          <Input
                            type="number"
                            className="h-7 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2 w-14"
                            value={sub.duration}
                            onChange={e => handleSubtaskChange(sub, 'duration', parseInt(e.target.value) || 1)}
                          />
                        </div>

                        {/* Progress */}
                        <div className="px-2 space-y-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-7 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2 w-16"
                            value={sub.percentComplete}
                            onChange={e => handleSubtaskChange(sub, 'percentComplete', parseInt(e.target.value) || 0)}
                          />
                          <ProgressBar percent={sub.percentComplete} overdue={subOverdue} />
                        </div>

                        {/* Status */}
                        <div className="px-2">
                          <StatusBadge percent={sub.percentComplete} overdue={subOverdue} />
                        </div>

                        {/* Observations */}
                        <div className="pr-2">
                          <Input
                            className="h-7 text-sm border-0 bg-transparent rounded-lg focus-visible:bg-muted/50 px-2"
                            value={sub.observations || ''}
                            onChange={e => handleSubtaskChange(sub, 'observations', e.target.value)}
                            placeholder="—"
                          />
                        </div>

                        {/* Delete */}
                        <div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTask(sub.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add subtask button */}
                  <div className="px-4 py-2 border-t border-dashed">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground hover:text-primary pl-9"
                      onClick={() => handleAddSubtask(stage.id)}
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Subetapa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

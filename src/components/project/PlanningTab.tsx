import { useState, useMemo } from 'react';
import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, GripVertical, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Não iniciado', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'Em andamento', color: 'bg-accent/10 text-accent' },
  { value: 'completed', label: 'Concluído', color: 'bg-[hsl(152_60%_42%/0.1)] text-status-ok' },
  { value: 'delayed', label: 'Atrasado', color: 'bg-destructive/10 text-destructive' },
];

function isOverdue(task: Task): boolean {
  if (task.percentComplete >= 100) return false;
  const now = new Date().toISOString().split('T')[0];
  return task.endDate < now;
}

export default function PlanningTab({ project }: { project: Project }) {
  const { getTasksForProject, addTask, updateTask, deleteTask } = useProjects();
  const allTasks = getTasksForProject(project.id);

  const stages = useMemo(() => allTasks.filter(t => !t.parentId), [allTasks]);
  const getSubtasks = (stageId: string) => allTasks.filter(t => t.parentId === stageId);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set(stages.map(s => s.id)));

  const toggleExpand = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleChange = (task: Task, field: keyof Task, value: any) => {
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

  const handleDuplicate = (task: Task) => {
    addTask({
      projectId: task.projectId,
      parentId: task.parentId,
      name: `${task.name} (cópia)`,
      startDate: task.startDate,
      endDate: task.endDate,
      duration: task.duration,
      percentComplete: 0,
      responsible: task.responsible,
      predecessors: [],
      hasRestriction: false,
      restrictionType: '',
      status: 'not_started',
      observations: '',
    });
  };

  const handleDeleteStage = (stageId: string) => {
    getSubtasks(stageId).forEach(sub => deleteTask(sub.id));
    deleteTask(stageId);
  };

  // Get all tasks for predecessor/successor dropdowns (only non-parent tasks or all)
  const allTaskOptions = allTasks.map(t => ({ id: t.id, name: t.name }));

  const formatDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const StatusBadge = ({ status }: { status: TaskStatus }) => {
    const opt = statusOptions.find(o => o.value === status) || statusOptions[0];
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  const renderRow = (task: Task, isSubtask: boolean, stageId?: string) => {
    const overdue = isOverdue(task);
    const isStage = !isSubtask;
    const agg = isStage ? getStageAggregates(task.id) : null;
    const percent = agg ? agg.percent : task.percentComplete;
    const effectiveOverdue = agg ? agg.hasOverdue : overdue;
    const effectiveStatus = effectiveOverdue ? 'delayed' as TaskStatus : (agg ? (percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started') : task.status);

    return (
      <tr
        key={task.id}
        className={`border-b border-border/50 transition-colors ${effectiveOverdue ? 'bg-destructive/[0.02]' : 'hover:bg-muted/30'}`}
      >
        {/* Drag + Name */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
            {isStage ? (
              <button onClick={() => toggleExpand(task.id)} className="p-0.5 shrink-0">
                {expandedStages.has(task.id)
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                }
              </button>
            ) : (
              <span className="text-muted-foreground/40 text-xs pl-5 shrink-0">↳</span>
            )}
            <Input
              className={`h-8 text-sm border-0 bg-transparent px-1.5 ${isStage ? 'font-semibold' : ''} ${effectiveOverdue ? 'text-destructive' : ''}`}
              value={task.name}
              onChange={e => handleChange(task, 'name', e.target.value)}
            />
            {effectiveOverdue && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
          </div>
        </td>

        {/* Responsible */}
        <td className="py-2.5 px-3">
          <Input
            className="h-8 text-sm border-0 bg-transparent px-1.5"
            value={task.responsible}
            onChange={e => handleChange(task, 'responsible', e.target.value)}
            placeholder="—"
          />
        </td>

        {/* Start */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground">
          {isStage && agg ? formatDate(agg.startDate) : (
            <Input type="date" className="h-8 text-xs border-0 bg-transparent px-1" value={task.startDate} onChange={e => handleChange(task, 'startDate', e.target.value)} />
          )}
        </td>

        {/* End */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground">
          {isStage && agg ? formatDate(agg.endDate) : (
            <Input type="date" className="h-8 text-xs border-0 bg-transparent px-1" value={task.endDate} onChange={e => handleChange(task, 'endDate', e.target.value)} />
          )}
        </td>

        {/* Duration */}
        <td className="py-2.5 px-3 text-center">
          <span className="text-sm font-medium">{agg ? agg.duration : task.duration}</span>
        </td>

        {/* % Execution with slider */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2 min-w-[120px]">
            {isStage && agg ? (
              <>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-xs font-medium w-8 text-right">{percent}%</span>
              </>
            ) : (
              <>
                <Slider
                  value={[task.percentComplete]}
                  onValueChange={([v]) => handleChange(task, 'percentComplete', v)}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs font-medium w-8 text-right">{task.percentComplete}%</span>
              </>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="py-2.5 px-3">
          {isStage && agg ? (
            <StatusBadge status={effectiveStatus} />
          ) : (
            <Select value={task.status} onValueChange={v => handleChange(task, 'status', v as TaskStatus)}>
              <SelectTrigger className="h-8 text-xs border-0 bg-transparent px-1">
                <StatusBadge status={task.status} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </td>

        {/* Predecessors */}
        <td className="py-2.5 px-3">
          <Select
            value={task.predecessors[0] || '_none'}
            onValueChange={v => handleChange(task, 'predecessors', v === '_none' ? [] : [v])}
          >
            <SelectTrigger className="h-8 text-xs border-0 bg-transparent px-1">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">—</SelectItem>
              {allTaskOptions.filter(t => t.id !== task.id).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>

        {/* Successors (read-only computed) */}
        <td className="py-2.5 px-3 text-xs text-muted-foreground">
          {allTasks.filter(t => t.predecessors.includes(task.id)).map(t => t.name).join(', ') || '—'}
        </td>

        {/* Observations */}
        <td className="py-2.5 px-3">
          <Input
            className="h-8 text-sm border-0 bg-transparent px-1.5"
            value={task.observations || ''}
            onChange={e => handleChange(task, 'observations', e.target.value)}
            placeholder="..."
          />
        </td>

        {/* Actions */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-0.5">
            {isStage && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleAddSubtask(task.id)} title="Adicionar subetapa">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDuplicate(task)} title="Duplicar">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => isStage ? handleDeleteStage(task.id) : deleteTask(task.id)} title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-lg text-foreground">Planejamento</h2>
        <Button onClick={handleAddStage} className="gap-2 rounded-xl px-5 shadow-sm">
          <Plus className="w-4 h-4" /> Adicionar Etapa
        </Button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="text-sm table-fixed" style={{ width: colWidths.reduce((s, w) => s + w, 0) }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/30">
              {columnHeaders.map((h, i) => (
                <th key={i} className={`${h.align === 'center' ? 'text-center' : 'text-left'} py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground relative`}>
                  {h.label}
                  <ResizeHandle index={i} onMouseDown={onColResize} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 && (
              <tr>
                <td colSpan={columnHeaders.length} className="py-16 text-center text-muted-foreground text-sm">
                  Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.
                </td>
              </tr>
            )}
            {stages.map(stage => {
              const subtasks = getSubtasks(stage.id);
              const isExpanded = expandedStages.has(stage.id);
              return (
                <tbody key={stage.id}>
                  {renderRow(stage, false)}
                  {isExpanded && subtasks.map(sub => renderRow(sub, true, stage.id))}
                  {isExpanded && (
                    <tr className="border-b border-dashed">
                      <td colSpan={columnHeaders.length} className="py-1.5 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-muted-foreground hover:text-primary pl-10"
                          onClick={() => handleAddSubtask(stage.id)}
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Subetapa
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

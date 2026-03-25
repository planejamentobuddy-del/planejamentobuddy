import { useState, useMemo, Fragment } from 'react';
import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, GripVertical, Copy, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Não iniciado', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'Em andamento', color: 'bg-blue-500/15 text-blue-500' },
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
  const { isAdmin } = useAuth();
  const allTasks = getTasksForProject(project.id);

  const stages = useMemo(() => allTasks.filter(t => !t.parentId), [allTasks]);
  const getSubtasks = (stageId: string) => allTasks.filter(t => t.parentId === stageId);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set(stages.map(s => s.id)));

  const columnHeaders = [
    { label: 'Etapa / Atividade', align: 'left', width: 300 },
    { label: 'Responsável', align: 'left', width: 140 },
    { label: 'Início', align: 'left', width: 110 },
    { label: 'Término', align: 'left', width: 110 },
    { label: 'Duração', align: 'center', width: 80 },
    { label: '% Execução', align: 'left', width: 140 },
    { label: 'Status', align: 'left', width: 140 },
    { label: 'Predecessoras', align: 'left', width: 160 },
    { label: 'Sucessoras', align: 'left', width: 160 },
    { label: 'Observações', align: 'left', width: 200 },
    { label: 'Ações', align: 'center', width: 100 },
  ];

  const { widths: colWidths, onMouseDown: onColResize } = useResizableColumns(
    columnHeaders.map(h => h.width)
  );

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

  const handleAddStage = async () => {
    const start = project.startDate;
    const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().split('T')[0];
    const task = await addTask({
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
    if (task) {
      setExpandedStages(prev => new Set([...prev, task.id]));
    }
  };

  const handleAddSubtask = async (stageId: string) => {
    const stage = allTasks.find(t => t.id === stageId);
    const start = stage?.startDate || project.startDate;
    const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().split('T')[0];
    await addTask({
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

  const handleChange = async (task: Task, field: keyof Task, value: any) => {
    // For date fields: only proceed if the value is a complete, valid date (YYYY-MM-DD)
    if ((field === 'startDate' || field === 'endDate') && typeof value === 'string') {
      if (value.length < 10 || isNaN(new Date(value).getTime())) return;
    }
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
    await updateTask(updated);
  };

  const handleDuplicate = async (task: Task) => {
    await addTask({
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

  const handleDeleteStage = async (stageId: string) => {
    const subs = getSubtasks(stageId);
    await Promise.all(subs.map(sub => deleteTask(sub.id)));
    await deleteTask(stageId);
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
        {/* 1. Etapa / Atividade */}
        <td className="py-2.5 px-3 border-r border-border/40 min-w-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0 cursor-grab" />
            {isStage ? (
              <button onClick={() => toggleExpand(task.id)} className="p-0.5 shrink-0 hover:bg-muted rounded transition-colors">
                {expandedStages.has(task.id)
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                }
              </button>
            ) : (
              <span className="text-muted-foreground/30 text-xs pl-5 shrink-0">↳</span>
            )}
            <Input
              className={`h-8 text-sm border-0 bg-transparent px-1.5 focus-visible:ring-1 focus-visible:ring-primary/30 truncate ${isStage ? 'font-bold text-foreground' : 'text-foreground/80'}`}
              value={task.name}
              onChange={e => handleChange(task, 'name', e.target.value)}
              placeholder={isStage ? "Nova Etapa..." : "Nova Subetapa..."}
            />
          </div>
        </td>

        {/* 2. Responsável */}
        <td className="py-2.5 px-3 border-r border-border/40">
          <Input
            className="h-8 text-sm border-0 bg-transparent px-1.5 focus-visible:ring-1 focus-visible:ring-primary/30"
            value={task.responsible || ''}
            onChange={e => handleChange(task, 'responsible', e.target.value)}
            placeholder="—"
          />
        </td>

        {/* 3. Início */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground border-r border-border/40">
          {isStage && agg ? (
            <div className="px-1.5 py-1 font-medium">{formatDate(agg.startDate)}</div>
          ) : (
            <Input 
              type="date" 
              className="h-8 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30" 
              value={task.startDate} 
              onChange={e => handleChange(task, 'startDate', e.target.value)} 
            />
          )}
        </td>

        {/* 4. Término */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground border-r border-border/40">
          {isStage && agg ? (
            <div className="px-1.5 py-1 font-medium">{formatDate(agg.endDate)}</div>
          ) : (
            <Input 
              type="date" 
              className="h-8 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30" 
              value={task.endDate} 
              onChange={e => handleChange(task, 'endDate', e.target.value)} 
            />
          )}
        </td>

        {/* 5. Duração */}
        <td className="py-2.5 px-3 text-center border-r border-border/40 font-medium">
          {isStage && agg ? (
            <span className="text-sm">{agg.duration}</span>
          ) : (
            <Input
              type="number"
              className="h-8 w-full text-center text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
              value={task.duration}
              onChange={e => handleChange(task, 'duration', parseInt(e.target.value) || 0)}
            />
          )}
        </td>

        {/* 6. % Execução */}
        <td className="py-2.5 px-3 border-r border-border/40">
          <div className="flex items-center gap-2 min-w-[120px]">
            {isStage && agg ? (
              <>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-[#2A9D8F]' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
                </div>
                <span className="text-xs font-semibold w-8 text-right">{percent}%</span>
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
                <span className="text-xs font-semibold w-8 text-right">{task.percentComplete}%</span>
              </>
            )}
          </div>
        </td>

        {/* 7. Status */}
        <td className="py-2.5 px-3 border-r border-border/40">
          <Select 
            value={isStage && agg ? effectiveStatus : task.status} 
            onValueChange={v => handleChange(task, 'status', v as TaskStatus)}
          >
            <SelectTrigger className="h-8 w-full text-xs border-0 bg-transparent px-1 hover:bg-primary/5 transition-colors group">
              <StatusBadge status={isStage && agg ? effectiveStatus : task.status} />
              <ChevronDown className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>

        {/* 8. Predecessoras */}
        <td className="py-2.5 px-3 border-r border-border/40">
          <Select
            value={task.predecessors[0] || '_none'}
            onValueChange={v => handleChange(task, 'predecessors', v === '_none' ? [] : [v])}
          >
            <SelectTrigger className="h-8 w-full text-xs border-0 bg-transparent px-1 hover:bg-primary/5 transition-colors">
              <SelectValue placeholder="—" />
              <ChevronDown className="w-3 h-3 ml-auto opacity-30" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">—</SelectItem>
              {allTaskOptions.filter(t => t.id !== task.id).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>

        {/* 9. Sucessoras */}
        <td className="py-2.5 px-3 text-xs text-muted-foreground border-r border-border/40">
          <div className="truncate w-full px-1" title={allTasks.filter(t => t.predecessors.includes(task.id)).map(t => t.name).join(', ') || '—'}>
            {allTasks.filter(t => t.predecessors.includes(task.id)).map(t => t.name).join(', ') || '—'}
          </div>
        </td>

        {/* 10. Observações */}
        <td className="py-2.5 px-3 border-r border-border/40">
          <Input
            className="h-8 text-sm border-0 bg-transparent px-1.5 focus-visible:ring-1 focus-visible:ring-primary/30"
            value={task.observations || ''}
            onChange={e => handleChange(task, 'observations', e.target.value)}
            placeholder="..."
          />
        </td>

        {/* 11. Ações */}
        <td className="py-2.5 px-3">
          <div className="flex items-center justify-center gap-0.5">
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
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-lg text-foreground">Planejamento</h2>
        </div>
        <Button onClick={handleAddStage} className="gap-2 rounded-xl px-5 shadow-sm">
          <Plus className="w-4 h-4" /> Adicionar Etapa
        </Button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="border-collapse table-fixed text-sm" style={{ width: colWidths.reduce((s, w) => s + w, 0) }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/50 border-t border-border/50">
              {columnHeaders.map((h, i) => (
                <th 
                  key={i} 
                  style={{ width: colWidths[i] }}
                  className={`${h.align === 'center' ? 'text-center' : 'text-left'} py-3.5 px-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground relative border-r border-border/50 last:border-0`}
                >
                  <div className="truncate">{h.label}</div>
                  <ResizeHandle index={i} onMouseDown={onColResize} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 ? (
              <tr>
                <td colSpan={columnHeaders.length} className="py-16 text-center text-muted-foreground text-sm">
                  Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.
                </td>
              </tr>
            ) : (
              stages.map(stage => {
                const subtasks = getSubtasks(stage.id);
                const isExpanded = expandedStages.has(stage.id);
                return (
                  <Fragment key={stage.id}>
                    {renderRow(stage, false)}
                    {isExpanded && subtasks.map(sub => renderRow(sub, true, stage.id))}
                    {isExpanded && (
                      <tr className="border-b border-dashed bg-muted/5">
                        <td colSpan={columnHeaders.length} className="py-2 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pl-10 h-7"
                            onClick={() => handleAddSubtask(stage.id)}
                          >
                            <Plus className="w-3.5 h-3.5" /> Adicionar Subetapa
                          </Button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

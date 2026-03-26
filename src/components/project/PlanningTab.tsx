import { useState, useMemo, Fragment } from 'react';
import { Project, Task, TaskStatus, getProjectProgress } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, GripVertical, Copy, Lock, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

function getBusinessDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr + 'T12:00:00');
  const end = new Date(endDateStr + 'T12:00:00');
  if (start > end) return 0;
  let days = 1;
  let current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

function addBusinessDays(startDateStr: string, duration: number): string {
  if (!startDateStr || duration < 1) return startDateStr;
  const d = new Date(startDateStr + 'T12:00:00');
  let added = 1;
  while (added < duration) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}


export default function PlanningTab({ project }: { project: Project }) {
  const { getTasksForProject, addTask, updateTask, deleteTask, users } = useProjects();
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
    
    // Only count leaf tasks within this stage for the weighted progress
    const parentIds = new Set(subs.filter(t => t.parentId).map(t => t.parentId!));
    const leaves = subs.filter(t => !parentIds.has(t.id));
    // If no leaves (all are parents), we'd need a recursive approach, 
    // but for current 2-level structure, we just take all if no leaves identified 
    // (though in 2-level, subtasks are always leaves relative to the stage)
    const targets = leaves.length > 0 ? leaves : subs;

    const totalDuration = targets.reduce((sum, t) => sum + Math.max(1, t.duration), 0);
    const weightedSum = targets.reduce((sum, t) => sum + (t.percentComplete * Math.max(1, t.duration)), 0);
    const percent = totalDuration > 0 ? Math.round(weightedSum / totalDuration) : 0;
    
    const starts = subs.map(t => t.startDate).filter(Boolean).sort();
    const ends = subs.map(t => t.endDate).filter(Boolean).sort();
    const startDate = starts[0] || '';
    const endDate = ends[ends.length - 1] || '';
    const duration = getBusinessDays(startDate, endDate);
    const hasOverdue = subs.some(t => isOverdue(t));
    return { percent, startDate, endDate, duration, hasOverdue };
  };

  const projectAggregate = useMemo(() => {
    if (allTasks.length === 0) return null;
    
    const percent = getProjectProgress(allTasks);

    const parentIds = new Set(allTasks.filter(t => t.parentId).map(t => t.parentId!));
    const leaves = allTasks.filter(t => !parentIds.has(t.id));
    const starts = leaves.map(t => t.startDate).filter(Boolean).sort();
    const ends = leaves.map(t => t.endDate).filter(Boolean).sort();
    
    return { 
      percent, 
      startDate: starts[0] || '', 
      endDate: ends[ends.length - 1] || '',
      duration: getBusinessDays(starts[0], ends[ends.length - 1])
    };
  }, [allTasks]);

  const handleAddStage = async () => {
    const start = project.startDate;
    const end = addBusinessDays(start, 7);
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
    const end = addBusinessDays(start, 7);
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

    // ── Fix 3: When predecessors change, auto-adjust start/end dates ──
    if (field === 'predecessors') {
      const predIds: string[] = value;
      if (predIds.length > 0) {
        // Find the latest end date among all predecessors
        const predTasks = allTasks.filter(t => predIds.includes(t.id));
        if (predTasks.length > 0) {
          const latestEnd = predTasks
            .map(p => p.endDate)
            .sort()
            .pop()!;
          // Start = next business day after predecessor ends
          const newStart = addBusinessDays(latestEnd, 2); // 1 day past = next business day
          // Keep the same duration, recalculate end
          const dur = task.duration || 1;
          const newEnd = addBusinessDays(newStart, dur);
          updated.startDate = newStart;
          updated.endDate = newEnd;
          updated.duration = dur;
        }
      }
    }

    if (field === 'startDate' || field === 'endDate') {
      updated.duration = Math.max(1, getBusinessDays(updated.startDate, updated.endDate));
    }
    if (field === 'duration') {
      updated.endDate = addBusinessDays(updated.startDate, value);
    }
    if (field === 'percentComplete') {
      updated.percentComplete = Math.min(100, Math.max(0, value));
      if (updated.percentComplete >= 100) updated.status = 'completed';
      else if (updated.percentComplete > 0) updated.status = 'in_progress';
      else updated.status = 'not_started';
    }
    await updateTask(updated);

    // ── Propagate to successors: cascade date changes ──
    if (field === 'endDate' || field === 'duration' || field === 'startDate' || field === 'predecessors') {
      const finalEndDate = updated.endDate;
      const successors = allTasks.filter(t => t.predecessors.includes(task.id));
      for (const succ of successors) {
        const succStart = addBusinessDays(finalEndDate, 2);
        const succEnd = addBusinessDays(succStart, succ.duration || 1);
        if (succStart !== succ.startDate || succEnd !== succ.endDate) {
          await updateTask({
            ...succ,
            startDate: succStart,
            endDate: succEnd,
          });
        }
      }
    }
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
            list="users-list"
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
              <>
                {/* Project Summary Row (Geral) */}
                {projectAggregate && (
                  <tr className="bg-primary/5 font-bold border-b-2 border-primary/20 hover:bg-primary/10 transition-colors">
                    <td className="p-0 border-r border-border/50">
                      <div className="flex items-center gap-3 py-3.5 px-3 min-w-[300px]" style={{ width: colWidths[0] }}>
                        <div className="bg-primary/20 p-1.5 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-sm font-black text-primary uppercase tracking-tight">RESUMO GERAL DO PROJETO</span>
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3" style={{ width: colWidths[1] }} />
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[2] }}>
                        {projectAggregate.startDate ? new Date(projectAggregate.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[3] }}>
                        {projectAggregate.endDate ? new Date(projectAggregate.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50 text-center">
                      <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[4] }}>
                        {projectAggregate.duration} dias
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3 flex items-center gap-2" style={{ width: colWidths[5] }}>
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${projectAggregate.percent}%` }} />
                        </div>
                        <span className="text-xs text-primary">{projectAggregate.percent}%</span>
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3" style={{ width: colWidths[6] }}>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">GERAL</Badge>
                      </div>
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3" style={{ width: colWidths[7] }} />
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3" style={{ width: colWidths[8] }} />
                    </td>
                    <td className="p-0 border-r border-border/50">
                      <div className="px-3" style={{ width: colWidths[9] }} />
                    </td>
                    <td className="p-0" style={{ width: colWidths[10] }} />
                  </tr>
                )}

                {stages.map(stage => {
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
                })}
              </>
            )}
          </tbody>
        </table>
      <datalist id="users-list">
        {users.map(u => <option key={u.id} value={u.full_name} />)}
      </datalist>
    </div>
    </div>
  );
}

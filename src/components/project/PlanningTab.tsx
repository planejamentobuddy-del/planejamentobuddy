import React, { useState, useMemo, Fragment, useEffect } from 'react';
import { Project, Task, TaskStatus, getProjectProgress, StatusComment, safeParseDate } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, GripVertical, Copy, Lock, TrendingUp, CalendarClock, History, ChevronsDownUp, ChevronsUpDown, Eye, TableProperties } from 'lucide-react';
import StatusCommentLog from './StatusCommentLog';
import TeamTab from './TeamTab';
import AssignmentsTab from './AssignmentsTab';
import { RescheduleModal } from './RescheduleModal';
import { RescheduleHistoryModal } from './RescheduleHistoryModal';
import { TaskDetailModal } from './TaskDetailModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { Calendar, Users, CheckSquare } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Não iniciado', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'Em andamento', color: 'bg-blue-600/10 text-blue-600 border border-blue-600/20' },
  { value: 'completed', label: 'Concluído', color: 'bg-status-ok/10 text-status-ok border border-status-ok/20' },
  { value: 'delayed', label: 'Atrasado', color: 'bg-status-danger/10 text-status-danger border border-status-danger/20' },
  { value: 'rescheduled', label: 'Reprogramada', color: 'bg-amber-500/10 text-amber-600 border border-amber-500/20' },
];

function isOverdue(task: Task): boolean {
  if (task.percentComplete >= 100) return false;
  const now = new Date().toISOString().split('T')[0];
  const nowTs = safeParseDate(now);
  const endTs = safeParseDate(task.currentEnd || task.endDate);
  return endTs < nowTs;
}

function getBusinessDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = safeParseDate(startDateStr);
  const end = safeParseDate(endDateStr);
  if (start > end) return 0;
  let days = 1;
  let current = new Date(start);
  while (current.getTime() < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

function addBusinessDays(startDateStr: string, duration: number): string {
  if (!startDateStr || duration < 1) return startDateStr;
  const d = new Date(safeParseDate(startDateStr));
  let added = 1;
  while (added < duration) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

// ── Searchable Predecessor Picker ──────────────────────────────────────────
function PredecessorPicker({
  task,
  allTaskOptions,
  allTasks,
  onChange,
}: {
  task: Task;
  allTaskOptions: { id: string; name: string }[];
  allTasks: Task[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedId = task.predecessors[0] || null;
  const selectedName = selectedId
    ? (allTaskOptions.find(t => t.id === selectedId)?.name ?? allTasks.find(t => t.id === selectedId)?.name ?? '—')
    : '—';

  const filtered = allTaskOptions.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-8 w-full text-xs text-left flex items-center gap-1 px-1.5 rounded hover:bg-primary/5 transition-colors truncate"
          title={selectedName}
        >
          <span className="truncate flex-1">{selectedName}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-30" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="bottom">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Pesquisar tarefa..."
            value={search}
            onValueChange={setSearch}
            className="text-xs h-9"
          />
          <CommandList>
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Nenhuma tarefa encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="_none"
                onSelect={() => { onChange('_none'); setOpen(false); setSearch(''); }}
                className="text-xs text-muted-foreground"
              >
                — Sem predecessora
              </CommandItem>
              {filtered.map(t => (
                <CommandItem
                  key={t.id}
                  value={t.id}
                  onSelect={() => { onChange(t.id); setOpen(false); setSearch(''); }}
                  className={`text-xs ${selectedId === t.id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                >
                  <span className="truncate">{t.name}</span>
                  {selectedId === t.id && <span className="ml-auto text-primary">✓</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export default function PlanningTab({ project }: { project: Project }) {
  const { getTasksForProject, addTask, updateTask, updateTasksBatch, deleteTask, reorderTasks, users, getResourcesForProject, workforceEntries } = useProjects();
  const { isAdmin } = useAuth();
  const allTasks = getTasksForProject(project.id);
  const resources = getResourcesForProject(project.id);

  const projectWorkforce = useMemo(() => {
    return workforceEntries.filter(e => e.projectId === project.id);
  }, [workforceEntries, project.id]);

  // Reschedule modal state
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState<Task | null>(null);
  const [showOnlyRescheduled, setShowOnlyRescheduled] = useState(false);
  const [filterResponsible, setFilterResponsible] = useState<string>('_all');
  const [expandedFrentes, setExpandedFrentes] = useState<Set<string>>(new Set());
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const clickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const uniqueResponsibles = useMemo(() => {
    const resps = new Set<string>();
    allTasks.forEach(t => {
      if (t.responsible) resps.add(t.responsible);
      if (t.frentes) {
        t.frentes.forEach(f => {
          if (f.responsible) resps.add(f.responsible);
        });
      }
    });
    return Array.from(resps).sort();
  }, [allTasks]);

  const matchesResponsibleFilter = useMemo(() => {
    return (task: Task) => {
      if (filterResponsible === '_all') return true;
      if (task.responsible === filterResponsible) return true;
      if (task.frentes && task.frentes.some(f => f.responsible === filterResponsible)) return true;
      return false;
    };
  }, [filterResponsible]);

  const getSubtasks = useMemo(() => {
    return (stageId: string) => {
      const subs = allTasks.filter(t => t.parentId === stageId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      if (filterResponsible === '_all') return subs;
      return subs.filter(matchesResponsibleFilter);
    };
  }, [allTasks, filterResponsible, matchesResponsibleFilter]);

  const stages = useMemo(() => {
    const rawStages = allTasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    if (filterResponsible === '_all') return rawStages;
    return rawStages.filter(stage => {
      if (matchesResponsibleFilter(stage)) return true;
      const subs = allTasks.filter(t => t.parentId === stage.id);
      return subs.some(matchesResponsibleFilter);
    });
  }, [allTasks, filterResponsible, matchesResponsibleFilter]);

  const storageKey = `planning_expanded_${project.id}`;
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing expanded stages:', e);
      }
    }
    return new Set<string>(); // Default to empty set (collapsed by default)
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(expandedStages)));
  }, [expandedStages, storageKey]);

  const allHeaders = useMemo(() => [
    { label: 'Etapa / Atividade', align: 'left' as const, width: 300, always: true },
    { label: 'Início', align: 'left' as const, width: 120, always: true },
    { label: 'Término', align: 'left' as const, width: 120, always: true },
    { label: 'Duração', align: 'center' as const, width: 80, always: true },
    { label: '% Execução', align: 'left' as const, width: 140, always: true },
    { label: 'Status', align: 'left' as const, width: 150, always: true },
    { label: 'Predecessoras', align: 'left' as const, width: 160, always: true },
    { label: '', align: 'center' as const, width: 40, always: true },
    { label: 'Sucessoras', align: 'left' as const, width: 160, always: false },
    { label: 'Custo (R$)', align: 'right' as const, width: 140, always: false },
    { label: 'Observações', align: 'left' as const, width: 200, always: false },
    { label: 'Efetivo', align: 'center' as const, width: 110, always: false },
    { label: 'Responsável', align: 'left' as const, width: 140, always: false },
    { label: 'Ações', align: 'center' as const, width: 130, always: false },
  ], []);

  const columnHeaders = useMemo(() => {
    return allHeaders.filter(h => h.always || showAllColumns);
  }, [allHeaders, showAllColumns]);

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

  const expandAll = () => setExpandedStages(new Set(stages.map(s => s.id)));
  const collapseAll = () => setExpandedStages(new Set());
  const allExpanded = stages.length > 0 && stages.every(s => expandedStages.has(s.id));
  const allCollapsed = stages.length > 0 && stages.every(s => !expandedStages.has(s.id));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex(s => s.id === active.id);
    const newIndex = stages.findIndex(s => s.id === over.id);
    
    const newStages = arrayMove(stages, oldIndex, newIndex);
    
    // Efficiently update order for all stages
    const updates = newStages.map((stage, i) => ({
      id: stage.id,
      orderIndex: i
    }));

    await reorderTasks(updates);
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
    const today = new Date().toISOString().split('T')[0];
    const start = today;
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
      statusComments: [],
    });
    if (task) {
      setExpandedStages(prev => new Set([...prev, task.id]));
    }
  };

  const handleAddSubtask = async (stageId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const start = today;
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
      statusComments: [],
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
          // Keep the same duration, recalculate end (allow 0 for milestones)
          const dur = task.duration === 0 ? 0 : (task.duration || 1);
          const newEnd = addBusinessDays(newStart, dur);
          updated.startDate = newStart;
          updated.endDate = newEnd;
          updated.duration = dur;
        }
      }
    }

    if (field === 'startDate' || field === 'endDate') {
      updated.duration = Math.max(0, getBusinessDays(updated.startDate, updated.endDate));
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
    const batchUpdates: Task[] = [updated];

    // ── Propagate to successors: cascade date changes through the entire chain ──
    if (field === 'endDate' || field === 'duration' || field === 'startDate' || field === 'predecessors') {
      const finalEndDate = updated.endDate;
      if (finalEndDate) {
        // BFS queue: each entry holds the predecessor ID and its new end date
        // We use a map to track the new end dates for already-processed tasks,
        // so that tasks with multiple predecessors pick the latest end date.
        const newEndByTaskId = new Map<string, string>();
        newEndByTaskId.set(task.id, finalEndDate);

        const queue: Array<{ predId: string; predNewEnd: string }> = [
          { predId: task.id, predNewEnd: finalEndDate },
        ];
        const visited = new Set<string>();
        visited.add(task.id);

        while (queue.length > 0) {
          const { predId, predNewEnd } = queue.shift()!;

          // Find all tasks that list predId as a predecessor
          const successors = allTasks.filter(t => t.predecessors.includes(predId) && t.id !== task.id);

          for (const succ of successors) {
            // If this successor has multiple predecessors, we need the latest end among all of them
            const latestPredEnd = succ.predecessors.reduce((latest, pid) => {
              const pEnd = newEndByTaskId.get(pid) ?? (allTasks.find(t => t.id === pid)?.endDate ?? '');
              return pEnd > latest ? pEnd : latest;
            }, '');

            const succStart = addBusinessDays(latestPredEnd || predNewEnd, 2);
            const succEnd = addBusinessDays(succStart, succ.duration === 0 ? 0 : (succ.duration || 1));

            if (succStart && succEnd && (succStart !== succ.startDate || succEnd !== succ.endDate)) {
              const updatedSucc = {
                ...succ,
                startDate: succStart,
                endDate: succEnd,
              };
              const existingIdx = batchUpdates.findIndex(t => t.id === succ.id);
              if (existingIdx !== -1) {
                batchUpdates[existingIdx] = updatedSucc;
              } else {
                batchUpdates.push(updatedSucc);
              }
            }

            // Track the new end date so downstream successors can use it
            newEndByTaskId.set(succ.id, succEnd);

            // Continue down the chain (even if dates didn't change, in case further tasks depend on it)
            if (!visited.has(succ.id)) {
              visited.add(succ.id);
              queue.push({ predId: succ.id, predNewEnd: succEnd });
            }
          }
        }
      }
    }

    await updateTasksBatch(batchUpdates);
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
      statusComments: [],
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

  const renderRow = (task: Task, isSubtask: boolean, number: string, dragHandleProps?: any) => {
    const overdue = isOverdue(task);
    const isStage = !isSubtask;
    const taskWf = projectWorkforce.filter(e => e.taskId === task.id);
    const totalWorkers = taskWf.reduce((sum, e) => sum + e.ownWorkers + e.thirdPartyWorkers, 0);
    const agg = isStage ? getStageAggregates(task.id) : null;
    const percent = agg ? agg.percent : task.percentComplete;
    const effectiveOverdue = agg ? agg.hasOverdue : overdue;
    const effectiveStatus = effectiveOverdue ? 'delayed' as TaskStatus : (agg ? (percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started') : task.status);

    const isMilestone = !isStage && task.duration === 0;

    const statusBorderColor = isMilestone ? 'border-l-amber-500' :
                             (effectiveStatus === 'completed' ? 'border-l-status-ok' :
                              effectiveStatus === 'in_progress' ? 'border-l-blue-600' :
                              effectiveStatus === 'delayed' ? 'border-l-status-danger' :
                              effectiveStatus === 'rescheduled' ? 'border-l-amber-500' :
                              'border-l-muted');

    return (
      <tr
        key={task.id}
        className={`border-b border-border/80 transition-colors border-l-4 ${statusBorderColor} ${
          isMilestone
            ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07] font-medium'
            : (effectiveOverdue
                ? 'bg-destructive/[0.02]'
                : isStage
                  ? 'bg-primary/[0.05] hover:bg-primary/[0.08]'
                  : 'hover:bg-muted/30')
        }`}
      >
        {/* 1. Etapa / Atividade */}
        <td className="py-2.5 px-3 border-r border-border/70 min-w-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isStage && (
              <div 
                {...dragHandleProps} 
                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-muted-foreground/30 hover:text-primary transition-colors shrink-0"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <span className="text-[10px] font-bold text-muted-foreground/40 w-6 shrink-0">{number}</span>
            {isStage ? (
              <button onClick={() => toggleExpand(task.id)} className="p-0.5 shrink-0 hover:bg-muted rounded transition-colors">
                {expandedStages.has(task.id)
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                }
              </button>
            ) : (
              <span className="text-muted-foreground/30 text-xs pl-1 shrink-0">↳</span>
            )}
            {isMilestone && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest bg-amber-500/10 text-amber-700 border border-amber-500/20 shrink-0 uppercase select-none">
                ◆ MARCO
              </span>
            )}
            <Input
              className={`h-8 text-sm border-0 bg-transparent px-1.5 focus-visible:ring-1 focus-visible:ring-primary/30 truncate ${isStage ? 'font-bold text-foreground' : inlineEditId === task.id ? 'text-foreground/90 ring-1 ring-primary/40 rounded bg-primary/5' : 'text-foreground/80 cursor-pointer hover:underline decoration-primary/45 decoration-2'}`}
              defaultValue={task.name}
              key={task.id + '_name'}
              readOnly={!isStage && inlineEditId !== task.id}
              onClick={() => {
                if (!isStage) {
                  if (clickTimerRef.current) {
                    // Second click = double click → open detail
                    clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = null;
                    setInlineEditId(null);
                    setSelectedDetailTask(task);
                  } else {
                    // First click → start timer, set inline edit
                    clickTimerRef.current = setTimeout(() => {
                      clickTimerRef.current = null;
                      setInlineEditId(task.id);
                    }, 220);
                  }
                }
              }}
              onBlur={e => {
                if (isStage || inlineEditId === task.id) {
                  if (e.target.value !== task.name) {
                    handleChange(task, 'name', e.target.value);
                  }
                  setInlineEditId(null);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setInlineEditId(null); }
              }}
              title={isStage ? undefined : inlineEditId === task.id ? 'Enter para salvar · Esc para cancelar · Duplo clique para abrir detalhes' : '1× renomear · 2× abrir detalhes'}
              placeholder={isStage ? 'Nova Etapa...' : 'Nova Subetapa...'}
            />
          </div>
        </td>


        {/* 3. Início */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground border-r border-border/70">
          {isStage && agg ? (
            <div className="px-1.5 py-1 font-medium">{formatDate(agg.startDate)}</div>
          ) : (
            <div className="space-y-0.5">
              <Input
                type="date"
                className="h-8 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
                defaultValue={task.startDate}
                onBlur={e => {
                  if (e.target.value && e.target.value !== task.startDate) {
                    handleChange(task, 'startDate', e.target.value);
                  }
                }}
              />
              {task.plannedStart && task.plannedStart !== task.startDate && (
                <div className="px-1 text-[10px] text-muted-foreground/50 font-mono">
                  Orig: {formatDate(task.plannedStart)}
                </div>
              )}
            </div>
          )}
        </td>

        {/* 4. Término */}
        <td className="py-2.5 px-3 text-sm text-muted-foreground border-r border-border/70">
          {isStage && agg ? (
            <div className="px-1.5 py-1 font-medium">{formatDate(agg.endDate)}</div>
          ) : (
            <div className="space-y-0.5">
              <Input
                type="date"
                className="h-8 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
                defaultValue={task.endDate}
                onBlur={e => {
                  if (e.target.value && e.target.value !== task.endDate) {
                    handleChange(task, 'endDate', e.target.value);
                  }
                }}
              />
              {task.plannedEnd && task.plannedEnd !== task.endDate && (
                <div className="px-1 text-[10px] text-muted-foreground/50 font-mono">
                  Orig: {formatDate(task.plannedEnd)}
                </div>
              )}
            </div>
          )}
        </td>

        {/* 5. Duração */}
        <td className="py-2.5 px-3 text-center border-r border-border/70 font-medium">
          {isStage && agg ? (
            <span className="text-sm">{agg.duration}</span>
          ) : (
            <Input
              type="number"
              className="h-8 w-full text-center text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
              defaultValue={task.duration}
              onBlur={e => {
                const val = parseInt(e.target.value) || 0;
                if (val !== task.duration) {
                  handleChange(task, 'duration', val);
                }
              }}
            />
          )}
        </td>

        {/* 6. % Execução */}
        <td className="py-2.5 px-3 border-r border-border/70">
          <div className="flex items-center gap-2 min-w-[120px]">
            {isStage && agg ? (
              <>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-status-ok' : 'bg-blue-600'}`} style={{ width: `${percent}%` }} />
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
        <td className="py-2.5 px-3 border-r border-border/70">
          <div className="space-y-1">
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
            {!isStage && (task.rescheduleCount || 0) > 0 && (
              <div className="px-1 text-[10px] text-amber-600/80 font-semibold">
                Reprog. {task.rescheduleCount}x
              </div>
            )}
          </div>
        </td>

        {/* 8. Predecessoras */}
        <td className="py-2.5 px-3 border-r border-border/70">
          <PredecessorPicker
            task={task}
            allTaskOptions={allTaskOptions.filter(t => t.id !== task.id)}
            allTasks={allTasks}
            onChange={(v) => handleChange(task, 'predecessors', v === '_none' ? [] : [v])}
          />
        </td>

        {/* ── Always-visible quick-delete ── */}
        <td className="py-2.5 px-2 border-r border-border/70 w-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
            onClick={() => isStage ? handleDeleteStage(task.id) : deleteTask(task.id)}
            title={isStage ? 'Excluir etapa e todas as subetapas' : 'Excluir subetapa'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </td>

        {showAllColumns && (
          <>
            {/* 9. Sucessoras */}
            <td className="py-2.5 px-3 text-xs text-muted-foreground border-r border-border/70">
              <div className="truncate w-full px-1" title={allTasks.filter(t => t.predecessors.includes(task.id)).map(t => t.name).join(', ') || '—'}>
                {allTasks.filter(t => t.predecessors.includes(task.id)).map(t => t.name).join(', ') || '—'}
              </div>
            </td>

            {/* Custo (R$) */}
            <td className="py-2.5 px-3 border-r border-border/70 text-right">
              {isStage ? (
                <div className="px-1.5 py-1 text-sm font-semibold text-foreground/80">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    getSubtasks(task.id).reduce((sum, s) => sum + (s.cost || 0), 0)
                  )}
                </div>
              ) : (
                <Input
                  type="number"
                  className="h-8 w-full text-right text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
                  defaultValue={task.cost || 0}
                  onBlur={e => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val !== (task.cost || 0)) {
                      handleChange(task, 'cost', val);
                    }
                  }}
                />
              )}
            </td>
          </>
        )}

        {showAllColumns && (
          <>
            {/* 11. Observações */}
            <td className="py-2.5 px-3 border-r border-border/70">
              <Input
                className="h-8 text-sm border-0 bg-transparent px-1.5 focus-visible:ring-1 focus-visible:ring-primary/30"
                defaultValue={task.observations || ''}
                onBlur={e => {
                  if (e.target.value !== (task.observations || '')) {
                    handleChange(task, 'observations', e.target.value);
                  }
                }}
                placeholder="..."
              />
            </td>

            {/* Efetivo */}
            <td className="py-2.5 px-3 border-r border-border/70 text-center font-medium">
              {!isStage && (
                <div 
                  className="flex items-center justify-center gap-1 cursor-pointer hover:underline text-xs font-semibold"
                  onClick={() => setSelectedDetailTask(task)}
                  title="Clique para gerenciar o efetivo desta tarefa"
                >
                  ♻ {totalWorkers} colab.
                </div>
              )}
              {isStage && <span className="text-muted-foreground/35">—</span>}
            </td>

            {/* 2. Responsável */}
            <td className="py-2.5 px-3 border-r border-border/70">
              <Input
                list="users-list"
                className="h-8 text-sm border-0 border-b border-transparent bg-transparent px-1.5 focus-visible:ring-0 focus-visible:border-primary hover:border-border/60 transition-colors"
                defaultValue={task.responsible || ''}
                onBlur={e => {
                  if (e.target.value !== (task.responsible || '')) {
                    handleChange(task, 'responsible', e.target.value);
                  }
                }}
                placeholder="Responsável..."
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
                {!isStage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => setSelectedDetailTask(task)}
                    title="Ver detalhes / Frentes de serviço"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                )}
                {!isStage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                    onClick={() => setRescheduleTask(task)}
                    title="Reprogramar tarefa"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                  </Button>
                )}
                {!isStage && (task.rescheduleCount || 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => setHistoryTask(task)}
                    title="Ver histórico de reprogramações"
                  >
                    <History className="w-3.5 h-3.5" />
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
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      {/* Reschedule Modals */}
      <RescheduleModal
        task={rescheduleTask}
        isOpen={!!rescheduleTask}
        onClose={() => setRescheduleTask(null)}
        projectId={project.id}
      />
      <RescheduleHistoryModal
        task={historyTask}
        isOpen={!!historyTask}
        onClose={() => setHistoryTask(null)}
      />
      <TaskDetailModal
        task={selectedDetailTask}
        isOpen={!!selectedDetailTask}
        onClose={() => setSelectedDetailTask(null)}
        onUpdate={updateTask}
      />

      <Tabs defaultValue="schedule" className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-6">
            <h2 className="font-display font-bold text-xl text-foreground">Planejamento</h2>
            <TabsList className="bg-muted/50 p-1 rounded-xl h-11">
              <TabsTrigger value="schedule" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
                <Calendar className="w-4 h-4" /> Cronograma
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
                <Users className="w-4 h-4" /> Equipe
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
                <CheckSquare className="w-4 h-4" /> Tarefas - Obra
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="schedule" className="m-0 border-0 p-0 shadow-none">
            <div className="flex items-center gap-2">
              {stages.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={allExpanded ? collapseAll : expandAll}
                    className="gap-2 rounded-xl text-muted-foreground hover:text-foreground"
                    title={allExpanded ? 'Recolher todas' : 'Expandir todas'}
                  >
                    {allExpanded
                      ? <><ChevronsDownUp className="w-4 h-4" /> Recolher tudo</>
                      : <><ChevronsUpDown className="w-4 h-4" /> Expandir tudo</>
                    }
                  </Button>
                </>
              )}
              <Button onClick={handleAddStage} className="gap-2 rounded-xl px-5 shadow-sm">
                <Plus className="w-4 h-4" /> Adicionar Etapa
              </Button>
            </div>
          </TabsContent>
        </div>

        <TabsContent value="schedule" className="m-0 border-0 p-0 shadow-none focus-visible:ring-0">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setShowOnlyRescheduled(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showOnlyRescheduled
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                  : 'bg-muted/50 border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              {showOnlyRescheduled ? 'Mostrando apenas reprogramadas' : 'Mostrar apenas reprogramadas'}
            </button>
            {showOnlyRescheduled && (
              <span className="text-xs text-muted-foreground">
                {stages.filter(s =>
                  getSubtasks(s.id).some(t => (t.rescheduleCount || 0) > 0)
                ).length} etapa(s) com reprogramações
              </span>
            )}

            <button
              onClick={() => setShowAllColumns(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showAllColumns
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/50 border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              {showAllColumns ? 'Exibição Completa' : 'Exibição Simplificada'}
            </button>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground font-semibold">Responsável:</span>
              <select
                value={filterResponsible}
                onChange={e => setFilterResponsible(e.target.value)}
                className="h-8 text-xs border border-border/40 rounded-lg bg-background px-2.5 font-medium focus:outline-none shadow-sm cursor-pointer"
              >
                <option value="_all">Todos os responsáveis</option>
                {uniqueResponsibles.map(resp => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto p-0 w-full">
            {/* ... table content remains same but wrapped in handleDragEnd/sortable context below ... */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="border-collapse table-fixed text-sm w-full bg-card rounded-xl shadow-sm border border-border/80 overflow-hidden" style={{ minWidth: colWidths.reduce((s, w) => s + w, 0) }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/40 border-t border-border/80">
                    {columnHeaders.map((h, i) => (
                      <th 
                        key={i} 
                        style={{ width: colWidths[i] }}
                        className={`${h.align === 'center' ? 'text-center' : 'text-left'} py-3.5 px-3 font-bold text-[10px] uppercase tracking-wider text-muted-foreground relative border-r border-border/40 last:border-0`}
                      >
                        <div className="truncate">{h.label}</div>
                        <ResizeHandle index={i} onMouseDown={onColResize} />
                      </th>
                    ))}
                  </tr>
                </thead>
                
                {stages.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={columnHeaders.length} className="py-20 text-center text-muted-foreground text-sm bg-card">
                        <div className="flex flex-col items-center gap-2 opacity-60">
                          <Plus className="w-8 h-8 text-muted-foreground/20" />
                          <span>Nenhuma etapa cadastrada.</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <>
                    {/* Project Summary Row (Geral) */}
                    {projectAggregate && (
                      <tbody className="bg-primary/[0.03] font-bold border-b-2 border-primary/10">
                        <tr className="hover:bg-primary/[0.05] transition-colors">
                          <td className="p-0 border-r border-border/40">
                            <div className="flex items-center gap-3 py-3.5 px-3 min-w-[300px]" style={{ width: colWidths[0] }}>
                              <div className="bg-primary/15 p-1.5 rounded-lg shrink-0">
                                <TrendingUp className="w-5 h-5 text-primary" />
                              </div>
                              <span className="text-sm font-black text-primary uppercase tracking-tight truncate">RESUMO GERAL DO PROJETO</span>
                            </div>
                          </td>
                          <td className="p-0 border-r border-border/40">
                            <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[1] }}>
                              {projectAggregate.startDate ? formatDate(projectAggregate.startDate) : '—'}
                            </div>
                          </td>
                          <td className="p-0 border-r border-border/40">
                            <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[2] }}>
                              {projectAggregate.endDate ? formatDate(projectAggregate.endDate) : '—'}
                            </div>
                          </td>
                          <td className="p-0 border-r border-border/10 text-center">
                            <div className="px-3 text-[11px] text-primary" style={{ width: colWidths[3] }}>
                              {projectAggregate.duration} dias
                            </div>
                          </td>
                          <td className="p-0 border-r border-border/40">
                            <div className="px-3 flex items-center gap-2" style={{ width: colWidths[4] }}>
                              <div className="flex-1 bg-primary/10 h-2 rounded-full overflow-hidden">
                                <div className="bg-primary h-full transition-all duration-500" style={{ width: `${projectAggregate.percent}%` }} />
                              </div>
                              <span className="text-xs text-primary font-bold">{projectAggregate.percent}%</span>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="p-0 border-r border-border/40">
                            <div className="px-3" style={{ width: colWidths[5] }}>
                              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase">GERAL</Badge>
                            </div>
                          </td>
                          {/* Predecessoras */}
                          <td className="p-0 border-r border-border/40" />

                          {showAllColumns && (
                            <>
                              {/* Sucessoras */}
                              <td className="p-0 border-r border-border/40" />
                              {/* Custo (R$) */}
                              <td className="p-0 border-r border-border/40 text-right">
                                <div className="px-3 text-xs text-primary font-bold animate-fade-in" style={{ width: colWidths[8] }}>
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    allTasks.filter(t => t.parentId).reduce((sum, s) => sum + (s.cost || 0), 0)
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                          {showAllColumns && (
                            <>
                              {/* Observações */}
                              <td className="p-0 border-r border-border/40" />
                              {/* Efetivo */}
                              <td className="p-0 border-r border-border/10 text-center">
                                <div className="px-3 text-xs text-primary font-bold" style={{ width: colWidths[10] }}>
                                  {projectWorkforce.reduce((sum, e) => sum + e.ownWorkers + e.thirdPartyWorkers, 0)} colab.
                                </div>
                              </td>
                              {/* Responsável */}
                              <td className="p-0 border-r border-border/40" />
                              {/* Ações */}
                              <td className="p-0" />
                            </>
                          )}
                        </tr>
                      </tbody>
                    )}

                    <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {stages
                        .filter(stage =>
                          !showOnlyRescheduled ||
                          getSubtasks(stage.id).some(t => (t.rescheduleCount || 0) > 0)
                        )
                        .map((stage, sIdx) => (
                          <SortableStageRow
                            key={stage.id}
                            stage={stage}
                            subtasks={
                              showOnlyRescheduled
                                ? getSubtasks(stage.id).filter(t => (t.rescheduleCount || 0) > 0)
                                : getSubtasks(stage.id)
                            }
                            isExpanded={expandedStages.has(stage.id)}
                            expandedFrentes={expandedFrentes}
                            renderRow={(t: Task, isSub: boolean, dragProps?: any) => {
                              const subIdx = isSub ? getSubtasks(stage.id).findIndex(st => st.id === t.id) : -1;
                              const number = isSub ? `${sIdx + 1}.${subIdx + 1}` : `${sIdx + 1}`;
                              return renderRow(t, isSub, number, dragProps);
                            }}
                            handleAddSubtask={handleAddSubtask}
                            columnHeaders={columnHeaders}
                          />
                        ))}
                    </SortableContext>
                  </>
                )}
              </table>
            </DndContext>
          </div>
        </TabsContent>

        <TabsContent value="team" className="m-0 border-0 p-0 shadow-none focus-visible:ring-0">
          <TeamTab project={project} />
        </TabsContent>

        <TabsContent value="assignments" className="m-0 border-0 p-0 shadow-none focus-visible:ring-0">
          <AssignmentsTab project={project} />
        </TabsContent>
      </Tabs>

      <datalist id="users-list">
        {resources.map(r => <option key={r.id} value={r.name} />)}
        {users.filter(u => !resources.some(r => r.name === u.full_name)).map(u => (
          <option key={u.id} value={u.full_name} />
        ))}
      </datalist>
    </div>
  );
}

const SortableStageRow = React.memo(function SortableStageRow({ 
  stage, 
  subtasks, 
  isExpanded, 
  expandedFrentes,
  renderRow, 
  handleAddSubtask, 
  columnHeaders 
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    position: 'relative' as const,
  } : undefined;

  return (
    <tbody ref={setNodeRef} style={style} className={isDragging ? 'shadow-2xl ring-2 ring-primary border-primary rounded-lg overflow-hidden brightness-105 transition-none z-50 pointer-events-none' : ''}>
      {renderRow(stage, false, { ...attributes, ...listeners })}
      {isExpanded && subtasks.map((sub: any) => (
        <Fragment key={sub.id}>
          {renderRow(sub, true)}
          {expandedFrentes.has(sub.id) && sub.frentes && sub.frentes.map((frente: any) => {
            const hasExtra = columnHeaders.length > 7;
            return (
              <tr key={frente.id} className="bg-muted/10 border-b border-border/60 hover:bg-muted/15 transition-colors">
                {/* 1. Etapa / Atividade */}
                <td className="py-2 px-3 pl-14 text-xs font-semibold text-foreground/75 flex items-center gap-1.5 min-w-0 truncate">
                  <span className="text-muted-foreground/45 shrink-0">↳</span>
                  <span className="truncate">👷 {frente.name}</span>
                </td>
                {/* 2. Início */}
                <td className="py-2 px-3 text-xs text-muted-foreground">{frente.startDate ? new Date(frente.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                {/* 3. Término */}
                <td className="py-2 px-3 text-xs text-muted-foreground">{frente.endDate ? new Date(frente.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                {/* 4. Duração */}
                <td className="py-2 px-3 text-center text-xs text-foreground/80 font-medium">{frente.duration || 1} d</td>
                {/* 5. % Execução */}
                <td className="py-2 px-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${frente.percentComplete || 0}%` }} />
                    </div>
                    <span className="font-semibold text-[11px]">{frente.percentComplete || 0}%</span>
                  </div>
                </td>
                {/* 7. Status */}
                <td className="py-2 px-3 text-xs">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shadow-sm shrink-0 ${
                    frente.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                    frente.status === 'in_progress' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600' :
                    frente.status === 'delayed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' :
                    frente.status === 'paused' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                    'bg-zinc-500/10 border-zinc-500/20 text-zinc-600'
                  }`}>
                    {frente.status === 'completed' ? 'Concluída' :
                     frente.status === 'in_progress' ? 'Andamento' :
                     frente.status === 'delayed' ? 'Atrasada' :
                     frente.status === 'paused' ? 'Pausada' : 'Não Inic.'}
                  </span>
                </td>

                {/* 8. Predecessoras */}
                <td className="py-2 px-3 text-xs text-muted-foreground/35 text-center">—</td>

                {hasExtra && (
                  <>
                    {/* 9. Sucessoras */}
                    <td className="py-2 px-3 text-xs text-muted-foreground/35 text-center">—</td>
                    {/* 6. Custo (R$) */}
                    <td className="py-2 px-3 text-right text-xs text-muted-foreground/30">—</td>
                  </>
                )}

                {hasExtra && (
                  <>
                    {/* 10. Observações */}
                    <td className="py-2 px-3 text-[11px] text-muted-foreground/70 italic truncate max-w-[150px]" title={frente.observations}>{frente.observations || '—'}</td>
                    {/* 11. Efetivo */}
                    <td className="py-2 px-3 text-xs text-muted-foreground/35 text-center">—</td>
                    {/* 12. Responsável */}
                    <td className="py-2 px-3 text-xs text-foreground/80 truncate">{frente.responsible || '—'}</td>
                    {/* 13. Ações */}
                    <td className="py-2 px-3 text-xs text-muted-foreground/35 text-center">—</td>
                  </>
                )}
              </tr>
            );
          })}
        </Fragment>
      ))}
      {isExpanded && (
        <tr className="border-b border-dashed bg-muted/5">
          <td colSpan={columnHeaders.length} className="py-2 px-3 pl-10">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors h-7 rounded-lg"
              onClick={() => handleAddSubtask(stage.id)}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar subetapa
            </Button>
          </td>
        </tr>
      )}
    </tbody>
  );
});

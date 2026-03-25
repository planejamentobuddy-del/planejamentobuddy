import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { Project, Task, getCriticalTaskIds } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';

type ViewMode = 'diario' | 'semanal' | 'mensal';

function getWeekNumber(d: Date): string {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7 + 1);
  return 'S' + week.toString().padStart(2, '0');
}

export default function GanttTab({ project }: { project: Project }) {
  const { getTasksForProject } = useProjects();
  const allTasks = useMemo(() => 
    getTasksForProject(project.id).sort((a, b) => a.startDate.localeCompare(b.startDate))
  , [getTasksForProject, project.id]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('semanal');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);

  // CPM critical path set
  const criticalSet = useMemo(() => getCriticalTaskIds(allTasks), [allTasks]);

  const { visibleTasks, hasChildrenMap, depthMap, computedBounds, computedProgress } = useMemo(() => {
    const map = new Map<string | undefined, Task[]>();
    allTasks.forEach(t => {
      const pId = t.parentId || undefined;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push(t);
    });

    const hasChildren = new Map<string, boolean>();
    const depth = new Map<string, number>();
    const bounds = new Map<string, { start: string, end: string }>();
    const progress = new Map<string, number>();
    
    // Compute dynamic bounds for summary tasks based on children (MS Project style)
    const computeBounds = (taskId: string): { start: number, end: number, avgProgress: number } | null => {
      const children = map.get(taskId) || [];
      if (children.length === 0) {
        const t = allTasks.find(x => x.id === taskId);
        return t ? { 
          start: new Date(t.startDate + 'T12:00:00').getTime(), 
          end: new Date(t.endDate + 'T12:00:00').getTime(),
          avgProgress: t.percentComplete
        } : null;
      }
      
      let minStart = Infinity;
      let maxEnd = -Infinity;
      let totalProg = 0;
      let count = 0;
      
      children.forEach(c => {
        const cbounds = computeBounds(c.id);
        if (cbounds) {
          minStart = Math.min(minStart, cbounds.start);
          maxEnd = Math.max(maxEnd, cbounds.end);
          totalProg += cbounds.avgProgress;
          count++;
        }
      });
      
      const avg = count > 0 ? Math.round(totalProg / count) : 0;
      
      if (minStart !== Infinity && maxEnd !== -Infinity) {
        bounds.set(taskId, {
          start: new Date(minStart).toISOString().split('T')[0],
          end: new Date(maxEnd).toISOString().split('T')[0]
        });
        progress.set(taskId, avg);
        return { start: minStart, end: maxEnd, avgProgress: avg };
      }
      return null;
    };

    allTasks.forEach(t => {
      const childList = map.get(t.id) || [];
      const childIsParent = childList.length > 0;
      hasChildren.set(t.id, childIsParent);
      if (childIsParent) {
        computeBounds(t.id);
      }
    });

    // Build visible flat list
    const visible: Task[] = [];
    const traverse = (parentId: string | undefined, currentDepth: number) => {
      const children = map.get(parentId) || [];
      // Sort children chronologically among siblings
      children.sort((a, b) => {
        const aStart = bounds.get(a.id)?.start || a.startDate;
        const bStart = bounds.get(b.id)?.start || b.startDate;
        return aStart.localeCompare(bStart);
      });

      children.forEach(child => {
        depth.set(child.id, currentDepth);
        visible.push(child);
        
        if (hasChildren.get(child.id) && !collapsedTasks.has(child.id)) {
          traverse(child.id, currentDepth + 1);
        }
      });
    };

    traverse(undefined, 0);

    return { visibleTasks: visible, hasChildrenMap: hasChildren, depthMap: depth, computedBounds: bounds, computedProgress: progress };
  }, [allTasks, collapsedTasks]);

  const toggleCollapse = (taskId: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const { minDate, maxDate, totalDays, ticks } = useMemo(() => {
    if (allTasks.length === 0) {
      const s = new Date(project.startDate);
      const e = new Date(project.endDate);
      return { minDate: s.getTime(), maxDate: e.getTime(), totalDays: 30, ticks: [] };
    }

    const taskDates = allTasks.flatMap(t => {
      const b = computedBounds.get(t.id) || { start: t.startDate, end: t.endDate };
      return [new Date(b.start + 'T12:00:00').getTime(), new Date(b.end + 'T12:00:00').getTime()];
    });
    let start = Math.min(...taskDates, new Date(project.startDate + 'T12:00:00').getTime());
    let end = Math.max(...taskDates, new Date(project.endDate + 'T12:00:00').getTime());

    // Add padding to timeline (1 week before, 4 weeks after)
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() - 7);
    start = startDate.getTime();

    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 30);
    end = endDate.getTime();

    const ticks: Date[] = [];
    const current = new Date(start);
    
    if (viewMode === 'diario') {
      while (current.getTime() <= end) {
        ticks.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (viewMode === 'semanal') {
      // Align to start of week
      current.setDate(current.getDate() - current.getDay());
      while (current.getTime() <= end) {
        ticks.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
    } else {
      current.setDate(1);
      while (current.getTime() <= end) {
        ticks.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
    }

    return { 
      minDate: start, 
      maxDate: end, 
      totalDays: Math.ceil((end - start) / 86400000),
      ticks 
    };
  }, [allTasks, computedBounds, project, viewMode]);

  const pixelsPerDay = viewMode === 'diario' ? 60 : viewMode === 'semanal' ? 12 : 4;
  const timelineWidth = totalDays * pixelsPerDay;
  const tickWidth = viewMode === 'diario' ? pixelsPerDay : viewMode === 'semanal' ? pixelsPerDay * 7 : pixelsPerDay * 30;

  const getPosition = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00').getTime();
    return ((date - minDate) / 86400000) * pixelsPerDay;
  };

  const today = new Date().toISOString().split('T')[0];
  const todayPos = getPosition(today);

  // Auto-scroll to "Today" on mount
  useEffect(() => {
    if (timelineRef.current && todayPos > 0) {
      timelineRef.current.scrollLeft = Math.max(0, todayPos - 300);
    }
  }, [todayPos]);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Cronograma (Gantt)</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border border-border/40">
            <Button 
              variant={viewMode === 'diario' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-4 rounded-lg transition-all ${viewMode === 'diario' ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('diario')}
            >
              Diário
            </Button>
            <Button 
              variant={viewMode === 'semanal' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-4 rounded-lg transition-all ${viewMode === 'semanal' ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('semanal')}
            >
              Semanal
            </Button>
            <Button 
              variant={viewMode === 'mensal' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-4 rounded-lg transition-all ${viewMode === 'mensal' ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('mensal')}
            >
              Mensal
            </Button>
          </div>
          
          <Button 
            variant={showCriticalPath ? 'secondary' : 'outline'} 
            size="sm" 
            className={`h-8 rounded-lg gap-2 text-xs font-semibold px-4 transition-all ${showCriticalPath ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowCriticalPath(!showCriticalPath)}
          >
            <Calendar className="w-3.5 h-3.5" />
            Caminho Crítico
          </Button>
        </div>
      </div>

      <div className="card-elevated overflow-hidden border border-border/30 shadow-sm flex flex-col">
        <div className="flex flex-1 overflow-hidden min-h-[500px]">
          {/* Sidebar - Activities */}
          <div className="w-80 border-r border-border/40 flex flex-col shrink-0 bg-muted/[0.02] z-10">
            <div className="h-12 border-b border-border/40 flex items-center px-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/70 bg-muted/40 backdrop-blur-sm sticky top-0">
              Atividade
            </div>
            <div className="flex-1 overflow-y-hidden">
              {visibleTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">Nenhuma tarefa visível</div>
              ) : (
                visibleTasks.map(task => {
                  const depth = depthMap.get(task.id) || 0;
                  const hasChildren = hasChildrenMap.get(task.id) || false;
                  const isCollapsed = collapsedTasks.has(task.id);
                  const bounds = computedBounds.get(task.id);
                  const displayDate = hasChildren && bounds ? bounds.start : task.startDate;
                  const displayEndDate = hasChildren && bounds ? bounds.end : task.endDate;
                  
                  return (
                    <div 
                      key={task.id} 
                      className="h-10 flex flex-col justify-center px-4 border-b border-border/20 hover:bg-muted/10 transition-colors group"
                    >
                      <div 
                        className="flex items-center gap-1.5 w-full"
                        style={{ paddingLeft: `${depth * 1}rem` }}
                      >
                        {hasChildren ? (
                          <button 
                            onClick={() => toggleCollapse(task.id)}
                            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded hover:bg-muted/50 transition-colors"
                          >
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <div className="w-4 shrink-0" />
                        )}
                        <div className="flex flex-col truncate">
                          <span className={`text-[11px] truncate ${hasChildren ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'}`}>
                            {task.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Timeline */}
          <div ref={timelineRef} className="flex-1 overflow-x-auto overflow-y-auto relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div style={{ width: Math.max(600, timelineWidth), minHeight: '100%' }} className="relative">
              {/* Timeline Header */}
              <div className="sticky top-0 z-20 h-12 border-b border-border/40 bg-background/95 backdrop-blur-sm flex">
                {ticks.map((tick, i) => (
                  <div 
                    key={i} 
                    style={{ width: tickWidth }} 
                    className="border-r border-border/10 h-12 flex flex-col justify-center px-3 text-[10px] font-bold shrink-0"
                  >
                    <span className="text-muted-foreground/60 uppercase tracking-tighter">
                      {viewMode === 'mensal' 
                        ? tick.getFullYear() 
                        : viewMode === 'semanal' 
                          ? getWeekNumber(tick)
                          : tick.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </span>
                    <span className="text-foreground -mt-0.5">
                      {viewMode === 'diario' 
                        ? tick.getDate() 
                        : viewMode === 'semanal' 
                          ? `${tick.getDate()}/${tick.getMonth() + 1 >= 10 ? tick.getMonth() + 1 : '0' + (tick.getMonth() + 1)}`
                          : tick.toLocaleDateString('pt-BR', { month: 'long' })
                      }
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid background lines */}
              <div className="absolute inset-x-0 top-12 bottom-0 flex pointer-events-none">
                {ticks.map((tick, i) => {
                  const isWeekend = tick.getDay() === 0 || tick.getDay() === 6;
                  return (
                    <div 
                      key={i} 
                      style={{ width: tickWidth }} 
                      className={`border-r border-border/[0.18] h-full ${isWeekend && viewMode === 'diario' ? 'bg-muted/30' : ''}`} 
                    />
                  );
                })}
              </div>

              {/* Dependency SVG Overlay */}
              <svg className="absolute top-12 left-0 w-full h-[calc(100%-48px)] pointer-events-none z-0 overflow-visible">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.5)" />
                  </marker>
                </defs>
                {visibleTasks.map((task, idx) => 
                  task.predecessors.map(predId => {
                    const predTask = visibleTasks.find(t => t.id === predId);
                    if (!predTask) return null; // Predecessor might be collapsed/hidden
                    
                    const predIdx = visibleTasks.indexOf(predTask);
                    const predBounds = computedBounds.get(predTask.id);
                    const predEndDate = predBounds ? predBounds.end : predTask.endDate;
                    
                    const taskBounds = computedBounds.get(task.id);
                    const taskStartDate = taskBounds ? taskBounds.start : task.startDate;
                    
                    const startX = getPosition(predEndDate);
                    const startY = predIdx * 40 + 20;
                    const endX = getPosition(taskStartDate);
                    const endY = idx * 40 + 20;
                    
                    const midX = startX + (endX - startX) / 2;

                    return (
                      <Fragment key={`${predId}-${task.id}`}>
                        <path 
                          d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                          fill="none"
                          stroke="rgba(148, 163, 184, 0.4)"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                          markerEnd="url(#arrow)"
                        />
                      </Fragment>
                    );
                  })
                )}
              </svg>

              {/* Vertical Today Line */}
              {todayPos >= 0 && todayPos <= timelineWidth && (
                <div 
                  className="absolute top-12 bottom-0 z-20 pointer-events-none"
                  style={{ left: todayPos }}
                >
                  <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center">
                    <div className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest shadow-md whitespace-nowrap">
                      Hoje
                    </div>
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-500" />
                  </div>
                  <div className="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500/70" />
                </div>
              )}

              {/* Rows and Bars */}
              <div className="relative pt-0">
                {visibleTasks.map((task, idx) => {
                  const isSummary = hasChildrenMap.get(task.id);
                  const bounds = computedBounds.get(task.id);
                  
                  const startStr = bounds && isSummary ? bounds.start : task.startDate;
                  const endStr = bounds && isSummary ? bounds.end : task.endDate;
                  
                  const startPos = getPosition(startStr);
                  const endPos = getPosition(endStr) + pixelsPerDay; // +1 day: end-of-day inclusive
                  
                  // Summary task bar should stretch exactly between bounds. Regular tasks have min width.
                  const width = isSummary ? Math.max(8, endPos - startPos) : Math.max(24, endPos - startPos);
                  
                  const critical = showCriticalPath && criticalSet.has(task.id);

                  // Color based on status
                  const barColor = critical
                    ? 'bg-red-500'
                    : task.status === 'completed'
                      ? 'bg-[#2A9D8F]'         
                      : task.status === 'in_progress'
                        ? 'bg-blue-500'         
                        : task.status === 'delayed'
                          ? 'bg-red-400'        
                          : 'bg-slate-300 text-slate-600'; 

                  const textColor = task.status === 'not_started' ? 'text-slate-600' : 'text-white';
                  
                  return (
                    <div key={task.id} className="h-10 relative group transition-colors hover:bg-muted/10 border-b border-border/30">
                      {isSummary ? (
                        // MS Project Summary Task Style (Black Bracket) with Progress
                        <div
                          className="absolute top-1.5 z-10"
                          style={{ left: startPos, width }}
                          title={`${task.name}: ${computedProgress.get(task.id)}%`}
                        >
                          {/* Background bar (Thick visual) */}
                          <div className="absolute top-0 left-0 right-0 h-3 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                            {/* Progress fill that "grows" like subtasks */}
                            <div 
                              className="h-full bg-slate-800 dark:bg-slate-200 transition-all duration-1000 ease-out shadow-sm relative"
                              style={{ width: `${computedProgress.get(task.id)}%` }}
                            >
                              {/* Highlight for beauty */}
                              <div className="absolute inset-0 bg-white/10" />
                            </div>
                          </div>
                          
                          {/* Left Point (Downwards bracket edge) */}
                          <div 
                            className="absolute top-2 left-0 w-0 h-0 border-l-[10px] border-r-[0px] border-t-[10px] border-transparent border-l-slate-800 dark:border-l-slate-200" 
                          />
                          
                          {/* Right Point (Downwards bracket edge) */}
                          <div 
                            className="absolute top-2 right-0 w-0 h-0 border-l-[0px] border-r-[10px] border-t-[10px] border-transparent border-r-slate-800 dark:border-r-slate-200" 
                          />

                          {/* Progress Text Badge */}
                          <div className="absolute -right-12 top-0 h-full flex items-center text-[11px] font-bold text-slate-800 dark:text-slate-200">
                             {computedProgress.get(task.id)}%
                          </div>
                        </div>
                      ) : (
                        // Regular Task Bar
                        <div
                          className={`absolute top-2 h-6 rounded-md transition-all shadow-sm flex items-center px-3 z-10 overflow-hidden font-bold text-[9px] cursor-pointer hover:brightness-110 active:scale-95 ${barColor} ${textColor}`}
                          style={{ left: startPos, width }}
                          title={`${task.name}: ${task.percentComplete}%`}
                        >
                          {task.status === 'in_progress' && task.percentComplete > 0 && (
                            <div 
                              className="absolute inset-0 bg-white/20 pointer-events-none rounded-md"
                              style={{ width: `${task.percentComplete}%` }}
                            />
                          )}
                          <span className="relative z-10 whitespace-nowrap overflow-hidden">
                            {task.percentComplete}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 text-[11px] text-muted-foreground font-semibold px-3 bg-muted/20 py-3 rounded-xl border border-border/30">
        <div className="flex items-center gap-2">
          {/* Mock Summary Task Icon */}
          <div className="relative w-5 h-3">
             <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 dark:bg-slate-200" />
             <div className="absolute top-1 left-0 w-0 h-0 border-l-[4px] border-r-[0px] border-t-[4px] border-transparent border-l-slate-800 dark:border-l-slate-200" />
             <div className="absolute top-1 right-0 w-0 h-0 border-l-[0px] border-r-[4px] border-t-[4px] border-transparent border-r-slate-800 dark:border-r-slate-200" />
          </div>
          <span className="ml-1">Etapa</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3.5 rounded bg-blue-500 shadow-sm" />
          <span>Em andamento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3.5 rounded bg-[#2A9D8F] shadow-sm" />
          <span>Concluído</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3.5 rounded bg-slate-300 shadow-sm" />
          <span>Não iniciado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3.5 rounded bg-red-400 shadow-sm" />
          <span>Atrasado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3.5 rounded bg-red-500 shadow-sm" />
          <span className="text-red-500">Caminho Crítico</span>
        </div>
      </div>
    </div>
  );
}

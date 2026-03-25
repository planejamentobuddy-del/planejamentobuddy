import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { Project, Task, isCriticalPath } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

type ViewMode = 'diario' | 'semanal' | 'mensal';

export default function GanttTab({ project }: { project: Project }) {
  const { getTasksForProject } = useProjects();
  const tasks = useMemo(() => 
    getTasksForProject(project.id).sort((a, b) => a.startDate.localeCompare(b.startDate))
  , [getTasksForProject, project.id]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('semanal');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { minDate, maxDate, totalDays, ticks } = useMemo(() => {
    if (tasks.length === 0) {
      const s = new Date(project.startDate);
      const e = new Date(project.endDate);
      return { minDate: s.getTime(), maxDate: e.getTime(), totalDays: 30, ticks: [] };
    }

    const taskDates = tasks.flatMap(t => [new Date(t.startDate).getTime(), new Date(t.endDate).getTime()]);
    let start = Math.min(...taskDates, new Date(project.startDate).getTime());
    let end = Math.max(...taskDates, new Date(project.endDate).getTime());

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
  }, [tasks, project, viewMode]);

  const pixelsPerDay = viewMode === 'diario' ? 60 : viewMode === 'semanal' ? 12 : 4;
  const timelineWidth = totalDays * pixelsPerDay;
  const tickWidth = viewMode === 'diario' ? pixelsPerDay : viewMode === 'semanal' ? pixelsPerDay * 7 : pixelsPerDay * 30;

  const getPosition = (dateStr: string) => {
    const date = new Date(dateStr).getTime();
    return ((date - minDate) / 86400000) * pixelsPerDay;
  };

  const today = new Date().toISOString().split('T')[0];
  const todayPos = getPosition(today);

  // Auto-scroll to "Today" on mount
  useEffect(() => {
    if (timelineRef.current) {
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
          <div className="w-64 border-r border-border/40 flex flex-col shrink-0 bg-muted/[0.02] z-10">
            <div className="h-12 border-b border-border/40 flex items-center px-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/70 bg-muted/40 backdrop-blur-sm sticky top-0">
              Atividade
            </div>
            <div className="flex-1 overflow-y-hidden">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">Nenhuma tarefa</div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="h-10 flex items-center px-4 text-[11px] border-b border-border/20 truncate font-semibold text-foreground/80 hover:bg-muted/10 transition-colors">
                    {task.name}
                  </div>
                ))
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
                      {viewMode === 'mensal' ? tick.getFullYear() : tick.toLocaleDateString('pt-BR', { weekday: 'short' })}
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
                {ticks.map((_, i) => (
                  <div key={i} style={{ width: tickWidth }} className="border-r border-border/[0.07] h-full" />
                ))}
              </div>

              {/* Dependency SVG Overlay */}
              <svg className="absolute top-12 left-0 w-full h-[calc(100%-48px)] pointer-events-none z-0 overflow-visible">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.5)" />
                  </marker>
                </defs>
                {tasks.map((task, idx) => 
                  task.predecessors.map(predId => {
                    const predTask = tasks.find(t => t.id === predId);
                    if (!predTask) return null;
                    const predIdx = tasks.indexOf(predTask);
                    
                    const startX = getPosition(predTask.endDate);
                    const startY = predIdx * 40 + 20;
                    const endX = getPosition(task.startDate);
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
                  {/* Label badge */}
                  <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center">
                    <div className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest shadow-md whitespace-nowrap">
                      Hoje
                    </div>
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-500" />
                  </div>
                  {/* Line */}
                  <div className="absolute top-5 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500/70" />
                </div>
              )}

              {/* Rows and Bars */}
              <div className="relative pt-0">
                {tasks.map((task, idx) => {
                  const startPos = getPosition(task.startDate);
                  const endPos = getPosition(task.endDate);
                  const width = Math.max(24, endPos - startPos);
                  const critical = showCriticalPath && isCriticalPath(task, tasks);

                  // Color based on status
                  const barColor = critical
                    ? 'bg-red-500'
                    : task.status === 'completed'
                      ? 'bg-[#2A9D8F]'         // teal - concluído
                      : task.status === 'in_progress'
                        ? 'bg-blue-500'         // azul - em andamento
                        : task.status === 'delayed'
                          ? 'bg-red-400'        // vermelho - atrasado
                          : 'bg-slate-300 text-slate-600'; // cinza - não iniciado

                  const textColor = task.status === 'not_started' ? 'text-slate-600' : 'text-white';
                  
                  return (
                    <div key={task.id} className="h-10 relative group transition-colors hover:bg-muted/10">
                      <div
                        className={`absolute top-2 h-6 rounded-md transition-all shadow-sm flex items-center px-3 z-10 overflow-hidden font-bold text-[9px] cursor-pointer hover:brightness-110 active:scale-95 ${barColor} ${textColor}`}
                        style={{ left: startPos, width }}
                        title={`${task.name}: ${task.percentComplete}%`}
                      >
                        {/* Progress fill for in_progress */}
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

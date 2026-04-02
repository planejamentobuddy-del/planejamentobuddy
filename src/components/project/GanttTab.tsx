import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { Project, Task, getCriticalTaskIds, safeParseDate } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

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
  const [viewMode, setViewMode] = useState<ViewMode>('semanal');
  const { getTasksForProject } = useProjects();
  const allTasks = useMemo(() => 
    getTasksForProject(project.id)
  , [getTasksForProject, project.id]);
  
  const [sortMode, setSortMode] = useState<'manual' | 'chronological'>('manual');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [clickedBars, setClickedBars] = useState<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);

  // CPM critical path set
  const criticalSet = useMemo(() => getCriticalTaskIds(allTasks), [allTasks]);

  const { visibleTasks, hasChildrenMap, depthMap, computedBounds, computedProgress, wbsMap } = useMemo(() => {
    const map = new Map<string | undefined, Task[]>();
    allTasks.forEach(t => {
      const pId = t.parentId || undefined;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push(t);
    });

    const hasChildrenMap = new Map<string, boolean>();
    const depth = new Map<string, number>();
    const bounds = new Map<string, { start: string, end: string }>();
    const progress = new Map<string, number>();
    
    // Compute dynamic bounds for summary tasks based on children (MS Project style)
    const computeBounds = (taskId: string): { start: number, end: number, avgProgress: number } | null => {
      const children = map.get(taskId) || [];
      if (children.length === 0) {
        const t = allTasks.find(x => x.id === taskId);
        return t ? { 
          start: safeParseDate(t.startDate), 
          end: safeParseDate(t.endDate),
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
        const sStr = new Date(minStart).toISOString().split('T')[0];
        const eStr = new Date(maxEnd).toISOString().split('T')[0];
        bounds.set(taskId, {
          start: sStr,
          end: eStr
        });
        progress.set(taskId, avg);
        return { start: minStart, end: maxEnd, avgProgress: avg };
      }
      return null;
    };

    allTasks.forEach(t => {
      const childList = map.get(t.id) || [];
      const childIsParent = childList.length > 0;
      hasChildrenMap.set(t.id, childIsParent);
      if (childIsParent) {
        computeBounds(t.id);
      }
    });

    // Build WBS map based on fixed manual order (Planning order)
    const wbsMap = new Map<string, string>();
    const generateWBS = (parentId: string | undefined, parentNumber?: string) => {
      const children = map.get(parentId) || [];
      children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      children.forEach((child, index) => {
        const myNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
        wbsMap.set(child.id, myNumber);
        generateWBS(child.id, myNumber);
      });
    };
    generateWBS(undefined);

    // Build visible list based on sortMode
    const visible: Task[] = [];
    
    if (sortMode === 'chronological') {
      // Flat hierarchical view: Keep parent-child grouping but sort siblings by date
      const traverseCrono = (parentId: string | undefined, currentDepth: number) => {
        const children = map.get(parentId) || [];
        children.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));

        children.forEach((child) => {
          depth.set(child.id, currentDepth);
          visible.push(child);
          if (hasChildrenMap.get(child.id) && !collapsedTasks.has(child.id)) {
            traverseCrono(child.id, currentDepth + 1);
          }
        });
      };
      traverseCrono(undefined, 0);
    } else {
      // Manual EAP logic (Synchronized with Planning)
      const traverseManual = (parentId: string | undefined, currentDepth: number) => {
        const children = map.get(parentId) || [];
        children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        children.forEach((child) => {
          depth.set(child.id, currentDepth);
          visible.push(child);
          if (hasChildrenMap.get(child.id) && !collapsedTasks.has(child.id)) {
            traverseManual(child.id, currentDepth + 1);
          }
        });
      };
      traverseManual(undefined, 0);
    }

    return { visibleTasks: visible, hasChildrenMap, depthMap: depth, computedBounds: bounds, computedProgress: progress, wbsMap };
  }, [allTasks, collapsedTasks, sortMode]);

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

  const toggleBarClick = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClickedBars(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
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
      return [safeParseDate(b.start), safeParseDate(b.end)];
    });
    let start = Math.min(...taskDates, safeParseDate(project.startDate));
    let end = Math.max(...taskDates, safeParseDate(project.endDate));

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
      // Align to start of week (Sunday)
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
    const date = safeParseDate(dateStr);
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

  const handleExportVisualPDF = async () => {
    const el = document.getElementById('gantt-chart-container');
    if (!el) return;

    toast.loading('Gerando PDF do cronograma completo... (Isso pode levar alguns segundos)', { id: 'pdf-export' });
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (doc) => {
          const clonedEl = doc.getElementById('gantt-chart-container');
          if (clonedEl) {
             // Let timeline unroll horizontally
             const flexTimelineContainer = clonedEl.querySelector('.overflow-x-visible') as HTMLElement;
             if (flexTimelineContainer) {
                flexTimelineContainer.style.overflow = 'visible';
                flexTimelineContainer.style.width = 'max-content';
             }
             
             // Avoid html2canvas bug shifting coordinates based on scroll state
             const allElements = clonedEl.querySelectorAll('*');
             allElements.forEach((el: any) => {
                 if (el.scrollLeft !== undefined) el.scrollLeft = 0;
                 if (el.scrollTop !== undefined) el.scrollTop = 0;
             });
             
             // Unroll vertical hidden elements (sidebar list, etc) to prevent cropping
             const hiddenOverflows = clonedEl.querySelectorAll('.overflow-y-hidden, .overflow-hidden, .overflow-x-auto');
             hiddenOverflows.forEach((el: any) => {
                el.style.overflow = 'visible';
             });
             
             // The user requested to hide the dependency arrows ONLY in the PDF 
             // because html2canvas has inherent bugs accurately positioning SVG coordinates over large scaled DOMs.
             const svgArrows = clonedEl.querySelector('.pdf-hide-arrows') as HTMLElement;
             if (svgArrows) {
                 svgArrows.style.display = 'none';
             }
             
             // Remove flex truncation that causes html2canvas to slice text in half vertically
             const truncates = clonedEl.querySelectorAll('.truncate');
             truncates.forEach((el: any) => {
                el.classList.remove('truncate');
                el.style.whiteSpace = 'nowrap';
             });
             
             clonedEl.style.width = 'max-content';
             clonedEl.style.height = 'max-content';
             clonedEl.style.overflow = 'visible';
             clonedEl.style.backgroundColor = '#ffffff';
             
             // Ensure parent flex containers stretch to hold their fully unrolled children
             const innerFlexes = clonedEl.querySelectorAll('.flex-1');
             innerFlexes.forEach((el: any) => {
                el.style.width = 'max-content';
                el.style.height = 'max-content';
             });
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate real PDF dimensions based on CSS pixels (assuming 96 dpi -> 1px = ~0.264583 mm)
      // Since scale = 2, CSS inner width = canvas.width / 2
      const pxToMm = 0.2645833333;
      const cssWidth = canvas.width / 2;
      const cssHeight = canvas.height / 2;
      
      const widthMm = cssWidth * pxToMm;
      const heightMm = cssHeight * pxToMm;
      
      const marginMm = 10;
      const titleHeightMm = 15;
      
      // Creates a dynamic "Giant" custom page size exactly fitting the full continuous graph
      const pdf = new jsPDF({
        orientation: widthMm > heightMm ? 'landscape' : 'portrait', 
        unit: 'mm',
        format: [widthMm + (marginMm * 2), heightMm + (marginMm * 2) + titleHeightMm]
      });

      pdf.setFontSize(16);
      pdf.text(`Cronograma Completo: ${project.name}`, marginMm, marginMm + 6);
      pdf.addImage(imgData, 'PNG', marginMm, marginMm + titleHeightMm, widthMm, heightMm);
      
      pdf.save(`Cronograma_${project.name}_Completo.pdf`);
      toast.success('Cronograma Completo exportado com sucesso!', { id: 'pdf-export' });
    } catch(err) {
      console.error(err);
      toast.error('Erro ao gerar PDF completo.', { id: 'pdf-export' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Cronograma (Gantt)</h2>
        </div>
        
        <div className="flex items-center flex-wrap gap-3">
          <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border border-border/40">
            <Button 
              variant={sortMode === 'manual' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-4 rounded-lg transition-all ${sortMode === 'manual' ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setSortMode('manual')}
              title="Ordenar conforme o Planejamento"
            >
              Manual
            </Button>
            <Button 
              variant={sortMode === 'chronological' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-4 rounded-lg transition-all ${sortMode === 'chronological' ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setSortMode('chronological')}
              title="Ordenar por data de início"
            >
              Crono
            </Button>
          </div>

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

          <Button 
            variant={showAllLabels ? 'secondary' : 'outline'} 
            size="sm" 
            className={`h-8 rounded-lg gap-2 text-xs font-semibold px-4 transition-all ${showAllLabels ? 'bg-primary/10 border-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowAllLabels(!showAllLabels)}
          >
            <Users className="w-3.5 h-3.5" />
            Exibir Responsáveis
          </Button>

          <Button onClick={handleExportVisualPDF} size="sm" className="h-8 rounded-lg gap-2 text-xs font-semibold px-4 shadow-sm bg-primary/90 hover:bg-primary text-primary-foreground transition-all">
            <Download className="w-3.5 h-3.5" />
            Salvar PDF Visual
          </Button>
        </div>
      </div>

      <div className="card-elevated overflow-hidden border border-border/30 shadow-sm flex flex-col" id="gantt-chart-container">
        <div className="flex flex-1 overflow-x-auto min-h-[500px]">
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
                  // Not strictly used for display but good for internal logic
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
                          <span className={`text-[11px] truncate flex items-center ${hasChildren ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'}`}>
                            <span className="text-muted-foreground/50 mr-2 font-mono text-[10px] w-9 shrink-0">{wbsMap.get(task.id)}</span>
                            {hasChildren && <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary/60 shrink-0" />}
                            <span className="truncate">{task.name}</span>
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
          <div ref={timelineRef} className="flex-1 overflow-x-visible overflow-y-visible relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
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
                        ? `${tick.getDate().toString().padStart(2, '0')}/${(tick.getMonth() + 1).toString().padStart(2, '0')}`
                        : viewMode === 'semanal' 
                          ? `${tick.getDate().toString().padStart(2, '0')}/${(tick.getMonth() + 1).toString().padStart(2, '0')}`
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
              <svg 
                className="absolute top-12 left-0 pointer-events-none z-0 overflow-visible pdf-hide-arrows"
                width={Math.max(600, timelineWidth)}
                style={{ height: 'calc(100% - 48px)' }}
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.5)" />
                  </marker>
                </defs>
                {visibleTasks.map((task, idx) => 
                  task.predecessors.map(predId => {
                    const predTask = allTasks.find(t => t.id === predId);
                    if (!predTask) return null;
                    
                    const predIdxInVisible = visibleTasks.findIndex(t => t.id === predId);
                    if (predIdxInVisible === -1) return null; // Predecessor hidden
                    const predBounds = computedBounds.get(predTask.id);
                    const taskBounds = computedBounds.get(task.id);

                    const isPredSummary = hasChildrenMap.get(predTask.id);
                    const predHasNoDates = !predTask.startDate || !predTask.endDate;
                    if (predHasNoDates) return null; // Não desenha setas a partir de tarefas sem data
                    
                    const isTaskSummary = hasChildrenMap.get(task.id);
                    const taskHasNoDates = !task.startDate || !task.endDate;
                    if (taskHasNoDates) return null; // Não desenha setas para tarefas sem data

                    const todayStr = new Date().toISOString().split('T')[0];
                    
                    const predStartStr = (isPredSummary && predBounds ? predBounds.start : predTask.startDate) || todayStr;
                    const predEndStr = (isPredSummary && predBounds ? predBounds.end : predTask.endDate) || todayStr;
                    const predStartPos = getPosition(predStartStr);
                    const predEndPos = getPosition(predEndStr) + pixelsPerDay;
                    const predWidth = isPredSummary ? Math.max(8, predEndPos - predStartPos) : Math.max(24, predEndPos - predStartPos);
                    
                    const taskStartStr = (isTaskSummary && taskBounds ? taskBounds.start : task.startDate) || todayStr;
                    
                    const startX = predStartPos + predWidth;
                    const startY = predIdxInVisible * 40 + 20;
                    const endX = getPosition(taskStartStr);
                    const endY = idx * 40 + 20;
                    
                    // Arrow logic: Always keep the line flowing forward (to the right) cleanly.
                    // If the successor starts BEFORE the predecessor finishes (overlap),
                    // the arrow will drop down and point neatly into the body of the successor 
                    // instead of creating a chaotic backward zig-zag spiderweb.
                    const visualEndX = Math.max(startX + 18, endX);
                    
                    const path = `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${visualEndX} ${endY}`;

                    return (
                      <Fragment key={`${predId}-${task.id}`}>
                        <path 
                          d={path}
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
                  
                  const hasNoDates = !task.startDate || !task.endDate;
                  const todayStr = new Date().toISOString().split('T')[0];
                  
                  const startStr = (isSummary && bounds ? bounds.start : task.startDate) || todayStr;
                  const endStr = (isSummary && bounds ? bounds.end : task.endDate) || todayStr;
                  
                  const startPos = getPosition(startStr);
                  const endPos = getPosition(endStr) + (hasNoDates ? pixelsPerDay * 3 : pixelsPerDay);
                  
                  // Summary task bar should stretch exactly between bounds. Regular tasks have min width.
                  const width = isSummary ? Math.max(8, endPos - startPos) : Math.max(24, endPos - startPos);
                  
                  const critical = showCriticalPath && criticalSet.has(task.id);

                  // Color based on status
                  const barColor = critical
                    ? 'bg-status-danger text-white'
                    : task.status === 'completed'
                      ? 'bg-status-ok text-white'
                      : task.status === 'in_progress'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : task.status === 'rescheduled'
                      ? 'bg-amber-500 text-white shadow-sm'
                        : task.status === 'delayed'
                          ? 'bg-status-danger/70 text-white shadow-inner'
                          : 'bg-muted/80 text-muted-foreground';

                  const textColor = task.status === 'not_started' ? 'text-muted-foreground' : 'text-white';
                  const isClicked = clickedBars.has(task.id);

                  // Baseline ghost bar (only for non-summary rescheduled tasks)
                  const hasBaseline = !isSummary &&
                    task.plannedStart && task.plannedEnd &&
                    (task.plannedStart !== task.startDate || task.plannedEnd !== task.endDate);
                  const baselineStartPos = hasBaseline ? getPosition(task.plannedStart!) : 0;
                  const baselineEndPos = hasBaseline ? getPosition(task.plannedEnd!) + pixelsPerDay : 0;
                  const baselineWidth = hasBaseline ? Math.max(8, baselineEndPos - baselineStartPos) : 0;

                  return (
                    <div key={task.id} className="h-10 relative group transition-colors hover:bg-muted/10 border-b border-border/30">
                      {isSummary ? (
                        // MS Project Summary Task Style (Black Bracket) with Progress
                        <div
                          className="absolute top-1.5 z-10"
                          style={{ left: startPos, width }}
                          title={`${task.name}: ${Math.round(computedProgress.get(task.id) || 0)}%`}
                        >
                          {/* Background bar (Thick visual) */}
                          <div className={`absolute top-0 left-0 right-0 h-3 rounded-sm overflow-hidden ${critical ? 'bg-status-danger/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                            {/* Progress fill that "grows" like subtasks */}
                            <div 
                              className={`h-full transition-all duration-1000 ease-out shadow-sm relative ${critical ? 'bg-status-danger' : 'bg-slate-800 dark:bg-slate-200'}`}
                              style={{ width: `${computedProgress.get(task.id) || 0}%` }}
                            >
                              {/* Highlight for beauty */}
                              <div className="absolute inset-0 bg-white/10" />
                            </div>
                          </div>
                          
                          {/* Left Point (Downwards bracket edge) */}
                          <div 
                            className={`absolute top-2 left-0 w-0 h-0 border-l-[10px] border-r-[0px] border-t-[10px] border-transparent ${critical ? 'border-l-status-danger' : 'border-l-slate-800 dark:border-l-slate-200'}`} 
                          />
                          
                          {/* Right Point (Downwards bracket edge) */}
                          <div 
                            className={`absolute top-2 right-0 w-0 h-0 border-l-[0px] border-r-[10px] border-t-[10px] border-transparent ${critical ? 'border-r-status-danger' : 'border-r-slate-800 dark:border-r-slate-200'}`} 
                          />
                        </div>
                      ) : (
                        <>
                          {/* Baseline ghost bar (shown behind main bar for rescheduled tasks) */}
                          {hasBaseline && (
                            <div
                              className="absolute top-3 h-4 rounded-md z-[5] border border-dashed border-muted-foreground/30 bg-muted/25 pointer-events-none"
                              style={{ left: baselineStartPos, width: baselineWidth }}
                              title={`Planejado original: ${new Date(task.plannedStart! + 'T12:00:00').toLocaleDateString('pt-BR')} → ${new Date(task.plannedEnd! + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                            />
                          )}
                          {/* Regular Task Bar */}
                          <div
                            className={`absolute top-2.5 h-5 rounded-lg flex items-center px-3 z-10 font-black text-[9px] cursor-pointer hover:brightness-110 ${hasNoDates ? 'bg-muted-foreground/10 border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50' : `${barColor} ${textColor}`}`}
                            style={{ left: startPos, width }}
                            title={hasNoDates ? `${task.name}: Sem data definida` : `${task.name}: ${task.percentComplete}%`}
                            onClick={(e) => toggleBarClick(task.id, e)}
                          >
                            {!hasNoDates && task.status === 'in_progress' && task.percentComplete > 0 && (
                              <div 
                                className="absolute inset-0 bg-white/20 pointer-events-none rounded-lg"
                                style={{ width: `${task.percentComplete}%` }}
                              />
                            )}
                            <span className="relative z-10">{hasNoDates ? 'SEM DATA' : `${task.percentComplete}%`}</span>
                          </div>
                        </>
                      )}

                      {!isSummary && (showAllLabels || isClicked) && (
                        <div 
                          className="absolute top-3 h-4 flex items-center px-2 z-20 whitespace-nowrap font-bold text-[9px] text-slate-800 dark:text-slate-200 pointer-events-none"
                          style={{ left: startPos + width + 4 }}
                        >
                          {task.name} {task.responsible ? `• ${task.responsible}` : ''}
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

      <div className="flex items-center gap-8 text-[11px] text-muted-foreground font-black px-6 bg-muted/20 py-4 rounded-2xl border border-border/30 shadow-inner">
        <div className="flex items-center gap-3">
          {/* Mock Summary Task Icon */}
          <div className="relative w-6 h-3 shadow-sm">
             <div className="absolute top-0 left-0 right-0 h-1 bg-foreground rounded-full" />
             <div className="absolute top-1 left-0 w-0 h-0 border-l-[5px] border-r-[0px] border-t-[5px] border-transparent border-l-foreground" />
             <div className="absolute top-1 right-0 w-0 h-0 border-l-[0px] border-r-[5px] border-t-[5px] border-transparent border-r-foreground" />
          </div>
          <span className="uppercase tracking-widest text-[9px]">Etapa</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-blue-600 shadow-sm" />
          <span className="uppercase tracking-widest text-[9px]">Em andamento</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-status-ok shadow-sm" />
          <span className="uppercase tracking-widest text-[9px]">Concluído</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-muted border border-border/50 shadow-sm" />
          <span className="uppercase tracking-widest text-[9px]">Não iniciado</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-status-danger/70 shadow-sm" />
          <span className="uppercase tracking-widest text-[9px]">Atrasado Plano</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-amber-500 shadow-sm" />
          <span className="text-amber-600 uppercase tracking-widest text-[9px]">Reprogramada</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/25" />
          <span className="uppercase tracking-widest text-[9px]">Baseline Original</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-4 rounded-md bg-status-danger animate-pulse shadow-md" />
          <span className="text-status-danger uppercase tracking-widest text-[9px]">Caminho Crítico</span>
        </div>
      </div>
    </div>
  );
}

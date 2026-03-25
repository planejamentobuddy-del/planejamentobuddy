import { Project, isCriticalPath } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useMemo } from 'react';

export default function GanttTab({ project }: { project: Project }) {
  const { getTasksForProject } = useProjects();
  const tasks = getTasksForProject(project.id);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const s = new Date(project.startDate).getTime();
      const e = new Date(project.endDate).getTime();
      return { minDate: s, maxDate: e, totalDays: Math.max(1, Math.ceil((e - s) / 86400000)) };
    }
    const dates = tasks.flatMap(t => [new Date(t.startDate).getTime(), new Date(t.endDate).getTime()]);
    const min = Math.min(...dates, new Date(project.startDate).getTime());
    const max = Math.max(...dates, new Date(project.endDate).getTime());
    return { minDate: min, maxDate: max, totalDays: Math.max(1, Math.ceil((max - min) / 86400000)) };
  }, [tasks, project]);

  // Generate month markers
  const months = useMemo(() => {
    const result: { label: string; left: number }[] = [];
    const d = new Date(minDate);
    d.setDate(1);
    while (d.getTime() <= maxDate) {
      const pos = ((d.getTime() - minDate) / (maxDate - minDate)) * 100;
      if (pos >= 0) result.push({ label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), left: Math.max(0, pos) });
      d.setMonth(d.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate]);

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-lg">Gráfico de Gantt</h2>
      {tasks.length === 0 ? (
        <div className="card-elevated p-8 text-center text-muted-foreground">Adicione tarefas no Planejamento para visualizar o Gantt</div>
      ) : (
        <div className="card-elevated p-4 overflow-x-auto">
          {/* Month headers */}
          <div className="relative h-6 mb-2 border-b">
            {months.map((m, i) => (
              <span key={i} className="absolute text-[10px] text-muted-foreground font-medium" style={{ left: `${m.left}%` }}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="space-y-1.5" style={{ minWidth: '600px' }}>
            {tasks.map(task => {
              const start = new Date(task.startDate).getTime();
              const end = new Date(task.endDate).getTime();
              const left = ((start - minDate) / (maxDate - minDate)) * 100;
              const width = Math.max(1, ((end - start) / (maxDate - minDate)) * 100);
              const critical = isCriticalPath(task, tasks);

              return (
                <div key={task.id} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 text-xs truncate text-foreground font-medium">{task.name}</div>
                  <div className="flex-1 relative h-8 bg-muted/30 rounded">
                    <div
                      className={`gantt-bar absolute top-0.5 ${critical ? 'gantt-bar-critical' : task.percentComplete >= 100 ? 'gantt-bar-complete' : 'gantt-bar-normal'}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <div className="h-full rounded-md bg-foreground/10" style={{ width: `${task.percentComplete}%` }} />
                    </div>
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{task.percentComplete}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm gantt-bar-normal inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm gantt-bar-critical inline-block" /> Caminho Crítico</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm gantt-bar-complete inline-block" /> Concluída</span>
          </div>
        </div>
      )}
    </div>
  );
}

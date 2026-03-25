import { Project } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function CurveSTab({ project }: { project: Project }) {
  const { getTasksForProject } = useProjects();
  const tasks = getTasksForProject(project.id);

  const chartData = useMemo(() => {
    if (tasks.length === 0) return [];
    const start = new Date(project.startDate).getTime();
    const end = new Date(project.endDate).getTime();
    const totalDuration = end - start;
    const now = Date.now();
    const points: { label: string; planejado: number; realizado: number }[] = [];
    
    // Generate weekly points
    const weekMs = 7 * 86400000;
    let current = start;
    while (current <= end + weekMs) {
      const elapsed = current - start;
      const planned = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      
      // Realized: based on tasks that should be done by this date
      let realized = 0;
      if (current <= now) {
        const tasksInScope = tasks.filter(t => new Date(t.startDate).getTime() <= current);
        if (tasksInScope.length > 0) {
          realized = Math.round(tasksInScope.reduce((s, t) => s + t.percentComplete, 0) / tasks.length);
        }
      }

      points.push({
        label: new Date(current).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        planejado: planned,
        realizado: current <= now ? realized : 0,
      });
      current += weekMs;
    }
    return points;
  }, [tasks, project]);

  const lastPoint = chartData.filter(p => p.realizado > 0).pop();
  const diff = lastPoint ? lastPoint.planejado - lastPoint.realizado : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">Curva S</h2>
        {lastPoint && (
          <span className={`text-sm font-medium ${diff > 10 ? 'text-status-danger' : diff > 0 ? 'text-status-warning' : 'text-status-ok'}`}>
            {diff > 0 ? `${diff}% abaixo do planejado` : diff === 0 ? 'No prazo' : `${Math.abs(diff)}% adiantado`}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="card-elevated p-8 text-center text-muted-foreground">Adicione tarefas no Planejamento para visualizar a Curva S</div>
      ) : (
        <div className="card-elevated p-5">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Line type="monotone" name="Planejado" dataKey="planejado" stroke="hsl(var(--chart-planned))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                <Line type="monotone" name="Realizado" dataKey="realizado" stroke="hsl(var(--chart-actual))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

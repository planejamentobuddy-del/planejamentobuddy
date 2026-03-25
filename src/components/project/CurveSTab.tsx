import { Project, calculateSCurve } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function CurveSTab({ project }: { project: Project }) {
  const { getTasksForProject, loading } = useProjects();
  const tasks = getTasksForProject(project.id);

  const chartData = useMemo(() => calculateSCurve(tasks, project), [tasks, project]);


  const nowTs = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }, []);

  const summaryPoint = useMemo(() => {
    if (chartData.length === 0) return null;
    // Find last point that is not in the future (compared to Today)
    const pastPoints = chartData.filter(p => p.timestamp <= nowTs);
    return pastPoints.length > 0 ? pastPoints[pastPoints.length - 1] : chartData[0];
  }, [chartData, nowTs]);

  const diff = summaryPoint ? summaryPoint.planejado - summaryPoint.realizado : 0;
  const totalProgress = summaryPoint ? summaryPoint.realizado : 0;
  const status = diff > 10 ? 'Atrasado' : diff > 0 ? 'Atenção' : 'No prazo';
  const statusColor = diff > 10 ? 'text-status-danger bg-status-danger/10' : diff > 0 ? 'text-status-warning bg-status-warning/10' : 'text-status-ok bg-status-ok/10';


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-foreground">Curva S — Progresso da Obra</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-elevated p-6 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progresso Total</p>
          <p className="text-3xl font-display font-bold text-foreground">{totalProgress}%</p>
        </div>
        
        <div className="card-elevated p-6 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Desvio</p>
          <p className={`text-3xl font-display font-bold ${diff > 0 ? 'text-status-danger' : 'text-status-ok'}`}>
            {diff > 0 ? `-${diff.toFixed(1)}%` : `+${Math.abs(diff).toFixed(1)}%`}
          </p>
        </div>

        <div className="card-elevated p-6 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
          <div className="pt-1">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>
              {status}
            </span>
          </div>
        </div>
      </div>


      {loading ? (
        <div className="card-elevated p-8 text-center text-muted-foreground">Carregando dados...</div>
      ) : chartData.length === 0 ? (
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

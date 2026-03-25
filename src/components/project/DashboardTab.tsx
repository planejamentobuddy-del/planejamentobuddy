import { useMemo } from 'react';
import { Project, getProjectProgress, getProjectStatus, getEstimatedEndDate, isCriticalPath, getCurrentWeek, calculateSCurve } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Target, Shield, CalendarClock } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart } from 'recharts';

export default function DashboardTab({ project }: { project: Project }) {
  const { getTasksForProject, getPlansForProject, getHistoryForProject } = useProjects();
  const tasks = getTasksForProject(project.id);
  const plans = getPlansForProject(project.id);
  const history = getHistoryForProject(project.id);
  const progress = getProjectProgress(tasks);
  const status = getProjectStatus(tasks);
  const estimated = getEstimatedEndDate(project, tasks);
  const now = new Date().toISOString().split('T')[0];
  const delayed = tasks.filter(t => t.endDate < now && t.percentComplete < 100);
  const currentWeek = getCurrentWeek();
  const weekPlans = plans.filter(p => p.week === currentWeek);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;
  const restrictions = tasks.filter(t => t.hasRestriction);

  const delayDays = (() => {
    const est = new Date(estimated).getTime();
    const planned = new Date(project.endDate).getTime();
    const diff = Math.ceil((est - planned) / 86400000);
    return diff > 0 ? diff : 0;
  })();

  const curveSData = useMemo(() => calculateSCurve(tasks, project), [tasks, project]);

  const nowTs = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }, []);

  const lastCurvePoint = useMemo(() => {
    if (curveSData.length === 0) return null;
    const pastPoints = curveSData.filter(p => p.timestamp <= nowTs);
    return pastPoints.length > 0 ? pastPoints[pastPoints.length - 1] : curveSData[0];
  }, [curveSData, nowTs]);

  const curveDeviation = lastCurvePoint ? lastCurvePoint.planejado - lastCurvePoint.realizado : 0;


  // PPC history data
  const ppcChartData = history.sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
    week: h.weekLabel,
    PPC: h.ppc,
  }));

  // PPC trend
  const ppcTrend = ppcChartData.length >= 2
    ? ppcChartData[ppcChartData.length - 1].PPC >= ppcChartData[ppcChartData.length - 2].PPC ? '↑ Subindo' : '↓ Caindo'
    : '';

  // Alerts
  const alerts: { text: string; type: 'warning' | 'danger' }[] = [];
  if (ppc !== null && ppc < 80) {
    alerts.push({ text: `PPC da semana em ${ppc}%. Risco de atraso identificado.`, type: ppc < 60 ? 'danger' : 'warning' });
  }
  if (restrictions.length > 0) {
    alerts.push({ text: `${restrictions.length} restrição(ões) pendente(s) no Lean.`, type: 'warning' });
  }
  if (delayed.length > 0) {
    alerts.push({ text: `${delayed.length} tarefa(s) atrasada(s) identificada(s).`, type: 'danger' });
  }

  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {/* Executado */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="card-elevated p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-muted-foreground">Executado</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{progress}%</p>
          <p className="text-xs text-muted-foreground mt-1">{tasks.length} tarefas</p>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </motion.div>

        {/* PPC Semana */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="card-elevated p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">PPC Semana</span>
          </div>
          <p className={`text-3xl font-display font-bold ${ppcColor}`}>{ppc !== null ? `${ppc}%` : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{weekPlans.length} planejadas</p>
        </motion.div>

        {/* Atrasadas */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card-elevated p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-status-danger" />
            <span className="text-xs font-medium text-muted-foreground">Atrasadas</span>
          </div>
          <p className={`text-3xl font-display font-bold ${delayed.length > 0 ? 'text-status-danger' : 'text-foreground'}`}>{delayed.length}</p>
        </motion.div>

        {/* Restrições */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="card-elevated p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-status-warning" />
            <span className="text-xs font-medium text-muted-foreground">Restrições</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{restrictions.length}</p>
          <p className="text-xs text-muted-foreground mt-1">pendentes</p>
        </motion.div>

        {/* Previsão */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card-elevated p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Previsão</span>
          </div>
          <p className="text-xl font-display font-bold text-foreground">
            {new Date(estimated + 'T12:00:00').toLocaleDateString('pt-BR')}
          </p>
          {delayDays > 0 && (
            <p className="text-xs text-status-danger font-medium mt-1">+{delayDays} dias de atraso</p>
          )}
        </motion.div>
      </div>

      {/* Alert Banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${
                alert.type === 'danger'
                  ? 'bg-destructive/5 border-destructive/20'
                  : 'bg-[hsl(38_92%_50%/0.08)] border-[hsl(38_92%_50%/0.2)]'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.type === 'danger' ? 'text-destructive' : 'text-status-warning'}`} />
              <span className="text-sm font-medium text-foreground">{alert.text}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Curva S */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-base">Curva S</h3>
            {lastCurvePoint && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                curveDeviation > 5
                  ? 'bg-destructive/10 text-destructive'
                  : curveDeviation > 0
                  ? 'bg-[hsl(38_92%_50%/0.1)] text-status-warning'
                  : 'bg-[hsl(152_60%_42%/0.1)] text-status-ok'
              }`}>
                {curveDeviation > 0 ? `-${curveDeviation}% desvio` : curveDeviation === 0 ? 'No prazo' : `+${Math.abs(curveDeviation)}%`}
              </span>
            )}
          </div>
          {curveSData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curveSData}>
                  <defs>
                    <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10 }} 
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10 }} 
                    stroke="hsl(var(--muted-foreground))" 
                    tickFormatter={v => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(v: number) => `${v}%`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                  <Area 
                    type="monotone" 
                    name="Planejado" 
                    dataKey="planejado" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#plannedGradient)" 
                  />
                  <Line 
                    type="monotone" 
                    name="Realizado" 
                    dataKey="realizado" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Adicione tarefas para visualizar a Curva S
            </div>
          )}
        </div>

        {/* PPC Semanal */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-base">PPC Semanal</h3>
            {ppcTrend && (
              <span className="text-xs font-medium text-muted-foreground">{ppcTrend}</span>
            )}
          </div>
          {ppcChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ppcChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 15% 90%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" tickFormatter={v => `${v}%`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="PPC" stroke="hsl(243 76% 58%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(243 76% 58%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Feche semanas no Lean para ver o histórico PPC
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

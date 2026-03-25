import { Project, getProjectProgress, getProjectStatus, getEstimatedEndDate, isCriticalPath, getCurrentWeek } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const statusMessages = {
  ok: { text: 'Obra em dia', icon: CheckCircle, class: 'text-status-ok' },
  warning: { text: 'Risco de atraso', icon: AlertTriangle, class: 'text-status-warning' },
  danger: { text: 'Alto risco com impacto no caminho crítico', icon: AlertCircle, class: 'text-status-danger' },
};

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
  const critical = tasks.filter(t => isCriticalPath(t, tasks));
  const criticalDelayed = critical.filter(t => t.endDate < now && t.percentComplete < 100);
  const currentWeek = getCurrentWeek();
  const weekPlans = plans.filter(p => p.week === currentWeek);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;

  // Delay reasons ranking
  const reasonCount: Record<string, number> = {};
  plans.filter(p => p.status === 'not_completed' && p.reason).forEach(p => {
    reasonCount[p.reason] = (reasonCount[p.reason] || 0) + 1;
  });
  const rankedReasons = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]);

  const statusCfg = statusMessages[status];
  const StatusIcon = statusCfg.icon;

  const delayDays = (() => {
    const est = new Date(estimated).getTime();
    const planned = new Date(project.endDate).getTime();
    const diff = Math.ceil((est - planned) / 86400000);
    return diff > 0 ? diff : 0;
  })();

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-6 h-6 ${statusCfg.class}`} />
          <div>
            <h3 className={`font-display font-bold text-lg ${statusCfg.class}`}>{statusCfg.text}</h3>
            {delayDays > 0 && <p className="text-sm text-muted-foreground">Atraso estimado: {delayDays} dias</p>}
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Executado', value: `${progress}%`, icon: TrendingUp, color: 'text-accent' },
          { label: 'PPC da Semana', value: ppc !== null ? `${ppc}%` : '—', icon: Target, color: ppc !== null ? (ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger') : 'text-muted-foreground' },
          { label: 'Tarefas Atrasadas', value: String(delayed.length), icon: Clock, color: delayed.length > 0 ? 'text-status-danger' : 'text-status-ok' },
          { label: 'Críticas Atrasadas', value: String(criticalDelayed.length), icon: AlertTriangle, color: criticalDelayed.length > 0 ? 'text-status-danger' : 'text-status-ok' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-display font-bold ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Alerts */}
        <div className="card-elevated p-5">
          <h3 className="font-display font-semibold mb-3">⚠️ Alertas</h3>
          {delayed.length === 0 && criticalDelayed.length === 0 && (ppc === null || ppc >= 80) ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {delayed.length > 0 && <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-danger" />{delayed.length} tarefa(s) atrasada(s)</li>}
              {criticalDelayed.length > 0 && <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-danger" />{criticalDelayed.length} tarefa(s) crítica(s) atrasada(s)</li>}
              {ppc !== null && ppc < 60 && <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-danger" />PPC baixo: {ppc}%</li>}
              {ppc !== null && ppc >= 60 && ppc < 80 && <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-warning" />PPC em atenção: {ppc}%</li>}
            </ul>
          )}
        </div>

        {/* Bottleneck Ranking */}
        <div className="card-elevated p-5">
          <h3 className="font-display font-semibold mb-3">📊 Gargalos</h3>
          {rankedReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gargalo registrado</p>
          ) : (
            <ul className="space-y-2">
              {rankedReasons.map(([reason, count]) => (
                <li key={reason} className="flex items-center justify-between text-sm">
                  <span>{reason}</span>
                  <span className="font-semibold text-foreground">{count}x</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Priority List */}
      <div className="card-elevated p-5">
        <h3 className="font-display font-semibold mb-3">🎯 Prioridades</h3>
        {[...criticalDelayed, ...delayed.filter(d => !criticalDelayed.find(c => c.id === d.id))].length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa prioritária</p>
        ) : (
          <div className="space-y-2">
            {[...criticalDelayed, ...delayed.filter(d => !criticalDelayed.find(c => c.id === d.id))].slice(0, 10).map(task => (
              <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  {criticalDelayed.find(c => c.id === task.id) && <span className="text-[10px] px-1.5 py-0.5 rounded status-badge-danger">CRÍTICA</span>}
                  <span>{task.name}</span>
                </div>
                <span className="text-muted-foreground">{task.percentComplete}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

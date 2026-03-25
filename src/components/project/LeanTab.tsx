import { useState } from 'react';
import { Project, DELAY_REASONS, getCurrentWeek, WeeklyPlan } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Lock, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function LeanTab({ project }: { project: Project }) {
  const { getPlansForProject, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan, getHistoryForProject, closeWeek, getTasksForProject } = useProjects();
  const plans = getPlansForProject(project.id);
  const history = getHistoryForProject(project.id);
  const tasks = getTasksForProject(project.id);
  const currentWeek = getCurrentWeek();
  const weekPlans = plans.filter(p => p.week === currentWeek);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;

  const handleAddPlan = () => {
    addWeeklyPlan({
      projectId: project.id,
      taskId: '',
      taskName: 'Nova atividade',
      responsible: '',
      week: currentWeek,
      weekLabel: currentWeek,
      status: 'planned',
      reason: '',
      observations: '',
    });
  };

  const handleChange = (plan: WeeklyPlan, field: keyof WeeklyPlan, value: string) => {
    updateWeeklyPlan({ ...plan, [field]: value });
  };

  const handleCloseWeek = () => {
    closeWeek(project.id);
  };

  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  const chartData = history.sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
    week: h.weekLabel,
    PPC: h.ppc,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">Lean Construction — Last Planner</h2>
        <div className="flex gap-2">
          <Button onClick={handleAddPlan} size="sm" variant="outline" className="gap-1"><Plus className="w-4 h-4" /> Atividade</Button>
          <Button onClick={handleCloseWeek} size="sm" className="gap-1"><Lock className="w-4 h-4" /> Fechar Semana</Button>
        </div>
      </div>

      {/* PPC Display */}
      <div className="card-elevated p-4 flex items-center justify-between">
        <div>
          <span className="text-sm text-muted-foreground">Semana atual: {currentWeek}</span>
          <p className={`text-3xl font-display font-bold ${ppcColor}`}>
            {ppc !== null ? `${ppc}%` : '—'}
          </p>
          <span className="text-xs text-muted-foreground">PPC = Concluídas / Planejadas</span>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{weekPlans.length} planejadas</p>
          <p>{weekCompleted} concluídas</p>
        </div>
      </div>

      {/* Weekly Table */}
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium">Atividade</th>
              <th className="text-left p-3 font-medium">Responsável</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Motivo</th>
              <th className="text-left p-3 font-medium">Observações</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {weekPlans.map(plan => (
              <tr key={plan.id} className="border-b hover:bg-muted/20">
                <td className="p-2"><Input className="h-8 text-sm border-0 bg-transparent" value={plan.taskName} onChange={e => handleChange(plan, 'taskName', e.target.value)} /></td>
                <td className="p-2"><Input className="h-8 text-sm border-0 bg-transparent" value={plan.responsible} onChange={e => handleChange(plan, 'responsible', e.target.value)} placeholder="Nome" /></td>
                <td className="p-2">
                  <Select value={plan.status} onValueChange={v => handleChange(plan, 'status', v)}>
                    <SelectTrigger className="h-8 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planejado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="not_completed">Não concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  {plan.status === 'not_completed' ? (
                    <Select value={plan.reason} onValueChange={v => handleChange(plan, 'reason', v)}>
                      <SelectTrigger className="h-8 text-xs border-0 bg-transparent"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {DELAY_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="p-2"><Input className="h-8 text-sm border-0 bg-transparent" value={plan.observations} onChange={e => handleChange(plan, 'observations', e.target.value)} placeholder="Obs." /></td>
                <td className="p-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteWeeklyPlan(plan.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {weekPlans.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Adicione atividades para a semana</td></tr>}
          </tbody>
        </table>
      </div>

      {/* PPC Evolution Chart */}
      {chartData.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="font-display font-semibold mb-4">Evolução do PPC</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <ReferenceLine y={80} stroke="hsl(var(--status-ok))" strokeDasharray="4 4" label="Meta 80%" />
                <Line type="monotone" dataKey="PPC" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

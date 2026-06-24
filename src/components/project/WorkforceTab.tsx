import { useState, useMemo } from 'react';
import { Project, WorkforceEntry, WorkforceMonthlySummary, computeWorkforceSummary } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { Plus, Trash2, Edit2, Users, TrendingUp, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const PHASE_COLORS = [
  '#1C4A47', '#2C6E68', '#5C7E59', '#3E6E94', '#7A4422',
  '#C49A3E', '#5a5790', '#8C8A82', '#B23A1E', '#4a7c59',
];

interface FormState {
  month: string;
  phase: string;
  activity: string;
  ownWorkers: string;
  thirdPartyWorkers: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  month: '',
  phase: '',
  activity: '',
  ownWorkers: '0',
  thirdPartyWorkers: '0',
  notes: '',
};

const COMMON_PHASES = [
  'Mobilização & Canteiro',
  'Fundações & Subsolo',
  'Superestrutura',
  'Alvenaria & Vedação',
  'Envelope & Cobertura',
  'Instalações',
  'Impermeabilização',
  'Acabamentos',
  'Gestão & Equipe Técnica',
  'Terceirizados Especializados',
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const own = payload.find((p: any) => p.dataKey === 'totalOwn')?.value || 0;
  const third = payload.find((p: any) => p.dataKey === 'totalThirdParty')?.value || 0;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold mb-2">{label}</p>
      <p className="text-primary">Próprios: {own}</p>
      <p className="text-purple-500">Terceiros: {third}</p>
      <p className="font-bold border-t border-border mt-1.5 pt-1.5">Total: {own + third}</p>
    </div>
  );
}

export default function WorkforceTab({ project }: { project: Project }) {
  const { workforceEntries, addWorkforceEntry, updateWorkforceEntry, deleteWorkforceEntry, getTasksForProject } = useProjects();

  const tasks = useMemo(() => getTasksForProject(project.id), [getTasksForProject, project.id]);
  const planningPhases = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.name))).sort();
  }, [tasks]);

  const entries = useMemo(
    () => workforceEntries.filter(e => e.projectId === project.id),
    [workforceEntries, project.id]
  );

  const summaries = useMemo(() => computeWorkforceSummary(entries), [entries]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [customPhase, setCustomPhase] = useState('');

  // KPIs
  const kpis = useMemo(() => {
    if (summaries.length === 0) return { peak: 0, peakMonth: '—', totalManDays: 0, avgPerMonth: 0 };
    const peak = Math.max(...summaries.map(s => s.total));
    const peakMonth = summaries.find(s => s.total === peak)?.label || '—';
    const totalManDays = entries.reduce((sum, e) => sum + e.ownWorkers + e.thirdPartyWorkers, 0) * 22;
    const avgPerMonth = summaries.length > 0 ? Math.round(summaries.reduce((s, m) => s + m.total, 0) / summaries.length) : 0;
    return { peak, peakMonth, totalManDays, avgPerMonth };
  }, [summaries, entries]);

  function openNew() {
    setForm({ ...EMPTY_FORM, month: new Date().toISOString().slice(0, 7) });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(entry: WorkforceEntry) {
    setForm({
      month: entry.month,
      phase: entry.phase,
      activity: entry.activity || '',
      ownWorkers: entry.ownWorkers.toString(),
      thirdPartyWorkers: entry.thirdPartyWorkers.toString(),
      notes: entry.notes || '',
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function handleSave() {
    const phase = form.phase === '__custom__' ? customPhase.trim() : form.phase;
    if (!form.month) { toast.error('Mês é obrigatório.'); return; }
    if (!phase) { toast.error('Fase é obrigatória.'); return; }

    const payload: Omit<WorkforceEntry, 'id' | 'createdAt'> = {
      projectId: project.id,
      month: form.month,
      phase,
      activity: form.activity || undefined,
      ownWorkers: parseInt(form.ownWorkers) || 0,
      thirdPartyWorkers: parseInt(form.thirdPartyWorkers) || 0,
      notes: form.notes || undefined,
    };

    if (editingId) {
      const existing = entries.find(e => e.id === editingId)!;
      await updateWorkforceEntry({ ...existing, ...payload });
    } else {
      await addWorkforceEntry(payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro de efetivo?')) return;
    await deleteWorkforceEntry(id);
  }

  const chartData = summaries.map(s => ({
    label: s.label,
    totalOwn: s.totalOwn,
    totalThirdParty: s.totalThirdParty,
    total: s.total,
  }));

  const peakValue = kpis.peak;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Efetivo de Mão de Obra
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Histograma mensal de trabalhadores por fase — próprios e terceirizados
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Adicionar Mês/Fase
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pico de Efetivo', value: kpis.peak, sub: kpis.peakMonth, color: 'text-red-600', bg: 'bg-red-500/10' },
          { label: 'Média Mensal', value: kpis.avgPerMonth, sub: 'trabalhadores/mês', color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: 'Total Hom×Dia (est.)', value: kpis.totalManDays.toLocaleString('pt-BR'), sub: '22 dias/mês', color: 'text-purple-600', bg: 'bg-purple-500/10' },
          { label: 'Meses Planejados', value: summaries.length, sub: 'meses com dados', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
        ].map((k, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className={`text-2xl font-bold font-display ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-foreground mt-1">{k.label}</div>
            <div className="text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Histogram Chart */}
      {chartData.length > 0 ? (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Histograma de Efetivo Mensal
            </h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/80 inline-block" /> Próprios</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500/80 inline-block" /> Terceiros</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalOwn" name="Próprios" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="totalThirdParty" name="Terceiros" stackId="a" fill="rgb(168 85 247 / 0.8)" radius={[3, 3, 0, 0]} />
              {peakValue > 0 && (
                <ReferenceLine y={peakValue} stroke="hsl(var(--destructive))" strokeDasharray="4 2" label={{ value: `Pico: ${peakValue}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--destructive))' }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum dado de efetivo cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Adicione meses e fases para ver o histograma</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">
              {editingId ? 'Editar Registro' : 'Novo Registro de Efetivo'}
            </h3>
            <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês *</label>
              <Input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fase *</label>
              <select
                value={form.phase}
                onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione uma fase...</option>
                {planningPhases.length > 0 && (
                  <optgroup label="Etapas do Planejamento Mestre">
                    {planningPhases.map(p => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                )}
                <optgroup label="Fases Padrão">
                  {COMMON_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <option value="__custom__">+ Outra fase (digitar)</option>
              </select>
            </div>
            {form.phase === '__custom__' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da Fase</label>
                <Input value={customPhase} onChange={e => setCustomPhase(e.target.value)} placeholder="Ex: Estrutura Metálica" className="rounded-lg" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Atividade (opcional)</label>
              <Input value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} placeholder="Ex: Montagem de formas" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mão de obra própria</label>
              <Input type="number" min="0" value={form.ownWorkers} onChange={e => setForm(f => ({ ...f, ownWorkers: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Terceirizados</label>
              <Input type="number" min="0" value={form.thirdPartyWorkers} onChange={e => setForm(f => ({ ...f, thirdPartyWorkers: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: Pico de concretagem" className="rounded-lg" />
            </div>
            <div className="flex items-end">
              <div className="bg-muted rounded-lg p-3 w-full text-center">
                <div className="text-2xl font-bold text-primary">
                  {(parseInt(form.ownWorkers) || 0) + (parseInt(form.thirdPartyWorkers) || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total no mês</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            <Button className="rounded-xl gap-2" onClick={handleSave}><Save className="w-4 h-4" /> {editingId ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </div>
      )}

      {/* Monthly Detail Table */}
      {summaries.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display font-semibold text-foreground">Detalhamento por Mês e Fase</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mês</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próprios</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terceiros</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(summary => {
                  const isExpanded = expandedMonth === summary.month;
                  const isPeak = summary.total === kpis.peak && kpis.peak > 0;
                  return [
                    <tr
                      key={summary.month}
                      className={`border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${isPeak ? 'bg-red-500/5' : ''}`}
                      onClick={() => setExpandedMonth(isExpanded ? null : summary.month)}
                    >
                      <td className="px-4 py-3 font-semibold">
                        {summary.label}
                        {isPeak && <span className="ml-2 text-xs text-red-600 font-normal">▲ Pico</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-primary font-semibold">{summary.totalOwn}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-semibold">{summary.totalThirdParty}</td>
                      <td className="px-4 py-3 text-right font-bold">{summary.total}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${summary.month}-detail`} className="border-b border-border bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-1.5">
                            {summary.phases.map(entry => (
                              <div key={entry.id} className="flex items-center gap-3 text-xs bg-background rounded-lg px-3 py-2 border border-border">
                                <div className="flex-1">
                                  <span className="font-semibold">{entry.phase}</span>
                                  {entry.activity && <span className="text-muted-foreground ml-2">· {entry.activity}</span>}
                                  {entry.notes && <span className="text-muted-foreground ml-2 italic">{entry.notes}</span>}
                                </div>
                                <span className="text-primary font-semibold">{entry.ownWorkers} próprios</span>
                                <span className="text-purple-600 font-semibold">{entry.thirdPartyWorkers} terceiros</span>
                                <span className="font-bold">{entry.ownWorkers + entry.thirdPartyWorkers} total</span>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md" onClick={(e) => { e.stopPropagation(); openEdit(entry); }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  ];
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-bold border-t-2 border-border">
                  <td className="px-4 py-3">Total Acumulado</td>
                  <td className="px-4 py-3 text-right text-primary">{summaries.reduce((s, m) => s + m.totalOwn, 0)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{summaries.reduce((s, m) => s + m.totalThirdParty, 0)}</td>
                  <td className="px-4 py-3 text-right">{summaries.reduce((s, m) => s + m.total, 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Project, SupplyPackage, SupplyStatus, SUPPLY_STATUS_LABELS, SUPPLY_STATUS_COLORS } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Edit2, Package, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, DollarSign, ShoppingCart, Truck, X, Save,
  ChevronDown, ChevronUp, Filter, Star
} from 'lucide-react';
import { toast } from 'sonner';

const PHASE_COLORS: Record<string, string> = {
  pending_quantitative: 'bg-slate-400',
  pending_order: 'bg-amber-500',
  ordered: 'bg-blue-500',
  in_production: 'bg-purple-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-400',
};

function formatBRL(v?: number) {
  if (!v) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function formatDate(d?: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function DeadlineAlert({ pkg }: { pkg: SupplyPackage }) {
  if (pkg.status === 'ordered' || pkg.status === 'delivered' || pkg.status === 'cancelled') return null;
  const days = daysUntil(pkg.orderDeadline);
  if (days === null) return null;
  if (days < 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="w-3 h-3" /> Atrasado {Math.abs(days)}d</span>;
  }
  if (days <= 30) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold"><Clock className="w-3 h-3" /> {days}d para pedir</span>;
  }
  return <span className="text-xs text-muted-foreground">{days}d restantes</span>;
}

const EMPTY_PKG: Omit<SupplyPackage, 'id' | 'createdAt'> = {
  projectId: '',
  name: '',
  supplier: '',
  estimatedValue: undefined,
  isCritical: false,
  leadTimeDays: 30,
  quantitativeDoneDate: '',
  orderDeadline: '',
  orderDate: '',
  expectedDeliveryDate: '',
  actualDeliveryDate: '',
  status: 'pending_quantitative',
  notes: '',
};

interface FormState {
  name: string;
  supplier: string;
  estimatedValue: string;
  isCritical: boolean;
  leadTimeDays: string;
  quantitativeDoneDate: string;
  orderDeadline: string;
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string;
  status: SupplyStatus;
  notes: string;
  taskId: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  supplier: '',
  estimatedValue: '',
  isCritical: false,
  leadTimeDays: '30',
  quantitativeDoneDate: '',
  orderDeadline: '',
  orderDate: '',
  expectedDeliveryDate: '',
  actualDeliveryDate: '',
  status: 'pending_quantitative',
  notes: '',
  taskId: '',
};

export default function SuppliesTab({ project }: { project: Project }) {
  const { supplyPackages, addSupplyPackage, updateSupplyPackage, deleteSupplyPackage, getTasksForProject } = useProjects();
  const tasks = getTasksForProject(project.id);
  const packages = useMemo(() => supplyPackages.filter(p => p.projectId === project.id), [supplyPackages, project.id]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCritical, setFilterCritical] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = packages;
    if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
    if (filterCritical) list = list.filter(p => p.isCritical);
    return list.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      if (!a.orderDeadline && !b.orderDeadline) return 0;
      if (!a.orderDeadline) return 1;
      if (!b.orderDeadline) return -1;
      return a.orderDeadline.localeCompare(b.orderDeadline);
    });
  }, [packages, filterStatus, filterCritical]);

  // KPIs
  const kpis = useMemo(() => {
    const critical = packages.filter(p => p.isCritical);
    const pendingOrder = packages.filter(p => p.status === 'pending_order' || p.status === 'pending_quantitative');
    const urgentAlerts = packages.filter(p => {
      const d = daysUntil(p.orderDeadline);
      return d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered' && p.status !== 'cancelled';
    });
    const totalValue = packages.reduce((s, p) => s + (p.estimatedValue || 0), 0);
    return { critical: critical.length, pendingOrder: pendingOrder.length, urgentAlerts: urgentAlerts.length, totalValue };
  }, [packages]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(pkg: SupplyPackage) {
    setForm({
      name: pkg.name,
      supplier: pkg.supplier || '',
      estimatedValue: pkg.estimatedValue?.toString() || '',
      isCritical: pkg.isCritical,
      leadTimeDays: pkg.leadTimeDays.toString(),
      quantitativeDoneDate: pkg.quantitativeDoneDate || '',
      orderDeadline: pkg.orderDeadline || '',
      orderDate: pkg.orderDate || '',
      expectedDeliveryDate: pkg.expectedDeliveryDate || '',
      actualDeliveryDate: pkg.actualDeliveryDate || '',
      status: pkg.status,
      notes: pkg.notes || '',
      taskId: pkg.taskId || '',
    });
    setEditingId(pkg.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nome do pacote é obrigatório.'); return; }
    const payload: Omit<SupplyPackage, 'id' | 'createdAt'> = {
      projectId: project.id,
      taskId: form.taskId || undefined,
      name: form.name.trim(),
      supplier: form.supplier || undefined,
      estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
      isCritical: form.isCritical,
      leadTimeDays: parseInt(form.leadTimeDays) || 30,
      quantitativeDoneDate: form.quantitativeDoneDate || undefined,
      orderDeadline: form.orderDeadline || undefined,
      orderDate: form.orderDate || undefined,
      expectedDeliveryDate: form.expectedDeliveryDate || undefined,
      actualDeliveryDate: form.actualDeliveryDate || undefined,
      status: form.status,
      notes: form.notes || undefined,
    };

    if (editingId) {
      const existing = packages.find(p => p.id === editingId)!;
      await updateSupplyPackage({ ...existing, ...payload });
    } else {
      await addSupplyPackage(payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este pacote de suprimento?')) return;
    await deleteSupplyPackage(id);
  }

  const statusOrder: SupplyStatus[] = ['pending_quantitative', 'pending_order', 'ordered', 'in_production', 'delivered', 'cancelled'];

  // Gantt-style timeline helpers
  function getTimelinePosition(pkg: SupplyPackage) {
    const start = project.startDate;
    const end = project.endDate;
    const projectStart = new Date(start).getTime();
    const projectEnd = new Date(end).getTime();
    const totalMs = projectEnd - projectStart;
    if (totalMs <= 0) return null;

    const toPercent = (d?: string) => {
      if (!d) return null;
      const ms = new Date(d).getTime() - projectStart;
      return Math.max(0, Math.min(100, (ms / totalMs) * 100));
    };

    return {
      qto: toPercent(pkg.quantitativeDoneDate),
      order: toPercent(pkg.orderDeadline),
      leadStart: toPercent(pkg.orderDate || pkg.orderDeadline),
      delivery: toPercent(pkg.expectedDeliveryDate),
    };
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Controle de Suprimentos
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie marcos de compra, lead times e entregas de materiais críticos
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Novo Pacote
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pacotes Críticos', value: kpis.critical, icon: Star, color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { label: 'Aguardando Pedido', value: kpis.pendingOrder, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: 'Alertas Urgentes', value: kpis.urgentAlerts, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10' },
          { label: 'Valor Total Est.', value: formatBRL(kpis.totalValue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
        ].map((k, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <div className={`text-xl font-bold font-display ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><Filter className="w-4 h-4" /> Filtrar:</div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 h-8 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOrder.map(s => (
              <SelectItem key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filterCritical ? 'default' : 'outline'}
          size="sm"
          className="h-8 rounded-lg gap-1 text-xs"
          onClick={() => setFilterCritical(!filterCritical)}
        >
          <Star className="w-3 h-3" /> Só Críticos
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} pacote{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Urgent Alerts Banner */}
      {kpis.urgentAlerts > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {kpis.urgentAlerts} pacote{kpis.urgentAlerts > 1 ? 's' : ''} com prazo de pedido urgente (&lt;30 dias)
            </p>
            <p className="text-xs text-red-600/80 mt-0.5">
              Verifique os itens marcados em vermelho/âmbar na tabela abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">
              {editingId ? 'Editar Pacote' : 'Novo Pacote de Suprimento'}
            </h3>
            <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Pacote *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Esquadrias MADO (alumínio/vidro)" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fornecedor</label>
              <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="MADO Esquadrias" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Estimado (R$)</label>
              <Input type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="3000000" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead Time (dias)</label>
              <Input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} placeholder="120" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as SupplyStatus }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOrder.map(s => <SelectItem key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantitativo Pronto</label>
              <Input type="date" value={form.quantitativeDoneDate} onChange={e => setForm(f => ({ ...f, quantitativeDoneDate: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">🔴 Data-Limite do Pedido</label>
              <Input type="date" value={form.orderDeadline} onChange={e => setForm(f => ({ ...f, orderDeadline: e.target.value }))} className="rounded-lg border-red-300 focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data do Pedido (real)</label>
              <Input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Prevista</label>
              <Input type="date" value={form.expectedDeliveryDate} onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Real</label>
              <Input type="date" value={form.actualDeliveryDate} onChange={e => setForm(f => ({ ...f, actualDeliveryDate: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vincular à Tarefa</label>
              <Select value={form.taskId || 'none'} onValueChange={v => setForm(f => ({ ...f, taskId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(() => {
                    const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean) as string[]);
                    return tasks.filter(t => !parentIds.has(t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isCritical}
                  onChange={e => setForm(f => ({ ...f, isCritical: e.target.checked }))}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> Item Crítico</span>
              </label>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Informações adicionais..." className="rounded-lg" />
            </div>
          </div>

          <div className="flex gap-3 mt-5 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            <Button className="rounded-xl gap-2" onClick={handleSave}><Save className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Adicionar Pacote'}</Button>
          </div>
        </div>
      )}

      {/* Packages List */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum pacote de suprimento cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Adicione pacotes de compra para monitorar lead times e marcos críticos</p>
          <Button variant="outline" className="mt-4 rounded-xl gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Adicionar Primeiro Pacote</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pkg => {
            const days = daysUntil(pkg.orderDeadline);
            const isUrgent = days !== null && days <= 30 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
            const isOverdue = days !== null && days < 0 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
            const isExpanded = expandedId === pkg.id;
            const timeline = getTimelinePosition(pkg);

            return (
              <div
                key={pkg.id}
                className={`bg-card rounded-xl border transition-all ${
                  isOverdue ? 'border-red-500/40 bg-red-500/5' :
                  isUrgent ? 'border-amber-500/40 bg-amber-500/5' :
                  pkg.status === 'delivered' ? 'border-emerald-500/30' :
                  'border-border'
                }`}
              >
                {/* Main Row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${PHASE_COLORS[pkg.status]}`} />

                  {/* Critical star */}
                  {pkg.isCritical && <Star className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500" />}

                  {/* Name & supplier */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{pkg.name}</span>
                      <Badge className={`text-[10px] px-2 py-0 h-5 ${SUPPLY_STATUS_COLORS[pkg.status]}`}>
                        {SUPPLY_STATUS_LABELS[pkg.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {pkg.supplier && <span className="text-xs text-muted-foreground">{pkg.supplier}</span>}
                      {pkg.estimatedValue && (
                        <span className="text-xs font-semibold text-emerald-600">{formatBRL(pkg.estimatedValue)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">Lead: {pkg.leadTimeDays}d</span>
                    </div>
                  </div>

                  {/* Deadline & alert */}
                  <div className="text-right shrink-0">
                    {pkg.orderDeadline && (
                      <div className="text-xs text-muted-foreground mb-0.5">Pedir até: <span className="font-semibold">{formatDate(pkg.orderDeadline)}</span></div>
                    )}
                    <DeadlineAlert pkg={pkg} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => setExpandedId(isExpanded ? null : pkg.id)}>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => openEdit(pkg)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded details with mini timeline */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {/* Timeline bar */}
                    {timeline && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-2 font-medium">Linha do tempo do projeto</div>
                        <div className="relative h-6 bg-muted rounded-lg overflow-hidden">
                          {/* Lead time bar */}
                          {timeline.leadStart !== null && timeline.delivery !== null && (
                            <div
                              className="absolute top-1 bottom-1 bg-purple-500/40 rounded"
                              style={{ left: `${timeline.leadStart}%`, width: `${Math.max(0, (timeline.delivery || 0) - timeline.leadStart)}%` }}
                            />
                          )}
                          {/* QTO marker */}
                          {timeline.qto !== null && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500" style={{ left: `${timeline.qto}%` }}>
                              <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-amber-600 font-bold whitespace-nowrap">QTO</span>
                            </div>
                          )}
                          {/* Order deadline marker */}
                          {timeline.order !== null && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${timeline.order}%` }}>
                              <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-600 font-bold whitespace-nowrap">PEDIR</span>
                            </div>
                          )}
                          {/* Delivery marker */}
                          {timeline.delivery !== null && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500" style={{ left: `${timeline.delivery}%` }}>
                              <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-emerald-600 font-bold whitespace-nowrap">ENTREGA</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Date details */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      {[
                        { label: '◆ Quantit. pronto', value: formatDate(pkg.quantitativeDoneDate), color: 'text-amber-600' },
                        { label: '🔴 Data-limite pedido', value: formatDate(pkg.orderDeadline), color: 'text-red-600' },
                        { label: '✓ Pedido realizado', value: formatDate(pkg.orderDate), color: 'text-blue-600' },
                        { label: '◆ Entrega prevista', value: formatDate(pkg.expectedDeliveryDate), color: 'text-purple-600' },
                        { label: '✓ Entrega real', value: formatDate(pkg.actualDeliveryDate), color: 'text-emerald-600' },
                      ].map((item, i) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-2">
                          <div className="text-muted-foreground mb-0.5">{item.label}</div>
                          <div className={`font-semibold ${item.color}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {pkg.notes && (
                      <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Obs.: </span>{pkg.notes}
                      </div>
                    )}

                    {/* Linked task */}
                    {pkg.taskId && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Vinculado à tarefa: <span className="font-medium text-foreground">{tasks.find(t => t.id === pkg.taskId)?.name || pkg.taskId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {statusOrder.map(s => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[s]}`} />
            {SUPPLY_STATUS_LABELS[s]}
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Project, SupplyPackage, SupplyStatus, SUPPLY_STATUS_LABELS, SUPPLY_STATUS_COLORS } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Edit2, Package, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, ShoppingCart, Truck, X, Save,
  ChevronDown, ChevronUp, Filter, Star, LayoutGrid, List,
  ArrowRight, Zap, PackageCheck, Factory, BarChart2, User,
  ListTodo, Paperclip, FileText, Mail
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants, helpers & structured types
// ─────────────────────────────────────────────────────────────────────────────

export interface QuantitativeItem {
  desc: string;
  qty: string;
  unit: string;
}

export function parseQuantitative(val?: string): QuantitativeItem[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return [{ desc: val, qty: '', unit: '' }];
    }
  }
  return [{ desc: val, qty: '', unit: '' }];
}

export function serializeQuantitative(items: QuantitativeItem[]): string {
  const valid = items.filter(i => i.desc.trim() !== '');
  if (valid.length === 1 && !valid[0].qty && !valid[0].unit) {
    return valid[0].desc;
  }
  return JSON.stringify(valid);
}

const STATUS_ORDER: SupplyStatus[] = [
  'pending_quantitative', 'pending_order', 'ordered', 'in_production', 'delivered', 'cancelled'
];

const KANBAN_COLUMNS: { id: SupplyStatus; label: string; icon: React.ReactNode; color: string; headerBg: string }[] = [
  { id: 'pending_quantitative', label: 'Aguard. Quantitativo', icon: <BarChart2 className="w-3.5 h-3.5" />, color: 'border-slate-400', headerBg: 'bg-slate-500/10' },
  { id: 'pending_order',        label: 'Aguard. Pedido',        icon: <Clock className="w-3.5 h-3.5" />,     color: 'border-amber-400', headerBg: 'bg-amber-500/10' },
  { id: 'ordered',              label: 'Pedido Realizado',       icon: <PackageCheck className="w-3.5 h-3.5" />, color: 'border-blue-400', headerBg: 'bg-blue-500/10' },
  { id: 'in_production',        label: 'Em Produção / Lead',     icon: <Factory className="w-3.5 h-3.5" />,   color: 'border-purple-400', headerBg: 'bg-purple-500/10' },
  { id: 'delivered',            label: 'Entregue',               icon: <Truck className="w-3.5 h-3.5" />,     color: 'border-emerald-400', headerBg: 'bg-emerald-500/10' },
];

const DOT_COLORS: Record<string, string> = {
  pending_quantitative: 'bg-slate-400',
  pending_order: 'bg-amber-500',
  ordered: 'bg-blue-500',
  in_production: 'bg-purple-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-400',
};

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

/** Given arriveBy and daysBeforeOrder, compute the order deadline */
function computeOrderDeadline(arriveBy?: string, daysBeforeOrder?: number): string | undefined {
  if (!arriveBy || !daysBeforeOrder) return undefined;
  const d = new Date(arriveBy + 'T12:00:00');
  d.setDate(d.getDate() - daysBeforeOrder);
  return d.toISOString().split('T')[0];
}

function isOrderLate(pkg: SupplyPackage) {
  const deadline = pkg.orderDeadline || computeOrderDeadline(pkg.arriveBy, pkg.daysBeforeOrder);
  const d = daysUntil(deadline);
  return d !== null && d < 0 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
}

function isDeliveryLate(pkg: SupplyPackage) {
  const d = daysUntil(pkg.expectedDeliveryDate || pkg.arriveBy);
  return d !== null && d < 0 && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
}

function isUrgent(pkg: SupplyPackage) {
  const deadline = pkg.orderDeadline || computeOrderDeadline(pkg.arriveBy, pkg.daysBeforeOrder);
  const d = daysUntil(deadline);
  return d !== null && d >= 0 && d <= 10 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
}

function getEffectiveDeadline(pkg: SupplyPackage) {
  return pkg.orderDeadline || computeOrderDeadline(pkg.arriveBy, pkg.daysBeforeOrder);
}

function DeadlineBadge({ pkg }: { pkg: SupplyPackage }) {
  if (pkg.status === 'ordered' || pkg.status === 'delivered' || pkg.status === 'cancelled') return null;
  const deadline = getEffectiveDeadline(pkg);
  const days = daysUntil(deadline);
  if (days === null) return null;
  if (days < 0)   return <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-500/10 rounded px-1.5 py-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Atrasado {Math.abs(days)}d</span>;
  if (days <= 10) return <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-bold bg-orange-500/10 rounded px-1.5 py-0.5"><Zap className="w-2.5 h-2.5" /> {days}d URGENTE</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold bg-amber-500/10 rounded px-1.5 py-0.5"><Clock className="w-2.5 h-2.5" /> {days}d</span>;
  return <span className="text-[10px] text-muted-foreground">{days}d restantes</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form types
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  quantitative: string;
  isCritical: boolean;
  leadTimeDays: string;
  arriveBy: string;
  daysBeforeOrder: string;
  responsible: string;
  quantitativeDoneDate: string;
  orderDeadline: string;
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string;
  status: SupplyStatus;
  notes: string;
  taskId: string;
  pdfUrl: string;
  quantitativeItems: QuantitativeItem[];
}

const EMPTY_FORM: FormState = {
  name: '',
  quantitative: '',
  isCritical: false,
  leadTimeDays: '30',
  arriveBy: '',
  daysBeforeOrder: '',
  responsible: '',
  quantitativeDoneDate: '',
  orderDeadline: '',
  orderDate: '',
  expectedDeliveryDate: '',
  actualDeliveryDate: '',
  status: 'pending_quantitative',
  notes: '',
  taskId: '',
  pdfUrl: '',
  quantitativeItems: [{ desc: '', qty: '', unit: '' }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'timeline' | 'list';

export default function SuppliesTab({ project }: { project: Project }) {
  const { supplyPackages, addSupplyPackage, updateSupplyPackage, deleteSupplyPackage, getTasksForProject, users } = useProjects();
  const tasks = getTasksForProject(project.id);
  const packages = useMemo(() => supplyPackages.filter(p => p.projectId === project.id), [supplyPackages, project.id]);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCritical, setFilterCritical] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const urgent        = packages.filter(isUrgent);
    const orderLate     = packages.filter(isOrderLate);
    const deliveryLate  = packages.filter(isDeliveryLate);
    const totalPkg      = packages.filter(p => p.status !== 'cancelled').length;
    const deliveredPkg  = packages.filter(p => p.status === 'delivered').length;
    return { urgent: urgent.length, orderLate: orderLate.length, deliveryLate: deliveryLate.length, totalPkg, deliveredPkg };
  }, [packages]);

  const filtered = useMemo(() => {
    let list = packages;
    if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
    if (filterCritical) list = list.filter(p => p.isCritical);
    return list.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      const da = getEffectiveDeadline(a) || '9999';
      const db = getEffectiveDeadline(b) || '9999';
      return da.localeCompare(db);
    });
  }, [packages, filterStatus, filterCritical]);

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }

  function openEdit(pkg: SupplyPackage) {
    const qItems = parseQuantitative(pkg.quantitative);
    setForm({
      name: pkg.name,
      quantitative: pkg.quantitative || '',
      isCritical: pkg.isCritical,
      leadTimeDays: pkg.leadTimeDays.toString(),
      arriveBy: pkg.arriveBy || '',
      daysBeforeOrder: pkg.daysBeforeOrder?.toString() || '',
      responsible: pkg.responsible || '',
      quantitativeDoneDate: pkg.quantitativeDoneDate || '',
      orderDeadline: pkg.orderDeadline || '',
      orderDate: pkg.orderDate || '',
      expectedDeliveryDate: pkg.expectedDeliveryDate || '',
      actualDeliveryDate: pkg.actualDeliveryDate || '',
      status: pkg.status,
      notes: pkg.notes || '',
      taskId: pkg.taskId || '',
      pdfUrl: pkg.pdfUrl || '',
      quantitativeItems: qItems.length > 0 ? qItems : [{ desc: '', qty: '', unit: '' }],
    });
    setEditingId(pkg.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nome do pacote é obrigatório.'); return; }

    const quantitativeValue = serializeQuantitative(form.quantitativeItems);
    const computedDeadline = form.orderDeadline || computeOrderDeadline(form.arriveBy || undefined, form.daysBeforeOrder ? parseInt(form.daysBeforeOrder) : undefined);

    const payload: Omit<SupplyPackage, 'id' | 'createdAt'> = {
      projectId: project.id,
      taskId: form.taskId || undefined,
      name: form.name.trim(),
      quantitative: quantitativeValue || undefined,
      isCritical: form.isCritical,
      leadTimeDays: parseInt(form.leadTimeDays) || 30,
      arriveBy: form.arriveBy || undefined,
      daysBeforeOrder: form.daysBeforeOrder ? parseInt(form.daysBeforeOrder) : undefined,
      responsible: form.responsible || undefined,
      quantitativeDoneDate: form.quantitativeDoneDate || undefined,
      orderDeadline: computedDeadline || undefined,
      orderDate: form.orderDate || undefined,
      expectedDeliveryDate: form.expectedDeliveryDate || undefined,
      actualDeliveryDate: form.actualDeliveryDate || undefined,
      status: form.status,
      notes: form.notes || undefined,
      pdfUrl: form.pdfUrl.trim() || undefined,
    };

    if (editingId) {
      const ex = packages.find(p => p.id === editingId)!;
      await updateSupplyPackage({ ...ex, ...payload });
    } else {
      await addSupplyPackage(payload);
    }
    setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este pacote de suprimento?')) return;
    await deleteSupplyPackage(id);
  }

  async function advanceStatus(pkg: SupplyPackage) {
    const idx = STATUS_ORDER.indexOf(pkg.status);
    if (idx < 0 || idx >= STATUS_ORDER.length - 2) return;
    const next = STATUS_ORDER[idx + 1];
    await updateSupplyPackage({ ...pkg, status: next });
  }

  // ── Timeline helpers ──────────────────────────────────────────────────────
  function getTimelinePos(pkg: SupplyPackage) {
    const ps = new Date(project.startDate).getTime();
    const pe = new Date(project.endDate).getTime();
    const total = pe - ps;
    if (total <= 0) return null;
    const pct = (d?: string) => {
      if (!d) return null;
      return Math.max(0, Math.min(100, ((new Date(d).getTime() - ps) / total) * 100));
    };
    const deadline = getEffectiveDeadline(pkg);
    return {
      qto: pct(pkg.quantitativeDoneDate),
      order: pct(deadline),
      leadStart: pct(pkg.orderDate || deadline),
      delivery: pct(pkg.expectedDeliveryDate || pkg.arriveBy),
    };
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Controle de Suprimentos
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Pipeline visual de compras, lead times e entregas críticas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {([
              { mode: 'kanban'   as ViewMode, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Kanban' },
              { mode: 'timeline' as ViewMode, icon: <BarChart2 className="w-3.5 h-3.5" />,  label: 'Timeline' },
              { mode: 'list'     as ViewMode, icon: <List className="w-3.5 h-3.5" />,       label: 'Lista' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>
          <Button onClick={openNew} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" /> Novo Pacote
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Compras Urgentes (<10d)', value: kpis.urgent,        icon: Zap,           color: 'text-orange-600', bg: 'bg-orange-500/10', ring: kpis.urgent > 0 ? 'ring-1 ring-orange-400/50' : '' },
          { label: 'Pedidos Atrasados',        value: kpis.orderLate,    icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-500/10',    ring: kpis.orderLate > 0 ? 'ring-1 ring-red-400/50' : '' },
          { label: 'Entregas Atrasadas',       value: kpis.deliveryLate, icon: Truck,          color: 'text-purple-600', bg: 'bg-purple-500/10', ring: kpis.deliveryLate > 0 ? 'ring-1 ring-purple-400/50' : '' },
          { label: `Entregues (${kpis.deliveredPkg}/${kpis.totalPkg})`,  value: `${kpis.totalPkg > 0 ? Math.round((kpis.deliveredPkg / kpis.totalPkg) * 100) : 0}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: '' },
        ].map((k, i) => (
          <div key={i} className={`bg-card rounded-xl border border-border p-4 flex items-center gap-3 ${k.ring}`}>
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

      {/* ── Urgent Banner ── */}
      {(kpis.urgent > 0 || kpis.orderLate > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Atenção: {kpis.orderLate} pedido{kpis.orderLate !== 1 ? 's' : ''} atrasado{kpis.orderLate !== 1 ? 's' : ''} e {kpis.urgent} compra{kpis.urgent !== 1 ? 's' : ''} urgente{kpis.urgent !== 1 ? 's' : ''} (&lt;10 dias)
            </p>
            <p className="text-xs text-red-600/80 mt-0.5">Revise imediatamente os itens destacados na visualização abaixo.</p>
          </div>
        </div>
      )}

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">{editingId ? 'Editar Pacote' : 'Novo Pacote de Suprimento'}</h3>
            <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Nome */}
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Pacote *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Esquadrias de Alumínio" className="rounded-lg" />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as SupplyStatus }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Quantitativo - Múltiplos Itens */}
            <div className="lg:col-span-3 border border-border bg-muted/20 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-primary" /> Múltiplos Itens de Quantitativos (Tabela)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 rounded-lg"
                  onClick={() => setForm(f => ({
                    ...f,
                    quantitativeItems: [...f.quantitativeItems, { desc: '', qty: '', unit: '' }]
                  }))}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2">
                {form.quantitativeItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={item.desc}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => {
                          const copy = [...f.quantitativeItems];
                          copy[idx].desc = val;
                          return { ...f, quantitativeItems: copy };
                        });
                      }}
                      placeholder="Ex: Cimento CP-II"
                      className="rounded-lg text-xs flex-1"
                    />
                    <Input
                      type="number"
                      value={item.qty}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => {
                          const copy = [...f.quantitativeItems];
                          copy[idx].qty = val;
                          return { ...f, quantitativeItems: copy };
                        });
                      }}
                      placeholder="Qtd (Ex: 280)"
                      className="rounded-lg text-xs w-24"
                    />
                    <Input
                      value={item.unit}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => {
                          const copy = [...f.quantitativeItems];
                          copy[idx].unit = val;
                          return { ...f, quantitativeItems: copy };
                        });
                      }}
                      placeholder="Unid (Ex: sacos)"
                      className="rounded-lg text-xs w-24"
                    />
                    {form.quantitativeItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        onClick={() => setForm(f => {
                          const copy = f.quantitativeItems.filter((_, i) => i !== idx);
                          return { ...f, quantitativeItems: copy };
                        })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* PDF/Calculation memory URL */}
              <div className="pt-2 border-t border-border">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-4 h-4 text-red-500" /> Link do PDF / Memória de Cálculo (Opcional)
                </label>
                <div className="relative">
                  <Paperclip className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.pdfUrl}
                    onChange={e => setForm(f => ({ ...f, pdfUrl: e.target.value }))}
                    placeholder="Ex: https://link-do-seu-documento.pdf"
                    className="pl-9 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Chegar até */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">📅 Chegar até (na obra)</label>
              <Input type="date" value={form.arriveBy} onChange={e => setForm(f => ({ ...f, arriveBy: e.target.value }))} className="rounded-lg" />
            </div>

            {/* Dias antes para pedir */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">🔴 Pedir com antecedência (dias)</label>
              <Input
                type="number"
                value={form.daysBeforeOrder}
                onChange={e => setForm(f => ({ ...f, daysBeforeOrder: e.target.value }))}
                placeholder="Ex: 30"
                className="rounded-lg"
              />
              {form.arriveBy && form.daysBeforeOrder && (
                <p className="text-[10px] text-primary mt-1">
                  → Pedir até: {formatDate(computeOrderDeadline(form.arriveBy, parseInt(form.daysBeforeOrder)))}
                </p>
              )}
            </div>

            {/* Lead Time */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead Time (dias fabricação)</label>
              <Input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} placeholder="120" className="rounded-lg" />
            </div>

             {/* Responsável */}
             <div>
               <label className="text-xs font-medium text-muted-foreground mb-1 block">👤 Responsável pelo Pedido</label>
               <Select value={form.responsible || 'none'} onValueChange={v => setForm(f => ({ ...f, responsible: v === 'none' ? '' : v }))}>
                 <SelectTrigger className="rounded-lg">
                   <SelectValue placeholder="Selecione o responsável..." />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="none">Nenhum</SelectItem>
                   {users?.filter(u => u.full_name || u.email).map(u => {
                     const name = u.full_name || u.email || 'Usuário Sem Nome';
                     return (
                       <SelectItem key={u.id} value={name}>{name}</SelectItem>
                     );
                   })}
                 </SelectContent>
               </Select>
             </div>

            {/* Quantitativo Pronto */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantitativo Pronto em</label>
              <Input type="date" value={form.quantitativeDoneDate} onChange={e => setForm(f => ({ ...f, quantitativeDoneDate: e.target.value }))} className="rounded-lg" />
            </div>

            {/* Data Limite pedido manual */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data-Limite do Pedido (manual)</label>
              <Input type="date" value={form.orderDeadline} onChange={e => setForm(f => ({ ...f, orderDeadline: e.target.value }))} className="rounded-lg border-red-300 focus:border-red-500" />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para calcular automaticamente</p>
            </div>

            {/* Data do Pedido real */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data do Pedido (realizado)</label>
              <Input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} className="rounded-lg" />
            </div>

            {/* Entrega Prevista */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Prevista</label>
              <Input type="date" value={form.expectedDeliveryDate} onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))} className="rounded-lg" />
            </div>

            {/* Entrega Real */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Real</label>
              <Input type="date" value={form.actualDeliveryDate} onChange={e => setForm(f => ({ ...f, actualDeliveryDate: e.target.value }))} className="rounded-lg" />
            </div>

            {/* Vincular Tarefa */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vincular à Tarefa</label>
              <Select value={form.taskId || 'none'} onValueChange={v => setForm(f => ({ ...f, taskId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(() => {
                    const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean) as string[]);
                    return tasks.filter(t => !parentIds.has(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* Crítico */}
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isCritical} onChange={e => setForm(f => ({ ...f, isCritical: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> Item Crítico</span>
              </label>
            </div>

            {/* Observações */}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          KANBAN VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'kanban' && (
        <>
          {packages.length === 0 ? <EmptyState onAdd={openNew} /> : (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-[900px]">
                {KANBAN_COLUMNS.map(col => {
                  const colPkgs = packages.filter(p => p.status === col.id).sort((a, b) => {
                    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
                    return (getEffectiveDeadline(a) || '9999').localeCompare(getEffectiveDeadline(b) || '9999');
                  });
                  return (
                    <div key={col.id} className={`flex-1 min-w-[200px] rounded-xl border-t-2 ${col.color} bg-card border border-border overflow-hidden`}>
                      <div className={`${col.headerBg} px-3 py-2.5 flex items-center justify-between`}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">{col.icon} {col.label}</div>
                        <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">{colPkgs.length}</span>
                      </div>
                      <div className="p-2 space-y-2 min-h-[120px]">
                        {colPkgs.map(pkg => {
                          const late = isOrderLate(pkg);
                          const urg  = isUrgent(pkg);
                          const deadline = getEffectiveDeadline(pkg);
                          return (
                            <div
                              key={pkg.id}
                              className={`rounded-lg border p-3 space-y-2 text-xs transition-all hover:shadow-sm ${
                                late ? 'border-red-400/50 bg-red-500/5' : urg ? 'border-orange-400/50 bg-orange-500/5' : 'border-border bg-background'
                              }`}
                            >
                              {/* Name + critical */}
                              <div className="flex items-start gap-1.5">
                                {pkg.isCritical && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />}
                                <span className="font-semibold text-foreground leading-tight">{pkg.name}</span>
                              </div>
                              {/* Quantitativo */}
                              {pkg.quantitative && (() => {
                                const qItems = parseQuantitative(pkg.quantitative);
                                if (qItems.length === 1 && !qItems[0].qty && !qItems[0].unit) {
                                  return (
                                    <div className="text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                      {qItems[0].desc}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="space-y-1 bg-muted/30 border border-border/40 rounded-lg p-2 text-[10px] text-muted-foreground">
                                    <div className="font-semibold text-foreground border-b border-border/30 pb-1 mb-1 flex items-center gap-1">
                                      <ListTodo className="w-3.5 h-3.5 text-primary" /> Detalhamento:
                                    </div>
                                    {qItems.map((item, idx) => (
                                      <div key={idx} className="flex justify-between gap-2">
                                        <span className="truncate">• {item.desc}</span>
                                        <span className="font-semibold text-foreground shrink-0">{item.qty} {item.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Link do PDF */}
                              {pkg.pdfUrl && (
                                <div className="pt-1">
                                  <a
                                    href={pkg.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/15 rounded-lg px-2 py-1 font-semibold transition-colors"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> PDF do Quantitativo
                                  </a>
                                </div>
                              )}
                              {/* Lead time */}
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span className="text-muted-foreground">Lead: {pkg.leadTimeDays}d</span>
                                <DeadlineBadge pkg={pkg} />
                              </div>
                              {/* Pedir até */}
                              {deadline && (
                                <div className="text-muted-foreground">Pedir até: <span className="font-medium text-foreground">{formatDate(deadline)}</span></div>
                              )}
                              {/* Chegar até */}
                              {pkg.arriveBy && (
                                <div className="text-muted-foreground">Chegar até: <span className="font-medium text-foreground">{formatDate(pkg.arriveBy)}</span></div>
                              )}
                              {/* Responsável */}
                              {pkg.responsible && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{pkg.responsible}</span>
                                </div>
                              )}
                              {/* Actions */}
                              <div className="flex items-center gap-1 pt-1 border-t border-border/60">
                                {col.id !== 'delivered' && col.id !== 'in_production' && (
                                  <button
                                    onClick={() => advanceStatus(pkg)}
                                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-semibold transition-colors"
                                  >
                                    Avançar <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                                <button onClick={() => openEdit(pkg)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={() => handleDelete(pkg.id)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          );
                        })}
                        {colPkgs.length === 0 && (
                          <div className="flex items-center justify-center h-20 text-muted-foreground/40 text-xs">Vazio</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TIMELINE VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'timeline' && (
        <>
          {packages.length === 0 ? <EmptyState onAdd={openNew} /> : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                <span className="font-semibold text-foreground text-xs">Linha do Tempo — {formatDate(project.startDate)} → {formatDate(project.endDate)}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> QTO pronto</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Limite pedido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-purple-400/50 inline-block" /> Lead time</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Entrega</span>
              </div>
              <div className="divide-y divide-border">
                {filtered.map(pkg => {
                  const tl   = getTimelinePos(pkg);
                  const late = isOrderLate(pkg);
                  const urg  = isUrgent(pkg);
                  const deadline = getEffectiveDeadline(pkg);
                  const qItems = parseQuantitative(pkg.quantitative);
                  return (
                    <div key={pkg.id} className={`px-4 py-3 ${late ? 'bg-red-500/5' : urg ? 'bg-orange-500/5' : ''}`}>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[pkg.status]}`} />
                        {pkg.isCritical && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
                        {pkg.quantitative && (() => {
                          if (qItems.length === 1 && !qItems[0].qty && !qItems[0].unit) {
                            return <span className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-0.5">{qItems[0].desc}</span>;
                          }
                          return <span className="text-xs text-primary bg-primary/5 border border-primary/20 rounded px-2 py-0.5 font-medium flex items-center gap-1"><ListTodo className="w-3 h-3" /> {qItems.length} itens</span>;
                        })()}
                        {pkg.pdfUrl && (
                          <a
                            href={pkg.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/15 rounded-lg px-2 py-0.5 font-semibold text-[10px] flex items-center gap-1 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </a>
                        )}
                        {pkg.responsible && <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto"><User className="w-3 h-3" />{pkg.responsible}</span>}
                        <DeadlineBadge pkg={pkg} />
                        <button onClick={() => openEdit(pkg)} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {tl ? (
                        <div className="relative h-8 bg-muted/60 rounded-lg overflow-visible ml-5">
                          {tl.leadStart !== null && tl.delivery !== null && (
                            <div className="absolute top-2 bottom-2 bg-purple-400/40 rounded"
                              style={{ left: `${tl.leadStart}%`, width: `${Math.max(1, (tl.delivery || 0) - tl.leadStart)}%` }} />
                          )}
                          {tl.qto !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500" style={{ left: `${tl.qto}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-amber-600 font-bold whitespace-nowrap">QTO</span></div>}
                          {tl.order !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${tl.order}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-600 font-bold whitespace-nowrap">PEDIDO</span></div>}
                          {tl.delivery !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500" style={{ left: `${tl.delivery}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-emerald-600 font-bold whitespace-nowrap">ENTREGA</span></div>}
                        </div>
                      ) : (
                        <div className="ml-5 h-8 bg-muted/40 rounded-lg flex items-center justify-center text-xs text-muted-foreground/50">Sem datas cadastradas</div>
                      )}
                      <div className="flex gap-3 mt-2 ml-5 flex-wrap text-[10px]">
                        {pkg.quantitativeDoneDate && <span className="text-amber-600">◆ QTO: {formatDate(pkg.quantitativeDoneDate)}</span>}
                        {deadline && <span className={late ? 'text-red-600 font-bold' : 'text-red-500'}>⚡ Pedir até: {formatDate(deadline)}</span>}
                        {pkg.arriveBy && <span className="text-blue-600">📅 Chegar até: {formatDate(pkg.arriveBy)}</span>}
                        {pkg.orderDate && <span className="text-blue-600">✓ Pedido: {formatDate(pkg.orderDate)}</span>}
                        {pkg.expectedDeliveryDate && <span className="text-purple-600">◆ Prev.: {formatDate(pkg.expectedDeliveryDate)}</span>}
                        {pkg.actualDeliveryDate && <span className="text-emerald-600">✓ Real: {formatDate(pkg.actualDeliveryDate)}</span>}
                        <span className="text-muted-foreground">Lead: {pkg.leadTimeDays}d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LIST VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-sm text-muted-foreground"><Filter className="w-4 h-4" /> Filtrar:</div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48 h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={filterCritical ? 'default' : 'outline'} size="sm" className="h-8 rounded-lg gap-1 text-xs" onClick={() => setFilterCritical(!filterCritical)}>
              <Star className="w-3 h-3" /> Só Críticos
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} pacote{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? <EmptyState onAdd={openNew} /> : (
            <div className="space-y-2">
              {filtered.map(pkg => {
                const late    = isOrderLate(pkg);
                const urg     = isUrgent(pkg);
                const isExp   = expandedId === pkg.id;
                const tl      = getTimelinePos(pkg);
                const deadline = getEffectiveDeadline(pkg);
                return (
                  <div key={pkg.id} className={`bg-card rounded-xl border transition-all ${late ? 'border-red-500/40 bg-red-500/5' : urg ? 'border-orange-400/40 bg-orange-500/5' : pkg.status === 'delivered' ? 'border-emerald-500/30' : 'border-border'}`}>
                    <div className="flex items-center gap-3 p-4">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[pkg.status]}`} />
                      {pkg.isCritical && <Star className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{pkg.name}</span>
                          <Badge className={`text-[10px] px-2 py-0 h-5 ${SUPPLY_STATUS_COLORS[pkg.status]}`}>{SUPPLY_STATUS_LABELS[pkg.status]}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {pkg.quantitative && (() => {
                            const qItems = parseQuantitative(pkg.quantitative);
                            if (qItems.length === 1 && !qItems[0].qty && !qItems[0].unit) {
                              return <span className="text-xs text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">{qItems[0].desc}</span>;
                            }
                            return <span className="text-xs text-primary bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5 font-medium flex items-center gap-1"><ListTodo className="w-3.5 h-3.5" /> {qItems.length} itens de quantitativo</span>;
                          })()}
                          {pkg.pdfUrl && (
                            <a
                              href={pkg.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/15 rounded-lg px-2 py-0.5 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> PDF do Quantitativo
                            </a>
                          )}
                          {pkg.responsible && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />{pkg.responsible}</span>}
                          <span className="text-xs text-muted-foreground">Lead: {pkg.leadTimeDays}d</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {deadline && <div className="text-xs text-muted-foreground mb-0.5">Pedir até: <span className="font-semibold">{formatDate(deadline)}</span></div>}
                        {pkg.arriveBy && <div className="text-xs text-muted-foreground">Chegar até: <span className="font-semibold">{formatDate(pkg.arriveBy)}</span></div>}
                        <DeadlineBadge pkg={pkg} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => setExpandedId(isExp ? null : pkg.id)}>
                          {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => openEdit(pkg)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDelete(pkg.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    {isExp && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        {tl && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2 font-medium">Linha do tempo do projeto</div>
                            <div className="relative h-6 bg-muted rounded-lg overflow-hidden">
                              {tl.leadStart !== null && tl.delivery !== null && (
                                <div className="absolute top-1 bottom-1 bg-purple-500/40 rounded" style={{ left: `${tl.leadStart}%`, width: `${Math.max(0, (tl.delivery || 0) - tl.leadStart)}%` }} />
                              )}
                              {tl.qto !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500" style={{ left: `${tl.qto}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-amber-600 font-bold whitespace-nowrap">QTO</span></div>}
                              {tl.order !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${tl.order}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-600 font-bold whitespace-nowrap">PEDIR</span></div>}
                              {tl.delivery !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500" style={{ left: `${tl.delivery}%` }}><span className="absolute -top-4 -translate-x-1/2 text-[9px] text-emerald-600 font-bold whitespace-nowrap">ENTREGA</span></div>}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {[
                            { label: '◆ QTO pronto', value: formatDate(pkg.quantitativeDoneDate), color: 'text-amber-600' },
                            { label: '🔴 Pedir até', value: formatDate(deadline), color: 'text-red-600' },
                            { label: '📅 Chegar até', value: formatDate(pkg.arriveBy), color: 'text-blue-600' },
                            { label: '✓ Pedido', value: formatDate(pkg.orderDate), color: 'text-blue-600' },
                            { label: '◆ Entrega prev.', value: formatDate(pkg.expectedDeliveryDate), color: 'text-purple-600' },
                            { label: '✓ Entrega real', value: formatDate(pkg.actualDeliveryDate), color: 'text-emerald-600' },
                          ].map((item, i) => (
                            <div key={i} className="bg-muted/50 rounded-lg p-2">
                              <div className="text-muted-foreground mb-0.5">{item.label}</div>
                              <div className={`font-semibold ${item.color}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const qItems = parseQuantitative(pkg.quantitative);
                          if (qItems.length > 1 || (qItems.length === 1 && (qItems[0].qty || qItems[0].unit))) {
                            return (
                              <div className="bg-muted/30 border rounded-lg p-3 space-y-2 text-xs">
                                <span className="font-semibold text-foreground flex items-center gap-1.5"><ListTodo className="w-3.5 h-3.5 text-primary" /> Tabela Detalhada de Quantitativos:</span>
                                <div className="divide-y divide-border/60">
                                  {qItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between py-1.5 text-muted-foreground">
                                      <span>{item.desc}</span>
                                      <span className="font-semibold text-foreground">{item.qty} {item.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {pkg.notes && <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Obs.: </span>{pkg.notes}</div>}
                        {pkg.taskId && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Vinculado à tarefa: <span className="font-medium text-foreground">{tasks.find(t => t.id === pkg.taskId)?.name || pkg.taskId}</span>
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
            {STATUS_ORDER.map(s => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${DOT_COLORS[s]}`} />{SUPPLY_STATUS_LABELS[s]}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-muted-foreground font-medium">Nenhum pacote de suprimento cadastrado</p>
      <p className="text-sm text-muted-foreground/70 mt-1">Adicione pacotes de compra para monitorar lead times e marcos críticos</p>
      <Button variant="outline" className="mt-4 rounded-xl gap-2" onClick={onAdd}><Plus className="w-4 h-4" /> Adicionar Primeiro Pacote</Button>
    </div>
  );
}

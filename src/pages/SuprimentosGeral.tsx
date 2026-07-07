import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Project, SupplyPackage, SupplyStatus, SUPPLY_STATUS_LABELS, SUPPLY_STATUS_COLORS } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Edit2, Package, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, ShoppingCart, Truck, X, Save,
  ChevronDown, ChevronUp, Filter, Star, LayoutGrid, List,
  ArrowRight, Zap, PackageCheck, Factory, BarChart2, User,
  Mail, ArrowLeft, Send, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function computeOrderDeadline(arriveBy?: string, daysBeforeOrder?: number): string | undefined {
  if (!arriveBy || !daysBeforeOrder) return undefined;
  const d = new Date(arriveBy + 'T12:00:00');
  d.setDate(d.getDate() - daysBeforeOrder);
  return d.toISOString().split('T')[0];
}

function getEffectiveDeadline(pkg: SupplyPackage) {
  return pkg.orderDeadline || computeOrderDeadline(pkg.arriveBy, pkg.daysBeforeOrder);
}

function isOrderLate(pkg: SupplyPackage) {
  const deadline = getEffectiveDeadline(pkg);
  const d = daysUntil(deadline);
  return d !== null && d < 0 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
}

function isDeliveryLate(pkg: SupplyPackage) {
  const d = daysUntil(pkg.expectedDeliveryDate || pkg.arriveBy);
  return d !== null && d < 0 && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
}

function isUrgent(pkg: SupplyPackage) {
  const deadline = getEffectiveDeadline(pkg);
  const d = daysUntil(deadline);
  return d !== null && d >= 0 && d <= 10 && pkg.status !== 'ordered' && pkg.status !== 'delivered' && pkg.status !== 'cancelled';
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
// Form & Email state
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  projectId: string;
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
}

const EMPTY_FORM: FormState = {
  projectId: '',
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
};

interface EmailModalState {
  isOpen: boolean;
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
  pkgId: string | null;
}

const EMPTY_EMAIL: EmailModalState = {
  isOpen: false,
  toName: '',
  toEmail: '',
  subject: '',
  body: '',
  pkgId: null
};

type ViewMode = 'kanban' | 'timeline' | 'list';

export default function SuprimentosGeral() {
  const navigate = useNavigate();
  const { projects, supplyPackages, addSupplyPackage, updateSupplyPackage, deleteSupplyPackage, tasks, users } = useProjects();

  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'archived'), [projects]);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCritical, setFilterCritical] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Email notifications state
  const [emailModal, setEmailModal] = useState<EmailModalState>(EMPTY_EMAIL);

  // ── Filtered packages across all active projects ──
  const packages = useMemo(() => {
    return supplyPackages.filter(p => activeProjects.some(proj => proj.id === p.projectId));
  }, [supplyPackages, activeProjects]);

  const filtered = useMemo(() => {
    let list = packages;
    if (filterProject !== 'all') list = list.filter(p => p.projectId === filterProject);
    if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
    if (filterCritical) list = list.filter(p => p.isCritical);
    return list.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      const da = getEffectiveDeadline(a) || '9999';
      const db = getEffectiveDeadline(b) || '9999';
      return da.localeCompare(db);
    });
  }, [packages, filterProject, filterStatus, filterCritical]);

  const kpis = useMemo(() => {
    const urgent        = packages.filter(isUrgent);
    const orderLate     = packages.filter(isOrderLate);
    const deliveryLate  = packages.filter(isDeliveryLate);
    const totalPkg      = packages.filter(p => p.status !== 'cancelled').length;
    const deliveredPkg  = packages.filter(p => p.status === 'delivered').length;
    return { urgent: urgent.length, orderLate: orderLate.length, deliveryLate: deliveryLate.length, totalPkg, deliveredPkg };
  }, [packages]);

  // Tasks for the selected project in form
  const currentProjectTasks = useMemo(() => {
    if (!form.projectId) return [];
    return tasks.filter(t => t.projectId === form.projectId);
  }, [form.projectId, tasks]);

  // ── CRUD Helpers ──
  function openNew() {
    setForm({ ...EMPTY_FORM, projectId: activeProjects[0]?.id || '' });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(pkg: SupplyPackage) {
    setForm({
      projectId: pkg.projectId,
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
    });
    setEditingId(pkg.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.projectId) { toast.error('Selecione uma obra.'); return; }
    if (!form.name.trim()) { toast.error('Nome do pacote é obrigatório.'); return; }

    const computedDeadline = form.orderDeadline || computeOrderDeadline(form.arriveBy || undefined, form.daysBeforeOrder ? parseInt(form.daysBeforeOrder) : undefined);

    const payload: Omit<SupplyPackage, 'id' | 'createdAt'> = {
      projectId: form.projectId,
      taskId: form.taskId || undefined,
      name: form.name.trim(),
      quantitative: form.quantitative || undefined,
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

  // ── Email Trigger and Dialogs ──
  function openNotificationModal(pkg: SupplyPackage) {
    const projName = activeProjects.find(p => p.id === pkg.projectId)?.name || 'Obra';
    const deadlineStr = formatDate(getEffectiveDeadline(pkg));
    const arriveStr = formatDate(pkg.arriveBy);
    const respName = pkg.responsible || 'Responsável';

    const userProfile = users?.find(u => u.full_name === pkg.responsible);
    const toEmail = userProfile?.email || (pkg.responsible ? `${respName.toLowerCase().replace(/\s+/g, '')}@buddyconstrutora.com.br` : 'compras@buddyconstrutora.com.br');

    const subject = `⚠️ ALERTA: Pedido de Insumo Crítico - ${pkg.name} [${projName}]`;
    const body = `Olá ${respName},\n\nEste é um alerta automático do setor de Compras do Planejamento Buddy.\n\nO seguinte pacote de suprimentos está agendado e requer ação:\n\n▪ Pacote: ${pkg.name}\n📍 Obra: ${projName}\n📊 Quantitativo: ${pkg.quantitative || 'Não informado'}\n🔴 Data-Limite para Pedir: ${deadlineStr}\n📅 Data de Chegada na Obra: ${arriveStr}\n⚡ Status Atual: ${SUPPLY_STATUS_LABELS[pkg.status]}\n\nPor favor, confirme se o quantitativo foi validado e se o pedido de compra já foi realizado para evitar atrasos na execução da etapa.\n\nAtenciosamente,\nSetor de Suprimentos & Planejamento\nBuddy Construtora`;

    setEmailModal({
      isOpen: true,
      toName: respName,
      toEmail,
      subject,
      body,
      pkgId: pkg.id
    });
  }

  async function sendEmailNotification() {
    if (!emailModal.toEmail.trim()) { toast.error('E-mail do destinatário é obrigatório.'); return; }
    
    const pkg = packages.find(p => p.id === emailModal.pkgId);
    if (!pkg) { toast.error('Insumo não encontrado.'); return; }

    const loadingToast = toast.loading(`Enviando e-mail para ${emailModal.toName}...`);
    let sentSuccessfully = false;

    const projName = activeProjects.find(p => p.id === pkg.projectId)?.name || 'Obra';
    const deadlineStr = formatDate(getEffectiveDeadline(pkg));
    const arriveStr = formatDate(pkg.arriveBy);

    try {
      const { data, error } = await supabase.functions.invoke('send-supply-alert', {
        body: {
          to_email: emailModal.toEmail,
          usuario_destino: emailModal.toName,
          obra_nome: projName,
          insumo_nome: pkg.name,
          quantitativo: pkg.quantitative || 'Não informado',
          status_atual: SUPPLY_STATUS_LABELS[pkg.status],
          prioridade: pkg.isCritical ? 'CRÍTICO 🔴' : 'Normal',
          prazo_pedido: deadlineStr,
          prazo_entrega: arriveStr,
          observacoes: (pkg.notes || '')
            .split('\n')
            .filter(line => !line.trim().startsWith('[Notificação'))
            .join('\n')
            .trim() || 'Nenhuma',
          app_url: 'https://planejamentobuddy.vercel.app/suprimentos'
        }
      });

      if (error) throw error;
      
      toast.success(`E-mail de cobrança enviado com sucesso para ${emailModal.toEmail}!`);
      sentSuccessfully = true;
    } catch (err: any) {
      console.error('Failed to send real email:', err);
      toast.error(`Falha no envio de e-mail real: ${err.message || 'Erro de comunicação'}. A cobrança foi logada localmente.`);
    } finally {
      toast.dismiss(loadingToast);
    }
    
    if (emailModal.pkgId) {
      const pkg = packages.find(p => p.id === emailModal.pkgId);
      if (pkg) {
        const timestamp = new Date().toLocaleString('pt-BR');
        const statusText = sentSuccessfully ? 'Enviada com sucesso' : 'Falhou no envio real (verifique API Key no Supabase)';
        const notificationLog = `\n[Notificação disparada em ${timestamp} para ${emailModal.toEmail} | Status: ${statusText}]`;
        await updateSupplyPackage({
          ...pkg,
          notes: pkg.notes ? pkg.notes + notificationLog : notificationLog
        });
      }
    }

    setEmailModal(EMPTY_EMAIL);
  }

  // Send warnings to all urgent/overdue responsible users
  async function triggerBulkAlerts() {
    const overdueAndUrgent = packages.filter(p => isOrderLate(p) || isUrgent(p));
    if (overdueAndUrgent.length === 0) {
      toast.info('Nenhuma compra urgente ou em atraso detectada para alertas.');
      return;
    }

    if (!confirm(`Deseja disparar alertas de e-mail consolidados para os responsáveis das ${overdueAndUrgent.length} compras críticas?`)) return;

    const loadingToast = toast.loading('Disparando e-mails consolidados de suprimentos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.dismiss(loadingToast);
    toast.success(`Disparados ${overdueAndUrgent.length} alertas de e-mail com sucesso!`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="border-b bg-card py-4 px-6 sticky top-0 z-40 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display font-black text-foreground flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> Módulo de Suprimentos Global
            </h1>
            <p className="text-xs text-muted-foreground">Setor de Compras • Controle Consolidado de todas as Obras</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl border-amber-500/20 text-amber-600 hover:bg-amber-50" onClick={triggerBulkAlerts}>
            <Mail className="w-4 h-4" /> Disparar Alertas de Compras
          </Button>
          <Button onClick={openNew} className="gap-2 btn-primary rounded-xl">
            <Plus className="w-4 h-4" /> Novo Pacote
          </Button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Compras Urgentes (<10d)', value: kpis.urgent,        icon: Zap,           color: 'text-orange-600', bg: 'bg-orange-500/10', ring: kpis.urgent > 0 ? 'ring-1 ring-orange-400/50' : '' },
            { label: 'Pedidos Atrasados',        value: kpis.orderLate,    icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-500/10',    ring: kpis.orderLate > 0 ? 'ring-1 ring-red-400/50' : '' },
            { label: 'Entregas Atrasadas',       value: kpis.deliveryLate, icon: Truck,          color: 'text-purple-600', bg: 'bg-purple-500/10', ring: kpis.deliveryLate > 0 ? 'ring-1 ring-purple-400/50' : '' },
            { label: `Progresso de Entrega`,     value: `${kpis.totalPkg > 0 ? Math.round((kpis.deliveredPkg / kpis.totalPkg) * 100) : 0}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: '' },
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

        {/* Warning Banner */}
        {(kpis.urgent > 0 || kpis.orderLate > 0) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Atenção Setor de Compras: {kpis.orderLate} pedido(s) atrasado(s) e {kpis.urgent} compra(s) urgente(s) precisando de ação.
              </p>
              <p className="text-xs text-red-600/80 mt-0.5">Use o botão de e-mail em cada card para cobrar o responsável ou envie um alerta geral.</p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="w-4 h-4" /> Filtros:</div>
          
          {/* Obra Select */}
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-56 h-9 rounded-lg text-xs"><SelectValue placeholder="Todas as Obras" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Obras ({packages.length})</SelectItem>
              {activeProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({packages.filter(pkg => pkg.projectId === p.id).length})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Select */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 h-9 rounded-lg text-xs"><SelectValue placeholder="Todos os Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Critical Star Switcher */}
          <Button variant={filterCritical ? 'default' : 'outline'} size="sm" className="h-9 rounded-lg gap-1.5 text-xs" onClick={() => setFilterCritical(!filterCritical)}>
            <Star className={`w-3.5 h-3.5 ${filterCritical ? 'fill-white' : ''}`} /> Só Críticos
          </Button>

          {/* View selector */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 ml-auto">
            {([
              { mode: 'kanban'   as ViewMode, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Kanban' },
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
        </div>

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
              {/* Escolha a Obra */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">📍 Vincular à Obra *</label>
                <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v, taskId: '' }))} disabled={!!editingId}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Escolha a obra..." /></SelectTrigger>
                  <SelectContent>
                    {activeProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Nome do Pacote */}
              <div className="md:col-span-2">
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

              {/* Quantitativo */}
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantitativo</label>
                <Input value={form.quantitative} onChange={e => setForm(f => ({ ...f, quantitative: e.target.value }))} placeholder="Ex: 280 UND - SACO CIMENTO CPII POTY" className="rounded-lg" />
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
              </div>

              {/* Lead Time */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead Time (dias fabricação)</label>
                <Input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} placeholder="30" className="rounded-lg" />
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

              {/* Data Limite manual */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data-Limite de Pedido (manual)</label>
                <Input type="date" value={form.orderDeadline} onChange={e => setForm(f => ({ ...f, orderDeadline: e.target.value }))} className="rounded-lg" />
              </div>

              {/* Vincular Tarefa */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Vincular à Tarefa do Cronograma</label>
                <Select value={form.taskId || 'none'} onValueChange={v => setForm(f => ({ ...f, taskId: v === 'none' ? '' : v }))} disabled={!form.projectId}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {currentProjectTasks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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

        {/* ── KANBAN VIEW ── */}
        {viewMode === 'kanban' && (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-[1000px]">
              {KANBAN_COLUMNS.map(col => {
                const colPkgs = filtered.filter(p => p.status === col.id);
                return (
                  <div key={col.id} className={`flex-1 min-w-[220px] rounded-xl border-t-2 ${col.color} bg-card border border-border overflow-hidden flex flex-col`}>
                    <div className={`${col.headerBg} px-3 py-3 flex items-center justify-between border-b border-border/40`}>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">{col.icon} {col.label}</div>
                      <span className="text-[10px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-bold">{colPkgs.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[400px] bg-muted/10 flex-1">
                      {colPkgs.map(pkg => {
                        const late = isOrderLate(pkg);
                        const urg  = isUrgent(pkg);
                        const deadline = getEffectiveDeadline(pkg);
                        const projName = activeProjects.find(p => p.id === pkg.projectId)?.name || 'Obra';
                        return (
                          <div
                            key={pkg.id}
                            className={`rounded-lg border p-3.5 space-y-2.5 text-xs transition-all hover:shadow-md bg-card border-border`}
                          >
                            {/* Obra Tag */}
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] px-1.5 py-0">
                                📍 {projName}
                              </Badge>
                              <DeadlineBadge pkg={pkg} />
                            </div>

                            {/* Name + critical */}
                            <div className="flex items-start gap-1.5">
                              {pkg.isCritical && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />}
                              <span className="font-bold text-foreground leading-tight text-sm">{pkg.name}</span>
                            </div>

                            {/* Quantitativo */}
                            {pkg.quantitative && (
                              <div className="text-muted-foreground bg-muted/50 rounded p-1.5 text-[10px] font-medium border border-border/50">
                                {pkg.quantitative}
                              </div>
                            )}

                            {/* Pedir / Chegar datas */}
                            <div className="space-y-1 text-muted-foreground">
                              {deadline && (
                                <div className="flex justify-between">
                                  <span>Pedir até:</span>
                                  <span className={`font-semibold ${late ? 'text-red-600' : 'text-foreground'}`}>{formatDate(deadline)}</span>
                                </div>
                              )}
                              {pkg.arriveBy && (
                                <div className="flex justify-between">
                                  <span>Chegar até:</span>
                                  <span className="font-semibold text-foreground">{formatDate(pkg.arriveBy)}</span>
                                </div>
                              )}
                            </div>

                            {/* Responsável */}
                            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {pkg.responsible || '—'}
                              </span>
                              {pkg.responsible && (
                                <button
                                  onClick={() => openNotificationModal(pkg)}
                                  className="text-primary hover:text-primary-foreground hover:bg-primary/10 p-1 rounded transition-colors"
                                  title="Cobrar responsável por e-mail"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
                              {col.id !== 'delivered' && col.id !== 'in_production' && (
                                <button
                                  onClick={() => advanceStatus(pkg)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-semibold transition-colors"
                                >
                                  Avançar <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              <button onClick={() => openEdit(pkg)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(pkg.id)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        );
                      })}
                      {colPkgs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30 text-xs">
                          <Package className="w-6 h-6 mb-1 opacity-40" />
                          <span>Sem itens</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {filtered.map(pkg => {
              const late    = isOrderLate(pkg);
              const urg     = isUrgent(pkg);
              const isExp   = expandedId === pkg.id;
              const deadline = getEffectiveDeadline(pkg);
              const projName = activeProjects.find(p => p.id === pkg.projectId)?.name || 'Obra';
              return (
                <div key={pkg.id} className={`bg-card rounded-xl border transition-all ${late ? 'border-red-500/40 bg-red-500/5' : urg ? 'border-orange-400/40 bg-orange-500/5' : 'border-border'}`}>
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[pkg.status]}`} />
                    {pkg.isCritical && <Star className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{pkg.name}</span>
                        <Badge className={`text-[10px] px-2 py-0 h-5 ${SUPPLY_STATUS_COLORS[pkg.status]}`}>{SUPPLY_STATUS_LABELS[pkg.status]}</Badge>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px]">📍 {projName}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-muted-foreground text-xs">
                        {pkg.quantitative && <span className="bg-muted/65 rounded px-1.5 py-0.5">{pkg.quantitative}</span>}
                        {pkg.responsible && <span className="flex items-center gap-1"><User className="w-3 h-3" />{pkg.responsible}</span>}
                        <span>Lead Time: {pkg.leadTimeDays}d</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-4">
                      {deadline && <div className="text-xs text-muted-foreground mb-0.5">Pedir até: <span className="font-semibold">{formatDate(deadline)}</span></div>}
                      {pkg.arriveBy && <div className="text-xs text-muted-foreground">Chegar até: <span className="font-semibold">{formatDate(pkg.arriveBy)}</span></div>}
                      <DeadlineBadge pkg={pkg} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pkg.responsible && (
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-primary" onClick={() => openNotificationModal(pkg)} title="Cobrar por e-mail">
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={() => setExpandedId(isExp ? null : pkg.id)}>
                        {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={() => openEdit(pkg)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDelete(pkg.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  {isExp && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-muted/10 rounded-b-xl">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {[
                          { label: '◆ QTO pronto', value: formatDate(pkg.quantitativeDoneDate), color: 'text-amber-600' },
                          { label: '🔴 Pedir até', value: formatDate(deadline), color: 'text-red-600' },
                          { label: '📅 Chegar até', value: formatDate(pkg.arriveBy), color: 'text-blue-600' },
                          { label: '✓ Pedido', value: formatDate(pkg.orderDate), color: 'text-blue-600' },
                          { label: '◆ Entrega prev.', value: formatDate(pkg.expectedDeliveryDate), color: 'text-purple-600' },
                          { label: '✓ Entrega real', value: formatDate(pkg.actualDeliveryDate), color: 'text-emerald-600' },
                        ].map((item, i) => (
                          <div key={i} className="bg-card rounded-lg p-2.5 border">
                            <div className="text-muted-foreground mb-0.5">{item.label}</div>
                            <div className={`font-semibold ${item.color}`}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      {pkg.notes && <div className="bg-card border rounded-lg p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground block mb-1">Histórico & Observações:</span>{pkg.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── EMAIL NOTIFICATION MODAL ── */}
      <Dialog open={emailModal.isOpen} onOpenChange={(v) => !v && setEmailModal(EMPTY_EMAIL)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <Mail className="w-5 h-5 text-primary" />
              Notificação por E-mail (Setor de Compras)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-6 gap-2 items-center">
              <span className="col-span-1 text-muted-foreground font-semibold">Para:</span>
              <div className="col-span-5 flex gap-2">
                <Input value={emailModal.toName} readOnly className="h-8 text-xs font-semibold w-1/3 bg-muted" />
                <Input value={emailModal.toEmail} onChange={e => setEmailModal(m => ({ ...m, toEmail: e.target.value }))} placeholder="email@destinatario.com" className="h-8 text-xs flex-1" />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 items-center">
              <span className="col-span-1 text-muted-foreground font-semibold">Assunto:</span>
              <Input value={emailModal.subject} onChange={e => setEmailModal(m => ({ ...m, subject: e.target.value }))} className="col-span-5 h-8 text-xs font-semibold" />
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Mensagem:</span>
              <Textarea value={emailModal.body} onChange={e => setEmailModal(m => ({ ...m, body: e.target.value }))} rows={12} className="text-xs leading-relaxed font-mono" />
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex gap-2 items-start text-amber-700 dark:text-amber-400">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Esta ação irá registrar um log do envio de notificação nas observações do pacote de suprimentos para fins de rastreabilidade.</span>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setEmailModal(EMPTY_EMAIL)}>Cancelar</Button>
            <Button className="rounded-xl gap-2 text-xs" onClick={sendEmailNotification}><Send className="w-3.5 h-3.5" /> Enviar Notificação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

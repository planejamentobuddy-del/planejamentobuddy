import React, { useState, useEffect } from 'react';
import { Project, getProjectProgress } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DollarSign, Save, PieChart, TrendingUp, Wallet,
  CheckCircle2, Plus, Trash2, CalendarDays, Receipt, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminTabProps {
  project: Project;
}

export default function AdminTab({ project }: AdminTabProps) {
  const { updateProject, getTasksForProject, getReceiptsForProject, addPaymentReceipt, deletePaymentReceipt } = useProjects();
  const tasks = getTasksForProject(project.id);
  const progress = getProjectProgress(tasks);
  const receipts = getReceiptsForProject(project.id);

  // Contract total
  const [total, setTotal] = useState<string>(project.adminCostTotal?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  // New payment form
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setTotal(project.adminCostTotal?.toString() || '');
  }, [project.adminCostTotal]);

  const handleSaveTotal = async () => {
    setIsSaving(true);
    try {
      const numTotal = parseFloat(total.replace(/,/g, '.')) || 0;
      await updateProject({ ...project, adminCostTotal: numTotal });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar valor total.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddReceipt = async () => {
    const amount = parseFloat(newAmount.replace(/,/g, '.'));
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setIsAdding(true);
    try {
      await addPaymentReceipt({
        projectId: project.id,
        amount,
        description: newDescription.trim(),
        receivedAt: newDate,
        createdBy: null,
      });
      setNewAmount('');
      setNewDescription('');
      setNewDate(new Date().toISOString().split('T')[0]);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    await deletePaymentReceipt(id);
  };

  const numTotal = parseFloat(total.replace(/,/g, '.')) || 0;
  const numReceived = receipts.reduce((s, r) => s + r.amount, 0);

  // Cálculos Financeiros
  const proportionalValue = numTotal * (progress / 100);
  const balanceTotal = Math.max(0, numTotal - numReceived);
  const balanceToBill = proportionalValue - numReceived;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Avanço Físico</p>
              <h3 className="text-2xl font-bold font-display">{progress}%</h3>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-3">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium whitespace-nowrap">Valor Contratual</p>
              <h3 className="text-xl font-bold font-display">{formatCurrency(numTotal)}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Valor global da administração.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Previsto pelo Avanço</p>
              <h3 className="text-xl font-bold font-display">{formatCurrency(proportionalValue)}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Valor proporcional aos {progress}% executados.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Já Recebido</p>
              <h3 className="text-xl font-bold font-display">{formatCurrency(numReceived)}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{receipts.length} lançamento(s) no histórico</p>
          {numReceived >= numTotal && numTotal > 0 && (
            <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-white rounded-bl-xl text-[10px] font-bold">
              QUITADO
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm border-orange-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-orange-600/80 dark:text-orange-400 font-medium tracking-tight">Saldo a Faturar</p>
              <h3 className={`text-xl font-bold font-display ${balanceToBill > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {balanceToBill > 0 ? formatCurrency(balanceToBill) : 'Nenhum atraso'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Diferença entre o que ocorreu de obra e o que foi pago.
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Configuração do Contrato */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="border-b px-6 py-4 flex items-center gap-2 bg-muted/30">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Configuração do Contrato</h3>
          </div>
          <div className="p-6 space-y-5">

            {/* Valor Total */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Valor Total da Administração</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="pl-9 text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Valor global fechado para a administração desta obra.
              </p>
            </div>

            <div className="pt-1 flex justify-between items-center border-t">
              <div className="text-sm text-muted-foreground">
                Saldo final: <span className={`font-bold ${balanceTotal > 0 ? 'text-foreground' : 'text-emerald-600'}`}>{formatCurrency(balanceTotal)}</span>
              </div>
              <Button onClick={handleSaveTotal} disabled={isSaving} size="sm" className="gap-2">
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>

          </div>
        </div>

        {/* Lançar Pagamento */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="border-b px-6 py-4 flex items-center gap-2 bg-muted/30">
            <Receipt className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Registrar Recebimento</h3>
          </div>
          <div className="p-6 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="pl-9"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Data de Recebimento</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Descrição (opcional)</label>
              <Input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ex: Medição nº 3, Parcela contratual..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddReceipt()}
              />
            </div>

            <Button
              onClick={handleAddReceipt}
              disabled={isAdding || !newAmount}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? 'Registrando...' : 'Registrar Pagamento'}
            </Button>

          </div>
        </div>

      </div>

      {/* Histórico de Recebimentos */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Histórico de Recebimentos</h3>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{receipts.length} lançamento(s)</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(numReceived)}</span>
          </div>
        </div>

        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold text-muted-foreground">Nenhum pagamento registrado</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Use o formulário acima para registrar recebimentos.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {receipts
                .slice()
                .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
                .map((receipt, i) => (
                  <motion.div
                    key={receipt.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {receipt.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDate(receipt.receivedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-display">
                        {formatCurrency(receipt.amount)}
                      </span>
                      <button
                        onClick={() => handleDeleteReceipt(receipt.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        title="Remover lançamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>

            {/* Totalizador */}
            <div className="flex items-center justify-between px-6 py-4 bg-muted/30">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Acumulado Recebido</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                {formatCurrency(numReceived)}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

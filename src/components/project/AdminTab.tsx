import React, { useState, useEffect } from 'react';
import { Project, getProjectProgress } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Save, PieChart, TrendingUp, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminTabProps {
  project: Project;
}

export default function AdminTab({ project }: AdminTabProps) {
  const { updateProject, getTasksForProject } = useProjects();
  const tasks = getTasksForProject(project.id);
  const progress = getProjectProgress(tasks);

  const [total, setTotal] = useState<string>(project.adminCostTotal?.toString() || '');
  const [received, setReceived] = useState<string>(project.adminCostReceived?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTotal(project.adminCostTotal?.toString() || '');
    setReceived(project.adminCostReceived?.toString() || '');
  }, [project.adminCostTotal, project.adminCostReceived]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const numTotal = parseFloat(total.replace(/,/g, '.')) || 0;
      const numReceived = parseFloat(received.replace(/,/g, '.')) || 0;

      const updated = {
        ...project,
        adminCostTotal: numTotal,
        adminCostReceived: numReceived,
      };

      await updateProject(updated);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar custos da administração.');
    } finally {
      setIsSaving(false);
    }
  };

  const numTotal = parseFloat(total.replace(/,/g, '.')) || 0;
  const numReceived = parseFloat(received.replace(/,/g, '.')) || 0;

  // Cálculos Financeiros
  const proportionalValue = numTotal * (progress / 100);
  const balanceTotal = Math.max(0, numTotal - numReceived);
  const balanceToBill = proportionalValue - numReceived;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
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
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
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
            Valor proporcional do contrato de construtora aos {progress}% executados.
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
              <p className="text-sm text-orange-600/80 dark:text-orange-400 font-medium tracking-tight">Saldo a Faturar (Devido)</p>
              <h3 className={`text-xl font-bold font-display ${balanceToBill > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {balanceToBill > 0 ? formatCurrency(balanceToBill) : 'Nenhum atraso'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Diferença entre o que já ocorreu de obra e o que já foi pago.
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Settings Form */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="border-b px-6 py-4 flex items-center gap-2 bg-muted/30">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Configuração do Contrato</h3>
          </div>
          <div className="p-6 space-y-4">
            
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
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                Lançamento do valor global fechado para a administração desta obra.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Valor Acumulado Já Recebido</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  className="pl-9 text-lg"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2 shrink-0">
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar Financeiro'}
              </Button>
            </div>

          </div>
        </div>

        {/* Resumo e Insight */}
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
               <Wallet className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-display font-semibold">Saldo Final do Contrato</h3>
            <p className="text-muted-foreground text-sm max-w-[300px]">
              O saldo total restante para a quitação plena do contrato de administração desta obra até o final.
            </p>
            <div className="text-4xl font-black text-foreground pt-4 font-display">
              {formatCurrency(balanceTotal)}
            </div>
        </div>

      </div>

    </div>
  );
}

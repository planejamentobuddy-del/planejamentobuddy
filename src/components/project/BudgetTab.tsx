import React, { useState, useEffect } from 'react';
import { Project } from '@/types/project';
import { useBudget } from '@/hooks/useBudget';
import { BudgetSpreadsheet } from '@/components/orcamento/BudgetSpreadsheet';
import { CurvaABCView } from '@/components/orcamento/CurvaABCView';
import { CronogramaDesembolsoView } from '@/components/orcamento/CronogramaDesembolsoView';
import { BdiCalculatorModal } from '@/components/orcamento/BdiCalculatorModal';
import { SinapiSearchModal } from '@/components/orcamento/SinapiSearchModal';
import { ProjectConfigModal } from '@/components/orcamento/ProjectConfigModal';
import { exportBudgetToExcel } from '@/utils/exportExcel';
import { exportBudgetToPdf } from '@/utils/exportPdf';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Sliders,
  PieChart,
  CalendarDays,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

interface BudgetTabProps {
  project: Project;
}

export default function BudgetTab({ project }: BudgetTabProps) {
  const {
    activeProject,
    setActiveProjectId,
    getOrCreateBudgetForProject,
    viewMode,
    setViewMode,
    bdiRate,
    directCostTotal,
    sellingPriceTotal,
    costPerSquareMeter,
    sellingPerSquareMeter,
    materialCostTotal,
    laborCostTotal,
    stageSummaries,
  } = useBudget();

  const [activeTab, setActiveTab] = useState<string>('spreadsheet');
  const [isBdiModalOpen, setIsBdiModalOpen] = useState(false);
  const [isSinapiModalOpen, setIsSinapiModalOpen] = useState(false);
  const [isProjectConfigOpen, setIsProjectConfigOpen] = useState(false);
  const [targetStageIdForAdd, setTargetStageIdForAdd] = useState<string | undefined>();

  useEffect(() => {
    if (project) {
      const budget = getOrCreateBudgetForProject(project.id, project.name);
      if (budget && activeProject?.id !== budget.id) {
        setActiveProjectId(budget.id);
      }
    }
  }, [project.id]);

  const handleOpenAddModal = (stageId?: string) => {
    setTargetStageIdForAdd(stageId || activeProject?.stages[0]?.id);
    setIsSinapiModalOpen(true);
  };

  const handleExportExcel = () => {
    if (!activeProject) return;
    try {
      exportBudgetToExcel(activeProject);
      toast.success('Planilha Excel (.xlsx) exportada com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar planilha Excel');
    }
  };

  const handleExportPdf = () => {
    if (!activeProject) return;
    try {
      exportBudgetToPdf(activeProject);
      toast.success('Proposta Comercial PDF gerada com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar proposta em PDF');
    }
  };

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando orçamento da obra...
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* BARRA SUPERIOR DE AÇÕES RÁPIDAS DO ORÇAMENTO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-muted p-1 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setViewMode('selling')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'selling'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Preço de Venda (+BDI {bdiRate.toFixed(1)}%)
            </button>
            <button
              onClick={() => setViewMode('cost')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'cost'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Custo Direto
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBdiModalOpen(true)}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-accent" />
            Configurar BDI ({bdiRate.toFixed(1)}%)
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="rounded-xl text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            className="rounded-xl text-xs flex items-center gap-1 text-rose-600 dark:text-rose-400 border-rose-500/30"
          >
            <FileText className="w-3.5 h-3.5" />
            Proposta PDF
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenAddModal()}
            className="rounded-xl text-xs flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Serviço
          </Button>
        </div>
      </div>

      {/* CARDS DE RESUMO FINANCEIRO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-card border shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Preço Total da Obra (+BDI)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-display text-primary truncate">
            {formatCurrency(sellingPriceTotal)}
          </div>
          {sellingPerSquareMeter > 0 && (
            <span className="text-[11px] text-muted-foreground block">
              {formatCurrency(sellingPerSquareMeter)} / m²
            </span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-card border shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Custo Direto Total
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-display text-foreground truncate">
            {formatCurrency(directCostTotal)}
          </div>
          {costPerSquareMeter > 0 && (
            <span className="text-[11px] text-muted-foreground block">
              {formatCurrency(costPerSquareMeter)} / m²
            </span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-card border shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Divisão Material / Mão de Obra
          </span>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-muted-foreground">Materiais:</span>
            <strong className="text-foreground">{formatCurrency(materialCostTotal)}</strong>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Mão de Obra:</span>
            <strong className="text-foreground">{formatCurrency(laborCostTotal)}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Composições Cadastradas
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-display text-foreground">
            {activeProject.stages.length} <span className="text-xs font-normal text-muted-foreground">etapas</span>
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Base: {activeProject.dateBase}
          </span>
        </div>
      </div>

      {/* ABAS DO MÓDULO */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="spreadsheet" className="flex items-center gap-2 text-xs sm:text-sm">
            <FileSpreadsheet className="w-4 h-4" />
            Planilha Analítica
          </TabsTrigger>
          <TabsTrigger value="curva-abc" className="flex items-center gap-2 text-xs sm:text-sm">
            <PieChart className="w-4 h-4" />
            Curva ABC
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex items-center gap-2 text-xs sm:text-sm">
            <CalendarDays className="w-4 h-4" />
            Cronograma Desembolso
          </TabsTrigger>
          <TabsTrigger value="resumo" className="flex items-center gap-2 text-xs sm:text-sm hidden sm:flex">
            <Coins className="w-4 h-4" />
            Disciplinas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spreadsheet" className="m-0 focus-visible:ring-0">
          <BudgetSpreadsheet onOpenSinapiModal={handleOpenAddModal} />
        </TabsContent>

        <TabsContent value="curva-abc" className="m-0 focus-visible:ring-0">
          <CurvaABCView />
        </TabsContent>

        <TabsContent value="cronograma" className="m-0 focus-visible:ring-0">
          <CronogramaDesembolsoView />
        </TabsContent>

        <TabsContent value="resumo" className="m-0 focus-visible:ring-0">
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <h3 className="font-bold font-display text-base text-foreground">
              Composição Financeira por Disciplina da Obra
            </h3>
            <div className="space-y-3">
              {stageSummaries.map(stage => {
                const val = viewMode === 'selling' ? stage.sellingPrice : stage.directCost;
                return (
                  <div key={stage.stageId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-foreground">
                        {stage.code} - {stage.title}
                      </span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-muted-foreground">{formatPercent(stage.percentageOfTotal, 1)}</span>
                        <span className="font-bold text-foreground">{formatCurrency(val)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${stage.percentageOfTotal}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL CALCULADORA BDI */}
      <BdiCalculatorModal
        open={isBdiModalOpen}
        onOpenChange={setIsBdiModalOpen}
      />

      {/* MODAL BUSCADOR SINAPI */}
      <SinapiSearchModal
        open={isSinapiModalOpen}
        onOpenChange={setIsSinapiModalOpen}
        defaultStageId={targetStageIdForAdd}
      />

      {/* MODAL CONFIGURAÇÕES DO PROJETO */}
      <ProjectConfigModal
        open={isProjectConfigOpen}
        onOpenChange={setIsProjectConfigOpen}
      />
    </div>
  );
}

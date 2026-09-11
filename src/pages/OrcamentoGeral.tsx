import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Building2,
  FileSpreadsheet,
  FileText,
  Plus,
  Sliders,
  ChevronDown,
  Building,
  MapPin,
  PieChart,
  CalendarDays,
  Coins,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

export default function OrcamentoGeral() {
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    setActiveProjectId,
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
    createProject,
  } = useBudget();

  const [activeTab, setActiveTab] = useState<string>('spreadsheet');
  const [isBdiModalOpen, setIsBdiModalOpen] = useState(false);
  const [isSinapiModalOpen, setIsSinapiModalOpen] = useState(false);
  const [isProjectConfigOpen, setIsProjectConfigOpen] = useState(false);
  const [targetStageIdForAdd, setTargetStageIdForAdd] = useState<string | undefined>();

  // Novo orçamento
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newArea, setNewArea] = useState('250');

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

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createProject({
      title: newTitle.trim(),
      clientName: newClient.trim() || 'Cliente Não Informado',
      location: newLocation.trim() || 'Fortaleza - CE',
      totalArea: parseFloat(newArea) || 0,
    });

    setNewTitle('');
    setNewClient('');
    setNewLocation('');
    setIsNewOpen(false);
  };

  if (!activeProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando orçamentos...</p>
      </div>
    );
  }

  const totalItemsCount = activeProject.stages.reduce((acc, st) => acc + st.items.length, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER INTEGRADO COM PLANEJAMENTO BUDDY */}
      <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-xl hover:bg-muted"
              title="Voltar ao Painel Geral"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <Building2 className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-foreground font-display text-base">
                  BUDDY
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Orçamentos
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">
                Boutique Construtora
              </p>
            </div>

            <div className="h-5 w-px bg-border mx-1 hidden md:block" />

            {/* SELETOR DE ORÇAMENTO */}
            <div className="relative flex items-center">
              <select
                value={activeProject?.id || ''}
                onChange={e => setActiveProjectId(e.target.value)}
                className="appearance-none bg-muted/60 hover:bg-muted font-medium text-xs sm:text-sm pl-3 pr-8 py-1.5 rounded-xl border border-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer max-w-[170px] sm:max-w-[240px] truncate transition-colors"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 pointer-events-none" />

              <button
                onClick={() => setIsProjectConfigOpen(true)}
                className="ml-2 text-xs text-muted-foreground hover:text-primary transition-colors underline hidden lg:inline"
              >
                Editar Obra
              </button>
            </div>
          </div>

          {/* LADO DIREITO: MODO DE VALOR + BOTÕES */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-muted p-1 rounded-xl flex items-center text-xs hidden md:flex">
              <button
                onClick={() => setViewMode('selling')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'selling'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Venda (+BDI {bdiRate.toFixed(1)}%)
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
              className="rounded-xl text-xs hidden sm:flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-accent" />
              BDI: {bdiRate.toFixed(1)}%
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-xl text-xs hidden lg:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              className="rounded-xl text-xs hidden lg:flex items-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-500/30"
            >
              <FileText className="w-3.5 h-3.5" />
              Proposta PDF
            </Button>

            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl text-xs flex items-center gap-1 shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Novo Orçamento</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Orçamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateBudget} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-title">Título do Orçamento *</Label>
                    <Input
                      id="t-title"
                      required
                      placeholder="Ex: Mansão Jeri, Residencial Preá..."
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-client">Cliente</Label>
                    <Input
                      id="t-client"
                      placeholder="Ex: Casana Empreendimentos"
                      value={newClient}
                      onChange={e => setNewClient(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="t-loc">Localização</Label>
                      <Input
                        id="t-loc"
                        placeholder="Ex: Jijoca de Jericoacoara - CE"
                        value={newLocation}
                        onChange={e => setNewLocation(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-area">Área (m²)</Label>
                      <Input
                        id="t-area"
                        type="number"
                        step="0.01"
                        value={newArea}
                        onChange={e => setNewArea(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3">
                    <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Criar Orçamento</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="container mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* CABEÇALHO DO PROJETO SELECIONADO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display text-foreground">
                {activeProject.title}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {activeProject.status === 'draft' && 'Em Elaboração'}
                {activeProject.status === 'sent' && 'Enviado ao Cliente'}
                {activeProject.status === 'approved' && 'Aprovado'}
                {activeProject.status === 'review' && 'Em Revisão'}
                {activeProject.status === 'archived' && 'Arquivado'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-primary" />
                Cliente: <strong className="text-foreground">{activeProject.clientName}</strong>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {activeProject.location}
              </span>
              {activeProject.totalArea ? (
                <span>
                  Área: <strong className="text-foreground">{activeProject.totalArea} m²</strong>
                </span>
              ) : null}
              <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono">
                {activeProject.dateBase}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-start md:self-center">
            <Button
              onClick={() => handleOpenAddModal()}
              className="rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Adicionar Serviço
            </Button>
          </div>
        </div>

        {/* CARDS DE KPIS FINANCEIROS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-card border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Preço de Venda (+BDI {bdiRate.toFixed(1)}%)
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

          <div className="p-4 sm:p-5 rounded-2xl bg-card border shadow-sm space-y-1">
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

          <div className="p-4 sm:p-5 rounded-2xl bg-card border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Material vs Mão de Obra
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

          <div className="p-4 sm:p-5 rounded-2xl bg-card border shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Composições Cadastradas
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-display text-foreground">
              {activeProject.stages.length} <span className="text-xs font-normal text-muted-foreground">etapas</span>
            </div>
            <span className="text-[11px] text-muted-foreground block">
              {totalItemsCount} serviços na planilha
            </span>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <TabsList className="h-10">
              <TabsTrigger value="spreadsheet" className="flex items-center gap-2 text-xs sm:text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                Planilha Orçamentária
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="rounded-xl h-8 text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="rounded-xl h-8 text-xs flex items-center gap-1 text-rose-600 dark:text-rose-400"
              >
                <FileText className="w-3.5 h-3.5" />
                Proposta PDF
              </Button>
            </div>
          </div>

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
      </main>

      {/* MODAIS AUXILIARES */}
      <BdiCalculatorModal
        open={isBdiModalOpen}
        onOpenChange={setIsBdiModalOpen}
      />

      <SinapiSearchModal
        open={isSinapiModalOpen}
        onOpenChange={setIsSinapiModalOpen}
        defaultStageId={targetStageIdForAdd}
      />

      <ProjectConfigModal
        open={isProjectConfigOpen}
        onOpenChange={setIsProjectConfigOpen}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { BudgetItem, BudgetSubstage, BudgetStage } from '@/types/budget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Trash2,
  Layers,
  ChevronDown,
  ChevronRight,
  Search,
  FolderPlus,
  Check,
  X,
  Edit2,
  FolderTree,
  Sliders,
} from 'lucide-react';
import { CompositionDetailModal } from './CompositionDetailModal';
import { AreaBreakdownTable } from './AreaBreakdownTable';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number, dec: number = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

interface BudgetSpreadsheetProps {
  onOpenSinapiModal: (stageId: string, substageId?: string) => void;
}

export function BudgetSpreadsheet({ onOpenSinapiModal }: BudgetSpreadsheetProps) {
  const {
    activeProject,
    viewMode,
    bdiRate,
    stageSummaries,
    addStage,
    deleteStage,
    addSubstage,
    deleteSubstage,
    updateItem,
    deleteItem,
  } = useBudget();

  // Expansão de Etapas (Nível 1)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    activeProject?.stages.forEach((s) => (init[s.id] = true));
    return init;
  });

  // Expansão de Subetapas (Nível 2)
  const [expandedSubstages, setExpandedSubstages] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    activeProject?.stages.forEach((s) => {
      s.substages?.forEach((sub) => {
        init[sub.id] = true;
      });
    });
    return init;
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCompositionItem, setSelectedCompositionItem] = useState<BudgetItem | null>(null);
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);

  // Criação de Nova Etapa (Nível 1)
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');

  // Criação de Nova Subetapa (Nível 2)
  const [addingSubstageForStageId, setAddingSubstageForStageId] = useState<string | null>(null);
  const [newSubstageTitle, setNewSubstageTitle] = useState('');

  // Edição inline de Quantidade
  const [editingQtyItemId, setEditingQtyItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');

  // Edição inline de BDI por item
  const [editingBdiItemId, setEditingBdiItemId] = useState<string | null>(null);
  const [editBdi, setEditBdi] = useState<string>('');

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const toggleSubstage = (substageId: string) => {
    setExpandedSubstages((prev) => ({ ...prev, [substageId]: !prev[substageId] }));
  };

  const handleStartEditQty = (item: BudgetItem) => {
    setEditingQtyItemId(item.id);
    setEditQty(item.quantity.toString());
  };

  const handleSaveQty = (item: BudgetItem) => {
    const parsed = parseFloat(editQty.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      updateItem(item.id, { quantity: parsed });
    }
    setEditingQtyItemId(null);
  };

  const handleStartEditBdi = (item: BudgetItem) => {
    setEditingBdiItemId(item.id);
    const currentBdi = item.bdi !== undefined ? item.bdi : bdiRate;
    setEditBdi(currentBdi.toString());
  };

  const handleSaveBdi = (item: BudgetItem) => {
    const parsed = parseFloat(editBdi.replace(',', '.'));
    if (!isNaN(parsed)) {
      updateItem(item.id, { bdi: parsed });
    }
    setEditingBdiItemId(null);
  };

  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageTitle.trim()) return;
    addStage(newStageTitle.trim());
    setNewStageTitle('');
    setIsAddingStage(false);
  };

  const handleCreateSubstage = (stageId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubstageTitle.trim()) return;
    addSubstage(stageId, newSubstageTitle.trim());
    setNewSubstageTitle('');
    setAddingSubstageForStageId(null);
  };

  if (!activeProject) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Nenhum orçamento selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR DE PESQUISA E AÇÕES */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Filtrar serviços por nome, código..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isAddingStage ? (
            <form onSubmit={handleCreateStage} className="flex items-center gap-2">
              <Input
                placeholder="Nome da Nova Etapa (ex: Alvenaria)..."
                value={newStageTitle}
                onChange={(e) => setNewStageTitle(e.target.value)}
                className="h-9 text-xs rounded-xl w-56 sm:w-64"
                autoFocus
              />
              <Button type="submit" size="sm" className="h-9 rounded-xl text-xs">
                Salvar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingStage(false)}
                className="h-9 rounded-xl text-xs"
              >
                Cancelar
              </Button>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingStage(true)}
              className="h-9 rounded-xl text-xs flex items-center gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/5"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              + Nova Etapa
            </Button>
          )}
        </div>
      </div>

      {/* LISTA HIERÁRQUICA: ETAPAS -> SUBETAPAS -> ITENS */}
      <div className="space-y-4">
        {activeProject.stages.map((stage) => {
          const summary = stageSummaries.find((s) => s.stageId === stage.id);
          const isStageExpanded = expandedStages[stage.id] !== false;

          // Contagem total de itens na etapa
          const allStageItems = stage.substages?.flatMap((s) => s.items || []) || stage.items || [];

          // Filtro de pesquisa
          const q = searchFilter.toLowerCase();
          const hasMatchingItems =
            !q ||
            stage.title.toLowerCase().includes(q) ||
            stage.code.toLowerCase().includes(q) ||
            allStageItems.some(
              (it) =>
                it.description.toLowerCase().includes(q) ||
                it.code.toLowerCase().includes(q) ||
                (it.sinapiCode && it.sinapiCode.includes(q))
            );

          if (!hasMatchingItems) return null;

          const stageTotal = viewMode === 'selling' ? summary?.sellingPrice || 0 : summary?.directCost || 0;

          return (
            <div
              key={stage.id}
              className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all"
            >
              {/* NÍVEL 1: HEADER DA ETAPA (Número 1, 2, 3...) */}
              <div
                onClick={() => toggleStage(stage.id)}
                className="p-3.5 sm:p-4 bg-muted/40 hover:bg-muted/70 transition-colors flex items-center justify-between cursor-pointer select-none border-b"
              >
                <div className="flex items-center gap-3">
                  <button className="text-muted-foreground p-1 hover:text-foreground">
                    {isStageExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <span className="font-mono font-black text-xs bg-primary text-white px-2 py-0.5 rounded-lg shadow-sm">
                    {stage.code}
                  </span>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold font-display text-foreground leading-tight">
                      {stage.title}
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {stage.substages?.length || 0} subetapas • {allStageItems.length} serviços
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                      Subtotal {viewMode === 'selling' ? 'c/ BDI' : 'Direto'}
                    </span>
                    <span className="text-sm sm:text-base font-black font-display text-foreground">
                      {formatCurrency(stageTotal)}
                    </span>
                  </div>
                  {summary && summary.percentageOfTotal > 0 && (
                    <span className="text-[10px] bg-secondary text-secondary-foreground font-semibold px-2 py-0.5 rounded-full hidden md:inline-flex">
                      {formatPercent(summary.percentageOfTotal, 1)}
                    </span>
                  )}
                </div>
              </div>

              {/* CORPO DA ETAPA: SUBETAPAS */}
              {isStageExpanded && (
                <div className="p-3 sm:p-4 space-y-3 bg-muted/10">
                  {/* Lista de Subetapas (Nível 2) */}
                  {(stage.substages || []).map((substage) => {
                    const isSubExpanded = expandedSubstages[substage.id] !== false;

                    const filteredSubItems = (substage.items || []).filter((it) => {
                      return (
                        !q ||
                        it.description.toLowerCase().includes(q) ||
                        it.code.toLowerCase().includes(q) ||
                        (it.sinapiCode && it.sinapiCode.includes(q))
                      );
                    });

                    // Subtotal da subetapa
                    let subTotal = 0;
                    (substage.items || []).forEach((it) => {
                      const itemEffectiveBdi = it.bdi !== undefined ? it.bdi : bdiRate;
                      const mult = viewMode === 'selling' ? 1 + itemEffectiveBdi / 100 : 1;
                      subTotal += (it.unitCostTotal || 0) * mult * (it.quantity || 0);
                    });

                    return (
                      <div
                        key={substage.id}
                        className="rounded-xl border bg-card/80 shadow-xs overflow-hidden"
                      >
                        {/* HEADER DA SUBETAPA (1.1, 1.2...) */}
                        <div
                          onClick={() => toggleSubstage(substage.id)}
                          className="px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer select-none border-b text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <button className="text-muted-foreground p-0.5 hover:text-foreground">
                              {isSubExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="font-mono font-bold text-[11px] bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded border border-sky-500/30">
                              {substage.code}
                            </span>
                            <span className="font-bold text-foreground">
                              {substage.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({substage.items?.length || 0} itens)
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold font-mono text-foreground">
                              {formatCurrency(subTotal)}
                            </span>
                          </div>
                        </div>

                        {/* TABELA DE ITENS (NÍVEL 3: 1.1.1, 1.1.2...) */}
                        {isSubExpanded && (
                          <div className="divide-y divide-border/60">
                            {/* Cabeçalho da tabela de itens com coluna de BDI */}
                            <div className="grid grid-cols-12 bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:grid">
                              <span className="col-span-1">Item</span>
                              <span className="col-span-4">Descrição do Serviço</span>
                              <span className="col-span-1 text-center">Unid</span>
                              <span className="col-span-1 text-right">Qtd</span>
                              <span className="col-span-1 text-right">Custo Unit.</span>
                              <span className="col-span-1 text-right">BDI (%)</span>
                              <span className="col-span-1 text-right">Unit. c/ BDI</span>
                              <span className="col-span-1 text-right">Total</span>
                              <span className="col-span-1 text-right">Ações</span>
                            </div>

                            {filteredSubItems.length === 0 ? (
                              <div className="p-5 text-center text-xs text-muted-foreground">
                                Nenhum item cadastrado nesta subetapa.{' '}
                                <button
                                  type="button"
                                  onClick={() => onOpenSinapiModal(stage.id, substage.id)}
                                  className="text-primary underline font-medium ml-1"
                                >
                                  Adicionar item a {substage.code} agora
                                </button>
                              </div>
                            ) : (
                              filteredSubItems.map((item) => {
                                const itemEffectiveBdi =
                                  item.bdi !== undefined ? item.bdi : bdiRate;
                                const unitCost = item.unitCostTotal || 0;
                                const unitSelling = unitCost * (1 + itemEffectiveBdi / 100);
                                const itemTotal =
                                  (viewMode === 'selling' ? unitSelling : unitCost) *
                                  (item.quantity || 0);

                                return (
                                  <div
                                    key={item.id}
                                    className="p-3 sm:px-3 sm:py-2.5 hover:bg-muted/30 transition-colors flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center gap-2 text-xs"
                                  >
                                    {/* Item Code (1.1.1) */}
                                    <div className="lg:col-span-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                                      <span className="font-bold text-foreground">
                                        {item.code}
                                      </span>
                                      <span className="text-[8px] px-1 py-0 rounded font-semibold border bg-primary/10 text-primary border-primary/20">
                                        {item.source === 'sinapi'
                                          ? 'SINAPI'
                                          : item.source === 'catalogo'
                                          ? 'CAT'
                                          : 'PROP'}
                                      </span>
                                    </div>

                                    {/* Descrição do Serviço */}
                                    <div className="lg:col-span-4 pr-2">
                                      <p className="font-medium text-foreground text-xs leading-snug">
                                        {item.description}
                                      </p>
                                      {item.composition && item.composition.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedCompositionItem(item);
                                            setIsCompModalOpen(true);
                                          }}
                                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5 font-medium"
                                        >
                                          <Layers className="w-3 h-3" /> Ver Composição CPU (
                                          {item.composition.length} insumos)
                                        </button>
                                      )}
                                    </div>

                                    {/* Unidade */}
                                    <div className="lg:col-span-1 text-left lg:text-center text-muted-foreground font-mono">
                                      <span className="lg:hidden text-[10px] text-muted-foreground mr-1">
                                        Un:
                                      </span>
                                      {item.unit}
                                    </div>

                                    {/* Quantidade (Editável Inline) */}
                                    <div className="lg:col-span-1 text-left lg:text-right font-medium">
                                      {editingQtyItemId === item.id ? (
                                        <div className="flex items-center gap-1 justify-end">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={editQty}
                                            onChange={(e) => setEditQty(e.target.value)}
                                            className="h-7 w-16 text-xs text-right p-1 font-mono"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveQty(item);
                                              if (e.key === 'Escape') setEditingQtyItemId(null);
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveQty(item)}
                                            className="text-emerald-600 hover:text-emerald-700"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingQtyItemId(null)}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditQty(item)}
                                          className="font-mono hover:text-primary hover:underline cursor-pointer"
                                          title="Clique para editar a quantidade"
                                        >
                                          {formatNumber(item.quantity, 2)}
                                        </button>
                                      )}
                                    </div>

                                    {/* Custo Unitário Direto */}
                                    <div className="lg:col-span-1 text-left lg:text-right text-muted-foreground font-mono">
                                      <span className="lg:hidden text-[10px] text-muted-foreground mr-1">
                                        Custo:
                                      </span>
                                      {formatCurrency(unitCost)}
                                    </div>

                                    {/* COLUNA DE BDI DO ITEM (EDITÁVEL INLINE!) */}
                                    <div className="lg:col-span-1 text-left lg:text-right">
                                      {editingBdiItemId === item.id ? (
                                        <div className="flex items-center gap-1 justify-end">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            value={editBdi}
                                            onChange={(e) => setEditBdi(e.target.value)}
                                            className="h-7 w-16 text-xs text-right p-1 font-mono"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveBdi(item);
                                              if (e.key === 'Escape') setEditingBdiItemId(null);
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveBdi(item)}
                                            className="text-emerald-600 hover:text-emerald-700"
                                          >
                                            <Check className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditBdi(item)}
                                          className={`inline-flex items-center gap-0.5 font-mono px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                                            item.bdi !== undefined
                                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                              : 'text-muted-foreground hover:bg-muted'
                                          }`}
                                          title="Clique para editar o BDI deste item"
                                        >
                                          <span>{formatPercent(itemEffectiveBdi, 1)}</span>
                                          <Edit2 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Unitário com BDI */}
                                    <div className="lg:col-span-1 text-left lg:text-right text-foreground font-mono font-medium">
                                      <span className="lg:hidden text-[10px] text-muted-foreground mr-1">
                                        c/ BDI:
                                      </span>
                                      {formatCurrency(unitSelling)}
                                    </div>

                                    {/* Total */}
                                    <div className="lg:col-span-1 text-left lg:text-right font-bold text-foreground font-mono">
                                      <span className="lg:hidden text-[10px] text-muted-foreground mr-1">
                                        Total:
                                      </span>
                                      {formatCurrency(itemTotal)}
                                    </div>

                                    {/* Ações */}
                                    <div className="lg:col-span-1 flex items-center justify-end gap-1 w-full lg:w-auto pt-1 lg:pt-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setSelectedCompositionItem(item);
                                          setIsCompModalOpen(true);
                                        }}
                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                        title="Ver Composição Detalhada"
                                      >
                                        <Layers className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteItem(item.id)}
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        title="Remover Item"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* Barra de Ações da Subetapa */}
                            <div className="p-2 bg-muted/20 flex justify-between items-center text-xs">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenSinapiModal(stage.id, substage.id)}
                                className="h-7 rounded-lg text-xs text-primary font-bold hover:bg-primary/10 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Adicionar Item a {substage.code}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSubstage(stage.id, substage.id)}
                                className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-destructive"
                              >
                                Excluir Subetapa {substage.code}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* FORMULÁRIO DE NOVA SUBETAPA / BOTÃO DE ADICIONAR SUBETAPA */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    {addingSubstageForStageId === stage.id ? (
                      <form
                        onSubmit={(e) => handleCreateSubstage(stage.id, e)}
                        className="flex items-center gap-2"
                      >
                        <Input
                          autoFocus
                          placeholder={`Nome da Subetapa (ex: ${stage.code}.${(stage.substages?.length || 0) + 1} Tapume)...`}
                          value={newSubstageTitle}
                          onChange={(e) => setNewSubstageTitle(e.target.value)}
                          className="h-8 text-xs w-60 rounded-xl"
                        />
                        <Button type="submit" size="sm" className="h-8 px-3 text-xs rounded-xl">
                          Salvar Subetapa
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingSubstageForStageId(null)}
                          className="h-8 text-xs rounded-xl"
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingSubstageForStageId(stage.id)}
                        className="h-8 rounded-xl text-xs text-primary font-semibold flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Adicionar Subetapa a {stage.code}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteStage(stage.id)}
                      className="h-8 rounded-xl text-xs text-muted-foreground hover:text-destructive"
                    >
                      Excluir Etapa {stage.code}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SEÇÃO NO FINAL DO ORÇAMENTO: TABELA POR ETAPA E ÁREA DE OBRA + GRÁFICO DONUT (IMAGENS 3 E 4) */}
      <AreaBreakdownTable />

      <CompositionDetailModal
        item={selectedCompositionItem}
        open={isCompModalOpen}
        onOpenChange={setIsCompModalOpen}
      />
    </div>
  );
}

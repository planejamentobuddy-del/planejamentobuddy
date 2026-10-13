import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  Sparkles,
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

/**
 * Célula de edição inline do BDI (%) do item
 */
function BdiInputCell({
  item,
  globalBdi,
  onUpdateBdi,
}: {
  item: BudgetItem;
  globalBdi: number;
  onUpdateBdi: (itemId: string, newBdi: number | undefined) => void;
}) {
  const isCustom = item.bdi !== undefined && item.bdi !== null;
  const effectiveVal = isCustom ? Number(item.bdi) : globalBdi;
  const [val, setVal] = useState<string>(effectiveVal.toString());

  useEffect(() => {
    setVal(effectiveVal.toString());
  }, [item.bdi, globalBdi, effectiveVal]);

  const handleCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      // Reverter para BDI global
      onUpdateBdi(item.id, undefined);
      setVal(globalBdi.toString());
      return;
    }

    const parsed = parseFloat(trimmed.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateBdi(item.id, parsed);
    } else {
      setVal(effectiveVal.toString());
    }
  };

  const handleResetToGlobal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateBdi(item.id, undefined);
    setVal(globalBdi.toString());
  };

  return (
    <div className="flex items-center justify-end gap-1 group/bdi">
      <div className="relative flex items-center">
        <input
          type="number"
          step="0.1"
          min="0"
          max="300"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => handleCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommit(e.currentTarget.value);
              e.currentTarget.blur();
            }
          }}
          className={`h-7 w-16 text-right text-xs font-mono font-bold px-1.5 py-0.5 rounded border transition-all ${
            isCustom
              ? 'border-amber-500/80 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
              : 'border-border/70 bg-background text-foreground hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary'
          }`}
          title={
            isCustom
              ? `BDI individual de ${val}%. Padrão da obra é ${globalBdi.toFixed(1)}%.`
              : `Usando BDI padrão da obra (${globalBdi.toFixed(1)}%). Digite para personalizar.`
          }
        />
        <span className="text-[11px] font-mono font-bold text-muted-foreground ml-1 select-none">
          %
        </span>
      </div>

      {isCustom && (
        <button
          type="button"
          onClick={handleResetToGlobal}
          className="opacity-0 group-hover/bdi:opacity-100 transition-opacity text-muted-foreground hover:text-amber-600 p-0.5"
          title={`Redefinir para o BDI geral da obra (${globalBdi.toFixed(1)}%)`}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Célula de edição inline da Quantidade do item
 */
function QuantityInputCell({
  item,
  onUpdateQty,
}: {
  item: BudgetItem;
  onUpdateQty: (itemId: string, newQty: number) => void;
}) {
  const [val, setVal] = useState<string>(String(item.quantity || 0));

  useEffect(() => {
    setVal(String(item.quantity || 0));
  }, [item.quantity]);

  const handleCommit = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateQty(item.id, parsed);
    } else {
      setVal(String(item.quantity || 0));
    }
  };

  return (
    <div className="flex items-center justify-end">
      <input
        type="number"
        step="0.01"
        min="0"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={(e) => handleCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleCommit(e.currentTarget.value);
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-16 text-right text-xs font-mono font-semibold px-1.5 py-0.5 rounded border border-border/70 bg-background text-foreground hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary"
        title="Quantidade do serviço"
      />
    </div>
  );
}

/**
 * Campo de edição inline de Observação do Item (ex: Bloco A e B, etc)
 */
function ItemNotesInput({
  item,
  onUpdateNotes,
}: {
  item: BudgetItem;
  onUpdateNotes: (itemId: string, notes: string) => void;
}) {
  const [val, setVal] = useState(item.notes || '');

  useEffect(() => {
    setVal(item.notes || '');
  }, [item.notes]);

  const handleBlur = () => {
    if (val !== (item.notes || '')) {
      onUpdateNotes(item.id, val.trim());
    }
  };

  return (
    <div className="mt-1.5 w-full">
      <input
        type="text"
        placeholder="Adicionar observação sobre o item..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleBlur();
            e.currentTarget.blur();
          }
        }}
        className={`w-full h-6 text-[11px] px-2 py-0.5 rounded border transition-colors ${
          val
            ? 'border-border/80 bg-background text-foreground font-medium shadow-2xs'
            : 'border-dashed border-border/60 bg-muted/20 text-muted-foreground/70 hover:border-border hover:bg-background'
        } focus:border-primary focus:bg-background focus:text-foreground focus:ring-1 focus:ring-primary focus:outline-none`}
        title="Observação técnica ou especificação deste serviço (ex: BLOCOS A e B)"
      />
    </div>
  );
}

/**
 * Linha de Item Orçamentário com a coluna de BDI (%) individual e campo de Observação
 */
function BudgetItemRow({
  item,
  viewMode,
  globalBdi,
  onOpenComposition,
  onDelete,
  onUpdateBdi,
  onUpdateQty,
  onUpdateNotes,
}: {
  item: BudgetItem;
  viewMode: 'cost' | 'selling';
  globalBdi: number;
  onOpenComposition: (item: BudgetItem) => void;
  onDelete: (itemId: string) => void;
  onUpdateBdi: (itemId: string, newBdi: number | undefined) => void;
  onUpdateQty: (itemId: string, newQty: number) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
}) {
  const itemEffectiveBdi = item.bdi !== undefined ? Number(item.bdi) : globalBdi;
  const unitCost = item.unitCostTotal || 0;
  const unitSelling = unitCost * (1 + itemEffectiveBdi / 100);
  const itemTotal = (viewMode === 'selling' ? unitSelling : unitCost) * (item.quantity || 0);

  return (
    <div className="p-3 sm:px-3 sm:py-2.5 hover:bg-muted/30 transition-colors flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center gap-2 text-xs">
      {/* 1. Item Code (1.1.1 ou 1.1) */}
      <div className="lg:col-span-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground">{item.code}</span>
        <span className="text-[8px] px-1 py-0 rounded font-semibold border bg-primary/10 text-primary border-primary/20">
          {item.source === 'sinapi'
            ? 'SINAPI'
            : item.source === 'catalogo'
            ? 'CAT'
            : 'PROP'}
        </span>
      </div>

      {/* 2. Descrição do Serviço + Campo de Observação */}
      <div className="lg:col-span-4 pr-2 flex flex-col justify-center">
        <p className="font-medium text-foreground text-xs leading-snug">
          {item.description}
        </p>
        {item.composition && item.composition.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenComposition(item)}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5 font-medium"
          >
            <Layers className="w-3 h-3" /> Ver Composição CPU ({item.composition.length} insumos)
          </button>
        )}

        {/* CAMPO DE OBSERVAÇÃO DO ITEM (CONFORME MOCKUP) */}
        <ItemNotesInput item={item} onUpdateNotes={onUpdateNotes} />
      </div>

      {/* 3. Unidade */}
      <div className="lg:col-span-1 text-left lg:text-center text-muted-foreground font-mono">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Un:</span>
        {item.unit}
      </div>

      {/* 4. Quantidade (Editável Direto no Input) */}
      <div className="lg:col-span-1 text-left lg:text-right font-medium">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Qtd:</span>
        <QuantityInputCell item={item} onUpdateQty={onUpdateQty} />
      </div>

      {/* 5. Custo Unitário Direto */}
      <div className="lg:col-span-1 text-left lg:text-right text-muted-foreground font-mono">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Custo:</span>
        {formatCurrency(unitCost)}
      </div>

      {/* 6. COLUNA DE BDI (%) INDIVIDUAL (EDITÁVEL DIRETAMENTE) */}
      <div className="lg:col-span-1 text-left lg:text-right">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">BDI:</span>
        <BdiInputCell
          item={item}
          globalBdi={globalBdi}
          onUpdateBdi={onUpdateBdi}
        />
      </div>

      {/* 7. Unitário com BDI */}
      <div className="lg:col-span-1 text-left lg:text-right text-foreground font-mono font-medium">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Unit. c/ BDI:</span>
        {formatCurrency(unitSelling)}
      </div>

      {/* 8. Total */}
      <div className="lg:col-span-1 text-left lg:text-right font-bold text-foreground font-mono">
        <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Total:</span>
        {formatCurrency(itemTotal)}
      </div>

      {/* 9. Ações */}
      <div className="lg:col-span-1 flex items-center justify-end gap-1 w-full lg:w-auto pt-1 lg:pt-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenComposition(item)}
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          title="Ver Composição Detalhada"
        >
          <Layers className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Remover Item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Tabela de Itens com Cabeçalho e Coluna de BDI (%) Destacada
 */
function BudgetItemTable({
  items,
  emptyMessage,
  onAddItem,
  addItemLabel,
  viewMode,
  globalBdi,
  onOpenComposition,
  onDelete,
  onUpdateBdi,
  onUpdateQty,
  onUpdateNotes,
}: {
  items: BudgetItem[];
  emptyMessage: string;
  onAddItem: () => void;
  addItemLabel: string;
  viewMode: 'cost' | 'selling';
  globalBdi: number;
  onOpenComposition: (item: BudgetItem) => void;
  onDelete: (itemId: string) => void;
  onUpdateBdi: (itemId: string, newBdi: number | undefined) => void;
  onUpdateQty: (itemId: string, newQty: number) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
}) {
  const safeItems = items || [];

  return (
    <div className="divide-y divide-border/60">
      {/* Cabeçalho da tabela com Coluna de BDI clara e explícita */}
      <div className="grid grid-cols-12 bg-muted/25 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b hidden lg:grid select-none">
        <span className="col-span-1">Item</span>
        <span className="col-span-4">Descrição do Serviço</span>
        <span className="col-span-1 text-center">Unid</span>
        <span className="col-span-1 text-right">Qtd</span>
        <span className="col-span-1 text-right">Custo Unit.</span>
        <span className="col-span-1 text-right text-amber-600 dark:text-amber-400 font-extrabold flex items-center justify-end gap-0.5">
          <span>BDI (%)</span>
        </span>
        <span className="col-span-1 text-right">Unit. c/ BDI</span>
        <span className="col-span-1 text-right">Total</span>
        <span className="col-span-1 text-right">Ações</span>
      </div>

      {safeItems.length === 0 ? (
        <div className="p-5 text-center text-xs text-muted-foreground">
          {emptyMessage}{' '}
          <button
            type="button"
            onClick={onAddItem}
            className="text-primary underline font-medium ml-1 cursor-pointer hover:text-primary/80"
          >
            {addItemLabel}
          </button>
        </div>
      ) : (
        safeItems.map((item) => (
          <BudgetItemRow
            key={item.id}
            item={item}
            viewMode={viewMode}
            globalBdi={globalBdi}
            onOpenComposition={onOpenComposition}
            onDelete={onDelete}
            onUpdateBdi={onUpdateBdi}
            onUpdateQty={onUpdateQty}
            onUpdateNotes={onUpdateNotes}
          />
        ))
      )}
    </div>
  );
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

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const toggleSubstage = (substageId: string) => {
    setExpandedSubstages((prev) => ({ ...prev, [substageId]: !prev[substageId] }));
  };

  const handleUpdateItemBdi = (itemId: string, newBdi: number | undefined) => {
    updateItem(itemId, { bdi: newBdi });
  };

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    updateItem(itemId, { quantity: newQty });
  };

  const handleUpdateItemNotes = (itemId: string, notes: string) => {
    updateItem(itemId, { notes });
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

      {/* LISTA HIERÁRQUICA: ETAPAS -> (SUBETAPAS / ITENS) */}
      <div className="space-y-4">
        {activeProject.stages.map((stage) => {
          const summary = stageSummaries.find((s) => s.stageId === stage.id);
          const isStageExpanded = expandedStages[stage.id] !== false;

          // Contagem total de itens na etapa (subetapas + itens diretos)
          const subItemsAll = stage.substages?.flatMap((s) => s.items || []) || [];
          const directItemsAll = stage.items || [];
          const allStageItems = [...subItemsAll, ...directItemsAll];

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
          const hasSubstages = stage.substages && stage.substages.length > 0;

          // Itens diretos filtrados (para etapas sem subetapas ou com itens diretos)
          const filteredDirectItems = directItemsAll.filter((it) => {
            return (
              !q ||
              it.description.toLowerCase().includes(q) ||
              it.code.toLowerCase().includes(q) ||
              (it.sinapiCode && it.sinapiCode.includes(q))
            );
          });

          return (
            <div
              key={stage.id}
              className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all"
            >
              {/* NÍVEL 1: HEADER DA ETAPA (Número 01, 02...) */}
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
                      {hasSubstages ? `${stage.substages!.length} subetapas • ` : ''}
                      {allStageItems.length} serviços
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

              {/* CORPO DA ETAPA */}
              {isStageExpanded && (
                <div className="p-3 sm:p-4 space-y-3 bg-muted/10">
                  {/* CASO A: ETAPA POSSUI SUBETAPAS (NÍVEL 2) */}
                  {hasSubstages && (
                    <div className="space-y-3">
                      {stage.substages!.map((substage) => {
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
                          const itemEffectiveBdi = it.bdi !== undefined ? Number(it.bdi) : bdiRate;
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

                            {/* TABELA DE ITENS DA SUBETAPA COM COLUNA DE BDI */}
                            {isSubExpanded && (
                              <div>
                                <BudgetItemTable
                                  items={filteredSubItems}
                                  emptyMessage="Nenhum item cadastrado nesta subetapa."
                                  onAddItem={() => onOpenSinapiModal(stage.id, substage.id)}
                                  addItemLabel={`Adicionar item a ${substage.code} agora`}
                                  viewMode={viewMode}
                                  globalBdi={bdiRate}
                                  onOpenComposition={(item) => {
                                    setSelectedCompositionItem(item);
                                    setIsCompModalOpen(true);
                                  }}
                                  onDelete={deleteItem}
                                  onUpdateBdi={handleUpdateItemBdi}
                                  onUpdateQty={handleUpdateItemQty}
                                  onUpdateNotes={handleUpdateItemNotes}
                                />

                                {/* Barra de Ações da Subetapa */}
                                <div className="p-2 bg-muted/20 flex justify-between items-center text-xs border-t">
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
                    </div>
                  )}

                  {/* CASO B: ETAPA SEM SUBETAPAS (OU ITENS DIRETOS DA ETAPA) */}
                  {(!hasSubstages || filteredDirectItems.length > 0) && (
                    <div className="rounded-xl border bg-card/80 shadow-xs overflow-hidden">
                      {hasSubstages && (
                        <div className="px-3 py-1.5 bg-muted/40 border-b text-[11px] font-semibold text-muted-foreground">
                          Itens Diretos da Etapa {stage.code}
                        </div>
                      )}
                      <BudgetItemTable
                        items={filteredDirectItems}
                        emptyMessage="Nenhum item cadastrado nesta etapa."
                        onAddItem={() => onOpenSinapiModal(stage.id)}
                        addItemLabel="Adicionar serviço agora"
                        viewMode={viewMode}
                        globalBdi={bdiRate}
                        onOpenComposition={(item) => {
                          setSelectedCompositionItem(item);
                          setIsCompModalOpen(true);
                        }}
                        onDelete={deleteItem}
                        onUpdateBdi={handleUpdateItemBdi}
                        onUpdateQty={handleUpdateItemQty}
                        onUpdateNotes={handleUpdateItemNotes}
                      />
                    </div>
                  )}

                  {/* BARRA DE AÇÕES DA ETAPA: ADICIONAR ITEM, ADICIONAR SUBETAPA, EXCLUIR */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onOpenSinapiModal(stage.id)}
                        className="h-8 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Adicionar Item a {stage.code}
                      </Button>

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
                          className="h-8 rounded-xl text-xs text-primary font-semibold flex items-center gap-1.5 border-primary/30 hover:bg-primary/5"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          + Adicionar Subetapa a {stage.code}
                        </Button>
                      )}
                    </div>

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

      {/* SEÇÃO NO FINAL DO ORÇAMENTO: TABELA POR ETAPA E ÁREA DE OBRA + GRÁFICO DONUT */}
      <AreaBreakdownTable />

      <CompositionDetailModal
        item={selectedCompositionItem}
        open={isCompModalOpen}
        onOpenChange={setIsCompModalOpen}
      />
    </div>
  );
}

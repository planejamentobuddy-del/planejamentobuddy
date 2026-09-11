import React, { useState } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { BudgetItem } from '@/types/budget';
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
} from 'lucide-react';
import { CompositionDetailModal } from './CompositionDetailModal';

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
  onOpenSinapiModal: (stageId: string) => void;
}

export function BudgetSpreadsheet({ onOpenSinapiModal }: BudgetSpreadsheetProps) {
  const {
    activeProject,
    viewMode,
    bdiRate,
    stageSummaries,
    addStage,
    deleteStage,
    updateItem,
    deleteItem,
  } = useBudget();

  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    activeProject?.stages.forEach(s => (init[s.id] = true));
    return init;
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCompositionItem, setSelectedCompositionItem] = useState<BudgetItem | null>(null);
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);

  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleStartEditQty = (item: BudgetItem) => {
    setEditingItemId(item.id);
    setEditQty(item.quantity.toString());
  };

  const handleSaveQty = (item: BudgetItem) => {
    const parsed = parseFloat(editQty);
    if (!isNaN(parsed) && parsed >= 0) {
      updateItem(item.id, { quantity: parsed });
    }
    setEditingItemId(null);
  };

  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageTitle.trim()) return;
    addStage(newStageTitle.trim());
    setNewStageTitle('');
    setIsAddingStage(false);
  };

  if (!activeProject) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Nenhum orçamento selecionado.
      </div>
    );
  }

  const multiplier = viewMode === 'selling' ? 1 + bdiRate / 100 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Filtrar itens por nome ou código..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isAddingStage ? (
            <form onSubmit={handleCreateStage} className="flex items-center gap-2">
              <Input
                placeholder="Nome da Nova Etapa..."
                value={newStageTitle}
                onChange={e => setNewStageTitle(e.target.value)}
                className="h-9 text-xs rounded-xl w-48 sm:w-60"
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
              className="h-9 rounded-xl text-xs flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              Nova Etapa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {activeProject.stages.map(stage => {
          const summary = stageSummaries.find(s => s.stageId === stage.id);
          const isExpanded = expandedStages[stage.id] !== false;

          const filteredItems = stage.items.filter(it => {
            const q = searchFilter.toLowerCase();
            return (
              !q ||
              it.description.toLowerCase().includes(q) ||
              it.code.toLowerCase().includes(q) ||
              (it.sinapiCode && it.sinapiCode.includes(q))
            );
          });

          if (searchFilter && filteredItems.length === 0) return null;

          const stageTotal = viewMode === 'selling' ? summary?.sellingPrice || 0 : summary?.directCost || 0;

          return (
            <div
              key={stage.id}
              className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all"
            >
              <div
                onClick={() => toggleStage(stage.id)}
                className="p-3.5 sm:p-4 bg-muted/40 hover:bg-muted/70 transition-colors flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <button className="text-muted-foreground p-1 hover:text-foreground">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    {stage.code}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold font-display text-foreground">
                    {stage.title}
                  </h3>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    ({stage.items.length} {stage.items.length === 1 ? 'item' : 'itens'})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                      Subtotal {viewMode === 'selling' ? 'c/ BDI' : 'Direto'}
                    </span>
                    <span className="text-sm sm:text-base font-bold font-display text-foreground">
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

              {isExpanded && (
                <div className="divide-y divide-border/60">
                  <div className="grid grid-cols-12 bg-muted/20 px-4 py-2 text-[11px] font-semibold text-muted-foreground hidden lg:grid">
                    <span className="col-span-1">Item</span>
                    <span className="col-span-5">Descrição do Serviço</span>
                    <span className="col-span-1 text-center">Unid</span>
                    <span className="col-span-1 text-right">Qtd</span>
                    <span className="col-span-2 text-right">Unitário {viewMode === 'selling' && '(c/ BDI)'}</span>
                    <span className="col-span-1 text-right">Total</span>
                    <span className="col-span-1 text-right">Ações</span>
                  </div>

                  {filteredItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Nenhum item cadastrado nesta etapa.{' '}
                      <button
                        onClick={() => onOpenSinapiModal(stage.id)}
                        className="text-primary underline font-medium ml-1"
                      >
                        Adicionar serviço agora
                      </button>
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const unitCost = (item.unitCostTotal || 0) * multiplier;
                      const itemTotal = unitCost * (item.quantity || 0);

                      return (
                        <div
                          key={item.id}
                          className="p-3 sm:px-4 sm:py-3 hover:bg-muted/30 transition-colors flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center gap-2 text-xs"
                        >
                          <div className="lg:col-span-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span>{item.code}</span>
                            <span className="text-[9px] px-1.5 py-0 rounded-full font-semibold border bg-primary/10 text-primary border-primary/20">
                              {item.source === 'sinapi' ? 'SINAPI' : 'PROP'}
                            </span>
                          </div>

                          <div className="lg:col-span-5 pr-2">
                            <p className="font-medium text-foreground text-xs leading-snug">
                              {item.description}
                            </p>
                            {item.composition && item.composition.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedCompositionItem(item);
                                  setIsCompModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                              >
                                <Layers className="w-3 h-3" /> Ver Composição CPU ({item.composition.length} insumos)
                              </button>
                            )}
                          </div>

                          <div className="lg:col-span-1 text-left lg:text-center text-muted-foreground">
                            <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Un:</span>
                            {item.unit}
                          </div>

                          <div className="lg:col-span-1 text-left lg:text-right font-medium">
                            {editingItemId === item.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editQty}
                                  onChange={e => setEditQty(e.target.value)}
                                  className="h-7 w-20 text-xs text-right p-1"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveQty(item);
                                    if (e.key === 'Escape') setEditingItemId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveQty(item)}
                                  className="text-emerald-600 hover:text-emerald-700"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditQty(item)}
                                className="font-mono hover:text-primary hover:underline cursor-pointer"
                                title="Clique para editar a quantidade"
                              >
                                {formatNumber(item.quantity, 2)}
                              </button>
                            )}
                          </div>

                          <div className="lg:col-span-2 text-left lg:text-right text-muted-foreground font-mono">
                            <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Unit:</span>
                            {formatCurrency(unitCost)}
                          </div>

                          <div className="lg:col-span-1 text-left lg:text-right font-bold text-foreground font-display text-sm">
                            <span className="lg:hidden text-[10px] text-muted-foreground mr-1">Total:</span>
                            {formatCurrency(itemTotal)}
                          </div>

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

                  <div className="p-2.5 bg-muted/10 flex justify-between items-center text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenSinapiModal(stage.id)}
                      className="h-8 rounded-xl text-xs text-primary font-medium hover:bg-primary/10 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Item a {stage.code}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteStage(stage.id)}
                      className="h-8 rounded-xl text-xs text-muted-foreground hover:text-destructive"
                    >
                      Excluir Etapa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CompositionDetailModal
        item={selectedCompositionItem}
        open={isCompModalOpen}
        onOpenChange={setIsCompModalOpen}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BudgetItem, CompositionInput } from '@/types/budget';
import { useBudget } from '@/hooks/useBudget';
import { Button } from '@/components/ui/button';
import { Layers, Hammer, Users, Wrench, RefreshCw } from 'lucide-react';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number, dec: number = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
}

function CompositionInputRow({
  comp,
  onUpdateGlobalPrice,
}: {
  comp: CompositionInput;
  onUpdateGlobalPrice: (match: { code?: string; description: string }, newPrice: number) => void;
}) {
  const [priceStr, setPriceStr] = useState<string>(comp.unitCost.toString());

  useEffect(() => {
    setPriceStr(comp.unitCost.toString());
  }, [comp.unitCost]);

  const parsedPrice = parseFloat(priceStr.replace(',', '.'));
  const hasChanged = !isNaN(parsedPrice) && parsedPrice >= 0 && Math.abs(parsedPrice - comp.unitCost) > 0.001;

  const handleApplyGlobal = () => {
    if (!isNaN(parsedPrice) && parsedPrice >= 0) {
      onUpdateGlobalPrice({ code: comp.code, description: comp.description }, parsedPrice);
    } else {
      setPriceStr(comp.unitCost.toString());
    }
  };

  const getIcon = () => {
    if (comp.type === 'labor') return <Users className="w-3.5 h-3.5 text-sky-500" />;
    if (comp.type === 'equipment') return <Wrench className="w-3.5 h-3.5 text-amber-500" />;
    return <Hammer className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div className="grid grid-cols-12 p-2.5 items-center hover:bg-muted/40 transition-colors gap-1">
      <span className="col-span-1 flex items-center" title={comp.type}>
        {getIcon()}
      </span>
      <div className="col-span-5 pr-2">
        <p className="font-medium text-foreground truncate" title={comp.description}>
          {comp.description}
        </p>
        <span className="text-[10px] text-muted-foreground font-mono">
          Cód: {comp.code}
        </span>
      </div>
      <span className="col-span-1 text-center text-muted-foreground">
        {comp.unit}
      </span>
      <span className="col-span-2 text-right font-mono">
        {formatNumber(comp.coefficient, 4)}
      </span>
      <div className="col-span-3 flex items-center justify-end gap-1">
        <span className="text-[10px] text-muted-foreground font-mono">R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hasChanged) {
              handleApplyGlobal();
              e.currentTarget.blur();
            }
          }}
          className="h-7 w-20 text-right text-xs font-mono font-semibold px-1.5 py-0.5 rounded border border-border/70 bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          title="Altere o valor e clique no botão ao lado para atualizar este insumo em todo o orçamento"
        />
        <Button
          type="button"
          size="sm"
          variant={hasChanged ? 'default' : 'outline'}
          disabled={!hasChanged}
          onClick={handleApplyGlobal}
          className="h-7 px-2 text-[10px] font-bold gap-1 shrink-0"
          title={`Atualizar "${comp.description}" para R$ ${priceStr} em todas as ocorrências do orçamento`}
        >
          <RefreshCw className="w-3 h-3" />
          Todos
        </Button>
      </div>
    </div>
  );
}

interface CompositionDetailModalProps {
  item: BudgetItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompositionDetailModal({
  item,
  open,
  onOpenChange,
}: CompositionDetailModalProps) {
  const { activeProject, updateInputPriceGlobally } = useBudget();

  if (!item) return null;

  // Buscar versão em tempo real do item no activeProject para refletir recálculos imediatos
  const liveItem =
    activeProject?.stages
      .flatMap((s) => [...(s.items || []), ...(s.substages?.flatMap((sub) => sub.items || []) || [])])
      .find((i) => i.id === item.id) || item;

  const compositions = liveItem.composition || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Composição Analítica de Custo (CPU)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detalhamento dos insumos e atualização global de preço unitário em todo o orçamento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-muted/40 rounded-2xl border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {liveItem.source === 'sinapi' ? `SINAPI ${liveItem.sinapiCode}` : 'Composição Própria'}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Item {liveItem.code}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{liveItem.description}</p>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
              <span className="text-muted-foreground">Unidade: <strong>{liveItem.unit}</strong></span>
              <span className="text-muted-foreground">
                Custo Unitário Total: <strong className="text-primary font-display text-sm">{formatCurrency(liveItem.unitCostTotal)}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Insumos Integrantes da Composição
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Edite o valor unitário e clique em <strong>Todos</strong> para atualizar em todo o orçamento
              </span>
            </div>

            {compositions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs border rounded-xl bg-muted/20">
                Esta composição foi cadastrada diretamente com valores globais de Material e Mão de Obra.
              </div>
            ) : (
              <div className="border rounded-2xl overflow-hidden divide-y divide-border/60 text-xs">
                <div className="grid grid-cols-12 bg-muted/80 p-2.5 font-semibold text-muted-foreground">
                  <span className="col-span-1">Tipo</span>
                  <span className="col-span-5">Insumo / Descrição</span>
                  <span className="col-span-1 text-center">Unid</span>
                  <span className="col-span-2 text-right">Coeficiente</span>
                  <span className="col-span-3 text-right">Unitário / Atualizar Global</span>
                </div>

                {compositions.map((comp) => (
                  <CompositionInputRow
                    key={comp.id}
                    comp={comp}
                    onUpdateGlobalPrice={updateInputPriceGlobally}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

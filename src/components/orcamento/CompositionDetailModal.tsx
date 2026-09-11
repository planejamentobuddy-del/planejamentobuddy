import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BudgetItem } from '@/types/budget';
import { Badge } from '@/components/ui/badge';
import { Layers, Hammer, Users, Wrench } from 'lucide-react';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number, dec: number = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
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
  if (!item) return null;

  const compositions = item.composition || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                Detalhamento dos insumos, coeficientes de consumo e custos unitários
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-muted/40 rounded-2xl border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {item.source === 'sinapi' ? `SINAPI ${item.sinapiCode}` : 'Composição Própria'}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Item {item.code}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{item.description}</p>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
              <span className="text-muted-foreground">Unidade: <strong>{item.unit}</strong></span>
              <span className="text-muted-foreground">
                Custo Unitário Total: <strong className="text-primary font-display text-sm">{formatCurrency(item.unitCostTotal)}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Insumos Integrantes da Composição
            </h4>

            {compositions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs border rounded-xl bg-muted/20">
                Esta composição foi cadastrada diretamente com valores globais de Material e Mão de Obra.
              </div>
            ) : (
              <div className="border rounded-2xl overflow-hidden divide-y divide-border/60 text-xs">
                <div className="grid grid-cols-12 bg-muted/80 p-2.5 font-semibold text-muted-foreground">
                  <span className="col-span-1">Tipo</span>
                  <span className="col-span-6">Insumo / Descrição</span>
                  <span className="col-span-1 text-center">Unid</span>
                  <span className="col-span-2 text-right">Coeficiente</span>
                  <span className="col-span-2 text-right">Unitário</span>
                </div>

                {compositions.map(comp => {
                  const getIcon = () => {
                    if (comp.type === 'labor') return <Users className="w-3.5 h-3.5 text-sky-500" />;
                    if (comp.type === 'equipment') return <Wrench className="w-3.5 h-3.5 text-amber-500" />;
                    return <Hammer className="w-3.5 h-3.5 text-emerald-500" />;
                  };

                  return (
                    <div
                      key={comp.id}
                      className="grid grid-cols-12 p-2.5 items-center hover:bg-muted/40 transition-colors"
                    >
                      <span className="col-span-1 flex items-center" title={comp.type}>
                        {getIcon()}
                      </span>
                      <div className="col-span-6 pr-2">
                        <p className="font-medium text-foreground truncate">{comp.description}</p>
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
                      <span className="col-span-2 text-right font-semibold text-foreground">
                        {formatCurrency(comp.unitCost)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

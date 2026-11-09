import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useBudget } from '@/hooks/useBudget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Hammer, Users, Wrench } from 'lucide-react';

interface AggregatedInput {
  key: string;
  code: string;
  description: string;
  unit: string;
  type: 'material' | 'labor' | 'equipment';
  unitCost: number;
  occurrences: number;
}

function InputPriceRow({
  item,
  onUpdate,
}: {
  item: AggregatedInput;
  onUpdate: (match: { code?: string; description: string }, newPrice: number) => void;
}) {
  const [val, setVal] = useState<string>(item.unitCost.toString());

  useEffect(() => {
    setVal(item.unitCost.toString());
  }, [item.unitCost]);

  const parsed = parseFloat(val.replace(',', '.'));
  const changed = !isNaN(parsed) && parsed >= 0 && Math.abs(parsed - item.unitCost) > 0.001;

  const handleApply = () => {
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdate({ code: item.code, description: item.description }, parsed);
    } else {
      setVal(item.unitCost.toString());
    }
  };

  const getIcon = () => {
    if (item.type === 'labor') return <Users className="w-3.5 h-3.5 text-sky-500" />;
    if (item.type === 'equipment') return <Wrench className="w-3.5 h-3.5 text-amber-500" />;
    return <Hammer className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div className="grid grid-cols-12 p-2.5 items-center hover:bg-muted/40 transition-colors gap-2 text-xs">
      <div className="col-span-6 flex items-center gap-2 min-w-0">
        <span className="shrink-0">{getIcon()}</span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate" title={item.description}>
            {item.description}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">
            {item.code ? `Cód: ${item.code} • ` : ''}
            Presente em {item.occurrences} serviço(s)
          </span>
        </div>
      </div>

      <span className="col-span-1 text-center text-muted-foreground font-mono">
        {item.unit}
      </span>

      <div className="col-span-5 flex items-center justify-end gap-1.5">
        <span className="text-[11px] text-muted-foreground font-mono">R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && changed) {
              handleApply();
              e.currentTarget.blur();
            }
          }}
          className="h-8 w-24 text-right text-xs font-mono font-bold px-2 py-1 rounded-lg border border-border/80 bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <Button
          type="button"
          size="sm"
          variant={changed ? 'default' : 'outline'}
          disabled={!changed}
          onClick={handleApply}
          className="h-8 px-2.5 text-[11px] font-semibold gap-1 shrink-0 rounded-lg"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar ({item.occurrences})
        </Button>
      </div>
    </div>
  );
}

export function GlobalInputPriceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeProject, updateInputPriceGlobally } = useBudget();
  const [search, setSearch] = useState('');

  const aggregatedInputs = useMemo<AggregatedInput[]>(() => {
    if (!activeProject) return [];
    const map = new Map<string, AggregatedInput>();

    const allBudgetItems = activeProject.stages.flatMap((st) => [
      ...(st.items || []),
      ...(st.substages?.flatMap((sub) => sub.items || []) || []),
    ]);

    allBudgetItems.forEach((bItem) => {
      if (bItem.composition && bItem.composition.length > 0) {
        bItem.composition.forEach((comp) => {
          const normKey = comp.description.trim().toLowerCase() || comp.code.trim().toLowerCase();
          const existing = map.get(normKey);
          if (existing) {
            existing.occurrences += 1;
            existing.unitCost = comp.unitCost;
          } else {
            map.set(normKey, {
              key: normKey,
              code: comp.code,
              description: comp.description,
              unit: comp.unit,
              type: comp.type,
              unitCost: comp.unitCost,
              occurrences: 1,
            });
          }
        });
      } else {
        const normKey = bItem.description.trim().toLowerCase();
        const existing = map.get(normKey);
        const type: 'material' | 'labor' | 'equipment' =
          (bItem.unitCostLabor || 0) > 0 && (bItem.unitCostMaterial || 0) === 0
            ? 'labor'
            : (bItem.unitCostEquipment || 0) > 0 && (bItem.unitCostMaterial || 0) === 0
            ? 'equipment'
            : 'material';
        if (existing) {
          existing.occurrences += 1;
        } else {
          map.set(normKey, {
            key: normKey,
            code: bItem.sinapiCode || bItem.code,
            description: bItem.description,
            unit: bItem.unit,
            type,
            unitCost: bItem.unitCostTotal,
            occurrences: 1,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.description.localeCompare(b.description));
  }, [activeProject]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return aggregatedInputs;
    return aggregatedInputs.filter(
      (i) => i.description.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q))
    );
  }, [aggregatedInputs, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Atualizar Valor de Insumo em Todo o Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs">
                Altere o valor unitário de qualquer insumo (ex: Pedreiro) para recalcular automaticamente todas as ocorrências no orçamento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo por nome ou código (ex: pedreiro, cimento)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
            autoFocus
          />
        </div>

        <div className="border rounded-2xl overflow-y-auto divide-y divide-border/60 flex-1 min-h-[260px] max-h-[52vh] mt-2">
          <div className="grid grid-cols-12 bg-muted/80 p-2.5 font-semibold text-muted-foreground text-xs sticky top-0 z-10">
            <span className="col-span-6">Insumo / Ocorrências</span>
            <span className="col-span-1 text-center">Unid</span>
            <span className="col-span-5 text-right">Valor Unitário / Atualizar</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum insumo encontrado com "{search}".
            </div>
          ) : (
            filtered.map((inp) => (
              <InputPriceRow
                key={inp.key}
                item={inp}
                onUpdate={updateInputPriceGlobally}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

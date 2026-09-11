import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SINAPI_DATABASE, searchSinapiItems, SinapiItemReference } from '@/data/sinapiDatabase';
import { useBudget } from '@/hooks/useBudget';
import { Search, Plus, Sparkles, Package } from 'lucide-react';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface SinapiSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStageId?: string;
}

export function SinapiSearchModal({
  open,
  onOpenChange,
  defaultStageId,
}: SinapiSearchModalProps) {
  const { activeProject, addItemToStage } = useBudget();

  const [activeTab, setActiveTab] = useState<'sinapi' | 'custom'>('sinapi');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState<string>(
    defaultStageId || activeProject?.stages[0]?.id || ''
  );

  const [quantity, setQuantity] = useState<number>(1);

  // Formulário de item personalizado
  const [customDesc, setCustomDesc] = useState('');
  const [customUnit, setCustomUnit] = useState('m²');
  const [customQty, setCustomQty] = useState(1);
  const [customMat, setCustomMat] = useState(0);
  const [customLab, setCustomLab] = useState(0);
  const [customEq, setCustomEq] = useState(0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    SINAPI_DATABASE.forEach(i => set.add(i.category));
    return Array.from(set);
  }, []);

  const filteredItems = useMemo(() => {
    return searchSinapiItems(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const handleAddSinapi = (item: SinapiItemReference) => {
    if (!selectedStageId) return;

    addItemToStage(selectedStageId, {
      code: `SINAPI-${item.code}`,
      source: 'sinapi',
      sinapiCode: item.code,
      description: item.description,
      unit: item.unit,
      quantity: Number(quantity) || 1,
      unitCostMaterial: item.costMaterial,
      unitCostLabor: item.costLabor,
      unitCostEquipment: item.costEquipment,
      unitCostTotal: item.costTotal,
      composition: item.composition,
    });

    onOpenChange(false);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageId || !customDesc.trim()) return;

    const tot = Number(customMat) + Number(customLab) + Number(customEq);

    addItemToStage(selectedStageId, {
      code: `PRÓPRIO-${Date.now().toString().slice(-4)}`,
      source: 'proprio',
      description: customDesc.trim(),
      unit: customUnit.trim() || 'un',
      quantity: Number(customQty) || 1,
      unitCostMaterial: Number(customMat) || 0,
      unitCostLabor: Number(customLab) || 0,
      unitCostEquipment: Number(customEq) || 0,
      unitCostTotal: tot,
    });

    setCustomDesc('');
    setCustomMat(0);
    setCustomLab(0);
    setCustomEq(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Adicionar Item ao Orçamento</DialogTitle>
              <DialogDescription>
                Consulte o catálogo oficial SINAPI ou crie composições personalizadas da Buddy Construtora
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="dest-stage" className="text-xs text-muted-foreground whitespace-nowrap">
                Etapa:
              </Label>
              <select
                id="dest-stage"
                value={selectedStageId}
                onChange={e => setSelectedStageId(e.target.value)}
                className="text-xs rounded-lg border bg-background px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
              >
                {activeProject?.stages.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.code} - {st.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sinapi" className="flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Catálogo SINAPI (Caixa)
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Composição Própria Buddy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sinapi" className="flex-1 flex flex-col gap-3 pt-2 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar código SINAPI, concreto, alvenaria, pintura..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full h-10 text-xs rounded-xl border bg-background px-3 focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Todas as Disciplinas</option>
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-2xl p-2 divide-y divide-border/60 max-h-[360px] bg-muted/20">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Nenhum item SINAPI encontrado para "{searchQuery}".
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.code}
                    className="p-3 hover:bg-muted/60 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                          SINAPI {item.code}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          {item.category}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          Un: {item.unit}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Mat: {formatCurrency(item.costMaterial)}</span>
                        <span>M.O.: {formatCurrency(item.costLabor)}</span>
                        {item.costEquipment > 0 && (
                          <span>Equip: {formatCurrency(item.costEquipment)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      <div className="text-right sm:pr-2">
                        <span className="text-xs text-muted-foreground block text-[10px]">Unitário</span>
                        <span className="text-sm font-bold font-display text-primary">
                          {formatCurrency(item.costTotal)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddSinapi(item)}
                        className="rounded-xl h-8 px-3 text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="pt-2">
            <form onSubmit={handleAddCustom} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cust-desc">Descrição do Serviço / Insumo *</Label>
                <Input
                  id="cust-desc"
                  required
                  placeholder="Ex: Forro de gesso especial, bancada de granito..."
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-unit">Unidade</Label>
                  <Input
                    id="cust-unit"
                    placeholder="m², m, un, vb..."
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-qty">Quantidade</Label>
                  <Input
                    id="cust-qty"
                    type="number"
                    step="0.01"
                    value={customQty}
                    onChange={e => setCustomQty(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-mat">Custo Mat. (R$)</Label>
                  <Input
                    id="cust-mat"
                    type="number"
                    step="0.01"
                    value={customMat}
                    onChange={e => setCustomMat(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-lab">Custo M.O. (R$)</Label>
                  <Input
                    id="cust-lab"
                    type="number"
                    step="0.01"
                    value={customLab}
                    onChange={e => setCustomLab(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">
                  Custo Unitário Total Calculado:
                </span>
                <span className="font-bold text-primary font-display">
                  {formatCurrency(Number(customMat) + Number(customLab) + Number(customEq))} / {customUnit}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar na Planilha</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

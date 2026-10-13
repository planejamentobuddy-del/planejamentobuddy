import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Composicao,
  ComposicaoItem,
  Insumo,
  INSUMO_GRUPO_COLORS,
  INSUMO_GRUPO_LABELS,
  INSUMO_TIPOS_PADRAO,
} from '@/types/catalog';
import { useCatalog } from '@/hooks/useCatalog';
import { InsumoFormModal } from './InsumoFormModal';
import { ExpandToggle, NestedCompositionRows } from './NestedCompositionRows';
import { Calculator, Layers, Plus, PlusCircle, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function parseMoney(val: string): number {
  const n = parseFloat((val || '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export interface ItemsSummary {
  material: number;
  labor: number;
  equipment: number;
  other: number;
  hasMaterial: boolean;
  hasLabor: boolean;
  hasEquipment: boolean;
  hasOther: boolean;
  total: number;
}

/**
 * Soma os itens (insumos e composições auxiliares) por categoria de custo.
 * Composições auxiliares são distribuídas proporcionalmente pelo seu breakdown.
 */
export function summarizeItems(items: ComposicaoItem[]): ItemsSummary {
  const s: ItemsSummary = {
    material: 0,
    labor: 0,
    equipment: 0,
    other: 0,
    hasMaterial: false,
    hasLabor: false,
    hasEquipment: false,
    hasOther: false,
    total: 0,
  };

  items.forEach((item) => {
    const coef = item.coefficient || 0;
    if (item.itemType === 'composicao' && item.breakdown) {
      const m = (item.breakdown.costMaterial || 0) * coef;
      const l = (item.breakdown.costLabor || 0) * coef;
      const e = (item.breakdown.costEquipment || 0) * coef;
      const o = (item.breakdown.costOther || 0) * coef;
      if (m > 0) { s.material += m; s.hasMaterial = true; }
      if (l > 0) { s.labor += l; s.hasLabor = true; }
      if (e > 0) { s.equipment += e; s.hasEquipment = true; }
      if (o > 0) { s.other += o; s.hasOther = true; }
      if (m === 0 && l === 0 && e === 0 && o === 0) {
        s.other += (item.unitCost || 0) * coef;
        s.hasOther = true;
      }
    } else {
      const tot = coef * (item.unitCost || 0);
      if (item.group === 'material') { s.material += tot; s.hasMaterial = true; }
      else if (item.group === 'labor') { s.labor += tot; s.hasLabor = true; }
      else if (item.group === 'equipment') { s.equipment += tot; s.hasEquipment = true; }
      else { s.other += tot; s.hasOther = true; }
    }
  });

  s.total = s.material + s.labor + s.equipment + s.other;
  return s;
}

interface ComposicaoItensEditorProps {
  items: ComposicaoItem[];
  onChange: (items: ComposicaoItem[]) => void;
  excludeComposicaoId?: string;
  /** Texto sugerido (ex: descrição digitada) para pré-preencher um novo insumo */
  suggestedInsumoDescription?: string;
}

export function ComposicaoItensEditor({
  items,
  onChange,
  excludeComposicaoId,
  suggestedInsumoDescription,
}: ComposicaoItensEditorProps) {
  const { insumos = [], composicoes = [] } = useCatalog();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'insumos' | 'composicoes'>('insumos');
  const [insumoSearch, setInsumoSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [compSearch, setCompSearch] = useState('');
  const [compTypeFilter, setCompTypeFilter] = useState('all');

  const [isCreateInsumoOpen, setIsCreateInsumoOpen] = useState(false);
  const [initialInsumoDesc, setInitialInsumoDesc] = useState('');

  // Controle de expansão das composições auxiliares
  const [expandedCompIds, setExpandedCompIds] = useState<Record<string, boolean>>({});

  const filteredInsumos = useMemo(() => {
    const q = insumoSearch.toLowerCase();
    return insumos.filter((i) => {
      const matchSearch =
        !q || i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      const matchGroup = groupFilter === 'all' || i.group === groupFilter;
      return matchSearch && matchGroup;
    });
  }, [insumos, insumoSearch, groupFilter]);

  const availableComposicoes = useMemo(() => {
    const q = compSearch.toLowerCase();
    return composicoes.filter((c) => {
      if (excludeComposicaoId && c.id === excludeComposicaoId) return false;
      const matchType = compTypeFilter === 'all' || c.type === compTypeFilter;
      const matchSearch =
        !q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [composicoes, compSearch, compTypeFilter, excludeComposicaoId]);

  const summary = useMemo(() => summarizeItems(items), [items]);

  const newId = () => `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const addInsumo = (insumo: Insumo) => {
    onChange([
      ...items,
      {
        id: newId(),
        itemType: 'insumo',
        insumoId: insumo.id,
        code: insumo.code,
        description: insumo.description,
        group: insumo.group,
        unit: insumo.unit,
        coefficient: 1,
        unitCost: insumo.unitCost,
        totalCost: insumo.unitCost,
      },
    ]);
    setIsPickerOpen(false);
    toast.success(`"${insumo.description}" adicionado à composição`);
  };

  const addComposicao = (comp: Composicao) => {
    onChange([
      ...items,
      {
        id: newId(),
        itemType: 'composicao',
        composicaoId: comp.id,
        code: comp.code,
        description: comp.description,
        group: 'other',
        unit: comp.unit || 'und',
        coefficient: 1,
        unitCost: comp.costTotal,
        totalCost: comp.costTotal,
        breakdown: {
          costMaterial: comp.costMaterial || 0,
          costLabor: comp.costLabor || 0,
          costEquipment: comp.costEquipment || 0,
          costOther: comp.costOther || 0,
        },
      },
    ]);
    setIsPickerOpen(false);
    toast.success(`Composição "${comp.description}" adicionada`);
  };

  const openPicker = (tab: 'insumos' | 'composicoes') => {
    setPickerTab(tab);
    setIsPickerOpen(true);
  };

  const openCreateInsumo = (prefill?: string) => {
    setInitialInsumoDesc(prefill ?? suggestedInsumoDescription ?? '');
    setIsPickerOpen(false);
    setIsCreateInsumoOpen(true);
  };

  const handleInsumoCreated = (insumo: Insumo) => {
    addInsumo(insumo);
    setIsCreateInsumoOpen(false);
  };

  const updateCoefficient = (id: string, str: string) => {
    const coef = parseMoney(str);
    onChange(
      items.map((it) =>
        it.id === id ? { ...it, coefficient: coef, totalCost: coef * it.unitCost } : it
      )
    );
  };

  const updateUnitCost = (id: string, str: string) => {
    const unitCost = parseMoney(str);
    onChange(
      items.map((it) => {
        if (it.id !== id) return it;
        const next: ComposicaoItem = {
          ...it,
          unitCost,
          totalCost: it.coefficient * unitCost,
        };
        if (it.itemType === 'composicao' && it.breakdown && it.unitCost > 0) {
          const k = unitCost / it.unitCost;
          next.breakdown = {
            costMaterial: it.breakdown.costMaterial * k,
            costLabor: it.breakdown.costLabor * k,
            costEquipment: it.breakdown.costEquipment * k,
            costOther: it.breakdown.costOther * k,
          };
        }
        return next;
      })
    );
  };

  const removeItem = (id: string) => onChange(items.filter((it) => it.id !== id));

  return (
    // O onSubmit com stopPropagation evita que formulários dos modais internos
    // (ex.: cadastro de insumo) disparem o submit do formulário externo via portal.
    <div className="space-y-3" onSubmit={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Composição do item (insumos e composições)
        </span>
        <span className="text-[11px] text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'itens'} • Total {formatCurrency(summary.total)}
        </span>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
            <tr>
              <th className="py-2 px-2.5 text-left w-20">Código</th>
              <th className="py-2 px-2.5 text-left">Descrição</th>
              <th className="py-2 px-2 text-center w-24">Tipo</th>
              <th className="py-2 px-2 text-center w-14">Und</th>
              <th className="py-2 px-2 text-right w-24">Coef.</th>
              <th className="py-2 px-2 text-right w-28">Custo Unit.</th>
              <th className="py-2 px-2.5 text-right w-28">Total</th>
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  Nenhum item. Selecione um insumo/composição existente ou cadastre um novo.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isComp = item.itemType === 'composicao' && !!item.composicaoId;
                const isExpanded = !!expandedCompIds[item.id];

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-muted/20">
                      <td className="py-2 px-2.5 font-mono text-muted-foreground">
                        {item.itemType === 'composicao' ? (
                          <span className="font-bold text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {item.code}
                          </span>
                        ) : (
                          `#${item.code}`
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-foreground">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isComp && (
                              <ExpandToggle
                                expanded={isExpanded}
                                onClick={() =>
                                  setExpandedCompIds((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id],
                                  }))
                                }
                              />
                            )}
                            <span className="font-medium text-foreground">{item.description}</span>
                            {item.itemType === 'composicao' && (
                              <span className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />
                                CPU Auxiliar
                              </span>
                            )}
                          </div>
                          {item.itemType === 'composicao' && item.breakdown && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono">
                              <span>Mat: {formatCurrency(item.breakdown.costMaterial)}</span>
                              <span>• M.O.: {formatCurrency(item.breakdown.costLabor)}</span>
                              {(item.breakdown.costEquipment > 0 || item.breakdown.costOther > 0) && (
                                <span>
                                  • Eq/Outros: {formatCurrency(item.breakdown.costEquipment + item.breakdown.costOther)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {item.itemType === 'composicao' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400 inline-flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" />
                            CPU
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${
                              INSUMO_GRUPO_COLORS[item.group]
                            }`}
                          >
                            {INSUMO_GRUPO_LABELS[item.group]}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                        {item.unit}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Input
                          type="number"
                          step="0.0001"
                          value={item.coefficient}
                          onChange={(e) => updateCoefficient(item.id, e.target.value)}
                          className="h-7 w-20 text-right font-mono text-xs ml-auto"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateUnitCost(item.id, e.target.value)}
                          className="h-7 w-24 text-right font-mono text-xs ml-auto"
                        />
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold font-mono">
                        {formatCurrency(item.totalCost)}
                      </td>
                      <td className="py-2 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {isComp && isExpanded && (
                      <NestedCompositionRows
                        composicaoId={item.composicaoId as string}
                        multiplier={item.coefficient || 1}
                        depth={1}
                        visited={[excludeComposicaoId || ''].filter(Boolean)}
                        showActionCol={true}
                        fallbackBreakdown={item.breakdown}
                      />
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          onClick={() => openPicker('insumos')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          Selecionar Insumo
        </Button>
        <Button
          type="button"
          onClick={() => openPicker('composicoes')}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 gap-1.5 rounded-lg"
        >
          <Layers className="w-3.5 h-3.5" />
          Selecionar Composição
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => openCreateInsumo()}
          className="border-dashed border-primary/50 text-primary hover:bg-primary/10 font-bold text-xs h-8 gap-1.5 rounded-lg"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Criar Novo Insumo
        </Button>
      </div>

      {/* Seletor de Insumos / Composições existentes */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-3xl w-full p-6 rounded-2xl bg-card border shadow-2xl z-[60]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Calculator className="w-5 h-5 text-primary" />
                Selecionar Item do Catálogo
              </DialogTitle>
              {pickerTab === 'insumos' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openCreateInsumo(insumoSearch)}
                  className="text-xs font-semibold gap-1.5 h-8 shrink-0 mr-6"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Criar Novo Insumo
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs
            value={pickerTab}
            onValueChange={(v) => setPickerTab(v as 'insumos' | 'composicoes')}
            className="w-full pt-1"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-10 p-1 bg-muted/60">
              <TabsTrigger value="insumos" className="rounded-lg font-bold text-xs">
                Insumos ({insumos.length})
              </TabsTrigger>
              <TabsTrigger value="composicoes" className="rounded-lg font-bold text-xs gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Composições ({availableComposicoes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insumos" className="space-y-3 pt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={insumoSearch}
                    onChange={(e) => setInsumoSearch(e.target.value)}
                    placeholder="Buscar por descrição ou código..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-40 h-10 rounded-xl">
                    <SelectValue placeholder="Grupo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-[80]">
                    <SelectItem value="all">Todos Grupos</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="labor">Mão de Obra</SelectItem>
                    <SelectItem value="equipment">Equipamento</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredInsumos.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">Nenhum insumo encontrado.</p>
                    <Button
                      type="button"
                      onClick={() => openCreateInsumo(insumoSearch)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Cadastrar {insumoSearch ? `"${insumoSearch}"` : 'novo insumo'} agora
                    </Button>
                  </div>
                ) : (
                  filteredInsumos.map((insumo) => (
                    <div
                      key={insumo.id}
                      onClick={() => addInsumo(insumo)}
                      className="p-3 rounded-xl border bg-card hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            #{insumo.code}
                          </span>
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">
                            {insumo.description}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                              INSUMO_GRUPO_COLORS[insumo.group]
                            }`}
                          >
                            {INSUMO_GRUPO_LABELS[insumo.group]}
                          </span>
                          <span>• Und: {insumo.unit}</span>
                          <span>• Base: {insumo.base}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <div className="font-bold text-sm text-primary">
                          {formatCurrency(insumo.unitCost)}
                        </div>
                        <span className="text-xs font-bold text-emerald-600">+ Incluir</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="composicoes" className="space-y-3 pt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={compSearch}
                    onChange={(e) => setCompSearch(e.target.value)}
                    placeholder="Buscar composição por código ou serviço..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <Select value={compTypeFilter} onValueChange={setCompTypeFilter}>
                  <SelectTrigger className="w-44 h-10 rounded-xl">
                    <SelectValue placeholder="Disciplina" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-popover border shadow-lg z-[80]">
                    <SelectItem value="all">Todas Disciplinas</SelectItem>
                    {INSUMO_TIPOS_PADRAO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {availableComposicoes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma composição encontrada no catálogo.
                  </div>
                ) : (
                  availableComposicoes.map((comp) => (
                    <div
                      key={comp.id}
                      onClick={() => addComposicao(comp)}
                      className="p-3 rounded-xl border bg-card hover:bg-purple-500/5 hover:border-purple-500/40 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                            {comp.code}
                          </span>
                          <span className="font-bold text-sm">{comp.description}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>Und: {comp.unit}</span>
                          <span>• Mat: {formatCurrency(comp.costMaterial || 0)}</span>
                          <span>• M.O.: {formatCurrency(comp.costLabor || 0)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <div className="font-bold text-sm text-purple-700 dark:text-purple-400">
                          {formatCurrency(comp.costTotal)}
                        </div>
                        <span className="text-xs font-bold text-purple-600">+ Incluir</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Cadastro de novo insumo sem sair da tela */}
      <InsumoFormModal
        open={isCreateInsumoOpen}
        onOpenChange={setIsCreateInsumoOpen}
        initialDescription={initialInsumoDesc}
        onSuccess={handleInsumoCreated}
      />
    </div>
  );
}

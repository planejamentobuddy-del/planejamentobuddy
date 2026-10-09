import React, { useState, useMemo, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { SINAPI_DATABASE, searchSinapiItems, SinapiItemReference } from '@/data/sinapiDatabase';
import { useBudget } from '@/hooks/useBudget';
import { useCatalog } from '@/hooks/useCatalog';
import {
  Insumo,
  Composicao,
  INSUMO_GRUPO_LABELS,
  INSUMO_GRUPO_COLORS,
  INSUMO_UNIDADES_PADRAO,
} from '@/types/catalog';
import {
  Search,
  Plus,
  Sparkles,
  Package,
  Layers,
  FolderTree,
  Check,
  FolderPlus,
} from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface SinapiSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStageId?: string;
  defaultSubstageId?: string;
}

export function SinapiSearchModal({
  open,
  onOpenChange,
  defaultStageId,
  defaultSubstageId,
}: SinapiSearchModalProps) {
  const {
    activeProject,
    bdiRate,
    addItemToSubstage,
    addSubstage,
  } = useBudget();

  const { insumos, composicoes, addInsumo, addComposicao } = useCatalog();

  const [activeTab, setActiveTab] = useState<'catalog' | 'sinapi' | 'custom'>('catalog');

  // Seleção de destino (Etapa e Subetapa)
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedSubstageId, setSelectedSubstageId] = useState<string>('');
  const [isQuickNewSubstage, setIsQuickNewSubstage] = useState(false);
  const [quickSubstageTitle, setQuickSubstageTitle] = useState('');

  // Quantidade geral para inserção
  const [quantity, setQuantity] = useState<number>(1);

  // Busca no Catálogo Buddy
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilterType, setCatalogFilterType] = useState<'all' | 'insumos' | 'composicoes'>('all');

  // Busca no SINAPI
  const [sinapiSearch, setSinapiSearch] = useState('');
  const [sinapiCategory, setSinapiCategory] = useState('all');

  // Formulário de Cadastro Rápido
  const [customType, setCustomType] = useState<'composicao' | 'insumo'>('composicao');
  const [customDesc, setCustomDesc] = useState('');
  const [customUnit, setCustomUnit] = useState('m²');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customMat, setCustomMat] = useState<number>(0);
  const [customLab, setCustomLab] = useState<number>(0);
  const [customEq, setCustomEq] = useState<number>(0);
  const [customOth, setCustomOth] = useState<number>(0);
  const [customBdi, setCustomBdi] = useState<number>(bdiRate);
  const [saveToGlobalCatalog, setSaveToGlobalCatalog] = useState(true);

  // Sincronizar destino ao abrir
  useEffect(() => {
    if (open && activeProject && activeProject.stages.length > 0) {
      const initialStage =
        activeProject.stages.find((s) => s.id === defaultStageId) || activeProject.stages[0];

      setSelectedStageId(initialStage.id);

      const subs = initialStage.substages || [];
      const initialSub =
        subs.find((sub) => sub.id === defaultSubstageId) || subs[0];

      if (initialSub) {
        setSelectedSubstageId(initialSub.id);
      } else {
        setSelectedSubstageId('');
      }

      setCustomBdi(bdiRate);
    }
  }, [open, defaultStageId, defaultSubstageId, activeProject, bdiRate]);

  // Subetapas da Etapa selecionada
  const currentStage = useMemo(() => {
    return activeProject?.stages.find((s) => s.id === selectedStageId);
  }, [activeProject, selectedStageId]);

  const currentSubstages = useMemo(() => {
    return currentStage?.substages || [];
  }, [currentStage]);

  // Atualizar subetapa quando a etapa muda
  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = activeProject?.stages.find((s) => s.id === stageId);
    if (stage && stage.substages && stage.substages.length > 0) {
      setSelectedSubstageId(stage.substages[0].id);
    } else {
      setSelectedSubstageId('');
    }
  };

  // Criar subetapa rápida se não existir
  const handleCreateQuickSubstage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageId || !quickSubstageTitle.trim()) return;

    addSubstage(selectedStageId, quickSubstageTitle.trim());
    setQuickSubstageTitle('');
    setIsQuickNewSubstage(false);
  };

  // Garante uma subetapa válida para inserção
  const getEnsureSubstageId = (): string => {
    if (selectedSubstageId) return selectedSubstageId;
    if (currentSubstages.length > 0) return currentSubstages[0].id;

    // Se a etapa não tiver nenhuma subetapa, cria uma padrão
    if (currentStage) {
      const newSubId = `sub-${currentStage.id}-1`;
      addSubstage(currentStage.id, 'Geral', `${currentStage.code}.1`);
      return newSubId;
    }
    return '';
  };

  // 1. Inclusão de item vindo do Catálogo Buddy (Insumo ou Composição)
  const handleAddCatalogItem = (
    item: { type: 'insumo'; data: Insumo } | { type: 'composicao'; data: Composicao }
  ) => {
    if (!selectedStageId) {
      toast.error('Selecione uma etapa de destino');
      return;
    }

    const targetSubstageId = getEnsureSubstageId();
    const qty = Number(quantity) > 0 ? Number(quantity) : 1;

    if (item.type === 'insumo') {
      const insumo = item.data;
      let mat = 0;
      let lab = 0;
      let eq = 0;
      let oth = 0;

      if (insumo.group === 'material') mat = insumo.unitCost;
      else if (insumo.group === 'labor') lab = insumo.unitCost;
      else if (insumo.group === 'equipment') eq = insumo.unitCost;
      else oth = insumo.unitCost;

      addItemToSubstage(selectedStageId, targetSubstageId, {
        code: `INS-${insumo.code}`,
        source: 'catalogo',
        catalogId: insumo.id,
        catalogType: 'insumo',
        description: insumo.description,
        unit: insumo.unit,
        quantity: qty,
        unitCostMaterial: mat,
        unitCostLabor: lab,
        unitCostEquipment: eq,
        unitCostOther: oth,
        unitCostTotal: insumo.unitCost,
        bdi: bdiRate,
      });
    } else {
      const comp = item.data;
      addItemToSubstage(selectedStageId, targetSubstageId, {
        code: comp.code || `CPU-${Date.now().toString().slice(-4)}`,
        source: 'catalogo',
        catalogId: comp.id,
        catalogType: 'composicao',
        description: comp.description,
        unit: comp.unit,
        quantity: qty,
        unitCostMaterial: comp.costMaterial || 0,
        unitCostLabor: comp.costLabor || 0,
        unitCostEquipment: comp.costEquipment || 0,
        unitCostOther: comp.costOther || 0,
        unitCostTotal: comp.costTotal,
        bdi: comp.bdi !== undefined ? comp.bdi : bdiRate,
        composition: comp.items?.map((it) => ({
          id: it.id,
          type: it.group === 'other' ? 'material' : it.group,
          code: it.code,
          description: it.description,
          unit: it.unit,
          coefficient: it.coefficient,
          unitCost: it.unitCost,
        })),
      });
    }

    onOpenChange(false);
  };

  // 2. Inclusão de item vindo do SINAPI
  const handleAddSinapi = (item: SinapiItemReference) => {
    if (!selectedStageId) {
      toast.error('Selecione uma etapa de destino');
      return;
    }

    const targetSubstageId = getEnsureSubstageId();
    const qty = Number(quantity) > 0 ? Number(quantity) : 1;

    addItemToSubstage(selectedStageId, targetSubstageId, {
      code: `SINAPI-${item.code}`,
      source: 'sinapi',
      sinapiCode: item.code,
      description: item.description,
      unit: item.unit,
      quantity: qty,
      unitCostMaterial: item.costMaterial,
      unitCostLabor: item.costLabor,
      unitCostEquipment: item.costEquipment,
      unitCostOther: 0,
      unitCostTotal: item.costTotal,
      bdi: bdiRate,
      composition: item.composition,
    });

    onOpenChange(false);
  };

  // 3. Cadastro rápido diretamente no corpo do orçamento
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageId || !customDesc.trim()) {
      toast.error('Informe a descrição do serviço');
      return;
    }

    const targetSubstageId = getEnsureSubstageId();
    const qty = Number(customQty) > 0 ? Number(customQty) : 1;
    const mat = Number(customMat) || 0;
    const lab = Number(customLab) || 0;
    const eq = Number(customEq) || 0;
    const oth = Number(customOth) || 0;
    const unitTot = mat + lab + eq + oth;
    const bdiVal = customBdi !== undefined ? Number(customBdi) : bdiRate;

    // Salvar também no catálogo se marcado
    if (saveToGlobalCatalog) {
      if (customType === 'insumo') {
        addInsumo({
          code: '',
          group: lab > mat ? 'labor' : 'material',
          description: customDesc.trim(),
          unit: customUnit.trim() || 'und',
          type: currentStage?.title || 'Geral',
          base: 'Própria',
          unitCost: unitTot,
          status: 'active',
        });
      } else {
        addComposicao({
          code: '',
          description: customDesc.trim(),
          unit: customUnit.trim() || 'm²',
          type: currentStage?.title || 'Geral',
          base: 'Própria',
          status: 'active',
          items: [],
          costMaterial: mat,
          costLabor: lab,
          costEquipment: eq,
          costOther: oth,
          costTotal: unitTot,
          bdi: bdiVal,
          sellingPrice: unitTot * (1 + bdiVal / 100),
        });
      }
    }

    addItemToSubstage(selectedStageId, targetSubstageId, {
      code: `PROP-${Date.now().toString().slice(-4)}`,
      source: 'proprio',
      description: customDesc.trim(),
      unit: customUnit.trim() || 'und',
      quantity: qty,
      unitCostMaterial: mat,
      unitCostLabor: lab,
      unitCostEquipment: eq,
      unitCostOther: oth,
      unitCostTotal: unitTot,
      bdi: bdiVal,
    });

    // Resetar formulário
    setCustomDesc('');
    setCustomMat(0);
    setCustomLab(0);
    setCustomEq(0);
    setCustomOth(0);
    onOpenChange(false);
  };

  // Filtros do Catálogo Buddy
  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.toLowerCase();
    const result: Array<{ type: 'insumo'; data: Insumo } | { type: 'composicao'; data: Composicao }> = [];

    if (catalogFilterType === 'all' || catalogFilterType === 'composicoes') {
      composicoes.forEach((c) => {
        if (!q || c.description.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) {
          result.push({ type: 'composicao', data: c });
        }
      });
    }

    if (catalogFilterType === 'all' || catalogFilterType === 'insumos') {
      insumos.forEach((i) => {
        if (!q || i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) {
          result.push({ type: 'insumo', data: i });
        }
      });
    }

    return result;
  }, [insumos, composicoes, catalogSearch, catalogFilterType]);

  // Filtros do SINAPI
  const sinapiCategories = useMemo(() => {
    const set = new Set<string>();
    SINAPI_DATABASE.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, []);

  const filteredSinapi = useMemo(() => {
    return searchSinapiItems(sinapiSearch, sinapiCategory);
  }, [sinapiSearch, sinapiCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold font-display">
                Adicionar Item ao Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecione insumos e composições do catálogo, base oficial SINAPI ou cadastre um novo item diretamente.
              </DialogDescription>
            </div>

            {/* SELETOR DE ETAPA E SUBETAPA DE DESTINO */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Etapa:
                </span>
                <select
                  value={selectedStageId}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="text-xs rounded-lg border bg-background px-2.5 py-1.5 focus:ring-1 focus:ring-primary font-medium"
                >
                  {activeProject?.stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.code} - {st.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Subetapa:
                </span>
                {isQuickNewSubstage ? (
                  <form onSubmit={handleCreateQuickSubstage} className="flex items-center gap-1">
                    <Input
                      autoFocus
                      placeholder="Nome da Subetapa..."
                      value={quickSubstageTitle}
                      onChange={(e) => setQuickSubstageTitle(e.target.value)}
                      className="h-7 text-xs w-36"
                    />
                    <Button type="submit" size="sm" className="h-7 px-2 text-xs">
                      OK
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsQuickNewSubstage(false)}
                      className="h-7 px-1.5 text-xs"
                    >
                      X
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedSubstageId}
                      onChange={(e) => setSelectedSubstageId(e.target.value)}
                      className="text-xs rounded-lg border bg-background px-2.5 py-1.5 focus:ring-1 focus:ring-primary font-medium max-w-[160px] truncate"
                    >
                      {currentSubstages.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} - {sub.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsQuickNewSubstage(true)}
                      className="p-1.5 rounded-lg border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Criar nova subetapa nesta etapa"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* NAVEGAÇÃO DE ABAS */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col pt-3 min-h-0">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="catalog" className="flex items-center gap-2 text-xs">
              <FolderTree className="w-3.5 h-3.5 text-primary" />
              <span>Catálogo Buddy</span>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full hidden sm:inline">
                {insumos.length + composicoes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sinapi" className="flex items-center gap-2 text-xs">
              <Package className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Catálogo SINAPI</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Cadastrar Novo</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: CATÁLOGO BUDDY (Insumos e Composições) */}
          <TabsContent value="catalog" className="flex-1 flex flex-col gap-3 pt-3 min-h-0">
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por código ou descrição no Catálogo Buddy..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={catalogFilterType}
                  onChange={(e) => setCatalogFilterType(e.target.value as any)}
                  className="h-10 text-xs rounded-xl border bg-background px-3 focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Todos os Itens</option>
                  <option value="composicoes">Apenas Composições (CPU)</option>
                  <option value="insumos">Apenas Insumos</option>
                </select>

                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-xl border">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Qtd:</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="h-7 w-16 text-center text-xs p-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-2xl p-2 divide-y divide-border/60 max-h-[380px] bg-muted/10">
              {filteredCatalogItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  Nenhum item encontrado no Catálogo Buddy para "{catalogSearch}".
                </div>
              ) : (
                filteredCatalogItems.map((entry) => {
                  if (entry.type === 'composicao') {
                    const comp = entry.data;
                    return (
                      <div
                        key={`comp-${comp.id}`}
                        className="p-3 hover:bg-muted/50 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
                              CPU #{comp.code}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                              {comp.type}
                            </span>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              Un: {comp.unit}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Base: {comp.base}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-foreground leading-snug">
                            {comp.description}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <span>Mat: {formatCurrency(comp.costMaterial || 0)}</span>
                            <span>M.O.: {formatCurrency(comp.costLabor || 0)}</span>
                            {(comp.costEquipment || 0) > 0 && (
                              <span>Equip: {formatCurrency(comp.costEquipment || 0)}</span>
                            )}
                            {(comp.costOther || 0) > 0 && (
                              <span>Outros: {formatCurrency(comp.costOther || 0)}</span>
                            )}
                            {comp.bdi !== undefined && (
                              <span className="text-emerald-600 font-semibold">
                                BDI: {comp.bdi}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:self-center shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block uppercase">
                              Custo Unit.
                            </span>
                            <span className="text-sm font-bold font-display text-primary">
                              {formatCurrency(comp.costTotal)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddCatalogItem(entry)}
                            className="rounded-xl h-8 px-3 text-xs flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    );
                  } else {
                    const insumo = entry.data;
                    return (
                      <div
                        key={`ins-${insumo.id}`}
                        className="p-3 hover:bg-muted/50 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-mono">
                              #{insumo.code}
                            </span>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                                INSUMO_GRUPO_COLORS[insumo.group]
                              }`}
                            >
                              {INSUMO_GRUPO_LABELS[insumo.group]}
                            </span>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              Un: {insumo.unit}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {insumo.type}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-foreground leading-snug">
                            {insumo.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 sm:self-center shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block uppercase">
                              Custo Unit.
                            </span>
                            <span className="text-sm font-bold font-display text-primary">
                              {formatCurrency(insumo.unitCost)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddCatalogItem(entry)}
                            className="rounded-xl h-8 px-3 text-xs flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </TabsContent>

          {/* ABA 2: CATÁLOGO SINAPI */}
          <TabsContent value="sinapi" className="flex-1 flex flex-col gap-3 pt-3 min-h-0">
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar código SINAPI, concreto, argamassa, pintura..."
                  value={sinapiSearch}
                  onChange={(e) => setSinapiSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={sinapiCategory}
                  onChange={(e) => setSinapiCategory(e.target.value)}
                  className="h-10 text-xs rounded-xl border bg-background px-3 focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Todas as Disciplinas</option>
                  {sinapiCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-xl border">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Qtd:</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="h-7 w-16 text-center text-xs p-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-2xl p-2 divide-y divide-border/60 max-h-[380px] bg-muted/10">
              {filteredSinapi.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  Nenhum item SINAPI encontrado para "{sinapiSearch}".
                </div>
              ) : (
                filteredSinapi.map((item) => (
                  <div
                    key={item.code}
                    className="p-3 hover:bg-muted/50 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                          SINAPI {item.code}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          {item.category}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                          Un: {item.unit}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-snug">
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

                    <div className="flex items-center gap-3 sm:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase">
                          Custo Unit.
                        </span>
                        <span className="text-sm font-bold font-display text-primary">
                          {formatCurrency(item.costTotal)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddSinapi(item)}
                        className="rounded-xl h-8 px-3 text-xs flex items-center gap-1 shadow-sm"
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

          {/* ABA 3: CADASTRAR NOVO NO CORPO DO ORÇAMENTO */}
          <TabsContent value="custom" className="flex-1 overflow-y-auto pt-3 max-h-[420px]">
            <form onSubmit={handleAddCustom} className="space-y-4 pr-1">
              {/* Seletor Insumo vs Composição */}
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Tipo de Cadastro:
                </span>
                <div className="flex rounded-xl border overflow-hidden p-0.5 bg-muted/40 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomType('composicao')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      customType === 'composicao'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Composição (CPU)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomType('insumo')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      customType === 'insumo'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Insumo Simples
                  </button>
                </div>
              </div>

              {/* Descrição do Serviço / Insumo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Descrição do Serviço / Insumo *
                </Label>
                <Input
                  required
                  placeholder="Ex: Forro de gesso acartonado especial, bancada de granito São Gabriel..."
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>

              {/* Unidade e Quantidade */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Unidade</Label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className="w-full h-10 text-xs rounded-xl border bg-background px-3 focus:ring-1 focus:ring-primary"
                  >
                    {INSUMO_UNIDADES_PADRAO.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customQty}
                    onChange={(e) => setCustomQty(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">BDI do Item (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={customBdi}
                    onChange={(e) => setCustomBdi(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              {/* 4 Categorias de Custos: Material, Mão de Obra, Equipamento, Outros */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Custo Mat. (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customMat}
                    onChange={(e) => setCustomMat(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Custo M.O. (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customLab}
                    onChange={(e) => setCustomLab(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Custo Equip. (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customEq}
                    onChange={(e) => setCustomEq(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                    Custo Outros (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customOth}
                    onChange={(e) => setCustomOth(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              {/* Resumo Dinâmico do Custo e Preço com BDI */}
              <div className="p-3.5 bg-muted/40 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Custo Unitário Total:</span>
                  <span className="font-bold text-base text-foreground font-display">
                    {formatCurrency(customMat + customLab + customEq + customOth)} / {customUnit}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-muted-foreground block">
                    Preço de Venda Unit. (+BDI {customBdi}%):
                  </span>
                  <span className="font-black text-base text-primary font-display">
                    {formatCurrency(
                      (customMat + customLab + customEq + customOth) * (1 + customBdi / 100)
                    )}{' '}
                    / {customUnit}
                  </span>
                </div>
              </div>

              {/* Opção para salvar no Catálogo Geral da construtora */}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="save-catalog"
                  checked={saveToGlobalCatalog}
                  onCheckedChange={(checked) => setSaveToGlobalCatalog(!!checked)}
                />
                <Label htmlFor="save-catalog" className="text-xs cursor-pointer text-muted-foreground">
                  Salvar também no Catálogo Geral da Buddy Construtora (para reutilizar em outros orçamentos)
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-xl bg-primary text-white font-bold text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Cadastrar na Planilha
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

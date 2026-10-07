import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Composicao,
  ComposicaoItem,
  Insumo,
  InsumoGrupo,
  InsumoStatus,
  INSUMO_GRUPO_LABELS,
  INSUMO_GRUPO_COLORS,
  INSUMO_UNIDADES_PADRAO,
  INSUMO_TIPOS_PADRAO,
  INSUMO_BASES_PADRAO,
} from '@/types/catalog';
import { useCatalog } from '@/hooks/useCatalog';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Search,
  Info,
  Edit2,
  Layers,
  ArrowUpDown,
  Calculator,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function parseMoneyInput(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^\d.,]/g, '');
  if (!clean) return 0;
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  return parseFloat(clean) || 0;
}

interface ComposicaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composicaoToEdit?: Composicao | null;
  onSuccess?: (savedComp: Composicao) => void;
}

export function ComposicaoFormModal({
  open,
  onOpenChange,
  composicaoToEdit,
  onSuccess,
}: ComposicaoFormModalProps) {
  const { insumos, addComposicao, updateComposicao, getNextComposicaoCode } = useCatalog();

  // Informações Principais
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [unit, setUnit] = useState<string>('m²');
  const [type, setType] = useState<string>('Estrutura');
  const [base, setBase] = useState<string>('Própria');
  const [status, setStatus] = useState<InsumoStatus>('active');
  const [detailedDescription, setDetailedDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Tabela de Insumos da composição
  const [items, setItems] = useState<ComposicaoItem[]>([]);

  // Custos das 4 categorias (permitindo modo granular via itens OU modo manual direto)
  const [costLabor, setCostLabor] = useState<number>(0);
  const [costMaterial, setCostMaterial] = useState<number>(0);
  const [costEquipment, setCostEquipment] = useState<number>(0);
  const [costOther, setCostOther] = useState<number>(0);

  // Strings dos inputs para digitação livre
  const [laborInput, setLaborInput] = useState<string>('R$ 0,00');
  const [materialInput, setMaterialInput] = useState<string>('R$ 0,00');
  const [equipmentInput, setEquipmentInput] = useState<string>('R$ 0,00');
  const [otherInput, setOtherInput] = useState<string>('R$ 0,00');

  // BDI e Preço Unitário
  const [bdi, setBdi] = useState<number>(0);
  const [isEditingBdi, setIsEditingBdi] = useState<boolean>(false);
  const [bdiInput, setBdiInput] = useState<string>('0');

  const [isEditingPrice, setIsEditingPrice] = useState<boolean>(false);
  const [priceInput, setPriceInput] = useState<string>('R$ 0,00');

  // Modal para escolher insumo do catálogo
  const [isInsumoPickerOpen, setIsInsumoPickerOpen] = useState(false);
  const [insumoSearch, setInsumoSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Inicialização ao abrir modal
  useEffect(() => {
    if (open) {
      if (composicaoToEdit) {
        setCode(composicaoToEdit.code);
        setDescription(composicaoToEdit.description);
        setUnit(composicaoToEdit.unit || 'm²');
        setType(composicaoToEdit.type || 'Estrutura');
        setBase(composicaoToEdit.base || 'Própria');
        setStatus(composicaoToEdit.status || 'active');
        setDetailedDescription(composicaoToEdit.detailedDescription || '');
        setNotes(composicaoToEdit.notes || '');
        setItems(composicaoToEdit.items || []);

        const lab = composicaoToEdit.costLabor || 0;
        const mat = composicaoToEdit.costMaterial || 0;
        const eq = composicaoToEdit.costEquipment || 0;
        const oth = composicaoToEdit.costOther || 0;

        setCostLabor(lab);
        setCostMaterial(mat);
        setCostEquipment(eq);
        setCostOther(oth);

        setLaborInput(formatCurrency(lab));
        setMaterialInput(formatCurrency(mat));
        setEquipmentInput(formatCurrency(eq));
        setOtherInput(formatCurrency(oth));

        const compBdi = composicaoToEdit.bdi ?? 0;
        setBdi(compBdi);
        setBdiInput(String(compBdi));

        const compTot = lab + mat + eq + oth;
        const compPrice = composicaoToEdit.sellingPrice ?? compTot * (1 + compBdi / 100);
        setPriceInput(formatCurrency(compPrice));
      } else {
        setCode(getNextComposicaoCode());
        setDescription('');
        setUnit('m²');
        setType('Estrutura');
        setBase('Própria');
        setStatus('active');
        setDetailedDescription('');
        setNotes('');
        setItems([]);

        setCostLabor(0);
        setCostMaterial(0);
        setCostEquipment(0);
        setCostOther(0);

        setLaborInput('R$ 0,00');
        setMaterialInput('R$ 0,00');
        setEquipmentInput('R$ 0,00');
        setOtherInput('R$ 0,00');

        setBdi(0);
        setBdiInput('0');
        setPriceInput('R$ 0,00');
      }
      setIsEditingBdi(false);
      setIsEditingPrice(false);
    }
  }, [open, composicaoToEdit]);

  // Recalcular custos a partir dos itens quando itens forem modificados
  const syncCostsFromItems = (currentItems: ComposicaoItem[]) => {
    let mat = 0;
    let lab = 0;
    let eq = 0;
    let oth = 0;

    let hasMat = false;
    let hasLab = false;
    let hasEq = false;
    let hasOth = false;

    currentItems.forEach((item) => {
      const tot = (item.coefficient || 0) * (item.unitCost || 0);
      if (item.group === 'material') {
        mat += tot;
        hasMat = true;
      } else if (item.group === 'labor') {
        lab += tot;
        hasLab = true;
      } else if (item.group === 'equipment') {
        eq += tot;
        hasEq = true;
      } else {
        oth += tot;
        hasOth = true;
      }
    });

    // Se houver itens na categoria, atualiza o custo da categoria para a soma dos itens.
    // Se NÃO houver itens na categoria, preserva o valor manual digitado anteriormente!
    const newLabor = hasLab ? lab : costLabor;
    const newMaterial = hasMat ? mat : costMaterial;
    const newEquipment = hasEq ? eq : costEquipment;
    const newOther = hasOth ? oth : costOther;

    setCostLabor(newLabor);
    setCostMaterial(newMaterial);
    setCostEquipment(newEquipment);
    setCostOther(newOther);

    if (hasLab) setLaborInput(formatCurrency(newLabor));
    if (hasMat) setMaterialInput(formatCurrency(newMaterial));
    if (hasEq) setEquipmentInput(formatCurrency(newEquipment));
    if (hasOth) setOtherInput(formatCurrency(newOther));

    const newTotal = newLabor + newMaterial + newEquipment + newOther;
    const newSelling = newTotal * (1 + bdi / 100);
    setPriceInput(formatCurrency(newSelling));
  };

  // Custo unitário total computado
  const costTotal = useMemo(() => {
    return costLabor + costMaterial + costEquipment + costOther;
  }, [costLabor, costMaterial, costEquipment, costOther]);

  // Preço Unitário computado a partir do Custo Total e BDI
  const computedSellingPrice = useMemo(() => {
    return costTotal * (1 + bdi / 100);
  }, [costTotal, bdi]);

  // Manipulação de BDI
  const handleBdiSubmit = (valStr: string) => {
    const val = parseFloat(valStr.replace(',', '.')) || 0;
    const clamped = Math.max(-100, Math.min(1000, val));
    setBdi(clamped);
    setBdiInput(String(clamped));
    const newPrice = costTotal * (1 + clamped / 100);
    setPriceInput(formatCurrency(newPrice));
    setIsEditingBdi(false);
  };

  // Manipulação direta do Preço Unitário (recalcula o BDI se houver custo total)
  const handlePriceSubmit = (valStr: string) => {
    const newPrice = parseMoneyInput(valStr);
    setPriceInput(formatCurrency(newPrice));
    if (costTotal > 0) {
      const impliedBdi = ((newPrice / costTotal) - 1) * 100;
      const roundedBdi = Math.round(impliedBdi * 100) / 100;
      setBdi(roundedBdi);
      setBdiInput(String(roundedBdi));
    }
    setIsEditingPrice(false);
  };

  // Handlers para os 4 inputs manuais de Custos Unitários
  const handleLaborChange = (valStr: string) => {
    setLaborInput(valStr);
    const parsed = parseMoneyInput(valStr);
    setCostLabor(parsed);
  };

  const handleLaborBlur = () => {
    setLaborInput(formatCurrency(costLabor));
  };

  const handleMaterialChange = (valStr: string) => {
    setMaterialInput(valStr);
    const parsed = parseMoneyInput(valStr);
    setCostMaterial(parsed);
  };

  const handleMaterialBlur = () => {
    setMaterialInput(formatCurrency(costMaterial));
  };

  const handleEquipmentChange = (valStr: string) => {
    setEquipmentInput(valStr);
    const parsed = parseMoneyInput(valStr);
    setCostEquipment(parsed);
  };

  const handleEquipmentBlur = () => {
    setEquipmentInput(formatCurrency(costEquipment));
  };

  const handleOtherChange = (valStr: string) => {
    setOtherInput(valStr);
    const parsed = parseMoneyInput(valStr);
    setCostOther(parsed);
  };

  const handleOtherBlur = () => {
    setOtherInput(formatCurrency(costOther));
  };

  // Adicionar Insumo do catálogo à Composição
  const handleAddInsumoFromCatalog = (insumo: Insumo) => {
    const newItem: ComposicaoItem = {
      id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      insumoId: insumo.id,
      code: insumo.code,
      description: insumo.description,
      group: insumo.group,
      unit: insumo.unit,
      coefficient: 1.0,
      unitCost: insumo.unitCost,
      totalCost: insumo.unitCost * 1.0,
    };

    const updated = [...items, newItem];
    setItems(updated);
    syncCostsFromItems(updated);
    setIsInsumoPickerOpen(false);
    toast.success(`"${insumo.description}" adicionado com sucesso!`);
  };

  // Atualizar coeficiente de um item
  const handleUpdateItemCoefficient = (itemId: string, coefStr: string) => {
    const coef = parseFloat(coefStr.replace(',', '.')) || 0;
    const updated = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          coefficient: coef,
          totalCost: coef * item.unitCost,
        };
      }
      return item;
    });
    setItems(updated);
    syncCostsFromItems(updated);
  };

  // Atualizar custo unitário de um item na composição
  const handleUpdateItemUnitCost = (itemId: string, costStr: string) => {
    const unitCost = parseMoneyInput(costStr);
    const updated = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          unitCost,
          totalCost: item.coefficient * unitCost,
        };
      }
      return item;
    });
    setItems(updated);
    syncCostsFromItems(updated);
  };

  // Remover item da composição
  const handleRemoveItem = (itemId: string) => {
    const updated = items.filter((i) => i.id !== itemId);
    setItems(updated);
    syncCostsFromItems(updated);
  };

  // Salvar Composição
  const handleSave = () => {
    if (!description.trim()) {
      toast.error('Informe a descrição da composição');
      return;
    }

    const payload = {
      code: code.trim() || getNextComposicaoCode(),
      description: description.trim(),
      unit,
      type,
      base,
      status,
      items,
      costMaterial,
      costLabor,
      costEquipment,
      costOther,
      costTotal,
      detailedDescription: detailedDescription.trim(),
      bdi,
      sellingPrice: computedSellingPrice,
      notes: notes.trim(),
    };

    let savedComp: Composicao;
    if (composicaoToEdit) {
      updateComposicao(composicaoToEdit.id, payload);
      savedComp = { ...composicaoToEdit, ...payload };
    } else {
      savedComp = addComposicao(payload);
    }

    if (onSuccess) {
      onSuccess(savedComp);
    }
    onOpenChange(false);
  };

  const filteredInsumos = useMemo(() => {
    return insumos.filter((i) => {
      const matchSearch =
        i.description.toLowerCase().includes(insumoSearch.toLowerCase()) ||
        i.code.toLowerCase().includes(insumoSearch.toLowerCase());
      const matchGroup = selectedGroupFilter === 'all' || i.group === selectedGroupFilter;
      return matchSearch && matchGroup;
    });
  }, [insumos, insumoSearch, selectedGroupFilter]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[94vh] p-0 overflow-hidden bg-background border rounded-2xl shadow-2xl flex flex-col">
          {/* Top Bar Header com Indicador Laranja e KPIs (fiel ao mockup) */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b bg-card">
            {/* Lado Esquerdo: Barra Laranja + Título + KPIs */}
            <div className="flex items-center gap-6 flex-wrap">
              {/* Barra Laranja e Título */}
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-10 bg-amber-500 rounded-full shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    CATÁLOGO
                  </span>
                  <h2 className="text-2xl font-bold font-display text-foreground tracking-tight">
                    Composição
                  </h2>
                </div>
              </div>

              {/* KPI: CUSTO UNITÁRIO */}
              <div className="border-l pl-4 hidden sm:block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  CUSTO UNITÁRIO
                </span>
                <span className="text-2xl font-bold text-foreground font-display">
                  {formatCurrency(costTotal)}
                </span>
              </div>

              {/* KPI: BDI */}
              <div className="hidden md:block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                  BDI
                </span>
                {isEditingBdi ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      type="text"
                      value={bdiInput}
                      onChange={(e) => setBdiInput(e.target.value)}
                      onBlur={() => handleBdiSubmit(bdiInput)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBdiSubmit(bdiInput)}
                      className="h-8 w-16 text-center font-bold text-xs rounded-md bg-background"
                    />
                    <span className="text-xs font-bold text-muted-foreground">%</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingBdi(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-background hover:bg-muted/50 text-xs font-bold text-foreground transition-colors"
                    title="Editar percentual de BDI"
                  >
                    <span>{bdi}%</span>
                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* KPI: PREÇO UNITÁRIO */}
              <div className="hidden md:block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                  PREÇO UNITÁRIO
                </span>
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      type="text"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      onBlur={() => handlePriceSubmit(priceInput)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePriceSubmit(priceInput)}
                      className="h-8 w-28 text-right font-bold text-xs rounded-md bg-background font-mono"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingPrice(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-background hover:bg-muted/50 text-xs font-bold text-foreground transition-colors font-mono"
                    title="Editar Preço Unitário final de venda"
                  >
                    <span>{formatCurrency(computedSellingPrice)}</span>
                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* STATUS: Segmented Toggle [ATIVO | INATIVO] */}
              <div className="hidden lg:block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                  STATUS
                </span>
                <div className="flex rounded-md border overflow-hidden p-0.5 bg-muted/40 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    className={`px-3 py-1 rounded transition-all ${
                      status === 'active'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ATIVO
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('inactive')}
                    className={`px-3 py-1 rounded transition-all ${
                      status === 'inactive'
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    INATIVO
                  </button>
                </div>
              </div>
            </div>

            {/* Lado Direito: Botão Salvar (Verde) e Voltar (Laranja) */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm h-9"
              >
                <Check className="w-4 h-4" />
                Salvar
              </Button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg flex items-center justify-center transition-all shadow-sm h-9 w-9"
                title="Voltar / Fechar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conteúdo com Scroll: 3 Cards principais */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(94vh-80px)] bg-muted/10">
            {/* CARD 1: Dados Principais e Descrição Detalhada */}
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Lado Esquerdo: Formulário (Código, Descrição, Unidade, Tipo, Base) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Linha 1: Código e Descrição */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4 space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Código: <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="368"
                        className="h-10 rounded-lg text-sm bg-background font-mono"
                      />
                    </div>

                    <div className="sm:col-span-8 space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Descrição: <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Alvenaria de Vedação em Bloco Cerâmico 9x19x19 cm"
                        className="h-10 rounded-lg text-sm bg-background"
                      />
                    </div>
                  </div>

                  {/* Linha 2: Unidade, Tipo, Base */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4 space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Unidade: <span className="text-destructive">*</span>
                      </Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger className="h-10 rounded-lg bg-background text-sm">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                          {INSUMO_UNIDADES_PADRAO.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-4 space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Tipo:
                      </Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-10 rounded-lg bg-background text-sm">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                          {INSUMO_TIPOS_PADRAO.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-4 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Base:
                        </Label>
                        <Info
                          className="w-3.5 h-3.5 text-muted-foreground/70"
                          title="Base de dados de referência ou Própria"
                        />
                        <span className="text-destructive text-xs font-semibold">*</span>
                      </div>
                      <Select value={base} onValueChange={setBase}>
                        <SelectTrigger className="h-10 rounded-lg bg-background text-sm">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-lg z-50">
                          {INSUMO_BASES_PADRAO.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Descrição Detalhada */}
                <div className="lg:col-span-5 flex flex-col space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Descrição detalhada:
                  </Label>
                  <Textarea
                    value={detailedDescription}
                    onChange={(e) => setDetailedDescription(e.target.value)}
                    placeholder="Especificações completas, procedimentos executivos, traço, perdas estimadas..."
                    className="flex-1 min-h-[110px] rounded-lg text-sm bg-background resize-none"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Insumos (Tabela + Botão verde "+ Item") */}
            <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-foreground/85 pb-2 border-b">
                Insumos
              </h3>

              {/* Tabela de Insumos da Composição */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-24">Código</th>
                      <th className="py-2.5 px-3 text-left">Descrição</th>
                      <th className="py-2.5 px-2 text-center w-28">Grupo</th>
                      <th className="py-2.5 px-2 text-center w-16">Unidade</th>
                      <th className="py-2.5 px-3 text-right w-28">
                        <span className="inline-flex items-center gap-1 justify-end">
                          Coeficiente <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                        </span>
                      </th>
                      <th className="py-2.5 px-3 text-right w-28">Custo Unitário</th>
                      <th className="py-2.5 px-3 text-right w-28">
                        <span className="inline-flex items-center gap-1 justify-end">
                          Custo Total <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />
                        </span>
                      </th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhum item adicionado.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {item.code}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {item.description}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                                INSUMO_GRUPO_COLORS[item.group]
                              }`}
                            >
                              {INSUMO_GRUPO_LABELS[item.group]}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground font-mono">
                            {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Input
                              type="number"
                              step="0.0001"
                              value={item.coefficient}
                              onChange={(e) =>
                                handleUpdateItemCoefficient(item.id, e.target.value)
                              }
                              className="h-8 w-20 text-right font-mono text-xs ml-auto rounded-md bg-background"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) =>
                                handleUpdateItemUnitCost(item.id, e.target.value)
                              }
                              className="h-8 w-24 text-right font-mono text-xs ml-auto rounded-md bg-background"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground font-mono">
                            {formatCurrency(item.totalCost)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              title="Remover insumo da composição"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Botão verde "+ Item" abaixo da tabela */}
              <div>
                <Button
                  type="button"
                  onClick={() => setIsInsumoPickerOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Item
                </Button>
              </div>
            </div>

            {/* CARD 3: Custos Unitários (Permite entrada manual direta ou soma dos itens) */}
            <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-base font-bold text-foreground/85">
                  Custos Unitários
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Valores somados automaticamente dos insumos ou informados manualmente
                </span>
              </div>

              {/* Grid 4 colunas: Mão de Obra, Material, Equipamento, Outros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Mão de Obra */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">
                    Mão de Obra
                  </Label>
                  <Input
                    type="text"
                    value={laborInput}
                    onChange={(e) => handleLaborChange(e.target.value)}
                    onBlur={handleLaborBlur}
                    placeholder="R$ 0,00"
                    className="h-10 rounded-lg text-sm bg-background font-mono"
                  />
                </div>

                {/* Material */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">
                    Material
                  </Label>
                  <Input
                    type="text"
                    value={materialInput}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    onBlur={handleMaterialBlur}
                    placeholder="R$ 0,00"
                    className="h-10 rounded-lg text-sm bg-background font-mono"
                  />
                </div>

                {/* Equipamento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">
                    Equipamento
                  </Label>
                  <Input
                    type="text"
                    value={equipmentInput}
                    onChange={(e) => handleEquipmentChange(e.target.value)}
                    onBlur={handleEquipmentBlur}
                    placeholder="R$ 0,00"
                    className="h-10 rounded-lg text-sm bg-background font-mono"
                  />
                </div>

                {/* Outros */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">
                    Outros
                  </Label>
                  <Input
                    type="text"
                    value={otherInput}
                    onChange={(e) => handleOtherChange(e.target.value)}
                    onBlur={handleOtherBlur}
                    placeholder="R$ 0,00"
                    className="h-10 rounded-lg text-sm bg-background font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Seletor de Insumos do Catálogo */}
      <Dialog open={isInsumoPickerOpen} onOpenChange={setIsInsumoPickerOpen}>
        <DialogContent className="max-w-2xl w-full p-6 rounded-2xl bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Calculator className="w-5 h-5 text-primary" />
              Selecionar Insumo do Catálogo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={insumoSearch}
                  onChange={(e) => setInsumoSearch(e.target.value)}
                  placeholder="Buscar por descrição ou código do insumo..."
                  className="pl-9 h-10 rounded-xl"
                />
              </div>

              <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                <SelectTrigger className="w-40 h-10 rounded-xl">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
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
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum insumo encontrado no catálogo com esses filtros.
                </div>
              ) : (
                filteredInsumos.map((insumo) => (
                  <div
                    key={insumo.id}
                    onClick={() => handleAddInsumoFromCatalog(insumo)}
                    className="p-3 rounded-xl border bg-card hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          #{insumo.code}
                        </span>
                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
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
                        <span>• Tipo: {insumo.type}</span>
                        <span>• Base: {insumo.base}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <div className="font-bold text-sm text-primary">
                        {formatCurrency(insumo.unitCost)}
                      </div>
                      <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                        + Incluir
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

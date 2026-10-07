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
  Layers,
  Calculator,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
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

  // State
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [unit, setUnit] = useState<string>('m²');
  const [type, setType] = useState<string>('Estrutura');
  const [base, setBase] = useState<string>('Própria');
  const [status, setStatus] = useState<InsumoStatus>('active');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<ComposicaoItem[]>([]);

  // Modal para escolher insumo do catálogo
  const [isInsumoPickerOpen, setIsInsumoPickerOpen] = useState(false);
  const [insumoSearch, setInsumoSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  useEffect(() => {
    if (open) {
      if (composicaoToEdit) {
        setCode(composicaoToEdit.code);
        setDescription(composicaoToEdit.description);
        setUnit(composicaoToEdit.unit);
        setType(composicaoToEdit.type);
        setBase(composicaoToEdit.base);
        setStatus(composicaoToEdit.status);
        setNotes(composicaoToEdit.notes || '');
        setItems(composicaoToEdit.items || []);
      } else {
        setCode(getNextComposicaoCode());
        setDescription('');
        setUnit('m²');
        setType('Estrutura');
        setBase('Própria');
        setStatus('active');
        setNotes('');
        setItems([]);
      }
    }
  }, [open, composicaoToEdit]);

  // Cálculos dinâmicos da composição
  const { costMaterial, costLabor, costEquipment, costOther, costTotal } = useMemo(() => {
    let mat = 0;
    let lab = 0;
    let eq = 0;
    let oth = 0;

    items.forEach((item) => {
      const tot = (item.coefficient || 0) * (item.unitCost || 0);
      if (item.group === 'material') mat += tot;
      else if (item.group === 'labor') lab += tot;
      else if (item.group === 'equipment') eq += tot;
      else oth += tot;
    });

    return {
      costMaterial: mat,
      costLabor: lab,
      costEquipment: eq,
      costOther: oth,
      costTotal: mat + lab + eq + oth,
    };
  }, [items]);

  // Adicionar insumo do catálogo à composição
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

    setItems((prev) => [...prev, newItem]);
    setIsInsumoPickerOpen(false);
    toast.success(`Insumo "${insumo.description}" adicionado à composição!`);
  };

  const handleUpdateItemCoefficient = (itemId: string, coefStr: string) => {
    const val = parseFloat(coefStr.replace(',', '.')) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            coefficient: val,
            totalCost: val * item.unitCost,
          };
        }
        return item;
      })
    );
  };

  const handleUpdateItemUnitCost = (itemId: string, costStr: string) => {
    const val = parseFloat(costStr.replace(/\./g, '').replace(',', '.')) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            unitCost: val,
            totalCost: item.coefficient * val,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

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
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-card border rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold text-foreground/90">
                {composicaoToEdit ? 'Editar Composição (CPU)' : 'Nova Composição de Preço Unitário'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-md bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all shadow-sm"
              title="Voltar / Fechar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
            {/* Informações Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Código: <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CPU-001"
                  className="h-10 rounded-xl font-mono text-sm"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Descrição do Serviço: <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Alvenaria de Vedação com Bloco Cerâmico 9x19x19cm"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Unidade: <span className="text-destructive">*</span>
                </Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-10 rounded-xl">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Disciplina / Tipo:
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10 rounded-xl">
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

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Base de Dados:
                </Label>
                <Select value={base} onValueChange={setBase}>
                  <SelectTrigger className="h-10 rounded-xl">
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

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground block">
                  Status:
                </Label>
                <div className="h-10 flex border rounded-xl overflow-hidden p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    className={`flex-1 text-xs font-bold rounded-lg transition-all ${
                      status === 'active'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('inactive')}
                    className={`flex-1 text-xs font-bold rounded-lg transition-all ${
                      status === 'inactive'
                        ? 'bg-slate-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Inativo
                  </button>
                </div>
              </div>
            </div>

            {/* Insumos que compõem o serviço */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Insumos da Composição ({items.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Materiais, mão de obra e equipamentos necessários para 1 {unit} do serviço.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsInsumoPickerOpen(true)}
                  className="rounded-xl gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Insumo do Catálogo
                </Button>
              </div>

              {/* Tabela de Insumos */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-semibold">Código</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Insumo / Descrição</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Grupo</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Und</th>
                      <th className="py-2.5 px-3 text-right font-semibold w-24">Coeficiente</th>
                      <th className="py-2.5 px-3 text-right font-semibold w-28">Custo Unit.</th>
                      <th className="py-2.5 px-3 text-right font-semibold w-28">Total</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          Nenhum insumo adicionado a esta composição ainda. Clique no botão acima para adicionar.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground">
                            {item.code}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {item.description}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                                INSUMO_GRUPO_COLORS[item.group]
                              }`}
                            >
                              {INSUMO_GRUPO_LABELS[item.group]}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center text-muted-foreground font-mono">
                            {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.001"
                              value={item.coefficient}
                              onChange={(e) =>
                                handleUpdateItemCoefficient(item.id, e.target.value)
                              }
                              className="h-8 w-20 text-right font-mono text-xs ml-auto"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) =>
                                handleUpdateItemUnitCost(item.id, e.target.value)
                              }
                              className="h-8 w-24 text-right font-mono text-xs ml-auto"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-foreground font-mono">
                            {formatCurrency(item.totalCost)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
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

              {/* Resumo de Custos do Serviço */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-3 rounded-xl border bg-card">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Material
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {formatCurrency(costMaterial)}
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-card">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Mão de Obra
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(costLabor)}
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-card">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Equipamento
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    {formatCurrency(costEquipment)}
                  </span>
                </div>
                <div className="p-3 rounded-xl border bg-primary/10 border-primary/20">
                  <span className="text-[10px] uppercase font-bold text-primary block">
                    Custo Unitário Total
                  </span>
                  <span className="text-base font-extrabold text-primary">
                    {formatCurrency(costTotal)} <span className="text-xs font-normal">/ {unit}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Observações / Critério de Medição:
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes sobre a execução do serviço, traço, perdas estimadas..."
                className="min-h-[70px] rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 px-5 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="rounded-xl h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Salvar Composição
            </Button>
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
                <SelectTrigger className="w-36 h-10 rounded-xl">
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

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredInsumos.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum insumo encontrado no catálogo com esses filtros.
                </div>
              ) : (
                filteredInsumos.map((insumo) => (
                  <div
                    key={insumo.id}
                    onClick={() => handleAddInsumoFromCatalog(insumo)}
                    className="p-3 rounded-xl border bg-card hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          #{insumo.code}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          {insumo.description}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-full border font-semibold ${
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
                    <div className="text-right">
                      <div className="font-bold text-sm text-primary">
                        {formatCurrency(insumo.unitCost)}
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-primary">
                        + Incluir
                      </Button>
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

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  Insumo,
  InsumoGrupo,
  InsumoStatus,
  InsumoFile,
  INSUMO_UNIDADES_PADRAO,
  INSUMO_TIPOS_PADRAO,
  INSUMO_BASES_PADRAO,
} from '@/types/catalog';
import { useCatalog } from '@/hooks/useCatalog';
import { useProjects } from '@/hooks/useProjects';
import {
  ArrowLeft,
  Upload,
  Check,
  Package,
  X,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Info,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface InsumoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumoToEdit?: Insumo | null;
  onSuccess?: (savedInsumo: Insumo) => void;
}

export function InsumoFormModal({
  open,
  onOpenChange,
  insumoToEdit,
  onSuccess,
}: InsumoFormModalProps) {
  const { addInsumo, updateInsumo, getNextInsumoCode } = useCatalog();
  const { supplies, projects } = useProjects();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [group, setGroup] = useState<InsumoGrupo>('material');
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [unit, setUnit] = useState<string>('und');
  const [type, setType] = useState<string>('Estrutura');
  const [customType, setCustomType] = useState<string>('');
  const [base, setBase] = useState<string>('Própria');
  const [unitCost, setUnitCost] = useState<string>('0,00');
  const [status, setStatus] = useState<InsumoStatus>('active');
  const [notes, setNotes] = useState<string>('');
  const [files, setFiles] = useState<InsumoFile[]>([]);

  // Campos específicos de Mão de Obra
  const [salario, setSalario] = useState<string>('0,00');
  const [encargos, setEncargos] = useState<string>('0,00');
  const [beneficios, setBeneficios] = useState<string>('0,00');

  // Suprimentos picker modal
  const [isSupplyPickerOpen, setIsSupplyPickerOpen] = useState(false);
  const [supplySearch, setSupplySearch] = useState('');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Converter string de moeda/número para float
  const parseCost = (valStr: string): number => {
    if (!valStr) return 0;
    const cleaned = valStr
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Cálculo dinâmico em tempo real do custo da Mão de Obra
  const totalMaoDeObra = useMemo(() => {
    const s = parseCost(salario);
    const enc = parseCost(encargos);
    const b = parseCost(beneficios);
    const encVal = s * (enc / 100);
    return s + encVal + b;
  }, [salario, encargos, beneficios]);

  // Reset or populate form when opening
  useEffect(() => {
    if (open) {
      if (insumoToEdit) {
        setGroup(insumoToEdit.group);
        setCode(insumoToEdit.code);
        setDescription(insumoToEdit.description);
        setUnit(insumoToEdit.unit);
        if (INSUMO_TIPOS_PADRAO.includes(insumoToEdit.type)) {
          setType(insumoToEdit.type);
          setCustomType('');
        } else {
          setType('Outro');
          setCustomType(insumoToEdit.type);
        }
        setBase(insumoToEdit.base);
        setUnitCost(
          insumoToEdit.unitCost.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
        setStatus(insumoToEdit.status);
        setNotes(insumoToEdit.notes || '');
        setFiles(insumoToEdit.files || []);

        // Mão de Obra
        if (insumoToEdit.salario !== undefined) {
          setSalario(
            insumoToEdit.salario.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        } else if (insumoToEdit.group === 'labor') {
          setSalario(
            insumoToEdit.unitCost.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        } else {
          setSalario('0,00');
        }

        setEncargos(
          (insumoToEdit.encargosPercent || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );

        setBeneficios(
          (insumoToEdit.beneficios || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      } else {
        // Novo insumo
        setGroup('material');
        setCode(getNextInsumoCode());
        setDescription('');
        setUnit('und');
        setType('Estrutura');
        setCustomType('');
        setBase('Própria');
        setUnitCost('0,00');
        setStatus('active');
        setNotes('');
        setFiles([]);
        setSalario('0,00');
        setEncargos('0,00');
        setBeneficios('0,00');
      }
    }
  }, [open, insumoToEdit]);

  const handleGroupChange = (newGroup: InsumoGrupo) => {
    setGroup(newGroup);
    if (newGroup === 'labor') {
      if (unit === 'und' || unit === 'sc' || unit === 'm³') {
        setUnit('h'); // Hora como unidade padrão comum de mão de obra
      }
    }
  };

  // Upload de arquivos / fotos
  const handleFileUpload = (uploadedFiles: FileList | null) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');

      reader.onload = () => {
        const newFile: InsumoFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: isImg ? (reader.result as string) : undefined,
          createdAt: new Date().toISOString(),
        };
        setFiles((prev) => [...prev, newFile]);
      };

      if (isImg) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
        const newFile: InsumoFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          createdAt: new Date().toISOString(),
        };
        setFiles((prev) => [...prev, newFile]);
      }
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Puxar item de suprimentos
  const filteredSupplies = supplies.filter((s) => {
    const query = supplySearch.toLowerCase();
    const pkgName = s.name.toLowerCase();
    const supplier = (s.supplier || '').toLowerCase();
    const proj = projects.find((p) => p.id === s.projectId);
    const projName = (proj?.name || '').toLowerCase();
    return pkgName.includes(query) || supplier.includes(query) || projName.includes(query);
  });

  const handleSelectSupply = (pkg: any) => {
    setDescription(pkg.name);
    if (pkg.quantitative) {
      const qLower = pkg.quantitative.toLowerCase();
      if (qLower.includes('m2') || qLower.includes('m²')) setUnit('m²');
      else if (qLower.includes('m3') || qLower.includes('m³')) setUnit('m³');
      else if (qLower.includes('sc') || qLower.includes('saco')) setUnit('sc');
      else if (qLower.includes('kg')) setUnit('kg');
      else if (qLower.includes('und') || qLower.includes('un')) setUnit('und');
    }
    setGroup('material');
    if (pkg.estimatedValue && pkg.estimatedValue > 0) {
      setUnitCost(
        pkg.estimatedValue.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
    const proj = projects.find((p) => p.id === pkg.projectId);
    setNotes(
      (prev) =>
        prev +
        (prev ? '\n' : '') +
        `Importado de Suprimentos: ${pkg.name}${proj ? ` (Obra: ${proj.name})` : ''}`
    );
    setIsSupplyPickerOpen(false);
    toast.info(`Dados puxados do pacote "${pkg.name}"`);
  };

  // Salvar
  const handleSave = (insertNew: boolean = false) => {
    if (!description.trim()) {
      toast.error('Informe a descrição do insumo');
      return;
    }

    const finalType = type === 'Outro' ? customType.trim() || 'Geral' : type;

    let cost = parseCost(unitCost);
    let sal: number | undefined = undefined;
    let enc: number | undefined = undefined;
    let ben: number | undefined = undefined;

    if (group === 'labor') {
      sal = parseCost(salario);
      enc = parseCost(encargos);
      ben = parseCost(beneficios);
      cost = totalMaoDeObra;
    }

    const payload = {
      code: code.trim() || getNextInsumoCode(),
      group,
      description: description.trim(),
      unit,
      type: finalType,
      base,
      unitCost: cost,
      salario: sal,
      encargosPercent: enc,
      beneficios: ben,
      status,
      notes: notes.trim(),
      files,
    };

    let savedItem: Insumo;

    if (insumoToEdit) {
      updateInsumo(insumoToEdit.id, payload);
      savedItem = { ...insumoToEdit, ...payload };
    } else {
      savedItem = addInsumo(payload);
    }

    if (onSuccess) {
      onSuccess(savedItem);
    }

    if (insertNew) {
      setCode(getNextInsumoCode());
      setDescription('');
      setUnitCost('0,00');
      setSalario('0,00');
      setEncargos('0,00');
      setBeneficios('0,00');
      setNotes('');
      setFiles([]);
    } else {
      onOpenChange(false);
    }
  };

  const isLabor = group === 'labor';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-card border rounded-2xl shadow-2xl">
          {/* Header exatamente como o mockup com botão voltar laranja */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
            <h2 className="text-xl font-display font-semibold text-foreground/90">
              {insumoToEdit ? 'Editar Insumo' : 'Cadastro de Insumos'}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-md bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all shadow-sm"
              title="Voltar / Fechar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            {/* Campo: Grupo (Select com opções Material, Mão de Obra, Equipamento, Outros) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Grupo:
              </Label>
              <Select
                value={group}
                onValueChange={(v) => handleGroupChange(v as InsumoGrupo)}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-border">
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="labor">Mão de Obra</SelectItem>
                  <SelectItem value="equipment">Equipamento</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* LAYOUT MÃO DE OBRA (CONFORME MOCKUP MEDIA_1791395967417.PNG) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {isLabor ? (
              <>
                {/* Linha 1 (Mão de Obra): Código + Descrição */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Código: <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="2433"
                      className="h-10 rounded-xl bg-background border-blue-400/60 focus:border-blue-600 font-mono text-sm"
                    />
                  </div>

                  <div className="md:col-span-9 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        Descrição: <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setIsSupplyPickerOpen(true)}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 hover:underline transition-all"
                      >
                        <Package className="w-3 h-3" />
                        Puxar de Suprimentos
                      </button>
                    </div>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Pedreiro com Encargos Trabalhistas"
                      className="h-10 rounded-xl bg-background border-border"
                    />
                  </div>
                </div>

                {/* Linha 2 (Mão de Obra): Unidade + Tipo + Base + Status */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Unidade */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Unidade: <span className="text-destructive">*</span>
                    </Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
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

                  {/* Tipo */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Tipo:
                    </Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                        {INSUMO_TIPOS_PADRAO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                        <SelectItem value="Outro">+ Outro (digitar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {type === 'Outro' && (
                      <Input
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Digite a disciplina/tipo"
                        className="h-9 mt-1 rounded-lg text-xs"
                      />
                    )}
                  </div>

                  {/* Base */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Base:
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={base} onValueChange={setBase}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
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

                  {/* Status */}
                  <div className="md:col-span-3 space-y-1.5">
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

                {/* Linha 3 (Mão de Obra): Salário + Encargos + Benefícios + Total */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                  {/* Salário */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Salário:
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                        R$
                      </span>
                      <Input
                        value={salario}
                        onChange={(e) => setSalario(e.target.value)}
                        placeholder="0,00"
                        className="h-10 pl-8 rounded-xl bg-background border-border text-right font-medium"
                      />
                    </div>
                  </div>

                  {/* Encargos */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Encargos:
                    </Label>
                    <div className="relative">
                      <Input
                        value={encargos}
                        onChange={(e) => setEncargos(e.target.value)}
                        placeholder="0,00"
                        className="h-10 pr-8 rounded-xl bg-background border-border text-right font-medium"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Benefícios */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Benefícios:
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                        R$
                      </span>
                      <Input
                        value={beneficios}
                        onChange={(e) => setBeneficios(e.target.value)}
                        placeholder="0,00"
                        className="h-10 pl-8 rounded-xl bg-background border-border text-right font-medium"
                      />
                    </div>
                  </div>

                  {/* Total (Calculado automaticamente e desabilitado com fundo cinza) */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Total:
                    </Label>
                    <div className="h-10 px-3 rounded-xl bg-muted/90 border border-border flex items-center justify-end font-bold text-foreground text-sm font-mono">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalMaoDeObra)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ═══════════════════════════════════════════════════════════════ */
              /* LAYOUT PADRÃO (MATERIAL, EQUIPAMENTO, OUTROS)                  */
              /* ═══════════════════════════════════════════════════════════════ */
              <>
                {/* Linha 1: Código, Descrição, Unidade */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Código */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Código: <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="2433"
                      className="h-10 rounded-xl bg-background border-blue-400/60 focus:border-blue-600 font-mono text-sm"
                    />
                  </div>

                  {/* Descrição */}
                  <div className="md:col-span-6 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        Descrição: <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setIsSupplyPickerOpen(true)}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 hover:underline transition-all"
                      >
                        <Package className="w-3 h-3" />
                        Puxar de Suprimentos
                      </button>
                    </div>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Saco de Cimento Poty - 50 Kg"
                      className="h-10 rounded-xl bg-background border-border"
                    />
                  </div>

                  {/* Unidade */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Unidade: <span className="text-destructive">*</span>
                    </Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
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

                {/* Linha 2: Tipo, Base, Custo, Status */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Tipo */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Tipo:
                    </Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                        {INSUMO_TIPOS_PADRAO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                        <SelectItem value="Outro">+ Outro (digitar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {type === 'Outro' && (
                      <Input
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Digite a disciplina/tipo"
                        className="h-9 mt-1 rounded-lg text-xs"
                      />
                    )}
                  </div>

                  {/* Base */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      Base:
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={base} onValueChange={setBase}>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border">
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

                  {/* Custo */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Custo:
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                        R$
                      </span>
                      <Input
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        placeholder="0,00"
                        className="h-10 pl-8 rounded-xl bg-background border-border text-right font-medium"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-3 space-y-1.5">
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
              </>
            )}

            {/* Linha: Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Observações:
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Insira links, especificações técnicas, normas trabalhistas ou informes sobre este insumo..."
                className="min-h-[75px] rounded-xl bg-background border-border text-sm"
              />
            </div>

            {/* Linha: Arquivos / Fotos do produto */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Arquivos:
              </Label>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 bg-background/50 hover:bg-muted/20'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  <Upload className="w-5 h-5 text-muted-foreground/70" />
                  <span className="text-xs font-medium">
                    Clique ou arraste aqui para inserir foto ou arquivo do insumo
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    PNG, JPG, PDF ou documentos até 10MB
                  </span>
                </div>
              </div>

              {/* Lista de arquivos anexados */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="group relative flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border bg-card text-xs shadow-sm max-w-[200px]"
                    >
                      {file.dataUrl ? (
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="w-8 h-8 rounded object-cover border"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-primary shrink-0" />
                      )}
                      <span className="truncate text-[11px] font-medium" title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(file.id);
                        }}
                        className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors ml-auto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer com botões verdes estilizados como no mockup */}
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t bg-muted/20">
            {!insumoToEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSave(true)}
                className="h-10 px-5 rounded-xl border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salvar e inserir novo
              </Button>
            )}

            <Button
              type="button"
              onClick={() => handleSave(false)}
              className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Puxar Itens de Suprimentos */}
      <Dialog open={isSupplyPickerOpen} onOpenChange={setIsSupplyPickerOpen}>
        <DialogContent className="max-w-2xl w-full p-6 rounded-2xl bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Package className="w-5 h-5 text-primary" />
              Puxar Insumo dos Suprimentos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={supplySearch}
                onChange={(e) => setSupplySearch(e.target.value)}
                placeholder="Buscar pacote de suprimentos ou fornecedor..."
                className="pl-9 h-10 rounded-xl"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredSupplies.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum pacote de suprimentos encontrado.
                </div>
              ) : (
                filteredSupplies.map((pkg) => {
                  const proj = projects.find((p) => p.id === pkg.projectId);
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => handleSelectSupply(pkg)}
                      className="p-3 rounded-xl border bg-card hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-foreground">
                          {pkg.name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {proj && <span>Obra: {proj.name}</span>}
                          {pkg.supplier && <span>• Forn: {pkg.supplier}</span>}
                          {pkg.quantitative && (
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                              {pkg.quantitative}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="rounded-lg text-primary text-xs font-bold">
                        Selecionar
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

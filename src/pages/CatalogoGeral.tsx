import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '@/hooks/useCatalog';
import {
  Insumo,
  Composicao,
  InsumoGrupo,
  INSUMO_GRUPO_LABELS,
  INSUMO_GRUPO_COLORS,
  INSUMO_TIPOS_PADRAO,
  INSUMO_BASES_PADRAO,
} from '@/types/catalog';
import { InsumoFormModal } from '@/components/catalogo/InsumoFormModal';
import { ComposicaoFormModal } from '@/components/catalogo/ComposicaoFormModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Layers,
  FolderTree,
  Folder,
  Package,
  Wrench,
  Users,
  HardHat,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default function CatalogoGeral() {
  const navigate = useNavigate();
  const {
    insumos,
    composicoes,
    deleteInsumo,
    deleteComposicao,
    addComposicao,
  } = useCatalog();

  // Abas principais: "insumos" ou "composicoes"
  const [activeTab, setActiveTab] = useState<'insumos' | 'composicoes'>('insumos');

  // Modais de formulário
  const [isInsumoModalOpen, setIsInsumoModalOpen] = useState(false);
  const [insumoToEdit, setInsumoToEdit] = useState<Insumo | null>(null);

  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compToEdit, setCompToEdit] = useState<Composicao | null>(null);

  // Modal para visualização ampliada de foto
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Composição expandida na tabela
  const [expandedCompId, setExpandedCompId] = useState<string | null>(null);

  // Filtros - Insumos
  const [searchInsumo, setSearchInsumo] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBase, setFilterBase] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filtros - Composições
  const [searchComp, setSearchComp] = useState('');
  const [filterCompType, setFilterCompType] = useState<string>('all');
  const [filterCompBase, setFilterCompBase] = useState<string>('all');

  // Métricas
  const metrics = useMemo(() => {
    const totalInsumos = insumos.length;
    const materials = insumos.filter((i) => i.group === 'material').length;
    const labor = insumos.filter((i) => i.group === 'labor').length;
    const equipment = insumos.filter((i) => i.group === 'equipment').length;
    const other = insumos.filter((i) => i.group === 'other').length;
    const totalComps = composicoes.length;
    const activeInsumos = insumos.filter((i) => i.status === 'active').length;

    return {
      totalInsumos,
      materials,
      labor,
      equipment,
      other,
      totalComps,
      activeInsumos,
    };
  }, [insumos, composicoes]);

  // Lista filtrada de insumos
  const filteredInsumos = useMemo(() => {
    return insumos.filter((item) => {
      const matchSearch =
        item.description.toLowerCase().includes(searchInsumo.toLowerCase()) ||
        item.code.toLowerCase().includes(searchInsumo.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchInsumo.toLowerCase());

      const matchGroup = filterGroup === 'all' || item.group === filterGroup;
      const matchType = filterType === 'all' || item.type === filterType;
      const matchBase = filterBase === 'all' || item.base === filterBase;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;

      return matchSearch && matchGroup && matchType && matchBase && matchStatus;
    });
  }, [insumos, searchInsumo, filterGroup, filterType, filterBase, filterStatus]);

  // Lista filtrada de composições
  const filteredComposicoes = useMemo(() => {
    return composicoes.filter((comp) => {
      const matchSearch =
        comp.description.toLowerCase().includes(searchComp.toLowerCase()) ||
        comp.code.toLowerCase().includes(searchComp.toLowerCase());

      const matchType = filterCompType === 'all' || comp.type === filterCompType;
      const matchBase = filterCompBase === 'all' || comp.base === filterCompBase;

      return matchSearch && matchType && matchBase;
    });
  }, [composicoes, searchComp, filterCompType, filterCompBase]);

  const handleEditInsumo = (item: Insumo) => {
    setInsumoToEdit(item);
    setIsInsumoModalOpen(true);
  };

  const handleNewInsumo = () => {
    setInsumoToEdit(null);
    setIsInsumoModalOpen(true);
  };

  const handleDeleteInsumo = (item: Insumo) => {
    if (confirm(`Tem certeza que deseja remover o insumo #${item.code} - ${item.description}?`)) {
      deleteInsumo(item.id);
    }
  };

  const handleEditComp = (comp: Composicao) => {
    setCompToEdit(comp);
    setIsCompModalOpen(true);
  };

  const handleNewComp = () => {
    setCompToEdit(null);
    setIsCompModalOpen(true);
  };

  const handleDuplicateComp = (comp: Composicao) => {
    const copy: Omit<Composicao, 'id' | 'createdAt' | 'updatedAt'> = {
      ...comp,
      code: `${comp.code}-COPIA`,
      description: `${comp.description} (Cópia)`,
    };
    addComposicao(copy);
    toast.success('Composição duplicada com sucesso!');
  };

  const handleDeleteComp = (comp: Composicao) => {
    if (confirm(`Tem certeza que deseja remover a composição ${comp.code} - ${comp.description}?`)) {
      deleteComposicao(comp.id);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* ── BARRA SUPERIOR ── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="rounded-xl gap-2 font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Início</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-display font-black text-foreground tracking-tight leading-none">
                  Catálogo da Construtora
                </h1>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                  Insumos e Composições de Preço Unitário
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/orcamento')}
              className="rounded-xl text-xs font-bold gap-1.5 hidden md:flex"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              Ir para Orçamentos
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* CARDS DE RESUMO DAS PASTAS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab('insumos')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              activeTab === 'insumos'
                ? 'bg-primary/5 border-primary ring-2 ring-primary/20'
                : 'bg-card hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total de Insumos
              </span>
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black font-display text-foreground">
              {metrics.totalInsumos}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
              <span>{metrics.materials} mat</span>
              <span>•</span>
              <span>{metrics.labor} m.o</span>
              <span>•</span>
              <span>{metrics.equipment} eq</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('composicoes')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              activeTab === 'composicoes'
                ? 'bg-primary/5 border-primary ring-2 ring-primary/20'
                : 'bg-card hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Composições (CPU)
              </span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black font-display text-foreground">
              {metrics.totalComps}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Serviços padronizados com coeficientes
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Itens Ativos
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black font-display text-emerald-600">
              {metrics.activeInsumos}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Disponíveis para uso imediato em orçamentos
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Ação Rápida
              </span>
              <Plus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleNewInsumo}
                className="flex-1 rounded-xl h-9 text-xs font-bold bg-primary text-white gap-1 shadow-sm"
              >
                + Insumo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNewComp}
                className="flex-1 rounded-xl h-9 text-xs font-bold gap-1"
              >
                + CPU
              </Button>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE AS PASTAS DO CATÁLOGO */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'insumos' | 'composicoes')}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-3">
            <TabsList className="h-11 rounded-xl p-1 bg-muted/60">
              <TabsTrigger
                value="insumos"
                className="rounded-lg text-xs sm:text-sm font-bold gap-2 px-4"
              >
                <Folder className="w-4 h-4 text-blue-500" />
                Pasta de Insumos ({insumos.length})
              </TabsTrigger>
              <TabsTrigger
                value="composicoes"
                className="rounded-lg text-xs sm:text-sm font-bold gap-2 px-4"
              >
                <Layers className="w-4 h-4 text-purple-500" />
                Pasta de Composições ({composicoes.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {activeTab === 'insumos' ? (
                <Button
                  onClick={handleNewInsumo}
                  className="rounded-xl h-10 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Novo Insumo
                </Button>
              ) : (
                <Button
                  onClick={handleNewComp}
                  className="rounded-xl h-10 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nova Composição
                </Button>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ABA / PASTA DE INSUMOS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="insumos" className="space-y-4 pt-1">
            {/* Barra de Filtros */}
            <div className="bg-card p-4 rounded-2xl border shadow-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Busca */}
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={searchInsumo}
                    onChange={(e) => setSearchInsumo(e.target.value)}
                    placeholder="Buscar por descrição, código ou notas..."
                    className="pl-9 h-10 rounded-xl bg-background"
                  />
                </div>

                {/* Filtro Grupo */}
                <div className="md:col-span-2">
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="h-10 rounded-xl bg-background">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="all">Todos os Grupos</SelectItem>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="labor">Mão de Obra</SelectItem>
                      <SelectItem value="equipment">Equipamento</SelectItem>
                      <SelectItem value="other">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Tipo / Disciplina */}
                <div className="md:col-span-3">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-10 rounded-xl bg-background">
                      <SelectValue placeholder="Disciplina / Tipo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                      <SelectItem value="all">Todas as Disciplinas</SelectItem>
                      {INSUMO_TIPOS_PADRAO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Base */}
                <div className="md:col-span-2">
                  <Select value={filterBase} onValueChange={setFilterBase}>
                    <SelectTrigger className="h-10 rounded-xl bg-background">
                      <SelectValue placeholder="Base" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="all">Todas as Bases</SelectItem>
                      {INSUMO_BASES_PADRAO.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Badges de filtros ativos & contador */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>
                  Mostrando <strong>{filteredInsumos.length}</strong> de {insumos.length} insumos
                </span>
                {(searchInsumo || filterGroup !== 'all' || filterType !== 'all' || filterBase !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchInsumo('');
                      setFilterGroup('all');
                      setFilterType('all');
                      setFilterBase('all');
                    }}
                    className="text-primary hover:underline font-semibold"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de Insumos */}
            <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground">
                    <tr>
                      <th className="py-3 px-3 text-left font-bold w-12 text-center">Foto</th>
                      <th className="py-3 px-3 text-left font-bold w-20">Código</th>
                      <th className="py-3 px-3 text-left font-bold">Descrição do Insumo</th>
                      <th className="py-3 px-2 text-center font-bold w-24">Grupo</th>
                      <th className="py-3 px-2 text-center font-bold w-28">Tipo / Disciplina</th>
                      <th className="py-3 px-2 text-center font-bold w-20">Base</th>
                      <th className="py-3 px-2 text-center font-bold w-14">Und</th>
                      <th className="py-3 px-3 text-right font-bold w-28">Custo Unitário</th>
                      <th className="py-3 px-2 text-center font-bold w-20">Status</th>
                      <th className="py-3 px-3 text-center font-bold w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInsumos.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold text-sm">Nenhum insumo encontrado</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Clique em "+ Novo Insumo" para cadastrar seu primeiro item.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredInsumos.map((item) => {
                        const firstImg = item.files?.find((f) => f.dataUrl);

                        return (
                          <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                            {/* Foto / Miniatura */}
                            <td className="py-2.5 px-3 text-center">
                              {firstImg?.dataUrl ? (
                                <img
                                  src={firstImg.dataUrl}
                                  alt={item.description}
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: firstImg.dataUrl!,
                                      title: item.description,
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg object-cover border cursor-pointer hover:scale-110 transition-transform mx-auto shadow-sm"
                                  title="Clique para ampliar foto"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground/50 mx-auto">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                              )}
                            </td>

                            {/* Código */}
                            <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                              #{item.code}
                            </td>

                            {/* Descrição */}
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground text-sm">
                                {item.description}
                              </div>
                              {item.notes && (
                                <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 flex items-center gap-1">
                                  <span>{item.notes}</span>
                                </div>
                              )}
                            </td>

                            {/* Grupo */}
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                                  INSUMO_GRUPO_COLORS[item.group]
                                }`}
                              >
                                {INSUMO_GRUPO_LABELS[item.group]}
                              </span>
                            </td>

                            {/* Tipo / Disciplina */}
                            <td className="py-2.5 px-2 text-center text-muted-foreground font-medium">
                              {item.type}
                            </td>

                            {/* Base */}
                            <td className="py-2.5 px-2 text-center">
                              <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {item.base}
                              </span>
                            </td>

                            {/* Unidade */}
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-muted-foreground">
                              {item.unit}
                            </td>

                            {/* Custo Unitário */}
                            <td className="py-2.5 px-3 text-right font-mono text-sm">
                              <span className="font-bold text-foreground">
                                {formatCurrency(item.unitCost)}
                              </span>
                              {item.group === 'labor' && item.salario !== undefined && item.salario > 0 && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  Sal: {formatCurrency(item.salario)}
                                  {item.encargosPercent ? ` + ${item.encargosPercent}% enc.` : ''}
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  item.status === 'active'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                                    : 'bg-slate-500/15 text-slate-600'
                                }`}
                              >
                                {item.status === 'active' ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>

                            {/* Ações */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditInsumo(item)}
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-primary"
                                  title="Editar Insumo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteInsumo(item)}
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                                  title="Remover Insumo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ABA / PASTA DE COMPOSIÇÕES (CPU) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="composicoes" className="space-y-4 pt-1">
            {/* Barra de Filtros */}
            <div className="bg-card p-4 rounded-2xl border shadow-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-6 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={searchComp}
                    onChange={(e) => setSearchComp(e.target.value)}
                    placeholder="Buscar composição por código ou nome do serviço..."
                    className="pl-9 h-10 rounded-xl bg-background"
                  />
                </div>

                <div className="md:col-span-3">
                  <Select value={filterCompType} onValueChange={setFilterCompType}>
                    <SelectTrigger className="h-10 rounded-xl bg-background">
                      <SelectValue placeholder="Disciplina / Tipo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-popover border shadow-lg z-50">
                      <SelectItem value="all">Todas as Disciplinas</SelectItem>
                      {INSUMO_TIPOS_PADRAO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-3">
                  <Select value={filterCompBase} onValueChange={setFilterCompBase}>
                    <SelectTrigger className="h-10 rounded-xl bg-background">
                      <SelectValue placeholder="Base" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="all">Todas as Bases</SelectItem>
                      {INSUMO_BASES_PADRAO.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>
                  Mostrando <strong>{filteredComposicoes.length}</strong> de {composicoes.length} composições
                </span>
                {(searchComp || filterCompType !== 'all' || filterCompBase !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchComp('');
                      setFilterCompType('all');
                      setFilterCompBase('all');
                    }}
                    className="text-primary hover:underline font-semibold"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Lista / Tabela de Composições */}
            <div className="space-y-3">
              {filteredComposicoes.length === 0 ? (
                <div className="bg-card rounded-2xl border p-12 text-center text-muted-foreground shadow-sm">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-600" />
                  <p className="font-semibold text-sm">Nenhuma composição encontrada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clique em "+ Nova Composição" para criar sua primeira CPU com insumos vinculados.
                  </p>
                </div>
              ) : (
                filteredComposicoes.map((comp) => {
                  const isExpanded = expandedCompId === comp.id;

                  return (
                    <div
                      key={comp.id}
                      className="bg-card rounded-2xl border shadow-sm overflow-hidden transition-all hover:border-border/80"
                    >
                      {/* Linha principal da composição */}
                      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-lg border border-purple-500/20">
                              {comp.code}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                              • {comp.type}
                            </span>
                            <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              {comp.base}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                comp.status === 'active'
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                                  : 'bg-slate-500/15 text-slate-600'
                              }`}
                            >
                              {comp.status === 'active' ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-foreground">
                            {comp.description}
                          </h3>

                          {comp.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {comp.notes}
                            </p>
                          )}
                        </div>

                        {/* Custos da composição */}
                        <div className="flex items-center gap-4 sm:gap-6 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              Material: <strong>{formatCurrency(comp.costMaterial)}</strong>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Mão de Obra: <strong>{formatCurrency(comp.costLabor)}</strong>
                            </div>
                          </div>

                          <div className="text-right pl-4 border-l">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              Total / {comp.unit}
                            </span>
                            <span className="text-lg font-black font-display text-primary">
                              {formatCurrency(comp.costTotal)}
                            </span>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 pl-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedCompId(isExpanded ? null : comp.id)
                              }
                              className="h-8 px-2 text-xs font-semibold gap-1 rounded-xl text-primary"
                            >
                              {comp.items?.length || 0} itens
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicateComp(comp)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-primary"
                              title="Duplicar Composição"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditComp(comp)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-primary"
                              title="Editar Composição"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteComp(comp)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive"
                              title="Remover Composição"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Tabela expandida com os insumos da composição */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-4">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Detalhamento dos Insumos da Composição:
                          </h4>
                          <div className="border rounded-xl bg-card overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/60 border-b text-muted-foreground">
                                <tr>
                                  <th className="py-2 px-3 text-left font-bold">Código</th>
                                  <th className="py-2 px-3 text-left font-bold">Insumo</th>
                                  <th className="py-2 px-2 text-center font-bold">Grupo</th>
                                  <th className="py-2 px-2 text-center font-bold">Und</th>
                                  <th className="py-2 px-3 text-right font-bold">Coeficiente</th>
                                  <th className="py-2 px-3 text-right font-bold">Custo Unit.</th>
                                  <th className="py-2 px-3 text-right font-bold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {comp.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-muted/10">
                                    <td className="py-2 px-3 font-mono text-muted-foreground">
                                      #{item.code}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-foreground">
                                      {item.description}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <span
                                        className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                                          INSUMO_GRUPO_COLORS[item.group]
                                        }`}
                                      >
                                        {INSUMO_GRUPO_LABELS[item.group]}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                                      {item.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                      {item.coefficient}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                      {formatCurrency(item.unitCost)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                      {formatCurrency(item.totalCost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modais de Edição/Criação */}
      <InsumoFormModal
        open={isInsumoModalOpen}
        onOpenChange={setIsInsumoModalOpen}
        insumoToEdit={insumoToEdit}
      />

      <ComposicaoFormModal
        open={isCompModalOpen}
        onOpenChange={setIsCompModalOpen}
        composicaoToEdit={compToEdit}
      />

      {/* Modal de Preview de Foto */}
      <Dialog
        open={!!previewPhoto}
        onOpenChange={(open) => !open && setPreviewPhoto(null)}
      >
        <DialogContent className="max-w-lg p-4 rounded-2xl bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold truncate">
              {previewPhoto?.title}
            </DialogTitle>
          </DialogHeader>
          {previewPhoto?.url && (
            <div className="pt-2">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="w-full max-h-[70vh] object-contain rounded-xl border bg-black/5"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

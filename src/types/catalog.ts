export type InsumoGrupo = 'material' | 'labor' | 'equipment' | 'other';

export const INSUMO_GRUPO_LABELS: Record<InsumoGrupo, string> = {
  material: 'Material',
  labor: 'Mão de Obra',
  equipment: 'Equipamento',
  other: 'Outros',
};

export const INSUMO_GRUPO_COLORS: Record<InsumoGrupo, string> = {
  material: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',
  labor: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  equipment: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  other: 'bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400',
};

export type InsumoStatus = 'active' | 'inactive';

export interface InsumoFile {
  id: string;
  name: string;
  size?: number;
  type?: string;
  dataUrl?: string; // Base64 para visualização de imagem
  url?: string;
  createdAt: string;
}

export interface Insumo {
  id: string;
  code: string; // Numeração crescente configurável/editável (ex: "2433", "001")
  group: InsumoGrupo;
  description: string; // Nome do item (ex: "Saco de Cimento Poty - 50 Kg")
  unit: string; // m², m³, und, km, ml, l, kg, h, etc.
  type: string; // Tipo/Disciplina: estrutura, marcenaria, instalações hidráulicas, etc.
  base: string; // Base própria ou tabela SINAPI/SEINFRA/SICRO/ORSE
  unitCost: number; // Custo unitário R$ (ou total calculado da mão de obra)
  salario?: number; // Salário base R$ (para Mão de Obra)
  encargosPercent?: number; // Percentual de encargos trabalhistas (%)
  beneficios?: number; // Benefícios adicionais R$
  status: InsumoStatus; // Ativo ou Inativo
  notes?: string; // Observações, links ou informe
  files?: InsumoFile[]; // Fotos do produto ou anexos
  sourceSupplyPackageId?: string; // Vinculação opcional com pacote de suprimentos
  createdAt: string;
  updatedAt: string;
}

export interface ComposicaoItem {
  id: string;
  insumoId?: string;
  code: string;
  description: string;
  group: InsumoGrupo;
  unit: string;
  coefficient: number; // Coeficiente / consumo unitário
  unitCost: number;
  totalCost: number; // coefficient * unitCost
}

export interface Composicao {
  id: string;
  code: string; // ex: "CPU-001" ou código SINAPI/SEINFRA
  description: string; // Nome do serviço (ex: "Alvenaria de vedação com bloco cerâmico")
  unit: string; // ex: "m²", "m³", "und"
  type: string; // Disciplina: Estrutura, Alvenaria, Pintura, etc.
  base: string; // "Própria", "SINAPI", "SEINFRA", etc.
  status: InsumoStatus;
  items: ComposicaoItem[];
  costMaterial: number;
  costLabor: number;
  costEquipment: number;
  costOther: number;
  costTotal: number;
  detailedDescription?: string;
  bdi?: number;
  sellingPrice?: number;
  notes?: string;
  files?: InsumoFile[];
  createdAt: string;
  updatedAt: string;
}

export const INSUMO_UNIDADES_PADRAO = [
  'und',
  'm²',
  'm³',
  'kg',
  't',
  'l',
  'ml',
  'km',
  'm',
  'h',
  'cj',
  'sc',
  'par',
  'vb',
  'cento',
  'mil',
];

export const INSUMO_TIPOS_PADRAO = [
  'Estrutura',
  'Fundações',
  'Alvenaria e Vedação',
  'Instalações Hidráulicas',
  'Instalações Elétricas',
  'Marcenaria',
  'Serralheria e Esquadrias',
  'Pintura e Acabamento',
  'Revestimentos e Pisos',
  'Cobertura e Telhado',
  'Impermeabilização',
  'Movimento de Terra',
  'Serviços Preliminares',
  'Paisagismo e Lazer',
  'Vidraçaria',
  'Gesso e Drywall',
  'Geral / Administrativo',
];

export const INSUMO_BASES_PADRAO = [
  'Própria',
  'SINAPI',
  'SEINFRA',
  'SICRO',
  'ORSE',
  'FDE',
  'CPOS',
  'Cotação de Mercado',
];

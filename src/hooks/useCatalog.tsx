import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Insumo, Composicao, InsumoGrupo, InsumoStatus } from '@/types/catalog';
import { toast } from 'sonner';

interface CatalogContextType {
  insumos: Insumo[];
  composicoes: Composicao[];
  loading: boolean;
  addInsumo: (data: Omit<Insumo, 'id' | 'createdAt' | 'updatedAt'>) => Insumo;
  updateInsumo: (id: string, updates: Partial<Insumo>) => void;
  deleteInsumo: (id: string) => void;
  getNextInsumoCode: () => string;
  addComposicao: (data: Omit<Composicao, 'id' | 'createdAt' | 'updatedAt'>) => Composicao;
  updateComposicao: (id: string, updates: Partial<Composicao>) => void;
  deleteComposicao: (id: string) => void;
  getNextComposicaoCode: () => string;
  getInsumoById: (id: string) => Insumo | undefined;
  getComposicaoById: (id: string) => Composicao | undefined;
}

const INSUMOS_STORAGE_KEY = 'buddy_catalogo_insumos_v1';
const COMPOSICOES_STORAGE_KEY = 'buddy_catalogo_composicoes_v1';

const INITIAL_INSUMOS_SEED: Insumo[] = [
  {
    id: 'ins-1',
    code: '1001',
    group: 'material',
    description: 'Saco de Cimento Poty Todas as Obras - 50 Kg',
    unit: 'sc',
    type: 'Estrutura',
    base: 'Própria',
    unitCost: 38.50,
    status: 'active',
    notes: 'Cimento CP II-F-32 para concreto e argamassa em geral.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-2',
    code: '1002',
    group: 'material',
    description: 'Areia Média Lavada a Granel',
    unit: 'm³',
    type: 'Estrutura',
    base: 'Própria',
    unitCost: 85.00,
    status: 'active',
    notes: 'Fornecedor local com certificado de pureza.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-3',
    code: '1003',
    group: 'material',
    description: 'Pedra Britada nº 01 (19 mm)',
    unit: 'm³',
    type: 'Estrutura',
    base: 'Própria',
    unitCost: 92.00,
    status: 'active',
    notes: 'Brita basáltica para concreto usinado e armado.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-4',
    code: '1004',
    group: 'material',
    description: 'Aço CA-50 Nervurado 10.0 mm (3/8")',
    unit: 'kg',
    type: 'Estrutura',
    base: 'SINAPI',
    unitCost: 9.80,
    status: 'active',
    notes: 'Barras de 12 metros Gerdau / ArcelorMittal.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-5',
    code: '1005',
    group: 'material',
    description: 'Bloco Cerâmico de Vedação 9 x 19 x 19 cm (6 furos)',
    unit: 'und',
    type: 'Alvenaria e Vedação',
    base: 'Própria',
    unitCost: 1.45,
    status: 'active',
    notes: 'Tijolo cerâmico para alvenaria de vedação.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-6',
    code: '1006',
    group: 'labor',
    description: 'Pedreiro de Obra com Encargos Complementares',
    unit: 'h',
    type: 'Alvenaria e Vedação',
    base: 'SINAPI',
    unitCost: 26.50,
    status: 'active',
    notes: 'CBO 7152-10 - Incluso encargos sociais e trabalhistas.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-7',
    code: '1007',
    group: 'labor',
    description: 'Servente de Obras com Encargos Complementares',
    unit: 'h',
    type: 'Geral / Administrativo',
    base: 'SINAPI',
    unitCost: 21.20,
    status: 'active',
    notes: 'CBO 7170-20 - Apoio geral e transporte interno.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-8',
    code: '1008',
    group: 'labor',
    description: 'Carpinteiro de Fôrmas com Encargos',
    unit: 'h',
    type: 'Estrutura',
    base: 'SINAPI',
    unitCost: 26.50,
    status: 'active',
    notes: 'Montagem e desforma de elementos estruturais.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-9',
    code: '1009',
    group: 'equipment',
    description: 'Betoneira 400 Litros com Motor Elétrico Trifásico',
    unit: 'h',
    type: 'Estrutura',
    base: 'Própria',
    unitCost: 6.80,
    status: 'active',
    notes: 'Locação mensal convertida para hora produtiva.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-10',
    code: '1010',
    group: 'equipment',
    description: 'Vibrador de Imersão para Concreto com Mangote 38mm',
    unit: 'h',
    type: 'Estrutura',
    base: 'Própria',
    unitCost: 4.50,
    status: 'active',
    notes: 'Adensamento mecânico de concreto.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-11',
    code: '1011',
    group: 'material',
    description: 'Tubo de PVC Soldável 25 mm (3/4") para Água Fria',
    unit: 'm',
    type: 'Instalações Hidráulicas',
    base: 'Própria',
    unitCost: 5.90,
    status: 'active',
    notes: 'Barras de 6m Tigre ou Amanco.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ins-12',
    code: '1012',
    group: 'other',
    description: 'Caçamba Estacionária para Remoção de Entulho (5 m³)',
    unit: 'und',
    type: 'Serviços Preliminares',
    base: 'Própria',
    unitCost: 350.00,
    status: 'active',
    notes: 'Destinação ecológica e bota-fora legalizado.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_COMPOSICOES_SEED: Composicao[] = [
  {
    id: 'comp-1',
    code: 'CPU-001',
    description: 'Alvenaria de Vedação de Blocos Cerâmicos 9x19x19 cm, Argamassa Traço 1:2:8',
    unit: 'm²',
    type: 'Alvenaria e Vedação',
    base: 'Própria',
    status: 'active',
    costMaterial: 38.20,
    costLabor: 28.50,
    costEquipment: 0.00,
    costOther: 0.00,
    costTotal: 66.70,
    items: [
      { id: 'ci-1', code: '1005', description: 'Bloco Cerâmico de Vedação 9 x 19 x 19 cm', group: 'material', unit: 'und', coefficient: 26.0, unitCost: 1.45, totalCost: 37.70 },
      { id: 'ci-2', code: '1006', description: 'Pedreiro de Obra com Encargos', group: 'labor', unit: 'h', coefficient: 0.65, unitCost: 26.50, totalCost: 17.23 },
      { id: 'ci-3', code: '1007', description: 'Servente de Obras com Encargos', group: 'labor', unit: 'h', coefficient: 0.53, unitCost: 21.20, totalCost: 11.24 },
    ],
    notes: 'Junta de assentamento com espessura média de 1,5 cm.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comp-2',
    code: 'CPU-002',
    description: 'Concreto FCK 25 MPa Preparado em Obra para Fundações e Pilares',
    unit: 'm³',
    type: 'Estrutura',
    base: 'Própria',
    status: 'active',
    costMaterial: 378.00,
    costLabor: 95.40,
    costEquipment: 15.80,
    costOther: 0.00,
    costTotal: 489.20,
    items: [
      { id: 'ci-4', code: '1001', description: 'Saco de Cimento Poty 50 Kg', group: 'material', unit: 'sc', coefficient: 7.0, unitCost: 38.50, totalCost: 269.50 },
      { id: 'ci-5', code: '1002', description: 'Areia Média Lavada', group: 'material', unit: 'm³', coefficient: 0.65, unitCost: 85.00, totalCost: 55.25 },
      { id: 'ci-6', code: '1003', description: 'Pedra Britada nº 01', group: 'material', unit: 'm³', coefficient: 0.75, unitCost: 92.00, totalCost: 69.00 },
      { id: 'ci-7', code: '1006', description: 'Pedreiro de Obra com Encargos', group: 'labor', unit: 'h', coefficient: 1.80, unitCost: 26.50, totalCost: 47.70 },
      { id: 'ci-8', code: '1007', description: 'Servente de Obras com Encargos', group: 'labor', unit: 'h', coefficient: 2.25, unitCost: 21.20, totalCost: 47.70 },
      { id: 'ci-9', code: '1009', description: 'Betoneira 400L Elétrica', group: 'equipment', unit: 'h', coefficient: 1.50, unitCost: 6.80, totalCost: 10.20 },
      { id: 'ci-10', code: '1010', description: 'Vibrador de Imersão Mangote', group: 'equipment', unit: 'h', coefficient: 1.24, unitCost: 4.50, totalCost: 5.60 },
    ],
    notes: 'Traço em volume aproximado 1 : 2 : 2.5 com fator a/c controlado.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [insumos, setInsumos] = useState<Insumo[]>(() => {
    try {
      const saved = localStorage.getItem(INSUMOS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler insumos do localStorage:', e);
    }
    return INITIAL_INSUMOS_SEED;
  });

  const [composicoes, setComposicoes] = useState<Composicao[]>(() => {
    try {
      const saved = localStorage.getItem(COMPOSICOES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler composições do localStorage:', e);
    }
    return INITIAL_COMPOSICOES_SEED;
  });

  const [loading, setLoading] = useState(false);

  // Sincronizar Insumos
  useEffect(() => {
    try {
      localStorage.setItem(INSUMOS_STORAGE_KEY, JSON.stringify(insumos));
    } catch (e) {
      console.error('Erro ao salvar insumos no localStorage:', e);
    }
  }, [insumos]);

  // Sincronizar Composições
  useEffect(() => {
    try {
      localStorage.setItem(COMPOSICOES_STORAGE_KEY, JSON.stringify(composicoes));
    } catch (e) {
      console.error('Erro ao salvar composições no localStorage:', e);
    }
  }, [composicoes]);

  /**
   * Calcula o próximo código sequencial numérico para insumo.
   * Procura o maior número inteiro existente entre os códigos numéricos e soma 1.
   */
  const getNextInsumoCode = (): string => {
    let maxCode = 1000;
    insumos.forEach(item => {
      const num = parseInt(item.code.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCode) {
        maxCode = num;
      }
    });
    return String(maxCode + 1);
  };

  /**
   * Calcula o próximo código sequencial para composição (ex: CPU-003)
   */
  const getNextComposicaoCode = (): string => {
    let maxNum = 0;
    composicoes.forEach(c => {
      const match = c.code.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const next = maxNum + 1;
    return `CPU-${String(next).padStart(3, '0')}`;
  };

  const addInsumo = (data: Omit<Insumo, 'id' | 'createdAt' | 'updatedAt'>): Insumo => {
    const newInsumo: Insumo = {
      ...data,
      id: `ins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: data.code?.trim() || getNextInsumoCode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setInsumos(prev => [newInsumo, ...prev]);
    toast.success(`Insumo #${newInsumo.code} cadastrado com sucesso!`);
    return newInsumo;
  };

  const updateInsumo = (id: string, updates: Partial<Insumo>) => {
    setInsumos(prev =>
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      })
    );
    toast.success('Insumo atualizado com sucesso!');
  };

  const deleteInsumo = (id: string) => {
    setInsumos(prev => prev.filter(item => item.id !== id));
    toast.success('Insumo removido do catálogo!');
  };

  const getInsumoById = (id: string) => {
    return insumos.find(i => i.id === id);
  };

  const addComposicao = (data: Omit<Composicao, 'id' | 'createdAt' | 'updatedAt'>): Composicao => {
    const newComp: Composicao = {
      ...data,
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: data.code?.trim() || getNextComposicaoCode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setComposicoes(prev => [newComp, ...prev]);
    toast.success(`Composição ${newComp.code} cadastrada com sucesso!`);
    return newComp;
  };

  const updateComposicao = (id: string, updates: Partial<Composicao>) => {
    setComposicoes(prev =>
      prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      })
    );
    toast.success('Composição atualizada com sucesso!');
  };

  const deleteComposicao = (id: string) => {
    setComposicoes(prev => prev.filter(c => c.id !== id));
    toast.success('Composição removida do catálogo!');
  };

  const getComposicaoById = (id: string) => {
    return composicoes.find(c => c.id === id);
  };

  return (
    <CatalogContext.Provider
      value={{
        insumos,
        composicoes,
        loading,
        addInsumo,
        updateInsumo,
        deleteInsumo,
        getNextInsumoCode,
        addComposicao,
        updateComposicao,
        deleteComposicao,
        getNextComposicaoCode,
        getInsumoById,
        getComposicaoById,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog deve ser usado dentro de um CatalogProvider');
  }
  return context;
}

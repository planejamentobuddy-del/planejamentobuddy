import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  BudgetProject,
  BudgetStage,
  BudgetItem,
  BdiConfig,
  calculateBdiRate,
  AbcItem,
  DisbursementSchedule,
} from '@/types/budget';
import { SINAPI_DATABASE } from '@/data/sinapiDatabase';
import { toast } from 'sonner';

export interface StageSummary {
  stageId: string;
  code: string;
  title: string;
  directCost: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  sellingPrice: number;
  percentageOfTotal: number;
}

interface BudgetContextType {
  projects: BudgetProject[];
  activeProject: BudgetProject | null;
  setActiveProjectId: (id: string) => void;
  viewMode: 'cost' | 'selling';
  setViewMode: (mode: 'cost' | 'selling') => void;

  // Cálculos consolidados
  bdiRate: number;
  directCostTotal: number;
  materialCostTotal: number;
  laborCostTotal: number;
  equipmentCostTotal: number;
  sellingPriceTotal: number;
  costPerSquareMeter: number;
  sellingPerSquareMeter: number;
  stageSummaries: StageSummary[];
  abcAnalysis: AbcItem[];

  // Ações de Projetos
  createProject: (data: Partial<BudgetProject>) => BudgetProject;
  updateProject: (id: string, data: Partial<BudgetProject>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  getBudgetByProjectId: (projectId: string) => BudgetProject | undefined;
  getOrCreateBudgetForProject: (projectId: string, projectName: string) => BudgetProject;

  // Ações de Etapas e Itens
  addStage: (title: string, code?: string) => void;
  updateStage: (stageId: string, title: string, code: string) => void;
  deleteStage: (stageId: string) => void;
  addItemToStage: (stageId: string, item: Omit<BudgetItem, 'id' | 'stageId' | 'order'>) => void;
  updateItem: (itemId: string, updates: Partial<BudgetItem>) => void;
  deleteItem: (itemId: string) => void;

  // BDI e Cronograma
  updateBdiConfig: (config: BdiConfig) => void;
  updateDisbursementSchedule: (schedule: DisbursementSchedule) => void;
}

const STORAGE_KEY = 'buddy_orcamentos_v2';
const ACTIVE_PROJ_KEY = 'buddy_orcamento_active_id';

const INITIAL_DEMO_BUDGETS: BudgetProject[] = [
  {
    id: 'orc-demo-01',
    title: 'Casa Praia Serena - Casana',
    clientName: 'Casana Empreendimentos',
    location: 'Praia do Preá, Cruz - CE',
    totalArea: 285.50,
    dateBase: '09/2026 - SINAPI Desonerado (CE)',
    status: 'draft',
    bdiConfig: {
      centralAdministration: 4.5,
      insuranceAndWarranty: 0.8,
      risks: 1.5,
      financialExpenses: 1.2,
      profitMargin: 9.0,
      taxes: {
        pis: 0.65,
        cofins: 3.00,
        iss: 3.00,
        cprb: 4.50,
      },
    },
    stages: [
      {
        id: 'stg-1',
        budgetId: 'orc-demo-01',
        order: 1,
        code: '01',
        title: 'Serviços Preliminares e Canteiro',
        items: [
          {
            id: 'it-1',
            stageId: 'stg-1',
            order: 1,
            code: '01.01',
            source: 'sinapi',
            sinapiCode: '98458',
            description: 'Tapume de chapa de madeira compensada resinada 6mm com portão',
            unit: 'm²',
            quantity: 110,
            unitCostMaterial: 48.50,
            unitCostLabor: 24.10,
            unitCostEquipment: 0.00,
            unitCostTotal: 72.60,
            composition: SINAPI_DATABASE.find(i => i.code === '98458')?.composition,
          },
          {
            id: 'it-2',
            stageId: 'stg-1',
            order: 2,
            code: '01.02',
            source: 'sinapi',
            sinapiCode: '98460',
            description: 'Locação convencional de obra com gabarito corrido pontaletado',
            unit: 'm',
            quantity: 75,
            unitCostMaterial: 14.80,
            unitCostLabor: 16.50,
            unitCostEquipment: 0.00,
            unitCostTotal: 31.30,
            composition: SINAPI_DATABASE.find(i => i.code === '98460')?.composition,
          },
        ],
      },
      {
        id: 'stg-2',
        budgetId: 'orc-demo-01',
        order: 2,
        code: '02',
        title: 'Fundações e Estrutura de Concreto',
        items: [
          {
            id: 'it-3',
            stageId: 'stg-2',
            order: 1,
            code: '02.01',
            source: 'sinapi',
            sinapiCode: '94970',
            description: 'Concreto armado Fck 25MPa usinado lançado em baldrames e pilares',
            unit: 'm³',
            quantity: 58,
            unitCostMaterial: 395.00,
            unitCostLabor: 148.50,
            unitCostEquipment: 26.50,
            unitCostTotal: 570.00,
            composition: SINAPI_DATABASE.find(i => i.code === '94970')?.composition,
          },
          {
            id: 'it-4',
            stageId: 'stg-2',
            order: 2,
            code: '02.02',
            source: 'sinapi',
            sinapiCode: '92778',
            description: 'Armação de estrutura em aço CA-50 corte, dobra e amarração',
            unit: 'kg',
            quantity: 3800,
            unitCostMaterial: 8.90,
            unitCostLabor: 3.80,
            unitCostEquipment: 0.00,
            unitCostTotal: 12.70,
            composition: SINAPI_DATABASE.find(i => i.code === '92778')?.composition,
          },
        ],
      },
      {
        id: 'stg-3',
        budgetId: 'orc-demo-01',
        order: 3,
        code: '03',
        title: 'Alvenarias e Revestimentos',
        items: [
          {
            id: 'it-5',
            stageId: 'stg-3',
            order: 1,
            code: '03.01',
            source: 'sinapi',
            sinapiCode: '87520',
            description: 'Alvenaria de bloco cerâmico furado 14x19x29cm com argamassa 1:2:8',
            unit: 'm²',
            quantity: 340,
            unitCostMaterial: 36.50,
            unitCostLabor: 36.80,
            unitCostEquipment: 0.00,
            unitCostTotal: 73.30,
            composition: SINAPI_DATABASE.find(i => i.code === '87520')?.composition,
          },
          {
            id: 'it-6',
            stageId: 'stg-3',
            order: 2,
            code: '03.02',
            source: 'sinapi',
            sinapiCode: '87251',
            description: 'Piso em porcelanato 60x60cm assentado com argamassa AC-II e rejunte',
            unit: 'm²',
            quantity: 210,
            unitCostMaterial: 48.00,
            unitCostLabor: 28.50,
            unitCostEquipment: 0.00,
            unitCostTotal: 76.50,
            composition: SINAPI_DATABASE.find(i => i.code === '87251')?.composition,
          },
        ],
      },
    ],
    disbursementSchedule: {
      monthsCount: 6,
      monthsLabels: ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'],
      distributions: {
        'stg-1': [70, 30, 0, 0, 0, 0],
        'stg-2': [20, 50, 30, 0, 0, 0],
        'stg-3': [0, 20, 50, 30, 0, 0],
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<BudgetProject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Falha ao carregar orçamentos locais', e);
    }
    return INITIAL_DEMO_BUDGETS;
  });

  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROJ_KEY);
      if (savedId && projects.some(p => p.id === savedId)) return savedId;
    } catch (e) {}
    return projects[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'cost' | 'selling'>('selling');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Falha ao salvar orçamentos locais', e);
    }
  }, [projects]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(ACTIVE_PROJ_KEY, id);
  };

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const bdiRate = useMemo(() => {
    if (!activeProject) return 0;
    return calculateBdiRate(activeProject.bdiConfig);
  }, [activeProject]);

  const {
    directCostTotal,
    materialCostTotal,
    laborCostTotal,
    equipmentCostTotal,
    stageSummaries,
  } = useMemo(() => {
    if (!activeProject) {
      return {
        directCostTotal: 0,
        materialCostTotal: 0,
        laborCostTotal: 0,
        equipmentCostTotal: 0,
        stageSummaries: [],
      };
    }

    let directTotal = 0;
    let matTotal = 0;
    let labTotal = 0;
    let eqTotal = 0;

    const rawSummaries = activeProject.stages.map(stage => {
      let stageMat = 0;
      let stageLab = 0;
      let stageEq = 0;
      let stageTotal = 0;

      stage.items.forEach(item => {
        const itemMat = (item.unitCostMaterial || 0) * (item.quantity || 0);
        const itemLab = (item.unitCostLabor || 0) * (item.quantity || 0);
        const itemEq = (item.unitCostEquipment || 0) * (item.quantity || 0);
        const itemTot = (item.unitCostTotal || 0) * (item.quantity || 0);

        stageMat += itemMat;
        stageLab += itemLab;
        stageEq += itemEq;
        stageTotal += itemTot;
      });

      directTotal += stageTotal;
      matTotal += stageMat;
      labTotal += stageLab;
      eqTotal += stageEq;

      return {
        stageId: stage.id,
        code: stage.code,
        title: stage.title,
        directCost: stageTotal,
        materialCost: stageMat,
        laborCost: stageLab,
        equipmentCost: stageEq,
        sellingPrice: stageTotal * (1 + bdiRate / 100),
        percentageOfTotal: 0,
      };
    });

    const summaries = rawSummaries.map(s => ({
      ...s,
      percentageOfTotal: directTotal > 0 ? (s.directCost / directTotal) * 100 : 0,
    }));

    return {
      directCostTotal: directTotal,
      materialCostTotal: matTotal,
      laborCostTotal: labTotal,
      equipmentCostTotal: eqTotal,
      stageSummaries: summaries,
    };
  }, [activeProject, bdiRate]);

  const sellingPriceTotal = useMemo(() => {
    return directCostTotal * (1 + bdiRate / 100);
  }, [directCostTotal, bdiRate]);

  const costPerSquareMeter = useMemo(() => {
    const area = activeProject?.totalArea || 0;
    return area > 0 ? directCostTotal / area : 0;
  }, [directCostTotal, activeProject]);

  const sellingPerSquareMeter = useMemo(() => {
    const area = activeProject?.totalArea || 0;
    return area > 0 ? sellingPriceTotal / area : 0;
  }, [sellingPriceTotal, activeProject]);

  const abcAnalysis = useMemo<AbcItem[]>(() => {
    if (!activeProject || directCostTotal === 0) return [];

    const allItems: { item: BudgetItem; totalCost: number }[] = [];
    activeProject.stages.forEach(stage => {
      stage.items.forEach(item => {
        const total = (item.quantity || 0) * (item.unitCostTotal || 0);
        if (total > 0) {
          allItems.push({ item, totalCost: total });
        }
      });
    });

    allItems.sort((a, b) => b.totalCost - a.totalCost);

    let runningAccumulated = 0;
    return allItems.map(({ item, totalCost }) => {
      const percentage = (totalCost / directCostTotal) * 100;
      runningAccumulated += percentage;

      let category: 'A' | 'B' | 'C' = 'C';
      if (runningAccumulated <= 80 || runningAccumulated - percentage < 80) {
        category = 'A';
      } else if (runningAccumulated <= 95) {
        category = 'B';
      }

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitCost: item.unitCostTotal,
        totalCost,
        percentageOfTotal: percentage,
        accumulatedPercentage: Math.min(100, runningAccumulated),
        category,
      };
    });
  }, [activeProject, directCostTotal]);

  const createProject = (data: Partial<BudgetProject>): BudgetProject => {
    const newProject: BudgetProject = {
      id: 'orc-' + Date.now(),
      projectId: data.projectId,
      title: data.title || 'Novo Orçamento de Obra',
      clientName: data.clientName || 'Cliente Exemplo',
      location: data.location || 'Fortaleza - CE',
      totalArea: data.totalArea || 150,
      dateBase: data.dateBase || 'SINAPI Desonerado (CE)',
      status: 'draft',
      bdiConfig: data.bdiConfig || {
        centralAdministration: 4.5,
        insuranceAndWarranty: 0.8,
        risks: 1.5,
        financialExpenses: 1.2,
        profitMargin: 9.0,
        taxes: { pis: 0.65, cofins: 3.0, iss: 3.0, cprb: 4.5 },
      },
      stages: [
        {
          id: 'stg-' + Date.now(),
          budgetId: 'orc-' + Date.now(),
          order: 1,
          code: '01',
          title: 'Serviços Preliminares',
          items: [],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    toast.success('Orçamento criado com sucesso!');
    return newProject;
  };

  const getBudgetByProjectId = (projId: string): BudgetProject | undefined => {
    return projects.find(p => p.projectId === projId);
  };

  const getOrCreateBudgetForProject = (projId: string, projName: string): BudgetProject => {
    const existing = projects.find(p => p.projectId === projId);
    if (existing) return existing;

    const created = createProject({
      projectId: projId,
      title: `Orçamento - ${projName}`,
      clientName: 'Cliente da Obra',
    });
    return created;
  };

  const updateProject = (id: string, data: Partial<BudgetProject>) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
    );
    toast.success('Orçamento atualizado');
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) {
      toast.error('Você deve manter ao menos um orçamento.');
      return;
    }
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) setActiveProjectId(remaining[0].id);
    }
    toast.success('Orçamento removido');
  };

  const duplicateProject = (id: string) => {
    const orig = projects.find(p => p.id === id);
    if (!orig) return;

    const newId = 'orc-' + Date.now();
    const clonedStages = orig.stages.map((st, i) => ({
      ...st,
      id: `stg-${Date.now()}-${i}`,
      budgetId: newId,
      items: st.items.map((it, j) => ({
        ...it,
        id: `it-${Date.now()}-${i}-${j}`,
        stageId: `stg-${Date.now()}-${i}`,
      })),
    }));

    const cloned: BudgetProject = {
      ...orig,
      id: newId,
      title: `${orig.title} (Cópia)`,
      stages: clonedStages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects(prev => [cloned, ...prev]);
    setActiveProjectId(cloned.id);
    toast.success('Orçamento duplicado com sucesso!');
  };

  const addStage = (title: string, code?: string) => {
    if (!activeProject) return;
    const stageNum = activeProject.stages.length + 1;
    const finalCode = code || (stageNum < 10 ? `0${stageNum}` : `${stageNum}`);

    const newStage: BudgetStage = {
      id: 'stg-' + Date.now(),
      budgetId: activeProject.id,
      order: stageNum,
      code: finalCode,
      title: title.trim(),
      items: [],
    };

    updateProject(activeProject.id, {
      stages: [...activeProject.stages, newStage],
    });
    toast.success(`Etapa "${title}" adicionada`);
  };

  const updateStage = (stageId: string, title: string, code: string) => {
    if (!activeProject) return;
    const updatedStages = activeProject.stages.map(st =>
      st.id === stageId ? { ...st, title, code } : st
    );
    updateProject(activeProject.id, { stages: updatedStages });
  };

  const deleteStage = (stageId: string) => {
    if (!activeProject) return;
    const updatedStages = activeProject.stages.filter(st => st.id !== stageId);
    updateProject(activeProject.id, { stages: updatedStages });
    toast.success('Etapa excluída');
  };

  const addItemToStage = (stageId: string, item: Omit<BudgetItem, 'id' | 'stageId' | 'order'>) => {
    if (!activeProject) return;

    const targetStage = activeProject.stages.find(s => s.id === stageId);
    const order = (targetStage?.items.length || 0) + 1;
    const totalUnit =
      (item.unitCostMaterial || 0) +
      (item.unitCostLabor || 0) +
      (item.unitCostEquipment || 0);

    const newItem: BudgetItem = {
      ...item,
      id: 'it-' + Date.now(),
      stageId,
      order,
      unitCostTotal: item.unitCostTotal || totalUnit,
    };

    const updatedStages = activeProject.stages.map(st => {
      if (st.id === stageId) {
        return { ...st, items: [...st.items, newItem] };
      }
      return st;
    });

    updateProject(activeProject.id, { stages: updatedStages });
    toast.success(`Item "${item.description.slice(0, 30)}..." adicionado`);
  };

  const updateItem = (itemId: string, updates: Partial<BudgetItem>) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map(st => {
      const itemExists = st.items.some(it => it.id === itemId);
      if (!itemExists) return st;

      const updatedItems = st.items.map(it => {
        if (it.id !== itemId) return it;
        const merged = { ...it, ...updates };
        const calculatedTotal =
          (merged.unitCostMaterial || 0) +
          (merged.unitCostLabor || 0) +
          (merged.unitCostEquipment || 0);
        return {
          ...merged,
          unitCostTotal:
            updates.unitCostTotal !== undefined ? updates.unitCostTotal : calculatedTotal,
        };
      });

      return { ...st, items: updatedItems };
    });

    updateProject(activeProject.id, { stages: updatedStages });
  };

  const deleteItem = (itemId: string) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map(st => ({
      ...st,
      items: st.items.filter(it => it.id !== itemId),
    }));

    updateProject(activeProject.id, { stages: updatedStages });
    toast.success('Item removido da planilha');
  };

  const updateBdiConfig = (config: BdiConfig) => {
    if (!activeProject) return;
    updateProject(activeProject.id, { bdiConfig: config });
    toast.success('Parâmetros de BDI recalculados com sucesso');
  };

  const updateDisbursementSchedule = (schedule: DisbursementSchedule) => {
    if (!activeProject) return;
    updateProject(activeProject.id, { disbursementSchedule: schedule });
    toast.success('Cronograma de desembolso atualizado');
  };

  return (
    <BudgetContext.Provider
      value={{
        projects,
        activeProject,
        setActiveProjectId,
        viewMode,
        setViewMode,
        bdiRate,
        directCostTotal,
        materialCostTotal,
        laborCostTotal,
        equipmentCostTotal,
        sellingPriceTotal,
        costPerSquareMeter,
        sellingPerSquareMeter,
        stageSummaries,
        abcAnalysis,
        createProject,
        updateProject,
        deleteProject,
        duplicateProject,
        getBudgetByProjectId,
        getOrCreateBudgetForProject,
        addStage,
        updateStage,
        deleteStage,
        addItemToStage,
        updateItem,
        deleteItem,
        updateBdiConfig,
        updateDisbursementSchedule,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget deve ser usado dentro de BudgetProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  BudgetProject,
  BudgetStage,
  BudgetSubstage,
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
  otherCost: number;
  sellingPrice: number;
  // Valores por m² de área construída
  directCostPerM2: number;
  materialPerM2: number;
  laborPerM2: number;
  equipmentPerM2: number;
  otherPerM2: number;
  sellingPerM2: number;
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
  otherCostTotal: number;
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

  // Ações de Etapas, Subetapas e Itens
  addStage: (title: string, code?: string) => void;
  updateStage: (stageId: string, title: string, code: string) => void;
  deleteStage: (stageId: string) => void;

  addSubstage: (stageId: string, title: string, code?: string) => void;
  updateSubstage: (stageId: string, substageId: string, title: string, code: string) => void;
  deleteSubstage: (stageId: string, substageId: string) => void;

  addItemToSubstage: (
    stageId: string,
    substageId: string,
    item: Omit<BudgetItem, 'id' | 'stageId' | 'substageId' | 'order'>
  ) => void;
  addItemToStage: (
    stageId: string,
    item: Omit<BudgetItem, 'id' | 'stageId' | 'order'>,
    substageId?: string
  ) => void;
  updateItem: (itemId: string, updates: Partial<BudgetItem>) => void;
  deleteItem: (itemId: string) => void;

  // BDI e Cronograma
  updateBdiConfig: (config: BdiConfig) => void;
  updateDisbursementSchedule: (schedule: DisbursementSchedule) => void;
}

const STORAGE_KEY = 'buddy_orcamentos_v3';
const ACTIVE_PROJ_KEY = 'buddy_orcamento_active_id';

/**
 * Garante que todas as etapas possuam substages e numeração padronizada (Etapa 1 -> Subetapa 1.1 -> Item 1.1.1)
 */
export function normalizeProjectStages(stages: BudgetStage[]): BudgetStage[] {
  return stages.map((stage, sIdx) => {
    const stageNum = String(stage.order || sIdx + 1);
    const stageCode = stage.code || stageNum;

    if (stage.substages && stage.substages.length > 0) {
      return {
        ...stage,
        code: stageCode,
        substages: stage.substages.map((sub, subIdx) => {
          const subNum = String(sub.order || subIdx + 1);
          const subCode = sub.code || `${stageCode}.${subNum}`;
          return {
            ...sub,
            stageId: stage.id,
            code: subCode,
            items: (sub.items || []).map((it, itIdx) => ({
              ...it,
              stageId: stage.id,
              substageId: sub.id,
              code: it.code || `${subCode}.${it.order || itIdx + 1}`,
              unitCostOther: it.unitCostOther || 0,
            })),
          };
        }),
      };
    }

    // Se a etapa tiver apenas items legados (sem substages)
    const legacyItems = stage.items || [];
    const defaultSubstage: BudgetSubstage = {
      id: `sub-${stage.id}-1`,
      stageId: stage.id,
      order: 1,
      code: `${stageCode}.1`,
      title: stage.title || 'Geral',
      items: legacyItems.map((it, itIdx) => ({
        ...it,
        stageId: stage.id,
        substageId: `sub-${stage.id}-1`,
        code: it.code || `${stageCode}.1.${it.order || itIdx + 1}`,
        unitCostOther: it.unitCostOther || 0,
      })),
    };

    return {
      ...stage,
      code: stageCode,
      substages: [defaultSubstage],
      items: legacyItems,
    };
  });
}

/**
 * Retorna todos os itens de uma etapa desdobrada
 */
export function getStageItems(stage: BudgetStage): BudgetItem[] {
  if (stage.substages && stage.substages.length > 0) {
    return stage.substages.flatMap((sub) => sub.items || []);
  }
  return stage.items || [];
}

const INITIAL_DEMO_BUDGETS: BudgetProject[] = [
  {
    id: 'orc-demo-01',
    title: 'N&J House - Mansão Casana',
    clientName: 'N&J Empreendimentos',
    location: 'Praia do Preá, Cruz - CE',
    totalArea: 285.5,
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
        cofins: 3.0,
        iss: 3.0,
        cprb: 4.5,
      },
    },
    stages: [
      {
        id: 'stg-1',
        budgetId: 'orc-demo-01',
        order: 1,
        code: '1',
        title: 'Serviços Preliminares',
        substages: [
          {
            id: 'sub-1-1',
            stageId: 'stg-1',
            order: 1,
            code: '1.1',
            title: 'Tapumes e Fechamentos Provisórios',
            items: [
              {
                id: 'it-1',
                stageId: 'stg-1',
                substageId: 'sub-1-1',
                order: 1,
                code: '1.1.1',
                source: 'proprio',
                description: 'Tapume de telhas metálicas trapezoidais h=2,20m com montantes de madeira',
                unit: 'm²',
                quantity: 110,
                unitCostMaterial: 54.0,
                unitCostLabor: 28.5,
                unitCostEquipment: 0.0,
                unitCostOther: 0.0,
                unitCostTotal: 82.5,
                bdi: 32.6,
              },
              {
                id: 'it-2',
                stageId: 'stg-1',
                substageId: 'sub-1-1',
                order: 2,
                code: '1.1.2',
                source: 'proprio',
                description: 'Portão de correr em chapa metálica para acesso de veículos da obra',
                unit: 'und',
                quantity: 2,
                unitCostMaterial: 850.0,
                unitCostLabor: 320.0,
                unitCostEquipment: 0.0,
                unitCostOther: 50.0,
                unitCostTotal: 1220.0,
                bdi: 32.6,
              },
            ],
          },
          {
            id: 'sub-1-2',
            stageId: 'stg-1',
            order: 2,
            code: '1.2',
            title: 'Locação e Gabarito da Obra',
            items: [
              {
                id: 'it-3',
                stageId: 'stg-1',
                substageId: 'sub-1-2',
                order: 1,
                code: '1.2.1',
                source: 'sinapi',
                sinapiCode: '98460',
                description: 'Locação convencional de obra com gabarito corrido pontaletado',
                unit: 'm',
                quantity: 75,
                unitCostMaterial: 14.8,
                unitCostLabor: 16.5,
                unitCostEquipment: 0.0,
                unitCostOther: 0.0,
                unitCostTotal: 31.3,
                bdi: 32.6,
                composition: SINAPI_DATABASE.find((i) => i.code === '98460')?.composition,
              },
            ],
          },
        ],
      },
      {
        id: 'stg-2',
        budgetId: 'orc-demo-01',
        order: 2,
        code: '2',
        title: 'Movimento de Terra',
        substages: [
          {
            id: 'sub-2-1',
            stageId: 'stg-2',
            order: 1,
            code: '2.1',
            title: 'Escavação e Aterro',
            items: [
              {
                id: 'it-4',
                stageId: 'stg-2',
                substageId: 'sub-2-1',
                order: 1,
                code: '2.1.1',
                source: 'proprio',
                description: 'Escavação manual de valas para baldrames e sapatas em solo arenoso',
                unit: 'm³',
                quantity: 45,
                unitCostMaterial: 0.0,
                unitCostLabor: 48.0,
                unitCostEquipment: 0.0,
                unitCostOther: 0.0,
                unitCostTotal: 48.0,
                bdi: 30.0,
              },
              {
                id: 'it-5',
                stageId: 'stg-2',
                substageId: 'sub-2-1',
                order: 2,
                code: '2.1.2',
                source: 'proprio',
                description: 'Reaterro manual apiloado com maço de 30kg',
                unit: 'm³',
                quantity: 28,
                unitCostMaterial: 0.0,
                unitCostLabor: 32.0,
                unitCostEquipment: 0.0,
                unitCostOther: 0.0,
                unitCostTotal: 32.0,
                bdi: 30.0,
              },
            ],
          },
        ],
      },
      {
        id: 'stg-3',
        budgetId: 'orc-demo-01',
        order: 3,
        code: '3',
        title: 'Fundações e Estruturas',
        substages: [
          {
            id: 'sub-3-1',
            stageId: 'stg-3',
            order: 1,
            code: '3.1',
            title: 'Concretagem Estrutural',
            items: [
              {
                id: 'it-6',
                stageId: 'stg-3',
                substageId: 'sub-3-1',
                order: 1,
                code: '3.1.1',
                source: 'sinapi',
                sinapiCode: '94970',
                description: 'Concreto armado Fck 25MPa usinado lançado em baldrames e pilares',
                unit: 'm³',
                quantity: 58,
                unitCostMaterial: 395.0,
                unitCostLabor: 148.5,
                unitCostEquipment: 26.5,
                unitCostOther: 0.0,
                unitCostTotal: 570.0,
                bdi: 32.6,
                composition: SINAPI_DATABASE.find((i) => i.code === '94970')?.composition,
              },
            ],
          },
          {
            id: 'sub-3-2',
            stageId: 'stg-3',
            order: 2,
            code: '3.2',
            title: 'Armaduras de Aço',
            items: [
              {
                id: 'it-7',
                stageId: 'stg-3',
                substageId: 'sub-3-2',
                order: 1,
                code: '3.2.1',
                source: 'sinapi',
                sinapiCode: '92778',
                description: 'Armação de estrutura em aço CA-50 corte, dobra e amarração',
                unit: 'kg',
                quantity: 3800,
                unitCostMaterial: 8.9,
                unitCostLabor: 3.8,
                unitCostEquipment: 0.0,
                unitCostOther: 0.0,
                unitCostTotal: 12.7,
                bdi: 32.6,
                composition: SINAPI_DATABASE.find((i) => i.code === '92778')?.composition,
              },
            ],
          },
        ],
      },
    ],
    disbursementSchedule: {
      monthsCount: 6,
      monthsLabels: ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'],
      distributions: {
        'stg-1': [70, 30, 0, 0, 0, 0],
        'stg-2': [50, 50, 0, 0, 0, 0],
        'stg-3': [20, 50, 30, 0, 0, 0],
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: BudgetProject) => ({
            ...p,
            stages: normalizeProjectStages(p.stages || []),
          }));
        }
      }
    } catch (e) {
      console.error('Falha ao carregar orçamentos locais', e);
    }
    return INITIAL_DEMO_BUDGETS.map((p) => ({
      ...p,
      stages: normalizeProjectStages(p.stages),
    }));
  });

  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROJ_KEY);
      if (savedId && projects.some((p) => p.id === savedId)) return savedId;
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
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const bdiRate = useMemo(() => {
    if (!activeProject) return 0;
    return calculateBdiRate(activeProject.bdiConfig);
  }, [activeProject]);

  // Cálculos consolidados por Etapa e Categorias (Mão de Obra, Material, Equipamento, Outros)
  const {
    directCostTotal,
    materialCostTotal,
    laborCostTotal,
    equipmentCostTotal,
    otherCostTotal,
    sellingPriceTotal,
    stageSummaries,
  } = useMemo(() => {
    if (!activeProject) {
      return {
        directCostTotal: 0,
        materialCostTotal: 0,
        laborCostTotal: 0,
        equipmentCostTotal: 0,
        otherCostTotal: 0,
        sellingPriceTotal: 0,
        stageSummaries: [],
      };
    }

    let grandDirect = 0;
    let grandMat = 0;
    let grandLab = 0;
    let grandEq = 0;
    let grandOth = 0;
    let grandSelling = 0;

    const area = activeProject.totalArea || 0;

    const rawSummaries = activeProject.stages.map((stage) => {
      let stageMat = 0;
      let stageLab = 0;
      let stageEq = 0;
      let stageOth = 0;
      let stageDirect = 0;
      let stageSelling = 0;

      const items = getStageItems(stage);

      items.forEach((item) => {
        const q = item.quantity || 0;
        const itemMat = (item.unitCostMaterial || 0) * q;
        const itemLab = (item.unitCostLabor || 0) * q;
        const itemEq = (item.unitCostEquipment || 0) * q;
        const itemOth = (item.unitCostOther || 0) * q;

        const calculatedUnitTotal =
          (item.unitCostMaterial || 0) +
          (item.unitCostLabor || 0) +
          (item.unitCostEquipment || 0) +
          (item.unitCostOther || 0);

        const unitCostTotal = item.unitCostTotal || calculatedUnitTotal;
        const itemDirect = unitCostTotal * q;

        // BDI individual por item ou BDI global da obra
        const effectiveBdi =
          item.bdi !== undefined && item.bdi !== null && !isNaN(item.bdi)
            ? Number(item.bdi)
            : bdiRate;

        const itemSelling = itemDirect * (1 + effectiveBdi / 100);

        stageMat += itemMat;
        stageLab += itemLab;
        stageEq += itemEq;
        stageOth += itemOth;
        stageDirect += itemDirect;
        stageSelling += itemSelling;
      });

      grandDirect += stageDirect;
      grandMat += stageMat;
      grandLab += stageLab;
      grandEq += stageEq;
      grandOth += stageOth;
      grandSelling += stageSelling;

      return {
        stageId: stage.id,
        code: stage.code,
        title: stage.title,
        directCost: stageDirect,
        materialCost: stageMat,
        laborCost: stageLab,
        equipmentCost: stageEq,
        otherCost: stageOth,
        sellingPrice: stageSelling,
        directCostPerM2: area > 0 ? stageDirect / area : 0,
        materialPerM2: area > 0 ? stageMat / area : 0,
        laborPerM2: area > 0 ? stageLab / area : 0,
        equipmentPerM2: area > 0 ? stageEq / area : 0,
        otherPerM2: area > 0 ? stageOth / area : 0,
        sellingPerM2: area > 0 ? stageSelling / area : 0,
        percentageOfTotal: 0,
      };
    });

    const summaries: StageSummary[] = rawSummaries.map((s) => ({
      ...s,
      percentageOfTotal: grandDirect > 0 ? (s.directCost / grandDirect) * 100 : 0,
    }));

    return {
      directCostTotal: grandDirect,
      materialCostTotal: grandMat,
      laborCostTotal: grandLab,
      equipmentCostTotal: grandEq,
      otherCostTotal: grandOth,
      sellingPriceTotal: grandSelling,
      stageSummaries: summaries,
    };
  }, [activeProject, bdiRate]);

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
    activeProject.stages.forEach((stage) => {
      const items = getStageItems(stage);
      items.forEach((item) => {
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
    const newProjId = 'orc-' + Date.now();
    const newProject: BudgetProject = {
      id: newProjId,
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
      stages: normalizeProjectStages([
        {
          id: 'stg-' + Date.now(),
          budgetId: newProjId,
          order: 1,
          code: '1',
          title: 'Serviços Preliminares',
          substages: [
            {
              id: 'sub-' + Date.now(),
              stageId: 'stg-' + Date.now(),
              order: 1,
              code: '1.1',
              title: 'Tapumes e Canteiro',
              items: [],
            },
          ],
        },
      ]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    toast.success('Orçamento criado com sucesso!');
    return newProject;
  };

  const getBudgetByProjectId = (projId: string): BudgetProject | undefined => {
    return projects.find((p) => p.projectId === projId);
  };

  const getOrCreateBudgetForProject = (projId: string, projName: string): BudgetProject => {
    const existing = projects.find((p) => p.projectId === projId);
    if (existing) return existing;

    const created = createProject({
      projectId: projId,
      title: `Orçamento - ${projName}`,
      clientName: 'Cliente da Obra',
    });
    return created;
  };

  const updateProject = (id: string, data: Partial<BudgetProject>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
    );
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) {
      toast.error('Você deve manter ao menos um orçamento.');
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      if (remaining.length > 0) setActiveProjectId(remaining[0].id);
    }
    toast.success('Orçamento removido');
  };

  const duplicateProject = (id: string) => {
    const orig = projects.find((p) => p.id === id);
    if (!orig) return;

    const newId = 'orc-' + Date.now();
    const clonedStages = (orig.stages || []).map((st, i) => {
      const newStgId = `stg-${Date.now()}-${i}`;
      return {
        ...st,
        id: newStgId,
        budgetId: newId,
        substages: (st.substages || []).map((sub, j) => {
          const newSubId = `sub-${Date.now()}-${i}-${j}`;
          return {
            ...sub,
            id: newSubId,
            stageId: newStgId,
            items: (sub.items || []).map((it, k) => ({
              ...it,
              id: `it-${Date.now()}-${i}-${j}-${k}`,
              stageId: newStgId,
              substageId: newSubId,
            })),
          };
        }),
      };
    });

    const cloned: BudgetProject = {
      ...orig,
      id: newId,
      title: `${orig.title} (Cópia)`,
      stages: clonedStages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [cloned, ...prev]);
    setActiveProjectId(cloned.id);
    toast.success('Orçamento duplicado com sucesso!');
  };

  // --- AÇÕES DE ETAPA (Nível 1) ---
  const addStage = (title: string, code?: string) => {
    if (!activeProject) return;
    const stageNum = activeProject.stages.length + 1;
    const finalCode = code || String(stageNum);
    const newStageId = 'stg-' + Date.now();

    const newStage: BudgetStage = {
      id: newStageId,
      budgetId: activeProject.id,
      order: stageNum,
      code: finalCode,
      title: title.trim(),
      substages: [
        {
          id: 'sub-' + Date.now(),
          stageId: newStageId,
          order: 1,
          code: `${finalCode}.1`,
          title: 'Geral',
          items: [],
        },
      ],
    };

    updateProject(activeProject.id, {
      stages: [...activeProject.stages, newStage],
    });
    toast.success(`Etapa "${finalCode} - ${title}" adicionada`);
  };

  const updateStage = (stageId: string, title: string, code: string) => {
    if (!activeProject) return;
    const updatedStages = activeProject.stages.map((st) =>
      st.id === stageId ? { ...st, title, code } : st
    );
    updateProject(activeProject.id, { stages: updatedStages });
  };

  const deleteStage = (stageId: string) => {
    if (!activeProject) return;
    const updatedStages = activeProject.stages.filter((st) => st.id !== stageId);
    updateProject(activeProject.id, { stages: updatedStages });
    toast.success('Etapa excluída');
  };

  // --- AÇÕES DE SUBETAPA (Nível 2) ---
  const addSubstage = (stageId: string, title: string, code?: string) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      if (st.id !== stageId) return st;

      const currentSubs = st.substages || [];
      const subNum = currentSubs.length + 1;
      const finalCode = code || `${st.code}.${subNum}`;

      const newSub: BudgetSubstage = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        stageId,
        order: subNum,
        code: finalCode,
        title: title.trim(),
        items: [],
      };

      return {
        ...st,
        substages: [...currentSubs, newSub],
      };
    });

    updateProject(activeProject.id, { stages: updatedStages });
    toast.success(`Subetapa "${title}" adicionada`);
  };

  const updateSubstage = (
    stageId: string,
    substageId: string,
    title: string,
    code: string
  ) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      if (st.id !== stageId) return st;
      return {
        ...st,
        substages: (st.substages || []).map((sub) =>
          sub.id === substageId ? { ...sub, title, code } : sub
        ),
      };
    });

    updateProject(activeProject.id, { stages: updatedStages });
  };

  const deleteSubstage = (stageId: string, substageId: string) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      if (st.id !== stageId) return st;
      return {
        ...st,
        substages: (st.substages || []).filter((sub) => sub.id !== substageId),
      };
    });

    updateProject(activeProject.id, { stages: updatedStages });
    toast.success('Subetapa excluída');
  };

  // --- AÇÕES DE ITENS (Nível 3) ---
  const addItemToSubstage = (
    stageId: string,
    substageId: string,
    item: Omit<BudgetItem, 'id' | 'stageId' | 'substageId' | 'order'>
  ) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      if (st.id !== stageId) return st;

      const updatedSubs = (st.substages || []).map((sub) => {
        if (sub.id !== substageId) return sub;

        const order = (sub.items || []).length + 1;
        const totalUnit =
          (item.unitCostMaterial || 0) +
          (item.unitCostLabor || 0) +
          (item.unitCostEquipment || 0) +
          (item.unitCostOther || 0);

        const autoCode = `${sub.code}.${order}`;

        const newItem: BudgetItem = {
          ...item,
          id: 'it-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          stageId,
          substageId,
          order,
          code: item.code || autoCode,
          unitCostTotal: item.unitCostTotal || totalUnit,
          bdi: item.bdi !== undefined ? item.bdi : bdiRate,
        };

        return {
          ...sub,
          items: [...(sub.items || []), newItem],
        };
      });

      return {
        ...st,
        substages: updatedSubs,
      };
    });

    updateProject(activeProject.id, { stages: updatedStages });
    toast.success(`Item "${item.description.slice(0, 30)}..." adicionado`);
  };

  const addItemToStage = (
    stageId: string,
    item: Omit<BudgetItem, 'id' | 'stageId' | 'order'>,
    substageId?: string
  ) => {
    if (!activeProject) return;
    const stage = activeProject.stages.find((s) => s.id === stageId);
    if (!stage) return;

    // Se informou substageId ou se existe uma subetapa, usa
    const targetSubstageId =
      substageId ||
      stage.substages?.[0]?.id ||
      `sub-${stageId}-1`;

    if (!stage.substages || stage.substages.length === 0) {
      // Cria a subetapa padrão primeiro
      addSubstage(stageId, 'Geral', `${stage.code}.1`);
    }

    addItemToSubstage(stageId, targetSubstageId, item);
  };

  const updateItem = (itemId: string, updates: Partial<BudgetItem>) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      let changed = false;

      const updatedSubs = (st.substages || []).map((sub) => {
        const itemExists = (sub.items || []).some((it) => it.id === itemId);
        if (!itemExists) return sub;

        changed = true;
        const updatedItems = sub.items.map((it) => {
          if (it.id !== itemId) return it;

          const merged = { ...it, ...updates };
          const calculatedTotal =
            (merged.unitCostMaterial || 0) +
            (merged.unitCostLabor || 0) +
            (merged.unitCostEquipment || 0) +
            (merged.unitCostOther || 0);

          return {
            ...merged,
            unitCostTotal:
              updates.unitCostTotal !== undefined ? updates.unitCostTotal : calculatedTotal,
          };
        });

        return { ...sub, items: updatedItems };
      });

      if (changed) {
        return { ...st, substages: updatedSubs };
      }
      return st;
    });

    updateProject(activeProject.id, { stages: updatedStages });
  };

  const deleteItem = (itemId: string) => {
    if (!activeProject) return;

    const updatedStages = activeProject.stages.map((st) => {
      const updatedSubs = (st.substages || []).map((sub) => ({
        ...sub,
        items: (sub.items || []).filter((it) => it.id !== itemId),
      }));

      return {
        ...st,
        substages: updatedSubs,
      };
    });

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
        otherCostTotal,
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
        addSubstage,
        updateSubstage,
        deleteSubstage,
        addItemToSubstage,
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

export type BudgetStatus = 'draft' | 'sent' | 'approved' | 'review' | 'archived';

export interface BdiConfig {
  centralAdministration: number; // AC (%)
  insuranceAndWarranty: number; // S+G (%)
  risks: number; // R (%)
  financialExpenses: number; // DF (%)
  profitMargin: number; // L (%)
  taxes: {
    pis: number; // PIS (%)
    cofins: number; // COFINS (%)
    iss: number; // ISS (%)
    cprb: number; // CPRB / INSS Desoneração (%)
  };
  customRate?: number; // Override manual opcional
}

export interface CompositionInput {
  id: string;
  type: 'material' | 'labor' | 'equipment';
  code: string;
  description: string;
  unit: string;
  coefficient: number;
  unitCost: number;
}

export interface BudgetItem {
  id: string;
  stageId: string;
  order: number;
  code: string;
  source: 'sinapi' | 'custom' | 'proprio';
  sinapiCode?: string;
  description: string;
  unit: string;
  quantity: number;
  unitCostMaterial: number;
  unitCostLabor: number;
  unitCostEquipment: number;
  unitCostTotal: number;
  composition?: CompositionInput[];
  notes?: string;
}

export interface BudgetStage {
  id: string;
  budgetId: string;
  order: number;
  code: string;
  title: string;
  items: BudgetItem[];
}

export interface DisbursementSchedule {
  monthsCount: number;
  monthsLabels: string[];
  distributions: Record<string, number[]>;
}

export interface BudgetProject {
  id: string;
  projectId?: string; // ID da Obra vinculada no Planejamento Buddy
  title: string;
  clientName: string;
  location: string;
  totalArea?: number;
  dateBase: string;
  status: BudgetStatus;
  bdiConfig: BdiConfig;
  stages: BudgetStage[];
  disbursementSchedule?: DisbursementSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface AbcItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  percentageOfTotal: number;
  accumulatedPercentage: number;
  category: 'A' | 'B' | 'C';
}

/**
 * Cálculo do BDI oficial segundo a fórmula do Acórdão 2622/2013 - TCU:
 * BDI = [ ( (1 + AC + S + R + G) * (1 + DF) * (1 + L) ) / (1 - I) ] - 1
 */
export function calculateBdiRate(config: BdiConfig): number {
  if (config.customRate !== undefined && config.customRate > 0) {
    return config.customRate;
  }

  const ac = (config.centralAdministration || 0) / 100;
  const sg = (config.insuranceAndWarranty || 0) / 100;
  const r = (config.risks || 0) / 100;
  const df = (config.financialExpenses || 0) / 100;
  const l = (config.profitMargin || 0) / 100;

  const totalTaxes =
    ((config.taxes?.pis || 0) +
      (config.taxes?.cofins || 0) +
      (config.taxes?.iss || 0) +
      (config.taxes?.cprb || 0)) /
    100;

  if (totalTaxes >= 1) return 0;

  const numerator = (1 + ac + sg + r) * (1 + df) * (1 + l);
  const denominator = 1 - totalTaxes;

  const bdi = (numerator / denominator - 1) * 100;
  return Math.max(0, Number(bdi.toFixed(2)));
}

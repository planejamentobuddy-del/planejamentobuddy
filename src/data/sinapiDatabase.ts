import { CompositionInput } from '@/types/budget';

export interface SinapiItemReference {
  code: string;
  description: string;
  unit: string;
  category: string;
  costMaterial: number;
  costLabor: number;
  costEquipment: number;
  costTotal: number;
  composition: CompositionInput[];
}

export const SINAPI_DATABASE: SinapiItemReference[] = [
  // ── SERVIÇOS PRELIMINARES & CANTEIRO ──
  {
    code: '98458',
    description: 'TAPUME DE CHAPA DE MADEIRA COMPENSADA RESINADA, E= 6MM, INCLUSO ESTRUTURA DE MADEIRA E PORTÃO',
    unit: 'm²',
    category: 'Serviços Preliminares',
    costMaterial: 48.50,
    costLabor: 24.10,
    costEquipment: 0.00,
    costTotal: 72.60,
    composition: [
      { id: '1', type: 'material', code: '1358', description: 'CHAPA DE MADEIRA COMPENSADA RESINADA 6MM', unit: 'm²', coefficient: 1.05, unitCost: 32.00 },
      { id: '2', type: 'material', code: '4491', description: 'PONTALETE DE MADEIRA 7.5 X 7.5 CM', unit: 'm', coefficient: 1.20, unitCost: 12.40 },
      { id: '3', type: 'labor', code: '88262', description: 'CARPINTEIRO DE FORMAS COM ENCARGOS COMPLEMENTARES', unit: 'h', coefficient: 0.55, unitCost: 26.50 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS COMPLEMENTARES', unit: 'h', coefficient: 0.45, unitCost: 21.20 }
    ]
  },
  {
    code: '98460',
    description: 'LOCAÇÃO CONVENCIONAL DE OBRA, ATRAVÉS DE GABARITO DE TÁBUAS CORRIDAS PONTALETADAS',
    unit: 'm',
    category: 'Serviços Preliminares',
    costMaterial: 14.80,
    costLabor: 16.50,
    costEquipment: 0.00,
    costTotal: 31.30,
    composition: [
      { id: '1', type: 'material', code: '4491', description: 'TABUA DE MADEIRA 2.5 X 15 CM', unit: 'm', coefficient: 1.05, unitCost: 8.50 },
      { id: '2', type: 'labor', code: '88262', description: 'CARPINTEIRO DE FORMAS COM ENCARGOS', unit: 'h', coefficient: 0.35, unitCost: 26.50 },
      { id: '3', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.35, unitCost: 21.20 }
    ]
  },
  {
    code: '93358',
    description: 'ESCAVAÇÃO MANUAL DE VALA PARA VIGA BALDRAME / SAPATA, PROFUNDIDADE ATÉ 1,50 M',
    unit: 'm³',
    category: 'Movimento de Terra',
    costMaterial: 0.00,
    costLabor: 74.20,
    costEquipment: 0.00,
    costTotal: 74.20,
    composition: [
      { id: '1', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS COMPLEMENTARES', unit: 'h', coefficient: 3.50, unitCost: 21.20 }
    ]
  },
  {
    code: '96529',
    description: 'REATERRO MANUAL DE VALAS COM COMPACTAÇÃO MECANIZADA COM SAPO',
    unit: 'm³',
    category: 'Movimento de Terra',
    costMaterial: 0.00,
    costLabor: 31.80,
    costEquipment: 14.50,
    costTotal: 46.30,
    composition: [
      { id: '1', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 1.50, unitCost: 21.20 },
      { id: '2', type: 'equipment', code: '91533', description: 'COMPACTADOR DE PERCUSSÃO TIPO SAPO', unit: 'chp', coefficient: 0.35, unitCost: 41.40 }
    ]
  },

  // ── FUNDAÇÕES E ESTRUTURA ──
  {
    code: '94970',
    description: 'CONCRETO ARMADO FCK 25MPA, PREPARO MECÂNICO COM BETONEIRA 400L, LANÇADO EM BALDRAMES E SAPATAS',
    unit: 'm³',
    category: 'Fundações e Estrutura',
    costMaterial: 395.00,
    costLabor: 148.50,
    costEquipment: 26.50,
    costTotal: 570.00,
    composition: [
      { id: '1', type: 'material', code: '11145', description: 'CIMENTO PORTLAND CP II-32', unit: 'kg', coefficient: 350.0, unitCost: 0.65 },
      { id: '2', type: 'material', code: '370', description: 'AREIA MEDIA LAVADA', unit: 'm³', coefficient: 0.72, unitCost: 95.00 },
      { id: '3', type: 'material', code: '4721', description: 'BRITA N. 1 (9,5 A 19 MM)', unit: 'm³', coefficient: 0.85, unitCost: 110.00 },
      { id: '4', type: 'labor', code: '88309', description: 'PEDREIRO COM ENCARGOS', unit: 'h', coefficient: 2.5, unitCost: 27.20 },
      { id: '5', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 3.8, unitCost: 21.20 },
      { id: '6', type: 'equipment', code: '88831', description: 'BETONEIRA 400L - LOCAÇÃO E OPERAÇÃO', unit: 'chp', coefficient: 0.8, unitCost: 33.10 }
    ]
  },
  {
    code: '92778',
    description: 'ARMAÇÃO DE PILAR OU VIGA DE ESTRUTURA CONVENCIONAL DE CONCRETO ARMADO UTILIZANDO AÇO CA-50 DE 10,0 MM',
    unit: 'kg',
    category: 'Fundações e Estrutura',
    costMaterial: 8.90,
    costLabor: 3.80,
    costEquipment: 0.00,
    costTotal: 12.70,
    composition: [
      { id: '1', type: 'material', code: '32', description: 'ACO CA-50, 10,0 MM, VERGALHAO', unit: 'kg', coefficient: 1.05, unitCost: 7.80 },
      { id: '2', type: 'material', code: '43132', description: 'ARAME RECOZIDO 18 BWG 1,25 MM', unit: 'kg', coefficient: 0.025, unitCost: 18.00 },
      { id: '3', type: 'labor', code: '88245', description: 'ARMADOR COM ENCARGOS', unit: 'h', coefficient: 0.08, unitCost: 26.80 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.08, unitCost: 21.20 }
    ]
  },
  {
    code: '92412',
    description: 'MONTAGEM E DESMONTAGEM DE FÔRMA DE PILARES/VIGAS EM CHAPA COMPENSADA RESINADA 14 MM, 3 UTILIZAÇÕES',
    unit: 'm²',
    category: 'Fundações e Estrutura',
    costMaterial: 42.10,
    costLabor: 38.60,
    costEquipment: 0.00,
    costTotal: 80.70,
    composition: [
      { id: '1', type: 'material', code: '1359', description: 'CHAPA COMPENSADA RESINADA 14MM', unit: 'm²', coefficient: 0.38, unitCost: 65.00 },
      { id: '2', type: 'material', code: '4491', description: 'SARRAFO DE PINUS 2.5 X 7.5 CM', unit: 'm', coefficient: 1.40, unitCost: 6.20 },
      { id: '3', type: 'labor', code: '88262', description: 'CARPINTEIRO DE FORMAS COM ENCARGOS', unit: 'h', coefficient: 0.85, unitCost: 26.50 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.75, unitCost: 21.20 }
    ]
  },

  // ── ALVENARIA E PAREDES ──
  {
    code: '87515',
    description: 'ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS NA HORIZONTAL 9X19X19CM, ARGAMASSA 1:2:8',
    unit: 'm²',
    category: 'Alvenaria',
    costMaterial: 28.40,
    costLabor: 32.10,
    costEquipment: 0.00,
    costTotal: 60.50,
    composition: [
      { id: '1', type: 'material', code: '681', description: 'BLOCO CERAMICO FURADO 9 X 19 X 19 CM', unit: 'un', coefficient: 26.0, unitCost: 0.85 },
      { id: '2', type: 'material', code: '88629', description: 'ARGAMASSA MISTA CIMENTO, CAL E AREIA 1:2:8', unit: 'm³', coefficient: 0.015, unitCost: 420.00 },
      { id: '3', type: 'labor', code: '88309', description: 'PEDREIRO COM ENCARGOS', unit: 'h', coefficient: 0.65, unitCost: 27.20 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.68, unitCost: 21.20 }
    ]
  },
  {
    code: '87520',
    description: 'ALVENARIA DE BLOCO CERÂMICO FURADO 14X19X29CM (E=14CM), ASSENTADO COM ARGAMASSA TRAÇO 1:2:8',
    unit: 'm²',
    category: 'Alvenaria',
    costMaterial: 36.50,
    costLabor: 36.80,
    costEquipment: 0.00,
    costTotal: 73.30,
    composition: [
      { id: '1', type: 'material', code: '682', description: 'BLOCO CERAMICO FURADO 14 X 19 X 29 CM', unit: 'un', coefficient: 17.5, unitCost: 1.45 },
      { id: '2', type: 'material', code: '88629', description: 'ARGAMASSA TRAÇO 1:2:8', unit: 'm³', coefficient: 0.022, unitCost: 420.00 },
      { id: '3', type: 'labor', code: '88309', description: 'PEDREIRO COM ENCARGOS', unit: 'h', coefficient: 0.75, unitCost: 27.20 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.77, unitCost: 21.20 }
    ]
  },

  // ── REVESTIMENTOS E PISOS ──
  {
    code: '87878',
    description: 'CHAPISCO APLICADO EM ALVENARIA COM ROLO OU COLHER, ARGAMASSA TRAÇO 1:3',
    unit: 'm²',
    category: 'Revestimentos',
    costMaterial: 2.80,
    costLabor: 4.20,
    costEquipment: 0.00,
    costTotal: 7.00,
    composition: [
      { id: '1', type: 'material', code: '11145', description: 'CIMENTO CP II-32', unit: 'kg', coefficient: 2.4, unitCost: 0.65 },
      { id: '2', type: 'material', code: '370', description: 'AREIA MEDIA', unit: 'm³', coefficient: 0.006, unitCost: 95.00 },
      { id: '3', type: 'labor', code: '88309', description: 'PEDREIRO COM ENCARGOS', unit: 'h', coefficient: 0.08, unitCost: 27.20 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.09, unitCost: 21.20 }
    ]
  },
  {
    code: '87775',
    description: 'EMBOÇO/MASSA ÚNICA PARA PAREDES INTERNAS/EXTERNAS, ESPESSURA 20MM, ARGAMASSA TRAÇO 1:2:8',
    unit: 'm²',
    category: 'Revestimentos',
    costMaterial: 11.50,
    costLabor: 19.80,
    costEquipment: 0.00,
    costTotal: 31.30,
    composition: [
      { id: '1', type: 'material', code: '88629', description: 'ARGAMASSA MISTA 1:2:8', unit: 'm³', coefficient: 0.025, unitCost: 420.00 },
      { id: '2', type: 'labor', code: '88309', description: 'PEDREIRO COM ENCARGOS', unit: 'h', coefficient: 0.42, unitCost: 27.20 },
      { id: '3', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.40, unitCost: 21.20 }
    ]
  },
  {
    code: '87251',
    description: 'REVESTIMENTO CERÂMICO / PORCELANATO PARA PISO ATÉ 60X60 CM, ASSENTADO COM ARGAMASSA AC-II E REJUNTE',
    unit: 'm²',
    category: 'Pisos e Pavimentações',
    costMaterial: 48.00,
    costLabor: 28.50,
    costEquipment: 0.00,
    costTotal: 76.50,
    composition: [
      { id: '1', type: 'material', code: '1288', description: 'PORCELANATO ESMALTADO RETIFICADO 60X60', unit: 'm²', coefficient: 1.10, unitCost: 38.00 },
      { id: '2', type: 'material', code: '375', description: 'ARGAMASSA COLANTE AC-II', unit: 'kg', coefficient: 5.0, unitCost: 1.20 },
      { id: '3', type: 'material', code: '345', description: 'REJUNTE CIMENTÍCIO FLEXÍVEL', unit: 'kg', coefficient: 0.35, unitCost: 6.50 },
      { id: '4', type: 'labor', code: '88256', description: 'LADRILHISTA / AZULEJISTA COM ENCARGOS', unit: 'h', coefficient: 0.60, unitCost: 28.00 },
      { id: '5', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.55, unitCost: 21.20 }
    ]
  },

  // ── PINTURA ──
  {
    code: '88489',
    description: 'PINTURA LÁTEX ACRÍLICA EM PAREDES, DUAS DEMÃOS, INCLUSO SELADOR E LIXAMENTO',
    unit: 'm²',
    category: 'Pintura',
    costMaterial: 6.20,
    costLabor: 12.80,
    costEquipment: 0.00,
    costTotal: 19.00,
    composition: [
      { id: '1', type: 'material', code: '7356', description: 'TINTA ACRÍLICA PREMIUM FOSCA', unit: 'l', coefficient: 0.28, unitCost: 18.50 },
      { id: '2', type: 'material', code: '6085', description: 'SELADOR ACRILICO', unit: 'l', coefficient: 0.12, unitCost: 8.50 },
      { id: '3', type: 'labor', code: '88310', description: 'PINTOR COM ENCARGOS COMPLEMENTARES', unit: 'h', coefficient: 0.30, unitCost: 27.50 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.21, unitCost: 21.20 }
    ]
  },

  // ── INSTALAÇÕES HIDROSSANITÁRIAS E ELÉTRICAS ──
  {
    code: '89356',
    description: 'TUBO PVC SOLDÁVEL ÁGUA FRIA, DN 25 MM (3/4"), INCLUSO CONEXÕES, RASGO E CHUMBAMENTO',
    unit: 'm',
    category: 'Instalações Hidráulicas',
    costMaterial: 11.20,
    costLabor: 15.40,
    costEquipment: 0.00,
    costTotal: 26.60,
    composition: [
      { id: '1', type: 'material', code: '9868', description: 'TUBO PVC SOLDAVEL 25MM', unit: 'm', coefficient: 1.05, unitCost: 6.50 },
      { id: '2', type: 'labor', code: '88267', description: 'ENCANADOR COM ENCARGOS', unit: 'h', coefficient: 0.32, unitCost: 27.50 },
      { id: '3', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.31, unitCost: 21.20 }
    ]
  },
  {
    code: '91834',
    description: 'PONTO DE ILUMINAÇÃO OU TOMADA COMPLETO (ELETRODUTO CORRUGADO, FIAÇÃO 2,5MM² E CAIXA 4X2)',
    unit: 'pt',
    category: 'Instalações Elétricas',
    costMaterial: 42.00,
    costLabor: 38.00,
    costEquipment: 0.00,
    costTotal: 80.00,
    composition: [
      { id: '1', type: 'material', code: '1014', description: 'CABO COBRE FLEXIVEL 2.5 MM² 750V', unit: 'm', coefficient: 18.0, unitCost: 1.85 },
      { id: '2', type: 'material', code: '2688', description: 'ELETRODUTO CORRUGADO FLEXIVEL DN 25MM', unit: 'm', coefficient: 4.5, unitCost: 1.60 },
      { id: '3', type: 'labor', code: '88264', description: 'ELETRICISTA COM ENCARGOS', unit: 'h', coefficient: 0.78, unitCost: 28.00 },
      { id: '4', type: 'labor', code: '88316', description: 'SERVENTE COM ENCARGOS', unit: 'h', coefficient: 0.76, unitCost: 21.20 }
    ]
  }
];

export function searchSinapiItems(query: string, categoryFilter?: string): SinapiItemReference[] {
  const q = query.trim().toLowerCase();
  return SINAPI_DATABASE.filter(item => {
    const matchesQuery =
      !q ||
      item.code.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);

    const matchesCategory =
      !categoryFilter ||
      categoryFilter === 'all' ||
      item.category.toLowerCase() === categoryFilter.toLowerCase();

    return matchesQuery && matchesCategory;
  });
}

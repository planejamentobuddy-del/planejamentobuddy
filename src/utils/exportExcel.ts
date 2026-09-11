import * as XLSX from 'xlsx';
import { BudgetProject, calculateBdiRate } from '@/types/budget';

export function exportBudgetToExcel(project: BudgetProject) {
  const wb = XLSX.utils.book_new();
  const bdiRate = calculateBdiRate(project.bdiConfig);

  // ──────────────────────────────────────────
  // ABA 1: RESUMO DO ORÇAMENTO (SINTÉTICO)
  // ──────────────────────────────────────────
  let totalDirect = 0;
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalEquipment = 0;

  const stageRows: any[] = [];
  project.stages.forEach(stage => {
    let sDirect = 0;
    let sMat = 0;
    let sLab = 0;
    let sEq = 0;

    stage.items.forEach(item => {
      const q = item.quantity || 0;
      sMat += (item.unitCostMaterial || 0) * q;
      sLab += (item.unitCostLabor || 0) * q;
      sEq += (item.unitCostEquipment || 0) * q;
      sDirect += (item.unitCostTotal || 0) * q;
    });

    totalDirect += sDirect;
    totalMaterial += sMat;
    totalLabor += sLab;
    totalEquipment += sEq;

    stageRows.push({
      stage,
      sDirect,
      sMat,
      sLab,
      sEq,
      sSelling: sDirect * (1 + bdiRate / 100),
    });
  });

  const totalSelling = totalDirect * (1 + bdiRate / 100);
  const area = project.totalArea || 0;

  const summaryData: any[] = [
    ['BUDDY BOUTIQUE CONSTRUTORA - RELATÓRIO SINTÉTICO DE ORÇAMENTO'],
    [''],
    ['Obra / Projeto:', project.title],
    ['Cliente:', project.clientName],
    ['Localização:', project.location],
    ['Área Construída:', area > 0 ? `${area} m²` : 'Não informada'],
    ['Data-Base / Tabela:', project.dateBase],
    ['Taxa de BDI Aplicada:', `${bdiRate.toFixed(2)}%`],
    ['Data de Emissão:', new Date().toLocaleDateString('pt-BR')],
    [''],
    ['RESUMO FINANCEIRO CONSOLIDADO'],
    ['Custo Direto Total:', totalDirect],
    ['Preço de Venda Total (com BDI):', totalSelling],
    ['Custo Direto por m²:', area > 0 ? totalDirect / area : 0],
    ['Preço de Venda por m²:', area > 0 ? totalSelling / area : 0],
    [''],
    [
      'Item',
      'Etapa da Obra',
      'Custo Material (R$)',
      'Custo M.O. (R$)',
      'Custo Equip. (R$)',
      'Custo Direto (R$)',
      'Participação (%)',
      'Preço de Venda com BDI (R$)',
    ],
  ];

  stageRows.forEach(sr => {
    const part = totalDirect > 0 ? (sr.sDirect / totalDirect) * 100 : 0;
    summaryData.push([
      sr.stage.code,
      sr.stage.title,
      Number(sr.sMat.toFixed(2)),
      Number(sr.sLab.toFixed(2)),
      Number(sr.sEq.toFixed(2)),
      Number(sr.sDirect.toFixed(2)),
      Number(part.toFixed(2)),
      Number(sr.sSelling.toFixed(2)),
    ]);
  });

  summaryData.push([
    'TOTAL',
    'TOTAL GERAL DA OBRA',
    Number(totalMaterial.toFixed(2)),
    Number(totalLabor.toFixed(2)),
    Number(totalEquipment.toFixed(2)),
    Number(totalDirect.toFixed(2)),
    100,
    Number(totalSelling.toFixed(2)),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Sintético');

  // ──────────────────────────────────────────
  // ABA 2: PLANILHA ANALÍTICA DETALHADA
  // ──────────────────────────────────────────
  const analyticalData: any[] = [
    ['BUDDY BOUTIQUE CONSTRUTORA - PLANILHA ORÇAMENTÁRIA ANALÍTICA DETALHADA'],
    ['Obra:', project.title, '', 'BDI:', `${bdiRate.toFixed(2)}%`],
    [''],
    [
      'Item',
      'Código / Ref.',
      'Fonte',
      'Descrição dos Serviços e Insumos',
      'Unid.',
      'Quantidade',
      'Unit. Material (R$)',
      'Unit. M.O. (R$)',
      'Unit. Equip. (R$)',
      'Custo Unit. Total (R$)',
      'Custo Total Direto (R$)',
      'Preço Venda Unit. c/ BDI (R$)',
      'Preço Venda Total c/ BDI (R$)',
    ],
  ];

  project.stages.forEach(stage => {
    analyticalData.push([
      stage.code,
      '',
      '',
      stage.title.toUpperCase(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    let stageSubtotal = 0;

    stage.items.forEach(item => {
      const q = item.quantity || 0;
      const unitTotal = item.unitCostTotal || 0;
      const costTotal = unitTotal * q;
      const sellingUnit = unitTotal * (1 + bdiRate / 100);
      const sellingTotal = costTotal * (1 + bdiRate / 100);

      stageSubtotal += costTotal;

      analyticalData.push([
        item.code,
        item.sinapiCode || '-',
        item.source.toUpperCase(),
        item.description,
        item.unit,
        q,
        item.unitCostMaterial || 0,
        item.unitCostLabor || 0,
        item.unitCostEquipment || 0,
        unitTotal,
        Number(costTotal.toFixed(2)),
        Number(sellingUnit.toFixed(2)),
        Number(sellingTotal.toFixed(2)),
      ]);
    });

    const stageSellingSubtotal = stageSubtotal * (1 + bdiRate / 100);
    analyticalData.push([
      '',
      '',
      '',
      `SUBTOTAL DA ETAPA ${stage.code} - ${stage.title}`,
      '',
      '',
      '',
      '',
      '',
      '',
      Number(stageSubtotal.toFixed(2)),
      '',
      Number(stageSellingSubtotal.toFixed(2)),
    ]);
    analyticalData.push(['']);
  });

  analyticalData.push([
    '',
    '',
    '',
    'VALOR TOTAL CONSOLIDADO DO ORÇAMENTO',
    '',
    '',
    '',
    '',
    '',
    '',
    Number(totalDirect.toFixed(2)),
    '',
    Number(totalSelling.toFixed(2)),
  ]);

  const wsAnalytical = XLSX.utils.aoa_to_sheet(analyticalData);
  XLSX.utils.book_append_sheet(wb, wsAnalytical, 'Planilha Analítica');

  // ──────────────────────────────────────────
  // ABA 3: CRONOGRAMA DE DESEMBOLSO
  // ──────────────────────────────────────────
  const schedule = project.disbursementSchedule || {
    monthsCount: 6,
    monthsLabels: ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'],
    distributions: {},
  };

  const scheduleHeader = ['Item', 'Etapa', 'Valor Total (c/ BDI)'];
  schedule.monthsLabels.forEach(m => scheduleHeader.push(m));

  const scheduleData: any[] = [
    ['BUDDY BOUTIQUE CONSTRUTORA - CRONOGRAMA FÍSICO-FINANCEIRO DE DESEMBOLSO'],
    ['Obra:', project.title],
    [''],
    scheduleHeader,
  ];

  const monthTotals = new Array(schedule.monthsCount).fill(0);

  project.stages.forEach(stage => {
    let sDirect = 0;
    stage.items.forEach(it => {
      sDirect += (it.unitCostTotal || 0) * (it.quantity || 0);
    });
    const sSelling = sDirect * (1 + bdiRate / 100);
    const dist = schedule.distributions[stage.id] || new Array(schedule.monthsCount).fill(0);

    const row: any[] = [stage.code, stage.title, Number(sSelling.toFixed(2))];

    dist.forEach((pct, idx) => {
      const monthVal = (sSelling * pct) / 100;
      row.push(Number(monthVal.toFixed(2)));
      monthTotals[idx] += monthVal;
    });

    scheduleData.push(row);
  });

  const rowMonthly: any[] = ['TOTAL', 'Desembolso Mensal (R$)', Number(totalSelling.toFixed(2))];
  monthTotals.forEach(val => rowMonthly.push(Number(val.toFixed(2))));
  scheduleData.push(rowMonthly);

  const rowPct: any[] = ['', 'Percentual Mensal (%)', '100%'];
  monthTotals.forEach(val => {
    const pct = totalSelling > 0 ? (val / totalSelling) * 100 : 0;
    rowPct.push(`${pct.toFixed(2)}%`);
  });
  scheduleData.push(rowPct);

  const rowAcc: any[] = ['', 'Desembolso Acumulado (%)', '100%'];
  let runPct = 0;
  monthTotals.forEach(val => {
    const pct = totalSelling > 0 ? (val / totalSelling) * 100 : 0;
    runPct += pct;
    rowAcc.push(`${Math.min(100, runPct).toFixed(2)}%`);
  });
  scheduleData.push(rowAcc);

  const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleData);
  XLSX.utils.book_append_sheet(wb, wsSchedule, 'Cronograma Desembolso');

  const safeName = project.title.replace(/[^a-zA-Z0-9_\-]/g, '_');
  XLSX.writeFile(wb, `Orcamento_Buddy_${safeName}.xlsx`);
}

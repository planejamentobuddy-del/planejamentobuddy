import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BudgetProject, calculateBdiRate } from '@/types/budget';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number): string {
  return `${val.toFixed(2)}%`;
}

export function exportBudgetToPdf(project: BudgetProject) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const bdiRate = calculateBdiRate(project.bdiConfig);
  let totalDirect = 0;

  project.stages.forEach(s => {
    s.items.forEach(it => {
      totalDirect += (it.unitCostTotal || 0) * (it.quantity || 0);
    });
  });

  const totalSelling = totalDirect * (1 + bdiRate / 100);

  // ── CABEÇALHO BUDDY BOUTIQUE CONSTRUTORA ──
  doc.setFillColor(15, 76, 92); // Teal da Buddy
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BUDDY BOUTIQUE CONSTRUTORA', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPOSTA COMERCIAL & ORÇAMENTO EXECUTIVO DE OBRA', 14, 18);
  doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 165, 18);

  // ── DADOS DO PROJETO ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Obra: ${project.title}`, 14, 35);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${project.clientName}`, 14, 41);
  doc.text(`Localização: ${project.location}`, 14, 46);
  if (project.totalArea) {
    doc.text(`Área Construída: ${project.totalArea} m²`, 130, 41);
  }
  doc.text(`Data-Base: ${project.dateBase}`, 130, 46);

  // ── CARDS DE RESUMO ──
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 52, 58, 18, 2, 2, 'F');
  doc.roundedRect(76, 52, 58, 18, 2, 2, 'F');
  doc.roundedRect(138, 52, 58, 18, 2, 2, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CUSTO DIRETO TOTAL', 17, 58);
  doc.text('TAXA DE BDI APLICADA', 79, 58);
  doc.text('PREÇO TOTAL DA PROPOSTA', 141, 58);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 76, 92);
  doc.text(formatCurrency(totalDirect), 17, 65);
  doc.text(`${bdiRate.toFixed(2)}%`, 79, 65);
  doc.setTextColor(217, 119, 6);
  doc.text(formatCurrency(totalSelling), 141, 65);

  // ── TABELA SINTÉTICA POR ETAPAS ──
  const tableRows: any[] = [];

  project.stages.forEach(st => {
    let stageTotal = 0;
    st.items.forEach(it => {
      stageTotal += (it.unitCostTotal || 0) * (it.quantity || 0);
    });
    const stageSelling = stageTotal * (1 + bdiRate / 100);
    const weight = totalDirect > 0 ? (stageTotal / totalDirect) * 100 : 0;

    tableRows.push([
      st.code,
      st.title,
      formatCurrency(stageTotal),
      formatPercent(weight),
      formatCurrency(stageSelling),
    ]);
  });

  tableRows.push([
    '',
    'TOTAL GERAL DA PROPOSTA',
    formatCurrency(totalDirect),
    '100,00%',
    formatCurrency(totalSelling),
  ]);

  autoTable(doc, {
    startY: 76,
    head: [['Item', 'Etapa / Disciplina', 'Custo Direto', 'Part. %', 'Valor Proposta (c/ BDI)']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 76, 92],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    footStyles: {
      fontStyle: 'bold',
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 180;

  if (finalY < 240) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Condições Gerais:', 14, finalY + 12);
    doc.text('• Preços válidos por 15 dias a partir da data de emissão.', 14, finalY + 17);
    doc.text('• Composição de BDI e encargos sociais calculados conforme critérios de engenharia.', 14, finalY + 22);

    doc.line(14, finalY + 45, 90, finalY + 45);
    doc.text('Buddy Boutique Construtora', 14, finalY + 49);
    doc.text('Responsável Técnico / Engenharia', 14, finalY + 53);

    doc.line(120, finalY + 45, 196, finalY + 45);
    doc.text(project.clientName, 120, finalY + 49);
    doc.text('De Acordo / Aceite da Proposta', 120, finalY + 53);
  }

  const safeName = project.title.replace(/[^a-zA-Z0-9_\-]/g, '_');
  doc.save(`Proposta_${safeName}.pdf`);
}

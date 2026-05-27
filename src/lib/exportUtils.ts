import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd/MM/yyyy');
  } catch {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
};

/**
 * Função genérica para exportar JSON para Excel
 */
export const exportToExcel = (
  filename: string,
  sheetName: string,
  data: any[],
  columns: { header: string; key: string }[]
) => {
  // Map data to column headers
  const exportData = data.map(item => {
    const row: Record<string, any> = {};
    columns.forEach(col => {
      row[col.header] = item[col.key];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)); // Max 31 chars for sheet name
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Função genérica para exportar JSON para PDF com jsPDF + autoTable
 */
export const exportToPdf = (
  filename: string,
  title: string,
  projectInfo: { name: string; date?: string },
  data: any[],
  columns: { header: string; key: string; width?: number | 'auto' }[],
  options?: {
    orientation?: 'portrait' | 'landscape';
    additionalInfo?: string[];
  }
) => {
  const orientation = options?.orientation || 'portrait';
  const doc = new jsPDF(orientation, 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.width;
  
  // Header: Buddy Construtora
  doc.setFillColor(37, 99, 235); // bg-blue-600
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BUDDY CONSTRUTORA', 14, 18);

  // Titulo do Relatório
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 45);

  // Info do Projeto
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Projeto: ${projectInfo.name}`, 14, 52);
  
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedDate}`, 14, 58);

  if (projectInfo.date) {
    doc.text(`Período/Data: ${projectInfo.date}`, 14, 64);
  }

  // Informações adicionais (resumos, saldos)
  let startY = projectInfo.date ? 72 : 66;
  
  if (options?.additionalInfo && options.additionalInfo.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    options.additionalInfo.forEach((info) => {
      doc.text(info, 14, startY);
      startY += 6;
    });
    startY += 4;
  }

  // Prepara colunas e linhas para o autotable
  const head = [columns.map(col => col.header)];
  const body = data.map(item => columns.map(col => {
    const val = item[col.key];
    return val !== undefined && val !== null ? String(val) : '-';
  }));

  const columnStyles: any = {};
  columns.forEach((col, index) => {
    if (col.width) {
      columnStyles[index] = { cellWidth: col.width };
    }
  });

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [51, 65, 85], // slate-700
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles,
    didDrawPage: (data) => {
      // Rodapé
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(str, pageWidth - 14 - doc.getTextWidth(str), doc.internal.pageSize.height - 10);
    }
  } as UserOptions);

  doc.save(`${filename}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAÇÕES HIERÁRQUICAS (Planejamento e Cronograma)
// Preservam a ordem Etapa → Subetapas e aplicam estilos visuais distintos.
// ─────────────────────────────────────────────────────────────────────────────

export interface HierarchicalRow {
  /** true = linha de ETAPA, false = linha de SUBETAPA */
  _isStage: boolean;
  [key: string]: any;
}

/**
 * Exporta dados hierárquicos (etapas/subetapas) para PDF.
 * Etapas: fundo azul escuro, texto branco, negrito.
 * Subetapas: fundo azul bem claro, recuo visual no nome.
 */
export const exportHierarchicalToPdf = (
  filename: string,
  title: string,
  projectInfo: { name: string; date?: string },
  rows: HierarchicalRow[],
  columns: { header: string; key: string; width?: number | 'auto' }[],
  options?: {
    orientation?: 'portrait' | 'landscape';
    additionalInfo?: string[];
  }
) => {
  const orientation = options?.orientation ?? 'landscape';
  const doc = new jsPDF(orientation, 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BUDDY CONSTRUTORA', 14, 18);

  // ── Título ─────────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 43);

  // ── Info do projeto ────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Projeto: ${projectInfo.name}`, 14, 50);

  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedDate}`, 14, 56);

  if (projectInfo.date) {
    doc.text(`Período: ${projectInfo.date}`, 14, 62);
  }

  let startY = projectInfo.date ? 68 : 62;

  if (options?.additionalInfo?.length) {
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    options.additionalInfo.forEach(info => {
      doc.text(info, 14, startY);
      startY += 5;
    });
    startY += 3;
  }

  // ── Legenda de cores ───────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(14, startY, 5, 3.5, 0.8, 0.8, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Etapa', 21, startY + 2.8);

  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(186, 210, 248);
  doc.roundedRect(38, startY, 5, 3.5, 0.8, 0.8, 'FD');
  doc.text('Subetapa', 45, startY + 2.8);

  startY += 8;

  // ── Monta cabeçalho e corpo da tabela ─────────────────────────────────────
  const head = [columns.map(col => col.header)];
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col.key];
      return val !== undefined && val !== null ? String(val) : '-';
    })
  );

  const columnStyles: any = {};
  columns.forEach((col, i) => {
    if (col.width && col.width !== 'auto') {
      columnStyles[i] = { cellWidth: col.width };
    }
  });

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [203, 213, 225], // slate-300
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 58, 138],      // blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles,
    // ── Estilo por linha: azul escuro para etapas, azul claro para subetapas ─
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const row = rows[hookData.row.index];
      if (!row) return;

      if (row._isStage) {
        // Etapa: fundo azul escuro, texto branco, negrito
        hookData.cell.styles.fillColor = [30, 58, 138]; // blue-900
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 8;
      } else {
        // Subetapa: fundo azul bem claro
        hookData.cell.styles.fillColor = [239, 246, 255]; // blue-50
        hookData.cell.styles.textColor = [30, 41, 59];    // slate-800
        hookData.cell.styles.fontStyle = 'normal';
      }
    },
    didDrawPage: (hookData) => {
      const str = `Página ${hookData.pageNumber}`;
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.text(str, pageWidth - 14 - doc.getTextWidth(str), doc.internal.pageSize.height - 8);
    },
  } as UserOptions);

  doc.save(`${filename}.pdf`);
};

/**
 * Exporta dados hierárquicos (etapas/subetapas) para Excel.
 * Etapas: prefixo "■" para destaque visual.
 * Subetapas: nome com recuo "   └ ".
 */
export const exportHierarchicalToExcel = (
  filename: string,
  sheetName: string,
  rows: HierarchicalRow[],
  columns: { header: string; key: string; width?: number | 'auto' }[]
) => {
  const header = columns.map(col => col.header);

  const dataRows = rows.map(row =>
    columns.map(col => {
      const val = row[col.key];
      return val !== undefined && val !== null ? val : '';
    })
  );

  const aoa: any[][] = [header, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Larguras das colunas
  worksheet['!cols'] = columns.map(col => ({
    wch: typeof col.width === 'number' ? col.width : 28,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

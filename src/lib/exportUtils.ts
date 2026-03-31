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

import React, { useState, useMemo } from 'react';
import { Project, getProjectProgress, getCriticalTaskIds, computeWorkforceSummary, safeParseDate } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import {
  exportToExcel, exportToPdf, formatCurrency, formatDate,
  exportHierarchicalToPdf, exportHierarchicalToExcel, HierarchicalRow
} from '@/lib/exportUtils';
import { 
  FileText, TableProperties, GanttChart, 
  Triangle, Wallet, Download, FileSpreadsheet,
  CalendarDays, Briefcase, FileBarChart, Globe, LayoutList, BarChart3,
  Link2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useReportShares, ReportType } from '@/hooks/useReportShares';
import { ShareReportModal } from './ShareReportModal';
import { SharedReportsList } from './SharedReportsList';

interface ReportsTabProps {
  project: Project;
}

export default function ReportsTab({ project }: ReportsTabProps) {
  const { 
    getTasksForProject, 
    getConstraintsForProject, 
    getDailyLogsForProject,
    getReceiptsForProject,
    getHistoryForProject,
    supplyPackages,
    workforceEntries,
    users
  } = useProjects();

  const tasks = getTasksForProject(project.id);
  const constraints = getConstraintsForProject(project.id);
  const dailyLogs = getDailyLogsForProject(project.id);
  const receipts = getReceiptsForProject(project.id);
  const history = getHistoryForProject(project.id);
  const supplies = useMemo(() => supplyPackages.filter(p => p.projectId === project.id), [supplyPackages, project.id]);
  const workforce = useMemo(() => workforceEntries.filter(e => e.projectId === project.id), [workforceEntries, project.id]);

  // Share state
  const { shares, loading: sharesLoading, createShare, revokeShare, reactivateShare } = useReportShares(project.id);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalType, setShareModalType] = useState<ReportType>('executive');
  const [generatingShare, setGeneratingShare] = useState(false);
  const [lastShare, setLastShare] = useState<any>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Sistema';
    const found = users.find(u => u.id === userId);
    return found ? found.full_name : 'Usuário Arquivado';
  };

  const statusMap: Record<string, string> = {
    'not_started': 'Não Iniciado',
    'in_progress': 'Em Andamento',
    'completed': 'Concluído',
    'delayed': 'Atrasado',
    'rescheduled': 'Reprogramada',
    'open': 'Aberta',
    'closed': 'Resolvida'
  };

  // ── Helper: monta linhas hierárquicas (etapas + subetapas em ordem) ─────────
  const buildHierarchicalRows = (
    withPredecessors = false
  ): HierarchicalRow[] => {
    const stages = tasks
      .filter(t => !t.parentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const rows: HierarchicalRow[] = [];

    stages.forEach((stage, sIdx) => {
      const subs = tasks
        .filter(t => t.parentId === stage.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      // Agrega datas e progresso da etapa a partir das subetapas
      const subStarts = subs.map(t => t.startDate).filter(Boolean).sort();
      const subEnds   = subs.map(t => t.endDate).filter(Boolean).sort();
      const aggStart  = subStarts[0] || stage.startDate;
      const aggEnd    = subEnds[subEnds.length - 1] || stage.endDate;

      const totalDur  = subs.reduce((s, t) => s + Math.max(1, t.duration), 0);
      const weightedP = subs.reduce((s, t) => s + t.percentComplete * Math.max(1, t.duration), 0);
      const aggPct    = subs.length > 0 && totalDur > 0
        ? Math.round(weightedP / totalDur)
        : stage.percentComplete;

      // Linha de ETAPA — destaque visual com "■" no Excel
      const stageRow: HierarchicalRow = {
        _isStage: true,
        'Nº':           `${sIdx + 1}`,
        'Nome':         `■ ${stage.name.toUpperCase()}`,
        'Início':       formatDate(subs.length > 0 ? aggStart : stage.startDate),
        'Fim':          formatDate(subs.length > 0 ? aggEnd   : stage.endDate),
        'Duração (d)':  subs.length > 0
          ? String(subs.reduce((s, t) => s + (t.duration || 0), 0))
          : String(stage.duration || 0),
        'Progresso':    `${aggPct}%`,
        'Responsável':  stage.responsible || '-',
        'Status':       statusMap[stage.status] || stage.status,
      };
      if (withPredecessors) {
        stageRow['Predecessoras'] = '-';
      }
      rows.push(stageRow);

      // Linhas de SUBETAPA — recuadas com "  └ "
      subs.forEach((sub, tIdx) => {
        const predNames = (sub.predecessors || [])
          .map(pid => tasks.find(t => t.id === pid)?.name || pid)
          .join(', ') || '-';

        const subRow: HierarchicalRow = {
          _isStage:      false,
          'Nº':          `  ${sIdx + 1}.${tIdx + 1}`,
          'Nome':        `   \u2514 ${sub.name}`,
          'Início':      formatDate(sub.startDate),
          'Fim':         formatDate(sub.endDate),
          'Duração (d)': String(sub.duration || 0),
          'Progresso':   `${sub.percentComplete}%`,
          'Responsável': sub.responsible || '-',
          'Status':      statusMap[sub.status] || sub.status,
        };
        if (withPredecessors) {
          subRow['Predecessoras'] = predNames;
        }
        rows.push(subRow);
      });
    });

    return rows;
  };

  // --- PLANEJAMENTO ---
  const handleExportPlanejamento = (fmt: 'pdf' | 'excel') => {
    const rows = buildHierarchicalRows(true);

    const cols = [
      { header: 'Nº',           key: 'Nº',           width: 10  },
      { header: 'Nome',         key: 'Nome',          width: 60  },
      { header: 'Início',       key: 'Início',        width: 22  },
      { header: 'Fim',          key: 'Fim',           width: 22  },
      { header: 'Dur. (d)',     key: 'Duração (d)',   width: 14  },
      { header: 'Progresso',    key: 'Progresso',     width: 18  },
      { header: 'Responsável',  key: 'Responsável',   width: 30  },
      { header: 'Status',       key: 'Status',        width: 25  },
      { header: 'Predecessoras',key: 'Predecessoras', width: 45  },
    ] as any;

    if (fmt === 'excel') {
      exportHierarchicalToExcel(`Planejamento_${project.name}`, 'Planejamento', rows, cols);
    } else {
      exportHierarchicalToPdf(
        `Planejamento_${project.name}`,
        'Relatório de Planejamento de Tarefas',
        { name: project.name },
        rows, cols,
        { orientation: 'landscape' }
      );
    }
  };

  // --- GANTT / CRONOGRAMA ---
  const handleExportGantt = (fmt: 'pdf' | 'excel') => {
    const rows = buildHierarchicalRows(true);

    const cols = [
      { header: 'Nº',           key: 'Nº',           width: 10  },
      { header: 'Etapa / Atividade', key: 'Nome',    width: 65  },
      { header: 'Início',       key: 'Início',        width: 22  },
      { header: 'Fim',          key: 'Fim',           width: 22  },
      { header: 'Dur. (d)',     key: 'Duração (d)',   width: 14  },
      { header: 'Progresso',    key: 'Progresso',     width: 18  },
      { header: 'Responsável',  key: 'Responsável',   width: 30  },
      { header: 'Status',       key: 'Status',        width: 25  },
      { header: 'Predecessoras',key: 'Predecessoras', width: 45  },
    ] as any;

    if (fmt === 'excel') {
      exportHierarchicalToExcel(`Gantt_${project.name}`, 'Cronograma', rows, cols);
    } else {
      exportHierarchicalToPdf(
        `Gantt_Cronograma_${project.name}`,
        'Relatório de Cronograma (Gantt)',
        { name: project.name },
        rows, cols,
        { orientation: 'landscape' }
      );
    }
  };

  // --- RESTRIÇÕES LEAN ---
  const handleExportConstraints = (format: 'pdf' | 'excel') => {
    const data = constraints.map(c => ({
      'Descrição': c.description,
      'Categoria': c.category,
      'Responsável': c.responsible || '-',
      'Prazo': formatDate(c.dueDate),
      'Status': statusMap[c.status] || c.status,
      'Data de Fechamento': formatDate(c.closedAt || '')
    }));

    const cols = [
      { header: 'Descrição', key: 'Descrição', width: 'auto' },
      { header: 'Categoria', key: 'Categoria', width: 30 },
      { header: 'Responsável', key: 'Responsável', width: 30 },
      { header: 'Prazo', key: 'Prazo', width: 20 },
      { header: 'Status', key: 'Status', width: 20 },
    ] as any;

    if (format === 'excel') {
      exportToExcel(`Restricoes_${project.name}`, 'Restrições', data, cols);
    } else {
      exportToPdf(
        `Restricoes_${project.name}`, 
        'Relatório de Restrições (Lean)',
        { name: project.name },
        data, cols
      );
    }
  };

  // --- DIÁRIO DE OBRA ---
  const handleExportDiary = (format: 'pdf' | 'excel') => {
    const [year, month] = selectedMonth.split('-');
    
    const logsInMonth = dailyLogs.filter(log => {
      const d = new Date(log.date);
      // d is timezone adjusted usually, better string match
      return log.date.startsWith(`${year}-${month}`);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (logsInMonth.length === 0) {
      toast.error('Nenhum registro encontrado para este mês.');
      return;
    }

    const data = logsInMonth.map(log => ({
      'Data': formatDate(log.date),
      'Relato': log.content,
      'Autor': getUserName(log.createdBy)
    }));

    const cols = [
      { header: 'Data', key: 'Data', width: 25 },
      { header: 'Autor', key: 'Autor', width: 35 },
      { header: 'Relato', key: 'Relato', width: 'auto' },
    ] as any;

    if (format === 'excel') {
      exportToExcel(`Diario_${year}_${month}_${project.name}`, 'Diário', data, cols);
    } else {
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      exportToPdf(
        `Diario_${year}_${month}_${project.name}`, 
        `Diário de Obras - ${monthName.toUpperCase()}`,
        { name: project.name, date: monthName },
        data, cols
      );
    }
  };

  // --- ADMINISTRAÇÃO ---
  const handleExportAdmin = (format: 'pdf' | 'excel') => {
    const data = receipts.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()).map(r => ({
      'Data de Recebimento': formatDate(r.receivedAt),
      'Descrição': r.description || 'Lançamento',
      'Valor (R$)': r.amount.toFixed(2),
      'Lançado por': getUserName(r.createdBy)
    }));

    const cols = [
      { header: 'Data de Recebimento', key: 'Data de Recebimento', width: 35 },
      { header: 'Descrição', key: 'Descrição', width: 'auto' },
      { header: 'Valor (R$)', key: 'Valor (R$)', width: 35 },
      { header: 'Lançado por', key: 'Lançado por', width: 40 },
    ] as any;

    const numTotal = project.adminCostTotal || 0;
    const numReceived = receipts.reduce((s, r) => s + r.amount, 0);
    const progress = getProjectProgress(tasks);
    const proportionalValue = numTotal * (progress / 100);
    const balanceToBill = Math.max(0, proportionalValue - numReceived);

    if (format === 'excel') {
      // In Excel, we just dump the table
      exportToExcel(`Financeiro_${project.name}`, 'Financeiro', data, cols);
    } else {
      const addInfo = [
        `Progresso da Obra: ${progress}%`,
        `Valor Contratual: ${formatCurrency(numTotal)}`,
        `Valor Proporcional ao Avanço: ${formatCurrency(proportionalValue)}`,
        `Total Já Recebido: ${formatCurrency(numReceived)}`,
        `Saldo em Atraso a Faturar: ${formatCurrency(balanceToBill)}`
      ];

      exportToPdf(
        `Financeiro_${project.name}`, 
        'Relatório Financeiro e Administração',
        { name: project.name, date: formatDate(new Date().toISOString()) },
        data, cols,
        { additionalInfo: addInfo }
      );
    }
  };

  const handleExportFrentes = (format: 'pdf' | 'excel') => {
    const data: any[] = [];
    tasks.forEach(task => {
      if (task.frentes && task.frentes.length > 0) {
        task.frentes.forEach(f => {
          data.push({
            'Atividade': task.name,
            'Frente': f.name,
            'Responsável': f.responsible || '-',
            'Data Início': formatDate(f.startDate),
            'Data Fim': formatDate(f.endDate),
            'Percentual': `${f.percentComplete || 0}%`,
            'Status': statusMap[f.status] || f.status,
          });
        });
      }
    });

    const cols = [
      { header: 'Atividade', key: 'Atividade', width: 45 },
      { header: 'Frente', key: 'Frente', width: 30 },
      { header: 'Responsável', key: 'Responsável', width: 30 },
      { header: 'Data Início', key: 'Data Início', width: 20 },
      { header: 'Data Fim', key: 'Data Fim', width: 20 },
      { header: 'Percentual', key: 'Percentual', width: 15 },
      { header: 'Status', key: 'Status', width: 20 },
    ] as any;

    if (format === 'excel') {
      exportToExcel(`Frentes_de_Servico_${project.name}`, 'Frentes de Serviço', data, cols);
    } else {
      exportToPdf(
        `Frentes_de_Servico_${project.name}`, 
        'Relatório de Frentes de Serviço',
        { name: project.name, date: formatDate(new Date().toISOString()) },
        data, cols
      );
    }
  };

  // ── SHARE HANDLERS ─────────────────────────────────────────────────────────

  /** Build a lightweight standalone Planejamento HTML for sharing (no financial data) */
  const buildPlanejamentoShareHTML = (): string => {
    const progress = getProjectProgress(tasks);
    const criticalIds = getCriticalTaskIds(tasks);
    const fmtD = (d?: string) => { if (!d) return '—'; try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; } };
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const stages = tasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const allEnds = tasks.map(t => t.endDate).filter(Boolean).sort();
    const plannedEnd = allEnds.length > 0 ? allEnds[allEnds.length - 1] : project.endDate;
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const statusLabel: Record<string, string> = { not_started: 'Não Iniciado', in_progress: 'Em Andamento', completed: 'Concluído', delayed: 'Atrasado', rescheduled: 'Reprogramada' };
    const statusColor: Record<string, string> = { not_started: '#64748B', in_progress: '#2563EB', completed: '#16A34A', delayed: '#DC2626', rescheduled: '#D97706' };

    let rows = '';
    stages.forEach((stage, sIdx) => {
      const children = tasks.filter(t => t.parentId === stage.id).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      const childStarts = children.map(t => t.startDate).filter(Boolean).sort();
      const childEnds = children.map(t => t.endDate).filter(Boolean).sort();
      const stageStart = childStarts[0] || stage.startDate;
      const stageEnd = childEnds[childEnds.length - 1] || stage.endDate;
      const totalDur = children.reduce((s, t) => s + Math.max(1, t.duration), 0);
      const weighted = children.reduce((s, t) => s + t.percentComplete * Math.max(1, t.duration), 0);
      const stageProgress = children.length > 0 && totalDur > 0 ? Math.round(weighted / totalDur) : stage.percentComplete;
      const isCritical = criticalIds.has(stage.id);
      rows += `<tr style="background:#EFF6FF;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <td style="border:1px solid #CBD5E1;border-left:4px solid ${isCritical ? '#DC2626' : '#2563EB'};padding:6px 8px;font-weight:800;font-size:10px;color:#1E3A8A;text-transform:uppercase">${sIdx + 1}</td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;font-weight:800;font-size:10.5px;color:#1E3A8A">${stage.name}${isCritical ? ' <span style="font-size:8px;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:4px;padding:1px 5px">🔥 CRÍTICO</span>' : ''}</td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;font-size:10px;white-space:nowrap">${fmtD(stageStart)}</td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;font-size:10px;white-space:nowrap">${fmtD(stageEnd)}</td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;font-size:10px;text-align:center">${children.length > 0 ? children.reduce((s, t) => s + (t.duration || 0), 0) : stage.duration}</td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:center"><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;background:#E2E8F0;border-radius:99px;height:6px;overflow:hidden"><div style="width:${stageProgress}%;height:100%;background:#2563EB;border-radius:99px"></div></div><span style="font-size:9px;font-weight:700">${stageProgress}%</span></div></td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px"><span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;background:${statusColor[stage.status] || '#64748B'};color:#fff">${statusLabel[stage.status] || stage.status}</span></td>
        <td style="border:1px solid #CBD5E1;padding:6px 8px;font-size:10px">${stage.responsible || '—'}</td>
      </tr>`;
      children.forEach((sub, tIdx) => {
        const predNames = (sub.predecessors || []).map(pid => taskMap.get(pid)?.name || pid).join(', ');
        const isSubCritical = criticalIds.has(sub.id);
        rows += `<tr style="background:${tIdx % 2 === 0 ? '#fff' : '#F8FAFC'}">
          <td style="border:1px solid #E2E8F0;border-left:4px solid ${isSubCritical ? '#DC2626' : 'transparent'};padding:5px 8px;font-size:10px;color:#64748b;text-align:center">${sIdx + 1}.${tIdx + 1}</td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;padding-left:20px;font-size:10.5px;color:#334155">${isSubCritical ? '🔥 ' : '└ '}${sub.name}${isSubCritical ? ' <span style="font-size:8px;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:4px;padding:1px 5px">CRÍTICO</span>' : ''}</td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;font-size:10px;white-space:nowrap">${fmtD(sub.startDate)}</td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;font-size:10px;white-space:nowrap">${fmtD(sub.endDate)}</td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;font-size:10px;text-align:center">${sub.duration ?? '—'}</td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;text-align:center"><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;background:#E2E8F0;border-radius:99px;height:5px;overflow:hidden"><div style="width:${sub.percentComplete}%;height:100%;background:${sub.percentComplete === 100 ? '#16A34A' : '#2563EB'};border-radius:99px"></div></div><span style="font-size:9px;font-weight:700">${sub.percentComplete}%</span></div></td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px"><span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;background:${statusColor[sub.status] || '#64748B'};color:#fff">${statusLabel[sub.status] || sub.status}</span></td>
          <td style="border:1px solid #E2E8F0;padding:5px 8px;font-size:9.5px;color:#64748b">${sub.responsible || '—'}</td>
        </tr>`;
      });
    });

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planejamento — ${project.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;background:#f8fafc;font-family:Inter,sans-serif;color:#0f172a}@media print{body{background:#fff}@page{size:A4 landscape;margin:12mm 10mm}.no-print{display:none!important}}</style></head><body>
<div class="no-print" style="position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center">
  <div style="display:flex;align-items:center;gap:10px"><span style="font-weight:800;font-size:15px;color:#1e293b">${project.name}</span><span style="color:#94a3b8;font-size:13px">— Relatório de Planejamento</span></div>
  <button onclick="window.print()" style="background:#2563EB;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:700;font-size:13px;cursor:pointer">🖨 Imprimir / PDF</button>
</div>
<div style="max-width:1400px;margin:0 auto;padding:28px 20px;background:#fff;min-height:100vh">
  <div style="border-bottom:2px solid #CBD5E1;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1 style="font-size:22px;font-weight:900;margin:0;color:#0F172A">Relatório de Planejamento da Obra</h1><p style="font-size:11px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:4px 0 0">Buddy Construtora</p></div>
    <div style="text-align:right"><p style="font-size:11px;color:#94A3B8;font-weight:600;margin:0">Emissão</p><p style="font-size:14px;font-weight:700;margin:2px 0 0">${now}</p></div>
  </div>
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px 20px;margin-bottom:24px;display:flex;gap:32px;align-items:center">
    <div style="flex:1"><p style="font-size:11px;color:#64748B;font-weight:600;margin:0 0 8px">Progresso Geral</p><div style="background:#E2E8F0;border-radius:99px;height:14px;overflow:hidden"><div style="width:${progress}%;height:100%;background:#2563EB;border-radius:99px"></div></div></div>
    <div style="font-size:48px;font-weight:900;color:#2563EB;line-height:1">${progress}%</div>
    <div><p style="font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0">Término Previsto</p><p style="font-size:22px;font-weight:900;margin:2px 0 0">${fmtD(plannedEnd)}</p></div>
    <div><p style="font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0">Total Tarefas</p><p style="font-size:22px;font-weight:900;margin:2px 0 0">${tasks.length}</p></div>
  </div>
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>${['Nº', 'Nome da Tarefa', 'Início', 'Fim', 'Dur.', '%', 'Status', 'Responsável'].map(h => `<th style="padding:7px 10px;text-align:left;font-weight:850;font-size:10px;letter-spacing:0.6px;text-transform:uppercase;border:1px solid #CBD5E1;color:#1E40AF;background:#DBEAFE;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="margin-top:36px;padding-top:14px;border-top:1px solid #E2E8F0;text-align:center;font-size:10px;color:#94A3B8">
    Gerado automaticamente — Buddy Construtora · ${now} · Documento confidencial para uso do cliente.
  </div>
</div></body></html>`;
  };

  /** Build standalone Cronograma Geral HTML for sharing (no financial data) */
  const buildCronogramaShareHTML = (): string => {
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtD = (d?: string) => { if (!d) return '—'; try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; } };
    const statusLabel: Record<string, string> = { not_started: 'Não Iniciado', in_progress: 'Em Andamento', completed: 'Concluído', delayed: 'Atrasado', rescheduled: 'Reprogramada' };
    const statusColor: Record<string, string> = { not_started: '#94a3b8', in_progress: '#3b82f6', completed: '#22c55e', delayed: '#ef4444', rescheduled: '#f59e0b' };
    const stages = tasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const stageData = stages.map(stage => {
      const subs = tasks.filter(t => t.parentId === stage.id);
      const dates = subs.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
      const endDates = subs.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
      const startTs = dates.length > 0 ? Math.min(...dates) : safeParseDate(stage.startDate);
      const endTs = endDates.length > 0 ? Math.max(...endDates) : safeParseDate(stage.endDate);
      const totalWeight = subs.reduce((acc, curr) => acc + (curr.duration || 1), 0);
      const doneWeight = subs.reduce((acc, curr) => acc + ((curr.percentComplete || 0) * (curr.duration || 1)), 0);
      const percent = subs.length > 0 && totalWeight > 0 ? Math.round(doneWeight / totalWeight) : stage.percentComplete;
      return { name: stage.name, startDate: new Date(startTs).toISOString().split('T')[0], endDate: new Date(endTs).toISOString().split('T')[0], percent, status: percent >= 100 ? 'completed' : (percent > 0 ? 'in_progress' : 'not_started'), duration: Math.round((endTs - startTs) / 86400000) };
    });
    const projStartDates = stageData.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
    const projEndDates = stageData.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
    const rawMin = projStartDates.length > 0 ? new Date(Math.min(...projStartDates)) : new Date(project.startDate || new Date());
    const rawMax = projEndDates.length > 0 ? new Date(Math.max(...projEndDates)) : new Date(project.endDate || new Date());
    const tlStart = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1);
    const tlEnd = new Date(rawMax.getFullYear(), rawMax.getMonth() + 1, 0);
    const tlStartTs = tlStart.getTime(); const tlDur = tlEnd.getTime() - tlStartTs;
    const months: string[] = [];
    const cur = new Date(tlStart.getFullYear(), tlStart.getMonth(), 1); let lim = 0;
    while (cur <= tlEnd && lim < 48) { const lbl = cur.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); const yr = cur.getFullYear().toString().slice(-2); months.push(`${lbl.charAt(0).toUpperCase()}${lbl.slice(1)} '${yr}`); cur.setMonth(cur.getMonth() + 1); lim++; }
    const ganttRows = stageData.map(s => {
      const sTs = safeParseDate(s.startDate); const eTs = safeParseDate(s.endDate);
      const left = tlDur > 0 ? Math.max(0, Math.min(100, ((sTs - tlStartTs) / tlDur) * 100)) : 0;
      const width = tlDur > 0 ? Math.max(2, Math.min(100 - left, ((eTs - sTs) / tlDur) * 100)) : 0;
      const barBg = statusColor[s.status] || '#94a3b8';
      return `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:8px 14px;border-right:1px solid #e2e8f0;white-space:nowrap;width:200px">
          <div style="font-size:11px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${s.name}</div>
          <div style="font-size:9px;color:#64748b;margin-top:2px">${fmtD(s.startDate)} a ${fmtD(s.endDate)}</div>
        </td>
        <td style="padding:8px 14px;position:relative;min-width:0">
          <div style="position:relative;height:22px;background:#f1f5f9;border-radius:4px;overflow:hidden">
            <div style="position:absolute;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;height:100%;background:${barBg};border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden">
              <div style="position:absolute;left:0;top:0;height:100%;width:${s.percent}%;background:rgba(0,0,0,0.15)"></div>
              <span style="position:relative;z-index:1;font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,0.4);padding:0 6px;white-space:nowrap">${s.percent}% (${s.duration}d)</span>
            </div>
          </div>
        </td>
        <td style="padding:8px 10px;white-space:nowrap"><span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;background:${barBg};color:#fff">${statusLabel[s.status] || s.status}</span></td>
      </tr>`;
    }).join('');
    const headerTicks = months.map(m => `<th style="min-width:60px;padding:6px 4px;font-size:8px;font-weight:600;color:#ead9b6;border-left:1px solid rgba(231,226,213,0.4);text-align:center">${m}</th>`).join('');
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cronograma Geral — ${project.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;background:#F4EEE2;font-family:Inter,sans-serif;color:#211E18}@media print{body{background:#fff}@page{size:A3 landscape;margin:8mm}}</style></head><body>
<div style="position:sticky;top:0;z-index:50;background:#13322F;padding:10px 20px;display:flex;justify-content:space-between;align-items:center">
  <span style="color:#EAD9B6;font-weight:700;font-size:14px">${project.name} — Cronograma Geral</span>
  <button onclick="window.print()" style="background:#2C6E68;color:#fff;border:0;border-radius:8px;padding:7px 16px;font-weight:700;font-size:12px;cursor:pointer">🖨 Imprimir / PDF</button>
</div>
<div style="max-width:1400px;margin:0 auto;padding:24px 20px">
  <div style="background:#fff;border-radius:12px;border:1px solid #CFC9BB;overflow:hidden;margin-bottom:20px">
    <div style="background:#13322F;padding:10px 14px;display:flex"><div style="width:200px;flex-shrink:0;font-size:10px;font-weight:600;color:#EAD9B6;text-transform:uppercase;letter-spacing:0.05em">Etapa</div><div style="flex:1;overflow:hidden"><table style="width:100%;border-collapse:collapse"><tr>${headerTicks}</tr></table></div><div style="width:120px;flex-shrink:0"></div></div>
    <table style="width:100%;border-collapse:collapse">${ganttRows}</table>
  </div>
  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #CFC9BB;text-align:center;font-size:10px;color:#6A6358">Gerado automaticamente — Buddy Construtora · ${now} · Documento para uso do cliente.</div>
</div></body></html>`;
  };

  /** Build executive HTML without financial data */
  const buildExecutiveShareHTML = (): string => {
    const progress = getProjectProgress(tasks);
    const criticalIds = getCriticalTaskIds(tasks);
    const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean) as string[]);
    const delayedTasks = tasks.filter(t => !parentIds.has(t.id) && t.status === 'delayed');
    const openConstraints = constraints.filter(c => c.status === 'open');
    const wfSummaries = computeWorkforceSummary(workforce);
    const peakWf = wfSummaries.length > 0 ? Math.max(...wfSummaries.map(s => s.total)) : 0;
    const lastPpc = history.length > 0 ? history[0].ppc : null;
    const urgentSupply = supplies.filter(p => { const d = daysUntilFn(p.orderDeadline); return d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered' && p.status !== 'cancelled'; });
    const criticalSupplies = supplies.filter(p => p.isCritical);
    const criticalTasks = tasks.filter(t => criticalIds.has(t.id) && !parentIds.has(t.id)).slice(0, 5);
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const weekday = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    const fmtDate2 = (d?: string) => { if (!d) return '—'; const [y, m, day] = (d || '').split('-'); return `${day}/${m}/${y}`; };
    const stages2 = tasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const stageTimelineData = stages2.map(stage => {
      const subs = tasks.filter(t => t.parentId === stage.id);
      const dates = subs.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
      const endDates = subs.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
      const startTs = dates.length > 0 ? Math.min(...dates) : safeParseDate(stage.startDate);
      const endTs = endDates.length > 0 ? Math.max(...endDates) : safeParseDate(stage.endDate);
      const totalWeight = subs.reduce((acc, curr) => acc + (curr.duration || 1), 0);
      const doneWeight = subs.reduce((acc, curr) => acc + ((curr.percentComplete || 0) * (curr.duration || 1)), 0);
      const percent = totalWeight > 0 ? Math.round(doneWeight / totalWeight) : stage.percentComplete;
      return { name: stage.name, startDate: new Date(startTs).toISOString().split('T')[0], endDate: new Date(endTs).toISOString().split('T')[0], percent, status: percent >= 100 ? 'completed' : (percent > 0 ? 'in_progress' : 'not_started'), duration: Math.round((endTs - startTs) / 86400000) };
    });
    const projStartDates = stageTimelineData.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
    const projEndDates = stageTimelineData.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
    const rawMinDate = projStartDates.length > 0 ? new Date(Math.min(...projStartDates)) : new Date(project.startDate || new Date());
    const rawMaxDate = projEndDates.length > 0 ? new Date(Math.max(...projEndDates)) : new Date(project.endDate || new Date());
    const timelineStart = new Date(rawMinDate.getFullYear(), rawMinDate.getMonth(), 1);
    const timelineEnd = new Date(rawMaxDate.getFullYear(), rawMaxDate.getMonth() + 1, 0);
    const projStartTs = timelineStart.getTime(); const projEndTs = timelineEnd.getTime(); const projDuration = projEndTs - projStartTs;
    const months2: { label: string; year: string }[] = [];
    const curr2 = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1); let limit2 = 0;
    while (curr2 <= timelineEnd && limit2 < 48) { const lbl = curr2.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); const yr = curr2.toLocaleDateString('pt-BR', { year: '2-digit' }); months2.push({ label: lbl.charAt(0).toUpperCase() + lbl.slice(1), year: yr }); curr2.setMonth(curr2.getMonth() + 1); limit2++; }
    // Re-use the full executive HTML generator but without the admin section
    // We build a copy of the executive HTML with financial section removed
    const execHTML = buildRawExecutiveHTML({
      project, tasks, constraints, history, supplyPackages: supplies, workforceEntries: workforce,
      excludeFinancial: true,
    });
    return execHTML;
  };

  const daysUntilFn = (d?: string) => { if (!d) return null; const t = new Date(d + 'T12:00:00'); const n = new Date(); n.setHours(12, 0, 0, 0); return Math.round((t.getTime() - n.getTime()) / 86400000); };

  /** Thin wrapper that calls the existing executive HTML builder (from ExecutiveReportTab) */
  const buildRawExecutiveHTML = (data: { project: any; tasks: any[]; constraints: any[]; history: any[]; supplyPackages: any[]; workforceEntries: any[]; excludeFinancial?: boolean }): string => {
    // Inline simplified executive builder (no financial section)
    const { project: p, tasks: tt, constraints: cc, history: hh, supplyPackages: ss, workforceEntries: ww, excludeFinancial } = data;
    const prog = getProjectProgress(tt);
    const critIds = getCriticalTaskIds(tt);
    const parIds = new Set(tt.map((t: any) => t.parentId).filter(Boolean));
    const delayed = tt.filter((t: any) => !parIds.has(t.id) && t.status === 'delayed');
    const openC = cc.filter((c: any) => c.status === 'open');
    const wfSum = computeWorkforceSummary(ww);
    const peakW = wfSum.length > 0 ? Math.max(...wfSum.map((s: any) => s.total)) : 0;
    const lastP = hh.length > 0 ? hh[0].ppc : null;
    const urgS = ss.filter((p2: any) => { const d = daysUntilFn(p2.orderDeadline); return d !== null && d <= 30 && p2.status !== 'ordered' && p2.status !== 'delivered' && p2.status !== 'cancelled'; });
    const critS = ss.filter((p2: any) => p2.isCritical);
    const critT = tt.filter((t: any) => critIds.has(t.id) && !parIds.has(t.id)).slice(0, 5);
    const now2 = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const wkd = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    const fD = (d?: string) => { if (!d) return '—'; const [y, m, day] = (d || '').split('-'); return `${day}/${m}/${y}`; };
    const stagesX = tt.filter((t: any) => !t.parentId).sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const stgTl = stagesX.map((stage: any) => {
      const subs2 = tt.filter((t: any) => t.parentId === stage.id);
      const d2 = subs2.map((s: any) => safeParseDate(s.startDate)).filter((d: any) => !isNaN(d));
      const e2 = subs2.map((s: any) => safeParseDate(s.endDate)).filter((d: any) => !isNaN(d));
      const sTs2 = d2.length > 0 ? Math.min(...d2) : safeParseDate(stage.startDate);
      const eTs2 = e2.length > 0 ? Math.max(...e2) : safeParseDate(stage.endDate);
      const tw2 = subs2.reduce((acc: number, curr: any) => acc + (curr.duration || 1), 0);
      const dw2 = subs2.reduce((acc: number, curr: any) => acc + ((curr.percentComplete || 0) * (curr.duration || 1)), 0);
      const pct2 = tw2 > 0 ? Math.round(dw2 / tw2) : stage.percentComplete;
      return { name: stage.name, startDate: new Date(sTs2).toISOString().split('T')[0], endDate: new Date(eTs2).toISOString().split('T')[0], percent: pct2, status: pct2 >= 100 ? 'completed' : (pct2 > 0 ? 'in_progress' : 'not_started'), duration: Math.round((eTs2 - sTs2) / 86400000) };
    });
    const pSD = stgTl.map((s: any) => safeParseDate(s.startDate)).filter((d: any) => !isNaN(d));
    const pED = stgTl.map((s: any) => safeParseDate(s.endDate)).filter((d: any) => !isNaN(d));
    const rMin = pSD.length > 0 ? new Date(Math.min(...pSD)) : new Date(p.startDate || new Date());
    const rMax = pED.length > 0 ? new Date(Math.max(...pED)) : new Date(p.endDate || new Date());
    const tlS = new Date(rMin.getFullYear(), rMin.getMonth(), 1); const tlE = new Date(rMax.getFullYear(), rMax.getMonth() + 1, 0);
    const tlSTs = tlS.getTime(); const tlETs = tlE.getTime(); const tlD = tlETs - tlSTs;
    const mths: { label: string; year: string }[] = []; const c3 = new Date(tlS.getFullYear(), tlS.getMonth(), 1); let l3 = 0;
    while (c3 <= tlE && l3 < 48) { const lb = c3.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); const yr = c3.toLocaleDateString('pt-BR', { year: '2-digit' }); mths.push({ label: lb.charAt(0).toUpperCase() + lb.slice(1), year: yr }); c3.setMonth(c3.getMonth() + 1); l3++; }
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Executivo — ${p.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--sea:#1C4A47;--sea2:#2C6E68;--sand:#F4EEE2;--paper:#FBF8F1;--ink:#211E18;--ink-soft:#6A6358;--timber:#7A4422;--thatch:#C49A3E;--crit:#B23A1E;--line:#CFC9BB;--grid:#E7E2D5;--ok:#2C6E68;}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:var(--sand);color:var(--ink);font-family:Inter,sans-serif;font-size:13px;line-height:1.55}.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 60px}h1,h2,h3{font-family:Archivo,sans-serif;margin:0;line-height:1.05}.mono{font-family:'IBM Plex Mono',monospace}.hero{background:linear-gradient(135deg,#13322F 0%,#1C4A47 100%);color:#F4EEE2;border-radius:14px;padding:28px 32px;position:relative;overflow:hidden;margin-bottom:24px}.hero h1{font-size:32px;font-weight:800;color:#FBF8F1}.hero .sub{color:#CBD5E0;font-size:13px;margin-top:6px}.hero .badge{position:absolute;top:16px;right:18px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;border:1px solid rgba(244,238,226,.35);padding:4px 10px;border-radius:999px;color:#EAD9B6}.hero .meta{display:flex;flex-wrap:wrap;gap:20px;margin-top:18px;border-top:1px solid rgba(244,238,226,.18);padding-top:14px;font-size:12px;color:#CFE0DB}.hero .meta b{color:#FBF8F1}.grid{display:grid;gap:14px;margin-bottom:20px}.g4{grid-template-columns:1fr 1fr 1fr 1fr}.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px 18px}.stat .v{font-family:Archivo;font-size:28px;font-weight:800;color:var(--sea)}.stat .vr{color:var(--crit)}.stat .vo{color:var(--thatch)}.stat .l{font-size:11px;color:var(--ink-soft);margin-top:4px;text-transform:uppercase;letter-spacing:.05em}.sec{margin-bottom:22px}.sec-h{font-family:Archivo;font-size:17px;font-weight:700;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid var(--grid)}table{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:8px}thead th{background:#13322F;color:#EAD9B6;text-align:left;padding:8px 10px;font-weight:600;font-size:10px;letter-spacing:.05em;text-transform:uppercase}tbody td{padding:7px 10px;border-bottom:1px solid var(--grid);font-size:12px}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:rgba(140,138,130,.04)}.tag{display:inline-block;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:600}.tg-ok{background:#d1fae5;color:#065f46}.tg-crit{background:#fee2e2;color:#991b1b}.tg-prog{background:#dbeafe;color:#1e40af}.tg-warn{background:#fef3c7;color:#92400e}.tg-n{background:#f3f4f6;color:#374151}.bar-wrap{background:var(--grid);border-radius:999px;height:8px;overflow:hidden;margin-top:4px}.bar-fill{height:100%;border-radius:999px;background:var(--sea)}.bar-ok{background:var(--ok)}.bar-crit{background:var(--crit)}.bar-warn{background:var(--thatch)}.callout{border-left:4px solid var(--thatch);background:#fbf3df;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0;font-size:12px}.callout.crit{border-left-color:var(--crit);background:#f7e7e1}.callout.ok{border-left-color:var(--ok);background:#e7f0ee}.foot{margin-top:36px;border-top:1px solid var(--line);padding-top:12px;font-size:10px;color:var(--ink-soft)}.printbtn{position:fixed;right:16px;bottom:16px;background:var(--sea);color:#fff;border:0;border-radius:999px;padding:10px 18px;font-family:Archivo;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.2)}.gantt-grid{background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-top:8px}.gantt-header{display:flex;align-items:center;background:#13322F;border-bottom:2px solid var(--line);padding:8px 14px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#EAD9B6;text-transform:uppercase;letter-spacing:0.05em}.gantt-col-lbl{width:200px;flex-shrink:0}.gantt-col-timeline{flex:1;display:flex;position:relative}.gantt-tick{flex:1;text-align:center;border-left:1px solid rgba(231,226,213,0.4);font-size:8px;line-height:1.25;color:#EAD9B6}.gantt-tick:first-child{border-left:0}.gantt-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--grid);background:var(--paper)}.gantt-row:nth-child(even){background:rgba(244,238,226,0.35)}.gantt-row:last-child{border-bottom:0}.gantt-row-lbl{width:200px;flex-shrink:0;padding-right:12px}.gantt-row-title{font-size:12px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gantt-row-sub{font-size:9px;color:var(--ink-soft);font-family:'IBM Plex Mono',monospace;margin-top:2px}.gantt-row-bar-container{flex:1;height:24px;background:rgba(244,238,226,0.2);border-radius:6px;position:relative;display:flex;align-items:center;border:1px solid rgba(207,201,187,0.3)}.gantt-row-bar{position:absolute;height:100%;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:9px;font-weight:bold;color:#FBF8F1;box-shadow:inset 0 1px 0 rgba(255,255,255,0.15),0 2px 4px rgba(0,0,0,0.15);text-shadow:0 1px 1px rgba(0,0,0,0.4)}.gantt-row-bar.completed{background:var(--sea)}.gantt-row-bar.delayed{background:var(--crit)}.gantt-row-bar.in_progress{background:var(--timber)}.gantt-row-bar.not_started{background:var(--thatch);color:var(--ink);text-shadow:none}.gantt-row-progress{height:100%;background:rgba(0,0,0,0.15);position:absolute;left:0;top:0}.gantt-row-bar-text{position:relative;z-index:10;padding:0 8px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.gantt-grid-lines{position:absolute;inset:0;display:flex;pointer-events:none}.gantt-grid-line{flex:1;border-left:1px solid rgba(207,201,187,0.25)}.gantt-grid-line:first-child{border-left:0}@media print{body{background:#fff}.wrap{padding:0}.printbtn{display:none}.card,.sec,.gantt-grid{break-inside:avoid}@page{size:A4 portrait;margin:10mm}}@media(max-width:700px){.g4{grid-template-columns:1fr 1fr}}</style></head><body>
<button class="printbtn" onclick="window.print()">🖨 Imprimir / PDF</button>
<div class="wrap">
<div class="hero"><div class="badge">Buddy Construtora · Relatório Executivo</div><h1>${p.name}</h1><div class="sub">${wkd.charAt(0).toUpperCase() + wkd.slice(1)}, ${now2}</div><div class="meta"><span>Início: <b>${fD(p.startDate)}</b></span><span>Prazo: <b>${fD(p.endDate)}</b></span><span>Progresso: <b>${prog}%</b></span>${lastP !== null ? `<span>Último PPC: <b>${lastP}%</b></span>` : ''}${delayed.length > 0 ? `<span style="color:#fca5a5">⚠ Atrasos: <b>${delayed.length}</b></span>` : '<span style="color:#6ee7b7">✓ Sem atrasos críticos</span>'}</div></div>
<div class="grid g4"><div class="card stat"><div class="v">${prog}%</div><div class="l">Progresso Geral</div><div class="bar-wrap"><div class="bar-fill ${prog < 30 ? 'bar-crit' : prog < 70 ? 'bar-warn' : 'bar-ok'}" style="width:${prog}%"></div></div></div><div class="card stat"><div class="v ${delayed.length > 0 ? 'vr' : ''}">${delayed.length}</div><div class="l">Tarefas Atrasadas</div></div><div class="card stat"><div class="v ${openC.length > 0 ? 'vo' : ''}">${openC.length}</div><div class="l">Restrições Abertas</div></div><div class="card stat"><div class="v">${lastP !== null ? lastP + '%' : '—'}</div><div class="l">Último PPC (Lean)</div></div></div>
${(delayed.length > 0 || urgS.length > 0 || openC.length > 0) ? `<div class="sec"><h2 class="sec-h">🚨 Alertas que requerem ação</h2>${urgS.length > 0 ? `<div class="callout crit"><b>Suprimentos urgentes (&lt;30d):</b> ${urgS.map((p2: any) => p2.name).join(' · ')}</div>` : ''}${delayed.length > 0 ? `<div class="callout crit"><b>${delayed.length} tarefa(s) atrasada(s):</b> ${delayed.slice(0, 5).map((t: any) => t.name).join(', ')}</div>` : ''}${openC.length > 0 ? `<div class="callout"><b>${openC.length} restrição(ões) aberta(s):</b> ${openC.slice(0, 3).map((c: any) => c.description).join(' · ')}</div>` : ''}</div>` : '<div class="callout ok" style="margin-bottom:20px"><b>✓ Nenhum alerta crítico no momento.</b></div>'}
${stgTl.length > 0 ? `<div class="sec"><h2 class="sec-h">📅 Cronograma Executivo</h2><div class="gantt-grid"><div class="gantt-header"><div class="gantt-col-lbl">Etapa da Obra</div><div class="gantt-col-timeline">${mths.map(m => `<div class="gantt-tick"><b>${m.label}</b><br/>${m.year}</div>`).join('')}</div></div>${stgTl.map((s: any) => { const sTs3 = safeParseDate(s.startDate); const eTs3 = safeParseDate(s.endDate); let l3 = 0; let w3 = 100; if (tlD > 0 && !isNaN(sTs3) && !isNaN(eTs3)) { l3 = Math.max(0, Math.min(100, ((sTs3 - tlSTs) / tlD) * 100)); w3 = Math.max(3, Math.min(100 - l3, ((eTs3 - sTs3) / tlD) * 100)); } return `<div class="gantt-row"><div class="gantt-row-lbl"><div class="gantt-row-title">${s.name}</div><div class="gantt-row-sub">${fD(s.startDate)} a ${fD(s.endDate)}</div></div><div class="gantt-row-bar-container"><div class="gantt-grid-lines">${mths.map(() => '<div class="gantt-grid-line"></div>').join('')}</div><div class="gantt-row-bar ${s.status}" style="left:${l3.toFixed(1)}%;width:${w3.toFixed(1)}%"><div class="gantt-row-progress" style="width:${s.percent}%"></div><div class="gantt-row-bar-text">${s.percent}% (${s.duration}d)</div></div></div></div>`; }).join('')}</div></div>` : ''}
${critT.length > 0 ? `<div class="sec"><h2 class="sec-h">📍 Caminho Crítico</h2><table><thead><tr><th>Tarefa</th><th>Responsável</th><th>Início</th><th>Fim</th><th>Progresso</th><th>Status</th></tr></thead><tbody>${critT.map((t: any) => `<tr><td><b>${t.name}</b></td><td>${t.responsible || '—'}</td><td class="mono">${fD(t.startDate)}</td><td class="mono">${fD(t.endDate)}</td><td>${t.percentComplete}%<div class="bar-wrap"><div class="bar-fill ${t.status === 'delayed' ? 'bar-crit' : t.status === 'completed' ? 'bar-ok' : ''}" style="width:${t.percentComplete}%"></div></div></td><td><span class="tag ${t.status === 'completed' ? 'tg-ok' : t.status === 'delayed' ? 'tg-crit' : t.status === 'in_progress' ? 'tg-prog' : 'tg-n'}">${t.status === 'completed' ? 'Concluído' : t.status === 'delayed' ? 'Atrasado' : t.status === 'in_progress' ? 'Em andamento' : 'Não iniciado'}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
${critS.length > 0 ? `<div class="sec"><h2 class="sec-h">📦 Suprimentos Críticos</h2><table><thead><tr><th>Pacote</th><th>Fornecedor</th><th>Pedir até</th><th>Lead</th><th>Entrega</th><th>Status</th></tr></thead><tbody>${critS.map((p2: any) => { const d5 = daysUntilFn(p2.orderDeadline); const isU = d5 !== null && d5 <= 30 && p2.status !== 'ordered' && p2.status !== 'delivered'; return `<tr${isU ? ' style="background:#fff7ed"' : ''}><td><b>${p2.name}</b></td><td>${p2.supplier || '—'}</td><td class="mono">${fD(p2.orderDeadline)}${isU && d5 !== null ? ` <span class="tag tg-crit">${d5 < 0 ? 'ATRASADO' : d5 + 'd'}</span>` : ''}</td><td>${p2.leadTimeDays}d</td><td class="mono">${fD(p2.expectedDeliveryDate)}</td><td><span class="tag ${p2.status === 'delivered' ? 'tg-ok' : p2.status === 'ordered' ? 'tg-prog' : 'tg-warn'}">${p2.status === 'delivered' ? 'Entregue' : p2.status === 'ordered' ? 'Pedido' : 'Ag. pedido'}</span></td></tr>`; }).join('')}</tbody></table></div>` : ''}
${wfSum.length > 0 ? `<div class="sec"><h2 class="sec-h">👷 Efetivo de Mão de Obra</h2><div class="grid g4"><div class="card stat"><div class="v">${peakW}</div><div class="l">Pico de efetivo</div></div><div class="card stat"><div class="v">${Math.round(wfSum.reduce((s: number, m: any) => s + m.total, 0) / wfSum.length)}</div><div class="l">Média mensal</div></div></div><table><thead><tr><th>Mês</th><th style="text-align:right">Próprios</th><th style="text-align:right">Terceiros</th><th style="text-align:right">Total</th></tr></thead><tbody>${wfSum.map((s: any) => `<tr${s.total === peakW && peakW > 0 ? ' style="background:#fff7ed;font-weight:600"' : ''}><td>${s.label}${s.total === peakW && peakW > 0 ? ' ▲ pico' : ''}</td><td style="text-align:right">${s.totalOwn}</td><td style="text-align:right">${s.totalThirdParty}</td><td style="text-align:right"><b>${s.total}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
${hh.length > 0 ? `<div class="sec"><h2 class="sec-h">📊 Histórico PPC (Lean)</h2><table><thead><tr><th>Semana</th><th style="text-align:right">Planejado</th><th style="text-align:right">Concluído</th><th style="text-align:right">PPC</th></tr></thead><tbody>${hh.slice(0, 8).map((h: any) => `<tr><td>${h.weekLabel}</td><td style="text-align:right">${h.planned}</td><td style="text-align:right">${h.completed}</td><td style="text-align:right"><span class="tag ${h.ppc >= 80 ? 'tg-ok' : h.ppc >= 60 ? 'tg-warn' : 'tg-crit'}">${h.ppc}%</span></td></tr>`).join('')}</tbody></table></div>` : ''}
<div class="foot">Gerado automaticamente pelo sistema Buddy Construtora · ${now2} · Os dados refletem o estado atual do projeto.</div>
</div></body></html>`;
  };

  const handleShareExecutive = async () => {
    setShareModalType('executive');
    setGeneratingShare(true);
    setLastShare(null);
    setShareModalOpen(true);
    const html = buildRawExecutiveHTML({ project, tasks, constraints, history, supplyPackages: supplies, workforceEntries: workforce, excludeFinancial: true });
    const share = await createShare(html, 'executive');
    setLastShare(share);
    setGeneratingShare(false);
  };

  const handleSharePlanejamento = async () => {
    setShareModalType('planejamento');
    setGeneratingShare(true);
    setLastShare(null);
    setShareModalOpen(true);
    const html = buildPlanejamentoShareHTML();
    const share = await createShare(html, 'planejamento');
    setLastShare(share);
    setGeneratingShare(false);
  };

  const handleShareCronograma = async () => {
    setShareModalType('cronograma-geral');
    setGeneratingShare(true);
    setLastShare(null);
    setShareModalOpen(true);
    const html = buildCronogramaShareHTML();
    const share = await createShare(html, 'cronograma-geral');
    setLastShare(share);
    setGeneratingShare(false);
  };

  // --- RELATÓRIO EXECUTIVO HTML ---
  const handleExportExecutive = () => {
    const progress = getProjectProgress(tasks);
    const criticalIds = getCriticalTaskIds(tasks);
    const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean) as string[]);
    const delayedTasks = tasks.filter(t => !parentIds.has(t.id) && t.status === 'delayed');
    const openConstraints = constraints.filter(c => c.status === 'open');
    const wfSummaries = computeWorkforceSummary(workforce);
    const peakWf = wfSummaries.length > 0 ? Math.max(...wfSummaries.map(s => s.total)) : 0;
    const lastPpc = history.length > 0 ? history[0].ppc : null;
    const criticalSupplies = supplies.filter(p => p.isCritical);

    const daysUntil = (d?: string) => {
      if (!d) return null;
      const target = new Date(d + 'T12:00:00');
      const now = new Date(); now.setHours(12, 0, 0, 0);
      return Math.round((target.getTime() - now.getTime()) / 86400000);
    };
    const urgentSupply = supplies.filter(p => {
      const d = daysUntil(p.orderDeadline);
      return d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered' && p.status !== 'cancelled';
    });
    const fmtDate = (d?: string) => {
      if (!d) return '—';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    const fmtBRL = (v?: number) => {
      if (!v) return '—';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    };

    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const weekday = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    const criticalTasks = tasks.filter(t => criticalIds.has(t.id) && !parentIds.has(t.id)).slice(0, 5);

    // ─── CÁLCULO DO CRONOGRAMA SIMPLIFICADO (GANTT) PARA O RELATÓRIO ───
    const stages = tasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const stageTimelineData = stages.map(stage => {
      const subs = tasks.filter(t => t.parentId === stage.id);
      if (subs.length === 0) {
        return {
          name: stage.name,
          startDate: stage.startDate,
          endDate: stage.endDate,
          percent: stage.percentComplete,
          status: stage.status,
          duration: stage.duration || 0
        };
      }
      
      const dates = subs.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
      const endDates = subs.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
      
      const startTs = dates.length > 0 ? Math.min(...dates) : safeParseDate(stage.startDate);
      const endTs = endDates.length > 0 ? Math.max(...endDates) : safeParseDate(stage.endDate);
      
      const totalWeight = subs.reduce((acc, curr) => acc + (curr.duration || 1), 0);
      const doneWeight = subs.reduce((acc, curr) => acc + ((curr.percentComplete || 0) * (curr.duration || 1)), 0);
      const percent = totalWeight > 0 ? Math.round(doneWeight / totalWeight) : stage.percentComplete;
      
      return {
        name: stage.name,
        startDate: new Date(startTs).toISOString().split('T')[0],
        endDate: new Date(endTs).toISOString().split('T')[0],
        percent,
        status: percent >= 100 ? 'completed' : (percent > 0 ? 'in_progress' : 'not_started'),
        duration: Math.round((endTs - startTs) / 86400000)
      };
    });

    const projStartDates = stageTimelineData.map(s => safeParseDate(s.startDate)).filter(d => !isNaN(d));
    const projEndDates = stageTimelineData.map(s => safeParseDate(s.endDate)).filter(d => !isNaN(d));
    const rawMinDate = projStartDates.length > 0 ? new Date(Math.min(...projStartDates)) : new Date(project.startDate || new Date());
    const rawMaxDate = projEndDates.length > 0 ? new Date(Math.max(...projEndDates)) : new Date(project.endDate || new Date());
    
    // Round to month bounds for clean column rendering
    const timelineStart = new Date(rawMinDate.getFullYear(), rawMinDate.getMonth(), 1);
    const timelineEnd = new Date(rawMaxDate.getFullYear(), rawMaxDate.getMonth() + 1, 0);
    
    const projStartTs = timelineStart.getTime();
    const projEndTs = timelineEnd.getTime();
    const projDuration = projEndTs - projStartTs;

    const getProjectMonths = (start: Date, end: Date) => {
      const list: { label: string; year: string }[] = [];
      const curr = new Date(start.getFullYear(), start.getMonth(), 1);
      let limit = 0;
      while (curr <= end && limit < 48) { // cap at 4 years max
        const lbl = curr.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const yr = curr.toLocaleDateString('pt-BR', { year: '2-digit' });
        list.push({
          label: lbl.charAt(0).toUpperCase() + lbl.slice(1),
          year: yr
        });
        curr.setMonth(curr.getMonth() + 1);
        limit++;
      }
      return list;
    };
    const months = getProjectMonths(timelineStart, timelineEnd);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Executivo — ${project.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{--sea:#1C4A47;--sea2:#2C6E68;--sand:#F4EEE2;--paper:#FBF8F1;--ink:#211E18;--ink-soft:#6A6358;--timber:#7A4422;--thatch:#C49A3E;--crit:#B23A1E;--line:#CFC9BB;--grid:#E7E2D5;--ok:#2C6E68;--concrete:#8C8A82;}
  *{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{margin:0;background:var(--sand);color:var(--ink);font-family:Inter,sans-serif;font-size:13px;line-height:1.55}
  .wrap{max-width:1100px;margin:0 auto;padding:24px 20px 60px}
  h1,h2,h3{font-family:Archivo,sans-serif;margin:0;line-height:1.05}
  .mono{font-family:'IBM Plex Mono',monospace}
  .hero{background:linear-gradient(135deg,#13322F 0%,#1C4A47 100%);color:#F4EEE2;border-radius:14px;padding:28px 32px;position:relative;overflow:hidden;margin-bottom:24px}
  .hero h1{font-size:36px;font-weight:800;color:#FBF8F1}
  .hero .sub{color:#CBD5E0;font-size:13px;margin-top:6px}
  .hero .badge{position:absolute;top:16px;right:18px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;border:1px solid rgba(244,238,226,.35);padding:4px 10px;border-radius:999px;color:#EAD9B6}
  .hero .meta{display:flex;flex-wrap:wrap;gap:20px;margin-top:18px;border-top:1px solid rgba(244,238,226,.18);padding-top:14px;font-size:12px;color:#CFE0DB}
  .hero .meta b{color:#FBF8F1}
  .grid{display:grid;gap:14px;margin-bottom:20px}
  .g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}.g4{grid-template-columns:1fr 1fr 1fr 1fr}
  .card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .stat .v{font-family:Archivo;font-size:28px;font-weight:800;color:var(--sea)}
  .stat .vr{color:var(--crit)}.stat .vo{color:var(--thatch)}
  .stat .l{font-size:11px;color:var(--ink-soft);margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
  .sec{margin-bottom:22px}
  .sec-h{font-family:Archivo;font-size:17px;font-weight:700;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid var(--grid)}
  table{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:8px}
  thead th{background:#13322F;color:#EAD9B6;text-align:left;padding:8px 10px;font-weight:600;font-size:10px;letter-spacing:.05em;text-transform:uppercase}
  tbody td{padding:7px 10px;border-bottom:1px solid var(--grid);font-size:12px}
  tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:rgba(140,138,130,.04)}
  .tag{display:inline-block;font-size:9px;padding:2px 7px;border-radius:999px;font-weight:600}
  .tg-ok{background:#d1fae5;color:#065f46}.tg-crit{background:#fee2e2;color:#991b1b}
  .tg-prog{background:#dbeafe;color:#1e40af}.tg-warn{background:#fef3c7;color:#92400e}.tg-n{background:#f3f4f6;color:#374151}
  .bar-wrap{background:var(--grid);border-radius:999px;height:8px;overflow:hidden;margin-top:4px}
  .bar-fill{height:100%;border-radius:999px;background:var(--sea)}
  .bar-crit{background:var(--crit)}.bar-ok{background:var(--ok)}.bar-warn{background:var(--thatch)}
  .callout{border-left:4px solid var(--thatch);background:#fbf3df;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0;font-size:12px}
  .callout.crit{border-left-color:var(--crit);background:#f7e7e1}.callout.ok{border-left-color:var(--ok);background:#e7f0ee}
  .foot{margin-top:36px;border-top:1px solid var(--line);padding-top:12px;font-size:10px;color:var(--ink-soft)}
  .printbtn{position:fixed;right:16px;bottom:16px;background:var(--sea);color:#fff;border:0;border-radius:999px;padding:10px 18px;font-family:Archivo;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.2)}
  
  /* Gantt visual styles */
  .gantt-grid { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-top: 8px; font-family: Inter, sans-serif; }
  .gantt-header { display: flex; align-items: center; background: #13322F; border-bottom: 2px solid var(--line); padding: 8px 14px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; color: #EAD9B6; text-transform: uppercase; letter-spacing: 0.05em; }
  .gantt-col-lbl { width: 200px; flex-shrink: 0; }
  .gantt-col-timeline { flex: 1; display: flex; position: relative; }
  .gantt-tick { flex: 1; text-align: center; border-left: 1px solid rgba(231, 226, 213, 0.4); font-size: 8px; line-height: 1.25; color: #EAD9B6; }
  .gantt-tick:first-child { border-left: 0; }
  .gantt-row { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--grid); background: var(--paper); }
  .gantt-row:nth-child(even) { background: rgba(244, 238, 226, 0.35); }
  .gantt-row:last-child { border-bottom: 0; }
  .gantt-row-lbl { width: 200px; flex-shrink: 0; padding-right: 12px; }
  .gantt-row-title { font-size: 12px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gantt-row-sub { font-size: 9px; color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; margin-top: 2px; }
  .gantt-row-bar-container { flex: 1; height: 24px; background: rgba(244, 238, 226, 0.2); border-radius: 6px; position: relative; display: flex; align-items: center; border: 1px solid rgba(207, 201, 187, 0.3); }
  .gantt-row-bar { position: absolute; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 9px; font-weight: bold; color: #FBF8F1; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.15); text-shadow: 0 1px 1px rgba(0,0,0,0.4); }
  .gantt-row-bar.completed { background: var(--sea); }
  .gantt-row-bar.delayed { background: var(--crit); }
  .gantt-row-bar.in_progress { background: var(--timber); }
  .gantt-row-bar.not_started { background: var(--thatch); color: var(--ink); text-shadow: none; }
  .gantt-row-progress { height: 100%; background: rgba(0,0,0,0.15); position: absolute; left: 0; top: 0; }
  .gantt-row-bar-text { position: relative; z-index: 10; padding: 0 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

  /* Gantt background grid lines */
  .gantt-grid-lines { position: absolute; inset: 0; display: flex; pointer-events: none; }
  .gantt-grid-line { flex: 1; border-left: 1px solid rgba(207, 201, 187, 0.25); }
  .gantt-grid-line:first-child { border-left: 0; }

  @media print{
    body{background:#fff}
    .wrap{padding:0}
    .printbtn{display:none}
    .card, .sec, .gantt-grid{break-inside:avoid}
    @page{size:A4 portrait;margin:10mm}
  }
  @media(max-width:700px){.g4,.g3{grid-template-columns:1fr 1fr}.g2{grid-template-columns:1fr}}
</style>
</head>
<body>
<button class="printbtn" onclick="window.print()">🖨 Imprimir / PDF</button>
<div class="wrap">
  <div class="hero">
    <div class="badge">Buddy Construtora · Relatório Executivo</div>
    <h1>${project.name}</h1>
    <div class="sub">Relatório executivo automático · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${now}</div>
    <div class="meta">
      <span>Início: <b>${fmtDate(project.startDate)}</b></span>
      <span>Prazo: <b>${fmtDate(project.endDate)}</b></span>
      <span>Progresso: <b>${progress}%</b></span>
      ${lastPpc !== null ? `<span>Último PPC: <b>${lastPpc}%</b></span>` : ''}
      ${delayedTasks.length > 0 ? `<span style="color:#fca5a5">⚠ Atrasos: <b>${delayedTasks.length}</b></span>` : '<span style="color:#6ee7b7">✓ Sem atrasos críticos</span>'}
    </div>
  </div>

  <div class="grid g4">
    <div class="card stat"><div class="v">${progress}%</div><div class="l">Progresso Geral</div>
      <div class="bar-wrap"><div class="bar-fill ${progress < 30 ? 'bar-crit' : progress < 70 ? 'bar-warn' : 'bar-ok'}" style="width:${progress}%"></div></div>
    </div>
    <div class="card stat"><div class="v ${delayedTasks.length > 0 ? 'vr' : ''}">${delayedTasks.length}</div><div class="l">Tarefas Atrasadas</div></div>
    <div class="card stat"><div class="v ${openConstraints.length > 0 ? 'vo' : ''}">${openConstraints.length}</div><div class="l">Restrições Abertas</div></div>
    <div class="card stat"><div class="v">${lastPpc !== null ? lastPpc + '%' : '—'}</div><div class="l">Último PPC (Lean)</div></div>
  </div>

  ${(delayedTasks.length > 0 || urgentSupply.length > 0 || openConstraints.length > 0) ? `
  <div class="sec">
    <h2 class="sec-h">🚨 Alertas que requerem ação</h2>
    ${urgentSupply.length > 0 ? `<div class="callout crit"><b>Suprimentos com prazo urgente (&lt;30 dias):</b> ${urgentSupply.map(p => p.name + (p.orderDeadline ? ` (até ${fmtDate(p.orderDeadline)})` : '')).join(' · ')}</div>` : ''}
    ${delayedTasks.length > 0 ? `<div class="callout crit"><b>${delayedTasks.length} tarefa${delayedTasks.length > 1 ? 's atrasadas' : ' atrasada'}:</b> ${delayedTasks.slice(0, 5).map(t => t.name).join(', ')}${delayedTasks.length > 5 ? ` e mais ${delayedTasks.length - 5}...` : ''}</div>` : ''}
    ${openConstraints.length > 0 ? `<div class="callout"><b>${openConstraints.length} restrição${openConstraints.length > 1 ? 'ões' : ''} aberta${openConstraints.length > 1 ? 's' : ''}:</b> ${openConstraints.slice(0, 3).map(c => c.description).join(' · ')}</div>` : ''}
  </div>` : `<div class="callout ok" style="margin-bottom:20px"><b>✓ Nenhum alerta crítico no momento.</b> Obra dentro do previsto.</div>`}

  <!-- Cronograma Gantt Simplificado -->
  ${stageTimelineData.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📅 Cronograma Executivo (Etapas Principais)</h2>
    <div class="gantt-grid">
      <div class="gantt-header">
        <div class="gantt-col-lbl">Etapa da Obra</div>
        <div class="gantt-col-timeline">
          ${months.map(m => `<div class="gantt-tick"><b>${m.label}</b><br/>${m.year}</div>`).join('')}
        </div>
      </div>
      ${stageTimelineData.map(s => {
        const startTs = safeParseDate(s.startDate);
        const endTs = safeParseDate(s.endDate);
        let left = 0;
        let width = 100;
        if (projDuration > 0 && !isNaN(startTs) && !isNaN(endTs)) {
          left = Math.max(0, Math.min(100, ((startTs - projStartTs) / projDuration) * 100));
          width = Math.max(3, Math.min(100 - left, ((endTs - startTs) / projDuration) * 100));
        }
        return `
        <div class="gantt-row">
          <div class="gantt-row-lbl">
            <div class="gantt-row-title">${s.name}</div>
            <div class="gantt-row-sub">${fmtDate(s.startDate)} a ${fmtDate(s.endDate)}</div>
          </div>
          <div class="gantt-row-bar-container">
            <div class="gantt-grid-lines">
              ${months.map(() => `<div class="gantt-grid-line"></div>`).join('')}
            </div>
            <div class="gantt-row-bar ${s.status}" style="left:${left.toFixed(1)}%; width:${width.toFixed(1)}%">
              <div class="gantt-row-progress" style="width:${s.percent}%"></div>
              <div class="gantt-row-bar-text">${s.percent}% (${s.duration}d)</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  ${criticalTasks.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📍 Caminho Crítico</h2>
    <table><thead><tr><th>Tarefa</th><th>Responsável</th><th>Início</th><th>Fim</th><th>Progresso</th><th>Status</th></tr></thead><tbody>
    ${criticalTasks.map(t => `<tr>
      <td><b>${t.name}</b></td><td>${t.responsible || '—'}</td>
      <td class="mono">${fmtDate(t.startDate)}</td><td class="mono">${fmtDate(t.endDate)}</td>
      <td>${t.percentComplete}%<div class="bar-wrap"><div class="bar-fill ${t.status === 'delayed' ? 'bar-crit' : t.status === 'completed' ? 'bar-ok' : ''}" style="width:${t.percentComplete}%"></div></div></td>
      <td><span class="tag ${t.status === 'completed' ? 'tg-ok' : t.status === 'delayed' ? 'tg-crit' : t.status === 'in_progress' ? 'tg-prog' : 'tg-n'}">${t.status === 'completed' ? 'Concluído' : t.status === 'delayed' ? 'Atrasado' : t.status === 'in_progress' ? 'Em andamento' : 'Não iniciado'}</span></td>
    </tr>`).join('')}
    </tbody></table>
  </div>` : ''}

  ${criticalSupplies.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📦 Suprimentos Críticos</h2>
    <table><thead><tr><th>Pacote</th><th>Fornecedor</th><th>Pedir até</th><th>Lead</th><th>Entrega Prevista</th><th>Status</th></tr></thead><tbody>
    ${criticalSupplies.map(p => {
      const d = daysUntil(p.orderDeadline);
      const isU = d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered';
      return `<tr${isU ? ' style="background:#fff7ed"' : ''}><td><b>${p.name}</b></td><td>${p.supplier || '—'}</td>
        <td class="mono">${fmtDate(p.orderDeadline)}${isU && d !== null ? ` <span class="tag tg-crit">${d < 0 ? 'ATRASADO' : d + 'd'}</span>` : ''}</td>
        <td>${p.leadTimeDays}d</td><td class="mono">${fmtDate(p.expectedDeliveryDate)}</td>
        <td><span class="tag ${p.status === 'delivered' ? 'tg-ok' : p.status === 'ordered' || p.status === 'in_production' ? 'tg-prog' : 'tg-warn'}">${p.status === 'delivered' ? 'Entregue' : p.status === 'ordered' ? 'Pedido' : p.status === 'in_production' ? 'Em produção' : 'Ag. pedido/QTO'}</span></td>
      </tr>`;
    }).join('')}
    </tbody></table>
  </div>` : ''}

  ${wfSummaries.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">👷 Efetivo de Mão de Obra</h2>
    <div class="grid g4">
      <div class="card stat"><div class="v">${peakWf}</div><div class="l">Pico de efetivo</div></div>
      <div class="card stat"><div class="v">${Math.round(wfSummaries.reduce((s,m)=>s+m.total,0)/wfSummaries.length)}</div><div class="l">Média mensal</div></div>
      <div class="card stat"><div class="v">${wfSummaries.reduce((s,m)=>s+m.totalOwn,0)}</div><div class="l">Total acum. próprios</div></div>
      <div class="card stat"><div class="v">${wfSummaries.reduce((s,m)=>s+m.totalThirdParty,0)}</div><div class="l">Total acum. terceiros</div></div>
    </div>
    <table><thead><tr><th>Mês</th><th style="text-align:right">Próprios</th><th style="text-align:right">Terceiros</th><th style="text-align:right">Total</th></tr></thead><tbody>
    ${wfSummaries.map(s=>`<tr${s.total===peakWf&&peakWf>0?' style="font-weight:600;background:#fff7ed"':''}>
      <td>${s.label}${s.total===peakWf&&peakWf>0?' ▲ pico':''}</td>
      <td style="text-align:right">${s.totalOwn}</td><td style="text-align:right">${s.totalThirdParty}</td><td style="text-align:right"><b>${s.total}</b></td>
    </tr>`).join('')}
    </tbody></table>
  </div>` : ''}

  ${history.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📊 Histórico PPC (Lean)</h2>
    <table><thead><tr><th>Semana</th><th style="text-align:right">Planejado</th><th style="text-align:right">Concluído</th><th style="text-align:right">PPC</th></tr></thead><tbody>
    ${history.slice(0,8).map(h=>`<tr>
      <td>${h.weekLabel}</td><td style="text-align:right">${h.planned}</td><td style="text-align:right">${h.completed}</td>
      <td style="text-align:right"><span class="tag ${h.ppc>=80?'tg-ok':h.ppc>=60?'tg-warn':'tg-crit'}">${h.ppc}%</span></td>
    </tr>`).join('')}
    </tbody></table>
  </div>` : ''}

  <div class="foot">Gerado automaticamente pelo sistema Buddy Construtora · ${now} · Os dados refletem o estado atual do projeto no momento da geração.</div>
</div>
</body>
</html>`;

    try {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
        toast.success('Relatório executivo aberto em nova aba!');
      } else {
        throw new Error('Blocked');
      }
    } catch (e) {
      // Fallback: download as HTML file
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_Executivo_${project.name}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.info('Seu navegador bloqueou a nova aba. O relatório foi baixado como arquivo HTML (dê dois cliques nele para abrir!).', { duration: 6000 });
    }
  };

  const reports = [

    {
      id: 'planejamento',
      title: 'Planejamento de Tarefas',
      description: 'Lista completa de tarefas com status, responsáveis e datas.',
      icon: TableProperties,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      action: handleExportPlanejamento
    },
    {
      id: 'gantt',
      title: 'Cronograma (Gantt)',
      description: 'Estrutura de tarefas agrupadas por macroetapas com dependências.',
      icon: GanttChart,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      action: handleExportGantt
    },
    {
      id: 'frentes',
      title: 'Frentes de Serviço',
      description: 'Detalhamento operacional das frentes de serviço atreladas às atividades.',
      icon: Briefcase,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
      action: handleExportFrentes
    },
    {
      id: 'restricoes',
      title: 'Restrições do Lean',
      description: 'Histórico de restrições de obra, responsáveis e status de resolução.',
      icon: Triangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      action: handleExportConstraints
    },
    {
      id: 'diario',
      title: 'Diário de Obra (Mensal)',
      description: 'Reúne os relatos diários agrupados pelo mês selecionado.',
      icon: FileText,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      action: handleExportDiary,
      extra: (
        <div className="mt-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Selecione o Mês</label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      )
    },
    {
      id: 'admin',
      title: 'Administração e Financeiro',
      description: 'Resumo do contrato, saldo a faturar e histórico de recebimentos.',
      icon: Wallet,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      action: handleExportAdmin
    },
    {
      id: 'executive',
      title: 'Relatório Executivo',
      description: 'Documento HTML premium com visão completa da obra: caminho crítico, suprimentos, efetivo e alertas. Pronto para imprimir ou salvar como PDF.',
      icon: FileBarChart,
      color: 'text-teal-600',
      bg: 'bg-teal-500/10',
      action: (_fmt: 'pdf' | 'excel') => handleExportExecutive()
    }
  ];

  const navigate = useNavigate();

  // Relatórios HTML dedicados (abrem em nova aba via rota React)
  const htmlReports = [
    {
      id: 'html-planejamento',
      title: 'Planejamento da Obra (HTML)',
      description: 'Tabela hierárquica completa de etapas e subetapas com datas, responsáveis, predecessoras e caminho crítico. Pronto para imprimir ou salvar como PDF.',
      icon: LayoutList,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
      href: `/relatorio-planejamento/${project.id}`
    },
    {
      id: 'html-planejamento-geral',
      title: 'Planejamento Geral — Todas as Obras (HTML)',
      description: 'Relatório consolidado de planejamento de todas as obras ativas, organizado por projeto com tabelas hierárquicas individuais. Ideal para reuniões de diretoria.',
      icon: Globe,
      color: 'text-indigo-600',
      bg: 'bg-indigo-500/10',
      href: `/relatorio-planejamento-geral`
    },
    {
      id: 'html-cronograma-geral',
      title: 'Cronograma Geral — Todas as Obras (HTML)',
      description: 'Gantt consolidado com linha do tempo de etapas principais de todas as obras ativas. Excelente para visualização cronológica macro.',
      icon: CalendarDays,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      href: `/relatorio-cronograma-geral`
    },
    {
      id: 'html-fisico-financeiro',
      title: 'Cronograma Físico-Financeiro (HTML)',
      description: 'Matriz mensal de desembolso planejado × realizado por etapa e subetapa, com resumo de orçamento, realizado e desvio financeiro. Pronto para impressão.',
      icon: BarChart3,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      href: `/relatorio-fisico-financeiro/${project.id}`
    }
  ];

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="bg-muted/20 border rounded-2xl p-6">
        <h2 className="text-2xl font-black font-display mb-2">Central de Relatórios</h2>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Exporte os dados do seu projeto em formato Excel para análise avançada ou em PDF estático para compartilhar com clientes e stakeholders. Os PDFs já vêm formatados com a identidade visual da construtora.
        </p>
      </div>

      {/* Relatórios HTML Imprimíveis */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Relatórios HTML Imprimíveis</h3>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">NOVO</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {htmlReports.map((rep) => {
            const shareHandler = rep.id === 'html-planejamento' ? handleSharePlanejamento : rep.id === 'html-cronograma-geral' ? handleShareCronograma : null;
            return (
              <div key={rep.id} className="card-elevated p-5 flex flex-col justify-between border-l-4 border-l-transparent hover:border-l-primary transition-all group">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rep.bg}`}>
                      <rep.icon className={`w-5 h-5 ${rep.color}`} />
                    </div>
                    <h4 className="font-bold text-sm leading-tight">{rep.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{rep.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 font-bold text-xs gap-1.5 h-9 rounded-lg shadow-sm transition-all"
                    onClick={() => window.open(rep.href, '_blank')}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Abrir HTML
                  </Button>
                  {shareHandler && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 gap-1.5 font-bold text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                      onClick={shareHandler}
                      title="Gerar link para cliente"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Link
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="card-elevated p-6 flex flex-col justify-between group">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${report.bg}`}>
                  <report.icon className={`w-6 h-6 ${report.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{report.title}</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {report.description}
              </p>
              
              {report.extra && report.extra}
            </div>

            {report.id === 'gantt' ? (
              <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-border">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-bold text-[10px] gap-1 px-1 border-dashed"
                  onClick={() => alert("Para exportar o gráfico de linhas do tempo (Gantt) em alta resolução com as cores e detalhes, acesse a aba 'Gantt' e clique no novo botão azul 'Salvar PDF Visual' no canto superior direito.")}
                >
                  <Download className="w-3 h-3" />
                  Visual
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-bold text-[10px] gap-1 px-1"
                  onClick={() => report.action('pdf')}
                >
                  <FileText className="w-3 h-3" />
                  Tabela
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-bold text-[10px] gap-1 px-1"
                  onClick={() => report.action('excel')}
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  Excel
                </Button>
              </div>
            ) : report.id === 'executive' ? (
              <div className="mt-6 pt-4 border-t border-border space-y-2">
                <Button 
                  size="sm" 
                  className="w-full font-bold text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm h-9 transition-colors"
                  onClick={() => report.action('pdf')}
                >
                  <FileBarChart className="w-4 h-4" />
                  Gerar HTML / Imprimir Relatório
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full font-bold text-xs gap-1.5 h-9 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                  onClick={handleShareExecutive}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  🔗 Gerar Link para Cliente
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-border">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-bold text-xs gap-1.5"
                  onClick={() => report.action('pdf')}
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-bold text-xs gap-1.5"
                  onClick={() => report.action('excel')}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Shared links list */}
      {shares.length > 0 && (
        <div className="card-elevated p-5">
          <SharedReportsList
            shares={shares}
            onRevoke={revokeShare}
            onReactivate={reactivateShare}
            loading={sharesLoading}
          />
        </div>
      )}

    </div>
    <ShareReportModal
      open={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
      share={lastShare}
      reportType={shareModalType}
      isGenerating={generatingShare}
    />
    </>
  );
}


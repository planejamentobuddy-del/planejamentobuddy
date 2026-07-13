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
  CalendarDays, Briefcase, FileBarChart, Globe, LayoutList, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
          {htmlReports.map((rep) => (
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
              <Button
                size="sm"
                className={`w-full font-bold text-xs gap-1.5 h-9 rounded-lg shadow-sm transition-all`}
                onClick={() => window.open(rep.href, '_blank')}
              >
                <Globe className="w-3.5 h-3.5" />
                Abrir Relatório HTML
              </Button>
            </div>
          ))}
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
              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  size="sm" 
                  className="w-full font-bold text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm h-9 transition-colors"
                  onClick={() => report.action('pdf')}
                >
                  <FileBarChart className="w-4 h-4" />
                  Gerar HTML / Imprimir Relatório
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

    </div>
  );
}

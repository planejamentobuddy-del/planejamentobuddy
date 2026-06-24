import { useMemo } from 'react';
import { Project, Task, Constraint, WeeklyHistory, SupplyPackage, WorkforceEntry, getCriticalTaskIds, getProjectProgress, computeWorkforceSummary } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { FileText, Download, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, ShoppingCart, Star } from 'lucide-react';
import { toast } from 'sonner';

function formatBRL(v?: number) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

interface ReportData {
  project: Project;
  tasks: Task[];
  constraints: Constraint[];
  history: WeeklyHistory[];
  supplyPackages: SupplyPackage[];
  workforceEntries: WorkforceEntry[];
}

function buildReportHTML(data: ReportData): string {
  const { project, tasks, constraints, history, supplyPackages, workforceEntries } = data;

  const progress = getProjectProgress(tasks);
  const criticalIds = getCriticalTaskIds(tasks);
  const parentIds = new Set(tasks.map(t => t.parentId).filter(Boolean) as string[]);
  const delayedTasks = tasks.filter(t => !parentIds.has(t.id) && t.status === 'delayed');
  const openConstraints = constraints.filter(c => c.status === 'open');
  const urgentSupply = supplyPackages.filter(p => {
    const d = daysUntil(p.orderDeadline);
    return d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered' && p.status !== 'cancelled';
  });
  const wfSummaries = computeWorkforceSummary(workforceEntries);
  const peakWf = wfSummaries.length > 0 ? Math.max(...wfSummaries.map(s => s.total)) : 0;
  const lastPpc = history.length > 0 ? history[0].ppc : null;

  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const weekLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });

  // Critical path tasks (top 5)
  const criticalTasks = tasks.filter(t => criticalIds.has(t.id) && !parentIds.has(t.id)).slice(0, 5);

  // Status color helper
  const statusBg = (s: string) => {
    if (s === 'completed') return '#d1fae5; color:#065f46';
    if (s === 'delayed') return '#fee2e2; color:#991b1b';
    if (s === 'in_progress') return '#dbeafe; color:#1e40af';
    return '#f3f4f6; color:#374151';
  };

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

  return `<!DOCTYPE html>
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
  .hero .sub{color:#CBD5E0;font-size:13px;margin-top:6px;max-width:600px}
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
  thead th{background:#13322F;color:#EAD9B6;text-align:left;padding:8px 10px;font-weight:600;font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace}
  tbody td{padding:7px 10px;border-bottom:1px solid var(--grid);font-size:12px;vertical-align:middle}
  tbody tr:last-child td{border-bottom:0}
  tbody tr:nth-child(even){background:rgba(140,138,130,.04)}
  .tag{display:inline-block;font-size:9px;padding:2px 7px;border-radius:999px;font-family:'IBM Plex Mono',monospace;font-weight:600}
  .tg-ok{background:#d1fae5;color:#065f46}.tg-crit{background:#fee2e2;color:#991b1b}
  .tg-progress{background:#dbeafe;color:#1e40af}.tg-warn{background:#fef3c7;color:#92400e}.tg-neutral{background:#f3f4f6;color:#374151}
  .bar-wrap{background:var(--grid);border-radius:999px;height:8px;overflow:hidden;margin-top:4px}
  .bar-fill{height:100%;border-radius:999px;background:var(--sea)}
  .bar-fill.crit{background:var(--crit)}.bar-fill.ok{background:var(--ok)}.bar-fill.warn{background:var(--thatch)}
  .callout{border-left:4px solid var(--thatch);background:#fbf3df;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0;font-size:12px}
  .callout.crit{border-left-color:var(--crit);background:#f7e7e1}
  .callout.ok{border-left-color:var(--ok);background:#e7f0ee}
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
    .wrap{max-width:100%;padding:0}
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
    <div class="sub">Relatório executivo automático · ${weekLabel.charAt(0).toUpperCase() + weekLabel.slice(1)}, ${now}</div>
    <div class="meta">
      <span>Início: <b>${formatDate(project.startDate)}</b></span>
      <span>Prazo: <b>${formatDate(project.endDate)}</b></span>
      <span>Progresso: <b>${progress}%</b></span>
      ${lastPpc !== null ? `<span>Último PPC: <b>${lastPpc}%</b></span>` : ''}
      ${delayedTasks.length > 0 ? `<span style="color:#fca5a5">⚠ Atrasos: <b>${delayedTasks.length}</b></span>` : '<span style="color:#6ee7b7">✓ Sem atrasos críticos</span>'}
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid g4">
    <div class="card stat">
      <div class="v">${progress}%</div>
      <div class="l">Progresso Geral</div>
      <div class="bar-wrap"><div class="bar-fill ${progress < 30 ? 'crit' : progress < 70 ? 'warn' : 'ok'}" style="width:${progress}%"></div></div>
    </div>
    <div class="card stat">
      <div class="v ${delayedTasks.length > 0 ? 'vr' : ''}">${delayedTasks.length}</div>
      <div class="l">Tarefas Atrasadas</div>
    </div>
    <div class="card stat">
      <div class="v ${openConstraints.length > 0 ? 'vo' : ''}">${openConstraints.length}</div>
      <div class="l">Restrições Abertas</div>
    </div>
    <div class="card stat">
      <div class="v">${lastPpc !== null ? lastPpc + '%' : '—'}</div>
      <div class="l">Último PPC (Lean)</div>
    </div>
  </div>

  <!-- Alertas Críticos -->
  ${(delayedTasks.length > 0 || urgentSupply.length > 0 || openConstraints.length > 0) ? `
  <div class="sec">
    <h2 class="sec-h">🚨 Alertas que requerem ação</h2>
    ${urgentSupply.length > 0 ? `
    <div class="callout crit">
      <b>Suprimentos com prazo urgente de compra (&lt;30 dias):</b>
      ${urgentSupply.map(p => `${p.name}${p.orderDeadline ? ` (pedir até ${formatDate(p.orderDeadline)})` : ''}`).join(' · ')}
    </div>` : ''}
    ${delayedTasks.length > 0 ? `
    <div class="callout crit">
      <b>${delayedTasks.length} tarefa${delayedTasks.length > 1 ? 's atrasadas' : ' atrasada'}:</b>
      ${delayedTasks.slice(0, 5).map(t => t.name).join(', ')}${delayedTasks.length > 5 ? ` e mais ${delayedTasks.length - 5}...` : ''}
    </div>` : ''}
    ${openConstraints.length > 0 ? `
    <div class="callout">
      <b>${openConstraints.length} restrição${openConstraints.length > 1 ? 'ões' : ''} aberta${openConstraints.length > 1 ? 's' : ''}:</b>
      ${openConstraints.slice(0, 3).map(c => c.description).join(' · ')}
    </div>` : ''}
  </div>` : `
  <div class="callout ok" style="margin-bottom:20px"><b>✓ Nenhum alerta crítico no momento.</b> Obra dentro do previsto.</div>`}

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
            <div class="gantt-row-sub">${formatDate(s.startDate)} a ${formatDate(s.endDate)}</div>
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

  <!-- Caminho Crítico -->
  ${criticalTasks.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📍 Caminho Crítico (principais elos)</h2>
    <table>
      <thead><tr><th>Tarefa</th><th>Responsável</th><th>Início</th><th>Fim</th><th>Progresso</th><th>Status</th></tr></thead>
      <tbody>
        ${criticalTasks.map(t => `
        <tr>
          <td><b>${t.name}</b></td>
          <td>${t.responsible || '—'}</td>
          <td class="mono">${formatDate(t.startDate)}</td>
          <td class="mono">${formatDate(t.endDate)}</td>
          <td>
            ${t.percentComplete}%
            <div class="bar-wrap"><div class="bar-fill ${t.status === 'delayed' ? 'crit' : t.status === 'completed' ? 'ok' : ''}" style="width:${t.percentComplete}%"></div></div>
          </td>
          <td><span class="tag ${t.status === 'completed' ? 'tg-ok' : t.status === 'delayed' ? 'tg-crit' : t.status === 'in_progress' ? 'tg-progress' : 'tg-neutral'}">${t.status === 'completed' ? 'Concluído' : t.status === 'delayed' ? 'Atrasado' : t.status === 'in_progress' ? 'Em andamento' : 'Não iniciado'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Suprimentos Críticos -->
  ${supplyPackages.filter(p => p.isCritical).length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📦 Suprimentos Críticos</h2>
    <table>
      <thead><tr><th>Pacote</th><th>Fornecedor</th><th>Pedir até</th><th>Lead</th><th>Entrega Prevista</th><th>Status</th></tr></thead>
      <tbody>
        ${supplyPackages.filter(p => p.isCritical).map(p => {
          const d = daysUntil(p.orderDeadline);
          const isUrgent = d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered';
          return `<tr${isUrgent ? ' style="background:#fff7ed"' : ''}>
            <td><b>${p.name}</b></td>
            <td>${p.supplier || '—'}</td>
            <td class="mono">${formatDate(p.orderDeadline)}${isUrgent && d !== null ? ` <span class="tag tg-crit">${d < 0 ? 'ATRASADO' : d + 'd'}</span>` : ''}</td>
            <td>${p.leadTimeDays}d</td>
            <td class="mono">${formatDate(p.expectedDeliveryDate)}</td>
            <td><span class="tag ${p.status === 'delivered' ? 'tg-ok' : p.status === 'ordered' || p.status === 'in_production' ? 'tg-progress' : 'tg-warn'}">${
              p.status === 'delivered' ? 'Entregue' :
              p.status === 'ordered' ? 'Pedido' :
              p.status === 'in_production' ? 'Em produção' :
              p.status === 'pending_order' ? 'Ag. pedido' : 'Ag. QTO'
            }</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Efetivo -->
  ${wfSummaries.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">👷 Efetivo de Mão de Obra</h2>
    <div class="grid g4">
      <div class="card stat"><div class="v">${peakWf}</div><div class="l">Pico de efetivo</div></div>
      <div class="card stat"><div class="v">${Math.round(wfSummaries.reduce((s,m)=>s+m.total,0)/wfSummaries.length)}</div><div class="l">Média mensal</div></div>
      <div class="card stat"><div class="v">${wfSummaries.reduce((s,m)=>s+m.totalOwn,0)}</div><div class="l">Total acum. próprios</div></div>
      <div class="card stat"><div class="v">${wfSummaries.reduce((s,m)=>s+m.totalThirdParty,0)}</div><div class="l">Total acum. terceiros</div></div>
    </div>
    <table>
      <thead><tr><th>Mês</th><th style="text-align:right">Próprios</th><th style="text-align:right">Terceiros</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${wfSummaries.map(s => `
        <tr${s.total === peakWf && peakWf > 0 ? ' style="background:#fff7ed;font-weight:600"' : ''}>
          <td>${s.label}${s.total === peakWf && peakWf > 0 ? ' ▲ pico' : ''}</td>
          <td style="text-align:right">${s.totalOwn}</td>
          <td style="text-align:right">${s.totalThirdParty}</td>
          <td style="text-align:right"><b>${s.total}</b></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Histórico PPC -->
  ${history.length > 0 ? `
  <div class="sec">
    <h2 class="sec-h">📊 Histórico PPC (Lean)</h2>
    <table>
      <thead><tr><th>Semana</th><th style="text-align:right">Planejado</th><th style="text-align:right">Concluído</th><th style="text-align:right">PPC</th></tr></thead>
      <tbody>
        ${history.slice(0, 8).map(h => `
        <tr>
          <td>${h.weekLabel}</td>
          <td style="text-align:right">${h.planned}</td>
          <td style="text-align:right">${h.completed}</td>
          <td style="text-align:right"><b><span class="tag ${h.ppc >= 80 ? 'tg-ok' : h.ppc >= 60 ? 'tg-warn' : 'tg-crit'}">${h.ppc}%</span></b></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="foot">
    Gerado automaticamente pelo sistema Buddy Construtora · ${now} · Os dados refletem o estado atual do projeto no momento da geração.
  </div>
</div>
</body>
</html>`;
}

export default function ExecutiveReportTab({ project }: { project: Project }) {
  const {
    getTasksForProject, getConstraintsForProject, getHistoryForProject,
    supplyPackages, workforceEntries
  } = useProjects();

  const tasks = getTasksForProject(project.id);
  const constraints = getConstraintsForProject(project.id);
  const history = getHistoryForProject(project.id);
  const supplies = useMemo(() => supplyPackages.filter(p => p.projectId === project.id), [supplyPackages, project.id]);
  const workforce = useMemo(() => workforceEntries.filter(e => e.projectId === project.id), [workforceEntries, project.id]);

  const progress = getProjectProgress(tasks);
  const criticalIds = getCriticalTaskIds(tasks);
  const delayedTasks = tasks.filter(t => t.status === 'delayed');
  const openConstraints = constraints.filter(c => c.status === 'open');
  const criticalSupplies = supplies.filter(p => p.isCritical);
  const urgentSupply = supplies.filter(p => {
    const d = daysUntil(p.orderDeadline);
    return d !== null && d <= 30 && p.status !== 'ordered' && p.status !== 'delivered' && p.status !== 'cancelled';
  });
  const lastPpc = history.length > 0 ? history[0].ppc : null;
  const wfSummaries = computeWorkforceSummary(workforce);
  const peakWf = wfSummaries.length > 0 ? Math.max(...wfSummaries.map(s => s.total)) : 0;

  function handleOpenReport() {
    const html = buildReportHTML({ project, tasks, constraints, history, supplyPackages: supplies, workforceEntries: workforce });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    toast.success('Relatório executivo aberto em nova aba!');
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Relatório Executivo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumo automático do estado atual da obra para gestores e clientes
          </p>
        </div>
        <Button onClick={handleOpenReport} className="gap-2 rounded-xl text-sm">
          <Download className="w-4 h-4" /> Gerar Relatório (HTML/PDF)
        </Button>
      </div>

      {/* Preview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Progresso Geral', value: `${progress}%`, icon: TrendingUp, color: progress < 30 ? 'text-red-600' : progress < 70 ? 'text-amber-600' : 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: 'Tarefas Atrasadas', value: delayedTasks.length, icon: AlertTriangle, color: delayedTasks.length > 0 ? 'text-red-600' : 'text-emerald-600', bg: delayedTasks.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10' },
          { label: 'Restrições Abertas', value: openConstraints.length, icon: Clock, color: openConstraints.length > 0 ? 'text-amber-600' : 'text-emerald-600', bg: 'bg-amber-500/10' },
          { label: 'Último PPC', value: lastPpc !== null ? `${lastPpc}%` : '—', icon: CheckCircle2, color: lastPpc !== null && lastPpc < 60 ? 'text-red-600' : 'text-emerald-600', bg: 'bg-blue-500/10' },
        ].map((k, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold font-display ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Preview */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Critical Path Preview */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-600" /> Caminho Crítico ({criticalIds.size} tarefas)
          </h3>
          <div className="space-y-2">
            {tasks.filter(t => criticalIds.has(t.id)).slice(0, 4).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'completed' ? 'bg-emerald-500' : t.status === 'delayed' ? 'bg-red-500' : 'bg-blue-500'}`} />
                <span className="flex-1 truncate font-medium">{t.name}</span>
                <span className="text-muted-foreground shrink-0">{t.percentComplete}%</span>
              </div>
            ))}
            {criticalIds.size === 0 && <p className="text-xs text-muted-foreground">Sem dependências configuradas</p>}
          </div>
        </div>

        {/* Urgent Supply Preview */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-600" /> Suprimentos ({urgentSupply.length} urgentes)
          </h3>
          <div className="space-y-2">
            {urgentSupply.slice(0, 4).map(p => {
              const d = daysUntil(p.orderDeadline);
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <Star className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className={`shrink-0 font-bold ${d !== null && d < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {d !== null && d < 0 ? `${Math.abs(d)}d atraso` : `${d}d`}
                  </span>
                </div>
              );
            })}
            {urgentSupply.length === 0 && <p className="text-xs text-muted-foreground">Nenhum suprimento urgente</p>}
          </div>
        </div>

        {/* Workforce Preview */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Efetivo (pico: {peakWf} pessoas)
          </h3>
          <div className="space-y-1.5">
            {wfSummaries.slice(-4).map(s => (
              <div key={s.month} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 text-muted-foreground">{s.label}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full"
                    style={{ width: peakWf > 0 ? `${(s.total / peakWf) * 100}%` : '0%' }}
                  />
                </div>
                <span className="w-8 text-right font-semibold">{s.total}</span>
              </div>
            ))}
            {wfSummaries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados de efetivo cadastrados</p>}
          </div>
        </div>

        {/* Constraints Preview */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Restrições ({openConstraints.length} abertas)
          </h3>
          <div className="space-y-2">
            {openConstraints.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-0.5" />
                <span className="flex-1 truncate">{c.description}</span>
                <span className="text-muted-foreground shrink-0">{c.responsible || '—'}</span>
              </div>
            ))}
            {openConstraints.length === 0 && <p className="text-xs text-muted-foreground text-emerald-600">✓ Nenhuma restrição aberta</p>}
          </div>
        </div>
      </div>

      {/* Generate button (repeat for visibility) */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6 text-center">
        <FileText className="w-10 h-10 text-primary mx-auto mb-3" />
        <h3 className="font-display font-semibold text-foreground mb-1">Relatório Executivo Completo</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Gera um documento HTML premium com todos os dados da obra, pronto para imprimir ou salvar como PDF.
          Inclui caminho crítico, suprimentos, efetivo, PPC e alertas.
        </p>
        <Button onClick={handleOpenReport} size="lg" className="gap-2 rounded-xl">
          <Download className="w-5 h-5" /> Gerar e Abrir Relatório
        </Button>
      </div>
    </div>
  );
}

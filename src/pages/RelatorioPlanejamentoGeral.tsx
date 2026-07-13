import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { getProjectProgress } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Building2 } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não Iniciado',
  in_progress:  'Em Andamento',
  completed:    'Concluído',
  delayed:      'Atrasado',
  rescheduled:  'Replanejado',
};

const STATUS_COLOR: Record<string, string> = {
  not_started: '#64748B',
  in_progress:  '#2563EB',
  completed:    '#16A34A',
  delayed:      '#DC2626',
  rescheduled:  '#D97706',
};

// ─── component ───────────────────────────────────────────────────────────────

export default function RelatorioPlanejamentoGeral() {
  const { projects, getTasksForProject, tasks, loading } = useProjects();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-slate-500 text-lg font-medium animate-pulse">
          Carregando relatório…
        </div>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status !== 'archived');

  // Build per-project task data
  const projectData = activeProjects.map(p => {
    const allTasks = getTasksForProject(p.id);
    const stages   = allTasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const subtasks = allTasks.filter(t =>  t.parentId);

    // Planned end = max endDate across ALL tasks of this project
    const allEndDates = allTasks.map(t => t.endDate).filter(Boolean).sort();
    const plannedEnd  = allEndDates.length ? allEndDates[allEndDates.length - 1] : p.endDate;

    // Overall project progress (leaf-weighted)
    const progress = getProjectProgress(allTasks);

    // Build table rows: for each stage, aggregate from its children
    let rowNum = 0;
    type Row = {
      num:         string;
      name:        string;
      startDate:   string;
      endDate:     string;
      duration:    number;
      percent:     number;
      status:      string;
      responsible: string;
      isStage:     boolean;
    };
    const rows: Row[] = [];

    stages.forEach(stage => {
      rowNum += 1;
      const children = subtasks
        .filter(t => t.parentId === stage.id)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

      if (children.length > 0) {
        // Aggregate stage row from children
        const childStarts  = children.map(t => t.startDate).filter(Boolean).sort();
        const childEnds    = children.map(t => t.endDate).filter(Boolean).sort();
        const totalDur     = children.reduce((s, t) => s + Math.max(1, t.duration), 0);
        const weightedPct  = children.reduce((s, t) => s + t.percentComplete * Math.max(1, t.duration), 0);
        const aggPct       = totalDur > 0 ? Math.round(weightedPct / totalDur) : 0;

        // Stage status: delayed if any child delayed, completed if all completed, else in_progress/not_started
        let aggStatus = 'not_started';
        if (children.every(t => t.status === 'completed')) {
          aggStatus = 'completed';
        } else if (children.some(t => t.status === 'delayed')) {
          aggStatus = 'delayed';
        } else if (children.some(t => t.status === 'in_progress')) {
          aggStatus = 'in_progress';
        }

        rows.push({
          num:         String(rowNum),
          name:        stage.name.toUpperCase(),
          startDate:   childStarts[0] ?? stage.startDate,
          endDate:     childEnds[childEnds.length - 1] ?? stage.endDate,
          duration:    totalDur,
          percent:     aggPct,
          status:      aggStatus,
          responsible: stage.responsible || '—',
          isStage:     true,
        });

        let subNum = 0;
        children.forEach(sub => {
          subNum += 1;
          rows.push({
            num:         `${rowNum}.${subNum}`,
            name:        sub.name,
            startDate:   sub.startDate,
            endDate:     sub.endDate,
            duration:    sub.duration,
            percent:     sub.percentComplete,
            status:      sub.status,
            responsible: sub.responsible || '—',
            isStage:     false,
          });
        });
      } else {
        // Standalone stage (no children)
        rows.push({
          num:         String(rowNum),
          name:        stage.name.toUpperCase(),
          startDate:   stage.startDate,
          endDate:     stage.endDate,
          duration:    stage.duration,
          percent:     stage.percentComplete,
          status:      stage.status,
          responsible: stage.responsible || '—',
          isStage:     true,
        });
      }
    });

    return { project: p, allTasks, progress, plannedEnd, rows };
  });

  // Global summary
  const totalTasks = tasks.filter(t => activeProjects.some(p => p.id === t.projectId)).length;
  const leafTasksAll = (() => {
    const all = tasks.filter(t => activeProjects.some(p => p.id === t.projectId));
    const parentIds = new Set(all.filter(t => t.parentId).map(t => t.parentId!));
    return all.filter(t => !parentIds.has(t.id));
  })();
  const overallProgress = (() => {
    const totalDur = leafTasksAll.reduce((s, t) => s + Math.max(1, t.duration), 0);
    const wSum     = leafTasksAll.reduce((s, t) => s + t.percentComplete * Math.max(1, t.duration), 0);
    return totalDur > 0 ? Math.round(wSum / totalDur) : 0;
  })();

  const emissionDate = new Date().toLocaleDateString('pt-BR');
  const emissionTs   = new Date().toLocaleString('pt-BR');

  return (
    <div className="min-h-screen bg-background">
      {/* ── print styles injected via <style> ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { border: 1px solid #e2e8f0; padding: 3px 6px; }
          .stage-row { background-color: #EFF6FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .project-section { page-break-before: always; }
          .project-section:first-child { page-break-before: avoid; }
          @page { margin: 12mm; size: A4 landscape; }
        }
      `}</style>

      {/* ── Non-print top bar ── */}
      <div className="no-print border-b bg-card py-4 px-6 sticky top-0 z-50 shadow-sm flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <span className="font-semibold text-slate-700">Relatório de Planejamento — Todas as Obras Ativas</span>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir Relatório
        </Button>
      </div>

      {/* ── Printable content ── */}
      <div className="max-w-[1400px] mx-auto p-8 print:p-0 print:m-0 bg-white min-h-screen text-slate-900">

        {/* ── Report header ── */}
        <div style={{ borderBottom: '2px solid #CBD5E1', paddingBottom: '20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/logo.jpg" alt="Logo Buddy Construtora" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
                Relatório de Planejamento — Todas as Obras Ativas
              </h1>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '2px', margin: '4px 0 0' }}>
                Buddy Construtora
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, margin: 0 }}>Data de Emissão</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0' }}>{emissionDate}</p>
          </div>
        </div>

        {/* ── Global summary box ── */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '16px', height: '16px', color: '#2563EB' }} />
            Resumo Consolidado de Todas as Obras
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, margin: '0 0 8px' }}>
                Progresso Geral (média ponderada por duração)
              </p>
              <div style={{ background: '#E2E8F0', borderRadius: '99px', height: '14px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                <div style={{ width: `${overallProgress}%`, height: '100%', background: '#2563EB', borderRadius: '99px' }} />
              </div>
            </div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>
              {overallProgress}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '40px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Obras Ativas</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{activeProjects.length}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Total de Tarefas</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{totalTasks}</p>
            </div>
          </div>
        </div>

        {/* ── No projects fallback ── */}
        {activeProjects.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: '15px' }}>
            Nenhuma obra ativa encontrada.
          </div>
        )}

        {/* ── Per-project sections ── */}
        {projectData.map(({ project, allTasks, progress, plannedEnd, rows }, idx) => (
          <div
            key={project.id}
            className="project-section"
            style={{ marginBottom: idx < projectData.length - 1 ? '48px' : '0' }}
          >
            {/* Project section header */}
            <div style={{
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
              borderRadius: '8px 8px 0 0',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 style={{ width: '18px', height: '18px', color: '#BFDBFE', flexShrink: 0 }} />
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                    {project.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#BFDBFE', fontWeight: 600 }}>
                      Início: {fmtDate(project.startDate)}
                    </span>
                    {plannedEnd && (
                      <span style={{ fontSize: '10px', color: '#BFDBFE', fontWeight: 600 }}>
                        Previsão de Término: {fmtDate(plannedEnd)}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: '#BFDBFE', fontWeight: 600 }}>
                      Tarefas: {allTasks.length}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
                  {progress}%
                </span>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', height: '6px', width: '100px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: '#93C5FD', borderRadius: '99px' }} />
                </div>
              </div>
            </div>

            {/* Planning table */}
            {rows.length === 0 ? (
              <div style={{ padding: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', color: '#94A3B8', fontSize: '13px' }}>
                Nenhuma tarefa cadastrada nesta obra.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      {['Nº', 'Nome da Tarefa', 'Início', 'Fim', 'Dur. (d)', '%', 'Status', 'Responsável'].map(h => (
                        <th
                          key={h}
                          style={{
                            border: '1px solid #CBD5E1',
                            padding: '7px 10px',
                            textAlign: h === 'Nº' || h === 'Dur. (d)' || h === '%' ? 'center' : 'left',
                            fontWeight: 800,
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            color: '#1E40AF',
                            background: '#DBEAFE',
                            whiteSpace: 'nowrap',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          } as React.CSSProperties}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => {
                      const isStage = row.isStage;
                      const statusColor = STATUS_COLOR[row.status] ?? '#64748B';
                      return (
                        <tr
                          key={rIdx}
                          className={isStage ? 'stage-row' : ''}
                          style={{
                            background: isStage ? '#EFF6FF' : rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          } as React.CSSProperties}
                        >
                          {/* Nº */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', textAlign: 'center', fontWeight: isStage ? 700 : 400, color: '#475569', whiteSpace: 'nowrap', fontSize: '10px' }}>
                            {row.num}
                          </td>
                          {/* Nome */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', fontWeight: isStage ? 800 : 400, color: isStage ? '#1E3A8A' : '#334155', paddingLeft: isStage ? '8px' : '22px' }}>
                            {!isStage && <span style={{ color: '#94A3B8', marginRight: '4px' }}>└</span>}
                            {row.name}
                          </td>
                          {/* Início */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', whiteSpace: 'nowrap', color: '#475569', fontWeight: isStage ? 600 : 400, fontSize: '10px' }}>
                            {fmtDate(row.startDate)}
                          </td>
                          {/* Fim */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', whiteSpace: 'nowrap', color: '#475569', fontWeight: isStage ? 600 : 400, fontSize: '10px' }}>
                            {fmtDate(row.endDate)}
                          </td>
                          {/* Dur. */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', textAlign: 'center', color: '#475569', fontWeight: isStage ? 600 : 400, fontSize: '10px' }}>
                            {row.duration > 0 ? row.duration : '—'}
                          </td>
                          {/* % with mini progress bar */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', textAlign: 'center', minWidth: '72px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ flex: 1, background: '#E2E8F0', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${row.percent}%`, height: '100%', background: row.percent === 100 ? '#16A34A' : '#2563EB', borderRadius: '99px' }} />
                              </div>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{row.percent}%</span>
                            </div>
                          </td>
                          {/* Status badge */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '99px', fontSize: '9px', fontWeight: 700, color: '#FFFFFF', background: statusColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                          </td>
                          {/* Responsável */}
                          <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', color: '#475569', fontWeight: isStage ? 600 : 400, fontSize: '10px' }}>
                            {row.responsible}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Progress summary footer bar under table */}
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 16px', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Progresso da Obra:</span>
              <div style={{ flex: 1, background: '#E2E8F0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#16A34A' : '#2563EB', borderRadius: '99px' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#2563EB' }}>{progress}%</span>
            </div>
          </div>
        ))}

        {/* ── Footer ── */}
        <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>
          Relatório gerado pelo Sistema de Planejamento — Buddy Construtora &nbsp;·&nbsp; {emissionTs}
        </div>

      </div>
    </div>
  );
}

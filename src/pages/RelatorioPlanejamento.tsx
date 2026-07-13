import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { getProjectProgress, getCriticalTaskIds } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Building2 } from 'lucide-react';
import { Task } from '@/types/project';

// ─── helpers ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não Iniciado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  delayed: 'Atrasado',
  rescheduled: 'Reprogramada',
};

const STATUS_COLOR: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#2563EB',
  completed: '#16A34A',
  delayed: '#DC2626',
  rescheduled: '#D97706',
};

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function getStageProgress(stage: Task, allTasks: Task[]): number {
  const children = allTasks.filter(t => t.parentId === stage.id);
  if (children.length === 0) return stage.percentComplete;
  const totalDur = children.reduce((s, t) => s + Math.max(1, t.duration), 0);
  const weighted = children.reduce((s, t) => s + t.percentComplete * Math.max(1, t.duration), 0);
  return totalDur > 0 ? Math.round(weighted / totalDur) : 0;
}

// ─── row types ─────────────────────────────────────────────────────────────

interface StageRow {
  type: 'stage';
  num: number;
  task: Task;
  progress: number;
  isCritical: boolean;
}

interface SubRow {
  type: 'sub';
  stageNum: number;
  subNum: number;
  task: Task;
  isCritical: boolean;
}

type TableRow = StageRow | SubRow;

// ─── component ─────────────────────────────────────────────────────────────

export default function RelatorioPlanejamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, getTasksForProject, loading } = useProjects();

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  // ── find project ─────────────────────────────────────────────────────────
  const project = projects.find(p => p.id === id);
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-semibold">Obra não encontrada.</p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const [onlyMaster, setOnlyMaster] = useState(false);

  // ── data ─────────────────────────────────────────────────────────────────
  const tasks = getTasksForProject(id!);
  const criticalTaskIds = getCriticalTaskIds(tasks);
  const overallProgress = getProjectProgress(tasks);

  // Planned end = max endDate across all tasks
  const allEnds = tasks.map(t => t.endDate).filter(Boolean).sort();
  const plannedEnd = allEnds.length > 0 ? allEnds[allEnds.length - 1] : project.endDate;

  // Task lookup map for predecessor resolution
  const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));

  // Build stage/subtask hierarchy
  const stages = tasks.filter(t => !t.parentId);
  const rows: TableRow[] = [];

  stages.forEach((stage, sIdx) => {
    const stageNum = sIdx + 1;
    const stageProgress = getStageProgress(stage, tasks);
    rows.push({
      type: 'stage',
      num: stageNum,
      task: stage,
      progress: stageProgress,
      isCritical: criticalTaskIds.has(stage.id),
    });

    if (!onlyMaster) {
      const subs = tasks
        .filter(t => t.parentId === stage.id)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

      subs.forEach((sub, subIdx) => {
        rows.push({
          type: 'sub',
          stageNum,
          subNum: subIdx + 1,
          task: sub,
          isCritical: criticalTaskIds.has(sub.id),
        });
      });
    }
  });

  const emissionDate = new Date().toLocaleString('pt-BR');

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>

      {/* ── Print CSS ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-root { background: white !important; padding: 0 !important; max-width: 100% !important; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          th, td { border: 1px solid #e2e8f0; padding: 3px 6px; }
          .stage-row { background-color: #EFF6FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .critical-row td:first-child { border-left: 4px solid #DC2626 !important; }
          .stage-critical-row td:first-child { border-left: 4px solid #DC2626 !important; }
          .progress-bar-track { background-color: #E2E8F0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .progress-bar-fill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm 10mm; size: A4 landscape; }
        }
      `}</style>

      {/* ── Non-Print toolbar ─────────────────────────────────────────────── */}
      <div
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}
      >
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 style={{ width: 18, height: 18, color: '#2563EB' }} />
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
            {project.name}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>— Relatório de Planejamento</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyMaster}
              onChange={(e) => setOnlyMaster(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            Apenas Tarefas Mestres
          </label>

          <Button
            onClick={() => window.print()}
            style={{ background: '#2563EB', color: 'white' }}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* ── Print content ─────────────────────────────────────────────────── */}
      <div
        className="print-root"
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '32px 24px',
          background: 'white',
          minHeight: '100vh',
          color: '#0f172a'
        }}
      >
        {/* ── Report header ──────────────────────────────────────────────── */}
        <div style={{ borderBottom: '2px solid #CBD5E1', paddingBottom: '20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/logo.jpg" alt="Logo Buddy Construtora" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
                Relatório de Planejamento da Obra
              </h1>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '2px', margin: '4px 0 0' }}>
                Buddy Construtora
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, margin: 0 }}>Data de Emissão</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0' }}>{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* ── Summary Box ── */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '16px', height: '16px', color: '#2563EB' }} />
            Resumo Consolidado do Planejamento
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, margin: '0 0 8px' }}>
                Progresso Geral da Obra (média ponderada por duração)
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
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Total de Tarefas</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{tasks.length}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Início da Obra</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{fmtDate(project.startDate)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Previsão de Término</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{fmtDate(plannedEnd)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Caminho Crítico</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#DC2626', margin: '2px 0 0' }}>{criticalTaskIds.size}</p>
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', fontSize: 11, background: '#F8FAFC', padding: '10px 16px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: '#EFF6FF', border: '1px solid #BFDBFE', borderLeft: '4px solid #2563EB' }} />
            <span style={{ color: '#475569', fontWeight: 600 }}>Etapa</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: 'white', border: '1px solid #E2E8F0', borderLeft: '4px solid #DC2626' }} />
            <span style={{ color: '#475569', fontWeight: 600 }}>🔥 Caminho Crítico</span>
          </div>
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, background: STATUS_COLOR[key], borderRadius: '50%' }} />
              <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Project Section Header (Gradient Box) ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
          borderRadius: '8px 8px 0 0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          marginBottom: '0px'
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
                  Tarefas: {tasks.length}
                </span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
              {overallProgress}%
            </span>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', height: '6px', width: '100px', marginTop: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${overallProgress}%`, height: '100%', background: '#93C5FD', borderRadius: '99px' }} />
            </div>
          </div>
        </div>

        {/* ── Hierarchical table ─────────────────────────────────────────── */}
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#94a3b8',
              border: '1px dashed #CBD5E1',
              borderRadius: '0 0 10px 10px',
              fontSize: 14,
            }}
          >
            Nenhuma tarefa encontrada para esta obra.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  {['Nº', 'Nome da Tarefa', 'Início', 'Fim', 'Dur.', '%', 'Status', 'Responsável', 'Predecessoras'].map((col, i) => (
                    <th
                       key={col}
                       style={{
                         padding: '7px 10px',
                         textAlign: (i === 0 || i === 4 || i === 5) ? 'center' : 'left',
                         fontWeight: 850,
                         fontSize: '10px',
                         letterSpacing: '0.6px',
                         textTransform: 'uppercase',
                         border: '1px solid #CBD5E1',
                         color: '#1E40AF',
                         background: '#DBEAFE',
                         whiteSpace: 'nowrap',
                         WebkitPrintColorAdjust: 'exact',
                         printColorAdjust: 'exact',
                       } as React.CSSProperties}
                     >
                       {col}
                     </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const task = row.task;
                  const isCritical = row.isCritical;
                  const isStage = row.type === 'stage';

                  const numStr = isStage
                    ? String((row as StageRow).num)
                    : `${(row as SubRow).stageNum}.${(row as SubRow).subNum}`;

                  const predNames = (task.predecessors || [])
                    .map(pid => taskMap.get(pid)?.name ?? pid)
                    .join(', ');

                  const bg = isStage ? '#EFF6FF' : idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                  const leftBorder = isCritical
                    ? '4px solid #DC2626'
                    : isStage
                    ? '4px solid #2563EB'
                    : '4px solid transparent';

                  const pct = isStage ? (row as StageRow).progress : task.percentComplete;
                  const barColor = pct === 100 ? '#16A34A' : '#2563EB';

                  return (
                    <tr
                      key={task.id}
                      className={
                        isStage
                          ? isCritical
                            ? 'stage-row stage-critical-row'
                            : 'stage-row'
                          : isCritical
                          ? 'critical-row'
                          : ''
                      }
                      style={{
                        background: bg,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      } as React.CSSProperties}
                    >
                      {/* Nº */}
                      <td
                        style={{
                          padding: '5px 8px',
                          textAlign: 'center',
                          fontWeight: isStage ? 750 : 400,
                          color: isStage ? '#1E3A8A' : '#64748b',
                          border: '1px solid #E2E8F0',
                          borderLeft: leftBorder,
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {numStr}
                      </td>

                      {/* Nome */}
                      <td
                        style={{
                          padding: '5px 8px',
                          fontWeight: isStage ? 800 : 400,
                          color: isStage ? '#1E3A8A' : '#334155',
                          border: '1px solid #E2E8F0',
                          fontSize: isStage ? '11px' : '10.5px',
                          paddingLeft: isStage ? '8px' : '22px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {!isStage && (
                            <span style={{ color: '#94a3b8', marginRight: '4px' }}>└</span>
                          )}
                          <span style={{ textTransform: isStage ? 'uppercase' : 'none', letterSpacing: isStage ? '0.03em' : 0 }}>
                            {task.name}
                          </span>
                          {isCritical && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#DC2626',
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: 4,
                                padding: '1px 5px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🔥 CRÍTICO
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Início */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', color: '#475569', fontSize: '10px', fontWeight: isStage ? 600 : 400 }}>
                        {fmtDate(task.startDate)}
                      </td>

                      {/* Fim */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', color: '#475569', fontSize: '10px', fontWeight: isStage ? 600 : 400 }}>
                        {fmtDate(task.endDate)}
                      </td>

                      {/* Duração */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#475569', fontSize: '10px', fontWeight: isStage ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {task.duration ?? '—'}
                      </td>

                      {/* % with mini progress bar */}
                      <td style={{ border: '1px solid #E2E8F0', padding: '5px 8px', textAlign: 'center', minWidth: '72px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ flex: 1, background: '#E2E8F0', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{pct}%</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '99px',
                            background: STATUS_COLOR[task.status] ?? '#64748B',
                            color: '#FFFFFF',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact'
                          } as React.CSSProperties}
                        >
                          {STATUS_LABEL[task.status] ?? task.status}
                        </span>
                      </td>

                      {/* Responsável */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', fontSize: '10px', color: '#475569', fontWeight: isStage ? 600 : 400, maxWidth: 120 }}>
                        {task.responsible || '—'}
                      </td>

                      {/* Predecessoras */}
                      <td style={{ padding: '5px 8px', border: '1px solid #E2E8F0', fontSize: '9.5px', color: '#64748b', maxWidth: 160 }}>
                        {predNames || '—'}
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
            <div style={{ width: `${overallProgress}%`, height: '100%', background: overallProgress === 100 ? '#16A34A' : '#2563EB', borderRadius: '99px' }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#2563EB' }}>{overallProgress}%</span>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 16,
            borderTop: '1px solid #E2E8F0',
            textAlign: 'center',
            fontSize: '10px',
            color: '#94A3B8',
            fontWeight: 500
          }}
        >
          Relatório gerado pelo Sistema de Planejamento — Buddy Construtora &nbsp;·&nbsp; {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  );
}

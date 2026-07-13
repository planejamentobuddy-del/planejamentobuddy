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

        <Button
          onClick={() => window.print()}
          style={{ background: '#2563EB', color: 'white' }}
          className="gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir / PDF
        </Button>
      </div>

      {/* ── Print content ─────────────────────────────────────────────────── */}
      <div
        className="print-root"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '32px 32px 48px',
          background: 'white',
          minHeight: '100vh',
        }}
      >
        {/* ── Report header ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '3px solid #2563EB',
            paddingBottom: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src="/logo.jpg"
              alt="Buddy Construtora"
              style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8 }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Buddy Construtora
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {project.name}
              </h1>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 4 }}>
                Relatório de Planejamento
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Data de Emissão
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              {new Date().toLocaleDateString('pt-BR')}
            </div>
            {project.description && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, maxWidth: 280, textAlign: 'right' }}>
                {project.description}
              </div>
            )}
          </div>
        </div>

        {/* ── Summary box ────────────────────────────────────────────────── */}
        <div
          style={{
            background: '#F8FAFF',
            border: '1px solid #DBEAFE',
            borderRadius: 10,
            padding: '16px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {/* Progress bar area */}
          <div style={{ flex: 2, paddingRight: 32, borderRight: '1px solid #DBEAFE' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Progresso Geral
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                className="progress-bar-track"
                style={{ flex: 1, height: 14, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', border: '1px solid #CBD5E1' }}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    height: '100%',
                    width: `${overallProgress}%`,
                    background: overallProgress >= 80 ? '#16A34A' : overallProgress >= 40 ? '#2563EB' : '#F59E0B',
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#2563EB', minWidth: 56, textAlign: 'right' }}>
                {overallProgress}%
              </div>
            </div>
          </div>

          {/* Stats */}
          {([
            { label: 'Total de Tarefas', value: String(tasks.length) },
            { label: 'Início da Obra', value: fmtDate(project.startDate) },
            { label: 'Término Planejado', value: fmtDate(plannedEnd) },
            { label: 'Caminho Crítico', value: `${criticalTaskIds.size} tarefa${criticalTaskIds.size !== 1 ? 's' : ''}` },
          ] as { label: string; value: string }[]).map((stat, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                paddingLeft: 24,
                paddingRight: i < 3 ? 24 : 0,
                borderRight: i < 3 ? '1px solid #DBEAFE' : 'none',
              }}
            >
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap', fontSize: 11 }}>
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

        {/* ── Hierarchical table ─────────────────────────────────────────── */}
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#94a3b8',
              border: '1px dashed #CBD5E1',
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            Nenhuma tarefa encontrada para esta obra.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr style={{ background: '#2563EB', color: 'white' }}>
                {['Nº', 'Nome da Tarefa', 'Início', 'Fim', 'Dur.', '%', 'Status', 'Responsável', 'Predecessoras'].map((col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: '8px 10px',
                      textAlign: (i === 0 || i === 4 || i === 5) ? 'center' : 'left',
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      border: '1px solid #1D4ED8',
                      whiteSpace: 'nowrap',
                    }}
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

                const bg = isStage ? '#EFF6FF' : idx % 2 === 0 ? '#FAFAFA' : 'white';
                const leftBorder = isCritical
                  ? '4px solid #DC2626'
                  : isStage
                  ? '4px solid #2563EB'
                  : '4px solid transparent';

                const pct = isStage ? (row as StageRow).progress : task.percentComplete;
                const barColor = pct >= 80 ? '#16A34A' : pct >= 40 ? '#2563EB' : '#F59E0B';

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
                    style={{ background: bg }}
                  >
                    {/* Nº */}
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'center',
                        fontWeight: isStage ? 700 : 400,
                        color: isStage ? '#1D4ED8' : '#64748b',
                        border: '1px solid #E2E8F0',
                        borderLeft: leftBorder,
                        fontSize: isStage ? 11 : 10,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {numStr}
                    </td>

                    {/* Nome */}
                    <td
                      style={{
                        padding: '6px 10px',
                        fontWeight: isStage ? 700 : 400,
                        color: '#0f172a',
                        border: '1px solid #E2E8F0',
                        fontSize: isStage ? 11 : 10.5,
                        maxWidth: 260,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {!isStage && (
                          <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 10, marginRight: 2 }}>└</span>
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
                      {/* Stage mini progress bar */}
                      {isStage && (
                        <div
                          className="progress-bar-track"
                          style={{ marginTop: 5, height: 5, background: '#DBEAFE', borderRadius: 999, overflow: 'hidden' }}
                        >
                          <div
                            className="progress-bar-fill"
                            style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999 }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Início */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', color: '#334155', fontSize: 10 }}>
                      {fmtDate(task.startDate)}
                    </td>

                    {/* Fim */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap', color: '#334155', fontSize: 10 }}>
                      {fmtDate(task.endDate)}
                    </td>

                    {/* Duração */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#334155', fontSize: 10, whiteSpace: 'nowrap' }}>
                      {task.duration ?? '—'}d
                    </td>

                    {/* % */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', textAlign: 'center', fontWeight: 700, color: barColor, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                      {pct}%
                    </td>

                    {/* Status */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 12,
                          background: (STATUS_COLOR[task.status] ?? '#64748B') + '18',
                          color: STATUS_COLOR[task.status] ?? '#64748b',
                          border: `1px solid ${(STATUS_COLOR[task.status] ?? '#94a3b8')}40`,
                        }}
                      >
                        {STATUS_LABEL[task.status] ?? task.status}
                      </span>
                    </td>

                    {/* Responsável */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontSize: 10, color: '#334155', maxWidth: 120 }}>
                      {task.responsible || '—'}
                    </td>

                    {/* Predecessoras */}
                    <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontSize: 9.5, color: '#64748b', maxWidth: 160 }}>
                      {predNames || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: '2px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.jpg" alt="" style={{ width: 20, height: 20, objectFit: 'contain', opacity: 0.5 }} />
            <span style={{ fontWeight: 600 }}>Buddy Construtora</span>
            <span>—</span>
            <span>Sistema de Planejamento</span>
          </div>
          <div>
            Gerado em: <span style={{ fontWeight: 700, color: '#64748b' }}>{emissionDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

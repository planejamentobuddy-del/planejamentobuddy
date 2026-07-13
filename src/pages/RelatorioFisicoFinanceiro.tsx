import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Layers, TrendingUp, Building2 } from "lucide-react";

export default function RelatorioFisicoFinanceiro() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, getTasksForProject, loading } = useProjects();
  const [onlyMaster, setOnlyMaster] = useState(false);

  const project = projects.find((p) => p.id === id);
  const allTasks = id ? getTasksForProject(id) : [];

  const subtasks = useMemo(
    () => allTasks.filter((t) => t.parentId && t.startDate && t.endDate),
    [allTasks]
  );
  const parentTasks = useMemo(
    () =>
      allTasks
        .filter((t) => !t.parentId)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)),
    [allTasks]
  );

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

  const fmtMonth = (mStr: string) => {
    const [y, m] = mStr.split("-");
    const lbl = new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    return lbl.charAt(0).toUpperCase() + lbl.slice(1);
  };

  const totalBudget = useMemo(() => subtasks.reduce((s, t) => s + (t.cost || 0), 0), [subtasks]);
  const totalRealized = useMemo(
    () => subtasks.reduce((s, t) => s + ((t.cost || 0) * (t.percentComplete || 0)) / 100, 0),
    [subtasks]
  );
  const overallProgress = totalBudget > 0 ? Math.round((totalRealized / totalBudget) * 100) : 0;
  const deviation = totalRealized - totalBudget * (overallProgress / 100);

  const monthsList = useMemo(() => {
    if (!subtasks.length) return [];
    let min = project?.startDate || subtasks[0].startDate!;
    let max = project?.endDate || subtasks[0].endDate!;
    subtasks.forEach((t) => {
      if (t.startDate && t.startDate < min) min = t.startDate;
      if (t.endDate && t.endDate > max) max = t.endDate;
    });
    const list: string[] = [];
    const cur = new Date(new Date(min + "T12:00:00").getFullYear(), new Date(min + "T12:00:00").getMonth(), 1);
    const lim = new Date(new Date(max + "T12:00:00").getFullYear(), new Date(max + "T12:00:00").getMonth(), 1);
    while (cur <= lim && list.length < 60) {
      list.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [subtasks, project]);

  const taskDist = useMemo(() => {
    return subtasks.map((task) => {
      const start = new Date(task.startDate! + "T12:00:00");
      const end = new Date(task.endDate! + "T12:00:00");
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      const cost = task.cost || 0;
      const real = cost * ((task.percentComplete || 0) / 100);
      const dist: Record<string, { planned: number; realized: number }> = {};
      monthsList.forEach((mStr) => {
        const [y, m] = mStr.split("-").map(Number);
        const ms = new Date(y, m - 1, 1);
        const me = new Date(y, m, 0);
        const os = new Date(Math.max(start.getTime(), ms.getTime()));
        const oe = new Date(Math.min(end.getTime(), me.getTime()));
        if (os <= oe) {
          const ratio = (Math.round((oe.getTime() - os.getTime()) / 86400000) + 1) / totalDays;
          dist[mStr] = { planned: cost * ratio, realized: real * ratio };
        } else {
          dist[mStr] = { planned: 0, realized: 0 };
        }
      });
      return { taskId: task.id, dist };
    });
  }, [subtasks, monthsList]);

  const monthTotals = useMemo(
    () =>
      monthsList.map((mStr) => {
        let planned = 0, realized = 0;
        taskDist.forEach((td) => {
          const d = td.dist[mStr];
          if (d) { planned += d.planned; realized += d.realized; }
        });
        return { mStr, planned, realized };
      }),
    [monthsList, taskDist]
  );

  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#64748b" }}>
        <p>Carregando relatório físico-financeiro...</p>
      </div>
    );

  if (!project)
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", gap: 16 }}>
        <Layers size={48} color="#94a3b8" />
        <h2 style={{ fontWeight: 900 }}>Obra não encontrada.</h2>
        <Button onClick={() => navigate(-1)}>← Voltar</Button>
      </div>
    );

  if (!subtasks.length)
    return (
      <div style={{ minHeight: "100vh", fontFamily: "sans-serif", background: "#f8fafc" }}>
        <div className="no-print" style={{ padding: "12px 24px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16 }}>
          <Button variant="ghost" onClick={() => navigate(-1)}>← Voltar</Button>
        </div>
        <div style={{ maxWidth: 640, margin: "80px auto", textAlign: "center", padding: 40, background: "white", borderRadius: 16 }}>
          <Layers size={48} color="#94a3b8" />
          <h2 style={{ fontWeight: 900, marginTop: 16 }}>Nenhuma subetapa com datas cadastrada.</h2>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Adicione subetapas com datas e orçamentos na aba Planejamento para visualizar o cronograma físico-financeiro.</p>
        </div>
      </div>
    );

  const now = new Date().toLocaleString("pt-BR");
  const thS: React.CSSProperties = {
    padding: "7px 10px",
    textAlign: "left",
    border: "1px solid #A7F3D0",
    fontWeight: 850,
    fontSize: "10px",
    color: "#065F46",
    background: "#D1FAE5",
    whiteSpace: "nowrap",
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  };
  const tdS: React.CSSProperties = { padding: "5px 8px", border: "1px solid #E2E8F0", fontSize: 11, verticalAlign: "top" };

  return (
    <div style={{ minHeight: "100vh", background: "white", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .report-container { padding: 0 !important; max-width: 100% !important; }
          table { border-collapse: collapse; font-size: 8px; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 2px 4px !important; }
          .stage-row td { background-color: #F0FDF4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .total-row td { background-color: #EFF6FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 8mm; size: A4 landscape; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ padding: "10px 24px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#334155" }}>{project.name} — Cronograma Físico-Financeiro</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyMaster}
              onChange={(e) => setOnlyMaster(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            Apenas Tarefas Mestres
          </label>

          <Button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 8, background: "#059669", color: "white" }}>
            <Printer size={16} /> Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="report-container" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #CBD5E1', paddingBottom: '20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/logo.jpg" alt="Logo Buddy Construtora" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
                Cronograma Físico-Financeiro
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

        {/* Summary box */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp style={{ width: '16px', height: '16px', color: '#059669' }} />
            Resumo do Cronograma Físico-Financeiro
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, margin: '0 0 8px' }}>
                Avanço Físico-Financeiro Consolidado (ponderado por custo)
              </p>
              <div style={{ background: '#E2E8F0', borderRadius: '99px', height: '14px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                <div style={{ width: `${overallProgress}%`, height: '100%', background: '#059669', borderRadius: '99px' }} />
              </div>
            </div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
              {overallProgress}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '40px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Orçamento Total</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#2563EB', margin: '2px 0 0' }}>{fmtCurrency(totalBudget)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Valor Realizado</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#059669', margin: '2px 0 0' }}>{fmtCurrency(totalRealized)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Desvio Financeiro</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: deviation >= 0 ? '#059669' : '#DC2626', margin: '2px 0 0' }}>{(deviation >= 0 ? "+" : "") + fmtCurrency(deviation)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Duração da Obra</p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>{monthsList.length} meses</p>
            </div>
          </div>
        </div>

        {/* Project Section Header (Gradient Box) */}
        <div style={{
          background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
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
            <Building2 style={{ width: '18px', height: '18px', color: '#A7F3D0', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                {project.name}
              </h2>
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#A7F3D0', fontWeight: 600 }}>
                  Início: {fmtDate(project.startDate)}
                </span>
                {project.endDate && (
                  <span style={{ fontSize: '10px', color: '#A7F3D0', fontWeight: 600 }}>
                    Término Contratual: {fmtDate(project.endDate)}
                  </span>
                )}
                <span style={{ fontSize: '10px', color: '#A7F3D0', fontWeight: 600 }}>
                  Meses: {monthsList.length}
                </span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
              {overallProgress}%
            </span>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', height: '6px', width: '100px', marginTop: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${overallProgress}%`, height: '100%', background: '#6EE7B7', borderRadius: '99px' }} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 220 }}>Etapa / Atividade</th>
                <th style={{ ...thS, textAlign: "right", minWidth: 105 }}>Orçamento</th>
                <th style={{ ...thS, textAlign: "center", minWidth: 55 }}>% Fís.</th>
                {monthsList.map((m) => <th key={m} style={{ ...thS, textAlign: "center", minWidth: 105 }}>{fmtMonth(m)}</th>)}
              </tr>
            </thead>
            <tbody>
              {/* Total row */}
              <tr className="total-row" style={{ background: "#EFF6FF" }}>
                <td style={{ ...tdS, fontWeight: 700, color: "#1e40af" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><TrendingUp size={12} color="#2563EB" /> TOTAL DO PROJETO</span>
                </td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 900, color: "#1e40af" }}>{fmtCurrency(totalBudget)}</td>
                <td style={{ ...tdS, textAlign: "center", fontWeight: 900, color: "#1e40af" }}>{overallProgress}%</td>
                {monthTotals.map(({ mStr, planned, realized }) => (
                  <td key={mStr} style={{ ...tdS, fontSize: 10 }}>
                    {planned > 0 && <div style={{ color: "#1e40af", fontWeight: 600 }}>P: {fmtCurrency(planned)}</div>}
                    {realized > 0 && <div style={{ color: "#059669", fontWeight: 700 }}>R: {fmtCurrency(realized)}</div>}
                    {!planned && !realized && <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                ))}
              </tr>

              {/* Parent + subtask rows */}
              {parentTasks.map((parent) => {
                const subs = subtasks.filter((t) => t.parentId === parent.id).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                const pBudget = subs.reduce((s, t) => s + (t.cost || 0), 0);
                const pReal = subs.reduce((s, t) => s + ((t.cost || 0) * (t.percentComplete || 0)) / 100, 0);
                const pPhys = pBudget > 0 ? Math.round((pReal / pBudget) * 100) : 0;

                return (
                  <React.Fragment key={parent.id}>
                    <tr className="stage-row" style={{ background: "#F0FDF4" }}>
                      <td style={{ ...tdS, fontWeight: 750, textTransform: "uppercase", color: "#065f46", fontSize: 11 }}>📁 {parent.name}</td>
                      <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#065f46" }}>{fmtCurrency(pBudget)}</td>
                      <td style={{ ...tdS, textAlign: "center", fontWeight: 700, color: "#065f46" }}>{pPhys}%</td>
                      {monthsList.map((mStr) => {
                        let mp = 0, mr = 0;
                        subs.forEach((sub) => {
                          const dd = taskDist.find((d) => d.taskId === sub.id)?.dist[mStr];
                          if (dd) { mp += dd.planned; mr += dd.realized; }
                        });
                        return (
                          <td key={mStr} style={{ ...tdS, fontSize: 10 }}>
                            {mp > 0 && <div style={{ color: "#1e40af", fontWeight: 500 }}>P: {fmtCurrency(mp)}</div>}
                            {mr > 0 && <div style={{ color: "#059669", fontWeight: 600 }}>R: {fmtCurrency(mr)}</div>}
                            {!mp && !mr && <span style={{ color: "#e2e8f0" }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {!onlyMaster && subs.map((sub, si) => {
                      const dt = taskDist.find((d) => d.taskId === sub.id);
                      return (
                        <tr key={sub.id} style={{ background: si % 2 === 0 ? "white" : "#fafafa" }}>
                          <td style={{ ...tdS, paddingLeft: 24, color: "#334155" }}>
                            <span style={{ color: '#94a3b8', marginRight: '4px' }}>↳</span>
                            {sub.name}
                          </td>
                          <td style={{ ...tdS, textAlign: "right", color: "#475569" }}>{fmtCurrency(sub.cost || 0)}</td>
                          <td style={{ ...tdS, textAlign: "center", color: "#475569", fontWeight: 600 }}>{sub.percentComplete || 0}%</td>
                          {monthsList.map((mStr) => {
                            const md = dt?.dist[mStr];
                            return (
                              <td key={mStr} style={{ ...tdS, fontSize: 10 }}>
                                {md && md.planned > 0 && <div style={{ color: "#64748b" }}>P: {fmtCurrency(md.planned)}</div>}
                                {md && md.realized > 0 && <div style={{ color: "#059669" }}>R: {fmtCurrency(md.realized)}</div>}
                                {(!md || (!md.planned && !md.realized)) && <span style={{ color: "#e2e8f0" }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Progress summary footer bar under table */}
        <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 16px', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Avanço Físico-Financeiro Consolidado:</span>
          <div style={{ flex: 1, background: '#E2E8F0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${overallProgress}%`, height: '100%', background: '#059669', borderRadius: '99px' }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#059669' }}>{overallProgress}%</span>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 20, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 10, color: "#64748b", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span><b style={{ color: "#1e40af" }}>P:</b> Desembolso Planejado do mês</span>
          <span><b style={{ color: "#059669" }}>R:</b> Desembolso Realizado do mês</span>
          <span>Distribuição proporcional à duração de cada subetapa no mês.</span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #E2E8F0", textAlign: 'center', fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>
          Relatório gerado pelo Sistema de Planejamento — Buddy Construtora &nbsp;·&nbsp; {now}
        </div>
      </div>
    </div>
  );
}

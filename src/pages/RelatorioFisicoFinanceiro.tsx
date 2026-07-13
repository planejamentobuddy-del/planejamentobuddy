import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Layers, TrendingUp } from "lucide-react";

export default function RelatorioFisicoFinanceiro() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, getTasksForProject, loading } = useProjects();

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

  const thS: React.CSSProperties = { padding: "8px 8px", textAlign: "left", border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 11, color: "#475569", background: "#f8fafc", whiteSpace: "nowrap" };
  const tdS: React.CSSProperties = { padding: "6px 8px", border: "1px solid #e2e8f0", fontSize: 11, verticalAlign: "top" };

  return (
    <div style={{ minHeight: "100vh", background: "white", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
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
        <Button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 8, background: "#059669", color: "white" }}>
          <Printer size={16} /> Imprimir / PDF
        </Button>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #059669", paddingBottom: 18, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>Buddy Construtora</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{project.name}</h1>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2, fontWeight: 600 }}>Cronograma Físico-Financeiro</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
            <div style={{ fontWeight: 700 }}>Emissão: {new Date().toLocaleDateString("pt-BR")}</div>
            {project.startDate && <div>Início: {fmtDate(project.startDate)}</div>}
            {project.endDate && <div>Término contratual: {fmtDate(project.endDate)}</div>}
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { l: "Orçamento Total", v: fmtCurrency(totalBudget), c: "#2563EB", bg: "#EFF6FF" },
            { l: "Valor Realizado", v: fmtCurrency(totalRealized), c: "#059669", bg: "#F0FDF4" },
            { l: "Desvio Financeiro", v: (deviation >= 0 ? "+" : "") + fmtCurrency(deviation), c: deviation >= 0 ? "#059669" : "#DC2626", bg: deviation >= 0 ? "#F0FDF4" : "#FEF2F2" },
            { l: "% Físico-Financeiro", v: `${overallProgress}%`, c: "#2563EB", bg: "#EFF6FF" },
          ].map((card, i) => (
            <div key={i} style={{ flex: 1, minWidth: 160, background: card.bg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${card.c}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{card.l}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: card.c }}>{card.v}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <h3 style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={13} color="#059669" /> Distribuição Mensal · {monthsList.length} meses
        </h3>
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
                      <td style={{ ...tdS, fontWeight: 700, textTransform: "uppercase", color: "#065f46", fontSize: 11 }}>📁 {parent.name}</td>
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
                    {subs.map((sub, si) => {
                      const dt = taskDist.find((d) => d.taskId === sub.id);
                      return (
                        <tr key={sub.id} style={{ background: si % 2 === 0 ? "white" : "#fafafa" }}>
                          <td style={{ ...tdS, paddingLeft: 24, color: "#334155" }}>↳ {sub.name}</td>
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

        {/* Legend */}
        <div style={{ marginTop: 16, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 10, color: "#64748b", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span><b style={{ color: "#1e40af" }}>P:</b> Desembolso Planejado do mês</span>
          <span><b style={{ color: "#059669" }}>R:</b> Desembolso Realizado do mês</span>
          <span>Distribuição proporcional à duração de cada subetapa no mês.</span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 14, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Buddy Construtora — Sistema de Planejamento</span>
          </div>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>Gerado em: {now}</span>
        </div>
      </div>
    </div>
  );
}

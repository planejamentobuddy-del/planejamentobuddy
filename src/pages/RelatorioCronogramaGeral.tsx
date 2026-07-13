import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Building2, Calendar, LayoutGrid } from 'lucide-react';
import { safeParseDate, Task } from '@/types/project';

interface StageTimelineItem {
  name: string;
  startDate: string;
  endDate: string;
  percent: number;
  status: string;
  duration: number;
}

interface ProjectCronogramaData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  stages: StageTimelineItem[];
  months: { label: string; year: string }[];
  projStartTs: number;
  projEndTs: number;
  projDuration: number;
}

export default function RelatorioCronogramaGeral() {
  const { projects, getTasksForProject, loading } = useProjects();
  const navigate = useNavigate();
  const [onlyMaster, setOnlyMaster] = useState(false); // Can toggle between only master or all if wanted

  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status !== 'archived');
  }, [projects]);

  // Build cronograma data per project
  const projectCronogramas = useMemo(() => {
    return activeProjects.map(p => {
      const allTasks = getTasksForProject(p.id);
      const stages = allTasks.filter(t => !t.parentId).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      
      const stageTimelineData: StageTimelineItem[] = stages.map(stage => {
        const subs = allTasks.filter(t => t.parentId === stage.id);
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
      const rawMinDate = projStartDates.length > 0 ? new Date(Math.min(...projStartDates)) : new Date(p.startDate || new Date());
      const rawMaxDate = projEndDates.length > 0 ? new Date(Math.max(...projEndDates)) : new Date(p.endDate || new Date());
      
      const timelineStart = new Date(rawMinDate.getFullYear(), rawMinDate.getMonth(), 1);
      const timelineEnd = new Date(rawMaxDate.getFullYear(), rawMaxDate.getMonth() + 1, 0);
      
      const projStartTs = timelineStart.getTime();
      const projEndTs = timelineEnd.getTime();
      const projDuration = projEndTs - projStartTs;

      // Months list
      const monthsList: { label: string; year: string }[] = [];
      const curr = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
      let limit = 0;
      while (curr <= timelineEnd && limit < 48) {
        const lbl = curr.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const yr = curr.toLocaleDateString('pt-BR', { year: '2-digit' });
        monthsList.push({
          label: lbl.charAt(0).toUpperCase() + lbl.slice(1),
          year: yr
        });
        curr.setMonth(curr.getMonth() + 1);
        limit++;
      }

      // Calculate project dynamic progress
      const totalWeight = stageTimelineData.reduce((acc, curr) => acc + (curr.duration || 1), 0);
      const doneWeight = stageTimelineData.reduce((acc, curr) => acc + (curr.percent * (curr.duration || 1)), 0);
      const overallProgress = totalWeight > 0 ? Math.round(doneWeight / totalWeight) : 0;

      return {
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        progress: overallProgress,
        stages: stageTimelineData,
        months: monthsList,
        projStartTs,
        projEndTs,
        projDuration
      };
    });
  }, [activeProjects, getTasksForProject]);

  const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>
        <p>Carregando cronograma geral das obras...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif", color: '#0F172A', paddingBottom: 60 }}>
      <style>{`
        :root {
          --blue-dark: #1E3A8A;
          --blue-light: #3B82F6;
          --slate-bg: #F8FAFC;
          --paper: #FFFFFF;
          --slate-900: #0F172A;
          --slate-600: #475569;
          --slate-400: #94A3B8;
          --slate-200: #E2E8F0;
          --slate-100: #F1F5F9;
          
          --gantt-completed: #10B981;
          --gantt-delayed: #EF4444;
          --gantt-in-progress: #3B82F6;
          --gantt-not-started: #94A3B8;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .wrap { max-width: 100% !important; padding: 0 !important; }
          .project-card { break-inside: avoid; border: 1px solid var(--slate-200) !important; margin-bottom: 20px !important; box-shadow: none !important; }
          @page { margin: 8mm; size: A4 landscape; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Button variant="ghost" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid size={16} /> Cronograma Geral de Obras — Todas as Obras Ativas
        </span>
        <Button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2563EB', color: 'white' }}>
          <Printer size={16} /> Imprimir / PDF
        </Button>
      </div>

      <div className="wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        
        {/* Header Hero */}
        <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)', color: '#FFFFFF', borderRadius: 14, padding: '28px 32px', position: 'relative', overflow: 'hidden', marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
          <div style={{ position: 'absolute', top: 16, right: 18, fontFamily: 'monospace', fontSize: 10, letterSpacing: '.18em', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 10px', borderRadius: 999, color: '#DBEAFE' }}>
            Buddy Construtora
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0, fontFamily: 'Archivo, sans-serif' }}>Cronograma Macro das Obras</h1>
          <div style={{ color: '#E0F2FE', fontSize: 13, marginTop: 6 }}>
            Acompanhamento integrado de cronograma executivo de todas as obras ativas · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Global Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }} className="no-print">
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1E3A8A', fontFamily: 'Archivo, sans-serif' }}>{activeProjects.length}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Obras Ativas</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1E3A8A', fontFamily: 'Archivo, sans-serif' }}>
              {projectCronogramas.length > 0 ? Math.round(projectCronogramas.reduce((s, p) => s + p.progress, 0) / projectCronogramas.length) : 0}%
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Progresso Médio</div>
          </div>
        </div>

        {/* Projects list */}
        {projectCronogramas.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <Building2 size={48} color="#94A3B8" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: 0, fontWeight: 700 }}>Nenhuma obra ativa encontrada.</h3>
          </div>
        ) : (
          projectCronogramas.map((p) => (
            <div key={p.id} className="project-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
              
              {/* Project Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', margin: 0, fontFamily: 'Archivo, sans-serif' }}>📁 {p.name}</h2>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4, display: 'flex', gap: 16 }}>
                    <span>Início: <b>{fmtDate(p.startDate)}</b></span>
                    <span>Previsão de Término: <b>{fmtDate(p.endDate)}</b></span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#1E3A8A' }}>{p.progress}%</span>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 600 }}>Concluído</div>
                </div>
              </div>

              {/* Gantt Timeline */}
              {p.stages.length === 0 ? (
                <div style={{ padding: '20px 0', textPosition: 'center', color: '#6A6358', fontSize: 12, fontStyle: 'italic' }}>
                  Nenhuma etapa cadastrada para esta obra.
                </div>
              ) : (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                  
                  {/* Gantt Header */}
                  <div style={{ display: 'flex', alignItems: 'center', background: '#1E3A8A', borderBottom: '2px solid #E2E8F0', padding: '8px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div style={{ width: 220, flexShrink: 0 }}>Etapa da Obra</div>
                    <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                      {p.months.map((m, mi) => (
                        <div key={mi} style={{ flex: 1, borderLeft: mi > 0 ? '1px solid rgba(255, 255, 255, 0.15)' : 'none', fontSize: 8, lineHeight: 1.25, color: '#E0F2FE', textAlign: 'center' }}>
                          <b>{m.label}</b><br/>{m.year}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gantt Rows */}
                  {p.stages.map((s, si) => {
                    const startTs = safeParseDate(s.startDate);
                    const endTs = safeParseDate(s.endDate);
                    let left = 0;
                    let width = 100;
                    if (p.projDuration > 0 && !isNaN(startTs) && !isNaN(endTs)) {
                      left = Math.max(0, Math.min(100, ((startTs - p.projStartTs) / p.projDuration) * 100));
                      width = Math.max(3, Math.min(100 - left, ((endTs - startTs) / p.projDuration) * 100));
                    }

                    // Map status to gantt bar colors (blue-theme compliant)
                    const barColor = s.status === 'completed' ? '#10B981' : s.status === 'delayed' ? '#EF4444' : s.status === 'in_progress' ? '#3B82F6' : '#94A3B8';
                    const textColor = '#FFFFFF';

                    return (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: si < p.stages.length - 1 ? '1px solid #E2E8F0' : 'none', background: si % 2 === 0 ? 'white' : '#F8FAFC' }}>
                        <div style={{ width: 220, flexShrink: 0, paddingRight: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{fmtDate(s.startDate)} a {fmtDate(s.endDate)}</div>
                        </div>
                        
                        {/* Bar container with vertical grid lines */}
                        <div style={{ flex: 1, height: 24, background: '#F1F5F9', borderRadius: 6, position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0' }}>
                          
                          {/* Grid background lines */}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                            {p.months.map((_, mi) => (
                              <div key={mi} style={{ flex: 1, borderLeft: mi > 0 ? '1px solid rgba(226, 232, 240, 0.5)' : 'none' }} />
                            ))}
                          </div>

                          {/* Progress bar fill */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: `${left}%`, 
                              width: `${width}%`, 
                              height: '100%', 
                              backgroundColor: barColor, 
                              borderRadius: 4, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              overflow: 'hidden', 
                              fontSize: 9, 
                              fontWeight: 'bold', 
                              color: textColor,
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            <div style={{ height: '100%', width: `${s.percent}%`, background: 'rgba(0,0,0,0.12)', position: 'absolute', left: 0, top: 0 }} />
                            <span style={{ position: 'relative', zIndex: 10, padding: '0 8px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {s.percent}% ({s.duration}d)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}

      </div>
    </div>
  );
}

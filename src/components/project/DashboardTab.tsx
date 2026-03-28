import React, { useState, useMemo, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Project, getProjectProgress, getProjectStatus, getEstimatedEndDate, isCriticalPath, getCurrentWeek, calculateSCurve, safeParseDate, getProjectPlannedEnd } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Shield, CalendarClock, Info, HeartPulse, Zap, Milestone, Gauge, Activity, Hammer, Edit2, Check, X, HelpCircle, Layers, Target, Clock4 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend, Area, ComposedChart, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

export default function DashboardTab({ project }: { project: Project }) {
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [tempMeta, setTempMeta] = useState(project.endDate);
  const [, setSearchParams] = useSearchParams();
  const { getTasksForProject, getPlansForProject, getHistoryForProject, getConstraintsForProject, updateProject } = useProjects();
  
  const handleSaveMeta = async () => {
    await updateProject({ ...project, endDate: tempMeta });
    setIsEditingMeta(false);
  };
  
  const tasks = getTasksForProject(project.id);
  const plans = getPlansForProject(project.id);
  const history = getHistoryForProject(project.id);
  const constraints = getConstraintsForProject(project.id);
  
  const progress = getProjectProgress(tasks);
// Moved estimated calculation down so it can use 'spi'
  const now = new Date().toISOString().split('T')[0];
  const delayed = tasks.filter(t => {
    const endStr = t.endDate;
    if (!endStr) return false;
    const end = safeParseDate(endStr);
    const nowTs = new Date(now + 'T12:00:00').getTime();
    return end < nowTs && t.percentComplete < 100;
  });
  
  const currentWeek = getCurrentWeek();
  const weekPlans = plans.filter(p => p.week === currentWeek);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed' || p.status === 'in_progress').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;
  const restrictions = constraints.filter(c => c.status === 'open');

  const plannedEnd = useMemo(() => {
    return getProjectPlannedEnd(tasks) || project.endDate;
  }, [tasks, project.endDate]);

// Moved delayDays calculation down

  const curveSData = useMemo(() => calculateSCurve(tasks, project), [tasks, project]);

  const nowTs = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }, []);

  const lastCurvePoint = useMemo(() => {
    if (curveSData.length === 0) return null;
    const pastPoints = curveSData.filter(p => p.timestamp <= nowTs);
    return pastPoints.length > 0 ? pastPoints[pastPoints.length - 1] : curveSData[0];
  }, [curveSData, nowTs]);

  const curveDeviation = lastCurvePoint ? lastCurvePoint.planejado - lastCurvePoint.realizado : 0;

  // --- NEW ADVANCED METRICS ---
  const spi = useMemo(() => {
    if (!lastCurvePoint || lastCurvePoint.planejado === 0) return 1.0;
    return Number((lastCurvePoint.realizado / lastCurvePoint.planejado).toFixed(2));
  }, [lastCurvePoint]);

  const criticalTasks = tasks.filter(t => isCriticalPath(t, tasks));
  const criticalCompletedCount = criticalTasks.filter(t => t.percentComplete === 100).length;
  const criticalPathProgress = criticalTasks.length > 0 
    ? Math.round((criticalCompletedCount / criticalTasks.length) * 100) 
    : 100;

  const productivity = weekPlans.length > 0 
    ? Math.round((weekCompleted / weekPlans.length) * 100) 
    : 0;

  const healthScore = useMemo(() => {
    const ppcWeight = (ppc || 0) * 0.3;
    const spiWeight = Math.min(spi, 1.1) * 35; // Cap SPI influence
    const critWeight = (criticalPathProgress || 0) * 0.2;
    const restWeight = Math.max(0, 15 - (restrictions.length * 2)); // Penalize open restrictions
    
    return Math.min(100, Math.round(ppcWeight + spiWeight + critWeight + restWeight));
  }, [ppc, spi, criticalPathProgress, restrictions.length]);

  const healthColor = healthScore >= 80 ? 'text-status-ok' : healthScore >= 60 ? 'text-status-warning' : 'text-status-danger';
  const spiColor = spi >= 1 ? 'text-status-ok' : spi >= 0.9 ? 'text-status-warning' : 'text-status-danger';

  const delayDays = useMemo(() => {
    const planned = safeParseDate(plannedEnd);
    const meta = safeParseDate(project.endDate);
    const diff = Math.ceil((planned - meta) / 86400000);
    return diff > 0 ? diff : 0;
  }, [plannedEnd, project.endDate]);

  // PPC history data
  const ppcChartData = history.sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
    week: h.weekLabel,
    PPC: h.ppc,
  }));

  const ppcTrend = ppcChartData.length >= 2
    ? ppcChartData[ppcChartData.length - 1].PPC >= ppcChartData[ppcChartData.length - 2].PPC ? '↑ Subindo' : '↓ Caindo'
    : '';

  // Alerts
  const alerts: { text: string; type: 'warning' | 'danger'; onClick?: () => void }[] = [];
  
  if (spi < 0.9) {
    alerts.push({ text: `SPI Crítico (${spi}). Obra em ritmo de atraso severo.`, type: 'danger' });
  }
  if (ppc !== null && ppc < 50) {
    alerts.push({ text: `PPC muito baixo (${ppc}%). Baixa confiabilidade do planejamento.`, type: 'danger', onClick: () => setSearchParams({ tab: 'lean', subtab: 'indicadores' }) });
  } else if (ppc !== null && ppc < 80) {
    alerts.push({ text: `PPC da semana em ${ppc}%. Atenção ao cumprimento das metas.`, type: 'warning', onClick: () => setSearchParams({ tab: 'lean', subtab: 'indicadores' }) });
  }
  
  const expiredRestrictions = constraints.filter(c => c.status === 'open' && c.dueDate && c.dueDate < now);
  if (expiredRestrictions.length > 0) {
    alerts.push({ text: `${expiredRestrictions.length} restrição(ões) com prazo VENCIDO no Lean.`, type: 'danger', onClick: () => setSearchParams({ tab: 'lean', subtab: 'restricoes' }) });
  } else if (restrictions.length > 0) {
    alerts.push({ text: `${restrictions.length} restrição(ões) pendente(s).`, type: 'warning', onClick: () => setSearchParams({ tab: 'lean', subtab: 'restricoes' }) });
  }

  if (delayed.length > 0) {
    alerts.push({ text: `${delayed.length} tarefa(s) atrasada(s) no caminho crítico.`, type: 'danger', onClick: () => setSearchParams({ tab: 'kanban' }) });
  }

  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with Mode Toggle */}
        <div className="flex justify-between items-center bg-muted/20 p-2 rounded-2xl border border-border/30">
          <div className="px-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance Insights
            </h2>
          </div>
          <div className="flex items-center gap-3">
          <Sheet open={isHelpOpen} onOpenChange={setIsHelpOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full bg-background border-border/40 text-muted-foreground hover:text-primary transition-all">
                <HelpCircle className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-display font-black flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  Guia de Indicadores
                </SheetTitle>
                <SheetDescription className="text-sm font-medium">
                  Entenda como os índices da Buddy Construtora ajudam na tomada de decisão.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-8 pr-2">
                {/* Saúde da Obra */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-status-ok/10 rounded-lg">
                      <HeartPulse className="w-4 h-4 text-status-ok" />
                    </div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground">Saúde da Obra (0-100)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    É a nota geral do projeto. Ela combina <strong>PPC (30%)</strong>, <strong>SPI (35%)</strong>, <strong>Caminho Crítico (20%)</strong> e <strong>Restrições (15%)</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/20">&gt; 80: Excelente</div>
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/20">60-80: Atenção</div>
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/20">&lt; 60: Crítico</div>
                  </div>
                </section>

                <Separator className="bg-border/40" />

                {/* SPI */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                      <Gauge className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground">SPI (Schedule Performance Index)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    Indica a <strong>eficiência do prazo</strong>. Ele compara o progresso real acumulado com o que deveria ter sido feito conforme a Curva S planejada.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-[11px] text-muted-foreground">
                      <span className="text-status-ok font-black">≥ 1.0 :</span> Obra adiantada ou no prazo.
                    </li>
                    <li className="flex gap-2 text-[11px] text-muted-foreground">
                      <span className="text-status-danger font-black">&lt; 1.0 :</span> Obra está produzindo menos que o planejado por dia.
                    </li>
                  </ul>
                </section>

                <Separator className="bg-border/40" />

                {/* PPC */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-600/10 rounded-lg">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground">PPC (Planilha de Planos Concluídos)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mede a <strong>confiabilidade do planejamento</strong> semanal (Lean). Indica quantas tarefas prometidas para a semana foram realmente entregues.
                  </p>
                </section>

                <Separator className="bg-border/40" />

                {/* Caminho Crítico */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-status-danger/10 rounded-lg">
                      <Milestone className="w-4 h-4 text-status-danger" />
                    </div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground">Caminho Crítico (CPM)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    É a sequência de tarefas que determina a <strong>data final da obra</strong>. Qualquer atraso nestas tarefas (marcadas em vermelho no Gantt) atrasa o projeto inteiro. No Dashboard, mostramos o % de conclusão deste caminho.
                  </p>
                </section>

                <Separator className="bg-border/40" />

                {/* Curva S */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-foreground">Curva S (Planejado vs Real)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A linha tracejada (Azul) é o seu <strong>compromisso de entrega</strong> ao longo do tempo. A linha sólida (Laranja) é onde você <strong>realmente está</strong>. O desvio entre elas é o seu fôlego ou atraso.
                  </p>
                </section>

                <div className="pt-6">
                  <div className="p-4 bg-muted/40 rounded-2xl border border-border/40">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Dica de Gestão</h5>
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                      "Utilize o Modo Gerencial para identificar gargalos no Caminho Crítico antes que eles afetem a data final da Meta Contratual."
                    </p>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border border-border/40">
            <Button 
              variant={!isAdvanced ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-5 rounded-lg transition-all ${!isAdvanced ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground'}`}
              onClick={() => setIsAdvanced(false)}
            >
              Modo Simples
            </Button>
            <Button 
              variant={isAdvanced ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`text-xs h-8 px-5 rounded-lg transition-all ${isAdvanced ? 'shadow-sm bg-background border border-border/50' : 'text-muted-foreground'}`}
              onClick={() => setIsAdvanced(true)}
            >
              Modo Gerencial
            </Button>
          </div>
        </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* SAÚDE DA OBRA (Advanced Only) */}
          {isAdvanced && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="card-elevated p-5 border-l-4 border-l-primary flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <HeartPulse className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saúde da Obra</span>
                </div>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground/40" /></TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">
                    Score gerencial baseado em PPC, SPI, Caminho Crítico e Restrições pendentes.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-display font-black ${healthColor}`}>{healthScore}</p>
                <span className="text-sm font-bold text-muted-foreground/40">/100</span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Status: {healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Atenção' : 'Crítico'}</p>
            </motion.div>
          )}

          {/* SPI (Advanced Only) */}
          {isAdvanced && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="card-elevated p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-status-ok/10">
                    <Gauge className="w-4 h-4 text-status-ok" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Índice SPI</span>
                </div>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground/40" /></TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Schedule Performance Index (Executado vs Planejado). {">"}1: Adiantado, {"<"}1: Atrasado.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={`text-4xl font-display font-black ${spiColor}`}>{spi}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Ritmo: {spi >= 1 ? 'Produtivo' : 'Lento'}</p>
            </motion.div>
          )}

          {/* Executado */}
          <motion.div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CheckCircle className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Executado Real</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-display font-black text-foreground">{progress}%</p>
              {isAdvanced && <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">Global</span>}
            </div>
            {lastCurvePoint && (
              <p className="text-[10px] font-bold mt-2 flex items-center gap-1.5">
                <span className="text-muted-foreground underline decoration-dotted">Previsto: {lastCurvePoint.planejado}%</span>
                <span className={`px-1 rounded ${curveDeviation > 2 ? 'bg-status-danger/10 text-status-danger' : curveDeviation < -2 ? 'bg-status-ok/10 text-status-ok' : 'text-muted-foreground'}`}>
                  {curveDeviation > 0 ? `-${curveDeviation}%` : curveDeviation < 0 ? `+${Math.abs(curveDeviation)}%` : '✓'}
                </span>
              </p>
            )}
            <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </motion.div>

          {/* PPC Semana */}
          <motion.div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PPC Semana</span>
              </div>
              {isAdvanced && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${ppcColor.replace('text-', 'bg-').replace('text-', 'bg-')}/10 ${ppcColor}`}>
                  {ppcTrend}
                </span>
              )}
            </div>
            <p className={`text-4xl font-display font-black ${ppcColor}`}>{ppc !== null ? `${ppc}%` : '—'}</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">{weekPlans.length} tarefas no plano</p>
          </motion.div>

          {/* Produtividade (Advanced Only) */}
          {isAdvanced && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="card-elevated p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-500/10">
                    <Hammer className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produção</span>
                </div>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground/40" /></TooltipTrigger>
                  <TooltipContent className="max-w-[180px] text-xs">
                    Métrica de conclusão de tarefas semanais (inclui itens iniciados).
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-display font-black text-foreground">{productivity}%</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Comprometimento</p>
            </motion.div>
          )}

          {/* Caminho Crítico (Advanced Only) */}
          {isAdvanced && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="card-elevated p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-status-danger/10">
                    <Milestone className="w-4 h-4 text-status-danger" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progresso Crítico</span>
                </div>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground/40" /></TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">
                    Percentual de conclusão apenas das tarefas que impactam a data final.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-display font-black text-foreground">{criticalPathProgress}%</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">{criticalCompletedCount}/{criticalTasks.length} concluídas</p>
            </motion.div>
          )}

          {/* Atrasadas */}
          <motion.div className="card-elevated p-5 cursor-pointer hover:bg-muted/5 transition-colors"
            onClick={() => setSearchParams({ tab: 'kanban' })}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-status-danger/10">
                <Clock className="w-4 h-4 text-status-danger" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atrasadas</span>
            </div>
            <p className={`text-4xl font-display font-black ${delayed.length > 0 ? 'text-status-danger underline decoration-2' : 'text-foreground'}`}>{delayed.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">impacto no cronograma</p>
          </motion.div>

          {/* Restrições */}
          <motion.div className="card-elevated p-5 cursor-pointer hover:bg-muted/5 transition-colors"
            onClick={() => setSearchParams({ tab: 'lean', subtab: 'restricoes' })}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-status-warning/10">
                  <Shield className="w-4 h-4 text-status-warning" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Restrições</span>
              </div>
              {isAdvanced && <Zap className="w-3.5 h-3.5 text-status-warning animate-pulse" />}
            </div>
            <p className="text-4xl font-display font-black text-foreground">{restrictions.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">{constraints.length - restrictions.length} resolvidas este mês</p>
          </motion.div>

          {/* Previsão e Cronograma */}
          <motion.div className="card-elevated p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CalendarClock className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prazos e Entrega</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Término do Cronograma</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/50" /></TooltipTrigger>
                      <TooltipContent>Data final da última tarefa cadastrada no planejamento (Gantt).</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xl font-display font-black text-foreground">
                  {new Date(plannedEnd + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Status do Prazo</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><TrendingUp className="w-3 h-3 text-primary/50" /></TooltipTrigger>
                      <TooltipContent>Comparação entre o término do cronograma atual e a meta contratual.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-sm font-bold ${delayDays > 0 ? 'text-status-danger' : 'text-status-ok'}`}>
                    {delayDays > 0 ? `${delayDays} dias de atraso` : 'Dentro do Prazo'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/20">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Meta Contratual</span>
                {!isEditingMeta ? (
                  <button 
                    onClick={() => setIsEditingMeta(true)}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                  >
                    <Edit2 className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={handleSaveMeta} className="p-0.5 hover:bg-status-ok/10 rounded-md">
                      <Check className="w-2.5 h-2.5 text-status-ok" />
                    </button>
                    <button onClick={() => setIsEditingMeta(false)} className="p-0.5 hover:bg-status-danger/10 rounded-md">
                      <X className="w-2.5 h-2.5 text-status-danger" />
                    </button>
                  </div>
                )}
              </div>
              {!isEditingMeta ? (
                <p className="text-[10px] font-bold text-foreground">
                  {new Date(safeParseDate(project.endDate)).toLocaleDateString('pt-BR')}
                </p>
              ) : (
                <Input 
                  type="date"
                  value={tempMeta}
                  onChange={(e) => setTempMeta(e.target.value)}
                  className="h-6 text-[10px] mt-1"
                  autoFocus
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* Alert Banners */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                onClick={alert.onClick}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl border ${alert.onClick ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''} ${
                  alert.type === 'danger'
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-status-warning/10 border-status-warning/20'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.type === 'danger' ? 'text-destructive' : 'text-status-warning'}`} />
                <span className="text-sm font-bold text-foreground leading-tight">{alert.text}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Curva S */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-base">Curva S</h3>
              {lastCurvePoint && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  curveDeviation > 5
                    ? 'bg-destructive/10 text-destructive'
                    : curveDeviation > 0
                    ? 'bg-[hsl(38_92%_50%/0.1)] text-status-warning'
                    : 'bg-[hsl(152_60%_42%/0.1)] text-status-ok'
                }`}>
                  {curveDeviation > 0 ? `-${curveDeviation}% atraso` : curveDeviation === 0 ? 'No prazo' : `+${Math.abs(curveDeviation)}% adiant.`}
                </span>
              )}
            </div>
            {curveSData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={curveSData}>
                    <defs>
                      <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-planned))" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="hsl(var(--chart-planned))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10 }} 
                      stroke="hsl(var(--muted-foreground))"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10 }} 
                      stroke="hsl(var(--muted-foreground))" 
                      tickFormatter={v => `${v}%`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip 
                      formatter={(v: number) => `${v}%`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                     <Area 
                      type="monotone" 
                      name="Planejado" 
                      dataKey="planejado" 
                      stroke="hsl(var(--chart-planned))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="url(#plannedGradient)" 
                    />
                    <Line 
                      type="monotone" 
                      name="Realizado" 
                      dataKey="realizado" 
                      stroke="hsl(var(--chart-actual))" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    {lastCurvePoint && (
                      <ReferenceLine x={lastCurvePoint.label} stroke="hsl(var(--accent))" strokeDasharray="3 3" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Adicione tarefas para visualizar a Curva S
              </div>
            )}
          </div>

          {/* PPC Semanal */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-base">PPC Semanal</h3>
              {ppcTrend && (
                <span className="text-xs font-medium text-muted-foreground">{ppcTrend}</span>
              )}
            </div>
            {ppcChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ppcChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 15% 90%)" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" tickFormatter={v => `${v}%`} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="PPC" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Feche semanas no Lean para ver o histórico PPC
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

import React, { useState } from 'react';
import { Project, getProjectProgress } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import {
  exportToExcel, exportToPdf, formatCurrency, formatDate,
  exportHierarchicalToPdf, exportHierarchicalToExcel, HierarchicalRow
} from '@/lib/exportUtils';
import { 
  FileText, TableProperties, GanttChart, 
  Triangle, Wallet, Download, FileSpreadsheet,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportsTabProps {
  project: Project;
}

export default function ReportsTab({ project }: ReportsTabProps) {
  const { 
    getTasksForProject, 
    getConstraintsForProject, 
    getDailyLogsForProject,
    getReceiptsForProject,
    users
  } = useProjects();

  const tasks = getTasksForProject(project.id);
  const constraints = getConstraintsForProject(project.id);
  const dailyLogs = getDailyLogsForProject(project.id);
  const receipts = getReceiptsForProject(project.id);

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

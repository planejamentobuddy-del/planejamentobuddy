import { useProjects } from '@/hooks/useProjects';
import { getProjectProgress, getProjectStatus, getEstimatedEndDate } from '@/types/project';
import { Printer, ArrowLeft, Building2, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function RelatorioGeral() {
  const { projects, getTasksForProject, tasks, loading } = useProjects();
  const navigate = useNavigate();

  if (loading) {
    return <div className="p-8 text-center">Carregando relatório...</div>;
  }

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const activeTasks = tasks.filter(t => activeProjects.some(p => p.id === t.projectId));
  const generalProgress = getProjectProgress(activeTasks);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Não Impresso */}
      <div className="print:hidden border-b bg-card py-4 px-6 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={handlePrint} className="gap-2 btn-primary">
          <Printer className="w-4 h-4" /> Imprimir Relatório
        </Button>
      </div>

      {/* Conteúdo Impresso */}
      <div className="max-w-5xl mx-auto p-8 print:p-0 print:m-0 bg-white min-h-screen text-slate-900">
        
        {/* Cabeçalho do Relatório */}
        <div className="border-b-2 border-slate-200 pb-6 mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Relatório Geral de Obras</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Buddy Construtora</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 font-medium">Data de Emissão</p>
            <p className="font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Resumo Geral */}
        <div className="bg-slate-50 rounded-xl p-6 mb-10 border border-slate-100">
          <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Resumo Consolidado
          </h2>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <p className="text-sm text-slate-500 font-medium mb-2">Progresso Geral de Todas as Obras Ativas</p>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden border border-slate-300">
                <div 
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${generalProgress}%` }} 
                />
              </div>
            </div>
            <div className="text-5xl font-black text-blue-600">
              {generalProgress}%
            </div>
          </div>
          <div className="mt-6 flex gap-6 border-t border-slate-200 pt-6">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total de Obras</p>
              <p className="text-2xl font-black text-slate-800">{activeProjects.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total de Tarefas</p>
              <p className="text-2xl font-black text-slate-800">{activeTasks.length}</p>
            </div>
          </div>
        </div>

        {/* Detalhamento das Obras */}
        <div>
          <h2 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-2">
            Detalhamento por Obra
          </h2>
          <div className="space-y-6">
            {activeProjects.length === 0 ? (
              <p className="text-slate-500">Nenhuma obra ativa encontrada.</p>
            ) : (
              activeProjects.map(project => {
                const pTasks = getTasksForProject(project.id);
                const progress = getProjectProgress(pTasks);
                const estimated = getEstimatedEndDate(project, pTasks);
                return (
                  <div key={project.id} className="border border-slate-200 rounded-lg p-5 page-break-inside-avoid">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {project.name}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{project.description || 'Sem descrição'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black text-blue-600">{progress}%</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Início</span>
                        <span className="font-semibold">{new Date(project.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Previsão</span>
                        <span className="font-semibold">{new Date(estimated + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Tarefas</span>
                        <span className="font-semibold">{pTasks.length}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Rodapé de Impressão */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 font-medium">
          Gerado pelo Sistema de Planejamento Buddy Construtora - {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  );
}

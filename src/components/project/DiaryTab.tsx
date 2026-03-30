import React, { useState } from 'react';
import { Project, DailyLog } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Plus, Clock, User, FileText, Trash2, Edit2 } from 'lucide-react';

interface DiaryTabProps {
  project: Project;
}

export default function DiaryTab({ project }: DiaryTabProps) {
  const { getDailyLogsForProject, addDailyLog, deleteDailyLog, users } = useProjects();
  const { user, profile } = useAuth();
  
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logs = getDailyLogsForProject(project.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !date) return;
    
    setIsSubmitting(true);
    await addDailyLog({
      projectId: project.id,
      date,
      content,
      createdBy: user?.id || null
    });
    
    setContent('');
    setIsSubmitting(false);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Desconhecido';
    const found = users.find(u => u.id === userId);
    return found ? found.full_name : 'Usuário Arquivado';
  };

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Novo Registro Diário
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48 shrink-0">
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">Data da Ocorrência</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="pl-9 font-medium"
                  required
                />
              </div>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">Relato do Dia</label>
              <Textarea
                placeholder="Descreva as atividades, problemas no clima, falta de materiais, pendências ou ocorrências gerais do dia..."
                className="min-h-[100px] resize-y"
                value={content}
                onChange={e => setContent(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting || !content.trim()} className="gap-2 font-bold px-6">
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar Relatório'}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Histórico do Diário de Obras
        </h3>
        
        {logs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-slate-600 font-semibold mb-1">Nenhum registro encontrado</h3>
            <p className="text-slate-400 text-sm">Os relatórios diários aparecerão aqui em ordem cronológica.</p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[27px] before:w-0.5 before:bg-slate-200">
            {logs.map((log) => {
              const formattedDate = format(parseISO(log.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
              
              return (
                <div key={log.id} className="relative flex gap-6">
                  <div className="absolute left-[-11px] top-6 w-4 h-4 rounded-full border-[3px] border-white bg-primary shadow-sm z-10" />
                  <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-primary/20 transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          {formattedDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                          <User className="w-3.5 h-3.5" />
                          {getUserName(log.createdBy)}
                        </div>
                        {user?.id === log.createdBy && (
                          <button 
                            onClick={() => {
                              if(window.confirm('Tem certeza que deseja excluir esta anotação?')) {
                                deleteDailyLog(log.id);
                              }
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Excluir relatório"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {log.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

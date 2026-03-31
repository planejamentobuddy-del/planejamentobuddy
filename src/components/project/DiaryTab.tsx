import React, { useState } from 'react';
import { Project } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Plus, Clock, User, FileText,
  Trash2, Edit2, Check, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiaryTabProps {
  project: Project;
}

export default function DiaryTab({ project }: DiaryTabProps) {
  const { getDailyLogsForProject, addDailyLog, updateDailyLog, deleteDailyLog, users } = useProjects();
  const { user } = useAuth();

  // New entry state
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const logs = getDailyLogsForProject(project.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !date) return;

    setIsSubmitting(true);
    await addDailyLog({
      projectId: project.id,
      date,
      content,
      createdBy: user?.id || null,
    });

    setContent('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsSubmitting(false);
  };

  const handleStartEdit = (log: { id: string; content: string; date: string }) => {
    setEditingId(log.id);
    setEditContent(log.content);
    setEditDate(log.date);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditDate('');
  };

  const handleSaveEdit = async (log: { id: string; projectId: string; content: string; date: string; createdAt: string; createdBy: string | null }) => {
    if (!editContent.trim()) return;
    setIsSavingEdit(true);
    await updateDailyLog({ ...log, content: editContent, date: editDate });
    setIsSavingEdit(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta anotação?')) {
      deleteDailyLog(id);
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Sistema';
    const found = users.find(u => u.id === userId);
    return found ? found.full_name : 'Usuário Arquivado';
  };

  return (
    <div className="space-y-6">
      {/* Formulário de novo registro */}
      <div className="card-elevated p-6">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Novo Registro Diário
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48 shrink-0">
              <label className="text-sm font-bold text-muted-foreground mb-1.5 block">Data da Ocorrência</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
              <label className="text-sm font-bold text-muted-foreground mb-1.5 block">Relato do Dia</label>
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

      {/* Histórico */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          Histórico do Diário de Obras
          <span className="ml-auto text-sm font-normal text-muted-foreground">{logs.length} registro(s)</span>
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-muted-foreground font-semibold mb-1">Nenhum registro encontrado</h3>
            <p className="text-muted-foreground/60 text-sm">Os relatórios diários aparecerão aqui em ordem cronológica.</p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[27px] before:w-0.5 before:bg-border">
            <AnimatePresence initial={false}>
              {logs.map((log) => {
                const formattedDate = format(parseISO(log.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
                const isEditing = editingId === log.id;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="relative flex gap-6"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-[-11px] top-6 w-4 h-4 rounded-full border-[3px] border-background bg-primary shadow-sm z-10" />

                    <div className="flex-1 bg-card p-5 rounded-2xl border border-border shadow-sm hover:border-primary/20 transition-colors group">

                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <div className="relative">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                type="date"
                                value={editDate}
                                onChange={e => setEditDate(e.target.value)}
                                className="pl-8 h-8 text-sm font-semibold w-44"
                              />
                            </div>
                          ) : (
                            <span className="font-black text-foreground uppercase tracking-widest text-sm flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              {formattedDate}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                            <User className="w-3.5 h-3.5" />
                            {getUserName(log.createdBy)}
                          </div>

                          {/* Ações — visíveis para TODOS no hover */}
                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(log)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Editar registro"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Excluir registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Ações de edição */}
                          {isEditing && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(log)}
                                disabled={isSavingEdit || !editContent.trim()}
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                                title="Salvar edição"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Cancelar edição"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo */}
                      {isEditing ? (
                        <Textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="min-h-[80px] resize-y text-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                          {log.content}
                        </div>
                      )}

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

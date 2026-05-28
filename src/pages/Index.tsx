import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, TrendingUp, Calendar, Shield, LogOut, ClipboardCheck, Trash2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Project, getProjectProgress, getProjectStatus, getEstimatedEndDate } from '@/types/project';

const statusConfig = {
  ok: { emoji: '✓', label: 'No Prazo', class: 'status-badge-ok' },
  warning: { emoji: '!', label: 'Atenção', class: 'status-badge-warning' },
  danger: { emoji: '⚠', label: 'Atrasada', class: 'status-badge-danger' },
};

export default function Index() {
  const { projects, addProject, updateProject, deleteProject, getTasksForProject, loading, tasks, constraints, plans } = useProjects();
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '', description: '' });

  const startEditing = (project: Project) => {
    setEditProject(project);
    setEditForm({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      description: project.description || '',
    });
  };

  const closeEditDialog = () => {
    setEditProject(null);
    setEditForm({ name: '', startDate: '', endDate: '', description: '' });
  };

  const handleSaveEdit = async () => {
    if (!editProject) return;
    if (!editForm.name || !editForm.startDate || !editForm.endDate) return;
    setSubmitting(true);
    const success = await updateProject({
      ...editProject,
      name: editForm.name,
      startDate: editForm.startDate,
      endDate: editForm.endDate,
      description: editForm.description,
    });
    setSubmitting(false);
    if (success) {
      closeEditDialog();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await deleteProject(deleteConfirm);
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) return;
    setSubmitting(true);
    const p = await addProject(form);
    setSubmitting(false);
    if (p) {
      setForm({ name: '', startDate: '', endDate: '', description: '' });
      setOpen(false);
      navigate(`/obra/${p.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex items-center justify-between py-4 px-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-display font-black text-foreground tracking-tight">Buddy Construtora</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Gestão de Obras • {profile?.full_name || 'Usuário'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="gap-2 rounded-xl text-primary font-bold hover:bg-primary/5 relative px-4" onClick={() => navigate('/minhas-tarefas')}>
              <ClipboardCheck className="w-4 h-4" /> Minhas Tarefas
              {(() => {
                const me = profile?.full_name?.toLowerCase().trim() || '';
                const match = (name?: string) => {
                  const n = name?.toLowerCase().trim() || '';
                  return n && me && (n === me || n.includes(me) || me.includes(n));
                };
                const count = tasks.filter(t => match(t.responsible) && t.status !== 'completed').length +
                             constraints.filter(c => match(c.responsible) && c.status === 'open').length +
                             plans.filter(p => {
                               if (!match(p.responsible)) return false;
                               if (p.status === 'completed') return false;
                               // Skip linked plans if the task is already counted
                               if (p.taskId && tasks.some(t => t.id === p.taskId && match(t.responsible))) return false;
                               return true;
                             }).length;
                if (count === 0) return null;
                return (
                  <span className="absolute -top-1.5 -right-1 w-5 h-5 bg-status-danger text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-md animate-pulse">
                    {count}
                  </span>
                );
              })()}
            </Button>
            {isAdmin && (
              <Button variant="ghost" className="gap-2 rounded-xl font-bold" onClick={() => navigate('/admin/users')}>
                <Shield className="w-4 h-4" /> Usuários
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary gap-2 h-10">
                  <Plus className="w-4 h-4" /> Nova Obra
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nova Obra</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Nome da obra</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Residencial Alfa" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data de início</Label>
                      <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Previsão de término</Label>
                      <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição da obra" />
                  </div>
                  <Button onClick={handleCreate} className="w-full" disabled={submitting}>
                    {submitting ? 'Criando...' : 'Criar Obra'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => signOut()} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!loading && projects.length > 0 && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex flex-col md:flex-row items-center gap-6 justify-between shadow-sm">
            <div className="flex-1 w-full">
              <h2 className="text-xl font-display font-black text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Progresso Geral das Obras
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Progresso consolidado de todas as obras/blocos cadastrados</p>
            </div>
            <div className="flex-1 w-full flex items-center gap-4">
              <div className="flex-1 bg-background/50 rounded-full h-4 overflow-hidden shadow-inner border border-primary/10">
                <div 
                  className="h-full rounded-full bg-blue-600 transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${getProjectProgress(tasks)}%` }} 
                />
              </div>
              <span className="font-black text-3xl text-blue-600">{getProjectProgress(tasks)}%</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Plus className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">Nenhuma obra cadastrada</h2>
            <p className="text-muted-foreground mb-6">Clique em "+ Nova Obra" para começar</p>
          </motion.div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => {
              const tasks = getTasksForProject(project.id);
              const progress = getProjectProgress(tasks);
              const status = getProjectStatus(tasks);
              const estimated = getEstimatedEndDate(project, tasks);
              const cfg = statusConfig[status];
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-elevated p-6 cursor-pointer group hover:border-primary/40 relative overflow-hidden"
                  onClick={() => navigate(`/obra/${project.id}`)}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110" />
                  
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <h3 className="font-display font-black text-foreground text-xl leading-tight group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest ${cfg.class}`}>
                         {cfg.label}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(project); }}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-foreground hover:scale-110"
                        title="Editar obra"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600 hover:scale-110"
                        title="Excluir obra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-6 relative z-10">
                    <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-tighter">
                      <span className="text-muted-foreground">Status do Cronograma</span>
                      <span className="text-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden shadow-inner font-bold">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out shadow-sm"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-[11px] font-bold text-muted-foreground relative z-10">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      PREVISÃO: {new Date(estimated).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      {tasks.length} TAREFAS
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Excluir Obra?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Esta ação é <strong>irreversível</strong>. Todos os dados da obra serão excluídos permanentemente, incluindo tarefas, cronograma, planejamento Lean, diário de obras e histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir obra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edição de obra */}
      <Dialog open={!!editProject} onOpenChange={(v) => !v && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar Obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome da obra</Label>
              <Input 
                value={editForm.name} 
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} 
                placeholder="Ex: Residencial Alfa" 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de início</Label>
                <Input 
                  type="date" 
                  value={editForm.startDate} 
                  onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} 
                />
              </div>
              <div>
                <Label>Previsão de término</Label>
                <Input 
                  type="date" 
                  value={editForm.endDate} 
                  onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} 
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea 
                value={editForm.description} 
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} 
                placeholder="Descrição da obra" 
              />
            </div>
            <Button onClick={handleSaveEdit} className="w-full" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

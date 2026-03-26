import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, TrendingUp, Calendar, Shield, LogOut, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { getProjectProgress, getProjectStatus, getEstimatedEndDate } from '@/types/project';

const statusConfig = {
  ok: { emoji: '🟢', label: 'Em dia', class: 'status-badge-ok' },
  warning: { emoji: '🟡', label: 'Atenção', class: 'status-badge-warning' },
  danger: { emoji: '🔴', label: 'Atrasada', class: 'status-badge-danger' },
};

export default function Index() {
  const { projects, addProject, getTasksForProject, loading, tasks, constraints } = useProjects();
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', description: '' });

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
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between py-5 px-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">Buddy</h1>
              <p className="text-xs text-muted-foreground">
                Olá, {profile?.full_name || 'Usuário'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 rounded-xl text-primary border-primary/20 hover:bg-primary/5 relative" onClick={() => navigate('/minhas-tarefas')}>
              <ClipboardCheck className="w-4 h-4" /> Minhas Tarefas
              {(() => {
                const count = tasks.filter(t => t.responsible?.toLowerCase() === profile?.full_name?.toLowerCase() && t.status !== 'completed').length +
                             constraints.filter(c => c.responsible?.toLowerCase() === profile?.full_name?.toLowerCase() && c.status === 'open').length;
                return count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background animate-in zoom-in duration-300">
                    {count}
                  </span>
                );
              })()}
            </Button>
            {isAdmin && (
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => navigate('/admin/users')}>
                <Shield className="w-4 h-4" /> Usuários
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
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
                  transition={{ delay: i * 0.05 }}
                  className="card-elevated p-5 cursor-pointer group"
                  onClick={() => navigate(`/obra/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-display font-semibold text-foreground text-lg leading-tight group-hover:text-accent transition-colors">
                      {project.name}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.class}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-semibold text-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Prev: {new Date(estimated).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {tasks.length} tarefas
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

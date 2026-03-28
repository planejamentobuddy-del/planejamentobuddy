import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useState } from 'react';
import { User, Calendar, CheckSquare } from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';

function isOverdue(task: Task): boolean {
  if (task.percentComplete >= 100) return false;
  const now = new Date().toISOString().split('T')[0];
  return task.endDate < now;
}

type KanbanColumn = {
  key: string;
  label: string;
  borderColor: string;
  bgColor: string;
  filter: (t: Task) => boolean;
};


const columns: KanbanColumn[] = [
  {
    key: 'not_started',
    label: 'Não Iniciado',
    borderColor: 'border-muted-foreground/20',
    bgColor: 'bg-muted/10',
    filter: t => t.status === 'not_started' && !isOverdue(t),
  },
  {
    key: 'in_progress',
    label: 'Em Andamento',
    borderColor: 'border-blue-600',
    bgColor: 'bg-blue-600/5',
    filter: t => t.status === 'in_progress' && !isOverdue(t),
  },
  {
    key: 'completed',
    label: 'Concluído',
    borderColor: 'border-status-ok',
    bgColor: 'bg-status-ok/5',
    filter: t => t.status === 'completed',
  },
  {
    key: 'delayed',
    label: 'Atrasado',
    borderColor: 'border-status-danger',
    bgColor: 'bg-status-danger/5',
    filter: t => t.status === 'delayed' || isOverdue(t),
  },
];

export default function KanbanTab({ project }: { project: Project }) {
  const { getTasksForProject, updateTask } = useProjects();
  const tasks = getTasksForProject(project.id);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleDragStart = (id: string) => setDragging(id);

  const handleDrop = async (colKey: string) => {
    if (!dragging) return;
    const task = tasks.find(t => t.id === dragging);
    if (!task) return;

    let status: TaskStatus;
    let percentComplete = task.percentComplete;

    switch (colKey) {
      case 'completed':
        status = 'completed';
        percentComplete = 100;
        break;
      case 'in_progress':
        status = 'in_progress';
        percentComplete = Math.max(percentComplete, 1);
        break;
      case 'delayed':
        status = 'delayed';
        break;
      default:
        status = 'not_started';
    }

    await updateTask({ ...task, status, percentComplete });
    setDragging(null);
  };

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <div className="space-y-5">
      <h2 className="font-display font-bold text-lg text-foreground">Kanban</h2>

      {tasks.length === 0 ? (
        <div className="card-elevated p-12 text-center text-muted-foreground text-sm">
          Adicione tarefas no Planejamento para visualizar o Kanban
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(col => {
            const colTasks = tasks.filter(col.filter);
            return (
              <div
                key={col.key}
                className={`rounded-2xl border-t-[3px] ${col.borderColor} ${col.bgColor} border border-border/50 min-h-[320px] flex flex-col`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                  <h3 className="font-display font-black text-xs uppercase tracking-widest text-foreground">{col.label}</h3>
                  <span className="text-[10px] font-black text-foreground bg-muted/50 rounded-lg px-2 py-0.5 border border-border/50">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2.5 flex-1">
                  {colTasks.map(task => {
                    const progressColor = task.percentComplete >= 100
                      ? 'bg-status-ok'
                      : task.status === 'in_progress'
                      ? 'bg-blue-600'
                      : 'bg-muted-foreground/20';

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onClick={() => setSelectedTask(task)}
                        className="p-4 rounded-xl border border-border/50 bg-card cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 transition-all duration-200 group"
                      >
                        <p className="text-sm font-bold text-foreground mb-3 leading-snug group-hover:text-primary transition-colors">{task.name}</p>

                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground mb-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{task.responsible || 'Sem responsável'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground mb-4">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(task.startDate)} → {formatDate(task.endDate)}</span>
                        </div>

                        {task.checklists && task.checklists.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-4 bg-muted/40 w-fit px-2.5 py-1 rounded-lg border border-border/50">
                            <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            <span>{task.checklists.filter(c => c.completed).length}/{task.checklists.length} ITENS</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${task.percentComplete >= 100 ? 'bg-status-ok' : 'bg-blue-600'} transition-all duration-500`}
                              style={{ width: `${task.percentComplete}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-black text-foreground w-8 text-right">{task.percentComplete}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
                      Arraste tarefas aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
        />
      )}
    </div>
  );
}

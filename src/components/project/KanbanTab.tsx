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
    borderColor: 'border-muted-foreground/30',
    bgColor: 'bg-card',
    filter: t => t.status === 'not_started' && !isOverdue(t),
  },
  {
    key: 'in_progress',
    label: 'Em Andamento',
    borderColor: 'border-accent',
    bgColor: 'bg-card',
    filter: t => t.status === 'in_progress' && !isOverdue(t),
  },
  {
    key: 'completed',
    label: 'Concluído',
    borderColor: 'border-status-ok',
    bgColor: 'bg-card',
    filter: t => t.status === 'completed',
  },
  {
    key: 'delayed',
    label: 'Atrasado',
    borderColor: 'border-destructive',
    bgColor: 'bg-card',
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
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/30">
                  <h3 className="font-display font-semibold text-sm text-foreground">{col.label}</h3>
                  <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2.5 flex-1">
                  {colTasks.map(task => {
                    const progressColor = task.percentComplete >= 100
                      ? 'bg-status-ok'
                      : task.percentComplete > 0
                      ? 'bg-accent'
                      : 'bg-muted-foreground/20';

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onClick={() => setSelectedTask(task)}
                        className="p-3.5 rounded-xl border border-border/40 bg-background cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-border/80 transition-all"
                      >
                        <p className="text-sm font-semibold text-foreground mb-2 leading-tight">{task.name}</p>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <User className="w-3 h-3" />
                          <span>{task.responsible || '—'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(task.startDate)} → {formatDate(task.endDate)}</span>
                        </div>

                        {task.checklists && task.checklists.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-3 bg-muted/40 w-fit px-2 py-0.5 rounded-full border border-border/50">
                            <CheckSquare className="w-3 h-3 text-primary" />
                            <span>{task.checklists.filter(c => c.completed).length}/{task.checklists.length}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressColor} transition-all`}
                              style={{ width: `${task.percentComplete}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{task.percentComplete}%</span>
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

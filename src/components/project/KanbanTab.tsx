import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useState } from 'react';

const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'not_started', label: 'A Fazer', color: 'border-t-muted-foreground' },
  { status: 'in_progress', label: 'Em Execução', color: 'border-t-accent' },
  { status: 'completed', label: 'Concluído', color: 'border-t-status-ok' },
];

export default function KanbanTab({ project }: { project: Project }) {
  const { getTasksForProject, updateTask } = useProjects();
  const tasks = getTasksForProject(project.id);
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragging(id);

  const handleDrop = (status: TaskStatus) => {
    if (!dragging) return;
    const task = tasks.find(t => t.id === dragging);
    if (task) {
      const percentComplete = status === 'completed' ? 100 : status === 'in_progress' ? Math.max(task.percentComplete, 1) : task.percentComplete;
      updateTask({ ...task, status, percentComplete });
    }
    setDragging(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-lg">Kanban</h2>
      {tasks.length === 0 ? (
        <div className="card-elevated p-8 text-center text-muted-foreground">Adicione tarefas no Planejamento</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {columns.map(col => {
            const colTasks = tasks.filter(t => {
              if (col.status === 'not_started') return t.status === 'not_started' || t.status === 'delayed';
              return t.status === col.status;
            });
            return (
              <div
                key={col.status}
                className={`rounded-xl border-t-4 ${col.color} bg-card p-3 min-h-[300px]`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.status)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-sm">{col.label}</h3>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      className="p-3 rounded-lg border bg-background cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                    >
                      <p className="text-sm font-medium mb-1">{task.name}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.responsible || 'Sem responsável'}</span>
                        <span>{task.percentComplete}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${task.percentComplete}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Project, Task, ProjectResource, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, AlertCircle, Clock } from 'lucide-react';

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Não iniciado', color: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  { value: 'in_progress', label: 'Em andamento', color: 'bg-blue-600/10 text-blue-600 border-blue-600/20' },
  { value: 'completed', label: 'Concluído', color: 'bg-status-ok/10 text-status-ok border-status-ok/20' },
  { value: 'delayed', label: 'Atrasado', color: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
];

export default function AssignmentsTab({ project }: { project: Project }) {
  const { getTasksForProject, getResourcesForProject, updateTask } = useProjects();
  const allTasks = getTasksForProject(project.id);
  const resources = getResourcesForProject(project.id);

  // Filter: exclude completed tasks as requested
  const activeTasks = useMemo(() => 
    allTasks.filter(t => t.status !== 'completed' && t.parentId) // only leaf tasks/subtasks
  , [allTasks]);

  // Grouping logic
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    
    // Initialize groups for formal resources
    resources.forEach(r => {
      groups[r.name] = [];
    });

    // Populate groups
    activeTasks.forEach(task => {
      const resp = task.responsible || 'Sem responsável';
      if (!groups[resp]) {
        groups[resp] = [];
      }
      groups[resp].push(task);
    });

    // Sort: resources first, then others
    return Object.entries(groups)
      .map(([name, tasks]) => [
        name,
        [...tasks].sort((a, b) => a.startDate.localeCompare(b.startDate))
      ] as [string, Task[]])
      .sort(([nameA], [nameB]) => {
        const isResA = resources.some(r => r.name === nameA);
        const isResB = resources.some(r => r.name === nameB);
        if (isResA && !isResB) return -1;
        if (!isResA && isResB) return 1;
        return nameA.localeCompare(nameB);
      })
      .filter(([_, tasks]) => tasks.length > 0); // Only show groups with tasks
  }, [activeTasks, resources]);

  const handleDateChange = async (task: Task, field: 'startDate' | 'endDate', value: string) => {
    if (!value || value.length < 10) return;
    await updateTask({ ...task, [field]: value });
  };

  const getStatusBadge = (status: TaskStatus) => {
    const opt = statusOptions.find(o => o.value === status) || statusOptions[0];
    return (
      <Badge variant="outline" className={`${opt.color} text-[10px] uppercase font-bold py-0 h-5`}>
        {opt.label}
      </Badge>
    );
  };

  const formatDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex items-center gap-3">
        <Clock className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-primary">Tarefas Ativas por Colaborador</h3>
          <p className="text-xs text-muted-foreground">Listagem de atividades pendentes agrupadas por responsável.</p>
        </div>
      </div>

      {groupedTasks.length === 0 ? (
        <div className="card-elevated py-12 text-center text-muted-foreground bg-card/50 border-dashed">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhuma tarefa pendente encontrada para este projeto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {groupedTasks.map(([name, tasks]) => {
            const isFormalResource = resources.some(r => r.name === name);
            return (
              <div key={name} className="flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between ${isFormalResource ? 'bg-primary/[0.03] border-b border-primary/10' : 'bg-muted/30 border-b border-border/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isFormalResource ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{name}</h4>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                        {tasks.length} {tasks.length === 1 ? 'Tarefa' : 'Tarefas'}
                      </p>
                    </div>
                  </div>
                  {!isFormalResource && (
                    <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground border-transparent">CADASTRO EXTERNO</Badge>
                  )}
                </div>

                <div className="divide-y divide-border/50">
                  {tasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-4">
                          <h5 className="font-semibold text-sm leading-tight flex-1">{task.name}</h5>
                          {getStatusBadge(task.status)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Início:</span>
                              <Input 
                                type="date" 
                                value={task.startDate} 
                                onChange={e => handleDateChange(task, 'startDate', e.target.value)}
                                className="h-7 w-[125px] text-[11px] px-2 bg-transparent border-border/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 py-0"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Término:</span>
                              <Input 
                                type="date" 
                                value={task.endDate} 
                                onChange={e => handleDateChange(task, 'endDate', e.target.value)}
                                className="h-7 w-[125px] text-[11px] px-2 bg-transparent border-border/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 py-0"
                              />
                            </div>
                          </div>
                        </div>
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

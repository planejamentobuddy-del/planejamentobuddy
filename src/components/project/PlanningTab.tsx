import { useState } from 'react';
import { Project, Task, TaskStatus } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Não iniciada' },
  { value: 'in_progress', label: 'Em execução' },
  { value: 'completed', label: 'Concluída' },
  { value: 'delayed', label: 'Atrasada' },
];

export default function PlanningTab({ project }: { project: Project }) {
  const { getTasksForProject, addTask, updateTask, deleteTask } = useProjects();
  const tasks = getTasksForProject(project.id);

  const handleAdd = () => {
    const start = project.startDate;
    const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().split('T')[0];
    addTask({
      projectId: project.id,
      name: 'Nova Tarefa',
      startDate: start,
      endDate: end,
      duration: 7,
      percentComplete: 0,
      responsible: '',
      predecessors: [],
      hasRestriction: false,
      restrictionType: '',
      status: 'not_started',
    });
  };

  const handleChange = (task: Task, field: keyof Task, value: any) => {
    const updated = { ...task, [field]: value };
    // Auto-calc duration when dates change
    if (field === 'startDate' || field === 'endDate') {
      const s = new Date(updated.startDate).getTime();
      const e = new Date(updated.endDate).getTime();
      updated.duration = Math.max(1, Math.round((e - s) / 86400000));
    }
    if (field === 'duration') {
      const s = new Date(updated.startDate).getTime();
      updated.endDate = new Date(s + value * 86400000).toISOString().split('T')[0];
    }
    if (field === 'percentComplete' && value >= 100) {
      updated.status = 'completed';
    }
    updateTask(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Planejamento de Tarefas</h2>
        <Button onClick={handleAdd} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Tarefa</Button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium">Tarefa</th>
              <th className="text-left p-3 font-medium">Início</th>
              <th className="text-left p-3 font-medium">Término</th>
              <th className="text-left p-3 font-medium w-20">Dias</th>
              <th className="text-left p-3 font-medium w-20">%</th>
              <th className="text-left p-3 font-medium">Responsável</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium w-16">Restr.</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id} className="border-b hover:bg-muted/20 transition-colors">
                <td className="p-2">
                  <Input className="h-8 text-sm border-0 bg-transparent focus-visible:bg-card" value={task.name} onChange={e => handleChange(task, 'name', e.target.value)} />
                </td>
                <td className="p-2">
                  <Input type="date" className="h-8 text-sm border-0 bg-transparent" value={task.startDate} onChange={e => handleChange(task, 'startDate', e.target.value)} />
                </td>
                <td className="p-2">
                  <Input type="date" className="h-8 text-sm border-0 bg-transparent" value={task.endDate} onChange={e => handleChange(task, 'endDate', e.target.value)} />
                </td>
                <td className="p-2">
                  <Input type="number" className="h-8 text-sm border-0 bg-transparent w-16" value={task.duration} onChange={e => handleChange(task, 'duration', parseInt(e.target.value) || 1)} />
                </td>
                <td className="p-2">
                  <Input type="number" min={0} max={100} className="h-8 text-sm border-0 bg-transparent w-16" value={task.percentComplete} onChange={e => handleChange(task, 'percentComplete', Math.min(100, parseInt(e.target.value) || 0))} />
                </td>
                <td className="p-2">
                  <Input className="h-8 text-sm border-0 bg-transparent" value={task.responsible} onChange={e => handleChange(task, 'responsible', e.target.value)} placeholder="Nome" />
                </td>
                <td className="p-2">
                  <Select value={task.status} onValueChange={v => handleChange(task, 'status', v)}>
                    <SelectTrigger className="h-8 text-xs border-0 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 text-center">
                  <Checkbox checked={task.hasRestriction} onCheckedChange={v => handleChange(task, 'hasRestriction', v)} />
                </td>
                <td className="p-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhuma tarefa. Clique em "+ Tarefa" para adicionar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link2, X, AlertTriangle, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { Project, Task, CrossProjectPredecessor } from '@/types/project';

interface Props {
  open: boolean;
  onClose: () => void;
  currentTask: Task;
  currentProject: Project;
  allProjects: Project[];
  allTasks: Task[];  // all tasks from all projects (from useProjects global state)
  existingLinks: CrossProjectPredecessor[];
  onSave: (links: CrossProjectPredecessor[]) => void;
}

export default function CrossProjectPredecessorPicker({
  open,
  onClose,
  currentTask,
  currentProject,
  allProjects,
  allTasks,
  existingLinks,
  onSave,
}: Props) {
  const [links, setLinks] = useState<CrossProjectPredecessor[]>(existingLinks);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [lagDays, setLagDays] = useState<number>(0);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

  // Other projects (not the current one)
  const otherProjects = useMemo(
    () => allProjects.filter(p => p.id !== currentProject.id && p.status !== 'archived'),
    [allProjects, currentProject.id]
  );

  // Tasks of the selected project
  const tasksOfSelectedProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return allTasks
      .filter(t => t.projectId === selectedProjectId && !t.parentId) // only top-level stages
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [allTasks, selectedProjectId]);

  const filteredTasks = useMemo(() => {
    if (!taskSearch) return tasksOfSelectedProject;
    const q = taskSearch.toLowerCase();
    return tasksOfSelectedProject.filter(t => t.name.toLowerCase().includes(q));
  }, [tasksOfSelectedProject, taskSearch]);

  const selectedTask = useMemo(
    () => allTasks.find(t => t.id === selectedTaskId),
    [allTasks, selectedTaskId]
  );

  const selectedProject = useMemo(
    () => allProjects.find(p => p.id === selectedProjectId),
    [allProjects, selectedProjectId]
  );

  const handleAddLink = () => {
    if (!selectedTaskId || !selectedProjectId) return;
    // Avoid duplicate
    if (links.some(l => l.taskId === selectedTaskId)) return;
    setLinks(prev => [...prev, { taskId: selectedTaskId, projectId: selectedProjectId, lagDays }]);
    // Reset
    setSelectedTaskId('');
    setLagDays(0);
    setTaskSearch('');
  };

  const handleRemoveLink = (taskId: string) => {
    setLinks(prev => prev.filter(l => l.taskId !== taskId));
  };

  const getTaskInfo = (link: CrossProjectPredecessor) => {
    const task = allTasks.find(t => t.id === link.taskId);
    const proj = allProjects.find(p => p.id === link.projectId);
    return { task, proj };
  };

  // Check if adding current task would create a date conflict
  const checkConflict = (link: CrossProjectPredecessor): { hasConflict: boolean; message: string } => {
    const predTask = allTasks.find(t => t.id === link.taskId);
    if (!predTask) return { hasConflict: false, message: '' };
    const predEnd = predTask.endDate;
    const lag = link.lagDays || 0;
    if (!predEnd || !currentTask.startDate) return { hasConflict: false, message: '' };

    // Add lag days to pred end
    const predEndDate = new Date(predEnd + 'T12:00:00');
    let daysAdded = 0;
    while (daysAdded < lag) {
      predEndDate.setDate(predEndDate.getDate() + 1);
      const day = predEndDate.getDay();
      if (day !== 0 && day !== 6) daysAdded++;
    }
    const effectivePredEnd = predEndDate.toISOString().split('T')[0];

    if (predTask.status === 'completed') {
      return { hasConflict: false, message: '✔ Predecessora já concluída' };
    }
    if (currentTask.startDate <= effectivePredEnd) {
      return {
        hasConflict: true,
        message: `Conflito: ${currentTask.name} inicia em ${currentTask.startDate} mas predecessora termina em ${effectivePredEnd}`,
      };
    }
    return { hasConflict: false, message: '' };
  };

  const statusBadge = (task?: Task) => {
    if (!task) return null;
    const map: Record<string, { label: string; cls: string }> = {
      completed: { label: 'Concluída', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
      in_progress: { label: 'Em andamento', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      delayed: { label: 'Atrasada', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
      not_started: { label: 'Não iniciada', cls: 'bg-muted text-muted-foreground border-border' },
      rescheduled: { label: 'Reprogramada', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    };
    const cfg = map[task.status] || map['not_started'];
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Link2 className="w-5 h-5 text-primary" />
            Vincular Predecessoras de Outras Obras
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          Tarefa atual: <span className="font-semibold text-foreground">{currentTask.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">({currentProject.name})</span>
        </div>

        {/* Add new link */}
        <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicionar Dependência</p>

          {/* Project picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">1. Selecione a obra</Label>
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setSelectedTaskId(''); setTaskSearch(''); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Escolha a obra..." />
                </SelectTrigger>
                <SelectContent>
                  {otherProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lag */}
            <div>
              <Label className="text-xs mb-1.5 block">Folga em dias úteis</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={lagDays}
                onChange={e => setLagDays(Number(e.target.value) || 0)}
                className="h-9 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          {/* Task picker */}
          {selectedProjectId && (
            <div>
              <Label className="text-xs mb-1.5 block">2. Selecione a etapa/tarefa predecessora</Label>
              <Popover open={taskPickerOpen} onOpenChange={setTaskPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                    {selectedTask ? selectedTask.name : 'Escolha uma etapa...'}
                    <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar etapa..."
                      value={taskSearch}
                      onValueChange={setTaskSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhuma etapa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {filteredTasks.map(t => (
                          <CommandItem
                            key={t.id}
                            onSelect={() => { setSelectedTaskId(t.id); setTaskPickerOpen(false); setTaskSearch(''); }}
                            className={`text-xs ${selectedTaskId === t.id ? 'bg-primary/10 text-primary' : ''}`}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{t.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {statusBadge(t)}
                                <span className="text-muted-foreground font-mono text-[9px]">{t.endDate}</span>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Button
            onClick={handleAddLink}
            disabled={!selectedTaskId || !selectedProjectId}
            className="h-8 text-xs gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" /> Adicionar vínculo
          </Button>
        </div>

        {/* Existing links */}
        {links.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vínculos Existentes</p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {links.map(link => {
                const { task: predTask, proj: predProj } = getTaskInfo(link);
                const { hasConflict, message } = checkConflict(link);
                return (
                  <div
                    key={link.taskId}
                    className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${hasConflict ? 'border-red-400/40 bg-red-500/5' : 'border-border/60 bg-muted/10'}`}
                  >
                    <Link2 className={`w-4 h-4 mt-0.5 shrink-0 ${hasConflict ? 'text-red-500' : 'text-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{predTask?.name || link.taskId}</span>
                        {statusBadge(predTask)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <span>🏗️</span> {predProj?.name || link.projectId}
                        </span>
                        {predTask && (
                          <span>· Término: <b>{predTask.endDate}</b></span>
                        )}
                        {(link.lagDays ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" /> {link.lagDays}d folga
                          </span>
                        )}
                      </div>
                      {hasConflict && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{message}</span>
                        </div>
                      )}
                      {!hasConflict && message && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{message}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 shrink-0 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => handleRemoveLink(link.taskId)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {links.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">Nenhum vínculo externo definido.</p>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSave(links); onClose(); }} className="gap-2">
            <Link2 className="w-4 h-4" /> Salvar Vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

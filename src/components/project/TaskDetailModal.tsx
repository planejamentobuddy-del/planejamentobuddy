import React, { useState, useEffect } from 'react';
import { Task, ChecklistItem, generateId, ServiceFront, safeParseDate } from '@/types/project';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User,
  AlignLeft,
  Briefcase,
  Users,
  Percent,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Paperclip,
  History,
  Settings,
  Edit2,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import StatusCommentLog from './StatusCommentLog';
import { useProjects } from '@/hooks/ProjectsContext';

function getBusinessDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = safeParseDate(startDateStr);
  const end = safeParseDate(endDateStr);
  if (start > end) return 0;
  let days = 1;
  let current = new Date(start);
  while (current.getTime() < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

function addBusinessDays(startDateStr: string, duration: number): string {
  if (!startDateStr || duration < 1) return startDateStr;
  const d = new Date(safeParseDate(startDateStr));
  let added = 1;
  while (added < duration) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return d.toISOString().split('T')[0];
}

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => Promise<void>;
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate }: TaskDetailModalProps) {
  const { tasks: allTasksGlobal, users: usersList } = useProjects();
  const [localTask, setLocalTask] = useState<Task | null>(null);
  
  // Checklist State
  const [newItemTitle, setNewItemTitle] = useState('');
  
  // Frentes de Serviço State
  const [isAddingFrente, setIsAddingFrente] = useState(false);
  const [editingFrenteId, setEditingFrenteId] = useState<string | null>(null);
  const [frenteForm, setFrenteForm] = useState<Omit<ServiceFront, 'id'>>({
    name: '',
    responsible: '',
    mestreObras: '',
    encarregado: '',
    team: '',
    workersCount: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    duration: 1,
    percentComplete: 0,
    status: 'not_started',
    observations: '',
    predecessorId: undefined,
  });

  // Attachments state
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');

  // Costs state (stored inside task object jsonb fields `costPlanned` and `costActual`)
  const [costPlanned, setCostPlanned] = useState<number>(0);
  const [costActual, setCostActual] = useState<number>(0);

  useEffect(() => {
    if (task) {
      setLocalTask({
        ...task,
        checklists: task.checklists || [],
        frentes: task.frentes || [],
        frentesMode: task.frentesMode || 'manual',
      });
      // Load cost info if saved in task properties
      setCostPlanned((task as any).costPlanned || 0);
      setCostActual((task as any).costActual || 0);
    }
  }, [task]);

  if (!localTask) return null;

  const projectTasks = allTasksGlobal.filter(t => t.projectId === localTask.projectId && t.id !== localTask.id);

  const handleSaveCosts = async () => {
    const updatedTask = {
      ...localTask,
      costPlanned,
      costActual,
    } as any;
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success('Valores de custo atualizados.');
  };

  // CHECKLIST ACTIONS
  const handleAddChecklistItem = async () => {
    if (!newItemTitle.trim()) return;
    const newItem: ChecklistItem = {
      id: generateId(),
      title: newItemTitle.trim(),
      completed: false,
    };
    const updatedTask = { ...localTask, checklists: [...(localTask.checklists || []), newItem] };
    setLocalTask(updatedTask);
    setNewItemTitle('');
    await onUpdate(updatedTask);
  };

  const handleToggleChecklist = async (id: string, completed: boolean) => {
    const updatedChecklists = (localTask.checklists || []).map(item =>
      item.id === id ? { ...item, completed } : item
    );
    const updatedTask = { ...localTask, checklists: updatedChecklists };
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
  };

  const handleDeleteChecklist = async (id: string) => {
    const updatedChecklists = (localTask.checklists || []).filter(item => item.id !== id);
    const updatedTask = { ...localTask, checklists: updatedChecklists };
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
  };

  // DEPENDENCY ACTIONS
  const handleAddPredecessor = async (predId: string) => {
    if (!predId || localTask.predecessors.includes(predId)) return;
    const updatedTask = { ...localTask, predecessors: [...localTask.predecessors, predId] };
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success('Predecessora adicionada.');
  };

  const handleRemovePredecessor = async (predId: string) => {
    const updatedTask = { ...localTask, predecessors: localTask.predecessors.filter(id => id !== predId) };
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success('Predecessora removida.');
  };

  // ATTACHMENT ACTIONS
  const handleAddAttachment = async () => {
    if (!newAttachmentName.trim()) return;
    const attachments = (localTask as any).attachments || [];
    const newAttach = {
      id: generateId(),
      name: newAttachmentName,
      url: newAttachmentUrl || '#',
      uploadedAt: new Date().toISOString(),
    };
    const updatedTask = {
      ...localTask,
      attachments: [...attachments, newAttach]
    } as any;
    setLocalTask(updatedTask);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    await onUpdate(updatedTask);
    toast.success('Anexo adicionado.');
  };

  const handleDeleteAttachment = async (attachId: string) => {
    const attachments = (localTask as any).attachments || [];
    const updatedTask = {
      ...localTask,
      attachments: attachments.filter((a: any) => a.id !== attachId)
    } as any;
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success('Anexo removido.');
  };

  // FRENTES ACTIONS
  const handleSaveFrente = async () => {
    if (!frenteForm.name.trim()) {
      toast.error('O nome da frente é obrigatório.');
      return;
    }

    const currentFrentes = localTask.frentes || [];
    let updatedFrentes: ServiceFront[] = [];

    const historyLog = {
      date: new Date().toISOString(),
      action: editingFrenteId ? 'Edição de Frente' : 'Criação de Frente',
      user: 'Usuário Conectado',
      details: `${editingFrenteId ? 'Editou' : 'Criou'} frente: ${frenteForm.name} - Status: ${frenteForm.status} - Progresso: ${frenteForm.percentComplete}%`
    };

    if (editingFrenteId) {
      updatedFrentes = currentFrentes.map(f =>
        f.id === editingFrenteId ? { ...frenteForm, id: editingFrenteId } : f
      );
      toast.success('Frente de serviço atualizada.');
    } else {
      const newFrente: ServiceFront = {
        ...frenteForm,
        id: generateId(),
      };
      updatedFrentes = [...currentFrentes, newFrente];
      toast.success('Frente de serviço adicionada.');
    }

    // Keep task history logs
    const currentLogs = (localTask as any).historyLogs || [];
    const updatedLogs = [...currentLogs, historyLog];

    // Compute progress automatically if mode is 'auto'
    let finalPercent = localTask.percentComplete;
    let finalStatus = localTask.status;
    if (localTask.frentesMode === 'auto' && updatedFrentes.length > 0) {
      const avg = Math.round(updatedFrentes.reduce((sum, f) => sum + (f.percentComplete || 0), 0) / updatedFrentes.length);
      finalPercent = avg;
      if (avg >= 100) finalStatus = 'completed';
      else if (avg > 0) finalStatus = 'in_progress';
    }

    // Auto-calculate parent task's dates and duration based on frentes (like a Line of Balance)
    let parentStart = localTask.startDate;
    let parentEnd = localTask.endDate;
    let parentDuration = localTask.duration;

    if (updatedFrentes.length > 0) {
      // Find min start and max end of frentes
      const frentesStarts = updatedFrentes.map(f => f.startDate).filter(Boolean).sort();
      const frentesEnds = updatedFrentes.map(f => f.endDate).filter(Boolean).sort();
      
      if (frentesStarts.length > 0) parentStart = frentesStarts[0];
      if (frentesEnds.length > 0) parentEnd = frentesEnds[frentesEnds.length - 1];
      
      // Duration is the sum of durations of all frentes
      parentDuration = updatedFrentes.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
    }

    const updatedTask = {
      ...localTask,
      frentes: updatedFrentes,
      percentComplete: finalPercent,
      status: finalStatus,
      startDate: parentStart,
      endDate: parentEnd,
      duration: parentDuration,
      historyLogs: updatedLogs
    } as any;

    setLocalTask(updatedTask);
    await onUpdate(updatedTask);

    setIsAddingFrente(false);
    setEditingFrenteId(null);
    // Reset form
    setFrenteForm({
      name: '',
      responsible: '',
      mestreObras: '',
      encarregado: '',
      team: '',
      workersCount: 0,
      startDate: localTask.startDate || new Date().toISOString().split('T')[0],
      endDate: localTask.endDate || new Date().toISOString().split('T')[0],
      duration: localTask.duration || 1,
      percentComplete: 0,
      status: 'not_started',
      observations: '',
      predecessorId: undefined,
    });
  };

  const handleEditFrenteClick = (frente: ServiceFront) => {
    setEditingFrenteId(frente.id);
    setFrenteForm({
      name: frente.name,
      responsible: frente.responsible,
      mestreObras: frente.mestreObras || '',
      encarregado: frente.encarregado || '',
      team: frente.team || '',
      workersCount: frente.workersCount || 0,
      startDate: frente.startDate,
      endDate: frente.endDate,
      duration: frente.duration || 1,
      percentComplete: frente.percentComplete || 0,
      status: frente.status,
      observations: frente.observations || '',
      predecessorId: frente.predecessorId,
    });
    setIsAddingFrente(true);
  };

  const handleDeleteFrente = async (frenteId: string) => {
    const currentFrentes = localTask.frentes || [];
    const updatedFrentes = currentFrentes.filter(f => f.id !== frenteId);

    const historyLog = {
      date: new Date().toISOString(),
      action: 'Exclusão de Frente',
      user: 'Usuário Conectado',
      details: `Excluiu frente de serviço`
    };

    let finalPercent = localTask.percentComplete;
    let finalStatus = localTask.status;
    if (localTask.frentesMode === 'auto') {
      if (updatedFrentes.length > 0) {
        const avg = Math.round(updatedFrentes.reduce((sum, f) => sum + (f.percentComplete || 0), 0) / updatedFrentes.length);
        finalPercent = avg;
        if (avg >= 100) finalStatus = 'completed';
        else if (avg > 0) finalStatus = 'in_progress';
      } else {
        finalPercent = 0;
        finalStatus = 'not_started';
      }
    }

    // Auto-calculate parent task's dates and duration based on frentes (like a Line of Balance)
    let parentStart = localTask.startDate;
    let parentEnd = localTask.endDate;
    let parentDuration = localTask.duration;

    if (updatedFrentes.length > 0) {
      const frentesStarts = updatedFrentes.map(f => f.startDate).filter(Boolean).sort();
      const frentesEnds = updatedFrentes.map(f => f.endDate).filter(Boolean).sort();
      
      if (frentesStarts.length > 0) parentStart = frentesStarts[0];
      if (frentesEnds.length > 0) parentEnd = frentesEnds[frentesEnds.length - 1];
      
      parentDuration = updatedFrentes.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
    }

    const updatedTask = {
      ...localTask,
      frentes: updatedFrentes,
      percentComplete: finalPercent,
      status: finalStatus,
      startDate: parentStart,
      endDate: parentEnd,
      duration: parentDuration,
      historyLogs: [...((localTask as any).historyLogs || []), historyLog]
    } as any;

    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success('Frente de serviço excluída.');
  };

  const handleFrentesModeToggle = async (mode: 'manual' | 'auto') => {
    const currentFrentes = localTask.frentes || [];
    let finalPercent = localTask.percentComplete;
    let finalStatus = localTask.status;

    if (mode === 'auto' && currentFrentes.length > 0) {
      const avg = Math.round(currentFrentes.reduce((sum, f) => sum + (f.percentComplete || 0), 0) / currentFrentes.length);
      finalPercent = avg;
      if (avg >= 100) finalStatus = 'completed';
      else if (avg > 0) finalStatus = 'in_progress';
    }

    const updatedTask = {
      ...localTask,
      frentesMode: mode,
      percentComplete: finalPercent,
      status: finalStatus
    };
    setLocalTask(updatedTask);
    await onUpdate(updatedTask);
    toast.success(`Modo de progresso definido como: ${mode === 'auto' ? 'Automático' : 'Manual'}`);
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  // Metrics calculations for dashboard
  const frentesList = localTask.frentes || [];
  const totalFrentes = frentesList.length;
  const totalWorkers = frentesList.reduce((sum, f) => sum + (Number(f.workersCount) || 0), 0);
  const avgProgress = totalFrentes > 0 ? Math.round(frentesList.reduce((sum, f) => sum + (f.percentComplete || 0), 0) / totalFrentes) : 0;
  const completedFrentes = frentesList.filter(f => f.status === 'completed').length;
  const delayedFrentes = frentesList.filter(f => f.status === 'delayed').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col p-6 overflow-hidden bg-background border border-border/80 shadow-2xl rounded-xl">
        <DialogHeader className="pb-2 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-primary" />
                {localTask.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Visualização detalhada e gerenciamento operacional da atividade
              </DialogDescription>
            </div>
            <div className="bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              Progresso: {localTask.percentComplete}% ({localTask.status === 'completed' ? 'Concluído' : localTask.status === 'in_progress' ? 'Em Andamento' : localTask.status === 'delayed' ? 'Atrasado' : 'Não Iniciado'})
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="geral" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid grid-cols-6 h-11 bg-muted/50 p-1 rounded-lg border border-border/40">
            <TabsTrigger value="geral" className="text-xs font-medium">Geral</TabsTrigger>
            <TabsTrigger value="dependencias" className="text-xs font-medium">Dependências</TabsTrigger>
            <TabsTrigger value="frentes" className="text-xs font-medium">Frentes ({totalFrentes})</TabsTrigger>
            <TabsTrigger value="custos" className="text-xs font-medium">Custos</TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs font-medium">Anexos</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs font-medium">Histórico</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1 py-4">
            
            {/* TAB GERAL */}
            <TabsContent value="geral" className="space-y-6 outline-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Período Planejado</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(localTask.startDate)} - {formatDate(localTask.endDate)}
                    </span>
                  </div>
                </div>

                <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Duração Total</span>
                    <span className="text-sm font-semibold text-foreground">{localTask.duration} dias úteis</span>
                  </div>
                </div>

                <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Responsável Geral</span>
                    <span className="text-sm font-semibold text-foreground">{localTask.responsible || 'Sem responsável'}</span>
                  </div>
                </div>
              </div>

              {localTask.observations && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <AlignLeft className="w-4 h-4 text-muted-foreground" />
                    Observações
                  </h4>
                  <div className="text-sm text-muted-foreground bg-muted/20 border border-border/40 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {localTask.observations}
                  </div>
                </div>
              )}

              <div className="border-t border-border/50 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    Checklist Operacional
                  </h4>
                  {localTask.checklists && localTask.checklists.length > 0 && (
                    <span className="text-xs text-muted-foreground font-semibold bg-muted/60 px-2.5 py-1 rounded-full">
                      {localTask.checklists.filter(c => c.completed).length} de {localTask.checklists.length} concluídos
                    </span>
                  )}
                </div>

                {localTask.checklists && localTask.checklists.length > 0 && (
                  <Progress 
                    value={Math.round((localTask.checklists.filter(c => c.completed).length / localTask.checklists.length) * 100)} 
                    className="h-2 rounded-full" 
                  />
                )}

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {localTask.checklists?.map(item => (
                    <div key={item.id} className="flex items-center gap-3 group bg-muted/10 hover:bg-muted/20 p-2.5 rounded-xl border border-border/30 transition-all">
                      <Checkbox 
                        checked={item.completed} 
                        onCheckedChange={(checked) => handleToggleChecklist(item.id, checked as boolean)}
                        id={item.id}
                      />
                      <label 
                        htmlFor={item.id} 
                        className={`flex-1 text-sm cursor-pointer font-medium transition-all ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                      >
                        {item.title}
                      </label>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteChecklist(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {(!localTask.checklists || localTask.checklists.length === 0) && (
                    <div className="text-center py-6 text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60">
                      Nenhum item cadastrado no checklist.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Adicionar um item ao checklist..."
                    value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                    className="flex-1 rounded-lg"
                  />
                  <Button onClick={handleAddChecklistItem} disabled={!newItemTitle.trim()} size="sm" className="rounded-lg px-4 gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
              </div>

              {/* Status Comments Log */}
              <div className="border-t border-border/50 pt-4">
                <StatusCommentLog 
                  comments={localTask.statusComments || []} 
                  onAddComment={async (newComments) => {
                    const updatedTask = { ...localTask, statusComments: newComments };
                    setLocalTask(updatedTask);
                    await onUpdate(updatedTask);
                  }}
                />
              </div>
            </TabsContent>

            {/* TAB DEPENDENCIAS */}
            <TabsContent value="dependencias" className="space-y-4 outline-none">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Predecessoras desta Atividade</h4>
                  <p className="text-xs text-muted-foreground">Atividades que precisam terminar antes do início desta</p>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {localTask.predecessors.map(predId => {
                    const predTask = allTasksGlobal.find(t => t.id === predId);
                    return (
                      <div key={predId} className="flex items-center justify-between p-3 bg-muted/20 border border-border/40 rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{predTask?.name || 'Atividade Excluída'}</p>
                          <span className="text-xs text-muted-foreground">Responsável: {predTask?.responsible || '-'} | Término: {formatDate(predTask?.endDate || '')}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemovePredecessor(predId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {localTask.predecessors.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
                      Nenhuma predecessora vinculada.
                    </div>
                  )}
                </div>

                <div className="border-t border-border/40 pt-4 space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">Vincular Nova Predecessora</label>
                  <select 
                    className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none"
                    onChange={(e) => {
                      handleAddPredecessor(e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Selecione uma atividade para vincular...</option>
                    {projectTasks
                      .filter(t => !localTask.predecessors.includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({formatDate(t.endDate)})</option>
                      ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* TAB FRENTES DE SERVIÇO */}
            <TabsContent value="frentes" className="space-y-6 outline-none">
              {/* Dashboard/Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-muted/10 border border-border/30 p-3 rounded-xl text-center shadow-sm">
                  <FolderOpen className="w-5 h-5 text-primary mx-auto mb-1.5" />
                  <span className="text-2xl font-extrabold text-foreground block">{totalFrentes}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Frentes</span>
                </div>
                <div className="bg-muted/10 border border-border/30 p-3 rounded-xl text-center shadow-sm">
                  <Users className="w-5 h-5 text-sky-500 mx-auto mb-1.5" />
                  <span className="text-2xl font-extrabold text-foreground block">{totalWorkers}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Colaboradores</span>
                </div>
                <div className="bg-muted/10 border border-border/30 p-3 rounded-xl text-center shadow-sm">
                  <Percent className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <span className="text-2xl font-extrabold text-foreground block">{avgProgress}%</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Progresso Médio</span>
                </div>
                <div className="bg-muted/10 border border-border/30 p-3 rounded-xl text-center shadow-sm">
                  <CheckCircle className="w-5 h-5 text-teal-500 mx-auto mb-1.5" />
                  <span className="text-2xl font-extrabold text-foreground block">{completedFrentes}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Concluídas</span>
                </div>
                <div className="bg-muted/10 border border-border/30 p-3 rounded-xl text-center shadow-sm col-span-2 md:col-span-1">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                  <span className="text-2xl font-extrabold text-foreground block">{delayedFrentes}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Atrasadas</span>
                </div>
              </div>

              {/* Progress Mode Setting */}
              <div className="bg-muted/20 border border-border/40 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-primary animate-spin-slow" />
                    Cálculo Automático de Progresso
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Define como o progresso geral da tarefa principal será calculado</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant={localTask.frentesMode === 'manual' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleFrentesModeToggle('manual')}
                    className="rounded-lg text-xs"
                  >
                    Atualização Manual
                  </Button>
                  <Button 
                    variant={localTask.frentesMode === 'auto' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleFrentesModeToggle('auto')}
                    className="rounded-lg text-xs"
                  >
                    Automático pelas Frentes
                  </Button>
                </div>
              </div>

              {/* Adding / Editing Form */}
              {isAddingFrente ? (
                <div className="bg-card border border-primary/30 p-5 rounded-xl space-y-4 shadow-md transition-all">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h5 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Edit2 className="w-4 h-4 text-primary" />
                      {editingFrenteId ? 'Editar Frente de Serviço' : 'Cadastrar Nova Frente de Serviço'}
                    </h5>
                    <Button variant="ghost" size="sm" onClick={() => setIsAddingFrente(false)} className="h-8 text-muted-foreground text-xs hover:text-foreground">
                      Cancelar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Nome da Frente *</label>
                      <Input 
                        placeholder="Ex: Quarto 01 / Frente A" 
                        value={frenteForm.name} 
                        onChange={e => setFrenteForm({ ...frenteForm, name: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Responsável *</label>
                      <Input 
                        placeholder="Nome do responsável" 
                        value={frenteForm.responsible} 
                        onChange={e => setFrenteForm({ ...frenteForm, responsible: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Equipe</label>
                      <Input 
                        placeholder="Nome da equipe" 
                        value={frenteForm.team} 
                        onChange={e => setFrenteForm({ ...frenteForm, team: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Mestre de Obras</label>
                      <Input 
                        placeholder="Nome do mestre" 
                        value={frenteForm.mestreObras} 
                        onChange={e => setFrenteForm({ ...frenteForm, mestreObras: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Encarregado</label>
                      <Input 
                        placeholder="Nome do encarregado" 
                        value={frenteForm.encarregado} 
                        onChange={e => setFrenteForm({ ...frenteForm, encarregado: e.target.value })}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Colaboradores (Qtd.)</label>
                      <Input 
                        type="number" 
                        value={frenteForm.workersCount} 
                        onChange={e => setFrenteForm({ ...frenteForm, workersCount: Number(e.target.value) })}
                        className="h-9 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Início</label>
                      <Input 
                        type="date" 
                        value={frenteForm.startDate} 
                        onChange={e => {
                          const newStart = e.target.value;
                          const newEnd = frenteForm.duration > 0 ? addBusinessDays(newStart, frenteForm.duration) : newStart;
                          setFrenteForm({ ...frenteForm, startDate: newStart, endDate: newEnd });
                        }}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Fim</label>
                      <Input 
                        type="date" 
                        value={frenteForm.endDate} 
                        onChange={e => {
                          const newEnd = e.target.value;
                          const newDur = getBusinessDays(frenteForm.startDate, newEnd);
                          setFrenteForm({ ...frenteForm, endDate: newEnd, duration: newDur });
                        }}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Duração (dias)</label>
                      <Input 
                        type="number" 
                        value={frenteForm.duration} 
                        onChange={e => {
                          const newDur = Math.max(1, Number(e.target.value));
                          const newEnd = addBusinessDays(frenteForm.startDate, newDur);
                          setFrenteForm({ ...frenteForm, duration: newDur, endDate: newEnd });
                        }}
                        className="h-9 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Status</label>
                      <select 
                        value={frenteForm.status} 
                        onChange={e => setFrenteForm({ ...frenteForm, status: e.target.value as any })}
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none"
                      >
                        <option value="not_started">Não Iniciada</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="completed">Concluída</option>
                        <option value="delayed">Atrasada</option>
                        <option value="paused">Pausada</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Frente Predecessora (Dependência)</label>
                      <select 
                        value={(frenteForm as any).predecessorId || ''} 
                        onChange={e => {
                          const predId = e.target.value;
                          const predFrente = frentesList.find(f => f.id === predId);
                          let newStart = frenteForm.startDate;
                          let newEnd = frenteForm.endDate;
                          
                          if (predFrente && predFrente.endDate) {
                            // Default: start next day after predecessor finishes
                            const predEnd = new Date(predFrente.endDate + 'T12:00:00');
                            predEnd.setDate(predEnd.getDate() + 1);
                            newStart = predEnd.toISOString().split('T')[0];
                            
                            const nextEnd = new Date(newStart + 'T12:00:00');
                            nextEnd.setDate(nextEnd.getDate() + (frenteForm.duration > 0 ? frenteForm.duration - 1 : 0));
                            newEnd = nextEnd.toISOString().split('T')[0];
                          }
                          
                          setFrenteForm({ 
                            ...frenteForm, 
                            predecessorId: predId || undefined,
                            startDate: newStart,
                            endDate: newEnd
                          } as any);
                        }}
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none"
                      >
                        <option value="">Nenhuma dependência</option>
                        {frentesList
                          .filter(f => f.id !== editingFrenteId)
                          .map(f => (
                            <option key={f.id} value={f.id}>{f.name} (Termina {formatDate(f.endDate)})</option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Percentual Executado ({frenteForm.percentComplete}%)</label>
                      <Input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={frenteForm.percentComplete} 
                        onChange={e => {
                          const percent = Number(e.target.value);
                          let status = frenteForm.status;
                          if (percent >= 100) status = 'completed';
                          else if (percent > 0 && status === 'not_started') status = 'in_progress';
                          setFrenteForm({ ...frenteForm, percentComplete: percent, status });
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Observações</label>
                    <Textarea 
                      placeholder="Observações adicionais da frente de serviço..." 
                      value={frenteForm.observations} 
                      onChange={e => setFrenteForm({ ...frenteForm, observations: e.target.value })}
                      className="rounded-lg min-h-[60px]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                    <Button variant="outline" size="sm" onClick={() => setIsAddingFrente(false)} className="rounded-lg">
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveFrente} className="rounded-lg">
                      {editingFrenteId ? 'Salvar Alterações' : 'Adicionar Frente'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-foreground text-sm">Frentes Cadastradas</h5>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setFrenteForm({
                        name: '',
                        responsible: '',
                        mestreObras: '',
                        encarregado: '',
                        team: '',
                        workersCount: 0,
                        startDate: localTask.startDate || new Date().toISOString().split('T')[0],
                        endDate: localTask.endDate || new Date().toISOString().split('T')[0],
                        duration: localTask.duration || 1,
                        percentComplete: 0,
                        status: 'not_started',
                        observations: '',
                      });
                      setIsAddingFrente(true);
                    }} 
                    className="rounded-lg gap-1.5 text-xs"
                  >
                    <Plus className="w-4 h-4" /> Nova Frente
                  </Button>
                </div>
              )}

              {/* Frentes List */}
              <div className="space-y-3">
                {frentesList.map(frente => (
                  <div key={frente.id} className="bg-card hover:bg-muted/5 border border-border/50 p-4 rounded-xl shadow-sm space-y-3 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/30 pb-2">
                      <div>
                        <h6 className="font-bold text-foreground flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                          {frente.name}
                        </h6>
                        <span className="text-[11px] text-muted-foreground">
                          Mestre: {frente.mestreObras || '-'} | Encarregado: {frente.encarregado || '-'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shadow-sm ${
                          frente.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                          frente.status === 'in_progress' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600' :
                          frente.status === 'delayed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' :
                          frente.status === 'paused' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                          'bg-zinc-500/10 border-zinc-500/20 text-zinc-600'
                        }`}>
                          {frente.status === 'completed' ? 'Concluída' :
                           frente.status === 'in_progress' ? 'Em Andamento' :
                           frente.status === 'delayed' ? 'Atrasada' :
                           frente.status === 'paused' ? 'Pausada' : 'Não Iniciada'}
                        </span>

                        {/* Quick Progress Slider */}
                        <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/20 min-w-[170px] select-none" onClick={e => e.stopPropagation()}>
                          <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-widest mr-1">Prog:</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={frente.percentComplete || 0}
                            onChange={async (e) => {
                              const newPercent = Number(e.target.value);
                              let newStatus = frente.status;
                              if (newPercent >= 100) newStatus = 'completed';
                              else if (newPercent > 0 && newStatus === 'not_started') newStatus = 'in_progress';
                              
                              const updatedFrentes = (localTask.frentes || []).map(f => {
                                if (f.id === frente.id) {
                                  return { ...f, percentComplete: newPercent, status: newStatus };
                                }
                                return f;
                              });

                              // Compute progress automatically if mode is 'auto'
                              let finalPercent = localTask.percentComplete;
                              let finalStatus = localTask.status;
                              if (localTask.frentesMode === 'auto' && updatedFrentes.length > 0) {
                                const avg = Math.round(updatedFrentes.reduce((sum, f) => sum + (f.percentComplete || 0), 0) / updatedFrentes.length);
                                finalPercent = avg;
                                if (avg >= 100) finalStatus = 'completed';
                                else if (avg > 0) finalStatus = 'in_progress';
                              }

                              const updatedTask = {
                                ...localTask,
                                frentes: updatedFrentes,
                                percentComplete: finalPercent,
                                status: finalStatus,
                              } as any;

                              setLocalTask(updatedTask);
                              await onUpdate(updatedTask);
                            }}
                            className="w-20 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                          <span className="text-xs font-black text-foreground tabular-nums w-8 text-right shrink-0">
                            {frente.percentComplete || 0}%
                          </span>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => handleEditFrenteClick(frente)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                          onClick={() => handleDeleteFrente(frente.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block font-medium">Responsável</span>
                        <span className="font-semibold text-foreground">{frente.responsible}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Equipe / Colab.</span>
                        <span className="font-semibold text-foreground">
                          {frente.team || 'Geral'} ({frente.workersCount || 0} colab.)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Período</span>
                        <span className="font-semibold text-foreground">
                          {formatDate(frente.startDate)} - {formatDate(frente.endDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Duração</span>
                        <span className="font-semibold text-foreground">{frente.duration || 1} dias</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {frente.predecessorId && (() => {
                        const pred = frentesList.find(f => f.id === frente.predecessorId);
                        return pred ? (
                          <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                            Depende de: {pred.name}
                          </span>
                        ) : null;
                      })()}
                      
                      {frente.observations && (
                        <p className="text-[11px] text-muted-foreground bg-muted/10 p-2 rounded-lg italic flex-1">
                          Obs: {frente.observations}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {frentesList.length === 0 && !isAddingFrente && (
                  <div className="text-center py-10 text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
                    Nenhuma frente de serviço cadastrada para esta atividade.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB CUSTOS */}
            <TabsContent value="custos" className="space-y-4 outline-none">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Controle de Custos da Atividade</h4>
                <p className="text-xs text-muted-foreground">Registre os custos previstos e os custos efetivamente realizados nesta tarefa</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Custo Previsto (Orçado)
                  </label>
                  <Input 
                    type="number" 
                    value={costPlanned} 
                    onChange={e => setCostPlanned(Number(e.target.value))}
                    placeholder="R$ 0,00"
                    className="rounded-lg h-10 font-medium"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-sky-500" />
                    Custo Realizado (Gasto)
                  </label>
                  <Input 
                    type="number" 
                    value={costActual} 
                    onChange={e => setCostActual(Number(e.target.value))}
                    placeholder="R$ 0,00"
                    className="rounded-lg h-10 font-medium"
                  />
                </div>
              </div>

              <div className="bg-muted/10 border border-border/40 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Desvio Orçamentário</span>
                  <span className={costActual > costPlanned ? 'text-destructive font-bold' : 'text-emerald-500 font-bold'}>
                    {costActual > costPlanned ? 'Acima do Orçamento' : 'Dentro do Orçamento'}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-foreground">
                  <span>Diferença:</span>
                  <span>
                    R$ {(costActual - costPlanned).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveCosts} className="w-full rounded-lg">
                Salvar Custos
              </Button>
            </TabsContent>

            {/* TAB ANEXOS */}
            <TabsContent value="anexos" className="space-y-4 outline-none">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Documentos e Anexos</h4>
                <p className="text-xs text-muted-foreground">Vincule links de projetos, imagens, planilhas ou relatórios relacionados a esta atividade</p>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {((localTask as any).attachments || []).map((attach: any) => (
                  <div key={attach.id} className="flex items-center justify-between p-3 bg-muted/10 hover:bg-muted/20 border border-border/40 rounded-xl transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div>
                        <a href={attach.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:underline">
                          {attach.name}
                        </a>
                        <span className="text-[10px] text-muted-foreground block">Cadastrado em: {new Date(attach.uploadedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteAttachment(attach.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {(! (localTask as any).attachments || (localTask as any).attachments.length === 0) && (
                  <div className="text-center py-8 text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
                    Nenhum documento ou link anexado ainda.
                  </div>
                )}
              </div>

              <div className="bg-muted/5 border border-border/40 p-4 rounded-xl space-y-3">
                <h5 className="text-xs font-bold text-foreground">Anexar Novo Link / Documento</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input 
                    placeholder="Nome do documento (Ex: Projeto Estrutural PDF)" 
                    value={newAttachmentName}
                    onChange={e => setNewAttachmentName(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                  <Input 
                    placeholder="URL do arquivo (Google Drive, Dropbox, etc.)" 
                    value={newAttachmentUrl}
                    onChange={e => setNewAttachmentUrl(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <Button size="sm" onClick={handleAddAttachment} disabled={!newAttachmentName.trim()} className="w-full rounded-lg text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Anexar
                </Button>
              </div>
            </TabsContent>

            {/* TAB HISTORICO */}
            <TabsContent value="historico" className="space-y-4 outline-none">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Histórico de Alterações</h4>
                <p className="text-xs text-muted-foreground">Registro cronológico de alterações e reprogramações desta tarefa</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {/* Task Reschedules List */}
                {localTask.reschedules && localTask.reschedules.map((res: any) => (
                  <div key={res.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Reprogramação
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(res.rescheduledAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-foreground">
                      Alteração de datas por <strong>{res.rescheduledByName || 'Usuário'}</strong>.
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Anterior: {formatDate(res.previousStart)} - {formatDate(res.previousEnd)}
                    </p>
                    <p className="text-[11px] text-primary font-semibold">
                      Novo: {formatDate(res.newStart)} - {formatDate(res.newEnd)}
                    </p>
                    {res.reasonCategory && (
                      <p className="text-[10px] text-muted-foreground bg-background p-1.5 rounded-md mt-1 italic">
                        Motivo: {res.reasonCategory} {res.reasonDetail ? `(${res.reasonDetail})` : ''}
                      </p>
                    )}
                  </div>
                ))}

                {/* Local Change History logs */}
                {((localTask as any).historyLogs || []).map((log: any, index: number) => (
                  <div key={index} className="p-3 bg-muted/10 border border-border/40 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <History className="w-3.5 h-3.5 text-muted-foreground" />
                        {log.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.date).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {log.details}
                    </p>
                  </div>
                ))}

                {(!localTask.reschedules || localTask.reschedules.length === 0) && (!(localTask as any).historyLogs || (localTask as any).historyLogs.length === 0) && (
                  <div className="text-center py-10 text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
                    Nenhum registro no histórico desta atividade.
                  </div>
                )}
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

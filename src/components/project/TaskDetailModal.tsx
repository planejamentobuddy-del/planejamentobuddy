import { useState, useEffect } from 'react';
import { Task, ChecklistItem, generateId } from '@/types/project';
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
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User,
  AlignLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import StatusCommentLog from './StatusCommentLog';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => Promise<void>;
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate }: TaskDetailModalProps) {
  const [localTask, setLocalTask] = useState<Task | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setLocalTask({ ...task, checklists: task.checklists || [] });
    }
  }, [task]);

  if (!localTask) return null;

  const handleAddChecklistItem = async () => {
    if (!newItemTitle.trim()) return;
    
    // Optimistic UI update
    const newItem: ChecklistItem = {
      id: generateId(),
      title: newItemTitle.trim(),
      completed: false,
    };
    
    const updatedChecklists = [...(localTask.checklists || []), newItem];
    const updatedTask = { ...localTask, checklists: updatedChecklists };
    
    setLocalTask(updatedTask);
    setNewItemTitle('');
    
    setIsSaving(true);
    await onUpdate(updatedTask);
    setIsSaving(false);
  };

  const handleToggleChecklist = async (id: string, completed: boolean) => {
    const updatedChecklists = (localTask.checklists || []).map(item => 
      item.id === id ? { ...item, completed } : item
    );
    const updatedTask = { ...localTask, checklists: updatedChecklists };
    
    setLocalTask(updatedTask);
    
    setIsSaving(true);
    await onUpdate(updatedTask);
    setIsSaving(false);
  };

  const handleDeleteChecklist = async (id: string) => {
    const updatedChecklists = (localTask.checklists || []).filter(item => item.id !== id);
    const updatedTask = { ...localTask, checklists: updatedChecklists };
    
    setLocalTask(updatedTask);
    
    setIsSaving(true);
    await onUpdate(updatedTask);
    setIsSaving(false);
  };

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  const checklists = localTask.checklists || [];
  const completedCount = checklists.filter(c => c.completed).length;
  const progressPercent = checklists.length > 0 ? Math.round((completedCount / checklists.length) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{localTask.name}</DialogTitle>
          <DialogDescription>Detalhes e subtarefas da atividade</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground w-full">
            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatDate(localTask.startDate)} até {formatDate(localTask.endDate)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
              <User className="w-4 h-4" />
              <span>{localTask.responsible || 'Sem responsável'}</span>
            </div>
          </div>

          {/* Description */}
          {localTask.observations && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <AlignLeft className="w-4 h-4" />
                <h3>Observações</h3>
              </div>
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md line-clamp-3">
                {localTask.observations}
              </p>
            </div>
          )}

          {/* Status Comments */}
          <div className="space-y-2">
            <StatusCommentLog 
              comments={localTask.statusComments || []} 
              onAddComment={async (newComments) => {
                const updatedTask = { ...localTask, statusComments: newComments };
                setLocalTask(updatedTask);
                await onUpdate(updatedTask);
              }}
            />
          </div>

          {/* Checklists */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckSquare className="w-4 h-4" />
                <h3>Checklist</h3>
              </div>
              {checklists.length > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {completedCount} de {checklists.length} ({progressPercent}%)
                </span>
              )}
            </div>

            {checklists.length > 0 && (
              <Progress value={progressPercent} className="h-2" />
            )}

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 pb-2">
              {checklists.map(item => (
                <div key={item.id} className="flex items-center gap-3 group bg-muted/20 p-2 rounded-md border border-transparent hover:border-border/50 transition-colors">
                  <Checkbox 
                    checked={item.completed} 
                    onCheckedChange={(checked) => handleToggleChecklist(item.id, checked as boolean)}
                    id={item.id}
                  />
                  <label 
                    htmlFor={item.id} 
                    className={`flex-1 text-sm cursor-pointer transition-colors ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                  >
                    {item.title}
                  </label>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteChecklist(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {checklists.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border/50">
                  Nenhum item adicionado ao checklist ainda.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Input
                placeholder="Adicionar um item..."
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                className="flex-1"
                disabled={isSaving}
              />
              <Button onClick={handleAddChecklistItem} disabled={!newItemTitle.trim() || isSaving} size="sm" className="px-3">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

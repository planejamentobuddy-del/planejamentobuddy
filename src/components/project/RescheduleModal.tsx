import { useState, useMemo, useEffect } from 'react';
import { Task, DELAY_REASONS } from '@/types/project';
import { useReschedule } from '@/hooks/useReschedule';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

interface RescheduleModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const formatDate = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

export function RescheduleModal({ task, isOpen, onClose, projectId }: RescheduleModalProps) {
  const { getTasksForProject, refresh } = useProjects();
  const allTasks = getTasksForProject(projectId);
  const { rescheduleTask, getCascadePreview, loading } = useReschedule();

  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [cascade, setCascade] = useState(false);

  // Reset when task changes
  useEffect(() => {
    if (task) {
      setNewStart(task.currentStart || task.startDate || '');
      setNewEnd(task.currentEnd || task.endDate || '');
      setReasonCategory('');
      setReasonDetail('');
      setCascade(false);
    }
  }, [task]);

  const cascadePreview = useMemo(() => {
    if (!task || !cascade || !newEnd) return [];
    return getCascadePreview(task, newEnd, allTasks);
  }, [task, cascade, newEnd, allTasks, getCascadePreview]);

  const today = new Date().toISOString().split('T')[0];

  const validationErrors: string[] = [];
  if (!reasonCategory) validationErrors.push('Selecione o motivo da reprogramação.');
  if (newStart && newEnd && newEnd <= newStart)
    validationErrors.push('A data de término deve ser posterior à data de início.');

  const canSubmit = validationErrors.length === 0 && newStart && newEnd && !loading;

  const handleConfirm = async () => {
    if (!task || !canSubmit) return;

    const success = await rescheduleTask({
      task,
      newStart,
      newEnd,
      reasonCategory,
      reasonDetail: reasonDetail.trim() || undefined,
      cascade,
      allTasks,
      onTasksUpdated: () => {},
    });

    if (success) {
      await refresh();
      onClose();
    }
  };

  if (!task) return null;

  const currentStart = task.currentStart || task.startDate;
  const currentEnd = task.currentEnd || task.endDate;
  const hasChanged = newStart !== currentStart || newEnd !== currentEnd;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            Reprogramar Tarefa
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{task.name}</span>
            {' — '}datas atuais:{' '}
            <span className="font-mono">{formatDate(currentStart)} → {formatDate(currentEnd)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rs-new-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nova data de início
              </Label>
              <Input
                id="rs-new-start"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-new-end" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nova data de término
              </Label>
              <Input
                id="rs-new-end"
                type="date"
                value={newEnd}
                min={newStart || today}
                onChange={(e) => setNewEnd(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Visual date diff */}
          {hasChanged && newStart && newEnd && (
            <div className="flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-700 dark:text-amber-400">
              <span className="font-mono line-through opacity-60">{formatDate(currentStart)} → {formatDate(currentEnd)}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono font-semibold">{formatDate(newStart)} → {formatDate(newEnd)}</span>
            </div>
          )}

          {/* Reason category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger id="rs-reason-cat" className="h-9">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {DELAY_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason detail */}
          <div className="space-y-1.5">
            <Label htmlFor="rs-reason-detail" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Detalhe (opcional)
            </Label>
            <Textarea
              id="rs-reason-detail"
              placeholder="Descreva o motivo com mais detalhes..."
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              className="resize-none text-sm h-20"
            />
          </div>

          {/* Cascade checkbox */}
          {allTasks.some(t => t.predecessors.includes(task.id)) && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg border border-border/50 px-3 py-2.5">
                <Checkbox
                  id="rs-cascade"
                  checked={cascade}
                  onCheckedChange={(v) => setCascade(!!v)}
                />
                <label htmlFor="rs-cascade" className="text-sm cursor-pointer select-none leading-tight">
                  Atualizar tarefas dependentes automaticamente
                </label>
              </div>

              {/* Cascade preview */}
              {cascade && cascadePreview.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {cascadePreview.length} tarefa(s) serão ajustadas automaticamente:
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {cascadePreview.map(({ task: t, newStart: ns, newEnd: ne }) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-amber-500/60 shrink-0" />
                        <span className="font-medium text-foreground/80 truncate flex-1">{t.name}</span>
                        <span className="font-mono whitespace-nowrap shrink-0">
                          <span className="line-through opacity-40">{formatDate(t.currentEnd || t.endDate)}</span>
                          {' → '}
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">{formatDate(ne)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cascade && cascadePreview.length === 0 && (
                <p className="text-xs text-muted-foreground pl-1">Nenhuma tarefa dependente encontrada.</p>
              )}
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (reasonCategory === '' || (newStart && newEnd && newEnd <= newStart)) && (
            <div className="space-y-1">
              {validationErrors.map((err) => (
                <p key={err} className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-2 mt-2 border-t border-border/40">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CalendarClock className="w-4 h-4" />
                Confirmar Reprogramação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

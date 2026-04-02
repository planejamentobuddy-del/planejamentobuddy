import { useEffect, useState } from 'react';
import { Task, TaskReschedule } from '@/types/project';
import { useReschedule } from '@/hooks/useReschedule';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { History, Link2, CalendarClock } from 'lucide-react';

interface RescheduleHistoryModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

const fmt = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtShort = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

const fmtTimestamp = (ts: string) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export function RescheduleHistoryModal({ task, isOpen, onClose }: RescheduleHistoryModalProps) {
  const { getTaskReschedules } = useReschedule();
  const [records, setRecords] = useState<TaskReschedule[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setLoadingHistory(true);
      getTaskReschedules(task.id)
        .then(setRecords)
        .finally(() => setLoadingHistory(false));
    }
  }, [isOpen, task, getTaskReschedules]);

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5 text-primary" />
            Histórico de Reprogramações
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{task.name}</span>
            {' — '}baseline:{' '}
            <span className="font-mono text-xs">
              {fmtShort(task.plannedStart || task.startDate)} → {fmtShort(task.plannedEnd || task.endDate)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 mt-2 min-h-0">
          {loadingHistory && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              Carregando histórico...
            </div>
          )}

          {!loadingHistory && records.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Nenhuma reprogramação registrada.
            </div>
          )}

          {!loadingHistory &&
            records.map((r, idx) => (
              <div
                key={r.id}
                className="relative border border-border/50 rounded-xl p-4 space-y-2 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                {/* Cascade badge */}
                {r.isCascade && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    <Link2 className="w-2.5 h-2.5" />
                    Cascata
                  </span>
                )}

                {/* Header */}
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">
                      {fmtTimestamp(r.rescheduledAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.rescheduledByName}</p>
                  </div>
                </div>

                {/* Reason */}
                <div className="pl-9 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Motivo</span>
                    <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                      {r.reasonCategory}
                    </span>
                  </div>
                  {r.reasonDetail && (
                    <p className="text-xs text-muted-foreground italic">"{r.reasonDetail}"</p>
                  )}
                </div>

                {/* Date change */}
                <div className="pl-9 flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground line-through">
                    {fmtShort(r.previousStart)} → {fmtShort(r.previousEnd)}
                  </span>
                  <span className="text-muted-foreground/50">→→</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {fmtShort(r.newStart)} → {fmtShort(r.newEnd)}
                  </span>
                </div>

                {/* Separator */}
                {idx < records.length - 1 && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border/50" />
                )}
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

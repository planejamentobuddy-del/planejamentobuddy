import { useState, useRef } from 'react';
import { StatusComment } from '@/types/project';
import { useAuth } from '@/hooks/useAuth';
import { Send, MessageSquare } from 'lucide-react';

interface StatusCommentLogProps {
  comments: StatusComment[];
  onAddComment: (comments: StatusComment[]) => void;
  compact?: boolean; // for use inside table cells
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function StatusCommentLog({ comments = [], onAddComment, compact = false }: StatusCommentLogProps) {
  const { profile } = useAuth();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    const newComment: StatusComment = {
      author: profile?.full_name || 'Usuário',
      text,
      date: new Date().toISOString(),
    };
    onAddComment([...(comments || []), newComment]);
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-slate-50 border border-slate-100 rounded-xl p-3'}`}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3 h-3 text-slate-400" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Atualizações</span>
      </div>

      {/* Comment list */}
      {comments && comments.length > 0 ? (
        <div className={`space-y-2 ${compact ? 'max-h-28' : 'max-h-40'} overflow-y-auto pr-1`}>
          {[...comments].reverse().map((c, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-lg px-2.5 py-1.5 shadow-sm">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold text-primary">{c.author}</span>
                <span className="text-[9px] text-slate-400">{formatDate(c.date)}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">{c.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-slate-400 italic">Nenhum comentário ainda.</p>
      )}

      {/* Input */}
      <div className="flex items-center gap-1.5 mt-2 border-t border-slate-100 pt-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Adicionar atualização... (Enter)"
          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-slate-300"
        />
        <button
          onClick={handleSubmit}
          disabled={!draft.trim()}
          className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

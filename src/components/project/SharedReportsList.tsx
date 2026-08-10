import React, { useState } from 'react';
import { ReportShare, ReportType, REPORT_TYPE_LABELS } from '@/hooks/useReportShares';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Eye, EyeOff, ExternalLink, Trash2, ChevronDown, ChevronUp, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SharedReportsListProps {
  shares: ReportShare[];
  onRevoke: (id: string) => void;
  onReactivate: (id: string) => void;
  loading: boolean;
}

export function SharedReportsList({ shares, onRevoke, onReactivate, loading }: SharedReportsListProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getPublicUrl = (token: string) => `${window.location.origin}/share/${token}`;

  const handleCopy = async (share: ReportShare) => {
    try {
      await navigator.clipboard.writeText(getPublicUrl(share.token));
    } catch {
      const el = document.createElement('textarea');
      el.value = getPublicUrl(share.token);
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(share.id);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const activeShares = shares.filter(s => s.is_active);
  const inactiveShares = shares.filter(s => !s.is_active);
  const shown = expanded ? shares : shares.slice(0, 3);

  if (shares.length === 0 && !loading) return null;

  const fmtDate = (d: string) => {
    try {
      return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch { return d; }
  };

  const fmtAgo = (d: string) => {
    try {
      return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR });
    } catch { return ''; }
  };

  const typeColor: Record<string, string> = {
    executive: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
    planejamento: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    'cronograma-geral': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Links Compartilhados com Clientes
          <span className="text-xs font-normal text-muted-foreground ml-1">
            ({activeShares.length} ativo{activeShares.length !== 1 ? 's' : ''})
          </span>
        </h3>
      </div>

      <div className="space-y-2">
        {shown.map((share) => (
          <div
            key={share.id}
            className={`rounded-xl border p-3.5 flex flex-col gap-2.5 transition-colors ${
              share.is_active
                ? 'bg-card border-border'
                : 'bg-muted/30 border-border/50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor[share.report_type] || 'bg-muted text-muted-foreground border-border'}`}>
                  {REPORT_TYPE_LABELS[share.report_type as ReportType] || share.report_type}
                </span>
                {share.is_active ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    ✓ Ativo
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-500/20">
                    ✕ Revogado
                  </span>
                )}
                {share.label && (
                  <span className="text-xs text-muted-foreground italic">"{share.label}"</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                <Eye className="w-3.5 h-3.5" />
                {share.view_count || 0} visualização{(share.view_count || 0) !== 1 ? 'ões' : ''}
              </div>
            </div>

            {/* Link */}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] bg-muted/60 rounded px-2 py-1 truncate font-mono text-muted-foreground">
                {getPublicUrl(share.token)}
              </code>
              {share.is_active && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopy(share)}
                    title="Copiar link"
                  >
                    {copiedId === share.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => window.open(getPublicUrl(share.token), '_blank')}
                    title="Abrir link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            {/* Meta + actions */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                Criado {fmtAgo(share.created_at)} · {fmtDate(share.created_at)}
              </span>
              <div className="flex gap-1.5">
                {share.is_active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onRevoke(share.id)}
                  >
                    <EyeOff className="w-3 h-3 mr-1" />
                    Revogar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onReactivate(share.id)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Reativar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {shares.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5 mr-1" /> Ver todos ({shares.length} links)</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

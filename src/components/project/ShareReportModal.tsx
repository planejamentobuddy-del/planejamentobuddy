import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReportShare, ReportType, REPORT_TYPE_LABELS } from '@/hooks/useReportShares';

interface ShareReportModalProps {
  open: boolean;
  onClose: () => void;
  share: ReportShare | null;
  reportType: ReportType;
  isGenerating: boolean;
}

export function ShareReportModal({ open, onClose, share, reportType, isGenerating }: ShareReportModalProps) {
  const [copied, setCopied] = useState(false);

  const getPublicUrl = (token: string) => {
    const base = window.location.origin;
    return `${base}/share/${token}`;
  };

  const handleCopy = async () => {
    if (!share) return;
    const url = getPublicUrl(share.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenLink = () => {
    if (!share) return;
    window.open(getPublicUrl(share.token), '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Link2 className="w-5 h-5 text-primary" />
            Link Gerado para o Cliente
          </DialogTitle>
          <DialogDescription>
            Compartilhe este link com o cliente. Ele poderá visualizar o{' '}
            <strong>{REPORT_TYPE_LABELS[reportType]}</strong> sem precisar fazer login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando relatório e salvando link…</p>
            </div>
          ) : share ? (
            <>
              {/* Link display */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Link público
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getPublicUrl(share.token)}
                    className="font-mono text-xs bg-muted/50 text-foreground"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="icon"
                    variant={copied ? 'default' : 'outline'}
                    onClick={handleCopy}
                    className="shrink-0"
                    title="Copiar link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <Check className="w-4 h-4" />
                  Link ativo e pronto para compartilhar
                </div>
                <p className="text-emerald-700/80 dark:text-emerald-400/80 text-xs">
                  O link é permanente e não expira automaticamente. Você pode revogá-lo a qualquer momento na lista de links compartilhados.
                </p>
              </div>

              {/* Instructions */}
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Como usar:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Copie o link acima</li>
                  <li>Envie por WhatsApp, e-mail ou mensagem</li>
                  <li>O cliente abre no celular ou computador sem precisar de conta</li>
                  <li>Para revogar o acesso, use a lista de "Links Compartilhados" na aba de Relatórios</li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCopy} className="flex-1 gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </Button>
                <Button variant="outline" onClick={handleOpenLink} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Visualizar
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Erro ao gerar o link. Tente novamente.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

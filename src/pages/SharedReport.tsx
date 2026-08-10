import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareByToken } from '@/hooks/useReportShares';
import { Loader2, LinkIcon, AlertTriangle, Clock } from 'lucide-react';

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'found' | 'expired' | 'not_found'>('loading');
  const [html, setHtml] = useState<string | null>(null);
  const [reportLabel, setReportLabel] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('not_found');
      return;
    }

    fetchShareByToken(token).then((share) => {
      if (!share) {
        setStatus('not_found');
        return;
      }

      if (!share.is_active) {
        setStatus('expired');
        return;
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        setStatus('expired');
        return;
      }

      setReportLabel(share.report_label || 'Relatório');
      setHtml(share.html_content);
      setStatus('found');
    });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4EEE2] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#1C4A47]" />
        <p className="text-[#6A6358] font-medium text-sm">Carregando relatório…</p>
      </div>
    );
  }

  if (status === 'expired' || status === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4EEE2] px-6">
        <div className="bg-white rounded-2xl shadow-lg border border-[#CFC9BB] p-10 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto">
            {status === 'expired' ? (
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            ) : (
              <LinkIcon className="w-8 h-8 text-slate-400" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-[#211E18] font-[Archivo,sans-serif]">
              {status === 'expired' ? 'Link Indisponível' : 'Link Não Encontrado'}
            </h1>
            <p className="text-[#6A6358] text-sm mt-2 leading-relaxed">
              {status === 'expired'
                ? 'Este link de relatório foi revogado ou desativado pela empresa responsável. Entre em contato para solicitar um novo link.'
                : 'Este endereço de relatório não existe ou já foi removido. Verifique se o link foi copiado corretamente.'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F4EEE2] border border-[#CFC9BB] p-4 text-xs text-[#6A6358]">
            <p className="font-semibold text-[#211E18] mb-1">Buddy Construtora</p>
            <p>Sistema de Gerenciamento de Obras</p>
          </div>
        </div>
      </div>
    );
  }

  // Render the HTML in a full-page iframe
  return (
    <div className="w-full h-screen flex flex-col bg-[#F4EEE2]">
      {/* Thin top bar with branding */}
      <div className="shrink-0 h-8 bg-[#13322F] flex items-center justify-between px-4">
        <span className="text-[#EAD9B6] text-[10px] font-mono tracking-widest uppercase">
          Buddy Construtora · {reportLabel}
        </span>
        <span className="text-[#EAD9B6]/50 text-[9px] font-mono">
          Relatório gerado automaticamente · somente leitura
        </span>
      </div>
      <iframe
        className="flex-1 w-full border-0"
        srcDoc={html!}
        title={reportLabel}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

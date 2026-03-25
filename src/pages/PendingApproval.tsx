import { Building2, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function PendingApproval() {
  const { signOut, profile } = useAuth();

  const statusMessage = profile?.status === 'blocked'
    ? 'Sua conta foi bloqueada. Entre em contato com o administrador.'
    : 'Sua conta está aguardando aprovação de um administrador. Você será notificado quando seu acesso for liberado.';

  const statusTitle = profile?.status === 'blocked'
    ? 'Conta bloqueada'
    : 'Aguardando aprovação';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="card-elevated p-8">
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--status-warning))]/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-[hsl(var(--status-warning))]" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">{statusTitle}</h2>
          <p className="text-muted-foreground mb-6">{statusMessage}</p>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

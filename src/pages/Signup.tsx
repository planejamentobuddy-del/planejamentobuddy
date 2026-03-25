import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao cadastrar', description: error, variant: 'destructive' });
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="card-elevated p-8">
            <CheckCircle className="w-16 h-16 text-[hsl(var(--status-ok))] mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Cadastro realizado!</h2>
            <p className="text-muted-foreground mb-2">
              Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes de você entrar no sistema.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Verifique também seu email para confirmar sua conta.
            </p>
            <Link to="/login">
              <Button className="rounded-xl">Voltar para o Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Planejamento Buddy</h1>
        </div>

        <div className="card-elevated p-8">
          <h2 className="text-lg font-display font-semibold text-foreground mb-6">Criar conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required className="mt-1.5 rounded-xl bg-muted/50 border-0" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className="mt-1.5 rounded-xl bg-muted/50 border-0" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required className="mt-1.5 rounded-xl bg-muted/50 border-0" />
            </div>
            <Button type="submit" className="w-full gap-2 rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Cadastrar
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

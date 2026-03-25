import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: error, variant: 'destructive' });
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4">
            <img src="/logo.jpg" alt="Buddy Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Buddy</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de Obras</p>
        </div>

        <div className="card-elevated p-8">
          <h2 className="text-lg font-display font-semibold text-foreground mb-6">Entrar na sua conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="mt-1.5 rounded-xl bg-muted/50 border-0"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1.5 rounded-xl bg-muted/50 border-0"
              />
            </div>
            <Button type="submit" className="w-full gap-2 rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Entrar
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Esqueci minha senha
            </Link>
            <span className="text-muted-foreground">
              Não tem conta?{' '}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Cadastre-se
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

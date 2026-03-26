import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle, XCircle, Ban, Loader2, Shield, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  status: 'pending' | 'active' | 'blocked';
  created_at: string;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]', icon: '⏳' },
  active: { label: 'Ativo', color: 'bg-[hsl(var(--status-ok))]/10 text-[hsl(var(--status-ok))]', icon: '✅' },
  blocked: { label: 'Bloqueado', color: 'bg-destructive/10 text-destructive', icon: '🚫' },
};

export default function AdminUsers() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newName, setNewName] = useState('');

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const updateStatus = async (userId: string, status: 'active' | 'blocked' | 'pending') => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    setUpdating(null);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: `Status alterado para ${statusConfig[status].label}` });
      fetchUsers();
    }
  };

  const updateName = async () => {
    if (!editingUser) return;

    setUpdating(editingUser.id);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: newName, updated_at: new Date().toISOString() })
      .eq('id', editingUser.id);
    
    setUpdating(null);
    if (error) {
      toast({ title: 'Erro ao atualizar nome', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: `Nome alterado para ${newName}` });
      fetchUsers(); // Refresh the list
      setEditingUser(null); // Close dialog
      setNewName(''); // Clear input
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="container mx-auto flex items-center gap-4 py-4 px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0 rounded-xl hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">Gestão de Usuários</h1>
            <p className="text-xs text-muted-foreground">Aprovar, rejeitar e gerenciar acessos</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cadastro</th>
                  <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const cfg = statusConfig[user.status];
                  return (
                    <tr key={user.id} className="group border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{user.full_name || '—'}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditingUser(user); setNewName(user.full_name || ''); }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {updating === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              {user.status !== 'active' && (
                                <Button variant="ghost" size="sm" className="gap-1 text-xs text-[hsl(var(--status-ok))] hover:text-[hsl(var(--status-ok))]" onClick={() => updateStatus(user.id, 'active')}>
                                  <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                                </Button>
                              )}
                              {user.status !== 'blocked' && (
                                <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => updateStatus(user.id, 'blocked')}>
                                  <Ban className="w-3.5 h-3.5" /> Bloquear
                                </Button>
                              )}
                              {user.status === 'active' && (
                                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => updateStatus(user.id, 'pending')}>
                                  <XCircle className="w-3.5 h-3.5" /> Pendente
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: JERRE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={updateName} disabled={updating === editingUser?.id}>
              {updating === editingUser?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { Project, ProjectResource } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TeamTab({ project }: { project: Project }) {
  const { getResourcesForProject, addResource, updateResource, deleteResource } = useProjects();
  const resources = getResourcesForProject(project.id);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    setIsAdding(true);
    await addResource({
      projectId: project.id,
      name: 'Novo Membro',
      role: '',
      monthlyCost: 0,
      contact: '',
      status: 'active',
    });
    setIsAdding(false);
  };

  const handleChange = async (resource: ProjectResource, field: keyof ProjectResource, value: any) => {
    const updated = { ...resource, [field]: value };
    await updateResource(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Membros da Equipe</h3>
            <p className="text-xs text-muted-foreground">Gerencie as pessoas alocadas para este projeto</p>
          </div>
        </div>
        <Button onClick={handleAdd} disabled={isAdding} className="gap-2 rounded-xl shadow-sm">
          <Plus className="w-4 h-4" /> Adicionar Membro
        </Button>
      </div>

      <div className="card-elevated overflow-hidden p-0">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Função / Cargo</th>
              <th className="px-4 py-3 font-semibold w-32 text-center text-[10px]">Custo Mensal (R$)</th>
              <th className="px-4 py-3 font-semibold w-32 text-center text-[10px]">Custo Diário (R$)</th>
              <th className="px-4 py-3 font-semibold">Contato</th>
              <th className="px-4 py-3 font-semibold w-32">Status</th>
              <th className="px-4 py-3 font-semibold w-24 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground bg-card">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 opacity-20" />
                    <p>Nenhum membro cadastrado nesta equipe.</p>
                  </div>
                </td>
              </tr>
            ) : (
              resources.map(resource => {
                const dailyCost = resource.monthlyCost ? (resource.monthlyCost / 30) : 0;
                return (
                  <tr key={resource.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors bg-card">
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 border-0 bg-transparent px-2 font-medium focus-visible:ring-1 focus-visible:ring-primary/30"
                        value={resource.name}
                        onChange={e => handleChange(resource, 'name', e.target.value)}
                        placeholder="Nome completo..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 border-0 bg-transparent px-2 focus-visible:ring-1 focus-visible:ring-primary/30"
                        value={resource.role || ''}
                        onChange={e => handleChange(resource, 'role', e.target.value)}
                        placeholder="Engenheiro, Pedreiro..."
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        className="h-8 border-0 bg-transparent px-2 text-center focus-visible:ring-1 focus-visible:ring-primary/30 font-bold"
                        value={resource.monthlyCost || ''}
                        onChange={e => handleChange(resource, 'monthlyCost', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="text-xs font-mono text-muted-foreground bg-muted/30 py-1 rounded">
                        {dailyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 border-0 bg-transparent px-2 focus-visible:ring-1 focus-visible:ring-primary/30"
                        value={resource.contact || ''}
                        onChange={e => handleChange(resource, 'contact', e.target.value)}
                        placeholder="Telefone / Email"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={resource.status}
                        onValueChange={v => handleChange(resource, 'status', v as 'active' | 'inactive')}
                      >
                        <SelectTrigger className="h-8 border-0 bg-transparent px-2 focus-visible:ring-1 focus-visible:ring-primary/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-status-ok" />
                              Ativo
                            </span>
                          </SelectItem>
                          <SelectItem value="inactive">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                              Inativo
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteResource(resource.id)}
                        title="Excluir membro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

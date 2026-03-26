import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, TableProperties, GanttChart, Columns3, TrendingUp, FileText, Triangle, ChevronDown, AlertTriangle, Loader2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects';
import DashboardTab from '@/components/project/DashboardTab';
import PlanningTab from '@/components/project/PlanningTab';
import GanttTab from '@/components/project/GanttTab';
import KanbanTab from '@/components/project/KanbanTab';
import LeanTab from '@/components/project/LeanTab';
import CurveSTab from '@/components/project/CurveSTab';

const tabs = [
  { value: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { value: 'planning', label: 'Planejamento', icon: TableProperties },
  { value: 'gantt', label: 'Gantt', icon: GanttChart },
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
  { value: 'curves', label: 'Curva S', icon: TrendingUp },
  { value: 'lean', label: 'Lean', icon: Triangle },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, loading, tasks, constraints } = useProjects();
  const { profile } = useAuth();
  const project = projects.find(p => p.id === id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-display font-semibold mb-2">Obra não encontrada</h2>
          <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="container mx-auto flex items-center gap-4 py-4 px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0 rounded-xl hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Project icon */}
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg text-foreground truncate">Buddy</h1>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground">Gestão de Cronograma</p>
          </div>

          {/* Notifications */}
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 rounded-xl text-primary border-primary/20 hover:bg-primary/5 relative hidden sm:flex" onClick={() => navigate('/minhas-tarefas')}>
              <ClipboardCheck className="w-4 h-4" /> Minhas Tarefas
              {(() => {
                const me = profile?.full_name?.toLowerCase().trim() || '';
                const match = (name?: string) => {
                  const n = name?.toLowerCase().trim() || '';
                  return n && me && (n === me || n.includes(me) || me.includes(n));
                };
                const count = tasks.filter(t => match(t.responsible) && t.status !== 'completed').length +
                             constraints.filter(c => match(c.responsible) && c.status === 'open').length;
                if (count === 0) return null;
                return (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    {count}
                  </span>
                );
              })()}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-5">
        <Tabs value={searchParams.get('tab') || 'dashboard'} onValueChange={(v) => setSearchParams({ tab: v })}>
          <TabsList className="mb-6 bg-transparent border-0 p-0 h-auto gap-1 flex-wrap">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-muted transition-all"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab project={project} /></TabsContent>
          <TabsContent value="planning"><PlanningTab project={project} /></TabsContent>
          <TabsContent value="gantt"><GanttTab project={project} /></TabsContent>
          <TabsContent value="kanban"><KanbanTab project={project} /></TabsContent>
          <TabsContent value="curves"><CurveSTab project={project} /></TabsContent>
          <TabsContent value="lean"><LeanTab project={project} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

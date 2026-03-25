import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects';
import DashboardTab from '@/components/project/DashboardTab';
import PlanningTab from '@/components/project/PlanningTab';
import GanttTab from '@/components/project/GanttTab';
import KanbanTab from '@/components/project/KanbanTab';
import LeanTab from '@/components/project/LeanTab';
import CurveSTab from '@/components/project/CurveSTab';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const project = projects.find(p => p.id === id);

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
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center gap-3 py-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-foreground truncate">{project.name}</h1>
            <p className="text-xs text-muted-foreground">
              {new Date(project.startDate).toLocaleDateString('pt-BR')} — {new Date(project.endDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
            <TabsTrigger value="planning">Planejamento</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lean">Lean</TabsTrigger>
            <TabsTrigger value="curves">Curva S</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab project={project} /></TabsContent>
          <TabsContent value="planning"><PlanningTab project={project} /></TabsContent>
          <TabsContent value="gantt"><GanttTab project={project} /></TabsContent>
          <TabsContent value="kanban"><KanbanTab project={project} /></TabsContent>
          <TabsContent value="lean"><LeanTab project={project} /></TabsContent>
          <TabsContent value="curves"><CurveSTab project={project} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

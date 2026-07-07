import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, TableProperties, GanttChart, Columns3, TrendingUp, FileText, Triangle, ChevronDown, AlertTriangle, Loader2, ClipboardCheck, Wallet, FileSpreadsheet, Sun, ShoppingCart, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects';
import DashboardTab from '@/components/project/DashboardTab';
import PlanningTab from '@/components/project/PlanningTab';
import GanttTab from '@/components/project/GanttTab';
import KanbanTab from '@/components/project/KanbanTab';
import LeanTab from '@/components/project/LeanTab';
import CurveSTab from '@/components/project/CurveSTab';
import AdminTab from '@/components/project/AdminTab';
import DiaryTab from '@/components/project/DiaryTab';
import ReportsTab from '@/components/project/ReportsTab';
import TodayTab from '@/components/project/TodayTab';
import SuppliesTab from '@/components/project/SuppliesTab';
import WorkforceTab from '@/components/project/WorkforceTab';
import PhysicalFinancialTab from '@/components/project/PhysicalFinancialTab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const tabs = [
  { value: 'hoje', label: 'Hoje', icon: Sun },
  { value: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { value: 'planning', label: 'Planejamento', icon: TableProperties },
  { value: 'gantt', label: 'Gantt', icon: GanttChart },
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
  { value: 'physical_financial', label: 'Físico-Financeiro', icon: FileSpreadsheet },
  { value: 'curves', label: 'Curva S', icon: TrendingUp },
  { value: 'lean', label: 'Lean', icon: Triangle },
  { value: 'supplies', label: 'Suprimentos', icon: ShoppingCart },
  { value: 'workforce', label: 'Efetivo', icon: Users },
  { value: 'diary', label: 'Diário', icon: FileText },
  { value: 'admin', label: 'Administração', icon: Wallet },
  { value: 'reports', label: 'Relatórios', icon: FileSpreadsheet },
];

const tabGroups = [
  {
    id: 'paineis',
    label: 'Painéis',
    icon: LayoutDashboard,
    items: ['hoje', 'dashboard', 'diary']
  },
  {
    id: 'cronograma',
    label: 'Planejamento',
    icon: TableProperties,
    items: ['planning', 'gantt', 'kanban', 'lean']
  },
  {
    id: 'recursos',
    label: 'Recursos',
    icon: Users,
    items: ['workforce', 'supplies']
  },
  {
    id: 'controladoria',
    label: 'Controladoria',
    icon: Wallet,
    items: ['physical_financial', 'curves', 'admin', 'reports']
  }
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, loading, tasks, constraints, plans } = useProjects();
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

  const activeTab = searchParams.get('tab') || 'dashboard';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto flex items-center gap-4 pt-4 pb-3 px-6">
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
            <Button variant="outline" className="gap-2 rounded-xl text-primary border-primary/20 hover:bg-primary/5 hidden sm:flex" onClick={() => navigate('/suprimentos')}>
              <ShoppingCart className="w-4 h-4" /> Suprimentos Geral
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl text-primary border-primary/20 hover:bg-primary/5 relative hidden sm:flex" onClick={() => navigate('/minhas-tarefas')}>
              <ClipboardCheck className="w-4 h-4" /> Minhas Tarefas
              {(() => {
                const me = profile?.full_name?.toLowerCase().trim() || '';
                const match = (name?: string) => {
                  const n = name?.toLowerCase().trim() || '';
                  return n && me && (n === me || n.includes(me) || me.includes(n));
                };
                const count = tasks.filter(t => match(t.responsible) && t.status !== 'completed').length +
                             constraints.filter(c => match(c.responsible) && c.status === 'open').length +
                             plans.filter(p => {
                               if (!match(p.responsible)) return false;
                               if (p.status === 'completed') return false;
                               if (p.taskId && tasks.some(t => t.id === p.taskId && match(t.responsible))) return false;
                               return true;
                             }).length;
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

        {/* Tabs Bar */}
        <div className="container mx-auto px-6 pb-3 overflow-x-auto flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <div className="bg-transparent border-0 p-0 h-auto gap-2 inline-flex w-max">
            {tabGroups.map(group => {
              const activeItem = tabs.find(t => t.value === activeTab && group.items.includes(t.value));
              const GroupIcon = activeItem ? activeItem.icon : group.icon;
              const groupLabel = activeItem ? activeItem.label : group.label;
              const isGroupActive = !!activeItem;

              return (
                <DropdownMenu key={group.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all h-9 border ${
                        isGroupActive 
                          ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' 
                          : 'text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                      <span>{groupLabel}</span>
                      <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl border border-border/80 p-1 min-w-[160px] shadow-lg">
                    {group.items.map(val => {
                      const item = tabs.find(t => t.value === val);
                      if (!item) return null;
                      const isItemActive = activeTab === val;
                      return (
                        <DropdownMenuItem
                          key={val}
                          onClick={() => setSearchParams({ tab: val })}
                          className={`gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${
                            isItemActive 
                              ? 'bg-primary/10 text-primary font-bold focus:bg-primary/15 focus:text-primary' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <item.icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-5 flex-1 w-full max-w-[1600px]">
        {activeTab === 'hoje' && <TodayTab project={project} />}
        {activeTab === 'dashboard' && <DashboardTab project={project} />}
        {activeTab === 'planning' && <PlanningTab project={project} />}
        {activeTab === 'gantt' && <GanttTab project={project} />}
        {activeTab === 'kanban' && <KanbanTab project={project} />}
        {activeTab === 'physical_financial' && <PhysicalFinancialTab project={project} />}
        {activeTab === 'curves' && <CurveSTab project={project} />}
        {activeTab === 'lean' && <LeanTab project={project} />}
        {activeTab === 'supplies' && <SuppliesTab project={project} />}
        {activeTab === 'workforce' && <WorkforceTab project={project} />}
        {activeTab === 'diary' && <DiaryTab project={project} />}
        {activeTab === 'admin' && <AdminTab project={project} />}
        {activeTab === 'reports' && <ReportsTab project={project} />}
      </div>
    </div>
  );
}

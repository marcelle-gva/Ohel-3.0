import React, { useState, useMemo } from 'react';
import { User, Task, Institution, EisenhowerQuadrant } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Search, 
  Eye, 
  Layers, 
  TrendingUp, 
  Activity, 
  Filter,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GlobalPlatformDashboardProps {
  allUsers: User[];
  allTasks: Task[];
  institutions: Institution[];
  onInspectUser?: (user: User) => void;
  onImpersonateUser?: (user: User) => void;
  onExitGlobalView?: () => void;
  onViewInstitutionTasks?: () => void;
}

export const GlobalPlatformDashboard: React.FC<GlobalPlatformDashboardProps> = ({
  allUsers,
  allTasks,
  institutions,
  onInspectUser,
  onImpersonateUser,
  onExitGlobalView,
  onViewInstitutionTasks,
}) => {
  const handleInspect = (targetUser: User) => {
    if (onInspectUser) {
      onInspectUser(targetUser);
    } else if (onImpersonateUser) {
      onImpersonateUser(targetUser);
    }
  };

  const handleExit = () => {
    if (onExitGlobalView) {
      onExitGlobalView();
    } else if (onViewInstitutionTasks) {
      onViewInstitutionTasks();
    }
  };
  const [taskSearch, setTaskSearch] = useState('');
  const [taskQuadrantFilter, setTaskQuadrantFilter] = useState<string>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [taskProfileFilter, setTaskProfileFilter] = useState<'ALL' | 'PERSONAL' | 'INSTITUTIONAL'>('ALL');

  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'ALL' | 'PERSONAL' | 'INSTITUTIONAL'>('ALL');

  // Map for fast user lookup
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const institutionMap = useMemo(() => {
    const map = new Map<string, Institution>();
    institutions.forEach(i => map.set(i.id, i));
    return map;
  }, [institutions]);

  // Aggregate Metrics Calculations
  const metrics = useMemo(() => {
    let personalUsers = 0;
    let institutionalUsers = 0;
    let adminUsers = 0;

    allUsers.forEach(u => {
      if (u.isPlatformAdmin) adminUsers++;
      if (!u.institutionId && (u.type === 'personal' || u.profileType === 'PERSONAL')) {
        personalUsers++;
      } else {
        institutionalUsers++;
      }
    });

    const totalTasks = allTasks.length;
    let completedTasks = 0;
    let pendingTasks = 0;
    const quadrantCounts: Record<EisenhowerQuadrant, number> = {
      'urgent-important': 0,
      'important-not-urgent': 0,
      'urgent-not-important': 0,
      'not-urgent-not-important': 0,
    };

    allTasks.forEach(t => {
      if (t.completed) completedTasks++;
      else pendingTasks++;

      if (t.quadrant && quadrantCounts[t.quadrant] !== undefined) {
        quadrantCounts[t.quadrant]++;
      }
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalUsers: allUsers.length,
      personalUsers,
      institutionalUsers,
      adminUsers,
      totalInstitutions: institutions.length,
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate,
      quadrantCounts,
    };
  }, [allUsers, allTasks, institutions]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      const q = taskSearch.toLowerCase().trim();
      const taskUser = userMap.get(task.userId || '');
      const matchesSearch = 
        !q || 
        (task.title && task.title.toLowerCase().includes(q)) ||
        (task.description && task.description.toLowerCase().includes(q)) ||
        (taskUser && taskUser.name && taskUser.name.toLowerCase().includes(q)) ||
        (taskUser && taskUser.email && taskUser.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (taskQuadrantFilter !== 'ALL' && task.quadrant !== taskQuadrantFilter) {
        return false;
      }

      if (taskStatusFilter === 'COMPLETED' && !task.completed) return false;
      if (taskStatusFilter === 'PENDING' && task.completed) return false;

      if (taskProfileFilter === 'PERSONAL') {
        if (task.institutionId || task.type === 'INSTITUTIONAL') return false;
      } else if (taskProfileFilter === 'INSTITUTIONAL') {
        if (!task.institutionId && task.type !== 'INSTITUTIONAL') return false;
      }

      return true;
    });
  }, [allTasks, taskSearch, taskQuadrantFilter, taskStatusFilter, taskProfileFilter, userMap]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const q = userSearch.toLowerCase().trim();
      const instName = u.institutionId ? (institutionMap.get(u.institutionId)?.name || '') : '';
      const matchesSearch = 
        !q || 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        instName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isPersonal = !u.institutionId && (u.type === 'personal' || u.profileType === 'PERSONAL');
      if (userTypeFilter === 'PERSONAL') return isPersonal;
      if (userTypeFilter === 'INSTITUTIONAL') return !isPersonal;
      return true;
    });
  }, [allUsers, userSearch, userTypeFilter, institutionMap]);

  const quadrantLabels: Record<EisenhowerQuadrant, { name: string; color: string; border: string }> = {
    'urgent-important': { name: 'Fazer Agora (Q1)', color: 'bg-red-500/10 text-red-400', border: 'border-red-500/30' },
    'important-not-urgent': { name: 'Agendar (Q2)', color: 'bg-blue-500/10 text-blue-400', border: 'border-blue-500/30' },
    'urgent-not-important': { name: 'Delegar (Q3)', color: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/30' },
    'not-urgent-not-important': { name: 'Eliminar (Q4)', color: 'bg-slate-500/10 text-slate-400', border: 'border-slate-500/30' },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Visão Global da Plataforma
            </h1>
            <Badge variant="outline" className="bg-cyan-950/60 border-cyan-500/40 text-cyan-400 text-[10px] font-bold">
              GOD MODE
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-slate-300">
            Monitoramento consolidado em tempo real de todos os perfis B2C (Pessoal) e B2B (Institucional).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            className="rounded-xl border-slate-700 hover:border-slate-600 gap-2 text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Voltar ao Meu Dashboard</span>
          </Button>
        </div>
      </div>

      {/* Primary Aggregated Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total de Usuários
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-2">
              {metrics.totalUsers}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-blue-400 font-bold">{metrics.personalUsers} B2C</span>
              <span className="text-slate-500">•</span>
              <span className="text-purple-400 font-bold">{metrics.institutionalUsers} B2B</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Institutions */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Empresas / Grupos
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-2">
              {metrics.totalInstitutions}
            </div>
            <p className="text-[11px] text-slate-400">
              Instituições com workspace corporativo ativo
            </p>
          </CardContent>
        </Card>

        {/* Total Tasks */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tarefas na Plataforma
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-white mb-2">
              {metrics.totalTasks}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-400 font-bold">{metrics.completedTasks} Concluídas</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 font-bold">{metrics.pendingTasks} Pendentes</span>
            </div>
          </CardContent>
        </Card>

        {/* Global Completion Rate */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Taxa de Conclusão
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-cyan-400 mb-2">
              {metrics.completionRate}%
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-cyan-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.completionRate}%` }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Eisenhower Matrix Distribution Cards */}
      <Card className="bg-slate-900/40 border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200">
              Distribuição Global da Matriz de Eisenhower
            </h2>
          </div>
          <span className="text-xs text-slate-400">Total de {metrics.totalTasks} tarefas classificadas</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(quadrantLabels).map(([quad, config]) => {
            const count = metrics.quadrantCounts[quad as EisenhowerQuadrant] || 0;
            const pct = metrics.totalTasks > 0 ? Math.round((count / metrics.totalTasks) * 100) : 0;

            return (
              <div key={quad} className={cn("p-4 rounded-xl border", config.border, config.color)}>
                <p className="text-[11px] font-black uppercase tracking-wider mb-1 truncate">
                  {config.name}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white">{count}</span>
                  <span className="text-xs font-semibold opacity-80">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detailed Platform Exploration Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="bg-slate-900/80 border border-slate-800 p-1 rounded-xl h-11">
          <TabsTrigger value="tasks" className="rounded-lg text-xs font-bold px-4">
            Todas as Tarefas ({allTasks.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg text-xs font-bold px-4">
            Diretório de Usuários ({allUsers.length})
          </TabsTrigger>
          <TabsTrigger value="institutions" className="rounded-lg text-xs font-bold px-4">
            Organizações ({institutions.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ALL PLATFORM TASKS */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <Card className="bg-slate-900/40 border-slate-800 rounded-2xl p-4">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Filtrar tarefas por título, descrição ou criador..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-9 h-10 bg-slate-950/60 border-slate-800 text-xs rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Quadrant filter */}
                <select
                  value={taskQuadrantFilter}
                  onChange={(e) => setTaskQuadrantFilter(e.target.value)}
                  className="h-10 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                >
                  <option value="ALL">Todos os Quadrantes</option>
                  <option value="urgent-important">Fazer Agora (Q1)</option>
                  <option value="important-not-urgent">Agendar (Q2)</option>
                  <option value="urgent-not-important">Delegar (Q3)</option>
                  <option value="not-urgent-not-important">Eliminar (Q4)</option>
                </select>

                {/* Status filter */}
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                  className="h-10 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="COMPLETED">Concluídas</option>
                  <option value="PENDING">Pendentes</option>
                </select>

                {/* Profile filter */}
                <select
                  value={taskProfileFilter}
                  onChange={(e) => setTaskProfileFilter(e.target.value as any)}
                  className="h-10 px-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                >
                  <option value="ALL">Todos os Perfis</option>
                  <option value="PERSONAL">B2C Pessoal</option>
                  <option value="INSTITUTIONAL">B2B Institucional</option>
                </select>
              </div>
            </div>

            {/* Tasks List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Tarefa</th>
                    <th className="py-3 px-4">Criador</th>
                    <th className="py-3 px-4">Quadrante</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Perfil</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma tarefa encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.slice(0, 100).map(task => {
                      const creator = userMap.get(task.userId || '');
                      const isTaskPersonal = !task.institutionId && task.type !== 'INSTITUTIONAL';

                      return (
                        <tr key={task.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-200">{task.title}</p>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">{task.description}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-300">{creator?.name || 'Usuário Desconhecido'}</p>
                            <p className="text-[10px] text-slate-500">{creator?.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            {task.quadrant && quadrantLabels[task.quadrant] ? (
                              <Badge variant="outline" className={cn("text-[9px] py-0", quadrantLabels[task.quadrant].color, quadrantLabels[task.quadrant].border)}>
                                {quadrantLabels[task.quadrant].name.split(' ')[0]}
                              </Badge>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] py-0 font-bold",
                                task.completed ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" : "bg-amber-950/40 border-amber-500/30 text-amber-400"
                              )}
                            >
                              {task.completed ? 'Concluída' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] text-slate-400">
                              {isTaskPersonal ? 'Pessoal (CPF)' : 'Institucional (CNPJ)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {creator && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleInspect(creator)}
                                className="h-7 text-[11px] gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded-lg"
                                title="Ver a aplicação sob a perspectiva deste usuário"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspecionar</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredTasks.length > 100 && (
              <p className="text-[11px] text-slate-500 mt-3 text-center">
                Exibindo as primeiras 100 tarefas de {filteredTasks.length}. Use os filtros para refinar a lista.
              </p>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: GLOBAL USER DIRECTORY */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <Card className="bg-slate-900/40 border-slate-800 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Buscar usuário por nome, e-mail ou empresa..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-10 bg-slate-950/60 border-slate-800 text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={userTypeFilter === 'ALL' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setUserTypeFilter('ALL')}
                  className="h-8 text-xs rounded-lg"
                >
                  Todos ({allUsers.length})
                </Button>
                <Button
                  variant={userTypeFilter === 'PERSONAL' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setUserTypeFilter('PERSONAL')}
                  className="h-8 text-xs rounded-lg"
                >
                  B2C Pessoal ({metrics.personalUsers})
                </Button>
                <Button
                  variant={userTypeFilter === 'INSTITUTIONAL' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setUserTypeFilter('INSTITUTIONAL')}
                  className="h-8 text-xs rounded-lg"
                >
                  B2B Institucional ({metrics.institutionalUsers})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredUsers.map(u => {
                const isPersonal = !u.institutionId && (u.type === 'personal' || u.profileType === 'PERSONAL');
                const inst = u.institutionId ? institutionMap.get(u.institutionId) : null;

                return (
                  <div 
                    key={u.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm shrink-0">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (u.name?.[0] || u.email?.[0] || 'U').toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-100 text-sm truncate">{u.name || 'Sem nome'}</p>
                          {u.isPlatformAdmin && (
                            <Badge variant="outline" className="text-[8px] bg-cyan-950/50 border-cyan-500/30 text-cyan-400 py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[9px] py-0 font-bold",
                              isPersonal ? "bg-blue-950/40 border-blue-500/30 text-blue-300" : "bg-purple-950/40 border-purple-500/30 text-purple-300"
                            )}
                          >
                            {isPersonal ? 'B2C Pessoal' : (inst?.name || 'B2B Equipe')}
                          </Badge>
                          <span className="text-[10px] text-slate-500 capitalize">
                            {u.role?.toLowerCase() || 'membro'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInspect(u)}
                      className="w-full h-8 text-xs font-bold rounded-lg gap-1.5 border-slate-800 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-950/20"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspecionar Perspectiva</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: ORGANIZATIONS & B2B WORKSPACES */}
        <TabsContent value="institutions" className="mt-4 space-y-4">
          <Card className="bg-slate-900/40 border-slate-800 rounded-2xl p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Organização</th>
                    <th className="py-3 px-4">Código de Convite</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Membros Estimados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {institutions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Nenhuma instituição cadastrada até o momento.
                      </td>
                    </tr>
                  ) : (
                    institutions.map(inst => {
                      const memberCount = allUsers.filter(u => u.institutionId === inst.id).length;

                      return (
                        <tr key={inst.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-200">{inst.name}</p>
                            <p className="text-[10px] text-slate-500">ID: {inst.id}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="font-mono text-xs bg-slate-950 border-slate-700 text-cyan-400">
                              {inst.inviteCode || 'N/A'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] bg-purple-950/40 border-purple-500/30 text-purple-300 font-bold">
                              {inst.planType || 'BASIC'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] py-0 font-bold",
                                inst.subscriptionStatus === 'ACTIVE' ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" : "bg-amber-950/40 border-amber-500/30 text-amber-400"
                              )}
                            >
                              {inst.subscriptionStatus || 'TRIAL'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-semibold">
                            {memberCount} membro(s)
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

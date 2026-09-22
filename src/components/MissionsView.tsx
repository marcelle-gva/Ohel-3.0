import React, { useState, useEffect, useMemo } from 'react';
import { Mission, Ranking, User, OperationType, MissionCompletion } from '@/types';
import { db, handleFirestoreError } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc, setDoc, writeBatch, increment } from 'firebase/firestore';
import { 
  Trophy, 
  Target, 
  Plus, 
  Calendar, 
  Award, 
  ChevronRight,
  Users,
  Loader2,
  X,
  Trash2,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  TrendingUp,
  Activity,
  AlertCircle,
  AlertTriangle,
  Zap,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Task, Module, User as UserType } from '@/types';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MissionsViewProps {
  user: User;
  tasks: Task[];
  modules: Module[];
  rankings: Ranking[];
}

export const MissionsView: React.FC<MissionsViewProps> = ({ user, tasks, modules, rankings }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<MissionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Stats Calculation
  const completionRate = tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0;
  
  const pilarFamiliarTasks = tasks.filter(t => t.moduleId === '3'); // ID '3' is Familiar from types.ts
  const pilarFamiliarCompleted = pilarFamiliarTasks.filter(t => t.completed).length;
  const pilarFamiliarRate = pilarFamiliarTasks.length > 0 ? (pilarFamiliarCompleted / pilarFamiliarTasks.length) * 100 : 100;

  const insights = useMemo(() => {
    const list: { type: 'success' | 'warning' | 'info', message: string }[] = [];
    
    // Performance based insights
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    
    if (rate > 80) list.push({ type: 'success', message: 'Incrível! Sua taxa de conclusão está acima de 80%. Você está no topo da produtividade!' });
    else if (rate < 30 && total > 5) list.push({ type: 'warning', message: 'Alerta: Sua taxa de conclusão está baixa (abaixo de 30%). Foque nas tarefas urgentes primeiro.' });
    
    // Module specific insights (Using IDs from OrdemNoCaos)
    const familyTasks = tasks.filter(t => t.moduleId === 'familiar');
    const familyCompleted = familyTasks.filter(t => t.completed).length;
    const familyRate = familyTasks.length > 0 ? (familyCompleted / familyTasks.length) * 100 : 100;
    
    if (familyRate < 40 && familyTasks.length > 2) {
      list.push({ type: 'warning', message: 'Atenção: O pilar Familiar está com baixa conclusão. Tire um tempo para quem você ama.' });
    }

    // Urgent task overload
    const urgentTasks = tasks.filter(t => !t.completed && (t.quadrant === 'urgent-important' || t.quadrant === 'urgent-not-important'));
    if (urgentTasks.length > 4) {
      list.push({ type: 'warning', message: 'Sobrecarga detectada: Muitas tarefas urgentes pendentes. Priorize o que é vital hoje.' });
    }
    
    if (list.length === 0 && total > 0) {
      list.push({ type: 'info', message: 'Mantenha seus pilares equilibrados para evitar o caos em sua rotina.' });
    }
    
    return list;
  }, [tasks]);

  const quadrantStats = [
    { name: 'Fazer Agora', value: tasks.filter(t => t.quadrant === 'urgent-important').length, color: '#ef4444' },
    { name: 'Agendar', value: tasks.filter(t => t.quadrant === 'important-not-urgent').length, color: '#3b82f6' },
    { name: 'Delegar', value: tasks.filter(t => t.urgent_not_important || t.quadrant === 'urgent-not-important').length, color: '#f59e0b' },
    { name: 'Eliminar', value: tasks.filter(t => t.quadrant === 'not-urgent-not-important').length, color: '#64748b' },
  ];

  const completionStats = [
    { name: 'Concluídas', value: tasks.filter(t => t.completed).length, color: '#10b981' },
    { name: 'Pendentes', value: tasks.filter(t => !t.completed).length, color: '#6366f1' },
  ];

  const moduleTimeStats = modules.map(m => {
    const moduleTasks = tasks.filter(t => t.moduleId === m.id && t.completed && t.timeSpent);
    const avgTimeSeconds = moduleTasks.length > 0 
      ? Math.round(moduleTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) / moduleTasks.length)
      : 0;
    
    const value = avgTimeSeconds / 60; 
    return { name: m.name, value };
  }).filter(s => s.value > 0);
  
  // Create Mission Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newReward, setNewReward] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDeadline, setNewDeadline] = useState('');

  const permissions = usePermissions(user);
  const isManager = permissions.canCreateMissions;

  useEffect(() => {
    // Sync Missions
    const qMissions = query(
      collection(db, 'missions'),
      where('status', '==', 'ACTIVE'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeMissions = onSnapshot(qMissions, (snapshot) => {
      setMissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'missions'));

    // Sync Completions
    const qCompletions = query(collection(db, 'mission_completions'), orderBy('completedAt', 'desc'));
    const unsubscribeCompletions = onSnapshot(qCompletions, (snap) => {
      setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() } as MissionCompletion)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'mission_completions'));

    return () => {
      unsubscribeMissions();
      unsubscribeCompletions();
    };
  }, []);

  const handleCompleteMission = async (mission: Mission) => {
    try {
      const currentUserId = user.id || (user as any).uid;
      if (!currentUserId) {
        toast.error('Erro ao identificar usuário. Tente recarregar a página.');
        return;
      }

      const completionId = `${currentUserId}_${mission.id}`;
      const batch = writeBatch(db);
      
      // 1. Create Mission Completion
      const completionRef = doc(db, 'mission_completions', completionId);
      batch.set(completionRef, {
        id: completionId,
        missionId: mission.id,
        missionTitle: mission.title,
        userId: currentUserId,
        userName: user.name || (user as any).displayName || 'Membro',
        status: 'PENDING',
        completedAt: Date.now(),
        points: mission.points
      });

      // 2. Create Task for Manager Approval
      const taskRef = doc(collection(db, 'tasks'));
      const taskId = taskRef.id;
      
      batch.set(taskRef, {
        title: `${user.name || (user as any).displayName || 'Membro'} realizou: ${mission.title}`,
        description: `Missão: ${mission.title}. Aguardando autorização para liberar ${mission.points} pontos.`,
        quadrant: 'urgent-important',
        status: 'PENDING_APPROVAL',
        completed: false,
        type: 'INSTITUTIONAL',
        institutionId: user.institutionId || '',
        userId: currentUserId,
        isMissionTask: true,
        missionId: mission.id,
        completionId,
        createdAt: serverTimestamp(),
      });

      // 3. Create Required Audit Log (Satisfies strict task create rules)
      const auditRef = doc(db, 'audit_logs', `${taskId}_create`);
      batch.set(auditRef, {
        userId: currentUserId,
        action: 'CREATE_MISSION_TASK',
        resourceId: taskId,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      toast.success('Solicitação de conclusão enviada!');
    } catch (error) {
      console.error("Error completing mission:", error);
      handleFirestoreError(error, OperationType.CREATE, 'mission_completions');
    }
  };

  const handleAuthorizeCompletion = async (completion: MissionCompletion) => {
    try {
      const batch = writeBatch(db);
      
      // Update completion status
      batch.update(doc(db, 'mission_completions', completion.id), {
        status: 'AUTHORIZED',
        authorizedAt: Date.now()
      });

      // Update ranking points
      // We'll use a transaction/increment in a separate call or batch if we have the ranking ID
      // For simplicity, let's just update completion and let a function handle ranking or do it here
      const weekId = format(new Date(), 'yyyy-ww');
      const rankingId = `${completion.userId}_${weekId}`;
      const rankingRef = doc(db, 'rankings', rankingId);
      
      batch.set(rankingRef, {
        userId: completion.userId,
        userName: completion.userName,
        points: increment(completion.points || 100),
        weekId
      }, { merge: true });

      // Notify User
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: completion.userId,
        type: 'MISSION_AUTHORIZED',
        title: 'Missão Autorizada!',
        message: `Sua conclusão da missão foi autorizada. Você ganhou ${completion.points} pontos!`,
        read: false,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      toast.success('Conclusão autorizada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mission_completions/${completion.id}`);
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDescription || !newDeadline) return;

    try {
      await addDoc(collection(db, 'missions'), {
        title: newTitle,
        description: newDescription,
        reward: newReward || 'Bônus de Produtividade',
        points: Number(newPoints),
        deadline: new Date(newDeadline).getTime(),
        createdBy: user.id,
        createdAt: Date.now(),
        status: 'ACTIVE'
      });
      
      // Create Notification for the mission
      await addDoc(collection(db, 'notifications'), {
        userId: user.id,
        type: 'MISSION_CREATED',
        title: 'Nova Missão Lançada',
        message: `Uma nova missão "${newTitle}" foi disponibilizada para o grupo.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      toast.success('Missão criada com sucesso!');
      setShowCreateModal(false);
      // Reset form
      setNewTitle('');
      setNewDescription('');
      setNewReward('');
      setNewPoints(100);
      setNewDeadline('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'missions');
    }
  };

  const handleDeleteMission = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missions', id));
      toast.success('Missão removida!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `missions/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full px-1">
      {/* INSIGHTS BANNER */}
      {insights.length > 0 && (
        <div className="lg:col-span-12 space-y-4">
          {insights.map((insight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-2xl border flex items-center gap-4 shadow-sm",
                insight.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                insight.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                "bg-blue-500/10 border-blue-500/20 text-blue-600"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                insight.type === 'success' ? "bg-emerald-500 text-white" :
                insight.type === 'warning' ? "bg-amber-500 text-white" :
                "bg-blue-500 text-white"
              )}>
                {insight.type === 'success' ? <Trophy className="w-5 h-5" /> : 
                 insight.type === 'warning' ? <AlertCircle className="w-5 h-5" /> : 
                 <Activity className="w-5 h-5" />}
              </div>
              <p className="font-medium">{insight.message}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* MISSIONS LIST */}
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Missões Ativas</h2>
            <p className="text-sm text-muted-foreground">Complete missões para ganhar pontos e subir no ranking.</p>
          </div>
          {isManager && (
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Missão
            </Button>
          )}
        </div>

        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Lançar Nova Missão</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateMission} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Missão</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: Meta de Vendas Mensal" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição Detalhada</Label>
                <Textarea 
                  id="desc" 
                  placeholder="Explique o que deve ser feito..." 
                  value={newDescription} 
                  onChange={e => setNewDescription(e.target.value)} 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reward">Bônus / Recompensa</Label>
                  <Input 
                    id="reward" 
                    placeholder="Ex: R$ 500,00" 
                    value={newReward} 
                    onChange={e => setNewReward(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points">Pontuação</Label>
                  <Input 
                    id="points" 
                    type="number" 
                    value={newPoints} 
                    onChange={e => setNewPoints(Number(e.target.value))} 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="deadline">Prazo Final</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger 
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 bg-muted/50",
                          !newDeadline && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {newDeadline ? format(new Date(newDeadline), "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={newDeadline ? new Date(newDeadline) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setNewDeadline(date.toISOString());
                          setCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                <Button type="submit">Publicar Missão</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map(mission => (
            <Card key={mission.id} className="p-5 border-border/50 hover:border-primary/50 transition-all group bg-card/50 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Target className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  {isManager && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 transition-all"
                      onClick={() => handleDeleteMission(mission.id)}
                      title="Excluir Missão"
                      aria-label={`Excluir missão ${mission.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-sm shadow-amber-500/5">
                    {mission.points} pts
                  </Badge>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">{mission.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {mission.description}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Até {new Date(mission.deadline).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-500" />
                  {mission.reward}
                </div>
              </div>

              {/* Mission Completion Button */}
              <div className="mt-4 pt-4 border-t border-border/50">
                {completions.some(c => c.missionId === mission.id && c.userId === user.id && c.status === 'AUTHORIZED') ? (
                  <Badge className="w-full justify-center bg-green-500/10 text-green-500 border-green-500/20 py-1.5 font-bold uppercase tracking-widest text-[10px]">
                    Concluída e Pontuada
                  </Badge>
                ) : completions.some(c => c.missionId === mission.id && c.userId === user.id && c.status === 'PENDING') ? (
                  <Badge className="w-full justify-center bg-amber-500/10 text-amber-500 border-amber-500/20 py-1.5 font-bold uppercase tracking-widest text-[10px]">
                    Aguardando Autorização
                  </Badge>
                ) : (
                  <Button 
                    className="w-full h-10 font-black tracking-widest uppercase text-xs gap-2 shadow-lg shadow-primary/20"
                    onClick={() => handleCompleteMission(mission)}
                  >
                    <CheckCircle2 className="w-4 h-4" /> MISSÃO REALIZADA
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {missions.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-2xl text-muted-foreground bg-muted/5">
              Nenhuma missão ativa no momento.
            </div>
          )}
        </div>
      </div>

      {/* RANKING SIDEBAR */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-card rounded-2xl border border-border/50 p-6 glow-blue relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Trophy className="w-24 h-24 rotate-12" />
          </div>
          
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold tracking-tight">Ranking Semanal</h2>
          </div>

          <div className="space-y-4">
            {rankings.map((rank, idx) => (
              <motion.div 
                key={rank.userId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all",
                  rank.userId === user.id ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  idx === 0 ? "bg-amber-500 text-white" : 
                  idx === 1 ? "bg-slate-300 text-slate-700" :
                  idx === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{rank.userName}</p>
                  <Progress value={(rank.points / (rankings[0]?.points || 1)) * 100} className="h-1 mt-1" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-primary">{rank.points}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">pts</p>
                </div>
              </motion.div>
            ))}
            {rankings.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Aguardando dados do ranking...</p>
            )}
          </div>

          <Button variant="outline" className="w-full mt-6 gap-2">
            <Users className="w-4 h-4" /> Ver Todos
          </Button>
        </div>

        {/* Manager Authorize Panel */}
        {isManager && completions.some(c => c.status === 'PENDING') && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Autorizar Missões
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {completions.filter(c => c.status === 'PENDING').map(comp => (
                <div key={comp.id} className="p-3 bg-background border rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{comp.userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{comp.missionTitle}</p>
                  </div>
                  <Button size="sm" className="h-7 px-2 bg-green-500 hover:bg-green-600" onClick={() => handleAuthorizeCompletion(comp)}>
                    Autorizar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* PRODUCTIVITY STATS (BELOW MISSIONS) */}
      <div className="lg:col-span-12 mt-12 space-y-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Status de Produtividade</h2>
          <p className="text-sm text-muted-foreground">Analise sua performance e distribuição de tempo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" /> Matriz de Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={quadrantStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {quadrantStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                {quadrantStats.map((stat) => (
                  <div key={stat.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-[10px] text-muted-foreground font-bold">{stat.name}: {stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Taxa de Conclusão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {completionStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 justify-center mt-2">
                {completionStats.map((stat) => (
                  <div key={stat.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-[10px] text-muted-foreground font-bold">{stat.name}: {stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChartIcon className="w-4 h-4 text-primary" /> Tempo Médio por Contexto (min)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {moduleTimeStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={moduleTimeStats}>
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold text-center p-8">
                    Nenhum dado de tempo registrado ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

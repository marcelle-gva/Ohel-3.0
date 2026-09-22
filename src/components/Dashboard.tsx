import React, { useState } from 'react';
import { Task, User, EisenhowerQuadrant, QUADRANT_LABELS, Institution, FamilyEvent } from '@/types';
import { motion } from 'motion/react';
import { 
  CheckSquare, 
  Calendar, 
  Users, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  MessageSquare,
  UserPlus,
  QrCode,
  TrendingUp,
  CalendarDays,
  CreditCard,
  Plus,
  ArrowUpRight,
  Zap,
  Pencil,
  Image as ImageIcon,
  Trash2,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
// Badge import removed: the role badge it rendered moved into the
// ContextSwitcher's profile label (top bar) during the 2026-09-19 redesign
// — see BUSINESS_RULES.md §12 for the note that this info now lives there.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DayTimelineView } from './DayTimelineView';
import { TentNightIllustration } from './illustrations/TentNightIllustration';

interface DashboardProps {
  tasks: Task[];
  familyEvents?: FamilyEvent[];
  users: User[];
  currentUser: User;
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onUserClick: (user: User) => void;
  onAddAppointment: () => void;
  onUpdateJourney?: (days: number) => void;
  onRegenerateInviteCode?: () => void;
  isInviteDisabled?: boolean;
  institution?: Institution;
  subscription?: any;
  onNavigate?: (view: any) => void;
  onToggleFocus?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  tasks, 
  familyEvents = [],
  users, 
  currentUser,
  onTaskClick, 
  onEditTask,
  onUserClick, 
  onAddAppointment,
  onUpdateJourney,
  onRegenerateInviteCode,
  institution,
  subscription,
  onNavigate,
  onToggleFocus,
  isInviteDisabled
}) => {
  const [isEditingJourney, setIsEditingJourney] = useState(false);
  const [journeyInput, setJourneyInput] = useState(currentUser?.journeyTotalDays?.toString() || '40');

  const todayTasks = tasks.filter(t => {
    if (t.completed) return false;
    const today = new Date().setHours(0, 0, 0, 0);
    const taskDate = t.dueDate ? new Date(t.dueDate).setHours(0, 0, 0, 0) : today;
    return taskDate === today;
  });

  const urgentTasks = todayTasks.filter(t => t.quadrant === 'urgent-important' || t.quadrant === 'urgent-not-important');
  // hoveredTaskId/setHoveredTaskId removed: only the old flat timeline list
  // used them; DayTimelineView (grid view) handles its own hover state.

  const unexecutedPriorities = todayTasks.filter(t => t.quadrant === 'urgent-important');

  const upcomingTasks = tasks
    .filter(t => {
      if (t.completed || !t.dueDate) return false;
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const endOfWindow = startOfToday + 8 * 86400000; // next 7 days after today
      return t.dueDate > startOfToday + 86400000 - 1 && t.dueDate < endOfWindow;
    })
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    .slice(0, 3);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  };

  const journeyDay = currentUser?.journeyStart 
    ? Math.floor((Date.now() - currentUser.journeyStart) / (1000 * 60 * 60 * 24)) + 1 
    : 1;

  const trialDaysLeft = institution?.trialEndsAt 
    ? Math.max(0, Math.ceil((institution.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      {trialDaysLeft !== null && trialDaysLeft <= 30 && trialDaysLeft > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 glow-blue"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-black text-primary italic uppercase tracking-tighter text-lg leading-none">TESTE GRÁTIS ATIVO</p>
              <p className="text-sm font-medium text-muted-foreground">
                Sua instituição está no período de teste do plano <span className="text-primary font-bold">{institution?.planType}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-background/50 px-6 py-2 rounded-2xl border">
            <div className="text-center">
              <p className="text-2xl font-black text-primary leading-none">{trialDaysLeft}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Dias Restantes</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => onNavigate?.('plans')}
              className="font-bold uppercase tracking-widest text-[10px] h-9 shadow-lg shadow-primary/20"
            >
              Gerenciar Plano
            </Button>
          </div>
        </motion.div>
      )}

      {subscription?.status === 'BLOCKED' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border-2 border-destructive/20 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-destructive">Sua conta está bloqueada</p>
              <p className="text-sm text-destructive/80">Regularize sua situação para continuar acessando todos os recursos.</p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            className="w-full md:w-auto gap-2 shadow-lg shadow-destructive/20"
            onClick={() => onNavigate?.('plans')}
          >
            <CreditCard className="w-4 h-4" />
            Ir para Pagamentos
          </Button>
        </motion.div>
      )}

      {/* HEADER SECTION — hero with stat pills, mirrors the reference layout while keeping every existing handler intact */}
      <div className="relative overflow-hidden rounded-[32px] border border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.07] p-6 md:p-8 shadow-sm">
        <TentNightIllustration className="absolute top-0 right-0 h-full w-[45%] max-w-md text-primary/80 opacity-90 pointer-events-none [mask-image:linear-gradient(to_left,black_40%,transparent_100%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm font-medium capitalize">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Usuário'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pill: papel/código de convite */}
            <div 
              className={cn(
                "flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl border transition-all group",
                isInviteDisabled 
                  ? "bg-muted/50 border-border cursor-not-allowed opacity-60" 
                  : "bg-muted/40 border-border/60 cursor-pointer hover:border-primary/40"
              )}
              onClick={!isInviteDisabled ? onRegenerateInviteCode : undefined}
              title={isInviteDisabled ? "Limite de usuários atingido" : "Clique para gerar novo código"}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <QRCodeSVG 
                  value={institution?.inviteCode ? `https://app.ohel.com/invite/${institution.inviteCode}` : `https://app.ohel.com/invite/${currentUser?.institutionId || currentUser?.id}`} 
                  size={18}
                  fgColor="currentColor"
                  bgColor="transparent"
                />
              </div>
              <div className="leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {currentUser?.type === 'personal' ? 'Convidar Pessoas' : 'Convidar Membros'}
                </p>
                <p className="text-sm font-black tracking-widest">
                  {institution?.inviteCode || currentUser?.inviteCode || '···'}
                </p>
              </div>
            </div>

            {/* Pill: Jornada */}
            <div 
              className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl bg-muted/40 border border-border/60 cursor-pointer hover:border-primary/40 transition-all"
              onClick={() => setIsEditingJourney(true)}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Jornada Atual</p>
                <p className="text-sm font-black">{journeyDay}/{currentUser?.journeyTotalDays || 40} dias</p>
              </div>
            </div>

            {/* Pill: Foco */}
            <div className={cn(
              "flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl border transition-all",
              unexecutedPriorities.length > 0
                ? "bg-destructive/10 border-destructive/20"
                : "bg-muted/40 border-border/60"
            )}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                unexecutedPriorities.length > 0 ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"
              )}>
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <div className="leading-tight">
                <p className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  unexecutedPriorities.length > 0 ? "text-destructive" : "text-muted-foreground"
                )}>Foco Total</p>
                <p className={cn("text-sm font-black", unexecutedPriorities.length > 0 && "text-destructive")}>
                  {unexecutedPriorities.length > 0 ? `${unexecutedPriorities.length} Prioridades` : 'Sem urgências'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMN 1: Agenda */}
        <div className="lg:col-span-8">
          <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Agenda do Dia</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={onAddAppointment} className="text-xs font-bold uppercase tracking-widest text-primary gap-2">
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {todayTasks.length > 0 ? (
                <DayTimelineView
                  tasks={todayTasks}
                  onTaskClick={onTaskClick}
                  onEditTask={onEditTask}
                />
              ) : (
                <div
                  onClick={onAddAppointment}
                  className="p-12 border-2 border-dashed border-border/30 rounded-3xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/30 hover:text-primary transition-all cursor-pointer group h-full"
                >
                  <Clock className="w-10 h-10 mb-4 opacity-10 group-hover:opacity-100 transition-opacity" />
                  <p className="text-sm font-bold uppercase tracking-widest">Nada agendado para hoje</p>
                  <p className="text-xs opacity-50 mt-1">Clique para planejar seu dia</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Priorities & Users */}
        <div className="lg:col-span-4 space-y-6">
          {/* Prioridades Rápidas */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Foco Imediato</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onToggleFocus}
                className="h-7 px-2 text-[10px] font-black uppercase tracking-tighter gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Zap className="w-3 h-3 fill-current" />
                Foco Total
              </Button>
            </div>
            <div className="space-y-3">
              {urgentTasks.slice(0, 3).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => onTaskClick(task)}
                  className="group p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-red-500/10 transition-colors"
                >
                  <span className="truncate pr-2">{task.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask?.(task);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <ArrowUpRight className="w-3 h-3 text-red-500 shrink-0 group-hover:hidden" />
                  </div>
                </div>
              ))}
              {urgentTasks.length === 0 && (
                <div className="p-4 text-center border border-dashed rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Sem urgências</p>
                </div>
              )}
            </div>
          </div>

          {/* Próximos Eventos */}
          {upcomingTasks.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Próximos Eventos</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.('calendar')}
                  className="h-7 px-2 text-[10px] font-black uppercase tracking-tighter gap-1 hover:bg-primary/10 hover:text-primary"
                >
                  Ver todos <ArrowUpRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {upcomingTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0 leading-none">
                      <span className="text-[9px] font-bold uppercase">{format(new Date(task.dueDate!), 'MMM', { locale: ptBR })}</span>
                      <span className="text-sm font-black">{format(new Date(task.dueDate!), 'd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(task.dueDate!), 'HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Membros Ativos */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Equipe</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-500">{users.filter(u => u.status === 'online').length}</span>
              </div>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {users.map(member => (
                <div 
                  key={member.id}
                  onClick={() => onUserClick(member)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black border border-primary/20">
                      {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover rounded-full" /> : member.name.charAt(0)}
                    </div>
                    <div className={cn(
                      "absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                      statusColors[member.status || 'away']
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{member.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{member.status || 'offline'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Placeholder for other modules if needed, or just end of content */}


      {/* JOURNEY EDIT DIALOG */}
      <Dialog open={isEditingJourney} onOpenChange={setIsEditingJourney}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personalizar Jornada</DialogTitle>
            <DialogDescription>Defina o total de dias para sua jornada atual.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Total de Dias</label>
            <input 
              type="number" 
              value={journeyInput} 
              onChange={(e) => setJourneyInput(e.target.value)}
              className="w-full p-2 bg-muted rounded-lg border focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditingJourney(false)}>Cancelar</Button>
            <Button onClick={() => {
              onUpdateJourney?.(parseInt(journeyInput));
              setIsEditingJourney(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

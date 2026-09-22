import React, { useState } from 'react';
import { Task, User, Institution } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Ticket, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User as UserIcon,
  ArrowUpRight,
  Building2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstitutionTicketsProps {
  institution?: Institution;
  users: User[];
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
  onUpdateTaskStatus?: (taskId: string, status: string, completed: boolean) => void;
}

export const InstitutionTickets: React.FC<InstitutionTicketsProps> = ({
  institution,
  users,
  tasks = [],
  onSelectTask,
  onUpdateTaskStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

  // Filter tasks belonging to this institution or of institutional type
  const institutionTickets = tasks.filter(t => {
    const isInst = t.institutionId === institution?.id || t.type === 'INSTITUTIONAL' || Boolean(t.ticketNumber);
    if (!isInst) return false;

    if (statusFilter === 'PENDING') {
      if (t.completed || t.status === 'COMPLETED') return false;
    } else if (statusFilter === 'IN_PROGRESS') {
      if (t.status !== 'IN_PROGRESS' || t.completed) return false;
    } else if (statusFilter === 'COMPLETED') {
      if (!t.completed && t.status !== 'COMPLETED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ticketNum = (t.ticketNumber || `TK-${t.id.slice(0, 5)}`).toLowerCase();
      const title = t.title.toLowerCase();
      const desc = (t.description || '').toLowerCase();
      return ticketNum.includes(q) || title.includes(q) || desc.includes(q);
    }

    return true;
  });

  const totalTickets = tasks.filter(t => t.institutionId === institution?.id || t.type === 'INSTITUTIONAL').length;
  const pendingCount = tasks.filter(t => (t.institutionId === institution?.id || t.type === 'INSTITUTIONAL') && !t.completed).length;
  const completedCount = tasks.filter(t => (t.institutionId === institution?.id || t.type === 'INSTITUTIONAL') && t.completed).length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Ticket className="w-4 h-4" /> Total de Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTickets}</div>
            <p className="text-[11px] text-muted-foreground">Demandas institucionais registradas</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Em Aberto / Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <p className="text-[11px] text-muted-foreground">Aguardando atendimento</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Finalizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
            <p className="text-[11px] text-muted-foreground">Demandas resolvidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">Painel de Tickets e Demandas</CardTitle>
              <CardDescription>Acompanhe e despache chamados e delegações internas da equipe</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por ticket, título..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs w-56 rounded-xl"
                  aria-label="Buscar tickets"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 overflow-x-auto">
            {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' && 'Todos'}
                {status === 'PENDING' && 'Pendentes'}
                {status === 'IN_PROGRESS' && 'Em Andamento'}
                {status === 'COMPLETED' && 'Concluídos'}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <div className="divide-y border rounded-xl overflow-hidden">
            {institutionTickets.length > 0 ? (
              institutionTickets.map(ticket => {
                const assignedUserId = ticket.assignedTo?.[0] || ticket.userId;
                const assignedUser = users.find(u => u.id === assignedUserId);
                const ticketCode = ticket.ticketNumber || `TK-${ticket.id.slice(0, 5).toUpperCase()}`;

                return (
                  <div 
                    key={ticket.id} 
                    className="p-4 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => onSelectTask?.(ticket)}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/60">
                          {ticketCode}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            ticket.completed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                            ticket.status === 'IN_PROGRESS' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                            "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {ticket.completed ? 'Concluído' : ticket.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Pendente'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          • {ticket.quadrant.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <h4 className={cn("text-sm font-semibold truncate", ticket.completed && "line-through text-muted-foreground")}>
                        {ticket.title}
                      </h4>
                      {ticket.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {ticket.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      {assignedUser && (
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                          <UserIcon className="w-3 h-3 text-primary" />
                          <span className="font-medium text-foreground">{assignedUser.name}</span>
                        </div>
                      )}
                      {ticket.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(ticket.dueDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask?.(ticket);
                        }}
                      >
                        Ver Detalhes <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Ticket className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">Nenhum ticket encontrado com os filtros atuais.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

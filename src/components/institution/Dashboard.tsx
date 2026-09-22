import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Ticket, CheckSquare, MessageSquare } from 'lucide-react';
import { Institution, User, Task } from '@/types';

interface InstitutionDashboardProps {
  institution?: Institution;
  users: User[];
  tasks: Task[];
}

export const InstitutionDashboard: React.FC<InstitutionDashboardProps> = ({ institution, users, tasks = [] }) => {
  const institutionTasks = (tasks || []).filter(t => t.institutionId === institution?.id);
  const completedTasks = institutionTasks.filter(t => t.completed).length;
  const pendingTasks = institutionTasks.filter(t => !t.completed).length;
  const onlineUsers = users.filter(u => u.status === 'online').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Membros Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-[10px] text-muted-foreground">{onlineUsers} online agora</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              Tarefas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks}</div>
            <p className="text-[10px] text-muted-foreground">Aguardando execução</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-500" />
              Tarefas Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-[10px] text-muted-foreground">Impacto institucional</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Engajamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{institutionTasks.length > 0 ? Math.round((completedTasks / institutionTasks.length) * 100) : 0}%</div>
            <p className="text-[10px] text-muted-foreground">Taxa de conclusão</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atividade Recente da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {institutionTasks.slice(0, 5).map((task, i) => {
                const assignedUser = users.find(u => u.id === (task.assignedTo?.[0] || task.userId));
                return (
                  <div key={task.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                      {assignedUser?.name.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {assignedUser?.name || 'Membro'} {task.completed ? 'concluiu' : 'está trabalhando em'} "{task.title}"
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                        {task.completed ? 'Concluída' : 'Pendente'} • {task.quadrant}
                      </p>
                    </div>
                  </div>
                );
              })}
              {institutionTasks.length === 0 && (
                <div className="py-12 text-center text-muted-foreground italic text-sm">
                  Nenhuma atividade registrada na instituição ainda.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximos Prazos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 border-l-4 border-red-500 bg-red-500/5 rounded-r-xl">
                <p className="text-sm font-bold">Reunião de Alinhamento</p>
                <p className="text-xs text-muted-foreground">Hoje, 14:00</p>
              </div>
              <div className="p-3 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl">
                <p className="text-sm font-bold">Entrega Projeto X</p>
                <p className="text-xs text-muted-foreground">Amanhã, 10:00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

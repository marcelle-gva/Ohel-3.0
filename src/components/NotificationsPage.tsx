import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Trash2, Mail, BellOff, Filter, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationsPageProps {
  userId: string;
  onNavigate: (view: any) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ userId, onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => unsubscribe();
  }, [userId]);

  const toggleReadStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: !currentStatus });
      toast.success(currentStatus ? 'Notificação marcada como não lida' : 'Notificação marcada como lida');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    // Mark as read when clicked
    if (!n.read) {
      toggleReadStatus(n.id, false);
    }
    
    // Navigate based on type
    if (n.type === 'MISSION_CREATED') {
      onNavigate('missions');
    } else if (n.type === 'TASK_DELEGATED' || n.type === 'TASK_ASSIGNED') {
      onNavigate('dashboard'); // Or specific module if known
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast.success('Todas as notificações marcadas como lidas');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notificação removida');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const clearAll = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      toast.success('Histórico limpo');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications');
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('all')}
            className="rounded-full"
          >
            Todas
          </Button>
          <Button 
            variant={filter === 'unread' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setFilter('unread')}
            className="rounded-full"
          >
            Não lidas
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary border-none">
                {notifications.filter(n => !n.read).length}
              </Badge>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Marcar todas como lidas
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
            Limpar tudo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Histórico de Notificações
          </CardTitle>
          <CardDescription>Fique por dentro das atualizações das suas tarefas e equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredNotifications.map((n) => (
              <div 
                key={n.id} 
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "p-4 border rounded-xl flex items-start justify-between gap-4 transition-all cursor-pointer",
                  !n.read ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-2 rounded-full mt-1",
                    !n.read ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm">{n.title}</h4>
                      {!n.read && <Badge variant="default" className="text-[10px] py-0 px-1">Nova</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'Agora'}
                      {n.senderName && <span>• Enviado por {n.senderName}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => toggleReadStatus(n.id, !!n.read)} 
                    className={cn("h-8 w-8", !n.read ? "text-primary" : "text-muted-foreground hover:text-primary")}
                    title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                  >
                    {n.read ? <Mail className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <BellOff className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Você não tem nenhuma notificação {filter === 'unread' ? 'não lida' : ''}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

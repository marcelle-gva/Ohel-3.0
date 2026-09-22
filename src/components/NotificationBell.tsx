import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, writeBatch } from 'firebase/firestore';
import { Notification } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Trash2, ExternalLink, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  userId: string;
  onNavigate: (view: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
      
      const unread = data.filter(n => !n.read).length;
      setUnreadCount(unread);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.type === 'MISSION_CREATED') {
      onNavigate('missions');
    } else if (n.type === 'TASK_DELEGATED' || n.type === 'TASK_ASSIGNED') {
      onNavigate('dashboard');
    } else {
      onNavigate('notifications');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        render={
          <Button variant="ghost" size="icon" className="relative group">
            <Bell className="w-5 h-5 transition-transform group-hover:scale-110" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white border-2 border-background animate-in zoom-in-0 duration-300">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="p-4 flex items-center justify-between border-b">
          <h3 className="font-bold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-[10px] gap-1">
              <Check className="w-3 h-3" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenuItem 
                key={n.id} 
                className={cn(
                  "p-4 flex flex-col items-start gap-1 cursor-pointer transition-colors",
                  !n.read && "bg-primary/5"
                )}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex w-full justify-between items-start gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-xs">{n.title}</span>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        updateDoc(doc(db, 'notifications', n.id), { read: !n.read });
                      }}
                      title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                    >
                      {n.read ? <Mail className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    </Button>
                    {!n.read && <Badge className="h-1.5 w-1.5 p-0 rounded-full bg-primary" />}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'Agora'}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação recente
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full text-xs gap-2" 
            onClick={() => onNavigate('notifications')}
          >
            Ver todas as notificações
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

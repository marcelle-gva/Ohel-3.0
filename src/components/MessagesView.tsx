import React, { useState, useEffect } from 'react';
import { Message, User, Task } from '@/types';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Video, 
  Info, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Ticket,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';

interface MessagesViewProps {
  currentUser: User;
  users: User[];
  messages: Message[];
  tasks: Task[];
  onSendMessage: (msg: Partial<Message>) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ currentUser, users, messages, tasks, onSendMessage }) => {
  const [selectedChat, setSelectedChat] = useState<User | Task | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const permissions = usePermissions(currentUser);
  const isManager = permissions.isManager;

  // Filter chats based on role: Managers see all members; Members see managers/admins to contact them directly
  const availableUsers = isManager 
    ? users.filter(u => u.id !== currentUser.id) 
    : users.filter(u => u.id !== currentUser.id && (u.role === 'ADMIN' || u.role === 'MANAGER' || u.isPlatformAdmin));
    
  const availableTasks = tasks.filter(t => t.userId === currentUser.id || (Array.isArray(t.assignedTo) && t.assignedTo.includes(currentUser.id)));

  const filteredMessages = messages.filter(m => {
    if (!selectedChat) return false;
    if ('role' in selectedChat) { // User chat
      return (m.senderId === currentUser.id && m.receiverId === selectedChat.id) ||
             (m.senderId === selectedChat.id && m.receiverId === currentUser.id);
    } else { // Task ticket chat
      return m.taskId === selectedChat.id;
    }
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedChat) return;
    
    const msg: Partial<Message> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: messageText,
      createdAt: Date.now(),
      read: false
    };

    if ('role' in selectedChat) {
      msg.receiverId = selectedChat.id;
    } else {
      msg.taskId = selectedChat.id;
    }

    onSendMessage(msg);
    setMessageText('');
  };

  return (
    <div className="flex h-full bg-card rounded-2xl border border-border/50 overflow-hidden shadow-xl">
      {/* SIDEBAR */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-10 bg-background/50 border-border/30" 
              placeholder="Buscar conversas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isManager && (
              <>
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Membros</p>
                </div>
                {availableUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedChat(user)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-primary/5 text-left",
                      selectedChat?.id === user.id && "bg-primary/10 ring-1 ring-primary/20"
                    )}
                  >
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Clique para conversar</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            <div className="px-3 py-2 mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tickets de Tarefas</p>
            </div>
            {availableTasks.map(task => (
              <button
                key={task.id}
                onClick={() => setSelectedChat(task)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-primary/5 text-left",
                  selectedChat?.id === task.id && "bg-primary/10 ring-1 ring-primary/20"
                )}
              >
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">Ticket #{task.id.slice(-4)}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col bg-background/50">
        {selectedChat ? (
          <>
            {/* CHAT HEADER */}
            <div className="p-4 border-b flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                {'role' in selectedChat ? (
                  <Avatar className="h-10 w-10 border border-border/50">
                    <AvatarImage src={(selectedChat as User).photoURL} />
                    <AvatarFallback>{(selectedChat as User).name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                    <Ticket className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold">{'role' in selectedChat ? (selectedChat as User).name : (selectedChat as Task).title}</h3>
                  <p className="text-[10px] text-green-500 font-medium">Ativo agora</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Video className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Info className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* MESSAGES */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {filteredMessages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      <div className={cn(
                        "max-w-[70%] p-3 rounded-2xl text-sm shadow-sm",
                        isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border/50 rounded-tl-none"
                      )}>
                        <p>{msg.text}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {(() => {
                            try {
                              const date = msg.createdAt instanceof Date 
                                ? msg.createdAt 
                                : typeof msg.createdAt?.toDate === 'function' 
                                  ? msg.createdAt.toDate() 
                                  : new Date(msg.createdAt);
                              return isNaN(date.getTime()) ? '--:--' : format(date, 'HH:mm');
                            } catch {
                              return '--:--';
                            }
                          })()}
                        </span>
                        {isMe && (
                          msg.read ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* INPUT AREA */}
            <div className="p-4 bg-card border-t">
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-2xl border border-border/30">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground shrink-0" aria-label="Anexar arquivo"><Paperclip className="w-4 h-4" /></Button>
                <Input 
                  className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" 
                  placeholder="Digite sua mensagem..." 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  aria-label="Mensagem"
                />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground shrink-0" aria-label="Inserir emoji"><Smile className="w-4 h-4" /></Button>
                <Button 
                  size="icon" 
                  className="h-9 w-9 shrink-0 shadow-lg shadow-primary/20"
                  disabled={!messageText.trim()}
                  onClick={handleSend}
                  aria-label="Enviar mensagem"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 p-12 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold mb-2">Suas Conversas</h3>
            <p className="text-sm max-w-xs">
              {isManager ? 'Selecione um membro ou ticket para começar a conversar.' : 'Selecione um membro ou gestor para iniciar uma conversa.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Task, Comment, Attachment, MODULES, User as UserType, UserGroup } from '@/types';
import { 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Paperclip, 
  Send, 
  X, 
  FileText, 
  Image as ImageIcon,
  Clock,
  User,
  Eye,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
 
interface TaskDetailsProps {
  task: Task;
  onUpdate: (task: Task) => void;
  users?: UserType[];
  groups?: UserGroup[];
  currentUser?: UserType | any;
}
 
export const TaskDetails: React.FC<TaskDetailsProps> = ({ task, onUpdate, users = [], groups = [], currentUser }) => {
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDesc, setEditedDesc] = useState(task.description || '');

  const handleSave = () => {
    onUpdate({
      ...task,
      title: editedTitle,
      description: editedDesc
    });
    setIsEditing(false);
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const authorName = currentUser?.name || currentUser?.displayName || 'Usuário';
    const authorId = currentUser?.id || currentUser?.uid || 'current-user';
    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      text: newComment.trim(),
      userId: authorId,
      userName: authorName,
      createdAt: Date.now(),
    };
    onUpdate({
      ...task,
      comments: [...(task.comments || []), comment],
    });
    setNewComment('');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendente';
      case 'ACCEPTED': return 'Aceita';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluída';
      case 'REFUSED': return 'Recusada';
      case 'ARCHIVED': return 'Arquivada';
      case 'PENDING_APPROVAL': return 'Aguardando Aprovação';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-[80vh]">
      <DialogHeader className="px-6 pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] uppercase">
            {task.moduleId ? (MODULES.find(m => m.id === task.moduleId || m.slug === task.moduleId)?.name || task.moduleId) : 'Geral'}
          </Badge>
          <Badge variant="secondary" className="text-[10px] uppercase">
            {getStatusLabel(task.status)}
          </Badge>
        </div>
        {isEditing ? (
          <div className="space-y-4 mt-4">
            <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
            <Textarea value={editedDesc} onChange={(e) => setEditedDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleSave}>Salvar</Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogTitle className="text-2xl flex items-center justify-between">
              {task.title}
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Criada em {new Date(task.createdAt).toLocaleDateString('pt-BR')}
            </DialogDescription>
          </>
        )}
      </DialogHeader>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6">
        <div className="flex-1 space-y-6 overflow-auto pr-2">
          <section>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição
            </h4>
            <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border">
              {task.description || 'Nenhuma descrição fornecida.'}
            </p>
          </section>

          <section>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Anexos
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {task.attachments?.map(att => (
                <div key={att.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-primary">
                    {att.type.includes('image') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="border-dashed h-auto py-4 flex flex-col gap-1 text-muted-foreground">
                <Plus className="w-4 h-4" />
                <span className="text-[10px]">Adicionar Arquivo</span>
              </Button>
            </div>
          </section>

          <section className="flex-1 flex flex-col min-h-[300px]">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comentários
            </h4>
            <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/10">
              <div className="space-y-4">
                {task.comments?.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                      {comment.userName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{comment.userName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm bg-background p-3 rounded-lg border shadow-sm">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))}
                {(!task.comments || task.comments.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Nenhum comentário ainda.
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="mt-4 flex gap-2">
              <Input 
                placeholder="Escreva um comentário..." 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
                aria-label="Escrever comentário"
              />
              <Button size="icon" onClick={addComment} aria-label="Enviar comentário">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </section>
        </div>

        <aside className="w-full md:w-64 space-y-6">
          <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalhes</h5>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Prazo
                </span>
                <span className="font-medium">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="w-3 h-3" /> Responsável
                </span>
                <span className="font-medium">{task.assignedByName || (currentUser?.name || 'Não atribuído')}</span>
              </div>
              
              {(task.assignedTo?.length || task.assignedToGroups?.length) && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Delegado para:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignedTo?.map(uid => (
                      <Badge key={uid} variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100">
                        {users.find(u => u.id === uid)?.name || 'Usuário'}
                      </Badge>
                    ))}
                    {task.assignedToGroups?.map(gid => (
                      <Badge key={gid} variant="secondary" className="text-[10px] bg-purple-50 text-purple-600 border-purple-100">
                        Grupo: {groups.find(g => g.id === gid)?.name || gid}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Visibilidade
                </p>
                <div className="bg-background rounded-md p-2 border text-[10px]">
                  <p className="font-medium text-primary mb-1">
                    {task.visibility === 'PRIVATE' ? 'Privado' : 
                     task.visibility === 'SPECIFIC' ? 'Específico' : 'Público'}
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {task.visibility === 'PRIVATE' ? 'Apenas o autor pode visualizar.' : 
                     task.visibility === 'SPECIFIC' ? 'Visível para os usuários/grupos selecionados.' : 
                     'Aberto para todos os membros da instituição.'}
                  </p>
                  {task.visibility === 'SPECIFIC' && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {task.visibleToUsers?.map(uid => (
                        <Badge key={uid} variant="outline" className="text-[9px] h-4">
                          {users.find(u => u.id === uid)?.name || 'Usuário'}
                        </Badge>
                      ))}
                      {task.visibleToGroups?.map(gid => (
                        <Badge key={gid} variant="outline" className="text-[9px] h-4">
                          {groups.find(g => g.id === gid)?.name || gid}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {task.timeSpent && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Tempo Gasto
                  </span>
                  <span className="font-medium text-green-600">
                    {task.timeSpent < 60 ? `${task.timeSpent}s` : `${Math.round(task.timeSpent / 60)}m`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

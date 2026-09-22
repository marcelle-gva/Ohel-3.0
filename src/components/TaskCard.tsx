import React from 'react';
import { Task, QUADRANT_LABELS } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trash2, MoreVertical, MessageSquare, Building2, GripVertical, CheckSquare, Timer, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useDraggable } from '@dnd-kit/core';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;
  onClick?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onDelete, onEdit, onClick }) => {
  const quadrant = QUADRANT_LABELS[task.quadrant];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(isDragging && "z-50 opacity-50")}
    >
      <Card 
        className={cn(
          "group relative overflow-hidden transition-all hover:shadow-md cursor-pointer",
          task.completed && "opacity-60 grayscale-[0.5]",
          isDragging && "ring-2 ring-primary shadow-xl"
        )}
        onClick={() => onClick?.(task)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div 
              {...attributes} 
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => onToggle(task.id)}
                aria-label={`Marcar ${task.title} como ${task.completed ? 'pendente' : 'concluída'}`}
                className="mt-1"
              />
              <button
                onClick={() => onToggle(task.id)}
                title="Tarefa Realizada"
                aria-label={`Alternar status da tarefa ${task.title}`}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  task.completed ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                "font-medium text-sm leading-tight truncate relative inline-block",
                task.completed && "text-muted-foreground"
              )}>
                {task.title}
                {task.completed && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    className="absolute left-0 top-1/2 h-[1px] bg-muted-foreground"
                  />
                )}
              </h4>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {task.description}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5 font-normal", quadrant.color)}>
                  {quadrant.title}
                </Badge>

                {task.type === 'INSTITUTIONAL' && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal gap-1">
                    <Building2 className="w-2.5 h-2.5" />
                    Institucional
                  </Badge>
                )}
                
                {task.assignedByName && (
                  <div className="text-[10px] text-muted-foreground italic">
                    De: {task.assignedByName}
                  </div>
                )}
                
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                  </div>
                )}
                
                {task.comments && task.comments.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    {task.comments.length}
                  </div>
                )}

                {task.timeSpent && task.completed && (
                  <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                    <Timer className="w-3 h-3" />
                    {task.timeSpent < 60 ? `${task.timeSpent}s` : `${Math.round(task.timeSpent / 60)}m`}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEdit?.(task)}
                aria-label={`Editar tarefa ${task.title}`}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-primary/10 hover:text-primary rounded"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                aria-label={`Excluir tarefa ${task.title}`}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 hover:text-destructive rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

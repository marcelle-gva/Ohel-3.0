import React from 'react';
import { Task, EisenhowerQuadrant, QUADRANT_LABELS } from '@/types';
import { TaskCard } from './TaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';

interface DroppableQuadrantProps {
  id: EisenhowerQuadrant;
  tasks: Task[];
  label: { title: string; subtitle: string; color: string };
  onAddTask: (quadrant: EisenhowerQuadrant, data?: { title: string; description: string; quadrant: EisenhowerQuadrant }) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask?: (task: Task) => void;
  onTaskClick?: (task: Task) => void;
}

const DroppableQuadrant: React.FC<DroppableQuadrantProps> = ({
  id,
  tasks,
  label,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onTaskClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [quickTitle, setQuickTitle] = React.useState('');

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onAddTask(id, { title: quickTitle.trim(), description: '', quadrant: id, moduleId: 'pessoal' });
    setQuickTitle('');
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card/50 overflow-hidden transition-all duration-200",
        isOver && "ring-2 ring-primary bg-primary/5 scale-[1.01] shadow-lg z-10",
        "hover:bg-card/80"
      )}
    >
      <div className="p-4 border-bottom flex items-center justify-between bg-muted/30">
        <div>
          <h3 className="font-bold text-sm tracking-tight">{label.title}</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {label.subtitle}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-primary hover:text-primary-foreground"
          onClick={() => onAddTask(id)}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 pt-4">
        <form onSubmit={handleQuickAdd} className="relative">
          <input
            type="text"
            placeholder="Adicionar tarefa rápida..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="w-full bg-muted/50 border-none rounded-lg py-2 pl-3 pr-10 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
          <Button 
            type="submit" 
            variant="ghost" 
            size="icon" 
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-50 hover:opacity-100"
            disabled={!quickTitle.trim()}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3 min-h-[150px]">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
                onEdit={onEditTask}
                onClick={onTaskClick}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className={cn("w-10 h-10 rounded-full mb-3 flex items-center justify-center opacity-20", label.color)}>
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground">Nenhuma tarefa aqui</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

interface EisenhowerMatrixProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (quadrant?: EisenhowerQuadrant, data?: { title: string; description: string; quadrant: EisenhowerQuadrant; moduleId: string }) => void;
  onEditTask?: (task: Task) => void;
  onTaskClick?: (task: Task) => void;
  onUpdateTaskQuadrant: (taskId: string, newQuadrant: EisenhowerQuadrant) => void;
}

export const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({
  tasks,
  onToggleTask,
  onDeleteTask,
  onAddTask,
  onEditTask,
  onTaskClick,
  onUpdateTaskQuadrant,
}) => {
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const quadrants: EisenhowerQuadrant[] = [
    'urgent-important',
    'important-not-urgent',
    'urgent-not-important',
    'not-urgent-not-important',
  ];

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (over && active.id !== over.id) {
      const taskId = active.id as string;
      const newQuadrant = over.id as EisenhowerQuadrant;
      
      // Only update if the quadrant actually changed
      const task = tasks.find(t => t.id === taskId);
      if (task && task.quadrant !== newQuadrant) {
        onUpdateTaskQuadrant(taskId, newQuadrant);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[600px]">
        {quadrants.map((q) => (
          <DroppableQuadrant
            key={q}
            id={q}
            tasks={tasks.filter((t) => t.quadrant === q)}
            label={QUADRANT_LABELS[q]}
            onAddTask={onAddTask}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[300px] rotate-2 opacity-80 cursor-grabbing">
            <TaskCard
              task={activeTask}
              onToggle={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

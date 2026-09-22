import React, { useState } from 'react';
import { Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Pencil
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  KeyboardSensor, 
  closestCorners,
  useDraggable,
  useDroppable,
  DragEndEvent
} from '@dnd-kit/core';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDayClick: (day: Date) => void;
  onUpdateTaskDate?: (taskId: string, newDate: number) => void;
}

const DraggableCalendarTask = ({ task, onTaskClick }: { task: Task; onTaskClick: (task: Task) => void; key?: any }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100,
  } : undefined;

  const isBirthday = task.title?.includes('🎂') || task.tags?.some(t => t.toLowerCase().includes('aniversário') || t.toLowerCase().includes('niver'));
  const isNow = task.quadrant === 'urgent-important';
  const isSchedule = task.quadrant === 'important-not-urgent';
  const isDelegate = task.quadrant === 'urgent-not-important';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "w-full text-left p-1 rounded-md text-[10px] font-bold truncate border transition-all shadow-sm cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        task.completed ? "bg-muted/50 text-muted-foreground line-through border-transparent" : 
        isBirthday ? "bg-pink-500/15 border-pink-500/30 text-pink-700 dark:text-pink-300 hover:bg-pink-500/25" :
        isNow ? "bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20" :
        isSchedule ? "bg-blue-500/10 border-blue-500/20 text-blue-600 hover:bg-blue-500/20" :
        isDelegate ? "bg-orange-500/10 border-orange-500/20 text-orange-600 hover:bg-orange-500/20" :
        "bg-slate-500/10 border-slate-500/20 text-slate-600 hover:bg-slate-500/20"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick(task);
      }}
    >
      <div className="flex items-center gap-1 truncate">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isBirthday ? "bg-pink-500 animate-pulse" :
          isNow ? "bg-red-500" : isSchedule ? "bg-blue-500" : isDelegate ? "bg-orange-500" : "bg-slate-500"
        )} />
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  );
};

const DroppableCalendarDay = ({ 
  day, 
  isCurrentMonth, 
  isToday, 
  children, 
  onClick 
}: { 
  day: Date; 
  isCurrentMonth: boolean; 
  isToday: boolean; 
  children: React.ReactNode; 
  onClick: () => void;
  key?: any;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: day.toISOString(),
  });

  return (
    <div 
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "min-h-[120px] p-2 border-r border-b transition-colors flex flex-col gap-1 cursor-pointer",
        !isCurrentMonth ? "bg-muted/5 opacity-30" : "bg-card/30 hover:bg-muted/10",
        isToday && "bg-primary/5 border-primary/20",
        isOver && "bg-primary/20 scale-[1.02] z-10 transition-all duration-200"
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={cn(
          "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}>
          {format(day, 'd')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
        {children}
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick, onDayClick, onUpdateTaskDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      // @ts-ignore - targetDate might be on some tasks
      const dateVal = task.dueDate || task.targetDate || task.scheduledDate;
      if (!dateVal) return false;
      const taskDate = new Date(dateVal);
      return isSameDay(taskDate, day);
    });
  };

  const handleDragStart = (event: any) => {
    setActiveTask(event.active.data.current.task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    
    if (over && onUpdateTaskDate) {
      const taskId = active.id as string;
      const newDate = new Date(over.id as string).getTime();
      onUpdateTaskDate(taskId, newDate);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Meu Calendário</h2>
              <p className="text-muted-foreground">Visualize e organize seus compromissos no tempo.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-muted/30 p-1 rounded-xl border">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </Button>
          </div>
        </div>

        <Card className="flex-1 border-none shadow-none bg-transparent overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="grid grid-cols-7 border-b bg-muted/20">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 flex-1 border-l border-t">
              {calendarDays.map((day, idx) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());

                return (
                  <DroppableCalendarDay 
                    key={idx}
                    day={day}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    onClick={() => onDayClick(day)}
                  >
                    {dayTasks.map(task => (
                      <DraggableCalendarTask 
                        key={task.id} 
                        task={task} 
                        onTaskClick={onTaskClick} 
                      />
                    ))}
                  </DroppableCalendarDay>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className={cn(
            "p-1.5 rounded-lg text-[10px] font-bold truncate border shadow-lg ring-2 ring-primary bg-background w-[120px]",
            activeTask.quadrant === 'urgent-important' ? "text-red-600 border-red-500/50" :
            activeTask.quadrant === 'important-not-urgent' ? "text-blue-600 border-blue-500/50" :
            activeTask.quadrant === 'urgent-not-important' ? "text-orange-600 border-orange-500/50" :
            "text-slate-600 border-slate-500/50"
          )}>
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

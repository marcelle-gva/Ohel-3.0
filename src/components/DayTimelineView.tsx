import React, { useEffect, useRef } from 'react';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';

interface DayTimelineViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  startHour?: number; // default 6am
  endHour?: number; // default 23h
}

const HOUR_HEIGHT = 64; // px per hour row
const EVENT_ACCENTS = ['#3B82F6', '#8B5CF6', '#22C55E', '#F5A623', '#3B82F6', '#8B95A8']; // cycles for non-urgent events, echoing the reference layout's per-row color variety

/**
 * "A agenda do dia do dash principal pode ser em formato de calendario com
 * horarios descritos tipo google faz" (2026-09-17). One vertical hour grid,
 * tasks positioned by dueDate's time-of-day, current-time indicator line,
 * auto-scrolled to roughly the current hour on mount.
 */
export const DayTimelineView: React.FC<DayTimelineViewProps> = ({
  tasks,
  onTaskClick,
  onEditTask,
  startHour = 6,
  endHour = 23,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const timedTasks = tasks.filter((t) => t.dueDate);
  const untimedTasks = tasks.filter((t) => !t.dueDate);

  const minutesFromStart = (date: Date) =>
    (date.getHours() - startHour) * 60 + date.getMinutes();

  const nowOffset = minutesFromStart(now);
  const showNowLine = now.getHours() >= startHour && now.getHours() <= endHour;

  useEffect(() => {
    if (scrollRef.current && showNowLine) {
      const target = Math.max(0, (nowOffset / 60) * HOUR_HEIGHT - HOUR_HEIGHT * 2);
      scrollRef.current.scrollTop = target;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      {untimedTasks.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 mb-3 border-b border-border/50">
          {untimedTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                task.quadrant === 'urgent-important'
                  ? 'border-red-500/40 text-red-600 bg-red-500/10 hover:bg-red-500/20'
                  : 'border-primary/40 text-primary bg-primary/10 hover:bg-primary/20'
              )}
            >
              {task.title}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour rows */}
          {hours.map((hour, idx) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex border-t border-border/40"
              style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <div className="w-14 shrink-0 -mt-2.5 text-right pr-2">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              <div className="flex-1" />
            </div>
          ))}

          {/* Current time indicator */}
          {showNowLine && (
            <div
              className="absolute left-14 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: (nowOffset / 60) * HOUR_HEIGHT }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          )}

          {/* Tasks positioned by time */}
          <div className="absolute left-16 right-2 top-0 bottom-0">
            {timedTasks.map((task, idx) => {
              const date = new Date(task.dueDate!);
              const offsetMinutes = minutesFromStart(date);
              const top = Math.max(0, (offsetMinutes / 60) * HOUR_HEIGHT);
              const isUrgent = task.quadrant === 'urgent-important';
              const accent = isUrgent ? '#EF4444' : EVENT_ACCENTS[idx % EVENT_ACCENTS.length];
              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onTaskClick(task)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTaskClick(task);
                    }
                  }}
                  className="group absolute left-0 right-0 text-left rounded-lg border-l-4 px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-muted/40 hover:bg-muted/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ top, minHeight: 40, borderLeftColor: accent }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>
                        {date.toTimeString().slice(0, 5)}
                      </p>
                      <p className="text-sm font-bold truncate">{task.title}</p>
                    </div>
                    {onEditTask && (
                      <button
                        type="button"
                        aria-label={`Editar ${task.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 p-1 -m-1 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

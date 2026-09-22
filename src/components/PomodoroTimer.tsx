import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, Brain, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PomodoroTimerProps {
  onComplete?: () => void;
  onTaskComplete?: (timeSpent: number) => void;
  taskTitle?: string;
  focusedTaskId?: string | null;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ 
  onComplete, 
  onTaskComplete,
  taskTitle,
  focusedTaskId 
}) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [sessionTimeSpent, setSessionTimeSpent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('ohel_pomodoro');
    if (saved) {
      const { startTime, duration, savedMode, wasActive, timeSpent = 0 } = JSON.parse(saved);
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = duration - elapsed;

      setSessionTimeSpent(timeSpent);

      if (wasActive && remaining > 0) {
        setTimeLeft(remaining);
        setMode(savedMode);
        setIsActive(true);
      } else if (!wasActive) {
        setTimeLeft(duration);
        setMode(savedMode);
      }
    }
  }, []);

  // Save persistence
  useEffect(() => {
    if (isActive) {
      localStorage.setItem('ohel_pomodoro', JSON.stringify({
        startTime: Date.now() - ((mode === 'work' ? 25 * 60 : 5 * 60) - timeLeft) * 1000,
        duration: mode === 'work' ? 25 * 60 : 5 * 60,
        savedMode: mode,
        wasActive: true,
        timeSpent: sessionTimeSpent
      }));
    } else {
      localStorage.setItem('ohel_pomodoro', JSON.stringify({
        startTime: Date.now(),
        duration: timeLeft,
        savedMode: mode,
        wasActive: false,
        timeSpent: sessionTimeSpent
      }));
    }
  }, [isActive, timeLeft, mode, sessionTimeSpent]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        if (mode === 'work') {
          setSessionTimeSpent(prev => prev + 1);
        }
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (onComplete) onComplete();
      // Auto switch mode
      if (mode === 'work') {
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        setMode('work');
        setTimeLeft(25 * 60);
      }
      // Simple notification sound simulation
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode, onComplete]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
    setSessionTimeSpent(0);
  };

  const handleFinishTask = () => {
    if (onTaskComplete) {
      onTaskComplete(sessionTimeSpent);
      setSessionTimeSpent(0);
      setIsActive(false);
      setTimeLeft(25 * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'work' 
    ? ((25 * 60 - timeLeft) / (25 * 60)) * 100 
    : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-8 bg-card rounded-2xl border shadow-sm">
      <div className="flex gap-2 p-1 bg-muted rounded-full">
        <Button
          variant={mode === 'work' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-full"
          onClick={() => {
            setMode('work');
            setTimeLeft(25 * 60);
            setIsActive(false);
          }}
        >
          <Brain className="w-4 h-4 mr-2" />
          Foco
        </Button>
        <Button
          variant={mode === 'break' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-full"
          onClick={() => {
            setMode('break');
            setTimeLeft(5 * 60);
            setIsActive(false);
          }}
        >
          <Coffee className="w-4 h-4 mr-2" />
          Pausa
        </Button>
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <motion.circle
            cx="96"
            cy="96"
            r="88"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray="552.92"
            animate={{ strokeDashoffset: 552.92 - (552.92 * progress) / 100 }}
            className={cn(
              "transition-colors duration-500",
              mode === 'work' ? "text-primary" : "text-green-500"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <span className="text-4xl font-bold font-mono tracking-tighter">
            {formatTime(timeLeft)}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {mode === 'work' ? 'Trabalhando' : 'Descansando'}
          </span>
          {taskTitle && mode === 'work' && (
            <span className="text-[10px] mt-2 text-primary font-semibold line-clamp-2">
              {taskTitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={resetTimer}
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
        <Button
          size="icon"
          className={cn(
            "rounded-full h-16 w-16 shadow-lg transition-all",
            isActive ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90"
          )}
          onClick={toggleTimer}
        >
          {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </Button>
        {focusedTaskId && (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12 border-green-500/50 text-green-600 hover:bg-green-50"
            onClick={handleFinishTask}
          >
            <CheckCircle2 className="w-5 h-5" />
          </Button>
        )}
        {!focusedTaskId && <div className="w-12" />}
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, ArrowRight, CheckSquare, User as UserIcon, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, User } from '@/types';

interface SidebarItemLike {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  users: User[];
  navItems: SidebarItemLike[];
  onSelectTask: (task: Task) => void;
  onSelectUser: (user: User) => void;
  onNavigate: (viewId: string) => void;
}

interface Entry {
  id: string;
  group: 'Módulos' | 'Tarefas' | 'Pessoas';
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  action: () => void;
}

/**
 * "topico 1 eu quero de verdade" (2026-09-20) — Ctrl+K/Cmd+K abre um
 * spotlight de verdade, buscando módulos da sidebar, tarefas e pessoas.
 * Sem lib nova (cmdk etc.) — só Dialog + Input que já existem, seguindo a
 * regra de performance de não adicionar dependências desnecessárias.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open, onOpenChange, tasks, users, navItems, onSelectTask, onSelectUser, onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const entries: Entry[] = useMemo(() => {
    const moduleEntries: Entry[] = navItems.map((item) => ({
      id: `module:${item.id}`,
      group: 'Módulos',
      label: item.label,
      icon: item.icon,
      action: () => onNavigate(item.id),
    }));

    const taskEntries: Entry[] = tasks
      .filter((t) => !t.completed)
      .slice(0, 200) // keep the filter cheap; query narrows it further below
      .map((t) => ({
        id: `task:${t.id}`,
        group: 'Tarefas',
        label: t.title,
        sublabel: t.moduleId,
        icon: CheckSquare,
        action: () => onSelectTask(t),
      }));

    const userEntries: Entry[] = users.map((u) => ({
      id: `user:${u.id}`,
      group: 'Pessoas',
      label: u.name,
      sublabel: u.email,
      icon: UserIcon,
      action: () => onSelectUser(u),
    }));

    return [...moduleEntries, ...taskEntries, ...userEntries];
  }, [navItems, tasks, users, onNavigate, onSelectTask, onSelectUser]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries.filter((e) => e.group === 'Módulos');
    const q = query.toLowerCase();
    return entries.filter(
      (e) => e.label.toLowerCase().includes(q) || e.sublabel?.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [entries, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Entry[]> = {};
    filtered.forEach((e) => {
      groups[e.group] = groups[e.group] || [];
      groups[e.group].push(e);
    });
    return groups;
  }, [filtered]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) {
        entry.action();
        onOpenChange(false);
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden top-[20%] translate-y-0" aria-describedby={undefined}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tarefas, módulos, pessoas..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
            aria-label="Busca rápida"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nada encontrado pra "{query}".</p>
          )}
          {(['Módulos', 'Tarefas', 'Pessoas'] as const).map((groupName) => {
            const items = grouped[groupName];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupName} className="px-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">{groupName}</p>
                {items.map((entry) => {
                  runningIndex += 1;
                  const idx = runningIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={entry.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        entry.action();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                      )}
                    >
                      <entry.icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{entry.label}</p>
                        {entry.sublabel && <p className="text-[11px] text-muted-foreground truncate">{entry.sublabel}</p>}
                      </div>
                      {isActive && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

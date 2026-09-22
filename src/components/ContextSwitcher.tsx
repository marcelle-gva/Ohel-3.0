import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Home, Building2, User, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The "Netflix profile" selector: one place to switch between "my own
 * stuff" (PERSONAL) and every Household/Institution the person is an
 * active member of. Never logs anyone out or reloads the app — it's a
 * pure context switch (see AuthContext.switchContext), matching the
 * 2026-09-17 decision: "a troca de contexto ... funciona como perfis
 * tipo da Netflix — um seletor, não contas separadas."
 */
export const ContextSwitcher: React.FC<{ onManageInvites?: () => void }> = ({ onManageInvites }) => {
  const { user, userData, memberships, activeContextType, activeContextId, switchContext } = useAuth();

  if (!user) return null;

  const activeLabel = (() => {
    if (activeContextType === 'PERSONAL') return userData?.name || 'Minha Casa';
    const active = memberships.find(
      (m) => m.contextType === activeContextType && m.contextId === activeContextId
    );
    return active ? (active.profileName || active.name) : 'Perfil';
  })();

  const initials = activeLabel
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'O';

  const households = memberships.filter((m) => m.contextType === 'HOUSEHOLD');
  const institutions = memberships.filter((m) => m.contextType === 'INSTITUTION');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id="btn-context-switcher"
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors"
          aria-label="Trocar perfil"
        >
          <Avatar className="h-8 w-8 border-2 border-primary/30">
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs font-bold">{activeLabel}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {activeContextType === 'PERSONAL' ? 'Pessoal' : activeContextType === 'HOUSEHOLD' ? 'Casa' : 'Instituição'}
            </span>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Perfis disponíveis
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => switchContext('PERSONAL', null)}
          className="flex items-center gap-3 py-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{userData?.name || 'Meu perfil'}</p>
            <p className="text-[11px] text-muted-foreground">Pessoal</p>
          </div>
          {activeContextType === 'PERSONAL' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>

        {households.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Casas
            </DropdownMenuLabel>
            {households.map((m) => (
              <DropdownMenuItem
                key={m.contextId}
                onClick={() => switchContext('HOUSEHOLD', m.contextId)}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.profileName || m.role}</p>
                </div>
                {activeContextType === 'HOUSEHOLD' && activeContextId === m.contextId && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {institutions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Instituições
            </DropdownMenuLabel>
            {institutions.map((m) => (
              <DropdownMenuItem
                key={m.contextId}
                onClick={() => switchContext('INSTITUTION', m.contextId)}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <div>
                    <p className="text-sm font-bold">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.role}</p>
                  </div>
                  {m.planType?.includes('PLUS') && (
                    <Badge className="text-[8px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700 border-none">PLUS</Badge>
                  )}
                </div>
                {activeContextType === 'INSTITUTION' && activeContextId === m.contextId && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onManageInvites}
          className={cn('flex items-center gap-3 py-2.5 cursor-pointer text-primary font-bold')}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          Adicionar Casa ou Instituição
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import React, { useState, useMemo } from 'react';
import { User, Institution } from '@/types';
import { ViewMode } from '@/context/AuthContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Eye, 
  User as UserIcon, 
  Building2, 
  Users, 
  Search, 
  Zap, 
  ChevronDown, 
  ShieldCheck, 
  RotateCcw,
  Check,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type AdminPerspectiveMode = 'SELF' | 'GLOBAL' | 'USER';

interface AdminProfileSwitcherProps {
  allUsers: User[];
  institutions: Institution[];
  adminViewMode: AdminPerspectiveMode;
  setAdminViewMode: (mode: AdminPerspectiveMode) => void;
  impersonatedUser: User | null;
  setImpersonatedUser: (user: User | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onSelectGlobalView: () => void;
  customClaims?: Record<string, any> | null;
  onRefreshClaims?: () => Promise<void>;
}

export const AdminProfileSwitcher: React.FC<AdminProfileSwitcherProps> = ({
  allUsers,
  institutions,
  adminViewMode,
  setAdminViewMode,
  impersonatedUser,
  setImpersonatedUser,
  viewMode,
  setViewMode,
  onSelectGlobalView,
  customClaims,
  onRefreshClaims,
}) => {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'ALL' | 'PERSONAL' | 'INSTITUTIONAL'>('ALL');
  const [isSyncingClaims, setIsSyncingClaims] = useState(false);

  const institutionMap = useMemo(() => {
    const map = new Map<string, string>();
    institutions.forEach(i => map.set(i.id, i.name));
    return map;
  }, [institutions]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      const instName = u.institutionId ? (institutionMap.get(u.institutionId) || '') : '';
      const matchesSearch = 
        !q || 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        instName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isPersonal = !u.institutionId && (u.type === 'personal' || u.profileType === 'PERSONAL');
      if (userTypeFilter === 'PERSONAL') return isPersonal;
      if (userTypeFilter === 'INSTITUTIONAL') return !isPersonal;
      return true;
    });
  }, [allUsers, searchQuery, userTypeFilter, institutionMap]);

  const counts = useMemo(() => {
    let personal = 0;
    let institutional = 0;
    allUsers.forEach(u => {
      if (!u.institutionId && (u.type === 'personal' || u.profileType === 'PERSONAL')) {
        personal++;
      } else {
        institutional++;
      }
    });
    return { all: allUsers.length, personal, institutional };
  }, [allUsers]);

  const handleSelectUser = (targetUser: User) => {
    setImpersonatedUser(targetUser);
    setAdminViewMode('USER');
    setIsSearchDialogOpen(false);

    // Automatically align viewMode to target user's profile
    if (!targetUser.institutionId || targetUser.type === 'personal' || targetUser.profileType === 'PERSONAL') {
      setViewMode('PERSONAL');
    } else if (targetUser.role === 'ADMIN' || targetUser.type === 'institution_owner') {
      setViewMode('INSTITUTION_OWNER');
    } else {
      setViewMode('INSTITUTION_MEMBER');
    }

    toast.success(`Modo de Inspeção Ativado!`, {
      description: `Visualizando como ${targetUser.name || targetUser.email} (${targetUser.role || 'Membro'}).`,
      duration: 5000,
    });
  };

  const handleResetToSelf = () => {
    setImpersonatedUser(null);
    setAdminViewMode('SELF');
    setViewMode(null);
    toast.info('Retornado à visualização própria de Administrador.');
  };

  const handleSwitchToGlobal = () => {
    setImpersonatedUser(null);
    setAdminViewMode('GLOBAL');
    onSelectGlobalView();
    toast.success('Visão Global da Plataforma Ativada!', {
      description: 'Visualizando métricas, usuários e tarefas agregadas de todos os perfis.',
    });
  };

  const handleSyncClaims = async () => {
    if (!onRefreshClaims) return;
    setIsSyncingClaims(true);
    try {
      await onRefreshClaims();
      toast.success('Custom Claims de Administrador verificadas e sincronizadas com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao sincronizar claims: ' + (err.message || 'Falha'));
    } finally {
      setIsSyncingClaims(false);
    }
  };

  // Label and styling of the main trigger button
  const triggerDisplay = useMemo(() => {
    if (adminViewMode === 'GLOBAL') {
      return {
        label: 'VISÃO GLOBAL (TODOS)',
        badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        icon: <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
      };
    }

    if (adminViewMode === 'USER' && impersonatedUser) {
      return {
        label: `INSPECIONANDO: ${(impersonatedUser.name || impersonatedUser.email).slice(0, 14)}...`,
        badgeColor: 'border-amber-500/50 text-amber-300 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
        icon: <Eye className="w-4 h-4 text-amber-400 animate-pulse" />
      };
    }

    // SELF Mode
    let subLabel = 'ADMIN MASTER';
    if (viewMode === 'PERSONAL') subLabel = 'VISÃO PESSOAL';
    if (viewMode === 'INSTITUTION_OWNER') subLabel = 'VISÃO GESTOR';
    if (viewMode === 'INSTITUTION_MEMBER') subLabel = 'VISÃO MEMBRO';

    return {
      label: subLabel,
      badgeColor: 'border-cyan-500/40 text-cyan-400 bg-[#0a0f16] shadow-[0_0_15px_rgba(6,182,212,0.15)]',
      icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />
    };
  }, [adminViewMode, impersonatedUser, viewMode]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "flex items-center gap-2.5 rounded-xl font-black h-10 px-3.5 min-w-[150px] md:min-w-[210px] border-2 group transition-all text-xs tracking-wider",
                triggerDisplay.badgeColor
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {triggerDisplay.icon}
                <span className="truncate uppercase font-black tracking-[0.18em]">
                  {triggerDisplay.label}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 ml-auto shrink-0 transition-transform group-hover:translate-y-0.5" />
            </Button>
          }
        />
        <DropdownMenuContent 
          align="end" 
          className="w-80 rounded-2xl p-2 bg-[#0a0f16] border border-slate-800 shadow-2xl backdrop-blur-xl z-[100] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Status */}
          <div className="px-3 py-2.5 border-b border-slate-800/80 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Painel de Governança
                </span>
              </div>
              <Badge variant="outline" className="text-[9px] bg-cyan-950/40 border-cyan-500/30 text-cyan-400 font-mono">
                admin: true
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Controle de perspectivas e inspeção de perfis B2C/B2B
            </p>
          </div>

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-3 py-1">
              Visualizações Primárias
            </DropdownMenuLabel>

            {/* Option 1: Visão Global da Plataforma */}
            <DropdownMenuItem 
              onClick={handleSwitchToGlobal}
              className={cn(
                "rounded-xl cursor-pointer gap-3 font-medium py-2.5 px-3 text-slate-200 hover:bg-slate-800/50 focus:bg-slate-800/50 transition-all group mb-1 border border-transparent",
                adminViewMode === 'GLOBAL' && "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Visão Global (Todos)</span>
                  {adminViewMode === 'GLOBAL' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[10px] text-slate-400 truncate">Métricas e tarefas de todos os usuários</span>
              </div>
            </DropdownMenuItem>

            {/* Option 2: Inspecionar Usuário Específico (Combobox Trigger) */}
            <DropdownMenuItem 
              onClick={() => setIsSearchDialogOpen(true)}
              className={cn(
                "rounded-xl cursor-pointer gap-3 font-medium py-2.5 px-3 text-slate-200 hover:bg-slate-800/50 focus:bg-slate-800/50 transition-all group mb-1 border border-transparent",
                adminViewMode === 'USER' && "bg-amber-950/40 border-amber-500/30 text-amber-300"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <Search className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Inspecionar Usuário...</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-[10px] text-slate-400 truncate">
                  {impersonatedUser ? `Ativo: ${impersonatedUser.name}` : 'Buscar por nome, e-mail ou empresa'}
                </span>
              </div>
            </DropdownMenuItem>

            {/* Option 3: Minha Conta (Admin Master) */}
            <DropdownMenuItem 
              onClick={handleResetToSelf}
              className={cn(
                "rounded-xl cursor-pointer gap-3 font-medium py-2.5 px-3 text-slate-200 hover:bg-slate-800/50 focus:bg-slate-800/50 transition-all group mb-1 border border-transparent",
                adminViewMode === 'SELF' && viewMode === null && "bg-cyan-950/40 border-cyan-500/30 text-cyan-300"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                <RotateCcw className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Minha Conta (Admin)</span>
                  {adminViewMode === 'SELF' && viewMode === null && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="text-[10px] text-slate-400 truncate">Restaurar fluxo normal de trabalho</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-slate-800/60 my-1" />

          {/* Quick Perspective simulation when on own account */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-3 py-1">
              Simular Permissões (Minha Conta)
            </DropdownMenuLabel>
            
            <DropdownMenuItem 
              onClick={() => { setAdminViewMode('SELF'); setImpersonatedUser(null); setViewMode('PERSONAL'); }}
              className={cn(
                "rounded-lg cursor-pointer py-2 px-3 text-xs text-slate-300 hover:bg-slate-800/40 flex items-center gap-2",
                adminViewMode === 'SELF' && viewMode === 'PERSONAL' && "text-blue-400 font-bold bg-blue-950/20"
              )}
            >
              <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Visão Pessoal (B2C)</span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => { setAdminViewMode('SELF'); setImpersonatedUser(null); setViewMode('INSTITUTION_OWNER'); }}
              className={cn(
                "rounded-lg cursor-pointer py-2 px-3 text-xs text-slate-300 hover:bg-slate-800/40 flex items-center gap-2",
                adminViewMode === 'SELF' && viewMode === 'INSTITUTION_OWNER' && "text-purple-400 font-bold bg-purple-950/20"
              )}
            >
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Visão Gestor (B2B Admin)</span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => { setAdminViewMode('SELF'); setImpersonatedUser(null); setViewMode('INSTITUTION_MEMBER'); }}
              className={cn(
                "rounded-lg cursor-pointer py-2 px-3 text-xs text-slate-300 hover:bg-slate-800/40 flex items-center gap-2",
                adminViewMode === 'SELF' && viewMode === 'INSTITUTION_MEMBER' && "text-amber-400 font-bold bg-amber-950/20"
              )}
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Visão Membro (B2B Membro)</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {onRefreshClaims && (
            <>
              <DropdownMenuSeparator className="bg-slate-800/60 my-1" />
              <div className="p-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSyncClaims}
                  disabled={isSyncingClaims}
                  className="w-full justify-center gap-2 text-[10px] text-slate-400 hover:text-cyan-400 h-8 rounded-lg"
                >
                  <RefreshCw className={cn("w-3 h-3", isSyncingClaims && "animate-spin text-cyan-400")} />
                  <span>{isSyncingClaims ? 'Sincronizando Claims...' : 'Sincronizar Custom Claims'}</span>
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Combobox Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="max-w-2xl bg-[#0a0f16] border-slate-800 text-slate-100 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-amber-400" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight text-white">
                Inspecionar Perspectiva de Usuário
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 text-xs">
              Selecione qualquer usuário ou membro cadastrado na plataforma para visualizar o OHEL exatamente da perspectiva dele (modo somente leitura / auditoria).
            </DialogDescription>
          </DialogHeader>

          {/* Search Box & Type Filter */}
          <div className="space-y-3 my-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Buscar por nome, e-mail ou nome da organização..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-900/80 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl focus:border-amber-500/50"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={userTypeFilter === 'ALL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setUserTypeFilter('ALL')}
                className="h-7 text-[11px] rounded-lg px-3"
              >
                Todos ({counts.all})
              </Button>
              <Button
                variant={userTypeFilter === 'PERSONAL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setUserTypeFilter('PERSONAL')}
                className="h-7 text-[11px] rounded-lg px-3"
              >
                B2C Pessoal ({counts.personal})
              </Button>
              <Button
                variant={userTypeFilter === 'INSTITUTIONAL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setUserTypeFilter('INSTITUTIONAL')}
                className="h-7 text-[11px] rounded-lg px-3"
              >
                B2B Institucional ({counts.institutional})
              </Button>
            </div>
          </div>

          {/* User Results List */}
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum usuário encontrado</p>
                <p className="text-xs text-slate-600 mt-1">Tente ajustar o termo da busca ou os filtros de tipo.</p>
              </div>
            ) : (
              filteredUsers.map((targetUser) => {
                const isPersonal = !targetUser.institutionId && (targetUser.type === 'personal' || targetUser.profileType === 'PERSONAL');
                const instName = targetUser.institutionId ? institutionMap.get(targetUser.institutionId) : null;
                const isCurrentImpersonated = impersonatedUser?.id === targetUser.id;

                return (
                  <div
                    key={targetUser.id}
                    onClick={() => handleSelectUser(targetUser)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-900/90 transition-all border border-transparent",
                      isCurrentImpersonated ? "bg-amber-950/30 border-amber-500/40" : "hover:border-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm shrink-0">
                        {targetUser.photoURL ? (
                          <img src={targetUser.photoURL} alt={targetUser.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (targetUser.name?.[0] || targetUser.email?.[0] || 'U').toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {targetUser.name || 'Sem nome'}
                          </p>
                          {targetUser.isPlatformAdmin && (
                            <Badge variant="outline" className="text-[9px] bg-cyan-950/50 border-cyan-500/40 text-cyan-400 py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {targetUser.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="text-right">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] uppercase font-bold",
                            isPersonal 
                              ? "bg-blue-950/40 border-blue-500/30 text-blue-300" 
                              : "bg-purple-950/40 border-purple-500/30 text-purple-300"
                          )}
                        >
                          {isPersonal ? 'B2C Pessoal' : (instName || 'B2B Institucional')}
                        </Badge>
                        <p className="text-[10px] text-slate-500 mt-0.5 capitalize">
                          {targetUser.role?.toLowerCase() || 'Membro'}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrentImpersonated ? "default" : "outline"}
                        className={cn(
                          "h-8 text-xs font-bold rounded-lg gap-1.5",
                          isCurrentImpersonated 
                            ? "bg-amber-600 hover:bg-amber-700 text-white" 
                            : "border-slate-700 hover:border-amber-500/50 hover:text-amber-400"
                        )}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isCurrentImpersonated ? 'Ativo' : 'Inspecionar'}</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

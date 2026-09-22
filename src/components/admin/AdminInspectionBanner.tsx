import React from 'react';
import { User } from '@/types';
import { Eye, Globe, X, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AdminInspectionBannerProps {
  impersonatedUser: User;
  onExit: () => void;
  onOpenSelector: () => void;
  onSwitchToGlobal: () => void;
}

export const AdminInspectionBanner: React.FC<AdminInspectionBannerProps> = ({
  impersonatedUser,
  onExit,
  onOpenSelector,
  onSwitchToGlobal,
}) => {
  const isPersonal = !impersonatedUser.institutionId && (impersonatedUser.type === 'personal' || impersonatedUser.profileType === 'PERSONAL');

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border-b border-amber-500/40 px-4 py-2 text-amber-100 flex flex-wrap items-center justify-between gap-3 shadow-lg sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
          <Eye className="w-4 h-4 text-amber-300 animate-pulse" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-amber-300 uppercase tracking-wider">
            Modo Inspeção Ativo (Auditoria):
          </span>
          <span className="text-white font-medium">
            {impersonatedUser.name || 'Usuário'}
          </span>
          <span className="text-amber-300/70 hidden sm:inline">
            ({impersonatedUser.email})
          </span>
          <Badge variant="outline" className="bg-amber-900/60 border-amber-400/50 text-amber-200 text-[10px] uppercase font-bold py-0">
            {isPersonal ? 'B2C Pessoal' : 'B2B Institucional'}
          </Badge>
          <span className="text-[10px] text-amber-300/80 hidden md:inline">
            • Ações de alteração são bloqueadas para proteção dos dados do usuário.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSelector}
          className="h-7 text-xs bg-amber-900/50 border-amber-500/40 text-amber-200 hover:bg-amber-800/60 hover:text-white rounded-lg gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Trocar Perfil</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onSwitchToGlobal}
          className="h-7 text-xs bg-amber-900/50 border-amber-500/40 text-amber-200 hover:bg-amber-800/60 hover:text-white rounded-lg gap-1.5 hidden sm:inline-flex"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Visão Global</span>
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={onExit}
          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Sair da Inspeção</span>
        </Button>
      </div>
    </div>
  );
};

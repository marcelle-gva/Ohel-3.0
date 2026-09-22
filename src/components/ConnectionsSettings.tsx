import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, KeyRound, Home, Crown, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlanType } from '@/types';

interface ConnectionsSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageHousehold?: () => void;
  onManagePillarConnections?: () => void;
}

/**
 * "Preciso de um local onde insiro tokens de outras possíveis instituições
 * para membrar caso já tenha o sistema" — the quick "add a token" dialog.
 * Managing the household itself (invite code, accepting pending members,
 * per-member roles) lives in HouseholdPanel; this dialog just links there
 * via onManageHousehold instead of duplicating that UI.
 * Also hosts the root-only plan-preview selector (2026-09-17: "visão global
 * é do root" + "visualização através de seleção de todos os planos").
 */
export const ConnectionsSettings: React.FC<ConnectionsSettingsProps> = ({ open, onOpenChange, onManageHousehold, onManagePillarConnections }) => {
  const {
    user, isPlatformAdmin, joinHousehold, linkUserToInstitution, validateInviteCode,
    viewAsPlanOverride, setViewAsPlanOverride,
  } = useAuth();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCode = async () => {
    if (!code.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const result = await validateInviteCode(code.trim());
      if (!result.valid || !result.type) {
        toast.error(result.error || 'Código inválido.');
        return;
      }
      if (result.type === 'HOUSEHOLD') {
        await joinHousehold(user.uid, code.trim());
      } else {
        await linkUserToInstitution(user.uid, code.trim());
      }
      setCode('');
    } catch {
      // toasts already shown inside the auth context helpers
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Casas e Instituições
          </DialogTitle>
          <DialogDescription>
            Adicione um novo vínculo com um código de convite, ou gerencie sua própria Casa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Adicionar novo token */}
          <div className="space-y-2">
            <Label htmlFor="new-connection-code" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Adicionar com código de convite
            </Label>
            <div className="flex gap-2">
              <Input
                id="new-connection-code"
                placeholder="Ex: OHEL-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest"
                disabled={isSubmitting}
              />
              <Button onClick={handleAddCode} disabled={isSubmitting || !code.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Funciona tanto pra outra Casa (família) quanto pra outra Instituição — o sistema identifica sozinho.
            </p>
          </div>

          {/* Gerenciar minha casa (código, membros pendentes, papéis) */}
          {onManageHousehold && (
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => {
                onOpenChange(false);
                onManageHousehold();
              }}
            >
              <Home className="w-4 h-4 text-purple-600" />
              Gerenciar minha Casa (convidar, aceitar membros, papéis)
            </Button>
          )}

          {onManagePillarConnections && (
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => {
                onOpenChange(false);
                onManagePillarConnections();
              }}
            >
              <Link2 className="w-4 h-4 text-primary" />
              Compartilhar um pilar com alguém de fora (médico, contador...)
            </Button>
          )}

          {/* Root-only plan preview */}
          {isPlatformAdmin && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                Simular plano (só você vê — não afeta cobrança real)
              </Label>
              <Select
                value={viewAsPlanOverride || 'REAL'}
                onValueChange={(v) => setViewAsPlanOverride(v === 'REAL' ? null : (v as PlanType))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plano real" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REAL">Plano real (sem simulação)</SelectItem>
                  <SelectItem value="PERSONAL_BASIC">Simular: Pessoal Básico</SelectItem>
                  <SelectItem value="PERSONAL_PLUS">Simular: Pessoal Plus</SelectItem>
                  <SelectItem value="INSTITUTION_BASIC">Simular: Institucional Básico</SelectItem>
                  <SelectItem value="INSTITUTION_PLUS">Simular: Institucional Plus</SelectItem>
                </SelectContent>
              </Select>
              {viewAsPlanOverride && (
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                  Visualizando como {viewAsPlanOverride.replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};


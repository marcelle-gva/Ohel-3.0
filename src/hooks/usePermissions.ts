import { useMemo } from 'react';
import { User } from '@/types';
import { ViewMode } from '@/context/AuthContext';
import { contextFromGroup, type UserContext, MENU_RULES, hasMinPlan, canSeeModelos, canSeeVideoCall } from '@/config/permissions';

export interface Permissions {
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isMember: boolean;
  isPersonal: boolean;
  isInstitutionOwner: boolean;
  canManageTeam: boolean;
  canManageGroups: boolean;
  canCreateMissions: boolean;
  canAuthorizeMissions: boolean;
  canManageFinances: boolean;
  canDelegateTasks: boolean;
  canViewAuditLogs: boolean;
  displayRoleLabel: string;
  context: UserContext;
}

export function usePermissions(
  user: User | null | undefined,
  viewMode: ViewMode = null
): Permissions {
  return useMemo(() => {
    const legacyUser = user as any;
    const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
    const effectiveGroup = {
      type: legacyUser?.institutionId ? 'CNPJ' : 'CPF',
      planType: legacyUser?.planType || legacyUser?.subscription?.planType || 'PERSONAL_BASIC',
    };
    const context = contextFromGroup(effectiveGroup, {
      isPlatformAdmin,
      activeGroupId: legacyUser?.activeGroupId ?? legacyUser?.institutionId ?? legacyUser?.householdId ?? null,
      ownedGroupIds: legacyUser?.ownedGroupIds,
      memberOfGroupIds: legacyUser?.memberOfGroupIds,
    });

    const isPersonal = context.context === 'pessoal';
    const isInstitutionOwner = context.context === 'profissional';
    const isManager = isPlatformAdmin || isInstitutionOwner;
    const isMember = !isManager && !isPersonal;

    return {
      isPlatformAdmin,
      isAdmin: isPlatformAdmin || isInstitutionOwner,
      isManager,
      isMember,
      isPersonal,
      isInstitutionOwner,
      canManageTeam: isPlatformAdmin || isManager,
      canManageGroups: isPlatformAdmin || isManager,
      canCreateMissions: canSeeModelos(context) || isManager,
      canAuthorizeMissions: isPlatformAdmin || isManager,
      canManageFinances: isPlatformAdmin || isManager || isPersonal,
      canDelegateTasks: isPlatformAdmin || isManager || isPersonal,
      canViewAuditLogs: isPlatformAdmin || isManager,
      displayRoleLabel: isPlatformAdmin ? 'Master Admin' : isInstitutionOwner ? 'Gestor' : 'Pessoal',
      context,
    };
  }, [user, viewMode]);
}


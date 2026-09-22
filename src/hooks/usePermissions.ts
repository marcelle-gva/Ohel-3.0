import { useMemo } from 'react';
import { User } from '@/types';
import { ViewMode } from '@/context/AuthContext';

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
}

export function usePermissions(
  user: User | null | undefined, 
  viewMode: ViewMode = null
): Permissions {
  return useMemo(() => {
    if (!user) {
      return {
        isPlatformAdmin: false,
        isAdmin: false,
        isManager: false,
        isMember: false,
        isPersonal: true,
        isInstitutionOwner: false,
        canManageTeam: false,
        canManageGroups: false,
        canCreateMissions: false,
        canAuthorizeMissions: false,
        canManageFinances: false,
        canDelegateTasks: false,
        canViewAuditLogs: false,
        displayRoleLabel: 'Visitante',
      };
    }

    const isPlatformAdmin = Boolean(user.isPlatformAdmin);

    const role = user.role || 'MEMBER';
    const hasInstitution = Boolean(user.institutionId);

    // ViewMode override handling
    let effectiveType = user.type;
    let effectiveRole = role;

    if (viewMode === 'PERSONAL') {
      effectiveType = 'personal';
    } else if (viewMode === 'INSTITUTION_OWNER') {
      effectiveType = 'institution_owner';
      effectiveRole = role === 'ADMIN' ? 'ADMIN' : 'MANAGER';
    } else if (viewMode === 'INSTITUTION_MEMBER') {
      effectiveType = 'institution_member';
      effectiveRole = 'MEMBER';
    }

    const isPersonal = 
      viewMode === 'PERSONAL' || 
      (viewMode === null && (effectiveType === 'personal' || !hasInstitution));

    const isInstitutionOwner = 
      viewMode === 'INSTITUTION_OWNER' || 
      (viewMode === null && (effectiveType === 'institution_owner' || effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER'));

    const isAdmin = isPlatformAdmin || effectiveRole === 'ADMIN';
    const isManager = isPlatformAdmin || effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER';
    const isMember = !isManager && hasInstitution;

    // Capability matrix
    const canManageTeam = isPlatformAdmin || isAdmin || isManager;
    const canManageGroups = isPlatformAdmin || isAdmin || isManager;
    const canCreateMissions = isPlatformAdmin || isAdmin || isManager;
    const canAuthorizeMissions = isPlatformAdmin || isAdmin || isManager;
    const canManageFinances = isPlatformAdmin || isAdmin || isManager || isPersonal;
    const canDelegateTasks = isPlatformAdmin || isAdmin || isManager || isPersonal;
    const canViewAuditLogs = isPlatformAdmin || isManager;

    let displayRoleLabel = 'Pessoal';
    if (isPlatformAdmin) {
      displayRoleLabel = 'Master Admin';
    } else if (effectiveRole === 'ADMIN') {
      displayRoleLabel = 'Administrador';
    } else if (effectiveRole === 'MANAGER') {
      displayRoleLabel = 'Gestor';
    } else if (isMember) {
      displayRoleLabel = 'Membro';
    }

    return {
      isPlatformAdmin,
      isAdmin,
      isManager,
      isMember,
      isPersonal,
      isInstitutionOwner,
      canManageTeam,
      canManageGroups,
      canCreateMissions,
      canAuthorizeMissions,
      canManageFinances,
      canDelegateTasks,
      canViewAuditLogs,
      displayRoleLabel,
    };
  }, [user, viewMode]);
}

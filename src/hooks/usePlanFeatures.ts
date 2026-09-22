import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PlanFeature, PlanType, planHasFeature } from '@/types';

/**
 * Single source of truth for "can the CURRENT context use this Plus
 * feature". Reads the plan from whichever Household/Institution is active
 * in the profile switcher (never from the logged-in user directly, since
 * the plan lives on the context per the 2026-09-17 decision), with the
 * root-only preview override layered on top.
 */
export function usePlanFeatures() {
  const { memberships, activeContextType, activeContextId, viewAsPlanOverride, isPlatformAdmin } = useAuth();

  const effectivePlanType: PlanType | null = useMemo(() => {
    if (isPlatformAdmin && viewAsPlanOverride) return viewAsPlanOverride as PlanType;
    if (activeContextType === 'PERSONAL') return null; // bare-personal has no Plus features (must be inside a Household)
    const active = memberships.find(
      (m) => m.contextType === activeContextType && m.contextId === activeContextId
    );
    return (active?.planType as PlanType) || null;
  }, [memberships, activeContextType, activeContextId, viewAsPlanOverride, isPlatformAdmin]);

  const has = (feature: PlanFeature) => planHasFeature(effectivePlanType, feature);

  return {
    effectivePlanType,
    hasVideoCalls: has('VIDEO_CALLS'),
    hasTaskTemplates: has('TASK_TEMPLATES'),
    hasAttachments: has('ATTACHMENTS'),
    hasPhotoAlbum: has('PHOTO_ALBUM'),
    isPlus: effectivePlanType === 'PERSONAL_PLUS' || effectivePlanType === 'INSTITUTION_PLUS',
  };
}

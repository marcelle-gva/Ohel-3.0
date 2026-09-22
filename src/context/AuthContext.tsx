import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, query, collectionGroup, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

type ProfileType = 'personal' | 'institutional' | null;

export type ViewMode = 'PERSONAL' | 'INSTITUTION_OWNER' | 'INSTITUTION_MEMBER' | null;

// The "Netflix profile" the user currently has active. PERSONAL has no id
// (it's just "my own stuff"); HOUSEHOLD/INSTITUTION always carry the id of
// the household/institution doc that context's data is scoped to.
export type ContextType = 'PERSONAL' | 'HOUSEHOLD' | 'INSTITUTION';

export interface MembershipSummary {
  contextType: 'HOUSEHOLD' | 'INSTITUTION';
  contextId: string;
  name: string;
  profileName?: string; // household only ("Marido", "Esposa"...)
  role: string;
  planType?: string;
  taskApprovalRequired?: boolean; // institution only — used by TaskForm to know if delegated tasks need PENDING_APPROVAL
}

export interface InviteValidationResult {
  valid: boolean;
  type?: 'HOUSEHOLD' | 'INSTITUTION';
  id?: string;
  name?: string;
  planType?: string;
  error?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: any | null;
  loading: boolean;
  profileType: ProfileType;
  setProfileType: (type: ProfileType) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  validateInviteCode: (code: string) => Promise<InviteValidationResult>;
  linkUserToInstitution: (userId: string, code: string) => Promise<void>;
  joinHousehold: (userId: string, code: string, profileName?: string) => Promise<void>;
  customClaims: Record<string, any> | null;
  refreshClaims: () => Promise<void>;
  isPlatformAdmin: boolean;
  // "Netflix profile" switcher — everything the current person can act as.
  memberships: MembershipSummary[];
  activeContextType: ContextType;
  activeContextId: string | null;
  switchContext: (contextType: ContextType, contextId?: string | null) => void;
  // Root-only: preview the app as if under a different plan, without
  // touching any real Subscription/Household/Institution doc.
  viewAsPlanOverride: string | null;
  setViewAsPlanOverride: (planType: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [customClaims, setCustomClaims] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return localStorage.getItem('viewMode') as ViewMode || null;
  });
  const [profileType, setProfileType] = useState<ProfileType>(() => {
    return localStorage.getItem('userType') as ProfileType;
  });
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [activeContextType, setActiveContextType] = useState<ContextType>(() => {
    return (localStorage.getItem('activeContextType') as ContextType) || 'PERSONAL';
  });
  const [activeContextId, setActiveContextId] = useState<string | null>(() => {
    return localStorage.getItem('activeContextId') || null;
  });
  const [viewAsPlanOverride, setViewAsPlanOverrideState] = useState<string | null>(() => {
    return localStorage.getItem('viewAsPlanOverride') || null;
  });

  const setViewAsPlanOverride = (planType: string | null) => {
    setViewAsPlanOverrideState(planType);
    if (planType) localStorage.setItem('viewAsPlanOverride', planType);
    else localStorage.removeItem('viewAsPlanOverride');
  };

  const switchContext = (contextType: ContextType, contextId: string | null = null) => {
    setActiveContextType(contextType);
    setActiveContextId(contextId);
    localStorage.setItem('activeContextType', contextType);
    if (contextId) localStorage.setItem('activeContextId', contextId);
    else localStorage.removeItem('activeContextId');
    // Persist so the app reopens on the same profile next time, per the
    // "Netflix profile" requirement — best-effort, doesn't block the switch.
    if (auth.currentUser) {
      updateDoc(doc(db, 'users', auth.currentUser.uid), {
        lastActiveContextType: contextType,
        lastActiveContextId: contextId,
      }).catch(() => {});
    }
  };

  // Every household/institution this person can act as a profile in.
  // `members` is the subcollection name under BOTH households/{id} and
  // institutions/{id}; collectionGroup('members') returns both, so we tell
  // them apart by which id field the member doc actually carries.
  useEffect(() => {
    if (!user) {
      setMemberships([]);
      return;
    }
    let isMounted = true;
    const q = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, async (snapshot) => {
      const results: MembershipSummary[] = [];
      for (const memberDoc of snapshot.docs) {
        const data = memberDoc.data();
        if (data.status && data.status !== 'ACTIVE') continue;
        const isHousehold = 'householdId' in data;
        const contextId = isHousehold ? data.householdId : data.institutionId;
        if (!contextId) continue;
        try {
          const parentDoc = await getDoc(doc(db, isHousehold ? 'households' : 'institutions', contextId));
          results.push({
            contextType: isHousehold ? 'HOUSEHOLD' : 'INSTITUTION',
            contextId,
            name: parentDoc.exists() ? (parentDoc.data() as any).name : contextId,
            profileName: data.profileName,
            role: data.role,
            planType: parentDoc.exists() ? (parentDoc.data() as any).planType : undefined,
            taskApprovalRequired: parentDoc.exists() ? (parentDoc.data() as any).taskApprovalRequired : undefined,
          });
        } catch {
          // Parent doc unreadable (e.g. rules edge case) — skip it rather
          // than crash the whole switcher.
        }
      }
      if (isMounted) setMemberships(results);
    }, (error) => {
      console.warn('Memberships snapshot notice:', error?.message || error);
    });
    return () => { isMounted = false; unsub(); };
  }, [user]);

  const refreshClaims = async () => {
    if (!auth.currentUser) return;
    try {
      const currentToken = await auth.currentUser.getIdToken();
      // Ask backend to sync claims if authorized
      try {
        await fetch('/api/admin/sync-admin-claims', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({ uid: auth.currentUser.uid, email: auth.currentUser.email })
        });
      } catch (err) {
        console.warn('Backend claim sync check skipped:', err);
      }

      // Force refresh JWT token to receive claims on the client
      const refreshedResult = await auth.currentUser.getIdTokenResult(true);
      setCustomClaims(refreshedResult.claims);
      if (refreshedResult.claims.admin) {
        setUserData((prev: any) => prev ? { ...prev, isPlatformAdmin: true } : prev);
      }
    } catch (e) {
      console.warn('Error refreshing custom claims:', e);
    }
  };

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode) {
      localStorage.setItem('viewMode', mode);
      // Automatically sync profileType when switching viewMode
      if (mode === 'PERSONAL') {
        updateProfileType('personal');
      } else {
        updateProfileType('institutional');
      }
    } else {
      localStorage.removeItem('viewMode');
    }
  };

  const updateProfileType = (type: ProfileType) => {
    setProfileType(type);
    if (type) {
      localStorage.setItem('userType', type);
    } else {
      localStorage.removeItem('userType');
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Capture any redirect result if the user was authenticated via signInWithRedirect
        try {
          const redirectRes = await getRedirectResult(auth);
          if (redirectRes?.user) {
            console.log('Redirect sign-in successful for:', redirectRes.user.email);
          }
        } catch (redirectErr: any) {
          console.warn('Redirect sign-in check notice:', redirectErr?.message);
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (!isMounted) return;
          
          if (currentUser) {
            try {
              // Fetch token result and claims
              const tokenResult = await currentUser.getIdTokenResult();
              if (isMounted) setCustomClaims(tokenResult.claims);

              // Background claim sync for admin user
              currentUser.getIdToken().then(tok => {
                fetch('/api/admin/sync-admin-claims', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tok}`
                  },
                  body: JSON.stringify({ uid: currentUser.uid, email: currentUser.email })
                }).then(r => r.json()).then(res => {
                  if (res?.admin && isMounted) {
                    currentUser.getIdTokenResult(true).then(refreshed => {
                      if (isMounted) {
                        setCustomClaims(refreshed.claims);
                        setUserData((prev: any) => prev ? { ...prev, isPlatformAdmin: true } : prev);
                      }
                    });
                  }
                }).catch(() => {});
              });

              const userDocRef = doc(db, 'users', currentUser.uid);
              
              // Use onSnapshot for real-time user data
              const unsubDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  
                  // Ensure custom claims admin aligns with Firestore doc
                  if (tokenResult.claims.admin && !data.isPlatformAdmin) {
                    updateDoc(userDocRef, { isPlatformAdmin: true }).catch(console.error);
                  }

                  setUserData(data);
                  
                  const savedViewMode = localStorage.getItem('viewMode');
                  const savedUserType = localStorage.getItem('userType');
                  if (data?.institutionId && savedViewMode !== 'PERSONAL' && savedUserType !== 'personal') {
                    updateProfileType('institutional');
                  }
                } else {
                    // Handle doc creation logic if not exists
                  const handleCreation = async () => {
                    const pendingType = localStorage.getItem('pending_profile_type') as ProfileType;
                    const pendingInvite = localStorage.getItem('pending_invite_code');
                    const pendingPlan = localStorage.getItem('pending_plan_type');

                    const newUserType: 'personal' | 'institution_owner' | 'institution_member' = 
                      pendingType === 'institutional' ? (pendingInvite ? 'institution_member' : 'institution_owner') : 'personal';

                    const isBootstrapAdmin = currentUser.email === 'marcelle.gomesvieira.ayres@gmail.com' || currentUser.email === 'admin@ohel.app';
                    await setDoc(userDocRef, {
                      id: currentUser.uid,
                      name: currentUser.displayName || 'Usuário',
                      email: currentUser.email,
                      role: isBootstrapAdmin ? 'ADMIN' : (newUserType === 'institution_owner' ? 'ADMIN' : 'MEMBER'),
                      type: newUserType,
                      planType: pendingPlan || 'BASIC',
                      isPlatformAdmin: isBootstrapAdmin || Boolean(tokenResult.claims.admin),
                      activeModules: ['matrix', 'focus', 'personal', 'financial', 'family', 'professional', 'spiritual'],
                      createdAt: serverTimestamp()
                    });

                    if (pendingPlan) {
                      const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
                      await setDoc(doc(db, 'subscriptions', currentUser.uid), {
                        userId: currentUser.uid,
                        planType: pendingPlan,
                        status: 'TRIAL',
                        trialEndsAt,
                        expiresAt: trialEndsAt,
                        profileType: pendingType || 'personal',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                      }, { merge: true }).catch(console.warn);
                    }
                    
                    if (pendingInvite && pendingType === 'institutional') {
                      const pendingInviteKind = localStorage.getItem('pending_invite_kind'); // 'HOUSEHOLD' | 'INSTITUTION'
                      if (pendingInviteKind === 'HOUSEHOLD') {
                        await joinHousehold(currentUser.uid, pendingInvite);
                      } else {
                        await linkUserToInstitution(currentUser.uid, pendingInvite);
                      }
                      localStorage.removeItem('pending_invite_kind');
                    }

                    if (pendingType) {
                      updateProfileType(pendingType);
                    }
                    
                    localStorage.removeItem('pending_profile_type');
                    localStorage.removeItem('pending_invite_code');
                    localStorage.removeItem('pending_plan_type');
                  };
                  handleCreation();
                }
              }, (error) => {
                console.warn('User doc snapshot notice:', error?.message || error);
              });

              setUser(currentUser);
            } catch (error) {
              console.error('Error fetching user data:', error);
            }
          } else {
            setUser(null);
            setUserData(null);
            setCustomClaims(null);
            updateProfileType(null);
          }
          
          if (isMounted) setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) setLoading(false);
      }
    };

    const authUnsubscribePromise = initializeAuth();

    return () => {
      isMounted = false;
      authUnsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    provider.addScope('email');
    provider.addScope('profile');

    try {
      // Store profile type if it's set before login
      if (profileType) {
        localStorage.setItem('pending_profile_type', profileType);
      }
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.warn('Google login attempt notice:', error?.code, error?.message);

      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        toast.error(
          `Domínio não autorizado (${currentDomain}). Adicione este domínio no Firebase Console > Authentication > Configurações > Domínios Autorizados.`,
          { duration: 12000 }
        );
      } else if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        toast.info('Popup bloqueado. Redirecionando para login seguro com Google...', { duration: 4000 });
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          toast.error('Erro no redirecionamento: ' + (redirectErr.message || 'Tente novamente.'));
        }
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.info('Janela de login fechada antes da conclusão.');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('O login com Google não está ativado no Firebase Console deste projeto.');
      } else {
        toast.error('Erro ao entrar com Google: ' + (error.message || 'Verifique sua conexão.'));
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const validateInviteCode = async (code: string): Promise<InviteValidationResult> => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      const res = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) return { valid: false, error: data.error || 'Código inválido.' };
      return { valid: true, type: data.type, id: data.id, name: data.name, planType: data.planType };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Erro ao validar código.' };
    }
  };

  const linkUserToInstitution = async (userId: string, code: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/institution/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao vincular instituição.');

      await updateDoc(doc(db, 'users', userId), {
        institutionId: data.id,
        role: 'MEMBER',
        profileType: 'INSTITUTIONAL',
      });
      switchContext('INSTITUTION', data.id);
      toast.success(`Vinculado a ${data.name}!`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao vincular instituição.');
      throw error;
    }
  };

  // Join a Household as a member/profile (e.g. spouse or child accepting an
  // invite). Creates the households/{id}/members/{uid} doc; the rules
  // require status starting as PENDING here (the owner or someone with
  // MANAGE_MEMBERS accepts it), matching the invite-then-accept flow
  // described for "Preciso que o perfil da minha família seja identificado
  // e realizado o convite para vincular."
  const joinHousehold = async (userId: string, code: string, profileName?: string) => {
    try {
      const result = await validateInviteCode(code);
      if (!result.valid || result.type !== 'HOUSEHOLD' || !result.id) {
        throw new Error(result.error || 'Código de casa inválido.');
      }
      await setDoc(doc(db, 'households', result.id, 'members', userId), {
        householdId: result.id,
        userId,
        profileName: profileName || auth.currentUser?.displayName || 'Membro',
        role: 'ADULT',
        permissions: [],
        status: 'PENDING', // owner/manager must accept before this becomes ACTIVE
        joinedAt: serverTimestamp(),
      });
      toast.success(`Convite enviado para ${result.name}. Aguardando aceite.`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao entrar na casa.');
      throw error;
    }
  };

  const isPlatformAdmin = Boolean(
    user?.email === 'marcelle.gomesvieira.ayres@gmail.com' ||
    user?.email === 'admin@ohel.app' ||
    userData?.isPlatformAdmin || 
    userData?.role === 'ADMIN' ||
    customClaims?.admin
  );

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      profileType, 
      setProfileType: updateProfileType, 
      viewMode,
      setViewMode: updateViewMode,
      loginWithGoogle, 
      logout,
      validateInviteCode,
      linkUserToInstitution,
      joinHousehold,
      customClaims,
      refreshClaims,
      isPlatformAdmin,
      memberships,
      activeContextType,
      activeContextId,
      switchContext,
      viewAsPlanOverride,
      setViewAsPlanOverride,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

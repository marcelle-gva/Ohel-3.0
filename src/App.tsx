import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, EisenhowerQuadrant, Module, Institution, User, UserGroup, MODULES, Mission, Ranking, LogisticsAddress, Message, QUADRANT_LABELS, Comment, TaskTemplate, FamilyEvent, getPlanLimits, resolvePlanType } from '@/types';
import { EisenhowerMatrix } from '@/components/EisenhowerMatrix';
import { TaskForm } from '@/components/TaskForm';
import { TaskDetails } from '@/components/TaskDetails';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { ModuleManagement } from '@/components/ModuleManagement';
import { InstitutionPanel } from '@/components/InstitutionPanel';
import { PlanSelector } from '@/components/PlanSelector';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  TooltipProvider,
  Tooltip as TooltipUI,
  TooltipTrigger,
  TooltipContent,
  Toaster,
  toast,
  Button,
  Badge,
  Card,
  Textarea,
  Label
} from '@/components/ui';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Bell, 
  User as UserIcon,
  Timer,
  Layers,
  Building2,
  CreditCard,
  Menu,
  X,
  AlertTriangle,
  Zap,
  Moon,
  Sun,
  Trophy,
  MapPin,
  MessageSquare,
  Camera,
  ChevronDown,
  Users,
  ClipboardList,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPillarAccentStyle } from '@/lib/pillarTheme';
import { ContextSwitcher } from '@/components/ContextSwitcher';
import { ConnectionsSettings } from '@/components/ConnectionsSettings';
import { HouseholdPanel } from '@/components/HouseholdPanel';
import { RankingView } from '@/components/RankingView';
import { CommandPalette } from '@/components/CommandPalette';
import { PillarConnectionsPanel } from '@/components/PillarConnectionsPanel';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
  limit,
  or
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthSelector } from '@/components/AuthSelector';
import { useAuth, ViewMode } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { SpiritualModule } from '@/components/SpiritualModule';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationsPage } from '@/components/NotificationsPage';
import { Heart } from 'lucide-react';

import { Dashboard } from '@/components/Dashboard';
import { MissionsView } from '@/components/MissionsView';
import { LogisticsView } from '@/components/LogisticsView';
import { MessagesView } from '@/components/MessagesView';
import { TemplatesView } from '@/components/TemplatesView';

import { OrdemNoCaos } from '@/components/OrdemNoCaos';
import { ProfessionalModule } from '@/components/ProfessionalModule';
import { PersonalModule } from '@/components/PersonalModule';
import { FitnessModule } from '@/components/FitnessModule';
import { LibraryModule } from '@/components/LibraryModule';
import { PersonalFinanceModule } from '@/components/PersonalFinanceModule';
import { DocumentsModule } from '@/components/DocumentsModule';
import { OhelAgentView } from '@/components/OhelAgentView';
import { VideoCall } from '@/components/VideoCall';
import { CalendarView } from '@/components/CalendarView';
import { ProfilePage } from '@/components/ProfilePage';
import { BookOpen, Home, Activity, Briefcase, Calendar as CalendarIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ShieldCheck, Video as VideoIcon, Sparkles, Globe } from 'lucide-react';
import { AdminProfileSwitcher, AdminPerspectiveMode } from '@/components/admin/AdminProfileSwitcher';
import { AdminInspectionBanner } from '@/components/admin/AdminInspectionBanner';
import { GlobalPlatformDashboard } from '@/components/admin/GlobalPlatformDashboard';

import { InstitutionLayout } from '@/components/institution/InstitutionLayout';
import { PlatformAdminPanel } from '@/components/PlatformAdminPanel';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuGroup,
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const INITIAL_TASKS: Task[] = [];
const APP_VERSION = '2026.04.20.1510'; // Controle de Versão OHEL

type View = 'dashboard' | 'matrix' | 'stats' | 'modules' | 'institution' | 'household' | 'ranking' | 'pillar-connections' | 'plans' | 'finance' | 'spiritual' | 'notifications' | 'ordem-no-caos' | 'familiar' | 'profissional' | 'biblioteca' | 'fitness' | 'calendar' | 'missions' | 'logistics' | 'messages' | 'profile' | 'admin-panel' | 'video-call' | 'templates' | 'documentos' | 'agent' | 'global-platform';

export default function App() {
  const { 
    user, 
    userData: authUserData, 
    loading: authLoading, 
    logout, 
    profileType, 
    setProfileType, 
    viewMode, 
    setViewMode,
    isPlatformAdmin,
    customClaims,
    refreshClaims,
    activeContextType,
    activeContextId,
  } = useAuth();
  const { theme, setTheme } = useTheme();

  // Version Check Notification
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('ohel_app_version');
    if (lastSeenVersion && lastSeenVersion !== APP_VERSION) {
      setTimeout(() => {
        toast.info('Sistema Atualizado!', {
          description: `O OHEL foi atualizado para a versão ${APP_VERSION}. Aproveite as melhorias!`,
          duration: 6000,
          position: 'top-right',
        });
      }, 1000);
    }
    localStorage.setItem('ohel_app_version', APP_VERSION);
  }, []);

  // Sync Firestore theme preference with ThemeProvider
  useEffect(() => {
    if (authUserData?.themePreference && authUserData.themePreference !== theme) {
      setTheme(authUserData.themePreference as any);
    }
  }, [authUserData?.themePreference, theme, setTheme]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [familyEvents, setFamilyEvents] = useState<FamilyEvent[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [lastRankPosition, setLastRankPosition] = useState<number | null>(null);
  const [modules, setModules] = useState<Module[]>(MODULES);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [taskDialogTitle, setTaskDialogTitle] = useState<string>('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<EisenhowerQuadrant | undefined>();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [showConnectionsSettings, setShowConnectionsSettings] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // "Ctrl+K de verdade" (2026-09-20) — funciona em qualquer tela, não só
  // quando o campo de busca do header está focado.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const [userData, setUserData] = useState<any>(null);
  const [institution, setInstitution] = useState<Institution | undefined>();
  const [subscription, setSubscription] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusFilter, setFocusFilter] = useState<'TOTAL' | 'IMEDIATO'>('TOTAL');
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [taskToCompleteId, setTaskToCompleteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [adminViewMode, setAdminViewMode] = useState<AdminPerspectiveMode>('SELF');
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [allPlatformUsers, setAllPlatformUsers] = useState<User[]>([]);
  const [allPlatformTasks, setAllPlatformTasks] = useState<Task[]>([]);

  const isMaster = Boolean(
    isPlatformAdmin || 
    authUserData?.isPlatformAdmin || 
    userData?.isPlatformAdmin || 
    customClaims?.admin === true
  );

  const baseUserData = impersonatedUser || userData || authUserData;
  const effectiveUserData = baseUserData;
  
  const isPersonal = viewMode === 'PERSONAL' || (viewMode === null && (effectiveUserData?.type === 'personal' || !effectiveUserData?.institutionId));
  const isInstitutionOwner = viewMode === 'INSTITUTION_OWNER' || (viewMode === null && (effectiveUserData?.type === 'institution_owner' || effectiveUserData?.role === 'ADMIN'));
  const isMember = viewMode === 'INSTITUTION_MEMBER' || (viewMode === null && (effectiveUserData?.institutionId && effectiveUserData?.role === 'MEMBER'));
  
  const effectiveUser = effectiveUserData ? {
    ...effectiveUserData,
    type: isPersonal ? 'personal' : (isInstitutionOwner ? 'institution_owner' : 'institution_member'),
    role: isInstitutionOwner ? 'ADMIN' : (isMember ? 'MEMBER' : effectiveUserData.role),
    viewOverride: viewMode !== null || Boolean(impersonatedUser)
  } : null;

  // Template Handlers
  const handleCreateTemplate = async (data: Partial<TaskTemplate>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'task_templates'), {
        ...data,
        userId: user.uid,
        institutionId: effectiveUser?.institutionId || null,
        createdAt: Date.now()
      });
      toast.success('Modelo criado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'task_templates');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'task_templates', id));
      toast.success('Modelo removido.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `task_templates/${id}`);
    }
  };

  // Fetch Task Templates
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'task_templates'),
      or(
        where('userId', '==', user.uid),
        where('institutionId', '==', effectiveUser?.institutionId || 'no-inst')
      )
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const templatesData: TaskTemplate[] = [];
      snapshot.forEach((doc) => {
        templatesData.push({ id: doc.id, ...doc.data() } as TaskTemplate);
      });
      setTaskTemplates(templatesData);
    });
    return () => unsubscribe();
  }, [user, effectiveUser?.institutionId]);

  // Automatic Trial Activation (Personal & Institutional)
  useEffect(() => {
    const pendingPlan = localStorage.getItem('pending_plan_type');
    const pendingProfile = localStorage.getItem('pending_profile_type');
    if (user && authUserData && pendingPlan) {
      const isPersonal = pendingPlan.startsWith('PERSONAL_') || pendingProfile === 'personal';
      
      if (isPersonal) {
        const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        setDoc(doc(db, 'subscriptions', user.uid), {
          userId: user.uid,
          planType: pendingPlan,
          status: 'TRIAL',
          trialEndsAt: trialEndsAt,
          expiresAt: trialEndsAt,
          profileType: 'personal'
        }, { merge: true }).then(() => {
          localStorage.removeItem('pending_plan_type');
          localStorage.removeItem('pending_profile_type');
          setViewMode('PERSONAL');
          setProfileType('personal');
          toast.success(`Parabéns! Seu Plano Pessoal com 30 dias de Teste Grátis foi ativado.`);
        }).catch((err) => {
          console.error('Error activating personal trial:', err);
        });
      } else if (!authUserData.institutionId) {
        const createTrialInstitution = async () => {
          try {
            const newInstId = `inst-${user.uid.substring(0, 5)}_${Date.now()}`;
            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
            
            const batch = writeBatch(db);
            
            batch.set(doc(db, 'institutions', newInstId), {
              id: newInstId,
              name: `Instituição de ${user.displayName || 'Membro'}`,
              inviteCode: inviteCode,
              planType: pendingPlan,
              subscriptionStatus: 'TRIAL',
              trialEndsAt: trialEndsAt,
              createdAt: serverTimestamp(),
              createdBy: user.uid
            });
            
            batch.set(doc(db, 'institutions', newInstId, 'members', user.uid), {
              userId: user.uid,
              role: 'ADMIN',
              status: 'ACTIVE',
              joinedAt: serverTimestamp()
            });
            
            batch.update(doc(db, 'users', user.uid), {
              institutionId: newInstId,
              role: 'ADMIN'
            });
            
            batch.set(doc(db, 'subscriptions', user.uid), {
              userId: user.uid,
              planType: pendingPlan,
              status: 'TRIAL',
              expiresAt: trialEndsAt
            }, { merge: true });
            
            await batch.commit();
            localStorage.removeItem('pending_plan_type');
            localStorage.removeItem('pending_profile_type');
            setViewMode('INSTITUTION_OWNER');
            setProfileType('institutional');
            toast.success(`Parabéns! Sua Instituição foi criada com 30 dias de Teste Grátis no plano ${pendingPlan}.`);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'institutions');
          }
        };
        createTrialInstitution();
      }
    }
  }, [user, authUserData, setProfileType, setViewMode]);

  // Phase 10: Trial Notifications
  useEffect(() => {
    if (!institution?.trialEndsAt) return;

    const checkTrialStatus = () => {
      const now = Date.now();
      const diffDays = Math.ceil((institution.trialEndsAt - now) / (1000 * 60 * 60 * 24));
      
      const notifiedKey = `notified_trial_${institution.id}_${diffDays}`;
      if (localStorage.getItem(notifiedKey)) return;

      if (diffDays === 7) {
        toast.info('Seu teste grátis termina em 7 dias!', {
          description: 'Aproveite para explorar todos os recursos do OHEL.',
          duration: 10000
        });
        localStorage.setItem(notifiedKey, 'true');
      } else if (diffDays === 1) {
        toast.warning('Atenção: Amanhã começa sua cobrança!', {
          description: 'Seu período de teste grátis termina em 24h.',
          duration: 15000
        });
        localStorage.setItem(notifiedKey, 'true');
      }
    };

    checkTrialStatus();
  }, [institution]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoURL, setLogoURL] = useState(localStorage.getItem('ohel_custom_logo') || '');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: dataUrl
        });
        toast.success('Foto de perfil atualizada!');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    };
    reader.readAsDataURL(file);
  };
  const [professionalDefaultTab, setProfessionalDefaultTab] = useState('team');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('isSidebarCollapsed') === 'true';
  });

  const currentPlan = resolvePlanType(subscription?.planType);
  const limits = getPlanLimits(currentPlan);
  const isLimitReached = tasks.length >= (limits?.tasks ?? Infinity);

  // Firestore Real-time Sync
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!user) return;

    const qMessages = query(
      collection(db, 'messages'), 
      or(where('senderId', '==', user.uid), where('receiverId', '==', user.uid)),
      orderBy('createdAt', 'asc')
    );
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    return () => {
      unsubMessages();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qRankings = query(collection(db, 'rankings'), orderBy('points', 'desc'), limit(10));
    const unsub = onSnapshot(qRankings, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ranking));
      setRankings(data);
      
      const myPos = data.findIndex(r => r.userId === user.uid) + 1;
      
      // If we have a position and it's different from the last one
      if (myPos > 0 && lastRankPosition !== null && myPos !== lastRankPosition) {
        const movedUp = myPos < lastRankPosition;
        addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          type: 'RANKING_CHANGE',
          title: movedUp ? 'Subiu no Ranking! 🚀' : 'Alteração no Ranking',
          message: movedUp 
            ? `Parabéns! Você subiu para a ${myPos}ª posição no ranking.`
            : `Sua posição no ranking mudou para ${myPos}ª. Continue focado!`,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(e => console.error('Error creating ranking notification:', e));
      }
      
      if (myPos > 0) {
        setLastRankPosition(myPos);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rankings'));
    
    // Sync All Institutions, Users, and Tasks (Platform Admin only)
    let unsubscribeAllInst: (() => void) | null = null;
    let unsubscribeAllUsers: (() => void) | null = null;
    let unsubscribeAllTasks: (() => void) | null = null;

    if (isMaster) {
      const qInst = query(collection(db, 'institutions'), orderBy('createdAt', 'desc'));
      unsubscribeAllInst = onSnapshot(qInst, (snapshot) => {
        setInstitutions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Institution)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'institutions'));

      const qUsers = query(collection(db, 'users'), limit(500));
      unsubscribeAllUsers = onSnapshot(qUsers, (snapshot) => {
        setAllPlatformUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(1000));
      unsubscribeAllTasks = onSnapshot(qTasks, (snapshot) => {
        setAllPlatformTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));
    }

    return () => {
      unsub();
      if (unsubscribeAllInst) unsubscribeAllInst();
      if (unsubscribeAllUsers) unsubscribeAllUsers();
      if (unsubscribeAllTasks) unsubscribeAllTasks();
    };
  }, [user, lastRankPosition, isMaster]);

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(
      collection(db, 'tasks'),
      or(
        where('userId', '==', user.uid),
        where('assignedTo', 'array-contains', user.uid),
        where('visibleToUsers', 'array-contains', user.uid)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    // Sync Subscription
    const unsubscribeSub = onSnapshot(doc(db, 'subscriptions', user.uid), (snap) => {
      if (snap.exists()) {
        setSubscription(snap.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `subscriptions/${user.uid}`));

    // Sync Family Events
    const familyQuery = query(collection(db, 'personal_family'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubscribeFamily = onSnapshot(familyQuery, (snap) => {
      setFamilyEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyEvent)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_family'));

    let unsubscribeInst: (() => void) | null = null;
    let unsubscribeMembers: (() => void) | null = null;
    let unsubscribeUsers: (() => void) | null = null;
    let unsubscribeGroups: (() => void) | null = null;

    const userDoc = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        
        // If userData has a theme preference, ensure ThemeProvider is in sync
        // Note: App doesn't call setTheme here to avoid loop if ThemeProvider handled it,
        // but we want the CSS classes to be correct.
        // Actually ThemeProvider's useEffect handles classes based on its state.
        // If we want to sync Firestore -> Provider, we do it in a separate effect or here.
 
        if (data.activeModules) {
          setModules(prev => prev.map(m => ({ ...m, active: data.activeModules.includes(m.id) })));
        }
 
        if (data.institutionId) {
          // Cleanup previous institution listeners if ID changed
          if (unsubscribeInst) unsubscribeInst();
          if (unsubscribeMembers) unsubscribeMembers();
          if (unsubscribeUsers) unsubscribeUsers();
          if (unsubscribeGroups) unsubscribeGroups();

          // Sync Institution
          unsubscribeInst = onSnapshot(doc(db, 'institutions', data.institutionId), (instSnap) => {
            if (instSnap.exists()) {
              setInstitution({ id: instSnap.id, ...instSnap.data() } as Institution);
            }
          }, (error) => handleFirestoreError(error, OperationType.GET, `institutions/${data.institutionId}`));
 
          // Sync Members
          const membersQuery = collection(db, 'institutions', data.institutionId, 'members');
          unsubscribeMembers = onSnapshot(membersQuery, async (membersSnap) => {
            const usersQuery = query(
              collection(db, 'users'),
              where('institutionId', '==', data.institutionId)
            );
            
            if (unsubscribeUsers) unsubscribeUsers();
            unsubscribeUsers = onSnapshot(usersQuery, (uSnap) => {
              const membersData = uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
              setUsers(membersData);
            }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
          }, (error) => handleFirestoreError(error, OperationType.LIST, `institutions/${data.institutionId}/members`));

          // Sync Groups
          const groupsQuery = query(collection(db, 'groups'), where('institutionId', '==', data.institutionId));
          unsubscribeGroups = onSnapshot(groupsQuery, (gSnap) => {
            setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup)));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'groups'));
        }
      } else {
        setDoc(userDoc, {
          id: user.uid,
          name: user.displayName || 'Usuário',
          email: user.email,
          role: 'MEMBER',
          activeModules: MODULES.filter(m => m.active).map(m => m.id)
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubscribeTasks();
      unsubscribeUser();
      unsubscribeSub();
      unsubscribeFamily();
      if (unsubscribeInst) unsubscribeInst();
      if (unsubscribeMembers) unsubscribeMembers();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeGroups) unsubscribeGroups();
    };
  }, [user]);

  const [searchQuery, setSearchQuery] = useState('');

  const displayTasks = useMemo(() => {
    if (impersonatedUser) {
      return allPlatformTasks.filter(t => 
        t.userId === impersonatedUser.id || 
        (t.assignedTo && Array.isArray(t.assignedTo) && t.assignedTo.includes(impersonatedUser.id)) ||
        (t.visibleToUsers && Array.isArray(t.visibleToUsers) && t.visibleToUsers.includes(impersonatedUser.id))
      );
    }
    return tasks;
  }, [impersonatedUser, allPlatformTasks, tasks]);

  const filteredTasks = displayTasks.filter(t => {
    const search = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.moduleId?.toLowerCase().includes(search) ||
      t.assignedByName?.toLowerCase().includes(search) ||
      t.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  });

  const addTask = async (data: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Usuário não autenticado");
      return;
    }

    console.log("Iniciando criação de tarefa. Data:", data);
    console.log("Usuário atual UID:", currentUser.uid);

    try {
      // Ensure user profile exists (fix for new users)
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      let currentInstitutionalId = userData?.institutionId || userSnap.data()?.institutionId || null;
      let currentUserRole = userData?.role || userSnap.data()?.role || 'MEMBER';
      
      if (!userSnap.exists()) {
        console.log("Perfil não encontrado no Firestore, criando perfil básico para:", currentUser.uid);
        const newUserProfile = {
          id: currentUser.uid,
          name: currentUser.displayName || 'Usuário',
          email: currentUser.email,
          role: 'MEMBER' as const,
          activeModules: ['matrix', 'focus'],
          createdAt: serverTimestamp(),
          lastTaskCreatedAt: null,
          burstCount: 0
        };
        await setDoc(userRef, newUserProfile);
        currentUserRole = 'MEMBER';
      }

      const isDelegated = (data.assignedTo && data.assignedTo.length > 0) || (data.assignedToGroups && data.assignedToGroups.length > 0);
      console.log("Tarefa delegada?", isDelegated);

      if (isLimitReached && !isDelegated) {
        console.warn("Limite de tarefas atingido para o plano atual.");
        setIsUpgradeDialogOpen(true);
        return;
      }

      const batch = writeBatch(db);
      const taskRef = doc(collection(db, 'tasks'));
      const taskId = taskRef.id;
      const ticketNumber = `OH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Burst Rate Limit Logic (Safely handle potentially missing lastTaskCreatedAt)
      const userDocData = userSnap.data();
      const lastTs = (userData?.lastTaskCreatedAt || userDocData?.lastTaskCreatedAt)?.toMillis ? 
                    (userData?.lastTaskCreatedAt || userDocData?.lastTaskCreatedAt).toMillis() : 0;
      const now = Date.now();
      const isReset = now > lastTs + 10000;

      console.log("Rate Limit Check - LastTs:", lastTs, "isReset:", isReset);

      // Update user's rate limit state
      batch.update(userRef, {
        lastTaskCreatedAt: serverTimestamp(),
        burstCount: isReset ? 1 : increment(1)
      });

      const isProfessional = data.moduleId === 'profissional';
      const legacyNeedsApproval = isProfessional && currentUserRole === 'MEMBER';
      // TaskForm (2026-09-17 rewrite) now computes contextType/contextId/
      // assignedBy/status itself, since only it knows which Casa/Instituição
      // was picked and whether that institution requires approval. Other,
      // not-yet-migrated callers of addTask() (quick-add shortcuts elsewhere
      // in this file) don't send those fields, so we fall back to the old
      // moduleId-based heuristic for them rather than breaking them.
      const contextType = data.contextType || (isDelegated || isProfessional ? 'INSTITUTION' : 'PERSONAL');
      const contextId = data.contextId ?? (contextType === 'INSTITUTION' ? currentInstitutionalId : null);
      const resolvedStatus = data.status || (legacyNeedsApproval ? 'PENDING_APPROVAL' : (isDelegated ? 'ASSIGNED' : 'PENDING'));
      const needsApproval = resolvedStatus === 'PENDING_APPROVAL';
      const resolvedAssignedBy = data.assignedBy !== undefined ? data.assignedBy : (isDelegated ? currentUser.uid : null);

      const taskData = {
        ...data,
        id: taskId,
        ticketNumber,
        userId: currentUser.uid,
        status: resolvedStatus,
        completed: false,
        createdAt: serverTimestamp(),
        type: isDelegated || isProfessional ? 'INSTITUTIONAL' : 'PERSONAL',
        contextType,
        contextId,
        assignedBy: resolvedAssignedBy,
        assignedByName: resolvedAssignedBy ? (currentUser.displayName || 'Admin') : null,
        assignedTo: data.assignedTo || [],
        assignedToGroups: data.assignedToGroups || [],
        institutionId: currentInstitutionalId,
        viewed: false,
        read: false,
        targetDate: new Date().toISOString().split('T')[0],
        deadlineAt: data.deadlineAt ?? null, // Use nullish coalescing
        recurringFrequency: data.recurringFrequency ?? null,
      };

      // Intelligence: Link to Finance if triggered
      if (data.financeInfo) {
        const financeRef = doc(collection(db, 'personal_finance'));
        batch.set(financeRef, {
          userId: currentUser.uid,
          amount: data.financeInfo.amount || 0,
          description: `Ref: ${data.title}`,
          type: data.financeInfo.type,
          pillar: data.financeInfo.pillar,
          date: serverTimestamp(),
          taskId: taskId
        });
      }

      // Remove undefined fields and intelligence-only fields from the main task
      const { financeInfo, ...coreData } = taskData as any;
      const cleanedTaskData = Object.fromEntries(
        Object.entries(coreData)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, v === undefined ? null : v])
      );

      console.log("Enviando tarefa limpa para o Firestore:", cleanedTaskData);

      batch.set(taskRef, cleanedTaskData);

      // Audit Log
      const logRef = doc(db, 'audit_logs', `${taskId}_create`);
      batch.set(logRef, {
        userId: currentUser.uid,
        action: 'CREATE_TASK',
        resource: `tasks/${taskId}`,
        timestamp: serverTimestamp(),
        details: { title: data.title }
      });

      if (isDelegated && !needsApproval) {
        data.assignedTo?.forEach((targetUserId: string) => {
          if (targetUserId !== currentUser.uid) {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: targetUserId,
              type: 'TASK_DELEGATED',
              title: 'Nova Tarefa Delegada',
              message: `${currentUser.displayName || 'Um administrador'} delegou a tarefa "${data.title}" para você. (Ticket: ${ticketNumber})`,
              read: false,
              resourceId: taskId,
              senderId: currentUser.uid,
              senderName: currentUser.displayName || 'Admin',
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      const creatorNotifRef = doc(collection(db, 'notifications'));
      batch.set(creatorNotifRef, {
        userId: currentUser.uid,
        type: 'TASK_CREATED',
        title: 'Nova Tarefa Criada',
        message: `Você criou a tarefa "${data.title}" com sucesso. Ticket: ${ticketNumber}`,
        read: false,
        resourceId: taskId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      console.log("Lote comitado com sucesso!");
      setIsDialogOpen(false);
      toast.success(needsApproval ? 'Tarefa enviada para aprovação!' : (isDelegated ? 'Tarefa delegada com sucesso!' : 'Tarefa criada com sucesso!'));
    } catch (error) {
      console.error("Erro fatal ao salvar tarefa:", error);
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const updateTask = async (updatedTask: Task) => {
    try {
      const { id, ...data } = updatedTask;
      // Filter out fields that shouldn't be updated or need special handling
      const { createdAt, ...updateData } = data as any;
      await updateDoc(doc(db, 'tasks', id), updateData);
      
      if (selectedTask?.id === id) setSelectedTask(updatedTask);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${updatedTask.id}`);
    }
  };

  const updateTaskQuadrant = async (taskId: string, newQuadrant: EisenhowerQuadrant) => {
    const oldTasks = [...tasks];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    // Optimistic Update
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], quadrant: newQuadrant };
    setTasks(updatedTasks);

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        quadrant: newQuadrant
      });
    } catch (error) {
      setTasks(oldTasks); // Rollback on error
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  // Phase 9: Deadline Notifications
  useEffect(() => {
    if (!user || tasks.length === 0) return;

    const checkDeadlines = async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // 1. Move expired tasks to NOW
      const tasksExpired = tasks.filter(t => {
        if (!t.deadlineAt || t.completed || t.quadrant === 'urgent-important') return false;
        return t.deadlineAt < today.getTime();
      });

      for (const t of tasksExpired) {
        updateDoc(doc(db, 'tasks', t.id), { quadrant: 'urgent-important' })
          .then(() => toast.info(`Vencimento: "${t.title}" movida para FAZER AGORA.`))
          .catch(e => console.error(e));
      }

      // 2. Notify tomorrow deadlines
      const tasksDueTomorrow = tasks.filter(t => {
        if (!t.deadlineAt || t.completed) return false;
        const d = new Date(t.deadlineAt);
        return d >= tomorrow && d < dayAfterTomorrow;
      });

      for (const task of tasksDueTomorrow) {
        const notificationId = `deadline_${task.id}_${tomorrow.getTime()}`;
        const notifiedKey = `notified_${notificationId}`;
        
        if (localStorage.getItem(notifiedKey)) continue;

        // Notify current user via toast
        toast.info(`Prazo amanhã: ${task.title}`, {
          description: "Esta tarefa expira em 24h.",
          duration: 10000
        });

        // Create notification documents in Firestore for the assigned user and the manager (if institutional)
        try {
          const recips = new Set(task.assignedTo || []);
          recips.add(task.userId);
          if (task.delegatedBy) recips.add(task.delegatedBy);

          for (const recipientId of recips) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipientId,
              title: 'Tarefa Próxima do Prazo',
              message: `A tarefa "${task.title}" vence amanhã.`,
              taskId: task.id,
              type: 'DEADLINE_REMINDER',
              createdAt: serverTimestamp(),
              read: false
            });
          }
        } catch (err) {
          console.error('Falha ao criar notificações:', err);
        }
        
        localStorage.setItem(notifiedKey, 'true');
      }
    };

    const interval = setInterval(checkDeadlines, 1000 * 60 * 60); // Check every hour
    checkDeadlines();
    return () => clearInterval(interval);
  }, [user, tasks]);

  const finalizeTaskCompletion = async (taskId: string, note?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const updates: any = {
        completed: true,
        status: 'COMPLETED',
        completedAt: Date.now(),
        updatedAt: serverTimestamp()
      };

      if (note && note.trim()) {
        const newComment: Comment = {
          id: Math.random().toString(36).substring(2, 11),
          text: `[NOTA DE CONCLUSÃO]: ${note}`,
          userId: user.uid,
          userName: userData?.name || user.displayName || 'Usuário',
          createdAt: Date.now()
        };
        updates.comments = [...(task.comments || []), newComment];
      }

      await updateDoc(doc(db, 'tasks', taskId), updates);
      
      // Create Notification if completed and was delegated (logic copied from toggleTask)
      if (task.assignedBy && task.assignedBy !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: task.assignedBy,
          type: 'TASK_COMPLETED',
          title: 'Tarefa Concluída',
          message: `${user.displayName || 'Um membro'} concluiu a tarefa "${task.title}".`,
          read: false,
          resourceId: taskId,
          senderId: user.uid,
          senderName: user.displayName || 'Membro',
          createdAt: serverTimestamp(),
        });
      }
      
      setIsCompletionDialogOpen(false);
      setTaskToCompleteId(null);
      setCompletionNote('');
      toast.success('Tarefa concluída com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await updateDoc(doc(db, 'tasks', id), {
        completed: !task.completed,
        status: !task.completed ? 'COMPLETED' : 'PENDING'
      });

      // Create Notification if completed and was delegated
      if (!task.completed && task.assignedBy && task.assignedBy !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: task.assignedBy,
          type: 'TASK_COMPLETED',
          title: 'Tarefa Concluída',
          message: `${user.displayName || 'Um membro'} concluiu a tarefa "${task.title}".`,
          read: false,
          resourceId: id,
          senderId: user.uid,
          senderName: user.displayName || 'Membro',
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      // Delete Task
      batch.delete(doc(db, 'tasks', id));

      // Audit Log with predictable ID for rules
      const logRef = doc(db, 'audit_logs', `${id}_delete`);
      batch.set(logRef, {
        userId: user.uid,
        action: 'DELETE_TASK',
        resource: `tasks/${id}`,
        timestamp: serverTimestamp(),
        details: { taskId: id }
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const openAddTask = (quadrant?: EisenhowerQuadrant, data?: { title: string; description: string; quadrant: EisenhowerQuadrant; moduleId: string }) => {
    if (data) {
      addTask(data);
      return;
    }
    setActiveQuadrant(quadrant);
    setIsDialogOpen(true);
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setIsDetailsOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsEditing(true);
  };

  const handleSaveEditedTask = async (data: any) => {
    if (!taskToEdit) return;
    try {
      await updateDoc(doc(db, 'tasks', taskToEdit.id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
      setTaskToEdit(null);
      toast.success('Tarefa atualizada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskToEdit.id}`);
    }
  };

  const handleEditTaskInCalendar = async (taskId: string, newDate: number) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        dueDate: newDate,
        updatedAt: serverTimestamp()
      });
      toast.success('Data da tarefa atualizada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const toggleModule = async (id: string) => {
    if (!user) return;
    
    // Check module limit
    const activeCount = modules.filter(m => m.active).length;
    const isActivating = !modules.find(m => m.id === id)?.active;
    
    if (isActivating && activeCount >= limits.modules) {
      setIsUpgradeDialogOpen(true);
      return;
    }

    const newModules = modules.map(m => m.id === id ? { ...m, active: !m.active } : m);
    setModules(newModules);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        activeModules: newModules.filter(m => m.active).map(m => m.id)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogout = () => logout();

  const handleUpgrade = async (planId?: string) => {
    if (!user) return;
    
    const targetPlan = planId || 'PRO';

    // Se for plano institucional customizado (INSTITUTION_ADVANCED)
    if (targetPlan === 'INSTITUTION_ADVANCED') {
      window.open('https://wa.me/5511999999999?text=Ol%C3%A1,%20gostaria%20de%20saber%20mais%20sobre%20o%20Plano%20Institucional%20Avan%C3%A7ado%20do%20OHEL', '_blank');
      toast.info('Abrindo canal de consultoria VIP para implantação institucional customizada.');
      return;
    }

    // 1. Atualização do Plano Institucional (quando gestor/dono de instituição)
    if (institution?.id && targetPlan.startsWith('INSTITUTION_')) {
      try {
        await updateDoc(doc(db, 'institutions', institution.id), { 
          planType: targetPlan,
          updatedAt: serverTimestamp()
        });
        toast.success(`Plano institucional alterado para ${targetPlan.replace(/_/g, ' ')} com sucesso!`);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `institutions/${institution.id}`);
      }
    }

    // 2. Atualização do Plano Pessoal / Ativação Direta de 30 Dias de Teste Grátis
    try {
      const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      
      await setDoc(doc(db, 'subscriptions', user.uid), {
        userId: user.uid,
        planType: targetPlan,
        status: 'TRIAL',
        trialEndsAt,
        expiresAt: trialEndsAt,
        profileType: isPersonal ? 'personal' : 'institutional',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await updateDoc(doc(db, 'users', user.uid), {
        planType: targetPlan,
        updatedAt: serverTimestamp()
      }).catch(() => {});

      if (institution?.id && !targetPlan.startsWith('PERSONAL_')) {
        await updateDoc(doc(db, 'institutions', institution.id), { 
          planType: targetPlan,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      }

      toast.success(`Plano ${targetPlan.replace(/_/g, ' ')} ativado com sucesso! 30 dias de teste grátis liberados.`);
      setIsUpgradeDialogOpen(false);
    } catch (dbErr: any) {
      console.warn('Erro ao atualizar plano no Firestore:', dbErr);
    }

    // 3. Opcional: Checkout Stripe caso exista backend configurado
    const apiUrl = import.meta.env.VITE_BACKEND_URL;
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/create-checkout-session`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            userId: user.uid,
            planId: targetPlan,
            trialDays: 30,
            isPersonal,
            institutionId: isPersonal ? null : institution?.id,
            email: user.email
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            window.location.href = data.url;
          }
        }
      } catch (error: any) {
        // Fallback silencioso pois o plano já foi ativado localmente no Firestore
        console.warn('Checkout remoto não invocado, teste ativado localmente.');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Phase 7: Protection of Routes
  if (!user) {
    return <AuthSelector />;
  }

  if (authLoading || (!userData && !authUserData)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Carregando sua jornada...</p>
        </div>
      </div>
    );
  }

  // If logged in but no profile type selected, force selection
  if (!profileType) {
    return <AuthSelector />;
  }

  // Phase 5: Test Mode for Institution
  if (window.location.pathname === '/test/institution') {
    return (
      <div className="p-8 space-y-8">
        <h1 className="text-3xl font-bold">Modo de Teste: Institucional</h1>
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p>Simulando: <strong>Membro de Instituição</strong></p>
          <p>UserType: <code>institution_member</code> (mapeado para <code>institutional</code> no sistema)</p>
        </div>
        <Button onClick={() => {
          localStorage.setItem('userType', 'institutional');
          window.location.reload();
        }}>
          Ativar Modo Institucional Real
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-bold mb-2">Dashboard Institucional</h3>
            <p className="text-sm text-muted-foreground mb-4">Teste o layout de 3 colunas e usuários online.</p>
            <Button variant="outline" onClick={() => setActiveView('dashboard')}>Ver Dashboard</Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold mb-2">Sistema de Tickets</h3>
            <p className="text-sm text-muted-foreground mb-4">Teste a delegação de tarefas e aceite/recusa.</p>
            <Button variant="outline" onClick={() => setActiveView('profissional')}>Ver Profissional</Button>
          </Card>
        </div>
      </div>
    );
  }

  // Phase 7: Block institutional routes for personal users
  if (profileType === 'personal' && (activeView === 'profissional' || activeView === 'institution')) {
    setActiveView('dashboard');
    toast.error('Acesso restrito a membros institucionais');
  }

  const handleTaskComplete = async (taskId: string, timeSpent: number) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: true,
        status: 'COMPLETED',
        timeSpent: increment(timeSpent),
        completedAt: Date.now()
      });
      setFocusedTaskId(null);
      toast.success('Tarefa concluída com sucesso!');

      // Award ranking points server-side (rules don't let the client write
      // to /rankings directly — see /api/rankings/award). Best-effort: if
      // this fails or there's no backend configured, the task is still
      // marked complete either way.
      const apiUrl = import.meta.env.VITE_BACKEND_URL;
      if (apiUrl && auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          await fetch(`${apiUrl}/rankings/award`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ taskId, points: 10 }),
          });
        } catch (rankErr) {
          console.warn('Ranking award skipped:', rankErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const quadrantStats = [
    { name: 'Fazer Agora', value: filteredTasks.filter(t => t.quadrant === 'urgent-important').length, color: '#ef4444' },
    { name: 'Agendar', value: filteredTasks.filter(t => t.quadrant === 'important-not-urgent').length, color: '#3b82f6' },
    { name: 'Delegar', value: filteredTasks.filter(t => t.quadrant === 'urgent-not-important').length, color: '#f59e0b' },
    { name: 'Eliminar', value: filteredTasks.filter(t => t.quadrant === 'not-urgent-not-important').length, color: '#64748b' },
  ];

  const completionStats = [
    { name: 'Concluídas', value: filteredTasks.filter(t => t.completed).length },
    { name: 'Pendentes', value: filteredTasks.filter(t => !t.completed).length },
  ];

  const moduleTimeStats = modules.map(m => {
    const moduleTasks = filteredTasks.filter(t => t.moduleId === m.id && t.completed && t.timeSpent);
    const avgTimeSeconds = moduleTasks.length > 0 
      ? Math.round(moduleTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) / moduleTasks.length)
      : 0;
    
    // Format for display: if > 60m, show hours, else minutes
    const value = avgTimeSeconds / 60; // base value in minutes for the chart
    const label = avgTimeSeconds < 3600 
      ? `${Math.round(avgTimeSeconds / 60)}m` 
      : `${(avgTimeSeconds / 3600).toFixed(1)}h`;

    return { name: m.name, value, label };
  }).filter(s => s.value > 0);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('isSidebarCollapsed', String(newState));
  };

  const plan = effectiveUserData?.planType as string || 'BASIC';

  const sidebarItems: { id: View; label: string; icon: any; isNew?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agent', label: 'Agente OHEL', icon: Sparkles, isNew: true },
    { id: 'calendar', label: 'Minhas Tarefas', icon: CalendarIcon },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare },
    { id: 'ordem-no-caos', label: 'Ordem no Caos', icon: Layers },
    { id: 'video-call', label: 'Chamada de Vídeo', icon: VideoIcon, isNew: true },
    { id: 'templates', label: 'Modelos de Tarefa', icon: ClipboardList, isNew: true },
    { id: 'documentos', label: 'Gestão Pessoal', icon: FileText },
  ];

  if (activeContextType !== 'PERSONAL' && activeContextId) {
    sidebarItems.push({ id: 'ranking', label: 'Ranking', icon: Trophy });
  }

  // Logic based on profile
  if (isPersonal) {
    // PERSONAL
    if (plan.includes('INTERMEDIATE')) {
      sidebarItems.push({ id: 'biblioteca', label: 'Biblioteca', icon: BookOpen });
    }
    if (plan.includes('ADVANCED')) {
      if (!sidebarItems.find(i => i.id === 'biblioteca')) sidebarItems.push({ id: 'biblioteca', label: 'Biblioteca', icon: BookOpen });
      if (!sidebarItems.find(i => i.id === 'missions')) sidebarItems.push({ id: 'missions', label: 'Missões', icon: Trophy });
    }
    sidebarItems.push({ id: 'plans', label: 'Planos', icon: CreditCard });
  } else if (isInstitutionOwner) {
    // INSTITUTION OWNER
    sidebarItems.push({ id: 'missions', label: 'Missões', icon: Trophy });
    sidebarItems.push({ id: 'biblioteca', label: 'Biblioteca', icon: BookOpen });
    sidebarItems.push({ id: 'logistics', label: 'Logística', icon: MapPin });
    sidebarItems.push({ id: 'notifications', label: 'Notificações', icon: Bell });
    sidebarItems.push({ id: 'institution', label: 'Gestão Institucional', icon: Building2 });
  } else if (isMember) {
    // MEMBER
    const hasPersonalUpgrade = subscription?.planType && subscription.planType !== 'BASIC';
    if (hasPersonalUpgrade) {
      // familiar removed
    }
    sidebarItems.push({ id: 'plans', label: 'Planos', icon: CreditCard });
  }

  // Master Overrides - Only apply extra items when in "Automatic" (Real) view
  // or keep specific essential admin tools
  if (isMaster) {
    if (!sidebarItems.find(i => i.id === 'global-platform')) {
      sidebarItems.unshift({ id: 'global-platform', label: 'Visão Global', icon: Globe, isNew: true });
    }
    if (viewMode === null && !impersonatedUser) {
      if (!sidebarItems.find(i => i.id === 'logistics')) sidebarItems.push({ id: 'logistics', label: 'Logística', icon: MapPin });
      if (!sidebarItems.find(i => i.id === 'notifications')) sidebarItems.push({ id: 'notifications', label: 'Notificações', icon: Bell });
      if (!sidebarItems.find(i => i.id === 'missions')) sidebarItems.push({ id: 'missions', label: 'Missões', icon: Trophy });
      if (!sidebarItems.find(i => i.id === 'biblioteca')) sidebarItems.push({ id: 'biblioteca', label: 'Biblioteca', icon: BookOpen });
      if (!sidebarItems.find(i => i.id === 'plans')) sidebarItems.push({ id: 'plans', label: 'Planos', icon: CreditCard });
      
      sidebarItems.push({ id: 'admin-panel', label: 'Painel Master', icon: ShieldCheck });
    }
  }

  return (
    <TooltipProvider>
      <div className="flex bg-background text-foreground min-h-screen relative overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r z-[101] md:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-primary w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold">
                    {logoURL ? <img src={logoURL} alt="Logo OHEL" className="w-full h-full object-cover" /> : 'O'}
                  </div>
                  <h1 className="text-xl font-bold tracking-tighter">OHEL</h1>
                </div>
                <Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
                {sidebarItems.map(item => {
                  const isActive = activeView === item.id;
                  return (
                    <Button 
                      key={item.id}
                      variant={isActive ? 'secondary' : 'ghost'} 
                      className={cn(
                        "w-full justify-start gap-3 h-12 rounded-xl px-4",
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 font-bold"
                          : "text-muted-foreground"
                      )}
                      onClick={() => {
                        setActiveView(item.id as View);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <item.icon className={cn("w-5 h-5", isActive && "text-primary-foreground")} />
                      <span className="font-semibold text-sm">{item.label}</span>
                    </Button>
                  );
                })}
              </nav>

              <div className="p-4 border-t space-y-2">
                <ThemeToggle userId={user?.uid} />
                <Button 
                  variant="ghost" 
                  onClick={handleLogout} 
                  className="w-full justify-start gap-3 text-destructive h-12 rounded-xl"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-semibold">Sair</span>
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className={cn(
        "border-r bg-muted/20 flex flex-col hidden md:flex transition-all duration-300 relative min-h-screen",
        isFocusMode ? "w-0 opacity-0 overflow-hidden border-none" : (isSidebarCollapsed ? "w-20" : "w-64")
      )}>
        {/* Toggle Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border bg-background shadow-md z-50 hover:bg-muted"
        >
          {isSidebarCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </Button>

        <div className={cn("p-6 flex flex-col gap-4", isSidebarCollapsed && "items-center px-0")}>
          <div className="flex items-center gap-3 relative group">
            <div className={cn(
              "bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20 glow-blue overflow-hidden transition-all relative shrink-0",
              isSidebarCollapsed ? "w-8 h-8" : "w-10 h-10"
            )}>
              {logoURL ? (
                <img src={logoURL} alt="Logo OHEL" className="w-full h-full object-cover" />
              ) : 'O'}
              
              {effectiveUserData?.role === 'ADMIN' && !isSidebarCollapsed && (
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const url = reader.result as string;
                        setLogoURL(url);
                        // Save to settings
                        try {
                          await setDoc(doc(db, 'settings', 'appearance'), { 
                            logoURL: url,
                            updatedBy: user.uid,
                            updatedAt: Date.now()
                          }, { merge: true });
                          toast.success('Logo da empresa atualizado!');
                        } catch (err) {
                          console.error(err);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h1 className="text-xl font-bold tracking-tighter leading-none">OHEL</h1>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest">SISTEMA DE GESTÃO</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {sidebarItems.map(item => {
            const isActive = activeView === item.id;
            const content = (
              <Button 
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'} 
                className={cn(
                  "w-full justify-start gap-3 transition-all h-10 group relative rounded-xl",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                  isSidebarCollapsed && "justify-center p-0"
                )}
                onClick={() => setActiveView(item.id as View)}
              >
                <item.icon className={cn(
                  "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                  isActive && "text-primary-foreground"
                )} />
                {!isSidebarCollapsed && <span className="truncate font-medium">{item.label}</span>}
                {!isSidebarCollapsed && item.isNew && (
                  <span className="ml-auto text-[8px] font-black bg-primary text-primary-foreground px-1 py-0.5 rounded leading-none animate-pulse">NOVO</span>
                )}
                {isSidebarCollapsed && isActive && (
                  <span className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </Button>
            );

            if (isSidebarCollapsed) {
              return (
                <React.Fragment key={item.id}>
                  <TooltipUI>
                    <TooltipTrigger 
                      render={content}
                    />
                    <TooltipContent side="right" className="font-bold flex items-center gap-2">
                      {item.label}
                      {item.isNew && (
                        <span className="text-[8px] bg-primary text-primary-foreground px-1 py-0.5 rounded leading-none">NOVO</span>
                      )}
                    </TooltipContent>
                  </TooltipUI>
                </React.Fragment>
              );
            }

            return content;
          })}
        </nav>

        <div className={cn("p-4 border-t space-y-1", isSidebarCollapsed && "px-2")}>
          <ThemeToggle userId={user?.uid} collapsed={isSidebarCollapsed} />

          {isSidebarCollapsed ? (
            <TooltipUI>
              <TooltipTrigger 
                render={
                  <Button 
                    variant="ghost" 
                    onClick={handleLogout} 
                    className="w-full justify-center p-0 h-10 text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                }
              />
              <TooltipContent side="right" className="font-bold">Sair</TooltipContent>
            </TooltipUI>
          ) : (
            <Button 
              variant="ghost" 
              onClick={handleLogout} 
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 h-10"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Inspection Banner when Admin is inspecting a specific user profile */}
        {impersonatedUser && (
          <AdminInspectionBanner
            impersonatedUser={impersonatedUser}
            onExit={() => {
              setImpersonatedUser(null);
              setAdminViewMode('SELF');
              setViewMode(null);
              toast.info('Modo de inspeção finalizado. Retornado ao seu perfil.');
            }}
            onOpenSelector={() => {}}
            onSwitchToGlobal={() => {
              setImpersonatedUser(null);
              setAdminViewMode('GLOBAL');
              setActiveView('global-platform');
            }}
          />
        )}

        {/* Header */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-md z-10 transition-all sticky top-0",
          isFocusMode && "h-0 opacity-0 overflow-hidden border-none"
        )}>
          <div className="flex items-center gap-3 md:gap-6 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            
            <div className="relative max-w-sm w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar tarefas, módulos, pessoas..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsCommandPaletteOpen(true)}
                className="w-full pl-10 pr-14 py-2 bg-[#0a0f16] border border-slate-800 rounded-full text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all placeholder:text-slate-600 text-slate-200"
              />
              {searchQuery ? (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground border border-border rounded px-1.5 py-0.5 pointer-events-none">
                  {navigator.platform?.toLowerCase().includes('mac') ? '⌘K' : 'CTRL+K'}
                </kbd>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* OHEL MASTER PERSPECTIVE SELECTOR & GLOBAL SWITCHER */}
            {isMaster && (
              <AdminProfileSwitcher
                allUsers={allPlatformUsers}
                institutions={institutions}
                adminViewMode={adminViewMode}
                setAdminViewMode={(mode) => {
                  setAdminViewMode(mode);
                  if (mode === 'GLOBAL') {
                    setImpersonatedUser(null);
                    setActiveView('global-platform');
                  } else if (mode === 'SELF') {
                    setImpersonatedUser(null);
                  }
                }}
                impersonatedUser={impersonatedUser}
                setImpersonatedUser={(targetUser) => {
                  setImpersonatedUser(targetUser);
                  if (targetUser) {
                    setAdminViewMode('IMPERSONATION');
                    setActiveView('dashboard');
                    toast.success(`Inspecionando conta de ${targetUser.name || targetUser.email}`);
                  } else {
                    setAdminViewMode('SELF');
                  }
                }}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onSelectGlobalView={() => {
                  setAdminViewMode('GLOBAL');
                  setImpersonatedUser(null);
                  setActiveView('global-platform');
                }}
                customClaims={customClaims}
                onRefreshClaims={refreshClaims}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveView('agent')}
              className="flex items-center gap-2 rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-wider bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 transition-all h-10 px-3.5 shadow-sm"
              title="Agente de Gestão OHEL"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" />
              <span className="hidden sm:inline">Agente IA</span>
            </Button>

            <NotificationBell userId={user.uid} onNavigate={setActiveView} />
            <div className="h-8 w-[1px] bg-border mx-2"></div>
            <ContextSwitcher onManageInvites={() => setShowConnectionsSettings(true)} />
            <div className="h-8 w-[1px] bg-border mx-2"></div>
            <div 
              className="flex items-center gap-3 pl-2 cursor-pointer hover:bg-muted/50 p-1 rounded-lg transition-colors group relative"
              onClick={() => setActiveView('profile')}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{userData?.name || user.displayName || 'Usuário'}</p>
                {subscription?.status === 'BLOCKED' ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveView('plans');
                    }} 
                    className="text-[10px] text-destructive font-bold hover:underline"
                  >
                    CONTA BLOQUEADA - RESOLVER
                  </button>
                ) : (
                  <p className="text-[10px] text-muted-foreground">{subscription?.planType || 'Plano Free'}</p>
                )}
              </div>
              <div 
                className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden relative border-2 border-transparent group-hover:border-primary/50 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  avatarInputRef.current?.click();
                }}
              >
                {userData?.photoURL || user.photoURL ? (
                  <img 
                    src={userData?.photoURL || user.photoURL} 
                    alt={user.displayName || 'User'} 
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </div>
              <input 
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>
        </header>

        <ConnectionsSettings
          open={showConnectionsSettings}
          onOpenChange={setShowConnectionsSettings}
          onManageHousehold={() => setActiveView('household')}
          onManagePillarConnections={() => setActiveView('pillar-connections')}
        />

        <CommandPalette
          open={isCommandPaletteOpen}
          onOpenChange={setIsCommandPaletteOpen}
          tasks={tasks}
          users={users}
          navItems={sidebarItems}
          onSelectTask={openTaskDetails}
          onSelectUser={setSelectedUser}
          onNavigate={(viewId) => setActiveView(viewId as View)}
        />

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView + (isFocusMode ? '-focus' : '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={getPillarAccentStyle(activeView)}
              className={cn(
                "max-w-7xl mx-auto space-y-6 h-full",
                isFocusMode && "max-w-3xl pt-20"
              )}
            >
              {isFocusMode ? (
                <div className="space-y-12">
                  <div className="text-center space-y-4 relative">
                    <div className="flex flex-col items-center gap-4">
                      <h2 className="text-6xl font-black tracking-tighter text-glow-blue uppercase italic leading-none">MODE FOCO TOTAL</h2>
                      <div className="flex bg-muted rounded-full p-1 border">
                        <Button 
                          variant={focusFilter === 'TOTAL' ? 'default' : 'ghost'} 
                          size="sm" 
                          className="rounded-full text-[10px] font-black uppercase tracking-widest h-8 px-6"
                          onClick={() => setFocusFilter('TOTAL')}
                        >
                          Total
                        </Button>
                        <Button 
                          variant={focusFilter === 'IMEDIATO' ? 'default' : 'ghost'} 
                          size="sm" 
                          className="rounded-full text-[10px] font-black uppercase tracking-widest h-8 px-6"
                          onClick={() => setFocusFilter('IMEDIATO')}
                        >
                          Imediato
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground font-medium max-w-lg mx-auto">
                      {focusFilter === 'TOTAL' ? 'Produtividade máxima. Todos os pilares organizados por prioridade absoluta.' : 'FOCO IMEDIATO: Ações urgentes que exigem sua atenção agora.'}
                    </p>

                    <div className="absolute -top-4 -right-4 md:right-0">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="rounded-2xl w-14 h-14 shadow-xl hover:scale-110 active:scale-95 transition-all bg-card border-primary/20 text-primary-foreground bg-primary hover:bg-primary/90"
                        onClick={() => setIsVideoDialogOpen(true)}
                        title={isPersonal ? "Reunião não disponível no modo Pessoal" : "Reunião Rápida"}
                        disabled={isPersonal}
                      >
                        <VideoIcon className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8">
                    <PomodoroTimer 
                      taskTitle={tasks.find(t => t.id === focusedTaskId)?.title}
                      onComplete={() => {
                        if (focusedTaskId) {
                          setTaskToCompleteId(focusedTaskId);
                          setIsCompletionDialogOpen(true);
                          setFocusedTaskId(null);
                        }
                      }}
                    />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <h3 className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight italic">
                          <CheckSquare className="w-5 h-5 text-primary" />
                          {focusFilter === 'TOTAL' ? 'Próximos Passos' : 'Urgências Críticas'}
                        </h3>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">
                          {filteredTasks.filter(t => !t.completed).filter(t => focusFilter === 'IMEDIATO' ? (t.quadrant === 'urgent-important' || t.quadrant === 'urgent-not-important') : true).length} Pendentes
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {filteredTasks
                          .filter(t => !t.completed)
                          .filter(t => focusFilter === 'TOTAL' ? true : (t.quadrant === 'urgent-important' || t.quadrant === 'urgent-not-important'))
                          .sort((a, b) => {
                            const priorityMap: Record<EisenhowerQuadrant, number> = {
                              'urgent-important': 1,
                              'important-not-urgent': 2,
                              'urgent-not-important': 3,
                              'not-urgent-not-important': 4
                            };
                            return priorityMap[a.quadrant] - priorityMap[b.quadrant];
                          })
                          .slice(0, 5)
                          .map(task => (
                            <div 
                              key={task.id} 
                              className={cn(
                                "p-6 bg-card border rounded-3xl flex items-center justify-between hover:border-primary/50 transition-all cursor-pointer glow-blue group",
                                focusedTaskId === task.id && "border-primary bg-primary/5 ring-2 ring-primary/20"
                              )}
                              onClick={() => setFocusedTaskId(task.id)}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border leading-none",
                                    task.quadrant === 'urgent-important' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                    task.quadrant === 'important-not-urgent' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                    task.quadrant === 'urgent-not-important' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                    "bg-slate-500/10 border-slate-500/20 text-slate-500"
                                  )}>
                                    {QUADRANT_LABELS[task.quadrant].title}
                                  </span>
                                </div>
                                <span className="text-xl font-bold tracking-tight">{task.title}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-12 w-12 rounded-2xl group-hover:bg-primary text-muted-foreground group-hover:text-white transition-all shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTaskToCompleteId(task.id);
                                  setIsCompletionDialogOpen(true);
                                }}
                              >
                                <CheckSquare className="w-7 h-7" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => setIsFocusMode(false)} className="text-muted-foreground uppercase text-[10px] font-black tracking-widest hover:text-primary transition-colors">
                      Encerrar MODE FOCO TOTAL
                    </Button>
                  </div>
                </div>
              ) : (
                <>
              {activeView === 'dashboard' ? (
                <Dashboard 
                  tasks={filteredTasks} 
                  familyEvents={familyEvents}
                  users={users.length > 0 ? users : [{
                    id: user.uid,
                    name: user.displayName || 'Você',
                    email: user.email || '',
                    role: 'MEMBER',
                    status: 'online'
                  }]} 
                  currentUser={effectiveUser as User}
                  onTaskClick={handleEditTask}
                  onEditTask={handleEditTask}
                  onUserClick={(member) => {
                    setSelectedUser(member);
                    setActiveView('messages');
                  }}
                  onAddAppointment={() => {
                    setActiveQuadrant('urgent-important');
                    setIsDialogOpen(true);
                  }}
                  onUpdateJourney={async (days) => {
                    if (!user) return;
                    await updateDoc(doc(db, 'users', user.uid), { journeyTotalDays: days });
                    toast.success('Jornada atualizada!');
                  }}
                  subscription={subscription}
                  onNavigate={setActiveView}
                  onToggleFocus={() => setIsFocusMode(true)}
                  isInviteDisabled={(() => {
                    if (userData?.isPlatformAdmin) return false;
                    const userPlanType = resolvePlanType(subscription?.planType);
                    const planLimit = getPlanLimits(userPlanType).maxUsers;
                    const invitedCount = users.filter(u => u.id !== user.uid).length;
                    const isFreeMember = effectiveUser?.role === 'MEMBER' && !subscription?.planType?.startsWith('PERSONAL_');
                    return isFreeMember || (invitedCount >= planLimit && planLimit !== Infinity);
                  })()}
                  onRegenerateInviteCode={async () => {
                    if (!user) return;
                    
                    try {
                      const userPlanType = resolvePlanType(subscription?.planType);
                      const planLimit = getPlanLimits(userPlanType).maxUsers;
                      
                      // Count current members (excluding self for limits if applicable, but usually limits are total members)
                      // User said: "Pode convidar até 2 pessoas (ex: esposa e filho)" -> total 3?
                      // Actually "Limite de membros 25" usually means total members including owner, or just invited?
                      // "Pode convidar até 2 pessoas" suggests 1 owner + 2 invited = 3 total.
                      // Let's assume the limit is the NUMBER OF INVITED PEOPLE.
                      const invitedCount = users.filter(u => u.id !== user.uid).length;

                      // Member (free) check
                      const isFreeMember = effectiveUser?.role === 'MEMBER' && !subscription?.planType?.startsWith('PERSONAL_');
                      
                      if (isFreeMember && !userData?.isPlatformAdmin) {
                        toast.error('Membros gratuitos não podem gerar código. Faça upgrade para o plano Pessoal!');
                        return;
                      }

                      if (invitedCount >= planLimit && planLimit !== Infinity && !userData?.isPlatformAdmin) {
                        toast.error('Limite de usuários atingido para seu plano.', {
                          description: 'Faça upgrade para convidar mais pessoas.'
                        });
                        return;
                      }

                      let instId = effectiveUser?.institutionId;
                      
                      if (!instId) {
                        // Create new institution
                        const newInstId = `inst-${user.uid.substring(0, 5)}_${Date.now()}`;
                        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                        
                        const batch = writeBatch(db);
                        
                        // 1. Create Institution
                        batch.set(doc(db, 'institutions', newInstId), {
                          id: newInstId,
                          name: `Instituição de ${user.displayName || 'Membro'}`,
                          inviteCode: inviteCode,
                          planType: 'INSTITUTION_BASIC',
                          createdAt: serverTimestamp(),
                          createdBy: user.uid
                        });
                        
                        // 2. Add as Admin Member
                        batch.set(doc(db, 'institutions', newInstId, 'members', user.uid), {
                          userId: user.uid,
                          role: 'ADMIN',
                          status: 'ACTIVE',
                          joinedAt: serverTimestamp()
                        });
                        
                        // 3. Update User
                        batch.update(doc(db, 'users', user.uid), {
                          institutionId: newInstId,
                          role: 'ADMIN',
                          inviteCode: inviteCode // Store also on user for easier access in Personal mode
                        });
                        
                        // 4. Update Subscription
                        batch.set(doc(db, 'subscriptions', user.uid), {
                          userId: user.uid,
                          planType: 'INSTITUTION_BASIC',
                          status: 'ACTIVE'
                        }, { merge: true });
                        
                        await batch.commit();
                        setProfileType('institutional');
                        toast.success('Parabéns! Grupo criado e código gerado.');
                        return;
                      }

                      if (effectiveUser?.role !== 'ADMIN' && effectiveUser?.role !== 'MANAGER') {
                        toast.error('Apenas gestores podem regenerar o código.');
                        return;
                      }
                      
                      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                      await updateDoc(doc(db, 'institutions', instId), {
                        inviteCode: newCode
                      });
                      toast.success('Código de convite regenerado!');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, 'institutions');
                    }
                  }}
                  institution={institution}
                />
              ) : activeView === 'video-call' ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 bg-card border rounded-[2.5rem] p-12 text-center">
                   <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary animate-pulse">
                      <VideoIcon className="w-12 h-12" />
                   </div>
                   <div className="space-y-4 max-w-md">
                      <h2 className="text-3xl font-black tracking-tighter uppercase italic">OHEL Connect VIP</h2>
                      <p className="text-muted-foreground font-bold">Inicie chamadas de vídeo seguras com sua equipe ou clientes diretamente do OHEL.</p>
                   </div>
                   <div className="flex gap-4">
                      <Button className="h-16 px-8 rounded-2xl font-black tracking-widest uppercase text-xs">Nova Reunião</Button>
                      <Button variant="outline" className="h-16 px-8 rounded-2xl font-black tracking-widest uppercase text-xs">Ingressar com Código</Button>
                   </div>
                </div>
              ) : (activeView === 'global-platform' || (activeView === 'dashboard' && adminViewMode === 'GLOBAL')) && isMaster ? (
                <GlobalPlatformDashboard 
                  allUsers={allPlatformUsers}
                  institutions={institutions}
                  allTasks={allPlatformTasks}
                  onImpersonateUser={(targetUser) => {
                    setImpersonatedUser(targetUser);
                    setAdminViewMode('IMPERSONATION');
                    setActiveView('dashboard');
                    toast.success(`Inspecionando conta de ${targetUser.name || targetUser.email}`);
                  }}
                  onViewInstitutionTasks={() => {
                    setActiveView('dashboard');
                  }}
                />
              ) : activeView === 'admin-panel' && isMaster ? (
                <PlatformAdminPanel institutions={institutions} />
              ) : activeView === 'calendar' ? (
                <CalendarView 
                  tasks={filteredTasks} 
                  onTaskClick={handleEditTask} 
                  onUpdateTaskDate={handleEditTaskInCalendar}
                  onDayClick={(day) => {
                    setActiveQuadrant('important-not-urgent');
                    setIsDialogOpen(true);
                  }}
                />
              ) : activeView === 'missions' ? (
                <MissionsView 
                  user={effectiveUser as User}
                  tasks={filteredTasks}
                  modules={modules}
                  rankings={rankings}
                />
              ) : activeView === 'logistics' ? (
                <LogisticsView 
                  user={effectiveUser as User}
                />
              ) : activeView === 'household' ? (
                <HouseholdPanel
                  householdId={activeContextType === 'HOUSEHOLD' ? activeContextId : null}
                  onBack={() => setActiveView('profile')}
                />
              ) : activeView === 'ranking' ? (
                <RankingView />
              ) : activeView === 'pillar-connections' ? (
                <PillarConnectionsPanel />
              ) : activeView === 'messages' ? (
                <MessagesView 
                  currentUser={effectiveUser as User}
                  users={users}
                  messages={messages}
                  tasks={filteredTasks}
                  onSendMessage={async (m) => {
                    await addDoc(collection(db, 'messages'), {
                      ...m,
                      createdAt: serverTimestamp()
                    });
                  }}
                />
              ) : activeView === 'institution' ? (
                <InstitutionLayout 
                  user={effectiveUser as User}
                  institution={institution} 
                  users={users} 
                  groups={groups}
                  tasks={tasks}
                  projects={[]}
                  isPersonal={isPersonal}
                  onSelectTask={(task) => {
                    handleEditTask(task);
                  }}
                  onDelegateTask={async (uid, data) => {
                    if (!user) return;
                    try {
                      const batch = writeBatch(db);
                      const taskRef = doc(collection(db, 'tasks'));
                      const taskId = taskRef.id;

                      const taskData = {
                        ...data,
                        userId: uid,
                        moduleId: 'PROFISSIONAL',
                        status: 'ASSIGNED',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        completed: false,
                        assignedTo: [uid],
                        delegatedBy: user.uid,
                        institutionId: effectiveUser?.institutionId
                      };

                      batch.set(taskRef, taskData);

                      // Audit Log for rules
                      const logRef = doc(db, 'audit_logs', `${taskId}_create`);
                      batch.set(logRef, {
                        userId: user.uid,
                        action: 'DELEGATE_TASK',
                        resource: `tasks/${taskId}`,
                        timestamp: serverTimestamp(),
                        details: { title: data.title, targetUserId: uid }
                      });

                      // Create Notification for the delegated user
                      const notifRef = doc(collection(db, 'notifications'));
                      batch.set(notifRef, {
                        userId: uid,
                        type: 'TASK_DELEGATED',
                        title: 'Nova Tarefa Delegada',
                        message: `${user.displayName || 'Um administrador'} delegou uma tarefa para você no painel institucional.`,
                        read: false,
                        senderId: user.uid,
                        senderName: user.displayName || 'Admin',
                        createdAt: serverTimestamp(),
                      });

                      await batch.commit();
                      toast.success('Tarefa delegada!');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.CREATE, 'tasks');
                    }
                  }}
                />
              ) : activeView === 'focus' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <div className="space-y-6">
                    <PomodoroTimer 
                      taskTitle={tasks.find(t => t.id === focusedTaskId)?.title}
                      focusedTaskId={focusedTaskId}
                      onTaskComplete={(timeSpent) => {
                        if (focusedTaskId) {
                          handleTaskComplete(focusedTaskId, timeSpent);
                        }
                      }}
                    />
                    {focusedTaskId && (
                      <div className="p-4 bg-primary/5 border-primary/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-sm font-medium">Focando em: {tasks.find(t => t.id === focusedTaskId)?.title}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setFocusedTaskId(null)}>Trocar</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-primary" />
                      Tarefas Prioritárias (Quadrante 1)
                    </h3>
                    <div className="space-y-3">
                      {filteredTasks.filter(t => t.quadrant === 'urgent-important' && !t.completed).map(task => (
                        <div 
                          key={task.id} 
                          className={cn(
                            "p-4 bg-card border rounded-xl flex items-center justify-between group transition-all cursor-pointer",
                            focusedTaskId === task.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
                          )}
                          onClick={() => setFocusedTaskId(task.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm font-medium">{task.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeView === 'stats' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card border rounded-xl p-6">
                    <h3 className="font-semibold mb-6">Distribuição por Quadrante</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={quadrantStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {quadrantStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-6">
                    <h3 className="font-semibold mb-6">Status de Execução</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={completionStats}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : activeView === 'modules' ? (
                <ModuleManagement modules={modules} onToggleModule={toggleModule} />
              ) : activeView === 'plans' ? (
                <PlanSelector 
                  currentPlan={isPersonal ? resolvePlanType(effectiveUser?.planType) : institution?.planType}
                  hasAdminDiscount={institution?.hasAdminDiscount}
                  forceType={isPersonal ? 'PERSONAL' : (isInstitutionOwner ? 'INSTITUTION' : 'PERSONAL')}
                  onUpgrade={handleUpgrade} 
                />
              ) : activeView === 'notifications' ? (
                <NotificationsPage userId={user.uid} onNavigate={setActiveView} />
              ) : activeView === 'ordem-no-caos' ? (
                <OrdemNoCaos onNavigate={setActiveView} profileType={isPersonal ? 'personal' : 'institutional'} />
              ) : activeView === 'profile' ? (
                <ProfilePage 
                  user={effectiveUser as User} 
                  subscription={subscription} 
                  onNavigate={setActiveView}
                />
              ) : activeView === 'admin-panel' ? (
                <PlatformAdminPanel institutions={institutions} />
              ) : activeView === 'spiritual' ? (
                <SpiritualModule userId={user.uid} onAddTask={addTask} />
              ) : activeView === 'financeiro' ? (
                <PersonalFinanceModule userId={user.uid} />
              ) : activeView === 'profissional' ? (
                <ProfessionalModule userId={user.uid} institutionId={effectiveUser?.institutionId} defaultTab={professionalDefaultTab} />
              ) : activeView === 'familiar' ? (
                <PersonalModule 
                  userId={user.uid} 
                  tasks={tasks.filter(t => t.moduleId === 'familiar')} 
                  onTaskComplete={handleTaskComplete} 
                  onDeleteTask={deleteTask}
                  addTask={addTask}
                  onOpenAddTask={(initialData) => {
                    if (initialData?.quadrant) {
                      setActiveQuadrant(initialData.quadrant);
                    }
                    setTaskDialogTitle(initialData?.title?.includes('Evento') ? 'Criar Novo Evento' : 'Criar Nova Tarefa');
                    setSelectedTask(initialData ? {
                      id: '',
                      title: initialData.title || '',
                      description: initialData.description || '',
                      quadrant: initialData.quadrant || 'important-not-urgent',
                      status: 'PENDING',
                      completed: false,
                      createdAt: Date.now(),
                      type: 'PERSONAL',
                      moduleId: initialData.moduleId || 'familiar',
                    } : null);
                    setIsDialogOpen(true);
                  }}
                />
              ) : activeView === 'documentos' ? (
                <DocumentsModule userId={user.uid} />
              ) : activeView === 'fitness' ? (
                <FitnessModule userId={user.uid} />
              ) : activeView === 'biblioteca' ? (
                <LibraryModule userId={user.uid} />
              ) : activeView === 'templates' ? (
                <TemplatesView 
                  templates={taskTemplates}
                  onCreateTemplate={handleCreateTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onUseTemplate={(tpl) => {
                    setActiveQuadrant(tpl.quadrant);
                    const description = [
                      tpl.description || '',
                      ...(tpl.customFields || []).map(f => `${f.label}: `)
                    ].filter(Boolean).join('\n\n');

                    setSelectedTask({
                      id: '',
                      title: tpl.title,
                      description: description,
                      quadrant: tpl.quadrant,
                      moduleId: tpl.moduleId,
                      status: 'PENDING',
                      completed: false,
                      createdAt: Date.now(),
                      type: tpl.type,
                      assignedToGroups: tpl.assignedToGroups || []
                    } as any);
                    setIsDialogOpen(true);
                  }}
                />
              ) : activeView === 'agent' ? (
                <OhelAgentView 
                  userId={user.uid} 
                  userName={userData?.name || user.displayName || 'Usuária'} 
                  onTasksAdded={() => {}}
                />
              ) : activeView === 'video-call' ? (
                <VideoCall 
                  userId={user.uid} 
                  userName={userData?.name || user.displayName || 'Usuário'} 
                  institutionId={effectiveUser?.institutionId}
                  canStartCall={!isPersonal && (isMaster || (institution?.planType === 'INTERMEDIATE' || institution?.planType === 'ADVANCED'))}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">
                        {sidebarItems.find(i => i.id === activeView)?.label || 'OHEL'}
                      </h2>
                      <p className="text-muted-foreground">
                        Organize suas tarefas pela importância e urgência.
                      </p>
                    </div>
                    {(activeView === 'matrix' || activeView === 'dashboard') && (
                      <Button onClick={() => openAddTask()} className="gap-2 rounded-full shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" />
                        Nova Tarefa
                      </Button>
                    )}
                  </div>

                  <EisenhowerMatrix 
                    tasks={filteredTasks.filter(t => !t.completed)}
                    onToggleTask={toggleTask}
                    onDeleteTask={deleteTask}
                    onAddTask={openAddTask}
                    onEditTask={handleEditTask}
                    onTaskClick={handleEditTask}
                    onUpdateTaskQuadrant={updateTaskQuadrant}
                  />
                </>
              )}
              </>
              )}

            {/* Redundant conditional blocks removed to prevent duplicated UI */}
            
          </motion.div>
        </AnimatePresence>
      </div>
    </main>

      {/* Add Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setTaskDialogTitle('');
      }}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85vh] overflow-y-auto p-6 scrollbar-hide">
          <TaskForm 
            initialQuadrant={activeQuadrant}
            initialData={selectedTask || undefined}
            formTitle={taskDialogTitle}
            users={users}
            modules={modules}
            templates={taskTemplates}
            groups={groups}
            onSubmit={(data) => {
              addTask(data);
              setIsDialogOpen(false);
              setSelectedTask(null);
              setTaskDialogTitle('');
            }}
            onCancel={() => {
              setIsDialogOpen(false);
              setSelectedTask(null);
              setTaskDialogTitle('');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85vh] overflow-y-auto p-6 scrollbar-hide">
          {taskToEdit && (
            <TaskForm 
              initialData={taskToEdit}
              users={users}
              modules={modules}
              templates={taskTemplates}
              groups={isInstitutionOwner || isMember ? [{ id: 'ALUNOS', name: 'Grupo de Alunos' }] : []}
              onSubmit={handleSaveEditedTask}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
          {selectedTask && (
            <TaskDetails 
              task={selectedTask} 
              onUpdate={updateTask}
              users={users}
              groups={groups}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Limite do Plano Atingido</DialogTitle>
            <DialogDescription className="pt-2">
              Você atingiu o limite de {limits.tasks} tarefas do seu plano <strong>{currentPlan}</strong>. 
              Faça um upgrade para continuar organizando sua rotina sem limites.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
              <Zap className="w-4 h-4 text-primary" />
              <span>Tarefas ilimitadas no plano PRO</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
              <Layers className="w-4 h-4 text-primary" />
              <span>Até 5 módulos simultâneos</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsUpgradeDialogOpen(false)}>Depois</Button>
            <Button onClick={handleUpgrade} className="gap-2">
              Fazer Upgrade
              <Zap className="w-4 h-4 fill-current" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none">
          <VideoCall 
            userId={user.uid} 
            userName={userData?.name || user.displayName || 'Usuário'} 
            institutionId={effectiveUser?.institutionId}
            canStartCall={!isPersonal && (isMaster || (institution?.planType === 'INTERMEDIATE' || institution?.planType === 'ADVANCED'))}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Finalizar Tarefa</DialogTitle>
            <DialogDescription className="font-medium">
              Deseja adicionar uma nota de conclusão ao histórico desta tarefa?
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nota de Conclusão (Opcional)</Label>
              <Textarea 
                placeholder="Descreva brevemente o resultado ou observações importantes..." 
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                className="min-h-[120px] rounded-2xl border-2 focus-visible:ring-primary/20 font-medium resize-none p-4"
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium italic">
              * A nota será enviada para o histórico do ticket e ficará visível para todos os envolvidos.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => finalizeTaskCompletion(taskToCompleteId!)}
              className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]"
            >
              Concluir sem Nota
            </Button>
            <Button 
              onClick={() => finalizeTaskCompletion(taskToCompleteId!, completionNote)}
              className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-primary/20"
            >
              Concluir e Adicionar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  </TooltipProvider>
  );
}

const ThemeToggle = ({ userId, collapsed }: { userId?: string; collapsed?: boolean }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const content = (
    <Button 
      variant="ghost" 
      className={cn(
        "w-full justify-start gap-3 h-10 transition-all",
        collapsed && "justify-center p-0"
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </div>
      {!collapsed && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
    </Button>
  );

  if (collapsed) {
    return (
      <TooltipUI>
        <TooltipTrigger 
          render={content}
        />
        <TooltipContent side="right" className="font-bold">
          {isDark ? 'Mudar para Claro' : 'Mudar para Escuro'}
        </TooltipContent>
      </TooltipUI>
    );
  }

  return content;
}


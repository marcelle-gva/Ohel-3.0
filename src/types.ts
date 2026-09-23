export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type EisenhowerQuadrant = 'urgent-important' | 'important-not-urgent' | 'urgent-not-important' | 'not-urgent-not-important';

export type PriorityLevel = 'NOW' | 'SCHEDULE' | 'DELEGATE';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED' | 'ACCEPTED' | 'REFUSED' | 'PENDING_APPROVAL';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: number;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

// --- Plans -----------------------------------------------------------------
// Simplified to exactly 2 tiers per account kind (CPF / CNPJ), per product
// decision on 2026-09-17. The legacy 3-tier values are kept ONLY as a type
// union member so old Firestore documents still type-check during migration;
// new documents must never be written with a legacy value. Run the plan
// migration script before deploying rules that assume only the new values.
export type LegacyPlanType = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'PERSONAL_INTERMEDIATE' | 'PERSONAL_ADVANCED' | 'INSTITUTION_INTERMEDIATE' | 'INSTITUTION_ADVANCED';
export type PlanType = 'PERSONAL_BASIC' | 'PERSONAL_PLUS' | 'INSTITUTION_BASIC' | 'INSTITUTION_PLUS' | LegacyPlanType;
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'TRIAL' | 'PAST_DUE';

// A subscription is always the source of truth for a CONTEXT (a Household or
// an Institution), never for an individual member. `contextId` is the
// household/institution id; members inherit the plan of the context they are
// currently acting in. Kept keyed by the owner's `userId` as well so Stripe
// webhooks (which only know the paying customer) can find the right doc.
export interface Subscription {
  userId: string; // the paying owner
  contextType: 'HOUSEHOLD' | 'INSTITUTION';
  contextId: string; // householdId or institutionId this subscription grants the plan to
  planType: PlanType;
  status: SubscriptionStatus;
  expiresAt?: number;
  stripeCustomerId?: string;
  subscriptionId?: string;
}

export interface PlanConfig {
  maxUsers: number;
  price: string;
  tasks: number;
  modules: number;
}

// Feature flags gated by plan. Checked with `planHasFeature()` below —
// never hardcode a planType comparison inline in a component.
export type PlanFeature = 'VIDEO_CALLS' | 'TASK_TEMPLATES' | 'ATTACHMENTS' | 'PHOTO_ALBUM';

export const PLAN_LIMITS: Record<string, PlanConfig> = {
  // PESSOAL (CPF)
  PERSONAL_BASIC: { maxUsers: 5, price: 'R$ 29,90', tasks: 1000, modules: 4 },
  PERSONAL_PLUS: { maxUsers: 10, price: 'R$ 69,90', tasks: Infinity, modules: 4 },

  // INSTITUCIONAL (CNPJ)
  INSTITUTION_BASIC: { maxUsers: 25, price: 'R$ 149,90', tasks: Infinity, modules: 4 },
  INSTITUTION_PLUS: { maxUsers: Infinity, price: 'R$ 449,90', tasks: Infinity, modules: 4 },
};

// Old Firestore docs and several call sites still store/default to the
// pre-2026-09-17 keys (BASIC, INTERMEDIATE, …). PLAN_LIMITS has no entries
// for those, so looking them up returned undefined and crashed on
// limits.tasks / limits.modules.
const LEGACY_PLAN_TO_CURRENT: Record<string, string> = {
  BASIC: 'PERSONAL_BASIC',
  INTERMEDIATE: 'PERSONAL_PLUS',
  ADVANCED: 'PERSONAL_PLUS',
  PERSONAL_INTERMEDIATE: 'PERSONAL_PLUS',
  PERSONAL_ADVANCED: 'PERSONAL_PLUS',
  INSTITUTION_INTERMEDIATE: 'INSTITUTION_PLUS',
  INSTITUTION_ADVANCED: 'INSTITUTION_PLUS',
};

export function resolvePlanType(planType?: string | null): string {
  if (planType && PLAN_LIMITS[planType]) return planType;
  if (planType && LEGACY_PLAN_TO_CURRENT[planType]) return LEGACY_PLAN_TO_CURRENT[planType];
  return 'PERSONAL_BASIC';
}

export function getPlanLimits(planType?: string | null): PlanConfig {
  return PLAN_LIMITS[resolvePlanType(planType)];
}

// Which plans unlock which paid-only features. Basic (CPF or CNPJ) never
// gets these; Plus (CPF or CNPJ) always does.
export const PLAN_FEATURES: Record<PlanFeature, PlanType[]> = {
  VIDEO_CALLS: ['PERSONAL_PLUS', 'INSTITUTION_PLUS'],
  TASK_TEMPLATES: ['PERSONAL_PLUS', 'INSTITUTION_PLUS'],
  ATTACHMENTS: ['PERSONAL_PLUS', 'INSTITUTION_PLUS'],
  PHOTO_ALBUM: ['PERSONAL_PLUS', 'INSTITUTION_PLUS'],
};

export function planHasFeature(planType: PlanType | undefined | null, feature: PlanFeature): boolean {
  if (!planType) return false;
  return PLAN_FEATURES[feature].includes(planType);
}

export const MEMBER_UPGRADE_PRICE = 'R$ 29,90';

// --- Multi-context switching (the "Netflix profile" selector) --------------
export type ContextType = 'PERSONAL' | 'HOUSEHOLD' | 'INSTITUTION';

// A generic pointer to "where does this piece of data live". Every pillar
// collection (finance, family, spiritual, fitness, documents, album, tasks,
// ranking...) gets these fields going forward instead of a bare
// `institutionId`. contextId is omitted/undefined for contextType PERSONAL.
export interface ContextScoped {
  contextType: ContextType;
  contextId?: string;
}

// Sharing controls, reused across every pillar collection. Same shape the
// Task type already used informally — now formalized and shared.
export interface Shareable extends ContextScoped {
  visibility: 'PRIVATE' | 'PUBLIC' | 'SPECIFIC';
  visibleToUsers?: string[];
  visibleToGroups?: string[];
}

// --- Households (Casas) ------------------------------------------------------
export type HouseholdRole = 'OWNER' | 'ADULT' | 'CHILD' | 'GUEST';

export type HouseholdPermission = 'ASSIGN_TASKS_TO_OTHERS' | 'APPROVE_TASKS' | 'VIEW_FINANCE' | 'MANAGE_FINANCE' | 'MANAGE_MEMBERS';

// Sensible defaults per role; a member doc may override individual flags,
// but the app should seed new members with these.
export const HOUSEHOLD_ROLE_DEFAULTS: Record<HouseholdRole, HouseholdPermission[]> = {
  OWNER: ['ASSIGN_TASKS_TO_OTHERS', 'APPROVE_TASKS', 'VIEW_FINANCE', 'MANAGE_FINANCE', 'MANAGE_MEMBERS'],
  ADULT: ['ASSIGN_TASKS_TO_OTHERS', 'APPROVE_TASKS', 'VIEW_FINANCE'],
  CHILD: [],
  GUEST: [],
};

export interface Household {
  id: string;
  name: string; // e.g. "Família Ayres" — shown in the invite and the profile switcher
  ownerId: string;
  inviteCode: string;
  planType: PlanType; // 'PERSONAL_BASIC' | 'PERSONAL_PLUS' — inherited by every member
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: number;
  rankingEnabled?: boolean; // owner-controlled, separate from any institution's ranking
  createdAt: any;
}

// Stored at households/{householdId}/members/{userId}
export interface HouseholdMember {
  householdId: string;
  userId: string;
  profileName: string; // "Marido", "Esposa", "Filho" — shown in the profile selector
  role: HouseholdRole;
  permissions?: HouseholdPermission[]; // overrides HOUSEHOLD_ROLE_DEFAULTS[role] when present
  status: 'ACTIVE' | 'PENDING';
  joinedAt: any;
}

// --- Ad-hoc, time-boxed external sharing of a single pillar -----------------
export type PillarKey = 'PESSOAL' | 'FINANCEIRO' | 'FAMILIAR' | 'PROFISSIONAL' | 'ESPIRITUAL';

// Doc id convention: `${ownerId}_${targetUserId}_${pillar}` so rules can
// check access with a single get(), no query needed.
export interface PillarConnection {
  ownerId: string;
  targetUserId: string;
  pillar: PillarKey;
  scope: 'READ_ONLY';
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  expiresAt: number;
  createdAt: any;
}

export type TaskType = 'PERSONAL' | 'INSTITUTIONAL';

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  required?: boolean;
}

export interface TaskTemplate {
  id: string;
  userId: string;
  institutionId?: string;
  title: string;
  description?: string;
  quadrant: EisenhowerQuadrant;
  moduleId?: string;
  type: TaskType;
  assignedToGroups?: string[];
  customFields?: CustomFieldDefinition[];
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  quadrant: EisenhowerQuadrant;
  status: TaskStatus;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  timeSpent?: number; // in seconds
  dueDate?: number;
  tags?: string[];
  moduleId?: string;
  /** @deprecated use contextType/contextId. Kept only for reading pre-migration documents. */
  institutionId?: string;
  contextType: ContextType;
  contextId?: string; // householdId or institutionId; absent when contextType is PERSONAL
  type: TaskType;
  assignedBy?: string;
  assignedByName?: string;
  comments?: Comment[];
  attachments?: Attachment[];
  approvalStatus?: ApprovalStatus;
  groupId?: string;
  isPrivate?: boolean;
  deadlineAt?: number;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly';
  ticketNumber?: string;
  assignedToGroups?: string[];
  approvedByManager?: boolean;
  visibility?: 'PRIVATE' | 'PUBLIC' | 'SPECIFIC';
  visibleToUsers?: string[];
  visibleToGroups?: string[];
  customFields?: { [key: string]: any };
}

export interface Module {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  icon: string;
  color: string;
}

export interface Institution {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  membersCount?: number;
  planType: PlanType; // 'INSTITUTION_BASIC' | 'INSTITUTION_PLUS' — inherited by every member
  hasAdminDiscount?: boolean;
  trialEndsAt?: number;
  subscriptionStatus?: SubscriptionStatus;
  rankingEnabled?: boolean; // owner-controlled, separate from any household's ranking
  // When true, a task delegated to a member (assignedBy != userId) must be
  // created with status 'PENDING_APPROVAL' and a manager must approve it
  // before it counts as scheduled. Households never require this (product
  // decision 2026-09-17) — this flag only exists on Institution.
  taskApprovalRequired?: boolean;
  createdAt?: any;
}

// Stored at institutions/{institutionId}/members/{userId}. The role here is
// what rules must check for isManager()/isAdmin() — NEVER the auth token
// claim, since one person can be ADMIN of one institution and a plain
// MEMBER of another at the same time.
export interface InstitutionMember {
  institutionId: string;
  userId: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  status: 'ACTIVE' | 'PENDING';
  joinedAt: any;
}

export type UserStatus = 'online' | 'away' | 'busy';
export type UserType = 'personal' | 'institution_owner' | 'institution_member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  type?: UserType;
  institutionId?: string;
  status?: UserStatus;
  photoURL?: string;
  age?: number;
  journeyStart?: number;
  journeyTotalDays?: number;
  profileType?: 'PERSONAL' | 'INSTITUTIONAL';
  phoneNumber?: string;
  socialMedia?: string;
  isPlatformAdmin?: boolean;
  // Which household/institution the profile switcher was last set to, so the
  // app reopens on the same "Netflix profile" instead of always defaulting
  // to the personal context.
  lastActiveContextType?: ContextType;
  lastActiveContextId?: string;
  // Root-only (isPlatformAdmin) UI convenience: preview the app as if under
  // a given plan, without touching anyone's real Subscription/Household/
  // Institution doc. Must NEVER be trusted server-side for anything billing
  // or limit related — client-side feature-flag preview only.
  viewAsPlanOverride?: PlanType;
}

export const QUADRANT_LABELS: Record<EisenhowerQuadrant, { title: string; subtitle: string; color: string }> = {
  'urgent-important': {
    title: 'Fazer Agora',
    subtitle: 'Urgente e Importante',
    color: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
  },
  'important-not-urgent': {
    title: 'Agendar',
    subtitle: 'Importante, Não Urgente',
    color: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
  },
  'urgent-not-important': {
    title: 'Delegar',
    subtitle: 'Urgente, mas Não Importante',
    color: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  },
  'not-urgent-not-important': {
    title: 'Eliminar',
    subtitle: 'Nem Urgente nem Importante',
    color: 'bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400',
  },
};

export const MODULES: Module[] = [
  { id: '1', slug: 'pessoal', name: 'Pessoal', active: true, icon: 'User', color: 'bg-blue-500' },
  { id: '2', slug: 'financeiro', name: 'Financeiro', active: true, icon: 'DollarSign', color: 'bg-green-500' },
  { id: '3', slug: 'familiar', name: 'Familiar', active: true, icon: 'Users', color: 'bg-purple-500' },
  { id: '4', slug: 'profissional', name: 'Profissional', active: true, icon: 'Briefcase', color: 'bg-orange-500' },
  { id: '5', slug: 'espiritual', name: 'Espiritual', active: true, icon: 'Heart', color: 'bg-pink-500' },
];

// Finance Module Types
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionCategory = 'Alimentação' | 'Transporte' | 'Moradia' | 'Lazer' | 'Saúde' | 'Educação' | 'Outros';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  date: any; // Firestore Timestamp
  createdAt: any;
  updatedAt: any;
  taskId?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface PixKey {
  id: string;
  userId: string;
  label: string;
  key: string;
  type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
  institution?: string;
}

// Spiritual Module Types
export interface Devotional {
  id: string;
  userId: string;
  verse: {
    text: string;
    reference: string;
  };
  notes: string;
  date: string; // YYYY-MM-DD
  createdAt: any;
}

export interface ReadingPlan {
  id: string;
  userId: string;
  book: string;
  totalChapters: number;
  completedChapters: number[];
  startDate: any;
  targetDays: number;
}

export interface SpiritualGoal {
  id: string;
  userId: string;
  title: string;
  progress: number; // 0-100
  completed: boolean;
  createdAt: any;
}

// Professional Module Types
export interface FinancialTransaction {
  id: string;
  userId: string;
  type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'INVESTMENT';
  amount: number;
  description: string;
  date: any;
  category?: string;
}

export interface TeamTask extends Task {
  assignedTo: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'COMPLETED';
  viewed: boolean;
  read: boolean;
  message?: string;
  targetDate: string; // YYYY-MM-DD
}

// Personal/Family Module Types
export interface FamilyEvent {
  id: string;
  userId: string;
  title: string;
  date: any;
  category: 'HOUSE' | 'ROUTINE' | 'EVENT' | 'TASK';
}

// Fitness & Well-being Types
export interface FitnessHabit {
  id: string;
  userId: string;
  name: string;
  type: 'WATER' | 'EXERCISE' | 'HABIT';
  target: number;
  current: number;
  date: string; // YYYY-MM-DD
}

export interface BiblicalVerseForMeditation {
  reference: string; // ex: "Filipenses 4:6-7"
  text: string; // ex: "Não andem ansiosos por coisa alguma..."
  version: string; // ex: "NVI (Bíblia Online)"
  sourceUrl: string; // ex: "https://www.bibliaonline.com.br/nvi/fp/4/6-7"
  theme?: string; // ex: "Ansiedade, Oração e Paz de Deus"
  meditation?: string; // reflexão prática para acalmar a mente
  isAnxietyVerse?: boolean;
}

export interface MoodClassification {
  level: number; // 1 (crítico/sobrecarregado) a 5 (ótimo/radiante)
  label: string; // ex: 'Sobrecarregada / Caos Mental', 'Ansiosa / Inquieta', 'Exausta', 'Neutra / Equilibrada', 'Focada / Determinada', 'Leve / Radiante'
  sentiment: 'sobrecarregado' | 'exausto' | 'ansioso' | 'neutro' | 'focado' | 'positivo';
  color: string;
}

export interface SolutionActivity {
  title: string;
  description: string;
  duration: string;
  type: 'respiracao' | 'alongamento' | 'pausa_cafe' | 'agua' | 'caminhada' | 'organizacao' | 'delegar' | 'oracao' | 'desconexao';
  benefit: string;
}

export interface MentalDumpAnalysis {
  detectedKeywords: string[];
  mood: MoodClassification;
  solutionActivity: SolutionActivity;
  biblicalVerse?: BiblicalVerseForMeditation;
  rawText?: string;
}

export interface WellBeingLog {
  id: string;
  userId: string;
  mood: number; // 1-5
  energy: number; // 1-5
  date: string;
  moodLabel?: string;
  sentiment?: string;
  mentalDumpText?: string;
  detectedKeywords?: string[];
  biblicalVerse?: BiblicalVerseForMeditation;
  suggestedActivity?: {
    title: string;
    description: string;
    duration?: string;
    type?: string;
    benefit?: string;
    completed?: boolean;
  };
  updatedAt?: any;
  createdAt?: any;
}

// Library Types
export interface LibraryItem {
  id: string;
  userId: string;
  title: string;
  author?: string;
  coverUrl?: string;
  category: 'BOOK' | 'COURSE' | 'CONTENT';
  progress: number;
  status: 'WANT_TO_READ' | 'READING' | 'COMPLETED';
}

// Mission & Ranking Types
export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: string;
  points: number;
  deadline: number;
  createdBy: string;
  createdAt: number;
  status: 'ACTIVE' | 'EXPIRED';
  authorizedRequired?: boolean;
  // Required going forward so rules can scope a mission to the institution
  // that created it, instead of every signed-in user seeing every mission.
  institutionId?: string;
}

export interface MissionCompletion {
  id: string;
  missionId: string;
  missionTitle?: string;
  userId: string;
  userName: string;
  status: 'PENDING' | 'AUTHORIZED' | 'REJECTED';
  completedAt: number;
  authorizedAt?: number;
  points: number;
}

export type GroupPermission = 'VIEW_CALENDAR' | 'VIEW_FINANCE' | 'MANAGE_FINANCE' | 'APPROVE_TASKS' | 'MANAGE_MEMBERS';

export interface UserGroup {
  id: string;
  name: string;
  institutionId: string;
  members: string[]; // user IDs
  permissions?: GroupPermission[]; // e.g. Tesouraria -> ['VIEW_FINANCE', 'MANAGE_FINANCE']
  createdAt: any;
}

export interface Ranking extends ContextScoped {
  id: string;
  userId: string;
  userName: string;
  points: number;
  weekId: string; // YYYY-WW
}

// Logistics Types
export interface LogisticsAddress {
  id: string;
  userId: string;
  label: string; // "Trabalho", "Casa", etc.
  address: string;
  type: 'WORK' | 'HOME' | 'DELIVERY' | 'OTHER';
  lat?: number;
  lng?: number;
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId?: string; // If null, it's a group or broadcast
  groupId?: string;
  taskId?: string; // For ticket-based chat
  text: string;
  createdAt: number;
  read: boolean;
}

// Notification Types
export type NotificationType = 'TASK_DELEGATED' | 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'COMMENT_ADDED' | 'DEADLINE_REMINDER' | 'MISSION_CREATED' | 'MISSION_COMPLETED' | 'ADMIN_ALERT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  resourceId?: string; // e.g., taskId
  senderId?: string;
  senderName?: string;
  // Required when senderId != userId (someone notifying another person),
  // so rules can verify sender and target actually share a household or
  // institution instead of allowing anyone to write into anyone's inbox.
  contextType?: 'HOUSEHOLD' | 'INSTITUTION';
  contextId?: string;
  createdAt: any;
}

export type Plan = 'basico' | 'avancado';
export type GroupType = 'CPF' | 'CNPJ';
export type Pilar = 'FAMILIAR' | 'PESSOAL' | 'PROFISSIONAL' | 'ESPIRITUAL';
export type ModuleContext = 'pessoal' | 'profissional';

export type UserContext = {
  plan: Plan;
  groupType: GroupType;
  context: ModuleContext;
  isPlatformAdmin: boolean;
  activeGroupId: string | null;
};

export function contextFromGroup(
  group: { type?: string; planType?: string } | null | undefined,
  user: {
    isPlatformAdmin?: boolean;
    activeGroupId?: string | null;
    ownedGroupIds?: string[];
    memberOfGroupIds?: string[];
  } | null | undefined
): UserContext {
  const rawType = (group?.type ?? 'CPF').toUpperCase();
  const groupType: GroupType = rawType === 'CNPJ' ? 'CNPJ' : 'CPF';

  const rawPlan = (group?.planType ?? 'basico').toLowerCase();
  const plan: Plan =
    rawPlan.includes('avanc') || rawPlan.includes('pro') || rawPlan.includes('premium')
      ? 'avancado'
      : 'basico';

  const activeGroupId =
    user?.activeGroupId ??
    user?.ownedGroupIds?.[0] ??
    user?.memberOfGroupIds?.[0] ??
    null;

  return {
    plan,
    groupType,
    context: groupType === 'CNPJ' ? 'profissional' : 'pessoal',
    isPlatformAdmin: user?.isPlatformAdmin ?? false,
    activeGroupId,
  };
}

export type MenuKey =
  | 'visao-global'
  | 'dashboard'
  | 'agente-ohel'
  | 'minhas-tarefas'
  | 'mensagens'
  | 'ordem-no-caos'
  | 'gestao-pessoal'
  | 'gestao-institucional';

export const MENU_RULES: Record<MenuKey, (ctx: UserContext) => boolean> = {
  'visao-global': (ctx) => ctx.isPlatformAdmin,
  dashboard: () => true,
  'agente-ohel': () => true,
  'minhas-tarefas': () => true,
  mensagens: () => true,
  'ordem-no-caos': () => true,
  'gestao-pessoal': (ctx) => ctx.isPlatformAdmin || ctx.context === 'pessoal',
  'gestao-institucional': (ctx) => ctx.isPlatformAdmin || ctx.context === 'profissional',
};

export const canSeeModelos = (ctx: UserContext) =>
  ctx.isPlatformAdmin || ctx.plan === 'avancado';

export const canSeeVideoCall = (ctx: UserContext) =>
  ctx.isPlatformAdmin || (ctx.context === 'profissional' && ctx.plan === 'avancado');

export const SUBMODULOS_GESTAO_PESSOAL = {
  'documentos-casa': 'basico',
  'financeiro-casa': 'basico',
  missoes: 'avancado',
  biblioteca: 'avancado',
  logistica: 'avancado',
} as const;

export const canSeeSubmoduloPessoal = (ctx: UserContext, subKey: string) => {
  if (ctx.isPlatformAdmin) return true;
  const min = (SUBMODULOS_GESTAO_PESSOAL as Record<string, string>)[subKey];
  if (!min) return false;
  return min === 'basico' ? true : ctx.plan === 'avancado';
};

export const PILARES: Pilar[] = ['FAMILIAR', 'PESSOAL', 'PROFISSIONAL', 'ESPIRITUAL'];

export const PILAR_VIEW_MAP: Record<Pilar, string> = {
  FAMILIAR: 'familiar',
  PESSOAL: 'pessoal',
  PROFISSIONAL: 'profissional',
  ESPIRITUAL: 'espiritual',
};

export const PILAR_CONFIG: Record<
  Pilar,
  { cor: string; label: string; subtitulo: string; abas: string[] }
> = {
  FAMILIAR: {
    cor: '#a855f7',
    label: 'Pilar Familiar',
    subtitulo: 'O coração da sua casa e memórias da sua família',
    abas: ['Mural da Família', 'Álbum da Família'],
  },
  PESSOAL: {
    cor: '#38bdf8',
    label: 'Pilar Pessoal',
    subtitulo: 'Descarrego mental com IA, humor, hábitos, alimentação e treinos',
    abas: ['Hábitos & Saúde', 'Descarrego Mental & Humor IA', 'Cardápio & Calorias', 'Área Fitness'],
  },
  PROFISSIONAL: {
    cor: '#3b82f6',
    label: 'Pilar Profissional',
    subtitulo: 'Carreira, equipe e produtividade',
    abas: ['Equipe & Usuários', 'Chat da Equipe', 'Grupos'],
  },
  ESPIRITUAL: {
    cor: '#ef4444',
    label: 'Pilar Espiritual',
    subtitulo: 'Metas espirituais, devocionais e propósito',
    abas: ['Devocionais', 'Hábitos Espirituais', 'Rotina de Propósito'],
  },
};

export const PILAR_TAB_CONFIG: Record<
  Pilar,
  { defaultTab: string; tabs: { key: string; label: string }[] }
> = {
  FAMILIAR: {
    defaultTab: 'mural-familiar',
    tabs: [
      { key: 'mural-familiar', label: 'Mural da Família' },
      { key: 'album-familiar', label: 'Álbum da Família' },
    ],
  },
  PESSOAL: {
    defaultTab: 'habitos-saude',
    tabs: [
      { key: 'habitos-saude', label: 'Hábitos & Saúde' },
      { key: 'descarrego', label: 'Descarrego Mental & Humor IA' },
      { key: 'cardapio', label: 'Cardápio & Calorias' },
      { key: 'fitness', label: 'Área Fitness' },
    ],
  },
  PROFISSIONAL: {
    defaultTab: 'equipe',
    tabs: [
      { key: 'equipe', label: 'Equipe & Usuários' },
      { key: 'chat', label: 'Chat da Equipe' },
      { key: 'grupos', label: 'Grupos' },
    ],
  },
  ESPIRITUAL: {
    defaultTab: 'devocionais',
    tabs: [
      { key: 'devocionais', label: 'Devocionais' },
      { key: 'habitos-espirituais', label: 'Hábitos Espirituais' },
      { key: 'proposito', label: 'Rotina de Propósito' },
    ],
  },
};

export const GESTAO_PESSOAL_SUBMODULES = [
  { key: 'documentos-casa', label: 'Documentos da Casa', minPlan: 'basico' },
  { key: 'financeiro-casa', label: 'Financeiro da Casa', minPlan: 'basico' },
  { key: 'missoes', label: 'Missões', minPlan: 'avancado' },
  { key: 'biblioteca', label: 'Biblioteca', minPlan: 'avancado' },
  { key: 'logistica', label: 'Logística', minPlan: 'avancado' },
] as const;

export const planRank: Record<Plan, number> = {
  basico: 1,
  avancado: 2,
};

export const hasMinPlan = (ctx: UserContext, min: Plan) =>
  ctx.isPlatformAdmin || planRank[ctx.plan] >= planRank[min];

export const canSeeModelosDeTarefa = canSeeModelos;

export const MODULE_RULES = MENU_RULES;

export const canAccessView = (
  view: string,
  ctx: UserContext,
  flags?: {
    isMaster?: boolean;
    isPersonal?: boolean;
    isInstitutionOwner?: boolean;
    isMember?: boolean;
    hasActiveContext?: boolean;
  },
) => {
  const isMaster = Boolean(flags?.isMaster);
  const isPersonal = Boolean(flags?.isPersonal);
  const isInstitutionOwner = Boolean(flags?.isInstitutionOwner);
  const isMember = Boolean(flags?.isMember);
  const hasActiveContext = Boolean(flags?.hasActiveContext);

  switch (view) {
    case 'visao-global':
    case 'global-platform':
      return isMaster || ctx.isPlatformAdmin;
    case 'dashboard':
    case 'agent':
    case 'messages':
    case 'ordem-no-caos':
      return MENU_RULES[(view === 'dashboard' ? 'dashboard' : view === 'agent' ? 'agente-ohel' : view === 'messages' ? 'mensagens' : 'ordem-no-caos')](ctx);
    case 'calendar':
    case 'minhas-tarefas':
      return MENU_RULES['minhas-tarefas'](ctx);
    case 'documentos':
      return ctx.context === 'pessoal' || isPersonal;
    case 'biblioteca':
      return hasMinPlan(ctx, 'avancado');
    case 'missions':
      return ctx.context === 'pessoal' && hasMinPlan(ctx, 'avancado');
    case 'logistics':
      return ctx.context === 'pessoal' && hasMinPlan(ctx, 'avancado');
    case 'institution':
      return isInstitutionOwner || isMaster || ctx.context === 'profissional';
    case 'ranking':
      return hasActiveContext && !isPersonal;
    case 'templates':
      return canSeeModelos(ctx);
    case 'video-call':
      return canSeeVideoCall(ctx);
    case 'plans':
      return true;
    case 'admin-panel':
      return isMaster || ctx.isPlatformAdmin;
    case 'notifications':
      return isInstitutionOwner || isMaster || isMember || ctx.context === 'profissional';
    case 'profile':
      return true;
    default:
      return true;
  }
};


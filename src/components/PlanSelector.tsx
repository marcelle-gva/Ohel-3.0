import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Shield, Crown, ArrowRight, User as UserIcon, Building2, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { PLAN_LIMITS, MEMBER_UPGRADE_PRICE } from '@/types';

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

// Exactly 2 tiers per account kind (product decision 2026-09-17). Prices
// come from PLAN_LIMITS in types.ts so this file never drifts from the
// canonical plan config; only marketing copy (name/description/features)
// lives here.
const PERSONAL_PLANS: PlanData[] = [
  {
    id: 'PERSONAL_BASIC',
    name: 'PESSOAL BÁSICO',
    basePrice: PLAN_LIMITS.PERSONAL_BASIC.price.replace('R$ ', ''),
    description: 'Organize sua rotina e a da sua casa nos 4 pilares.',
    features: [
      'Matriz de Eisenhower Pro',
      'Casa própria + até 5 membros',
      'Calendário unificado (casa + instituições)',
      'Ranking familiar',
      'Sincronização em Tempo Real'
    ],
    icon: Zap,
    color: 'from-slate-500 to-blue-600',
    lightColor: 'bg-blue-500/10',
    textColor: 'text-blue-600'
  },
  {
    id: 'PERSONAL_PLUS',
    name: 'PESSOAL PLUS',
    basePrice: PLAN_LIMITS.PERSONAL_PLUS.price.replace('R$ ', ''),
    description: 'Tudo do Básico, sem limites e com recursos completos.',
    features: [
      'Tudo do Plano Básico',
      'Até 10 membros na casa',
      'Videochamada',
      'Modelos de tarefa',
      'Documentos anexados + Álbum de fotos'
    ],
    icon: Crown,
    color: 'from-amber-500 to-emerald-600',
    lightColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    popular: true
  }
];

interface PlanData {
  id: string;
  name: string;
  basePrice: string;
  isCustom?: boolean;
  description: string;
  features: string[];
  icon: any;
  color: string;
  lightColor: string;
  textColor: string;
  popular?: boolean;
}

const INSTITUTION_PLANS: PlanData[] = [
  {
    id: 'INSTITUTION_BASIC',
    name: 'INSTITUCIONAL BÁSICO',
    basePrice: PLAN_LIMITS.INSTITUTION_BASIC.price.replace('R$ ', ''),
    description: 'Gestão completa para instituições de qualquer porte.',
    features: [
      'Painel de Gestão Completo',
      'Até 25 Membros na Equipe',
      'Grupos com permissões (ex: Tesouraria)',
      'Tickets + chat por tarefa',
      'Sistema de Missões e Ranking'
    ],
    icon: Shield,
    color: 'from-blue-600 to-indigo-700',
    lightColor: 'bg-blue-500/10',
    textColor: 'text-blue-600'
  },
  {
    id: 'INSTITUTION_PLUS',
    name: 'INSTITUCIONAL PLUS',
    basePrice: PLAN_LIMITS.INSTITUTION_PLUS.price.replace('R$ ', ''),
    description: 'Sem limite de membros, com recursos completos pra equipe toda.',
    features: [
      'Tudo do Plano Básico',
      'Membros ILIMITADOS',
      'Videochamada',
      'Modelos de tarefa',
      'Documentos anexados + Álbum de fotos'
    ],
    icon: Crown,
    color: 'from-purple-600 to-indigo-800',
    lightColor: 'bg-purple-500/10',
    textColor: 'text-purple-600',
    popular: true
  }
];

interface PlanSelectorProps {
  onUpgrade?: (planId: string) => void;
  currentPlan?: string;
  hasAdminDiscount?: boolean;
  forceType?: 'PERSONAL' | 'INSTITUTION';
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({ onUpgrade, currentPlan, hasAdminDiscount, forceType }) => {
  const { userData } = useAuth();
  const [dbPricing, setDbPricing] = useState<any>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  
  const isMember = userData?.institutionId && userData?.role === 'MEMBER';
  const isOwner = userData?.type === 'institution_owner' || userData?.role === 'ADMIN';
  
  const [selectedType, setSelectedType] = useState<'PERSONAL' | 'INSTITUTION'>(
    forceType || (isOwner ? 'INSTITUTION' : 'PERSONAL')
  );

  const effectiveType = forceType || selectedType;

  // Update selectedType if forceType changes
  React.useEffect(() => {
    if (forceType) {
      setSelectedType(forceType);
    }
  }, [forceType]);

  // Sync with Firestore Pricing
  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      if (snap.exists()) setDbPricing(snap.data());
    }, (error) => {
      console.warn('Config pricing snapshot error:', error);
    });
    return () => unsub();
  }, []);

  const getPrice = (id: string, fallback: string) => {
    return dbPricing?.[id]?.price || fallback;
  };

  const plans = (effectiveType === 'PERSONAL' ? PERSONAL_PLANS : INSTITUTION_PLANS).map(p => ({
    ...p,
    basePrice: getPrice(p.id, p.basePrice)
  }));

  const upgradePrice = dbPricing?.MEMBER_UPGRADE?.price || MEMBER_UPGRADE_PRICE;

  const handlePlanClick = async (plan: PlanData) => {
    if (currentPlan === plan.id) return;

    try {
      setLoadingPlanId(plan.id);

      if (plan.isCustom) {
        toast.info('Direcionando para atendimento de consultoria personalizada...', { duration: 4000 });
        if (onUpgrade) {
          await onUpgrade(plan.id);
        } else {
          window.open('https://wa.me/5511999999999?text=Ol%C3%A1,%20gostaria%20de%20saber%20mais%20sobre%20o%20Plano%20Institucional%20Avan%C3%A7ado%20do%20OHEL', '_blank');
        }
        return;
      }

      if (onUpgrade) {
        await onUpgrade(plan.id);
      }
    } catch (err: any) {
      console.error('Erro ao selecionar plano:', err);
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 md:px-8 space-y-12">
      {/* Banner de Upgrade para Membros */}
      {isMember && (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white overflow-hidden shadow-2xl border-none">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-none px-4 py-1 font-black tracking-widest text-[10px]">
                UPGRADE EXCLUSIVO
              </Badge>
              <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter">DESEJA SUA PRÓPRIA ORGANIZAÇÃO PESSOAL?</h2>
              <p className="text-white/80 font-bold max-w-xl text-sm md:text-base">
                Como membro, você pode adicionar sua jornada pessoal por apenas <span className="text-white font-black">R$ {upgradePrice}</span>/mês.
              </p>
            </div>
            <Button 
              id="btn-upgrade-member-personal"
              className="bg-white text-blue-700 hover:bg-blue-50 h-16 px-8 rounded-2xl font-black tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              onClick={() => setSelectedType('PERSONAL')}
            >
              FAZER UPGRADE AGORA
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Seletor de Perfil (somente se não houver forceType explícito e não for owner/member fixo) */}
      {!forceType && !isOwner && !isMember && (
        <div className="flex justify-center">
          <div className="bg-muted p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
            <Button
              id="btn-tab-plan-personal"
              variant={effectiveType === 'PERSONAL' ? 'default' : 'ghost'}
              className={cn("rounded-xl font-bold gap-2", effectiveType === 'PERSONAL' && "shadow-lg")}
              onClick={() => setSelectedType('PERSONAL')}
            >
              <UserIcon className="w-4 h-4" />
              Plano Pessoal (CPF)
            </Button>
            <Button
              id="btn-tab-plan-institution"
              variant={effectiveType === 'INSTITUTION' ? 'default' : 'ghost'}
              className={cn("rounded-xl font-bold gap-2", effectiveType === 'INSTITUTION' && "shadow-lg")}
              onClick={() => setSelectedType('INSTITUTION')}
            >
              <Building2 className="w-4 h-4" />
              Plano Institucional (CNPJ)
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="text-center space-y-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 mb-2">
              {selectedType === 'PERSONAL' ? 'GESTAO PESSOAL' : 'MODO GESTOR'}
            </Badge>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic">
              {selectedType === 'PERSONAL' ? 'Planos Pessoais Disponíveis' : 'Planos Institucionais Ativos'}
            </h2>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const isLoading = loadingPlanId === plan.id;
          
          return (
            <Card key={plan.id} className={cn(
              "relative flex flex-col transition-all duration-500 hover:translate-y-[-8px] border-2 h-full",
              plan.popular ? "border-primary shadow-2xl shadow-primary/20 z-10 ring-4 ring-primary/10" : "border-border hover:border-primary/30",
              isCurrent && "border-emerald-500 bg-emerald-500/5 shadow-none"
            )}>
              <div className={cn(
                "absolute -top-3 left-0 right-0 h-10 flex items-center justify-center rounded-t-xl z-20 shadow-lg",
                plan.id.includes('BASIC') ? "bg-slate-600" : "bg-amber-600"
              )}>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                  30 Dias Totalmente Grátis
                </span>
              </div>

              {plan.popular && (
                <div className="absolute top-10 right-4 z-20">
                  <Badge className="bg-primary text-primary-foreground px-3 py-0.5 font-black text-[8px] tracking-widest shadow-lg animate-bounce">
                    RECOMENDADO
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pt-14 pb-4 space-y-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto shadow-inner transform group-hover:rotate-6 transition-transform duration-500",
                  plan.color
                )}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black italic tracking-tighter uppercase">{plan.name}</CardTitle>
                </div>

                <CardDescription className="text-xs font-bold leading-tight px-4 h-12 flex items-center justify-center text-center opacity-80">
                  {plan.description}
                </CardDescription>

                <div className="pt-6 pb-2 border-y border-dashed border-border/60">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-baseline gap-1">
                      {!plan.isCustom && <span className="text-muted-foreground text-[10px] font-black self-start mt-1 uppercase tracking-widest">R$</span>}
                      <span className={cn("font-black tracking-tighter italic", plan.isCustom ? "text-3xl" : "text-5xl")}>
                        {plan.basePrice}
                      </span>
                      {!plan.isCustom && <span className="text-muted-foreground text-[10px] font-black self-end mb-1 uppercase tracking-widest">/mês</span>}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 pt-8 pb-8 px-8">
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-4 text-xs font-bold leading-tight">
                      <div className={cn(
                        "w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                        plan.lightColor,
                        plan.textColor
                      )}>
                        <Check className="w-3.5 h-3.5 stroke-[4px]" />
                      </div>
                      <span className="opacity-90 pt-0.5">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-0 pb-10 px-8">
                <Button 
                  id={`btn-select-${plan.id.toLowerCase().replace(/_/g, '-')}`}
                  variant={isCurrent ? 'outline' : 'default'} 
                  className={cn(
                    "w-full h-16 rounded-3xl font-black tracking-[0.25em] uppercase text-[11px] border-2 transition-all duration-300 transform active:scale-95 group",
                    !isCurrent ? cn("bg-gradient-to-r shadow-2xl hover:shadow-primary/50 text-white cursor-pointer", plan.color) : "border-emerald-500 text-emerald-500 hover:bg-emerald-50"
                  )}
                  disabled={isCurrent || isLoading}
                  onClick={() => handlePlanClick(plan)}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Iniciando...
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Plano Ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {plan.isCustom ? (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Falar com Consultor
                        </>
                      ) : (
                        <>
                          Começar teste grátis
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

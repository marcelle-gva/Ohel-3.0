import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { LogIn, Building2, User, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PlanSelector } from './PlanSelector';
import { cn } from '@/lib/utils';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import defaultLogo from '@/assets/ohel-church-logo.png';

export const AuthSelector: React.FC = () => {
  const { user, loginWithGoogle, validateInviteCode, setProfileType, setViewMode, linkUserToInstitution, joinHousehold } = useAuth();
  const logoURL = localStorage.getItem('ohel_custom_logo') || defaultLogo;
  const [step, setStep] = useState<'choice' | 'personal-plans' | 'institution-plans' | 'institutional'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Botão 1: Uso Pessoal (CPF) - Acesso ou Login Direto
  const handlePersonalClick = async () => {
    try {
      if (user) {
        // Usuário já autenticado: atualiza perfil no Firestore e ativa modo pessoal instantaneamente
        try {
          await setDoc(doc(db, 'users', user.uid), {
            type: 'personal',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn('Erro ao atualizar doc de usuário:', e);
        }
        setViewMode('PERSONAL');
        setProfileType('personal');
        localStorage.setItem('viewMode', 'PERSONAL');
        localStorage.setItem('userType', 'personal');
        toast.success('Bem-vindo(a) ao seu espaço de Uso Pessoal!');
      } else {
        // Usuário não autenticado: login direto com Google (Perfil Pessoal)
        await handleDirectGoogleLogin('personal');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao acessar Uso Pessoal');
    }
  };

  // Login direto com Google
  const handleDirectGoogleLogin = async (targetProfile: 'personal' | 'institutional') => {
    try {
      setIsLoggingIn(true);
      const targetViewMode = targetProfile === 'personal' ? 'PERSONAL' : 'INSTITUTION_OWNER';
      localStorage.setItem('pending_profile_type', targetProfile);
      localStorage.setItem('viewMode', targetViewMode);
      localStorage.setItem('userType', targetProfile);
      setProfileType(targetProfile);
      setViewMode(targetViewMode);
      await loginWithGoogle();
      window.location.reload();
    } catch (err: any) {
      // Errors are handled with specific messaging inside loginWithGoogle()
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Seleção de Plano (Pessoal ou Institucional)
  const handlePlanSelection = async (planId: string) => {
    try {
      setSelectedPlan(planId);
      const isPersonalPlan = planId.startsWith('PERSONAL_');
      const profile = isPersonalPlan ? 'personal' : 'institutional';
      const targetViewMode = isPersonalPlan ? 'PERSONAL' : 'INSTITUTION_OWNER';

      localStorage.setItem('pending_plan_type', planId);
      localStorage.setItem('pending_profile_type', profile);
      localStorage.setItem('viewMode', targetViewMode);
      localStorage.setItem('userType', profile);

      if (user) {
        const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        
        await setDoc(doc(db, 'subscriptions', user.uid), {
          userId: user.uid,
          planType: planId,
          status: 'TRIAL',
          trialEndsAt,
          expiresAt: trialEndsAt,
          profileType: profile,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'users', user.uid), {
          type: isPersonalPlan ? 'personal' : 'institution_owner',
          planType: planId,
          updatedAt: serverTimestamp()
        }, { merge: true });

        localStorage.removeItem('pending_plan_type');
        localStorage.removeItem('pending_profile_type');
        setViewMode(targetViewMode);
        setProfileType(profile);
        toast.success(`Plano ${planId.replace(/_/g, ' ')} ativado com 30 dias de teste grátis!`);
      } else {
        setIsLoggingIn(true);
        toast.info('Iniciando acesso com Google para ativar seu teste de 30 dias grátis...', { duration: 3000 });
        await loginWithGoogle();
      }
    } catch (err: any) {
      console.warn('Erro ao processar plano selecionado:', err);
      // login errors already provide specific toasts
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Entrada via código de convite — detecta sozinho se é Casa (CPF) ou
  // Instituição (CNPJ), conforme decidido em 2026-09-17: "ou insiro o token
  // de membro (e ele valida se sou membro de CNPJ ou CPF)".
  const handleInstitutionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateInviteCode(inviteCode);
      if (!result.valid || !result.type) {
        setError(result.error || 'Código de convite inválido ou expirado.');
        toast.error('Código inválido');
        return;
      }

      if (user) {
        if (result.type === 'HOUSEHOLD') {
          await joinHousehold(user.uid, inviteCode);
          toast.success(`Convite enviado para ${result.name}. Aguardando aceite do dono da casa.`);
        } else {
          await linkUserToInstitution(user.uid, inviteCode);
          setViewMode('INSTITUTION_MEMBER');
          setProfileType('institutional');
          toast.success(`Vinculado a ${result.name}!`);
        }
      } else {
        localStorage.setItem('pending_invite_code', inviteCode);
        localStorage.setItem('pending_invite_kind', result.type);
        localStorage.setItem('pending_profile_type', 'institutional');
        localStorage.setItem('viewMode', 'INSTITUTION_MEMBER');
        setProfileType('institutional');
        setViewMode('INSTITUTION_MEMBER');
        await loginWithGoogle();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na validação');
    } finally {
      setIsValidating(false);
    }
  };

  const isWideStep = step === 'choice' || step === 'personal-plans' || step === 'institution-plans';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className={cn(
        "transition-all duration-500",
        isWideStep ? "max-w-7xl w-full" : "max-w-md w-full"
      )}>
        <AnimatePresence mode="wait">
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="w-full max-w-5xl"
            >
              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#020d1a]/90 px-6 py-6 shadow-[0_0_80px_rgba(59,130,246,0.18)] md:px-8 md:py-8">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
                  <div className="absolute right-[-60px] top-10 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
                  <div className="absolute bottom-0 left-1/2 h-36 w-[120%] -translate-x-1/2 rounded-[50%] bg-cyan-400/10 blur-3xl" />
                </div>

                <div className="relative z-10">
                  <div className="mb-6 flex flex-col items-center justify-center text-center">
                    <img
                      src={logoURL}
                      alt="Igreja Pentecostal OHEL"
                      className="h-auto max-h-32 w-full max-w-[520px] object-contain drop-shadow-[0_0_30px_rgba(34,211,238,0.18)]"
                    />
                    <div className="mt-2 inline-flex rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.44em] text-cyan-300 sm:text-[11px]">
                      Plataforma
                    </div>
                  </div>

                  <div className="mb-5 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/90 sm:text-[12px]">
                    <span className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-300 sm:w-12" />
                    A Ordem no Caos para sua Gestão
                    <span className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-300 sm:w-12" />
                  </div>

                  <div className="text-center">
                    <h2 className="text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">
                      Escolha como deseja começar
                    </h2>
                    <p className="mt-2 text-base text-slate-300">
                      Seja para uso pessoal ou para sua empresa, temos o plano ideal para você.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <button
                      id="btn-auth-personal"
                      onClick={handlePersonalClick}
                      disabled={isLoggingIn}
                      className="group relative overflow-hidden rounded-[24px] border border-cyan-400/40 bg-[#071b33] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.22)] disabled:opacity-75"
                    >
                      <div className="absolute right-0 top-0 rounded-bl-2xl bg-cyan-500 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-950 shadow-sm">
                        Mais completo
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/25 group-hover:bg-cyan-500 group-hover:text-slate-950">
                          <User className="h-7 w-7" />
                        </div>
                        <div className="flex-1 pr-12">
                          <h3 className="text-2xl font-black tracking-[-0.05em] text-white">Uso Pessoal</h3>
                          <p className="mt-1 text-sm leading-5 text-slate-300">
                            Organize sua vida, cuide dos seus hábitos, metas e rotina diária.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2 text-sm text-slate-200">
                        {[
                          'Módulos essenciais',
                          'Hábitos e saúde',
                          'Gestão pessoal',
                          'Planejamento e foco',
                        ].map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] text-cyan-300">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-between">
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1">Básico</span>
                          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1">Pro</span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 transition-transform group-hover:translate-x-0.5">
                          Selecionar <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </button>

                    <button
                      id="btn-auth-institution"
                      onClick={() => setStep('institution-plans')}
                      disabled={isLoggingIn}
                      className="group relative overflow-hidden rounded-[24px] border border-violet-400/40 bg-[#120d2d] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.22)] disabled:opacity-75"
                    >
                      <div className="absolute right-0 top-0 rounded-bl-2xl bg-violet-500 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-sm">
                        Mais completo
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/25 group-hover:bg-violet-500 group-hover:text-white">
                          <ShieldCheck className="h-7 w-7" />
                        </div>
                        <div className="flex-1 pr-12">
                          <h3 className="text-2xl font-black tracking-[-0.05em] text-white">CNPJ</h3>
                          <p className="mt-1 text-sm leading-5 text-slate-300">
                            Para empresas, instituições e equipes que precisam de mais controle.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2 text-sm text-slate-200">
                        {[
                          'Gestão eficiente para equipes',
                          'Atividades e relatórios',
                          'Módulos essenciais',
                          'Controle de acesso e priorização',
                        ].map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-[10px] text-violet-300">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-between">
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1">Básico</span>
                          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1">Pro</span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-black text-white transition-transform group-hover:translate-x-0.5">
                          Selecionar <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </button>
                  </div>

                  <form
                    onSubmit={handleInstitutionalSubmit}
                    className="mt-8 flex flex-col gap-3 rounded-[22px] border border-cyan-400/20 bg-[#071b33]/80 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/25">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-black tracking-[-0.04em] text-white">Já tem um código de acesso?</div>
                        <div className="text-xs text-slate-300">Use o código recebido para entrar em sua casa ou instituição.</div>
                      </div>
                    </div>

                    <div className="flex w-full max-w-xl items-center gap-2 md:justify-end">
                      <Input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Digite o código de acesso"
                        className="h-12 rounded-xl border-white/10 bg-slate-950/40 text-white placeholder:text-slate-400"
                      />
                      <Button
                        type="submit"
                        disabled={isValidating || !inviteCode.trim()}
                        className="h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110"
                      >
                        {isValidating ? 'Validando...' : 'Acessar'}
                      </Button>
                    </div>
                  </form>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-white/10 pt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-300">✓</span>
                      Mais organização
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-300">✓</span>
                      Mais resultados
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-300">✓</span>
                      Mais foco
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : step === 'personal-plans' ? (
            /* Tela Exclusiva: Planos Pessoais (CPF) */
            <motion.div
              key="personal-plans"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep('choice')}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Voltar para opções
                </Button>
                
                {!user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDirectGoogleLogin('personal')}
                    disabled={isLoggingIn}
                    className="rounded-xl font-bold gap-2 text-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
                  </Button>
                )}
              </div>
              
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  Planos Pessoais (CPF)
                </div>
                <h2 className="text-2xl font-black italic tracking-tighter text-primary">ESCOLHA SEU TESTE DE 30 DIAS</h2>
                <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
                  Acesso individual completo. Sem cobrança imediata.
                </p>
              </div>

              {/* Forçado estritamente para PERSONAL - sem botões de CNPJ */}
              <PlanSelector forceType="PERSONAL" onUpgrade={handlePlanSelection} />
              
              <div className="flex justify-center pt-4">
                <Button variant="ghost" onClick={() => setStep('choice')} className="uppercase tracking-widest text-xs font-bold">
                  Voltar para opções
                </Button>
              </div>
            </motion.div>
          ) : step === 'institution-plans' ? (
            /* Tela Exclusiva: Planos Institucionais (CNPJ) */
            <motion.div
              key="institution-plans"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep('choice')}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Voltar para opções
                </Button>

                {!user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDirectGoogleLogin('institutional')}
                    disabled={isLoggingIn}
                    className="rounded-xl font-bold gap-2 text-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
                  </Button>
                )}
              </div>
              
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5" />
                  Planos Institucionais (CNPJ)
                </div>
                <h2 className="text-2xl font-black italic tracking-tighter text-primary">ESCOLHA O TESTE DA SUA INSTITUIÇÃO</h2>
                <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
                  Acesso corporativo completo para sua equipe. 30 dias grátis.
                </p>
              </div>

              {/* Forçado estritamente para INSTITUTION - sem botões de CPF */}
              <PlanSelector forceType="INSTITUTION" onUpgrade={handlePlanSelection} />
              
              <div className="flex justify-center pt-4">
                <Button variant="ghost" onClick={() => setStep('choice')} className="uppercase tracking-widest text-xs font-bold">
                  Voltar para opções
                </Button>
              </div>
            </motion.div>
          ) : (
            /* Tela: Membro de Instituição com Código */
            <motion.div
              key="institutional"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="bg-card border rounded-2xl p-8 shadow-xl space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Código de Convite
                </h3>
                <p className="text-sm text-muted-foreground">Digite o código recebido — funciona tanto pra entrar numa Casa (convite de família) quanto numa Instituição.</p>
              </div>

              <form onSubmit={handleInstitutionalSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Código de Convite</Label>
                  <Input 
                    id="inviteCode"
                    placeholder="Ex: OHEL-XXXX-XXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="h-12 text-lg tracking-widest font-mono"
                    disabled={isValidating}
                  />
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg gap-2"
                    disabled={isValidating || !inviteCode.trim()}
                  >
                    {isValidating ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Validar e Entrar
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setStep('choice')}
                    disabled={isValidating}
                  >
                    Voltar para opções
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center mt-8 text-xs text-muted-foreground uppercase tracking-widest font-medium">
          Powered by Firebase Authentication
        </p>
      </div>
    </div>
  );
};

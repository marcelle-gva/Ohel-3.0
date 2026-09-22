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

export const AuthSelector: React.FC = () => {
  const { user, loginWithGoogle, validateInviteCode, setProfileType, setViewMode, linkUserToInstitution, joinHousehold } = useAuth();
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

  const isWideStep = step === 'personal-plans' || step === 'institution-plans';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className={cn(
        "transition-all duration-500",
        isWideStep ? "max-w-7xl w-full" : "max-w-md w-full"
      )}>
        <div className="text-center mb-8 space-y-2">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-3xl mx-auto shadow-lg shadow-primary/20 mb-4"
          >
            O
          </motion.div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">OHEL PLATFORM</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">A Ordem no Caos para sua Gestão</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="space-y-4"
            >
              {/* Botão 1: Uso Pessoal (CPF) */}
              <div className="relative group">
                <button
                  id="btn-auth-personal"
                  onClick={handlePersonalClick}
                  disabled={isLoggingIn}
                  className="w-full p-6 bg-card border-2 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all text-left relative overflow-hidden active:scale-[0.99] disabled:opacity-75"
                >
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] px-3 py-1 font-black uppercase tracking-widest rounded-bl-xl shadow-sm">
                    CPF • 30 Dias Grátis
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 pr-12">
                      <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                        Uso Pessoal (CPF)
                        {isLoggingIn && (
                          <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            Entrando...
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">Gerencie suas tarefas, foco, finanças e metas individuais.</p>
                      
                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          {user ? 'Acessar Meu Espaço Pessoal' : 'Entrar com Google (Teste Grátis)'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                        
                        {!user && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStep('personal-plans');
                            }}
                            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            Ver detalhes dos planos CPF
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </button>
              </div>

              {/* Botão 2: Criar Minha Instituição (CNPJ) */}
              <div className="relative group">
                <button
                  id="btn-auth-institution"
                  onClick={() => setStep('institution-plans')}
                  disabled={isLoggingIn}
                  className="w-full p-6 bg-card border-2 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-500/50 transition-all text-left relative overflow-hidden active:scale-[0.99] disabled:opacity-75"
                >
                  <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] px-3 py-1 font-black uppercase tracking-widest rounded-bl-xl shadow-sm">
                    CNPJ • 30 Dias Grátis
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1 pr-12">
                      <h3 className="font-bold text-lg text-foreground">Criar Minha Instituição (CNPJ)</h3>
                      <p className="text-sm text-muted-foreground">Registre sua equipe, empresa ou organização com teste gratuito corporativo.</p>
                      
                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          Ver Planos Institucionais (CNPJ)
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>

                        {!user && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectGoogleLogin('institutional');
                            }}
                            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            Entrar direto com Google (Gestor)
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 transition-colors shrink-0" />
                  </div>
                </button>
              </div>

              {/* Botão 3: Membro de Casa ou Instituição (Código de Convite) */}
              <button
                id="btn-auth-member"
                onClick={() => setStep('institutional')}
                className="w-full p-6 bg-card border rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-foreground">Tenho um código de convite</h3>
                    <p className="text-sm text-muted-foreground">De uma Casa (família) ou de uma Instituição — o sistema identifica sozinho.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
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

import React, { useState } from 'react';
import { Institution, OperationType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { db, handleFirestoreError } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  Percent, 
  Calendar, 
  CalendarPlus,
  TrendingUp,
  CreditCard,
  Save,
  Users,
  User as UserIcon,
  Mail,
  Settings
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PlatformAdminPanelProps {
  institutions: Institution[];
}

export const PlatformAdminPanel: React.FC<PlatformAdminPanelProps> = ({ institutions }) => {
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [daysToAdd, setDaysToAdd] = useState<number>(7);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [masterEmails, setMasterEmails] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load configs from Firestore
  React.useEffect(() => {
    const unsubPricing = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      if (snap.exists()) {
        setPricingConfig(snap.data());
      } else {
        setPricingConfig({
          PERSONAL_BASIC: { maxUsers: 2, price: '49,90' },
          PERSONAL_INTERMEDIATE: { maxUsers: 5, price: '69,90' },
          PERSONAL_ADVANCED: { maxUsers: 10, price: '99,90' },
          INSTITUTION_BASIC: { maxUsers: 25, price: '149,90' },
          INSTITUTION_INTERMEDIATE: { maxUsers: 75, price: '449,90' },
          INSTITUTION_ADVANCED: { maxUsers: 0, price: 'A COMBINAR' },
          MEMBER_UPGRADE: { price: '29,90' }
        });
      }
    });

    const unsubMaster = onSnapshot(doc(db, 'config', 'master'), (snap) => {
      if (snap.exists()) {
        setMasterEmails(snap.data().albumNotificationEmails || '');
      }
    });

    return () => {
      unsubPricing();
      unsubMaster();
    };
  }, []);

  const savePricing = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'pricing'), pricingConfig);
      toast.success('Configuração de preços salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar preços');
    } finally {
      setIsSaving(false);
    }
  };

  const saveMasterConfig = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'master'), {
        albumNotificationEmails: masterEmails,
        updatedAt: Date.now()
      }, { merge: true });
      toast.success('Configurações master salvas!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDiscount = async (instId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'institutions', instId), {
        hasAdminDiscount: !currentStatus
      });
      toast.success(currentStatus ? 'Desconto removido.' : 'Desconto de 5% concedido!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `institutions/${instId}`);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedInst || daysToAdd < 1) return;

    try {
      const now = Date.now();
      const currentEndsAt = selectedInst.trialEndsAt || now;
      const baseDate = currentEndsAt > now ? currentEndsAt : now;
      const newEndsAt = baseDate + (daysToAdd * 24 * 60 * 60 * 1000);

      await updateDoc(doc(db, 'institutions', selectedInst.id), {
        trialEndsAt: newEndsAt,
        subscriptionStatus: 'TRIAL'
      });

      toast.success(`Teste grátis estendido em ${daysToAdd} dias para a instituição ${selectedInst.name}.`);
      setSelectedInst(null);
      setDaysToAdd(7);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `institutions/${selectedInst.id}`);
    }
  };

  const getTrialStatus = (trialEndsAt?: number) => {
    if (!trialEndsAt) return { label: 'Sem Trial', color: 'bg-muted text-muted-foreground' };
    const now = Date.now();
    const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { label: 'Trial Expirado', color: 'bg-destructive/10 text-destructive' };
    return { label: `${daysLeft} dias restantes`, color: 'bg-green-500/10 text-green-500' };
  };

  const getPrice = (plan: string, hasDiscount: boolean) => {
    const prices: Record<string, number> = {
      'BASIC': 29,
      'INTERMEDIATE': 149,
      'ADVANCED': 439
    };
    const base = prices[plan] || 0;
    return hasDiscount ? (base * 0.95).toFixed(2) : base.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tight uppercase italic italic-shaping">Gestão Estratégica</h2>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          Painel Administrativo VIP (Marcelle)
        </Badge>
      </div>

      <Tabs defaultValue="institutions" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-2xl">
          <TabsTrigger value="institutions" className="rounded-xl font-bold gap-2">
            <Building2 className="w-4 h-4" />
            Instituições
          </TabsTrigger>
          <TabsTrigger value="pricing" className="rounded-xl font-bold gap-2">
            <CreditCard className="w-4 h-4" />
            Planos & Preços
          </TabsTrigger>
          <TabsTrigger value="master" className="rounded-xl font-bold gap-2">
            <Settings className="w-4 h-4" />
            Configurações Master
          </TabsTrigger>
        </TabsList>

        <TabsContent value="institutions" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {institutions.map((inst) => {
              const status = getTrialStatus(inst.trialEndsAt);
              return (
                <Card key={inst.id} className="hover:border-primary/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{inst.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest px-2">
                              Plano {inst.planType}
                            </Badge>
                            <Badge className={cn("text-[10px] uppercase tracking-widest px-2", status.color)}>
                              {status.label}
                            </Badge>
                            {inst.hasAdminDiscount && (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] uppercase tracking-widest px-2">
                                -5% OFF
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Finaliza em: {inst.trialEndsAt ? new Date(inst.trialEndsAt).toLocaleDateString('pt-BR') : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-right">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                          Faturamento Mensal
                        </p>
                        <div className="flex items-baseline gap-2">
                          {inst.hasAdminDiscount && (
                            <span className="text-xs text-muted-foreground line-through">
                              R$ {getPrice(inst.planType, false)}
                            </span>
                          )}
                          <span className="text-2xl font-black text-primary">
                            R$ {getPrice(inst.planType, !!inst.hasAdminDiscount)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-10 w-10 text-primary hover:bg-primary/5 hover:text-primary transition-colors"
                          onClick={() => setSelectedInst(inst)}
                          title="Estender Trial"
                        >
                          <CalendarPlus className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant={inst.hasAdminDiscount ? "destructive" : "default"}
                          className={cn(
                            "gap-2 font-bold uppercase tracking-widest text-[10px] h-10 px-4",
                            !inst.hasAdminDiscount && "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                          )}
                          onClick={() => toggleDiscount(inst.id, !!inst.hasAdminDiscount)}
                        >
                          <Percent className="w-3 h-3" />
                          {inst.hasAdminDiscount ? 'Remover' : '5% OFF'}
                        </Button>
                        <Button variant="outline" size="icon" className="h-10 w-10">
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {institutions.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed rounded-3xl opacity-50">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest">Nenhuma instituição cadastrada</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          {pricingConfig ? (
            <div className="space-y-8 pb-12">
              <div className="flex items-center justify-between bg-primary/5 p-6 rounded-2xl border border-primary/20">
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Configurações de Planos</h3>
                  <p className="text-xs text-muted-foreground font-bold">Gerencie os valores e limites operacionais de todos os níveis de acesso.</p>
                </div>
                <Button onClick={savePricing} disabled={isSaving} className="gap-2 rounded-xl font-black uppercase tracking-widest px-8">
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* PESSOAL */}
                <Card className="rounded-3xl border-2 hover:border-primary/20 transition-all shadow-sm">
                  <CardHeader className="border-b bg-muted/30 pb-4">
                    <div className="flex items-center gap-2 text-primary">
                      <UserIcon className="w-5 h-5" />
                      <CardTitle className="text-lg font-black uppercase italic tracking-tighter">Planos Pessoais (CPF)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {['PERSONAL_BASIC', 'PERSONAL_INTERMEDIATE', 'PERSONAL_ADVANCED'].map(pId => (
                      <div key={pId} className="space-y-4 p-4 rounded-2xl bg-muted/20 border">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{pId.split('_')[1]}</Label>
                          <Badge variant="outline" className="text-[8px] opacity-50">{pId}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-bold opacity-70">Preço (Ex: 49,90)</Label>
                            <Input 
                              className="font-bold h-10 rounded-xl"
                              value={pricingConfig[pId].price}
                              onChange={e => setPricingConfig({...pricingConfig, [pId]: {...pricingConfig[pId], price: e.target.value}})}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-bold opacity-70">Limite de Usuários</Label>
                            <Input 
                              type="number"
                              className="font-bold h-10 rounded-xl"
                              value={pricingConfig[pId].maxUsers}
                              onChange={e => setPricingConfig({...pricingConfig, [pId]: {...pricingConfig[pId], maxUsers: parseInt(e.target.value) || 0}})}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* INSTITUCIONAL */}
                <div className="space-y-8">
                  <Card className="rounded-3xl border-2 hover:border-primary/20 transition-all shadow-sm">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Building2 className="w-5 h-5" />
                        <CardTitle className="text-lg font-black uppercase italic tracking-tighter">Planos Institucionais (CNPJ)</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {['INSTITUTION_BASIC', 'INSTITUTION_INTERMEDIATE', 'INSTITUTION_ADVANCED'].map(pId => (
                        <div key={pId} className="space-y-4 p-4 rounded-2xl bg-muted/20 border">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{pId.split('_')[1]}</Label>
                            <Badge variant="outline" className="text-[8px] opacity-50">{pId}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-bold opacity-70">Preço</Label>
                              <Input 
                                className="font-bold h-10 rounded-xl"
                                value={pricingConfig[pId].price}
                                onChange={e => setPricingConfig({...pricingConfig, [pId]: {...pricingConfig[pId], price: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-bold opacity-70">Limite de Membros</Label>
                              <Input 
                                type="number"
                                className="font-bold h-10 rounded-xl"
                                value={pricingConfig[pId].maxUsers}
                                onChange={e => setPricingConfig({...pricingConfig, [pId]: {...pricingConfig[pId], maxUsers: parseInt(e.target.value) || 0}})}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* MEMBER UPGRADE */}
                  <Card className="rounded-3xl border-2 border-primary/20 bg-primary/5 transition-all shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-primary">
                        <TrendingUp className="w-5 h-5" />
                        <CardTitle className="text-lg font-black uppercase italic tracking-tighter">Taxa de Upgrade (Membro)</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold opacity-70">Preço do Upgrade</Label>
                          <Input 
                            className="font-bold h-10 rounded-xl bg-background"
                            value={pricingConfig.MEMBER_UPGRADE?.price || '29,90'}
                            onChange={e => setPricingConfig({
                              ...pricingConfig, 
                              MEMBER_UPGRADE: { 
                                ...pricingConfig.MEMBER_UPGRADE, 
                                price: e.target.value 
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold opacity-70">Limite (Opcional)</Label>
                          <Input 
                            type="number"
                            className="font-bold h-10 rounded-xl bg-background"
                            value={pricingConfig.MEMBER_UPGRADE?.maxUsers || 0}
                            onChange={e => setPricingConfig({
                              ...pricingConfig, 
                              MEMBER_UPGRADE: { 
                                ...pricingConfig.MEMBER_UPGRADE, 
                                maxUsers: parseInt(e.target.value) || 0 
                              }
                            })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <CreditCard className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest">Carregando configurações...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="master" className="space-y-6 pb-20">
          <Card className="rounded-[32px] border-2 border-primary/10 shadow-xl shadow-primary/5">
            <CardHeader className="border-b bg-muted/30 p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                    <Mail className="w-6 h-6 text-primary" />
                    Notificações de Pedidos (Álbum)
                  </CardTitle>
                  <CardDescription className="text-sm font-bold opacity-70">
                    Cadastre os e-mails que receberão as solicitações de álbuns da família.
                  </CardDescription>
                </div>
                <Button onClick={saveMasterConfig} disabled={isSaving} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest gap-2">
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Emails'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest ml-1">E-mails de Destino</Label>
                <Textarea 
                  value={masterEmails}
                  onChange={(e) => setMasterEmails(e.target.value)}
                  placeholder="exemplo1@email.com, exemplo2@email.com"
                  className="min-h-[120px] rounded-2xl border-2 font-medium focus-visible:ring-primary/20 p-4"
                />
                <p className="text-[10px] text-muted-foreground font-medium italic">
                  * Separe os e-mails por vírgula. Estas pessoas serão notificadas sempre que um usuário solicitar um Álbum da Família.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-primary/5 border-dashed border-primary/30 p-6 rounded-2xl">
                  <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Fluxo do Pedido
                  </h4>
                  <ul className="text-xs space-y-2 text-muted-foreground font-medium">
                    <li>1. Usuário clica em "Fazer pedido" no Álbum da Família.</li>
                    <li>2. O sistema gera uma notificação instantânea para os e-mails acima.</li>
                    <li>3. Você recebe os detalhes para prosseguir com o álbum Digital/Impresso.</li>
                  </ul>
                </Card>
                <Card className="bg-muted/30 border-dashed p-6 rounded-2xl">
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Status do Sistema
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-green-600">Serviço Ativo</span>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedInst} onOpenChange={(open) => !open && setSelectedInst(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Estender Trial</DialogTitle>
            <DialogDescription>
              Adicione dias extras ao período de teste da instituição <strong>{selectedInst?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days">Quantos dias deseja adicionar?</Label>
              <Input 
                id="days" 
                type="number" 
                min="1" 
                value={daysToAdd} 
                onChange={(e) => setDaysToAdd(parseInt(e.target.value) || 0)} 
              />
            </div>
            
            {selectedInst && daysToAdd > 0 && (
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nova data de término:</p>
                <p className="text-lg font-black text-primary">
                  {(() => {
                    const now = Date.now();
                    const currentEndsAt = selectedInst.trialEndsAt || now;
                    const baseDate = currentEndsAt > now ? currentEndsAt : now;
                    const newEndsAt = baseDate + (daysToAdd * 24 * 60 * 60 * 1000);
                    return new Date(newEndsAt).toLocaleDateString('pt-BR');
                  })()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedInst(null)}>Cancelar</Button>
            <Button 
               onClick={handleExtendTrial} 
               disabled={daysToAdd < 1}
               className="font-black tracking-widest uppercase"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

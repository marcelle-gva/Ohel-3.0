import React, { useState } from 'react';
import { User, OperationType, Subscription } from '@/types';
import { db, handleFirestoreError } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Camera, Save, Loader2, CreditCard, ShieldCheck, AlertCircle, Mail, UserRound as UserEdit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProfilePageProps {
  user: User;
  subscription?: Subscription | null;
  onNavigate: (view: any) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, subscription, onNavigate }) => {
  const [name, setName] = useState(user.name || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [socialMedia, setSocialMedia] = useState(user.socialMedia || '');
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setPhotoURL(optimizedBase64);
            toast.success('Preview da foto carregado!');
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoURL('');
    toast.success('Foto removida!');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        name,
        photoURL,
        phoneNumber,
        socialMedia,
        updatedAt: Date.now()
      });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-emerald-500 bg-emerald-500/10';
      case 'PAST_DUE': return 'text-amber-500 bg-amber-500/10';
      case 'CANCELED': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Ativo (Pago)';
      case 'PAST_DUE': return 'Bloqueado (Falta de Pagamento)';
      case 'CANCELED': return 'Cancelado';
      case 'TRIAL': return 'Período de Teste';
      default: return status;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
          <UserIcon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e visualize seu plano.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-xl font-bold">Informações Básicas</CardTitle>
              <CardDescription>Estes dados serão visíveis para sua equipe e gestores.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-3xl bg-secondary flex items-center justify-center text-4xl font-bold overflow-hidden border-4 border-background shadow-2xl transition-transform group-hover:scale-105">
                    {photoURL ? (
                      <img src={photoURL} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <label 
                    htmlFor="photo-upload" 
                    className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-3xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white backdrop-blur-sm"
                  >
                    <Camera className="w-6 h-6 mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Mudar Foto</span>
                    <input 
                      id="photo-upload" 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  {photoURL && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg border-2 border-background"
                      onClick={handleRemovePhoto}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como você quer ser chamado?"
                    className="bg-muted/30 focus:bg-background transition-all h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail (Login)</Label>
                  <Input 
                    value={user.email} 
                    disabled 
                    className="bg-muted/10 opacity-60 h-12 cursor-not-allowed font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Celular</Label>
                  <Input 
                    id="phone" 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="bg-muted/30 focus:bg-background transition-all h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social">Rede Social (Instagram/LinkedIn)</Label>
                  <Input 
                    id="social" 
                    value={socialMedia} 
                    onChange={(e) => setSocialMedia(e.target.value)}
                    placeholder="@usuario ou link"
                    className="bg-muted/30 focus:bg-background transition-all h-12"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button size="lg" onClick={handleSave} disabled={loading} className="px-8 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl sticky top-6">
            <CardHeader className="border-b bg-primary/5">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Meu Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="text-center p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <h3 className="text-2xl font-black tracking-tighter text-primary">
                  {subscription?.planType === 'ADVANCED' ? 'AVANÇADO' : subscription?.planType === 'PRO' ? 'PRO' : 'BÁSICO'}
                </h3>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
                  Assinatura Atual
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", getStatusColor(subscription?.status || 'TRIAL'))}>
                    {getStatusLabel(subscription?.status || 'TRIAL')}
                  </span>
                </div>

                {subscription?.startDate && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Adquirido em</span>
                    <span className="font-medium">
                      {subscription.startDate.toDate ? format(subscription.startDate.toDate(), "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Recentemente'}
                    </span>
                  </div>
                )}

                {subscription?.expiresAt && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span className="font-medium">
                      {format(subscription.expiresAt, "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {subscription?.planType === 'ADVANCED' 
                      ? 'Você tem acesso ilimitado a todas as ferramentas institucionais e de gestão avançada.' 
                      : subscription?.planType === 'PRO'
                      ? 'Melhor custo-benefício para profissionais que buscam alta performance.'
                      : 'Plano básico para organização pessoal e rotina diária.'}
                  </p>
                </div>

                {subscription?.status === 'PAST_DUE' && (
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-destructive uppercase tracking-widest">Atenção</p>
                      <p className="text-xs text-destructive/80 leading-relaxed font-medium">
                        Sua conta está bloqueada devido a uma falha no processamento do pagamento mais recente. Por favor, regularize para não perder o acesso.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 border-primary/20 hover:bg-primary/5"
                    onClick={() => onNavigate('plans')}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Gerenciar Assinatura
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

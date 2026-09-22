import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
  doc, setDoc, updateDoc, collection, onSnapshot, serverTimestamp, query, where, getDocs,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Users, Check, X, Loader2, Home, ArrowLeft, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HOUSEHOLD_ROLE_DEFAULTS, HouseholdRole } from '@/types';

interface HouseholdData {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  planType: string;
  subscriptionStatus?: string;
}

interface HouseholdMemberRow {
  id: string;
  userId: string;
  profileName?: string;
  role: HouseholdRole;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
}

interface HouseholdPanelProps {
  householdId?: string | null; // if absent, we look up (or offer to create) the user's OWN household
  onBack: () => void;
}

/**
 * "Preciso que o perfil da minha família seja identificado e realizado o
 * convite para vincular" (2026-09-17). Mirrors InstitutionPanel's visual
 * pattern (invite code card + members card) so the two feel like the same
 * product, just scoped to a Household instead of an Institution.
 */
export const HouseholdPanel: React.FC<HouseholdPanelProps> = ({ householdId, onBack }) => {
  const { user, userData, switchContext } = useAuth();
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [members, setMembers] = useState<HouseholdMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');

  // Resolve which household to show: the one passed in, or the caller's own.
  useEffect(() => {
    if (!user) return;
    let unsubHousehold: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;

    const resolve = async () => {
      setLoading(true);
      let id = householdId;
      if (!id) {
        const ownedQuery = query(collection(db, 'households'), where('ownerId', '==', user.uid));
        const snap = await getDocs(ownedQuery);
        if (!snap.empty) id = snap.docs[0].id;
      }
      if (!id) {
        setHousehold(null);
        setLoading(false);
        return;
      }
      unsubHousehold = onSnapshot(doc(db, 'households', id), (d) => {
        if (d.exists()) setHousehold({ id: d.id, ...(d.data() as any) });
        setLoading(false);
      });
      unsubMembers = onSnapshot(collection(db, 'households', id!, 'members'), (snap) => {
        setMembers(snap.docs.map((m) => ({ id: m.id, ...(m.data() as any) })));
      });
    };
    resolve();

    return () => {
      unsubHousehold?.();
      unsubMembers?.();
    };
  }, [user, householdId]);

  const handleCreateHousehold = async () => {
    if (!user || !newHouseholdName.trim()) return;
    setCreating(true);
    try {
      const ref = doc(collection(db, 'households'));
      const inviteCode = ref.id.slice(0, 8).toUpperCase();
      await setDoc(ref, {
        id: ref.id,
        name: newHouseholdName.trim(),
        ownerId: user.uid,
        inviteCode,
        planType: 'PERSONAL_BASIC',
        subscriptionStatus: 'TRIAL',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'households', ref.id, 'members', user.uid), {
        householdId: ref.id,
        userId: user.uid,
        profileName: userData?.name || 'Dono(a)',
        role: 'OWNER',
        permissions: HOUSEHOLD_ROLE_DEFAULTS.OWNER,
        status: 'ACTIVE',
        joinedAt: serverTimestamp(),
      });
      switchContext('HOUSEHOLD', ref.id);
      toast.success(`"${newHouseholdName}" criada!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar casa.');
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = async (memberId: string) => {
    if (!household) return;
    await updateDoc(doc(db, 'households', household.id, 'members', memberId), { status: 'ACTIVE' });
    toast.success('Membro aceito!');
  };

  const handleReject = async (memberId: string) => {
    if (!household) return;
    await updateDoc(doc(db, 'households', household.id, 'members', memberId), { status: 'REVOKED' });
  };

  const handleRoleChange = async (memberId: string, role: HouseholdRole) => {
    if (!household) return;
    await updateDoc(doc(db, 'households', household.id, 'members', memberId), {
      role,
      permissions: HOUSEHOLD_ROLE_DEFAULTS[role],
    });
    toast.success('Papel atualizado.');
  };

  const isOwner = household?.ownerId === user?.uid;
  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const pendingMembers = members.filter((m) => m.status === 'PENDING');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!household) {
    return (
      <div className="max-w-md mx-auto py-16 space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
          <Home className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">Você ainda não tem uma Casa</h2>
          <p className="text-sm text-muted-foreground mt-1">Crie sua Casa pra convidar familiares e organizar a rotina de todo mundo junto.</p>
        </div>
        <div className="space-y-2 text-left">
          <Label htmlFor="household-name">Nome da Casa</Label>
          <Input
            id="household-name"
            placeholder='Ex: "Família Ayres"'
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
          />
        </div>
        <Button className="w-full h-12" disabled={creating || !newHouseholdName.trim()} onClick={handleCreateHousehold}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar minha Casa'}
        </Button>
        <Button variant="ghost" onClick={onBack}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs font-bold uppercase tracking-widest">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <Card className="rounded-[40px] border-purple-500/10 overflow-hidden shadow-xl shadow-purple-500/5 relative">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" aria-hidden />
        <CardHeader className="relative">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-3xl font-black tracking-tighter uppercase italic">{household.name}</CardTitle>
              <CardDescription className="font-bold uppercase tracking-widest text-[10px]">
                Gestão da Casa — membros e perfis
              </CardDescription>
            </div>
            <Badge variant="secondary" className="px-3 py-1 font-black tracking-widest text-[9px] uppercase italic">
              Plano {household.planType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-center gap-4 p-5 bg-purple-500/5 rounded-[30px] border border-purple-500/10">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
              <Key className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Código de Convite da Casa</p>
              <p className="text-2xl font-mono font-black tracking-tighter italic text-purple-600">{household.inviteCode}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold uppercase tracking-widest text-[10px]"
              onClick={() => {
                navigator.clipboard.writeText(household.inviteCode);
                toast.success('Código copiado!');
              }}
            >
              Copiar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Compartilhe esse código com quem você quer convidar — cônjuge, filhos. A pessoa entra pelo login com "Tenho um código de convite" e fica pendente até você aceitar aqui embaixo.
          </p>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="rounded-[40px] border-muted-foreground/10">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Ranking da Casa</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Os membros competem por pontos ao completar tarefas — visível só pra quem é dessa Casa.
              </p>
            </div>
            <Button
              variant={household.rankingEnabled ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl font-black text-[9px] uppercase tracking-widest shrink-0"
              onClick={() => updateDoc(doc(db, 'households', household.id), { rankingEnabled: !household.rankingEnabled })}
            >
              {household.rankingEnabled ? 'Ativado' : 'Desativado'}
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingMembers.length > 0 && (
        <Card className="rounded-[40px] border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-amber-600">
              Aguardando aceite ({pendingMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-amber-500/5 rounded-2xl px-4 py-3 border border-amber-500/10">
                <div>
                  <p className="text-sm font-bold">{m.profileName || m.userId}</p>
                  <p className="text-[11px] text-muted-foreground">Quer entrar como {m.role}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1 text-emerald-600 border-emerald-500/30" onClick={() => handleAccept(m.id)}>
                    <Check className="w-3.5 h-3.5" /> Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleReject(m.id)}>
                    <X className="w-3.5 h-3.5" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[40px] border-muted-foreground/10">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Perfis da Casa ({activeMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border">
              <div className="flex items-center gap-2">
                {m.role === 'OWNER' && <Crown className="w-4 h-4 text-amber-500" />}
                <div>
                  <p className="text-sm font-bold">{m.profileName || m.userId}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.role}</p>
                </div>
              </div>
              {isOwner && m.userId !== user?.uid && (
                <div className="flex gap-1">
                  {(['ADULT', 'CHILD', 'GUEST'] as HouseholdRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(m.id, role)}
                      className={cn(
                        'text-[9px] font-bold px-2 py-1 rounded-lg border transition-colors',
                        m.role === role ? 'bg-purple-600 text-white border-purple-600' : 'text-muted-foreground border-border hover:border-purple-500/40'
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

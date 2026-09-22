import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, doc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, Download, Check, X, Loader2, Clock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PillarKey } from '@/types';

const PILLAR_LABELS: Record<PillarKey, string> = {
  PESSOAL: 'Pessoal (saúde, bem-estar)',
  FINANCEIRO: 'Financeiro',
  FAMILIAR: 'Familiar',
  PROFISSIONAL: 'Profissional',
  ESPIRITUAL: 'Espiritual',
};

const PILLAR_COLLECTION: Record<PillarKey, string> = {
  PESSOAL: 'wellbeing_logs',
  FINANCEIRO: 'finance_transactions',
  FAMILIAR: 'personal_family',
  PROFISSIONAL: 'tasks',
  ESPIRITUAL: 'spiritual_devotionals',
};

interface ConnectionRow {
  id: string;
  ownerId: string;
  targetUserId: string;
  pillar: PillarKey;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  expiresAt: number;
}

/**
 * "se for de fora ao compartilhar, pode baixar o conteúdo do pilar e
 * enviar ou escolher CONECTAR POR X TEMPO COM USUÁRIO X" (2026-09-17).
 * Two independent lists: connections I granted (as owner) and connections
 * granted to me (as an outside viewer) — see firestore.rules
 * hasActivePillarConnection() for how these actually gate reads.
 */
export const PillarConnectionsPanel: React.FC = () => {
  const { user } = useAuth();
  const [granted, setGranted] = useState<ConnectionRow[]>([]);
  const [received, setReceived] = useState<ConnectionRow[]>([]);
  const [pillar, setPillar] = useState<PillarKey>('PESSOAL');
  const [targetEmail, setTargetEmail] = useState('');
  const [days, setDays] = useState('7');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(
      query(collection(db, 'pillar_connections'), where('ownerId', '==', user.uid)),
      (snap) => setGranted(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    const unsub2 = onSnapshot(
      query(collection(db, 'pillar_connections'), where('targetUserId', '==', user.uid)),
      (snap) => setReceived(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const handleCreate = async () => {
    if (!user || !targetEmail.trim()) return;
    setCreating(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', targetEmail.trim().toLowerCase())));
      if (usersSnap.empty) {
        toast.error('Nenhum usuário encontrado com esse e-mail.');
        return;
      }
      const targetUserId = usersSnap.docs[0].id;
      if (targetUserId === user.uid) {
        toast.error('Você não pode conectar consigo mesmo.');
        return;
      }
      const connId = `${user.uid}_${targetUserId}_${pillar}`;
      const expiresAt = Date.now() + Math.max(1, parseInt(days) || 7) * 86400000;
      await setDoc(doc(db, 'pillar_connections', connId), {
        ownerId: user.uid,
        targetUserId,
        pillar,
        scope: 'READ_ONLY',
        status: 'PENDING',
        expiresAt,
        createdAt: serverTimestamp(),
      });
      toast.success('Convite enviado! Fica pendente até a pessoa aceitar.');
      setTargetEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conexão.');
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = async (connId: string) => {
    await updateDoc(doc(db, 'pillar_connections', connId), { status: 'ACTIVE' });
    toast.success('Conexão aceita!');
  };

  const handleRevoke = async (connId: string) => {
    await deleteDoc(doc(db, 'pillar_connections', connId));
    toast.info('Conexão encerrada.');
  };

  // "pode baixar o conteúdo do pilar e enviar" — a simple client-side JSON
  // export of the owner's own data for that pillar, no server round-trip.
  const handleExport = async (targetPillar: PillarKey) => {
    if (!user) return;
    try {
      const snap = await getDocs(query(collection(db, PILLAR_COLLECTION[targetPillar]), where('userId', '==', user.uid)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${PILLAR_LABELS[targetPillar].split(' ')[0].toLowerCase()}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  const daysLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tighter italic flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          Conexões Externas
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Compartilhe um pilar específico com alguém de fora (médico, contador) por um prazo — sem precisar convidar pra Casa ou Instituição.
        </p>
      </div>

      <Card className="rounded-[32px]">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest">Nova conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pillar-select" className="text-xs">Pilar</Label>
              <Select value={pillar} onValueChange={(v) => setPillar(v as PillarKey)}>
                <SelectTrigger id="pillar-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PILLAR_LABELS) as PillarKey[]).map((p) => (
                    <SelectItem key={p} value={p}>{PILLAR_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="connection-days" className="text-xs">Por quantos dias</Label>
              <Input id="connection-days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="connection-email" className="text-xs">E-mail de quem vai receber acesso</Label>
            <div className="flex gap-2">
              <Input id="connection-email" placeholder="pessoa@exemplo.com" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} />
              <Button onClick={handleCreate} disabled={creating || !targetEmail.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleExport(pillar)}>
            <Download className="w-3.5 h-3.5" /> Ou baixar {PILLAR_LABELS[pillar]} agora (JSON)
          </Button>
        </CardContent>
      </Card>

      {received.filter((r) => r.status === 'PENDING').length > 0 && (
        <Card className="rounded-[32px] border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-600">Convites recebidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {received.filter((r) => r.status === 'PENDING').map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-amber-500/5 rounded-2xl px-4 py-3 border border-amber-500/10">
                <div>
                  <p className="text-sm font-bold">{PILLAR_LABELS[r.pillar]}</p>
                  <p className="text-[11px] text-muted-foreground">Válido por {daysLeft(r.expiresAt)} dia(s) após aceitar</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1 text-emerald-600" onClick={() => handleAccept(r.id)}>
                    <Check className="w-3.5 h-3.5" /> Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleRevoke(r.id)} aria-label="Recusar convite">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[32px]">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            Conexões que você concedeu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {granted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma conexão externa criada ainda.</p>
          ) : (
            granted.map((g) => (
              <div key={g.id} className="flex items-center justify-between bg-muted/30 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{PILLAR_LABELS[g.pillar]}</p>
                  <Badge variant={g.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[9px] mt-1">
                    {g.status === 'PENDING' ? 'Aguardando aceite' : g.status === 'ACTIVE' ? `Ativo · ${daysLeft(g.expiresAt)}d restantes` : 'Encerrado'}
                  </Badge>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => handleRevoke(g.id)}>
                  <X className="w-3.5 h-3.5" /> Revogar
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

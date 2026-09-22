import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Medal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankingRow {
  id: string;
  userId: string;
  userName: string;
  points: number;
}

function currentWeekId(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * "gostaria de participar de um ranking junto com os membros da casa...
 * pode existir para o pilar profissional... e para a instituição também
 * caso o dono ative — separados, é claro, não misturado" (2026-09-17).
 * One leaderboard per Household/Institution context, current week only.
 */
export const RankingView: React.FC = () => {
  const { activeContextType, activeContextId, memberships, user } = useAuth();
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingEnabled, setRankingEnabled] = useState<boolean | null>(null);

  const activeMembership = memberships.find(
    (m) => m.contextType === activeContextType && m.contextId === activeContextId
  );

  useEffect(() => {
    if (activeContextType === 'PERSONAL' || !activeContextId) {
      setRankingEnabled(false);
      setLoading(false);
      return;
    }
    const collectionName = activeContextType === 'HOUSEHOLD' ? 'households' : 'institutions';
    getDoc(doc(db, collectionName, activeContextId)).then((d) => {
      setRankingEnabled(!!d.data()?.rankingEnabled);
    });
  }, [activeContextType, activeContextId]);

  useEffect(() => {
    if (!rankingEnabled || activeContextType === 'PERSONAL' || !activeContextId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'rankings'),
      where('contextType', '==', activeContextType),
      where('contextId', '==', activeContextId),
      where('weekId', '==', currentWeekId()),
      orderBy('points', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [rankingEnabled, activeContextType, activeContextId]);

  if (activeContextType === 'PERSONAL' || !activeContextId) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-bold">Troque pro perfil de uma Casa ou Instituição pra ver o ranking dela.</p>
      </div>
    );
  }

  if (rankingEnabled === false) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-bold">O ranking ainda não foi ativado para "{activeMembership?.name}".</p>
        {activeMembership?.role === 'OWNER' && (
          <p className="text-xs mt-1">Ative em Gerenciar {activeContextType === 'HOUSEHOLD' ? 'Casa' : 'Instituição'}.</p>
        )}
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto rounded-[40px] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" aria-hidden />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter italic">
          <Trophy className="w-5 h-5 text-amber-500" />
          Ranking — {activeMembership?.name}
        </CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
          Semana atual · pontos por tarefa concluída
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 relative">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Ninguém pontuou ainda essa semana. Complete uma tarefa!</p>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl border',
                row.userId === user?.uid ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-transparent'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0',
                idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {idx < 3 ? <Medal className="w-4 h-4" /> : idx + 1}
              </div>
              <p className="flex-1 text-sm font-bold truncate">{row.userName}{row.userId === user?.uid ? ' (você)' : ''}</p>
              <p className="text-sm font-black text-primary">{row.points} pts</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

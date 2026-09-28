import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, DollarSign, ClipboardList, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface HouseholdOverviewDashboardProps {
  userId: string;
  tasks?: any[];
}

export const HouseholdOverviewDashboard: React.FC<HouseholdOverviewDashboardProps> = ({ userId, tasks = [] }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const docQ = query(
      collection(db, 'personal_documents'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeDocs = onSnapshot(docQ, (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_documents'));

    const financeQ = query(
      collection(db, 'personal_finance'),
      where('userId', '==', userId),
      where('pillar', '==', 'casa'),
      orderBy('date', 'desc')
    );

    const unsubscribeFinance = onSnapshot(financeQ, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_finance'));

    return () => {
      unsubscribeDocs();
      unsubscribeFinance();
    };
  }, [userId]);

  const taskSummary = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    const recent = [...tasks].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 4);

    return { total, pending, completed, recent };
  }, [tasks]);

  const balance = transactions.reduce((sum, tx) => {
    const value = Number(tx.amount || 0);
    return sum + (tx.type === 'INCOME' ? value : -value);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-primary leading-none">Gestão Pessoal</h2>
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Resumo da casa e do todo familiar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="rounded-[1.75rem] border border-border bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Documentos
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-black tracking-widest opacity-60">Arquivos da casa</CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px] font-black uppercase tracking-widest">{documents.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents.length > 0 ? documents.slice(0, 3).map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{doc.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                    {doc.createdAt?.seconds ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : 'Recentemente'}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">Nenhum documento registrado.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border border-border bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Extrato
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-black tracking-widest opacity-60">Financeiro da casa</CardDescription>
            </div>
            <Badge variant="secondary" className={cn(
              'rounded-full text-[10px] font-black uppercase tracking-widest',
              balance >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
            )}>{balance >= 0 ? 'Positivo' : 'Negativo'}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Saldo</span>
              <span className={cn('text-lg font-black tracking-tight', balance >= 0 ? 'text-green-600' : 'text-red-600')}>
                R$ {balance.toFixed(2)}
              </span>
            </div>

            {transactions.length > 0 ? transactions.slice(0, 3).map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{tx.description}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                    {tx.date?.seconds ? new Date(tx.date.seconds * 1000).toLocaleDateString() : 'Recentemente'}
                  </p>
                </div>
                <div className={cn('flex items-center gap-1 text-sm font-black', tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600')}>
                  {tx.type === 'INCOME' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {tx.type === 'INCOME' ? '+' : '-'}R$ {Number(tx.amount || 0).toFixed(2)}
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">Nenhuma movimentação registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border border-border bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-violet-500" /> Tarefas
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-black tracking-widest opacity-60">Todo da casa</CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px] font-black uppercase tracking-widest">{taskSummary.total}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pendentes</p>
                <p className="text-xl font-black">{taskSummary.pending}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Concluídas</p>
                <p className="text-xl font-black">{taskSummary.completed}</p>
              </div>
            </div>

            {taskSummary.recent.length > 0 ? taskSummary.recent.map(task => (
              <div key={task.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{task.title}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                    {task.completed ? 'Concluída' : 'Pendente'}
                  </p>
                </div>
                <div className={cn('h-2.5 w-2.5 rounded-full', task.completed ? 'bg-emerald-500' : 'bg-amber-500')} />
              </div>
            )) : (
              <p className="text-sm text-muted-foreground italic">Nenhuma tarefa cadastrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
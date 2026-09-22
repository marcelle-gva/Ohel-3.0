import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PersonalFinanceModuleProps {
  userId: string;
}

export const PersonalFinanceModule: React.FC<PersonalFinanceModuleProps> = ({ userId }) => {
  // Finance state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  useEffect(() => {
    if (!userId) return;
    const fq = query(
      collection(db, 'personal_finance'),
      where('userId', '==', userId),
      where('pillar', '==', 'casa'),
      orderBy('date', 'desc')
    );
    const unsubFinance = onSnapshot(fq, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_finance'));

    return () => {
      unsubFinance();
    };
  }, [userId]);

  const handleAddTransaction = async () => {
    if (!amount || !desc) return;
    try {
      await addDoc(collection(db, 'personal_finance'), {
        userId,
        amount: parseFloat(amount),
        description: desc,
        type,
        pillar: 'casa',
        date: serverTimestamp()
      });
      setAmount('');
      setDesc('');
      toast.success('Lançamento financeiro realizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'personal_finance');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 border border-green-500/20">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-primary leading-none">Financeiro Pessoal</h2>
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Controle de Entradas e Saídas do Lar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-green-500/20 bg-green-500/5 rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Lançamento</CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Novo registro financeiro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Valor (R$)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00" 
                className="h-12 rounded-xl border-green-500/20 bg-background font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Descrição</Label>
              <Input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Ex: Supermercado" 
                className="h-12 rounded-xl border-green-500/20 bg-background font-bold"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={type === 'INCOME' ? 'default' : 'outline'} 
                className={cn(
                  "flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]",
                  type === 'INCOME' && "bg-green-600 hover:bg-green-700"
                )}
                onClick={() => setType('INCOME')}
              >
                Entrada
              </Button>
              <Button 
                variant={type === 'EXPENSE' ? 'default' : 'outline'} 
                className={cn(
                  "flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]",
                  type === 'EXPENSE' && "bg-red-600 hover:bg-red-700 hover:text-white"
                )}
                onClick={() => setType('EXPENSE')}
              >
                Saída
              </Button>
            </div>
            <Button 
              className="w-full h-14 bg-green-600 hover:bg-green-700 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-500/20" 
              onClick={handleAddTransaction}
            >
              Lançar Agora
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-[2rem] overflow-hidden border-2 border-muted/50">
          <CardHeader className="border-b bg-muted/5">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Extrato do Lar</CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Histórico de movimentações</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {transactions.length > 0 ? (
                transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 border rounded-2xl bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
                        t.type === 'INCOME' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {t.type === 'INCOME' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{t.description}</p>
                          <Badge variant="outline" className="text-[8px] uppercase font-black tracking-widest px-1.5 h-4">{t.pillar || 'Casa'}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
                          {t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleDateString() : 'Agora'}
                        </p>
                      </div>
                    </div>
                    <div className={cn("text-lg font-black tracking-tighter", t.type === 'INCOME' ? "text-green-500" : "text-red-500")}>
                      {t.type === 'INCOME' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center space-y-4 opacity-40">
                  <DollarSign className="w-12 h-12 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest">Nenhuma movimentação</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

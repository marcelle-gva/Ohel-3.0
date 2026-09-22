import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Transaction, TransactionType, TransactionCategory, EisenhowerQuadrant, PixKey } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Calendar as CalendarIcon, ArrowUpRight, ArrowDownLeft, Key } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FinanceModuleProps {
  userId: string;
  onAddTask?: (data: { title: string; description: string; quadrant: EisenhowerQuadrant; moduleId: string }) => void;
  institutionId?: string;
}

const CATEGORIES: TransactionCategory[] = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'];

export const FinanceModule: React.FC<FinanceModuleProps> = ({ userId, onAddTask, institutionId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<TransactionCategory>('Outros');
  const [createTask, setCreateTask] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  // PIX state
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [newPixLabel, setNewPixLabel] = useState('');
  const [newPixKey, setNewPixKey] = useState('');
  const [newPixType, setNewPixType] = useState<PixKey['type']>('CPF');

  useEffect(() => {
    const q = institutionId
      ? query(
          collection(db, 'finance_transactions'),
          where('institutionId', '==', institutionId),
          orderBy('date', 'desc')
        )
      : query(
          collection(db, 'finance_transactions'),
          where('userId', '==', userId),
          orderBy('date', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'finance_transactions'));

    // PIX Keys listener
    const qPix = query(collection(db, 'pix_keys'), where('userId', '==', userId));
    const unsubscribePix = onSnapshot(qPix, (snapshot) => {
      setPixKeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PixKey)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'pix_keys'));

    return () => {
      unsubscribe();
      unsubscribePix();
    };
  }, [userId, institutionId]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    try {
      const transactionData: any = {
        userId,
        amount: parseFloat(amount),
        description,
        type,
        category,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : null,
      };

      if (institutionId) {
        transactionData.institutionId = institutionId;
      }

      await addDoc(collection(db, 'finance_transactions'), transactionData);

      if (onAddTask && (createTask || (type === 'EXPENSE' && parseFloat(amount) > 500))) {
        onAddTask({
          title: `${type === 'INCOME' ? 'Receber' : 'Pagar'}: ${description}`,
          description: `Lançamento financeiro de R$ ${amount} na categoria ${category}`,
          quadrant: type === 'EXPENSE' ? 'urgent-important' : 'important-not-urgent',
          moduleId: 'financeiro'
        });
        toast.success('Lançamento e tarefa criados!');
      } else {
        toast.success('Lançamento financeiro criado!');
      }

      setAmount('');
      setDescription('');
      setCreateTask(false);
      setIsRecurring(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'finance_transactions');
    }
  };

  const handleAddPixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPixLabel || !newPixKey) return;
    try {
      await addDoc(collection(db, 'pix_keys'), {
        userId,
        label: newPixLabel,
        key: newPixKey,
        type: newPixType,
        createdAt: serverTimestamp()
      });
      setNewPixLabel('');
      setNewPixKey('');
      toast.success('Chave PIX adicionada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'pix_keys');
    }
  };

  const handleDeletePixKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pix_keys', id));
      toast.success('Chave PIX removida');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pix_keys/${id}`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'finance_transactions', id));
      toast.success('Lançamento removido');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `finance_transactions/${id}`);
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const balance = totalIncome - totalExpense;

  const categoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: transactions
      .filter(t => t.type === 'EXPENSE' && t.category === cat)
      .reduce((acc, curr) => acc + curr.amount, 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  const monthlyData = Array.from({ length: 6 }).map((_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthName = format(date, 'MMM', { locale: ptBR });
    const monthYear = format(date, 'MM/yyyy');
    
    const monthTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Timestamp ? t.date.toDate() : new Date();
      return format(tDate, 'MM/yyyy') === monthYear;
    });

    return {
      name: monthName,
      receita: monthTransactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0),
      despesa: monthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Saldo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Entradas totais</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
              <TrendingDown className="w-4 h-4" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Saídas totais</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Novo Lançamento</CardTitle>
            <CardDescription>Registre uma nova movimentação</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: TransactionType) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Receita</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input 
                  placeholder="Ex: Salário, Aluguel..." 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v: TransactionCategory) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="createTask" 
                    checked={createTask} 
                    onChange={(e) => setCreateTask(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="createTask" className="text-sm cursor-pointer">Vincular à Matriz de Tarefas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="isRecurring" 
                    checked={isRecurring} 
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isRecurring" className="text-sm cursor-pointer">Lançamento Recorrente</Label>
                </div>
              </div>

              {isRecurring && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label>Frequência</Label>
                  <Select value={recurringFrequency} onValueChange={(v: any) => setRecurringFrequency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Análise de Gastos</CardTitle>
            <CardDescription>Distribuição por categoria e evolução</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Minhas Chaves PIX
            </CardTitle>
            <CardDescription>Facilite sua memória com seus registros</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPixKey} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
              <Input 
                placeholder="Apelido (ex: Nubank)" 
                value={newPixLabel} 
                onChange={e => setNewPixLabel(e.target.value)} 
                required 
                aria-label="Apelido da chave PIX"
              />
              <Input 
                placeholder="Chave PIX" 
                value={newPixKey} 
                onChange={e => setNewPixKey(e.target.value)} 
                required 
                aria-label="Valor da chave PIX"
              />
              <Select value={newPixType} onValueChange={(v: any) => setNewPixType(v)}>
                <SelectTrigger aria-label="Tipo de chave PIX">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="PHONE">Telefone</SelectItem>
                  <SelectItem value="RANDOM">Aleatória</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="icon" className="w-full" aria-label="Salvar chave PIX">
                <Plus className="w-4 h-4" />
              </Button>
            </form>
            <div className="space-y-2">
              {pixKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between p-2 border rounded text-sm bg-muted/20">
                  <div className="flex flex-col">
                    <span className="font-bold">{k.label}</span>
                    <span className="text-xs text-muted-foreground">{k.type}: {k.key}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive" 
                    onClick={() => handleDeletePixKey(k.id)}
                    aria-label={`Excluir chave PIX ${k.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {pixKeys.length === 0 && <p className="text-center text-xs text-muted-foreground py-2">Nenhuma chave salva</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos Lançamentos</CardTitle>
            <CardDescription>Histórico recente de movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      t.type === 'INCOME' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {t.type === 'INCOME' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {t.description}
                        {t.isRecurring && (
                          <span className="text-[9px] uppercase bg-primary/10 text-primary px-1 rounded animate-pulse">Recorrente</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="bg-muted px-1.5 py-0.5 rounded">{t.category}</span>
                        <CalendarIcon className="w-3 h-3" />
                        {t.date instanceof Timestamp ? format(t.date.toDate(), 'dd/MM/yyyy') : 'Recent'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "font-bold",
                      t.type === 'INCOME' ? "text-green-600" : "text-red-600"
                    )}>
                      {t.type === 'INCOME' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(t.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

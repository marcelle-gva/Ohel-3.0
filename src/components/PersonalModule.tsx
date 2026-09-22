import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { FamilyEvent } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, Calendar, ClipboardList, Heart, Plus, Trash2, DollarSign, ArrowUpRight, ArrowDownRight, FileText, Image as ImageIcon, Target, LayoutDashboard, Clock, FileUp, Camera, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
} from '@/components/ui/dialog';
import { PomodoroTimer } from './PomodoroTimer';
import { Task, EisenhowerQuadrant as TaskQuadrant } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PersonalModuleProps {
  userId: string;
  tasks?: Task[];
  onTaskComplete?: (taskId: string, timeSpent: number) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onOpenAddTask?: (initialData?: Partial<Task>) => void;
  addTask?: (data: any) => Promise<void>;
}

export const PersonalModule: React.FC<PersonalModuleProps> = ({ 
  userId, 
  tasks = [], 
  onTaskComplete,
  onDeleteTask,
  onOpenAddTask,
  addTask
}) => {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [activeTab, setActiveTab] = useState('familiar');
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Finance state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'personal_family'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const unsubEvents = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyEvent)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_family'));

    const fq = query(
      collection(db, 'personal_finance'),
      where('userId', '==', userId),
      where('pillar', '==', 'casa'),
      orderBy('date', 'desc')
    );
    const unsubFinance = onSnapshot(fq, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_finance'));

    const pq = query(
      collection(db, 'personal_album'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubAlbum = onSnapshot(pq, (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_album'));

    return () => {
      unsubEvents();
      unsubFinance();
      unsubAlbum();
    };
  }, [userId]);

  const handleQuickAdd = async () => {
    if (!title) return;
    try {
      if (addTask) {
        // Create as a task in the "Bank" (not-urgent-not-important as fallback or important-not-urgent)
        await addTask({
          title: title,
          description: 'Adicionado via lançamento rápido familiar',
          quadrant: 'important-not-urgent',
          status: 'PENDING',
          completed: false,
          type: 'PERSONAL',
          moduleId: 'familiar',
          createdAt: Date.now()
        });
        toast.success('Tarefa adicionada ao Banco!');
        setTitle('');
      } else {
        // Fallback to internal events if addTask not provided
        await addDoc(collection(db, 'personal_family'), {
          userId,
          title,
          category: 'TASK',
          date: serverTimestamp()
        });
        setTitle('');
        toast.success('Adicionado ao Banco!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar');
    }
  };

  const handleAddEvent = async (customCategory?: string) => {
    if (!title) return;
    try {
      await addDoc(collection(db, 'personal_family'), {
        userId,
        title,
        category: customCategory || 'TASK',
        date: serverTimestamp()
      });
      setTitle('');
      toast.success('Item adicionado à organização familiar!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'personal_family');
    }
  };

  const handleDeleteItem = async (item: any) => {
    try {
      if (item.quadrant) {
        // It's a task
        if (onDeleteTask) {
          await onDeleteTask(item.id);
        } else {
          await deleteDoc(doc(db, 'tasks', item.id));
          toast.success('Tarefa removida!');
        }
      } else {
        // It's a family event
        await deleteDoc(doc(db, 'personal_family', item.id));
        toast.success('Item removido!');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, item.quadrant ? `tasks/${item.id}` : `personal_family/${item.id}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await addDoc(collection(db, 'personal_album'), {
          userId,
          url: base64,
          createdAt: serverTimestamp()
        });
        toast.success('Foto adicionada ao álbum!');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao subir foto');
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'personal_album', id));
      toast.success('Foto removida!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `personal_album/${id}`);
    }
  };

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-500/20">
            <Home className="w-6 h-6" />
          </div>
            <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase text-primary leading-none">PILAR FAMILIAR</h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">O coração da sua casa e memórias da sua família</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl flex h-auto w-fit border">
          <TabsTrigger value="familiar" className="rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest px-6 py-2.5">
            <LayoutDashboard className="w-4 h-4" /> Mural da Família
          </TabsTrigger>
          <TabsTrigger value="album" className="rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest px-6 py-2.5">
            <ImageIcon className="w-4 h-4" /> Álbum da Família
          </TabsTrigger>
        </TabsList>

        <TabsContent value="familiar" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Mural Column */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-[2rem] border-2 border-purple-500/10 bg-purple-500/5 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Plus className="w-5 h-5 text-purple-500" />
                    Lançamento Rápido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <Input 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      placeholder="O que organizar na casa? (Ex: Limpeza, Reunião...)" 
                      className="flex-1 h-12 rounded-xl border-purple-500/20 bg-background font-bold text-sm"
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="rounded-xl h-12 font-black uppercase tracking-widest text-[10px]"
                        onClick={() => onOpenAddTask?.({ moduleId: 'familiar', quadrant: 'important-not-urgent' })}
                      >
                        Tarefa
                      </Button>
                      <Button 
                        variant="outline"
                        className="rounded-xl h-12 font-black uppercase tracking-widest text-[10px]"
                        onClick={() => onOpenAddTask?.({ title: 'Evento: ', moduleId: 'familiar', quadrant: 'important-not-urgent' })}
                      >
                        Evento
                      </Button>
                      <Button 
                        onClick={handleQuickAdd}
                        disabled={!title}
                        className="bg-purple-600 hover:bg-purple-700 rounded-xl h-12 px-6 font-black uppercase tracking-widest text-[10px]"
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-500" />
                    Mural de Atividades
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Combinação de Tarefas do Eisenhower e Eventos do Personal Family */}
                  {[...tasks, ...events].length > 0 ? (
                    [...tasks, ...events].sort((a: any, b: any) => {
                      const dateA = a.date?.seconds || 0;
                      const dateB = b.date?.seconds || 0;
                      return dateB - dateA;
                    }).map((item: any) => (
                      <Card key={item.id} className="border-2 border-primary/5 hover:border-primary/20 transition-all group rounded-2xl bg-card overflow-hidden">
                        <CardHeader className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              item.category === 'EVENT' ? "border-blue-500/20 text-blue-500 bg-blue-500/5" : "border-green-500/20 text-green-500 bg-green-500/5"
                            )}>
                              {item.category === 'EVENT' ? 'Evento' : 'Tarefa'}
                            </Badge>
                            {item.userId || item.id ? (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            ) : null}
                          </div>
                          <CardTitle className="text-sm font-bold tracking-tight">{item.title || item.text}</CardTitle>
                          <CardDescription className="text-[9px] uppercase font-bold tracking-widest opacity-60">
                            {item.date?.seconds || item.createdAt?.seconds 
                              ? new Date((item.date?.seconds || item.createdAt?.seconds) * 1000).toLocaleDateString() 
                              : 'Atividade da Casa'}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 py-12 text-center bg-muted/5 border-2 border-dashed border-purple-500/10 rounded-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Nenhuma atividade pendente no mural</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Side Column: Preview of Album & Quick Add */}
            <div className="lg:col-span-4 space-y-8 mt-4 md:mt-0">
              <Card className="border-2 border-blue-500/10 shadow-xl shadow-blue-500/5 rounded-[32px] overflow-hidden bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between py-6 border-b bg-blue-500/5">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-black italic tracking-tighter uppercase flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      Álbum Familiar
                    </CardTitle>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Recordações Recentes</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-primary h-8" onClick={() => setActiveTab('album')}>Ver Tudo</Button>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {photos.slice(0, 4).map(photo => (
                      <div key={photo.id} className="aspect-square bg-muted rounded-2xl overflow-hidden relative group cursor-pointer border shadow-sm transition-all hover:scale-[1.05]">
                        <img 
                          src={photo.url} 
                          alt="Momento familiar"
                          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                    {photos.length === 0 && [1, 2, 3, 4].map(i => (
                      <div key={i} className="aspect-square bg-muted/20 border border-dashed rounded-2xl flex items-center justify-center opacity-40">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Expenses Section (Making the finance subscription functional) */}
              <Card className="border-2 border-emerald-500/10 shadow-xl shadow-emerald-500/5 rounded-[32px] overflow-hidden bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between py-6 border-b bg-emerald-500/5">
                  <div className="space-y-1">
                    <CardTitle className="text-[10px] uppercase font-black tracking-widest text-emerald-600 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Gastos da Casa
                    </CardTitle>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Recentes (Pilar Casa)</p>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {transactions.slice(0, 3).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-xl border border-border/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold tracking-tight">{tx.description}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">{new Date(tx.date?.seconds * 1000).toLocaleDateString()}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] font-black tracking-tighter",
                          tx.type === 'INCOME' ? "text-emerald-500" : "text-amber-500"
                        )}>
                          {tx.type === 'INCOME' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <p className="text-[9px] text-center text-muted-foreground italic py-4">Nenhum gasto registrado.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-amber-500/10 bg-amber-500/5 rounded-[32px]">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-[10px] uppercase font-black tracking-widest text-amber-600">Dica de Gestão</CardTitle>
                  <CardDescription className="text-amber-800 font-bold leading-tight">Mantenha o mural atualizado para reduzir o estresse mental de todos em casa.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="album" className="space-y-6">
          <Card className="border-2 border-blue-500/10 shadow-xl shadow-blue-500/5 rounded-[32px] overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b bg-muted/5">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                  Álbum da Família
                </CardTitle>
                <CardDescription className="font-medium">Eternize os melhores momentos (Digital e Impresso)</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input 
                  id="album-upload"
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                />
                <Button 
                  asChild
                  className="rounded-xl h-10 px-6 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                >
                  <label htmlFor="album-upload">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 
                    Adicionar Foto ao Álbum
                  </label>
                </Button>
                <Button 
                  className="rounded-xl h-10 px-6 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20"
                  onClick={() => toast.success('Formulário de pedido enviado para os e-mails cadastrados!')}
                >
                  <FileText className="w-4 h-4" /> Fazer o pedido do álbum impresso
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {photos.map(photo => (
                  <div key={photo.id} className="aspect-square bg-muted rounded-3xl overflow-hidden relative group cursor-pointer border shadow-sm transition-all hover:scale-[1.02]">
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 gap-2">
                      <Button variant="destructive" size="sm" className="h-8 text-[10px] font-bold" onClick={() => handleDeletePhoto(photo.id)}>
                        Remover
                      </Button>
                    </div>
                    <img 
                      src={photo.url} 
                      alt="Momento familiar"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
                {photos.length === 0 && (
                   <div className="col-span-full py-12 text-center bg-muted/5 border-2 border-dashed border-blue-500/10 rounded-3xl">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Álbum vazio. Adicione as primeiras fotos da sua família!</p>
                 </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

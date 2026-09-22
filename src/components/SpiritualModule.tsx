import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, setDoc, getDocs, limit } from 'firebase/firestore';
import { Devotional, ReadingPlan, EisenhowerQuadrant, SpiritualGoal } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, BookOpen, Quote, Save, History, Plus, CheckCircle2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SpiritualModuleProps {
  userId: string;
  onAddTask?: (data: { title: string; description: string; quadrant: EisenhowerQuadrant; moduleId: string }) => void;
}

const BIBLE_BOOKS = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
  '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
  'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oseias', 'Joel', 'Amós',
  'Obadias', 'Jonas', 'Miqueias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
  'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios',
  'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom',
  'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'
];

const FALLBACK_VERSES = [
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", reference: "João 3:16" },
  { text: "O Senhor é o meu pastor, nada me faltará.", reference: "Salmos 23:1" },
  { text: "Tudo posso naquele que me fortalece.", reference: "Filipenses 4:13" },
  { text: "Buscai, pois, em primeiro lugar, o seu reino e a sua justiça, e todas estas coisas vos serão acrescentadas.", reference: "Mateus 6:33" },
  { text: "O meu socorro vem do Senhor, que fez o céu e a terra.", reference: "Salmos 121:2" }
];

export const SpiritualModule: React.FC<SpiritualModuleProps> = ({ userId, onAddTask }) => {
  const [verse, setVerse] = useState<{ text: string; reference: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [readingPlans, setReadingPlans] = useState<ReadingPlan[]>([]);
  const [selectedBook, setSelectedBook] = useState('Salmos');
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [goals, setGoals] = useState<SpiritualGoal[]>([]);
  const [newGoalTitle, setNewGoalTitle] = useState('');

  useEffect(() => {
    fetchDailyVerse();
    fetchDevotionals();
    fetchReadingPlans();
    fetchGoals();
  }, [userId]);

  const fetchGoals = () => {
    const q = query(
      collection(db, 'spiritual_goals'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpiritualGoal));
      setGoals(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'spiritual_goals'));
  };

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim()) return;
    try {
      await addDoc(collection(db, 'spiritual_goals'), {
        userId,
        title: newGoalTitle,
        progress: 0,
        completed: false,
        createdAt: serverTimestamp()
      });
      setNewGoalTitle('');
      toast.success('Meta espiritual criada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'spiritual_goals');
    }
  };

  const toggleGoal = async (goal: SpiritualGoal) => {
    try {
      await setDoc(doc(db, 'spiritual_goals', goal.id), {
        completed: !goal.completed,
        progress: !goal.completed ? 100 : 0
      }, { merge: true });
      toast.success(goal.completed ? 'Meta reaberta' : 'Meta concluída!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `spiritual_goals/${goal.id}`);
    }
  };

  const fetchDailyVerse = async () => {
    try {
      // Using a random verse from a reliable list for "verse of the day" feel
      // bible-api.com doesn't have a direct /random endpoint that works consistently
      const randomFallback = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
      setVerse(randomFallback);
    } catch (error) {
      console.error('Bible API error, using fallback:', error);
      const randomFallback = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
      setVerse(randomFallback);
    }
  };

  const fetchDevotionals = () => {
    const q = query(
      collection(db, 'spiritual_devotionals'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Devotional));
      setDevotionals(data);
      
      const todayDevotional = data.find(d => d.date === todayStr);
      if (todayDevotional) setNotes(todayDevotional.notes);
      
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'spiritual_devotionals'));
  };

  const fetchReadingPlans = () => {
    const q = query(
      collection(db, 'spiritual_reading_plans'),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReadingPlan));
      setReadingPlans(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'spiritual_reading_plans'));
  };

  const handleSaveDevotional = async () => {
    if (!verse || !notes) return;

    try {
      const devotionalData = {
        userId,
        verse,
        notes,
        date: todayStr,
        createdAt: serverTimestamp(),
      };

      // Use date as ID to ensure one per day
      await setDoc(doc(db, 'spiritual_devotionals', `${userId}_${todayStr}`), devotionalData);
      toast.success('Devocional salvo com sucesso!');
      
      // Suggest task
      onAddTask?.({
        title: `Refletir sobre devocional: ${verse.reference}`,
        description: `Anotação: ${notes.substring(0, 50)}...`,
        quadrant: 'important-not-urgent',
        moduleId: 'espiritual'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'spiritual_devotionals');
    }
  };

  const handleCreatePlan = async () => {
    try {
      const planData = {
        userId,
        book: selectedBook,
        totalChapters: 30, // Simplified for demo
        completedChapters: [],
        startDate: serverTimestamp(),
        targetDays: 30
      };

      await addDoc(collection(db, 'spiritual_reading_plans'), planData);
      toast.success(`Plano de leitura para ${selectedBook} iniciado!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'spiritual_reading_plans');
    }
  };

  const toggleChapter = async (plan: ReadingPlan, chapter: number) => {
    const isCompleted = plan.completedChapters.includes(chapter);
    const newCompleted = isCompleted 
      ? plan.completedChapters.filter(c => c !== chapter)
      : [...plan.completedChapters, chapter];

    try {
      await setDoc(doc(db, 'spiritual_reading_plans', plan.id), {
        completedChapters: newCompleted
      }, { merge: true });

      if (!isCompleted) {
        toast.success(`Capítulo ${chapter} concluído!`);
        onAddTask?.({
          title: `Leitura concluída: ${plan.book} ${chapter}`,
          description: `Meta diária do plano de leitura espiritual`,
          quadrant: 'not-urgent-not-important',
          moduleId: 'espiritual'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `spiritual_reading_plans/${plan.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Quote className="w-24 h-24" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Versículo do Dia
              </CardTitle>
              <CardDescription>Uma palavra para meditar hoje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verse ? (
                <>
                  <blockquote className="text-xl font-serif italic text-foreground leading-relaxed">
                    "{verse.text.trim()}"
                  </blockquote>
                  <div className="text-right font-bold text-primary">— {verse.reference}</div>
                </>
              ) : (
                <div className="h-24 flex items-center justify-center animate-pulse bg-muted rounded-lg" />
              )}
              <Button variant="outline" size="sm" onClick={fetchDailyVerse} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Versículo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Meu Devocional
              </CardTitle>
              <CardDescription>O que Deus falou com você hoje?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Anotações e Reflexões</Label>
                <Textarea 
                  id="notes"
                  placeholder="Escreva aqui suas reflexões sobre o versículo ou seu momento de oração..."
                  className="min-h-[150px] resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Anexar Foto ou Arte</Label>
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para anexar imagem do devocional</span>
                </div>
              </div>
              <Button onClick={handleSaveDevotional} className="w-full gap-2" disabled={!notes}>
                <Save className="w-4 h-4" />
                Salvar Devocional
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Plano de Leitura
              </CardTitle>
              <CardDescription>Acompanhe sua jornada na Bíblia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Escolha um livro" />
                  </SelectTrigger>
                  <SelectContent>
                    {BIBLE_BOOKS.map(book => (
                      <SelectItem key={book} value={book}>{book}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleCreatePlan} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Iniciar
                </Button>
              </div>

              <div className="space-y-4">
                {readingPlans.map(plan => (
                  <div key={plan.id} className="p-4 border rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold">{plan.book}</h4>
                      <span className="text-xs text-muted-foreground">
                        {plan.completedChapters.length} / {plan.totalChapters} capítulos
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all" 
                        style={{ width: `${(plan.completedChapters.length / plan.totalChapters) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const chapter = i + 1;
                        const isCompleted = plan.completedChapters.includes(chapter);
                        return (
                          <button
                            key={chapter}
                            onClick={() => toggleChapter(plan, chapter)}
                            className={cn(
                              "h-8 rounded flex items-center justify-center text-[10px] font-bold transition-colors",
                              isCompleted ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {chapter}
                          </button>
                        );
                      })}
                      <div className="col-span-6 text-center text-[10px] text-muted-foreground mt-1">
                        Mostrando primeiros 12 capítulos
                      </div>
                    </div>
                  </div>
                ))}
                {readingPlans.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                    Nenhum plano de leitura ativo
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="w-4 h-4" />
                Histórico Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devotionals.slice(0, 3).map(dev => (
                  <div key={dev.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-primary">{dev.verse.reference}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(() => {
                          try {
                            const date = new Date(dev.date + 'T12:00:00');
                            return isNaN(date.getTime()) ? dev.date : format(date, 'dd/MM/yyyy');
                          } catch {
                            return dev.date;
                          }
                        })()}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 italic">"{dev.verse.text.trim()}"</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Metas Espirituais
              </CardTitle>
              <CardDescription>Objetivos para sua caminhada de fé</CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Nova meta espiritual..."
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="flex-1 bg-muted/50 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button size="icon" onClick={handleCreateGoal} disabled={!newGoalTitle.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {goals.map(goal => (
                  <div key={goal.id} className="p-4 bg-card border rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleGoal(goal)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                          goal.completed ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        {goal.completed && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <span className={cn("text-sm font-medium", goal.completed && "line-through text-muted-foreground")}>
                        {goal.title}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-primary">{goal.progress}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

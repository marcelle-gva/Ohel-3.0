import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { FitnessHabit, WellBeingLog, MoodClassification, SolutionActivity, BiblicalVerseForMeditation } from '@/types';
import { getBibleVerseForMentalDump, ANXIETY_MEDITATION_VERSES } from '@/lib/bibleVerses';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dumbbell, 
  Droplets, 
  Zap, 
  Smile, 
  Plus, 
  Minus, 
  TrendingUp, 
  Activity, 
  Utensils, 
  CheckCircle2, 
  Flame,
  Brain,
  Mic,
  MicOff,
  Sparkles,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Check,
  Heart,
  ArrowRight,
  Loader2,
  AlertCircle,
  BookOpen,
  ExternalLink,
  Copy,
  Bookmark,
  History,
  Calendar,
  Search,
  Filter,
  CheckCheck,
  Quote
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface FitnessModuleProps {
  userId: string;
}

const MENTAL_DUMP_PROMPTS = [
  'Estou me sentindo muito sobrecarregada com prazos no trabalho e sinto que a casa está virada de cabeça pra baixo. Preciso respirar.',
  'Exausta física e mentalmente, dormi mal essa noite e estou sem energia para cumprir as tarefas de hoje.',
  'Ansiosa com muitas coisas acumuladas para resolver, medo de esquecer compromissos importantes dos filhos.',
  'Hoje acordei leve, motivada e focada para terminar minhas principais metas do dia!'
];

export const FitnessModule: React.FC<FitnessModuleProps> = ({ userId }) => {
  const [habits, setHabits] = useState<FitnessHabit[]>([]);
  const [wellBeing, setWellBeing] = useState<WellBeingLog | null>(null);
  const [wellBeingHistory, setWellBeingHistory] = useState<WellBeingLog[]>([]);
  const [activeTab, setActiveTab] = useState('habits');
  const [mentalDumpSubTab, setMentalDumpSubTab] = useState<'current' | 'history'>('current');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'anxiety' | 'overloaded' | 'exhausted' | 'positive'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [copiedVerseKey, setCopiedVerseKey] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  // Mental Dump & AI Mood state
  const [mentalDumpInput, setMentalDumpInput] = useState('');
  const [isAnalyzingDump, setIsAnalyzingDump] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState<any>(null);

  // Solution Activity interactive timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300); // default 5 min
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Menu and workout state
  const [foodsLogged, setFoodsLogged] = useState<{ id: string; name: string; calories: number }[]>([
    { id: '1', name: 'Arroz integral com frango', calories: 450 },
    { id: '2', name: 'Ovos mexidos com café', calories: 280 },
    { id: '3', name: 'Frutas e iogurte', calories: 210 }
  ]);
  const [foodSearch, setFoodSearch] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);

  const waterHabit = habits.find(h => h.type === 'WATER');
  const exerciseHabit = habits.find(h => h.type === 'EXERCISE');

  const totalCaloriesConsumed = foodsLogged.reduce((acc, f) => acc + f.calories, 0);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const recognizer = new SpeechRecognitionClass();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'pt-BR';

        recognizer.onresult = (event: any) => {
          let accumulatedFinal = '';
          let interim = '';

          for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedFinal += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          const fullTranscription = (accumulatedFinal + interim).trim();
          if (fullTranscription) {
            setMentalDumpInput(fullTranscription);
          }
        };

        recognizer.onerror = (event: any) => {
          console.warn('Speech recognition error in FitnessModule:', event.error);
          if (event.error === 'not-allowed') {
            toast.error('Permissão de microfone negada no navegador.');
          }
          setIsRecordingVoice(false);
        };

        recognizer.onend = () => {
          setIsRecordingVoice(false);
        };

        setSpeechRecognizer(recognizer);
      } catch (e) {
        console.warn('SpeechRecognition initialization error:', e);
      }
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!speechRecognizer) {
      toast.info('Reconhecimento de voz não suportado neste navegador. Digite seu texto.');
      return;
    }

    if (isRecordingVoice) {
      speechRecognizer.stop();
      setIsRecordingVoice(false);
      toast.info('Gravação de voz finalizada.');
    } else {
      try {
        speechRecognizer.start();
        setIsRecordingVoice(true);
        toast.success('Microfone ativo. Fale seu desabafo ou pensamentos...');
      } catch (err: any) {
        console.warn('Error starting speech recognizer:', err);
        setIsRecordingVoice(false);
      }
    }
  };

  // Timer logic for solution activity
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            toast.success('Tempo da atividade concluído! Como você se sente agora?');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleAddFood = () => {
    if (!foodSearch.trim()) return;
    const cals = parseInt(foodCalories) || 200;
    const newFood = {
      id: Date.now().toString(),
      name: foodSearch.trim(),
      calories: cals
    };
    setFoodsLogged(prev => [newFood, ...prev]);
    setFoodSearch('');
    setFoodCalories('');
    toast.success(`${newFood.name} (+${cals} kcal) registrado!`);
  };

  const handleStartWorkout = (workoutName: string) => {
    if (activeWorkout === workoutName) {
      setActiveWorkout(null);
      toast.success(`Treino "${workoutName}" concluído com sucesso! Parabéns pelo foco!`);
      if (exerciseHabit) {
        updateHabit(exerciseHabit, 1);
      }
    } else {
      setActiveWorkout(workoutName);
      toast.info(`Treino "${workoutName}" iniciado. Bom treino!`);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    const habitsQuery = query(
      collection(db, 'fitness_habits'),
      where('userId', '==', userId),
      where('date', '==', today)
    );
    
    const wellBeingQuery = query(
      collection(db, 'wellbeing_logs'),
      where('userId', '==', userId),
      where('date', '==', today)
    );

    const historyQuery = query(
      collection(db, 'wellbeing_logs'),
      where('userId', '==', userId)
    );

    const unsubHabits = onSnapshot(habitsQuery, (snap) => {
      setHabits(snap.docs.map(d => ({ id: d.id, ...d.data() } as FitnessHabit)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'fitness_habits'));

    const unsubWellBeing = onSnapshot(wellBeingQuery, (snap) => {
      if (!snap.empty) {
        setWellBeing({ id: snap.docs[0].id, ...snap.docs[0].data() } as WellBeingLog);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'wellbeing_logs'));

    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WellBeingLog));
      // Sort in memory by date descending, or createdAt if available
      logs.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setWellBeingHistory(logs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'wellbeing_logs'));

    return () => {
      unsubHabits();
      unsubWellBeing();
      unsubHistory();
    };
  }, [userId, today]);

  const updateWater = async (delta: number) => {
    try {
      if (waterHabit) {
        const newVal = Math.max(0, waterHabit.current + delta);
        await setDoc(doc(db, 'fitness_habits', waterHabit.id), {
          current: newVal
        }, { merge: true });
      } else {
        const newVal = Math.max(0, delta);
        await addDoc(collection(db, 'fitness_habits'), {
          userId,
          name: 'Água',
          type: 'WATER',
          target: 2500,
          current: newVal,
          date: today,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'fitness_habits');
    }
  };

  const updateHabit = async (habit: FitnessHabit, delta: number) => {
    try {
      const newVal = Math.max(0, habit.current + delta);
      await setDoc(doc(db, 'fitness_habits', habit.id), {
        current: newVal
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `fitness_habits/${habit.id}`);
    }
  };

  const logWellBeing = async (field: 'mood' | 'energy', value: number) => {
    try {
      const logData = {
        userId,
        date: today,
        mood: wellBeing?.mood || 3,
        energy: wellBeing?.energy || 3,
        [field]: value,
        updatedAt: serverTimestamp()
      };
      
      if (wellBeing) {
        await setDoc(doc(db, 'wellbeing_logs', wellBeing.id), logData, { merge: true });
      } else {
        await addDoc(collection(db, 'wellbeing_logs'), logData);
      }
      toast.success('Estado de bem-estar atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'wellbeing_logs');
    }
  };

  // Helper to copy verse text
  const handleCopyVerse = (verseText: string, refText: string, key: string) => {
    const fullText = `"${verseText}" — ${refText} (Bíblia Online: bibliaonline.com.br)`;
    navigator.clipboard.writeText(fullText);
    setCopiedVerseKey(key);
    toast.success('Versículo copiado com sucesso!');
    setTimeout(() => setCopiedVerseKey(null), 2500);
  };

  // Helper to save verse directly to user's Devocional Espiritual
  const handleSaveVerseToDevotional = async (verseToSave: BiblicalVerseForMeditation, reflectionText?: string) => {
    try {
      const devotionalDocRef = doc(db, 'spiritual_devotionals', `${userId}_${today}`);
      const devotionalData = {
        userId,
        verse: {
          text: verseToSave.text,
          reference: `${verseToSave.reference} (${verseToSave.version || 'Bíblia Online'})`
        },
        notes: reflectionText || `Meditação gerada pelo Descarrego Mental OHEL:\n${verseToSave.meditation || ''}\nFonte: ${verseToSave.sourceUrl}`,
        date: today,
        createdAt: serverTimestamp(),
      };

      await setDoc(devotionalDocRef, devotionalData, { merge: true });
      toast.success('Versículo e meditação salvos no seu Devocional Espiritual!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'spiritual_devotionals');
    }
  };

  // AI Mental Dump & Mood Analysis Handler
  const handleAnalyzeMentalDump = async () => {
    if (!mentalDumpInput.trim()) {
      toast.error('Digite ou fale seu desabafo ou pensamentos para a IA analisar.');
      return;
    }

    setIsAnalyzingDump(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') : '';
      const response = await fetch(`${backendUrl}/api/agent/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: mentalDumpInput.trim() })
      });

      let data: any;
      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error('Fallback to local heuristics');
      }

      // Extract classified values
      const moodLevel = data.mood?.level || 3;
      const moodLabel = data.mood?.label || 'Equilibrada / Em Transição';
      const sentiment = (data.mood?.sentiment || 'neutro') as any;
      const detectedKeywords = data.detectedKeywords || ['Desabafo diário'];
      const solutionActivity = data.solutionActivity || {
        title: 'Pausa Restaurativa 4-7-8',
        description: 'Faça 4 ciclos de respiração diafragmática para acalmar os batimentos cardíacos.',
        duration: '5 min',
        type: 'respiracao',
        benefit: 'Reduz o estresse agudo e traz foco instantâneo.'
      };

      // Select or sanitize biblical verse (specifically handling anxiety with bibliaonline.com.br reference)
      let biblicalVerse: BiblicalVerseForMeditation = data.biblicalVerse;
      if (!biblicalVerse || !biblicalVerse.reference || !biblicalVerse.sourceUrl) {
        biblicalVerse = getBibleVerseForMentalDump(mentalDumpInput, sentiment, detectedKeywords);
      } else if (sentiment === 'ansioso' && !biblicalVerse.isAnxietyVerse) {
        // Enforce anxiety-specific verse if user is anxious
        biblicalVerse = getBibleVerseForMentalDump(mentalDumpInput, 'ansioso', detectedKeywords);
      }

      // Save into Firestore wellbeing_logs
      const logPayload = {
        userId,
        date: today,
        mood: moodLevel,
        energy: wellBeing?.energy || (moodLevel <= 2 ? 2 : 4),
        moodLabel,
        sentiment,
        mentalDumpText: mentalDumpInput.trim(),
        detectedKeywords,
        suggestedActivity: {
          ...solutionActivity,
          completed: false
        },
        biblicalVerse,
        updatedAt: serverTimestamp()
      };

      if (wellBeing?.id) {
        await setDoc(doc(db, 'wellbeing_logs', wellBeing.id), logPayload, { merge: true });
      } else {
        await addDoc(collection(db, 'wellbeing_logs'), logPayload);
      }

      // Update timer duration according to recommended activity
      const durMinutes = parseInt(solutionActivity.duration) || 5;
      setTimerSeconds(durMinutes * 60);

      toast.success('Descarrego analisado! Humor classificado, solução gerada e versículo bíblico associado.');
    } catch (err) {
      console.warn('AI analysis fallback:', err);
      // Local fallback analysis with bibliaonline anxiety verses
      const lower = mentalDumpInput.toLowerCase();
      let moodLevel = 3;
      let moodLabel = 'Equilibrada / Em Transição';
      let sentiment: 'sobrecarregado' | 'exausto' | 'ansioso' | 'neutro' | 'focado' | 'positivo' = 'neutro';
      const detectedKeywords: string[] = [];

      if (lower.includes('sobrecarregada') || lower.includes('caos') || lower.includes('estressada')) {
        moodLevel = 1;
        moodLabel = 'Sobrecarregada / Caos Mental';
        sentiment = 'sobrecarregado';
        detectedKeywords.push('Sobrecarga mental', 'Caos mental');
      } else if (lower.includes('exausta') || lower.includes('cansada') || lower.includes('sono')) {
        moodLevel = 2;
        moodLabel = 'Exausta / Esgotamento Físico';
        sentiment = 'exausto';
        detectedKeywords.push('Exaustão física', 'Cansaço acumulado');
      } else if (lower.includes('ansiosa') || lower.includes('ansiedade') || lower.includes('muita coisa') || lower.includes('medo') || lower.includes('angustia') || lower.includes('angústia')) {
        moodLevel = 2;
        moodLabel = 'Ansiosa / Mente Acelerada';
        sentiment = 'ansioso';
        detectedKeywords.push('Ansiedade', 'Acúmulo de demandas');
      } else {
        moodLevel = 4;
        moodLabel = 'Focada & Produtiva';
        sentiment = 'positivo';
        detectedKeywords.push('Busca por foco e clareza');
      }

      const solutionActivity = {
        title: sentiment === 'ansioso' ? 'Alongamento Suave & Pausa 4-7-8' : 'Pausa Restaurativa & Hidratação',
        description: 'Sente-se, feche os olhos por 3 minutos e faça 4 ciclos de respiração diafragmática. Em seguida, beba um copo grande de água.',
        duration: '5 min',
        type: 'respiracao',
        benefit: 'Desacelera a mente e normaliza o cortisol imediatamente.',
        completed: false
      };

      const biblicalVerse = getBibleVerseForMentalDump(mentalDumpInput, sentiment, detectedKeywords);

      const logPayload = {
        userId,
        date: today,
        mood: moodLevel,
        energy: wellBeing?.energy || 3,
        moodLabel,
        sentiment,
        mentalDumpText: mentalDumpInput.trim(),
        detectedKeywords,
        suggestedActivity: solutionActivity,
        biblicalVerse,
        updatedAt: serverTimestamp()
      };

      if (wellBeing?.id) {
        await setDoc(doc(db, 'wellbeing_logs', wellBeing.id), logPayload, { merge: true });
      } else {
        await addDoc(collection(db, 'wellbeing_logs'), logPayload);
      }

      setTimerSeconds(300);
      toast.success('Descarrego analisado localmente com versículo da Bíblia Online associado!');
    } finally {
      setIsAnalyzingDump(false);
    }
  };

  const handleCompleteSolutionActivity = async () => {
    if (!wellBeing?.id) return;
    try {
      await setDoc(doc(db, 'wellbeing_logs', wellBeing.id), {
        suggestedActivity: {
          ...wellBeing.suggestedActivity,
          completed: true
        },
        mood: Math.min(5, (wellBeing.mood || 3) + 1), // Increase mood by 1 point after activity
        updatedAt: serverTimestamp()
      }, { merge: true });

      setTimerRunning(false);
      toast.success('Parabéns! Atividade de descompressão concluída com sucesso. Seu humor foi elevado!');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `wellbeing_logs/${wellBeing.id}`);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pilar Pessoal</h2>
          <p className="text-muted-foreground">Descarrego mental com IA, humor, hábitos, alimentação e treinos.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap">
          <TabsTrigger value="habits" className="rounded-lg gap-2">
            <Zap className="w-4 h-4" /> Hábitos & Saúde
          </TabsTrigger>
          <TabsTrigger value="mental-dump" className="rounded-lg gap-2 text-blue-600 dark:text-blue-400 font-bold">
            <Brain className="w-4 h-4" /> Descarrego Mental & Humor IA
          </TabsTrigger>
          <TabsTrigger value="menu" className="rounded-lg gap-2">
            <Utensils className="w-4 h-4" /> Cardápio & Calorias
          </TabsTrigger>
          <TabsTrigger value="fitness" className="rounded-lg gap-2">
            <Dumbbell className="w-4 h-4" /> Área Fitness
          </TabsTrigger>
        </TabsList>

        {/* TAB: MENTAL DUMP & AI MOOD CLASSIFICATION */}
        <TabsContent value="mental-dump" className="space-y-6">
          {/* Sub-navigation for Mental Dump: Current vs History */}
          <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mentalDumpSubTab === 'current' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMentalDumpSubTab('current')}
                className="rounded-xl text-xs font-black uppercase tracking-wider gap-2 h-9"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Descarrego Atual & Diagnóstico</span>
              </Button>

              <Button
                type="button"
                variant={mentalDumpSubTab === 'history' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMentalDumpSubTab('history')}
                className="rounded-xl text-xs font-black uppercase tracking-wider gap-2 h-9"
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico & Versículos Bíblicos ({wellBeingHistory.filter(h => h.mentalDumpText).length})</span>
              </Button>
            </div>

            {mentalDumpSubTab === 'history' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nos descarregos ou versículos..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-9 pl-8 pr-3 text-xs w-64 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {mentalDumpSubTab === 'current' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Input Column */}
              <div className="lg:col-span-6 space-y-6">
                <Card className="rounded-3xl border-primary/20 shadow-lg bg-card overflow-hidden">
                  <CardHeader className="bg-primary/5 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-black uppercase tracking-tight">
                            Descarrego Mental com IA
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Desabafe seus pensamentos por texto ou voz. A IA identificará os gatilhos, classificará seu humor e associará um versículo da Bíblia Online para meditar.
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="relative">
                      <Textarea
                        placeholder="Despeje aqui tudo o que está pesando na sua mente: demandas urgentes, ansiedade, cansaço, prazos, afazeres da casa, sentimentos..."
                        className="min-h-[160px] rounded-2xl resize-none p-4 text-sm bg-muted/20 border-primary/20 focus-visible:ring-primary leading-relaxed"
                        value={mentalDumpInput}
                        onChange={(e) => setMentalDumpInput(e.target.value)}
                      />

                      {isRecordingVoice && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                          Gravando voz...
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <Button
                        type="button"
                        variant={isRecordingVoice ? "destructive" : "outline"}
                        size="sm"
                        onClick={toggleVoiceRecording}
                        className="rounded-xl text-xs font-bold gap-2 h-10 px-4"
                      >
                        {isRecordingVoice ? (
                          <>
                            <MicOff className="w-4 h-4" />
                            <span>Parar Gravação</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4 text-primary" />
                            <span>Falar por Voz</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        disabled={isAnalyzingDump || !mentalDumpInput.trim()}
                        onClick={handleAnalyzeMentalDump}
                        className="rounded-xl text-xs font-black uppercase tracking-wider gap-2 h-10 px-6 shadow-md shadow-primary/20"
                      >
                        {isAnalyzingDump ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processando com IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Analisar & Meditar</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Quick Prompts */}
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Exemplos Rápidos de Desabafo:</p>
                      <div className="flex flex-col gap-1.5">
                        {MENTAL_DUMP_PROMPTS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setMentalDumpInput(p)}
                            className="text-left text-xs p-2 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary border transition-all truncate"
                          >
                            💬 {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Results & Solution Column */}
              <div className="lg:col-span-6 space-y-6">
                {wellBeing?.mentalDumpText || wellBeing?.moodLabel ? (
                  <>
                    {/* Mood Classification Diagnosis */}
                    <Card className="rounded-3xl border-blue-500/30 shadow-lg bg-gradient-to-br from-card via-card to-blue-500/5 overflow-hidden">
                      <CardHeader className="bg-blue-500/5 pb-3 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Smile className="w-4 h-4 text-blue-500" />
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-blue-600">
                              Diagnóstico de Humor Classificado
                            </CardTitle>
                          </div>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs font-black uppercase tracking-wider px-3 py-1 border",
                              wellBeing.mood <= 1 && "text-red-600 border-red-500/30 bg-red-500/10",
                              wellBeing.mood === 2 && "text-amber-600 border-amber-500/30 bg-amber-500/10",
                              wellBeing.mood === 3 && "text-blue-600 border-blue-500/30 bg-blue-500/10",
                              wellBeing.mood >= 4 && "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                            )}
                          >
                            Nível {wellBeing.mood}/5 • {wellBeing.moodLabel || 'Equilibrada'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        {wellBeing.detectedKeywords && wellBeing.detectedKeywords.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Palavras & Temas de Descarrego Identificados:</p>
                            <div className="flex flex-wrap gap-2">
                              {wellBeing.detectedKeywords.map((kw, i) => (
                                <span key={i} className="text-xs px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {wellBeing.mentalDumpText && (
                          <div className="p-3.5 rounded-2xl bg-muted/40 border text-xs text-muted-foreground italic leading-relaxed">
                            "{wellBeing.mentalDumpText}"
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Biblical Verse for Meditation (Bíblia Online) */}
                    {wellBeing.biblicalVerse && (
                      <Card className={cn(
                        "rounded-3xl shadow-lg border overflow-hidden transition-all",
                        wellBeing.biblicalVerse.isAnxietyVerse
                          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-background"
                          : "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background"
                      )}>
                        <CardHeader className="pb-3 border-b bg-muted/30">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground">
                                {wellBeing.biblicalVerse.isAnxietyVerse
                                  ? '🕊️ Versículo de Ansiedade para Meditar'
                                  : '📖 Versículo do Dia para Meditação'}
                              </CardTitle>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 border",
                                wellBeing.biblicalVerse.isAnxietyVerse
                                  ? "text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/15"
                                  : "text-primary border-primary/30 bg-primary/10"
                              )}
                            >
                              Referência: Bíblia Online (NVI)
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="space-y-2">
                            <blockquote className="text-sm sm:text-base font-serif italic text-foreground leading-relaxed border-l-4 border-amber-500/60 pl-4 py-1">
                              "{wellBeing.biblicalVerse.text}"
                            </blockquote>
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                                — {wellBeing.biblicalVerse.reference}
                              </span>
                              {wellBeing.biblicalVerse.theme && (
                                <span className="text-muted-foreground text-[11px] italic">
                                  Tema: {wellBeing.biblicalVerse.theme}
                                </span>
                              )}
                            </div>
                          </div>

                          {wellBeing.biblicalVerse.meditation && (
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                              <strong className="font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                Meditação Prática para Acalmar a Mente:
                              </strong>
                              {wellBeing.biblicalVerse.meditation}
                            </div>
                          )}

                          {/* Action Buttons for the Verse */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyVerse(wellBeing.biblicalVerse!.text, wellBeing.biblicalVerse!.reference, 'current')}
                                className="rounded-xl text-xs font-bold gap-1.5 h-8"
                              >
                                {copiedVerseKey === 'current' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedVerseKey === 'current' ? 'Copiado!' : 'Copiar'}</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveVerseToDevotional(wellBeing.biblicalVerse!)}
                                className="rounded-xl text-xs font-bold gap-1.5 h-8 text-pink-600 border-pink-500/30 hover:bg-pink-500/10"
                              >
                                <Heart className="w-3.5 h-3.5" />
                                <span>Salvar no Devocional</span>
                              </Button>
                            </div>

                            {wellBeing.biblicalVerse.sourceUrl && (
                              <a
                                href={wellBeing.biblicalVerse.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl px-3 py-1.5 transition-all"
                              >
                                <span>Abrir na Bíblia Online</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Coherent Solution Activity Card */}
                    {wellBeing.suggestedActivity && (
                      <Card className="rounded-3xl border-emerald-500/30 shadow-lg bg-gradient-to-br from-emerald-500/5 via-card to-background overflow-hidden">
                        <CardHeader className="bg-emerald-500/10 pb-3 border-b">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600" />
                              <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-600">
                                Atividade de Solução Coerente Sugerida
                              </CardTitle>
                            </div>
                            <Badge variant="secondary" className="text-xs font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300">
                              ⏱ {wellBeing.suggestedActivity.duration || '5 min'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="space-y-1.5">
                            <h4 className="text-base font-bold text-foreground flex items-center justify-between">
                              <span>{wellBeing.suggestedActivity.title}</span>
                              {wellBeing.suggestedActivity.completed && (
                                <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Concluída
                                </span>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {wellBeing.suggestedActivity.description}
                            </p>
                          </div>

                          {wellBeing.suggestedActivity.benefit && (
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                              <strong className="font-bold">Benefício:</strong> {wellBeing.suggestedActivity.benefit}
                            </div>
                          )}

                          {/* Interactive Timer & Complete Button */}
                          <div className="p-4 rounded-2xl bg-muted/30 border flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-mono font-black text-lg text-primary">
                                {formatTime(timerSeconds)}
                              </div>
                              <div>
                                <p className="text-xs font-bold">Timer da Atividade</p>
                                <p className="text-[11px] text-muted-foreground">Foco de descompressão</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTimerRunning(!timerRunning)}
                                className="rounded-xl text-xs font-bold gap-1.5 h-9"
                              >
                                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                <span>{timerRunning ? 'Pausar' : 'Iniciar'}</span>
                              </Button>

                              <Button
                                size="sm"
                                disabled={wellBeing.suggestedActivity.completed}
                                onClick={handleCompleteSolutionActivity}
                                className="rounded-xl text-xs font-black uppercase tracking-wider gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{wellBeing.suggestedActivity.completed ? 'Concluída' : 'Marcar Concluída'}</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="p-12 rounded-3xl border border-dashed text-center space-y-4 bg-muted/10 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Brain className="w-8 h-8 opacity-60" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h3 className="font-bold text-base">Nenhum descarrego analisado hoje</h3>
                      <p className="text-xs text-muted-foreground">
                        Use a caixa ao lado para desabafar em texto ou voz. A IA identificará o estado emocional, prescreverá uma atividade de alívio e associará um versículo da Bíblia Online para meditação.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* HISTORY TAB OF MENTAL DUMPS & ASSOCIATED BIBLE VERSES */
            <div className="space-y-6">
              {/* Filter chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Button
                  size="sm"
                  variant={historyFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('all')}
                  className="rounded-xl text-xs font-bold h-8"
                >
                  Todos ({wellBeingHistory.filter(h => h.mentalDumpText).length})
                </Button>
                <Button
                  size="sm"
                  variant={historyFilter === 'anxiety' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('anxiety')}
                  className="rounded-xl text-xs font-bold h-8 text-amber-600 border-amber-500/30"
                >
                  🕊️ Ansiedade (Bíblia Online) ({wellBeingHistory.filter(h => h.sentiment === 'ansioso' || h.biblicalVerse?.isAnxietyVerse).length})
                </Button>
                <Button
                  size="sm"
                  variant={historyFilter === 'overloaded' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('overloaded')}
                  className="rounded-xl text-xs font-bold h-8 text-red-600 border-red-500/30"
                >
                  ⚡ Sobrecarga ({wellBeingHistory.filter(h => h.sentiment === 'sobrecarregado').length})
                </Button>
                <Button
                  size="sm"
                  variant={historyFilter === 'exhausted' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('exhausted')}
                  className="rounded-xl text-xs font-bold h-8 text-purple-600 border-purple-500/30"
                >
                  🔋 Exaustão ({wellBeingHistory.filter(h => h.sentiment === 'exausto').length})
                </Button>
                <Button
                  size="sm"
                  variant={historyFilter === 'positive' ? 'default' : 'outline'}
                  onClick={() => setHistoryFilter('positive')}
                  className="rounded-xl text-xs font-bold h-8 text-emerald-600 border-emerald-500/30"
                >
                  ✨ Positivos ({wellBeingHistory.filter(h => h.sentiment === 'positivo' || h.mood >= 4).length})
                </Button>
              </div>

              {/* History Timeline */}
              {(() => {
                const filtered = wellBeingHistory.filter(item => {
                  if (!item.mentalDumpText && !item.moodLabel) return false;
                  
                  // Filter by category
                  if (historyFilter === 'anxiety' && item.sentiment !== 'ansioso' && !item.biblicalVerse?.isAnxietyVerse) return false;
                  if (historyFilter === 'overloaded' && item.sentiment !== 'sobrecarregado') return false;
                  if (historyFilter === 'exhausted' && item.sentiment !== 'exausto') return false;
                  if (historyFilter === 'positive' && item.sentiment !== 'positivo' && item.mood < 4) return false;

                  // Search term filter
                  if (historySearch.trim()) {
                    const term = historySearch.toLowerCase();
                    const inText = item.mentalDumpText?.toLowerCase().includes(term);
                    const inVerse = item.biblicalVerse?.text?.toLowerCase().includes(term) || item.biblicalVerse?.reference?.toLowerCase().includes(term);
                    const inKeywords = item.detectedKeywords?.some(k => k.toLowerCase().includes(term));
                    if (!inText && !inVerse && !inKeywords) return false;
                  }

                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 rounded-3xl border border-dashed text-center space-y-4 bg-muted/10">
                      <History className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm">Nenhum registro histórico encontrado</h4>
                        <p className="text-xs text-muted-foreground">
                          {historySearch ? 'Tente buscar por outro termo ou limpe o filtro.' : 'Faça um descarrego mental com a IA para iniciar seu histórico com versículos bíblicos.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {filtered.map((item, index) => {
                      const verse = item.biblicalVerse || (item.mentalDumpText ? getBibleVerseForMentalDump(item.mentalDumpText, item.sentiment, item.detectedKeywords) : null);
                      const key = item.id || `hist_${index}`;

                      return (
                        <Card key={key} className="rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden bg-card">
                          <CardHeader className="bg-muted/20 pb-3 border-b">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                  {item.date === today ? 'Hoje' : item.date}
                                </span>
                                <Badge 
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border",
                                    item.mood <= 1 && "text-red-600 border-red-500/30 bg-red-500/10",
                                    item.mood === 2 && "text-amber-600 border-amber-500/30 bg-amber-500/10",
                                    item.mood === 3 && "text-blue-600 border-blue-500/30 bg-blue-500/10",
                                    item.mood >= 4 && "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                  )}
                                >
                                  Nível {item.mood}/5 • {item.moodLabel || 'Humor Registrado'}
                                </Badge>
                              </div>

                              {verse?.isAnxietyVerse && (
                                <Badge variant="outline" className="text-[10px] font-bold text-amber-700 bg-amber-500/10 border-amber-500/30">
                                  🕊️ Alívio de Ansiedade
                                </Badge>
                              )}
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 space-y-4">
                            {/* Mental dump text */}
                            {item.mentalDumpText && (
                              <div className="p-3 rounded-2xl bg-muted/40 border text-xs text-foreground leading-relaxed">
                                <span className="font-bold text-muted-foreground block mb-1">Desabafo / Descarrego:</span>
                                "{item.mentalDumpText}"
                              </div>
                            )}

                            {/* Detected triggers */}
                            {item.detectedKeywords && item.detectedKeywords.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {item.detectedKeywords.map((kw, kidx) => (
                                  <span key={kidx} className="text-[11px] px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold">
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Associated Bible Verse & Meditation */}
                            {verse && (
                              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card to-background border border-amber-500/30 space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Versículo Associado: {verse.reference}</span>
                                  </div>
                                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                    {verse.version || 'Bíblia Online'}
                                  </Badge>
                                </div>

                                <blockquote className="text-xs sm:text-sm font-serif italic text-foreground border-l-2 border-amber-500/60 pl-3 leading-relaxed">
                                  "{verse.text}"
                                </blockquote>

                                {verse.meditation && (
                                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                    <strong className="text-foreground">Meditação:</strong> {verse.meditation}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleCopyVerse(verse.text, verse.reference, key)}
                                      className="rounded-lg text-xs h-7 px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                                    >
                                      {copiedVerseKey === key ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedVerseKey === key ? 'Copiado' : 'Copiar'}</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSaveVerseToDevotional(verse, `Histórico de Descarrego (${item.date}): ${verse.meditation || ''}`)}
                                      className="rounded-lg text-xs h-7 px-2.5 gap-1 text-pink-600 hover:text-pink-700 hover:bg-pink-500/10"
                                    >
                                      <Heart className="w-3 h-3" />
                                      <span>Salvar no Devocional</span>
                                    </Button>
                                  </div>

                                  {verse.sourceUrl && (
                                    <a
                                      href={verse.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-500/10 rounded-lg px-2.5 py-1 border border-blue-500/20"
                                    >
                                      <span>Bíblia Online</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Suggested Activity Footer */}
                            {item.suggestedActivity && (
                              <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                  Atividade: <strong className="text-foreground">{item.suggestedActivity.title}</strong> ({item.suggestedActivity.duration})
                                </span>
                                {item.suggestedActivity.completed ? (
                                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-bold">
                                    ✓ Concluída
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Pendente
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* TAB: HABITS & HEALTH */}
        <TabsContent value="habits" className="space-y-6">
          {/* Quick Mental Dump Banner inside Habits tab */}
          <Card className="rounded-3xl border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-card to-primary/5 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-base flex items-center gap-2">
                  Descarrego Mental com IA & Diagnóstico de Humor
                  {wellBeing?.moodLabel && (
                    <Badge variant="outline" className="text-[10px] font-black uppercase text-blue-600 border-blue-500/30">
                      Hoje: {wellBeing.moodLabel}
                    </Badge>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Identifique sobrecargas, classifique seu humor e receba soluções de autocuidado automáticas.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setActiveTab('mental-dump')}
              className="rounded-xl text-xs font-black uppercase tracking-wider gap-2 shrink-0 self-end sm:self-auto"
            >
              <span>Abrir Descarrego</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Water Control */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  Controle de Água
                </CardTitle>
                <CardDescription>Meta diária: 2.5L</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <span className="text-5xl font-bold text-blue-500">
                    {((waterHabit?.current || 0) / 1000).toFixed(1)}
                  </span>
                  <span className="text-xl text-muted-foreground ml-2">L</span>
                </div>
                <Progress value={((waterHabit?.current || 0) / 2500) * 100} className="h-3 bg-blue-500/10" />
                <div className="flex justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => updateWater(-250)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button variant="default" className="bg-blue-500 hover:bg-blue-600" onClick={() => updateWater(250)}>
                    <Plus className="w-4 h-4 mr-2" /> 250ml
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Well-being Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="w-5 h-5 text-amber-500" />
                  Estado de Espírito
                </CardTitle>
                <CardDescription>Como você se sente hoje?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-widest opacity-70">Humor</Label>
                    {wellBeing?.moodLabel && (
                      <span className="text-[11px] font-bold text-amber-600">{wellBeing.moodLabel}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button 
                        key={v}
                        onClick={() => logWellBeing('mood', v)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all font-bold",
                          wellBeing?.mood === v ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-widest opacity-70">Energia</Label>
                  <div className="flex justify-between">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button 
                        key={v}
                        onClick={() => logWellBeing('energy', v)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all font-bold",
                          wellBeing?.energy === v ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Steps & Habits */}
            <Card className="border-green-500/20 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Metas Diárias
                </CardTitle>
                <CardDescription>Pequenas vitórias, grandes resultados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-card border rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="font-bold text-sm">Passos</p>
                      <p className="text-xs text-muted-foreground">Meta: 10.000</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm">6.432</span>
                </div>
                <div className="p-4 bg-card border rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-bold text-sm">Leitura</p>
                      <p className="text-xs text-muted-foreground">Meta: 15 min</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Concluir</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Contador de Calorias</CardTitle>
                <CardDescription>Busque alimentos e registre seu consumo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form 
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddFood();
                  }}
                >
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ex: Arroz integral..." 
                      value={foodSearch}
                      onChange={e => setFoodSearch(e.target.value)}
                      aria-label="Nome do alimento"
                    />
                    <Input 
                      placeholder="kcal" 
                      type="number"
                      className="w-20"
                      value={foodCalories}
                      onChange={e => setFoodCalories(e.target.value)}
                      aria-label="Calorias"
                    />
                    <Button type="submit" size="icon" aria-label="Adicionar refeição">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </form>

                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-medium">Consumido Hoje</span>
                    </div>
                    <span className="font-bold">{totalCaloriesConsumed} kcal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Meta Diária</span>
                    </div>
                    <span className="font-bold">2.000 kcal</span>
                  </div>
                  <Progress value={Math.min(100, (totalCaloriesConsumed / 2000) * 100)} className="h-2" />
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Refeições de Hoje</Label>
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {foodsLogged.map(f => (
                      <div key={f.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20">
                        <span>{f.name}</span>
                        <span className="font-semibold text-primary">{f.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cardápio Semanal</CardTitle>
                <CardDescription>Planeje suas refeições para a semana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => (
                    <div key={day} className="p-4 border rounded-2xl bg-muted/5">
                      <h4 className="font-bold text-sm mb-2 text-primary">{day}</h4>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Almoço: Frango com batata doce</p>
                        <p>Jantar: Salada completa</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fitness" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Treino Semanal</CardTitle>
              <CardDescription>Sua rotina de exercícios planejada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cn("p-6 border rounded-3xl transition-all", activeWorkout === 'Treino A' ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-primary/5 border-primary/20")}>
                  <Dumbbell className="w-8 h-8 text-primary mb-4" />
                  <h4 className="font-bold text-lg mb-2">Treino A</h4>
                  <p className="text-sm text-muted-foreground mb-4">Foco: Membros Superiores</p>
                  <ul className="text-xs space-y-2 mb-6">
                    <li>• Supino Reto - 4x12</li>
                    <li>• Remada Curvada - 4x12</li>
                    <li>• Desenvolvimento - 3x15</li>
                  </ul>
                  <Button 
                    className="w-full"
                    variant={activeWorkout === 'Treino A' ? 'default' : 'outline'}
                    onClick={() => handleStartWorkout('Treino A')}
                  >
                    {activeWorkout === 'Treino A' ? 'Concluir Treino A' : 'Iniciar Treino A'}
                  </Button>
                </div>
                <div className={cn("p-6 border rounded-3xl transition-all", activeWorkout === 'Treino B' ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/5")}>
                  <Dumbbell className="w-8 h-8 text-muted-foreground mb-4" />
                  <h4 className="font-bold text-lg mb-2">Treino B</h4>
                  <p className="text-sm text-muted-foreground mb-4">Foco: Membros Inferiores</p>
                  <ul className="text-xs space-y-2 mb-6">
                    <li>• Agachamento - 4x12</li>
                    <li>• Leg Press - 4x15</li>
                    <li>• Extensora - 3x20</li>
                  </ul>
                  <Button 
                    variant={activeWorkout === 'Treino B' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => handleStartWorkout('Treino B')}
                  >
                    {activeWorkout === 'Treino B' ? 'Concluir Treino B' : 'Iniciar Treino B'}
                  </Button>
                </div>
                <div className={cn("p-6 border rounded-3xl transition-all", activeWorkout === 'Cardio' ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/5")}>
                  <Activity className="w-8 h-8 text-muted-foreground mb-4" />
                  <h4 className="font-bold text-lg mb-2">Cardio</h4>
                  <p className="text-sm text-muted-foreground mb-4">Foco: Resistência</p>
                  <ul className="text-xs space-y-2 mb-6">
                    <li>• Corrida - 30 min</li>
                    <li>• Pular Corda - 10 min</li>
                  </ul>
                  <Button 
                    variant={activeWorkout === 'Cardio' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => handleStartWorkout('Cardio')}
                  >
                    {activeWorkout === 'Cardio' ? 'Concluir Cardio' : 'Iniciar Cardio'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};


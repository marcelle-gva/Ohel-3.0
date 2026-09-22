import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Heart, 
  ArrowRight, 
  Copy, 
  Check, 
  RotateCcw, 
  Brain, 
  Plus, 
  ListPlus,
  Compass,
  FileText,
  Smile,
  ShieldAlert,
  FolderSync,
  Loader2,
  Calendar as CalendarIcon,
  Cake
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { EisenhowerQuadrant, TaskType } from '@/types';

export interface AgentTask {
  title: string;
  category: 'Trabalho' | 'Casa' | 'Família' | 'Autocuidado' | string;
  priority: 1 | 2 | 3;
  added?: boolean;
  isBirthday?: boolean;
  isCalendarEvent?: boolean;
  dueDate?: number;
  dateString?: string;
  dateFormatted?: string;
}

const MONTHS_PT_MAP: Record<string, number> = {
  'janeiro': 0, 'jan': 0,
  'fevereiro': 1, 'fev': 1,
  'março': 2, 'marco': 2, 'mar': 2,
  'abril': 3, 'abr': 3,
  'maio': 4, 'mai': 4,
  'junho': 5, 'jun': 5,
  'julho': 6, 'jul': 6,
  'agosto': 7, 'ago': 7,
  'setembro': 8, 'set': 8,
  'outubro': 9, 'out': 9,
  'novembro': 10, 'nov': 10,
  'dezembro': 11, 'dez': 11,
};

function extractEventAndDate(text: string): {
  isBirthday: boolean;
  isCalendarEvent: boolean;
  dueDate?: number;
  dateString?: string;
  dateFormatted?: string;
} {
  const lower = text.toLowerCase();
  
  const birthdayKeywords = ['niver', 'aniversário', 'aniversario', 'aniversariante', 'bday', 'cumpleaños', 'parabéns', 'festa de aniversário', 'comemoração'];
  const isBirthday = birthdayKeywords.some(kw => lower.includes(kw));
  
  const calendarKeywords = ['consulta', 'médico', 'medico', 'dentista', 'reunião', 'reuniao', 'evento', 'viagem', 'encontro', 'festa', 'jantar', 'almoço', 'almoco', 'voo', 'palestra', 'agendar', 'calendário', 'calendario'];
  const isCalendarEvent = isBirthday || calendarKeywords.some(kw => lower.includes(kw));

  const now = new Date();
  const currentYear = now.getFullYear();
  let extractedDate: Date | null = null;

  // 1. Relative dates: "hoje", "amanhã", "depois de amanhã"
  if (lower.includes('depois de amanhã') || lower.includes('depois de amanha')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 0, 0);
  } else if (lower.includes('amanhã') || lower.includes('amanha')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
  } else if (lower.includes('hoje')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  }

  // 2. Days of week: "próximo sábado", "sábado", "domingo", etc.
  if (!extractedDate) {
    const daysOfWeek: Record<string, number> = {
      'domingo': 0, 'dom': 0,
      'segunda': 1, 'segunda-feira': 1, 'seg': 1,
      'terça': 2, 'terca': 2, 'terça-feira': 2, 'ter': 2,
      'quarta': 3, 'quarta-feira': 3, 'qua': 3,
      'quinta': 4, 'quinta-feira': 4, 'qui': 4,
      'sexta': 5, 'sexta-feira': 5, 'sex': 5,
      'sábado': 6, 'sabado': 6, 'sab': 6
    };
    
    for (const [dayName, targetDayIndex] of Object.entries(daysOfWeek)) {
      const dayRegex = new RegExp(`(?:próxim[oa]\\s+)?\\b${dayName}\\b`, 'i');
      if (dayRegex.test(lower)) {
        const currentDayIndex = now.getDay();
        let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7;
        extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 9, 0, 0);
        break;
      }
    }
  }

  // 3. Pattern: "dia 15 de setembro [de 2026]" or "15 de setembro"
  if (!extractedDate) {
    const dayMonthRegex = /(?:dia\s+)?(\d{1,2})\s*(?:de\s+)?([a-zçãé]+)(?:\s*(?:de\s+)?(\d{4}))?/i;
    const match = lower.match(dayMonthRegex);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const yearNum = match[3] ? parseInt(match[3], 10) : currentYear;
      
      if (MONTHS_PT_MAP[monthStr] !== undefined && dayNum >= 1 && dayNum <= 31) {
        const monthIndex = MONTHS_PT_MAP[monthStr];
        extractedDate = new Date(yearNum, monthIndex, dayNum, 9, 0, 0);
      }
    }
  }

  // 4. Pattern: "15/09" or "15/09/2026" or "15-09"
  if (!extractedDate) {
    const slashRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
    const match = lower.match(slashRegex);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      const monthNum = parseInt(match[2], 10) - 1;
      let yearNum = match[3] ? parseInt(match[3], 10) : currentYear;
      if (yearNum < 100) yearNum += 2000;

      if (monthNum >= 0 && monthNum <= 11 && dayNum >= 1 && dayNum <= 31) {
        extractedDate = new Date(yearNum, monthNum, dayNum, 9, 0, 0);
      }
    }
  }

  // 5. Pattern: "dia 25"
  if (!extractedDate) {
    const bareDayRegex = /\bdia\s+(\d{1,2})\b/i;
    const match = lower.match(bareDayRegex);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        let monthIndex = now.getMonth();
        let yearNum = now.getFullYear();
        if (dayNum < now.getDate()) {
          monthIndex += 1;
          if (monthIndex > 11) {
            monthIndex = 0;
            yearNum += 1;
          }
        }
        extractedDate = new Date(yearNum, monthIndex, dayNum, 9, 0, 0);
      }
    }
  }

  if (extractedDate) {
    const yyyy = extractedDate.getFullYear();
    const mm = String(extractedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(extractedDate.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    const dateFormatted = `${dd}/${mm}/${yyyy}`;
    
    return {
      isBirthday,
      isCalendarEvent: true,
      dueDate: extractedDate.getTime(),
      dateString,
      dateFormatted
    };
  }

  return {
    isBirthday,
    isCalendarEvent,
  };
}

export interface AgentResponse {
  summary: string;
  tasks: AgentTask[];
  insights: string;
  detectedKeywords?: string[];
  mood?: {
    level: number;
    label: string;
    sentiment: 'sobrecarregado' | 'exausto' | 'ansioso' | 'neutro' | 'focado' | 'positivo';
    color?: string;
  };
  solutionActivity?: {
    title: string;
    description: string;
    duration: string;
    type: string;
    benefit: string;
  };
}

interface OhelAgentViewProps {
  userId: string;
  userName?: string;
  onTasksAdded?: () => void;
}

const QUICK_PROMPTS = [
  {
    title: '🎂 Aniversário & Evento de Calendário',
    text: 'Lembrar do niver da minha mãe dia 15 de setembro, comprar o presente de aniversário e reservar restaurante.'
  },
  {
    title: 'Rotina Matinal & Compromissos',
    text: 'Preciso levar as crianças na escola às 7h30, comprar leite e remédio na farmácia, terminar a apresentação para o time antes das 11h e agendar a consulta com o pediatra.'
  },
  {
    title: 'Desabafo de Sobrecarga Mental',
    text: 'Estou me sentindo muito sobrecarregada com prazos no trabalho e sinto que a casa está virada de cabeça pra baixo. Preciso organizar o jantar de hoje, responder 10 e-mails atrasados e tirar 15 minutos pra respirar.'
  },
  {
    title: 'Fim de Semana Familiar & Autocuidado',
    text: 'No sábado quero fazer uma caminhada ao ar livre de manhã, almoçar com a minha mãe, ajudar meu filho com o trabalho de ciências e consertar a maçaneta da porta do quarto.'
  }
];

export const OhelAgentView: React.FC<OhelAgentViewProps> = ({ userId, userName = 'Usuária', onTasksAdded }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [savedTasks, setSavedTasks] = useState<Record<number, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

  // Web Speech & Audio Recording Engine with Fallbacks
  const [recognition, setRecognition] = useState<any>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
            setInputText(fullTranscription);
          }
        };

        recognizer.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toast.error('Permissão de microfone bloqueada pelo navegador. Permita o acesso ao microfone nas configurações.');
          } else if (event.error === 'no-speech') {
            // Silence detected, do not interrupt
            return;
          } else if (event.error === 'network') {
            toast.error('Erro de conexão com o serviço de voz. Verifique sua internet ou digite suas anotações.');
          } else if (event.error !== 'aborted') {
            toast.error(`Aviso de áudio: ${event.error}. Você também pode digitar seu texto.`);
          }
          setIsRecording(false);
        };

        recognizer.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognizer;
        setRecognition(recognizer);
      } catch (e) {
        console.warn('SpeechRecognition initialization warning:', e);
      }
    }
  }, []);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping audio recorder:', err);
      }
      setIsRecording(false);
      toast.info('Gravação finalizada! Você já pode clicar em "Organizar com IA".');
      return;
    }

    // Start recording with permission check
    try {
      // Request mic permission explicitly to trigger browser prompt and verify microphone access
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Setup MediaRecorder as secondary listener / stream keeper
        try {
          const mediaRecorder = new MediaRecorder(stream);
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorder.start();
          mediaRecorderRef.current = mediaRecorder;
        } catch (recorderErr) {
          console.warn('MediaRecorder not available or failed, using pure speech recognition:', recorderErr);
        }
      }

      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.success('Gravando áudio... Fale suas tarefas, rotinas ou desabafos.');
      } else {
        setIsRecording(true);
        toast.info('Microfone ativo. Como este navegador não possui transcritor nativo, fale pausadamente ou use a caixa de texto.');
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setIsRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Permissão de microfone negada. Clique no ícone de cadeado na barra de endereços para liberar o microfone.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error('Nenhum microfone detectado no seu dispositivo.');
      } else {
        toast.error('Não foi possível iniciar a gravação. Você pode digitar diretamente na caixa de texto.');
      }
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      toast.error('Digite ou fale algo antes de processar.');
      return;
    }

    setLoading(true);
    setResult(null);
    setSavedTasks({});

    const inputData = inputText.trim();

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') : '';
      const response = await fetch(`${backendUrl}/api/agent/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputData })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao processar pelo motor de inteligência.');
      }

      const data: AgentResponse = await response.json();
      setResult(data);
      toast.success('Pensamentos organizados com sucesso pelo Agente OHEL!');
    } catch (err: any) {
      console.warn('Backend agent request failed or offline, running local high-fidelity intelligence parser:', err);
      
      // Resilient client-side fallback parsing
      const rawSegments = inputData
        .split(/(?:\r?\n|;|\. |\be\b|\balém de\b|\btambém\b)/i)
        .map(s => s.trim())
        .filter(s => s.length > 5);

      const tasks: AgentTask[] = [];
      const workKeywords = ['trabalho', 'reunião', 'apresentação', 'projeto', 'cliente', 'e-mail', 'email', 'relatório', 'prazo', 'demanda', 'meta', 'empresa'];
      const familyKeywords = ['filho', 'filha', 'criança', 'crianças', 'escola', 'mãe', 'pai', 'marido', 'esposa', 'pediatra', 'família', 'casa', 'niver', 'aniversário', 'aniversario', 'bday', 'aniversariante', 'cumpleaños', 'parabéns'];
      const selfCareKeywords = ['respirar', 'caminhada', 'médico', 'consulta', 'academia', 'exercício', 'treino', 'descanso', 'dormir', 'massagem', 'autocuidado', 'água'];

      for (const seg of rawSegments) {
        const lower = seg.toLowerCase();
        const dateInfo = extractEventAndDate(seg);

        let category: 'Trabalho' | 'Casa' | 'Família' | 'Autocuidado' = 'Casa';
        if (dateInfo.isBirthday) {
          category = 'Família';
        } else if (workKeywords.some(k => lower.includes(k))) {
          category = 'Trabalho';
        } else if (familyKeywords.some(k => lower.includes(k))) {
          category = 'Família';
        } else if (selfCareKeywords.some(k => lower.includes(k))) {
          category = 'Autocuidado';
        }

        let priority: 1 | 2 | 3 = 2;
        if (lower.includes('urgente') || lower.includes('hoje') || lower.includes('agora') || lower.includes('antes das') || lower.includes('às ') || lower.includes('remédio')) {
          priority = 1;
        } else if (lower.includes('sábado') || lower.includes('domingo') || lower.includes('fim de semana')) {
          priority = 3;
        }

        let formattedTitle = seg.charAt(0).toUpperCase() + seg.slice(1);
        if (dateInfo.isBirthday && !formattedTitle.includes('🎂')) {
          formattedTitle = `🎂 ${formattedTitle}`;
        }

        if (formattedTitle.length > 3 && !tasks.some(t => t.title.toLowerCase() === formattedTitle.toLowerCase())) {
          tasks.push({
            title: formattedTitle.length > 90 ? formattedTitle.slice(0, 90) + '...' : formattedTitle,
            category,
            priority,
            isBirthday: dateInfo.isBirthday,
            isCalendarEvent: dateInfo.isCalendarEvent,
            dueDate: dateInfo.dueDate,
            dateString: dateInfo.dateString,
            dateFormatted: dateInfo.dateFormatted
          });
        }
      }

      if (tasks.length === 0) {
        const dateInfo = extractEventAndDate(inputData);
        let title = inputData.length > 80 ? inputData.slice(0, 80) + '...' : inputData;
        if (dateInfo.isBirthday && !title.includes('🎂')) {
          title = `🎂 ${title}`;
        }

        tasks.push({
          title,
          category: dateInfo.isBirthday ? 'Família' : 'Trabalho',
          priority: 1,
          isBirthday: dateInfo.isBirthday,
          isCalendarEvent: dateInfo.isCalendarEvent,
          dueDate: dateInfo.dueDate,
          dateString: dateInfo.dateString,
          dateFormatted: dateInfo.dateFormatted
        });
      }

      const lowerText = inputData.toLowerCase();
      const detectedKeywords: string[] = [];
      const dumpKeywords = [
        { k: 'exausta', label: 'Exaustão física' },
        { k: 'cansada', label: 'Cansaço acumulado' },
        { k: 'sobrecarregada', label: 'Sobrecarga mental' },
        { k: 'estressada', label: 'Alto estresse' },
        { k: 'ansiosa', label: 'Ansiedade / Agitação' },
        { k: 'muita coisa', label: 'Acúmulo de demandas' },
        { k: 'caos', label: 'Caos mental' },
        { k: 'perdida', label: 'Desorientação' },
        { k: 'desabafo', label: 'Necessidade de desabafo' },
        { k: 'respirar', label: 'Necessidade de pausa' }
      ];

      for (const item of dumpKeywords) {
        if (lowerText.includes(item.k)) detectedKeywords.push(item.label);
      }
      if (detectedKeywords.length === 0) detectedKeywords.push('Organização de rotina diária');

      let moodLevel = 3;
      let moodLabel = 'Equilibrada / Em Transição';
      let sentiment: 'sobrecarregado' | 'exausto' | 'ansioso' | 'neutro' | 'focado' | 'positivo' = 'neutro';
      let moodColor = 'text-blue-500 bg-blue-500/10 border-blue-500/30';

      if (lowerText.includes('sobrecarregada') || lowerText.includes('estressada') || lowerText.includes('caos')) {
        moodLevel = 1;
        moodLabel = 'Sobrecarregada / Caos Mental';
        sentiment = 'sobrecarregado';
        moodColor = 'text-red-500 bg-red-500/10 border-red-500/30';
      } else if (lowerText.includes('exausta') || lowerText.includes('cansada')) {
        moodLevel = 2;
        moodLabel = 'Exausta / Esgotamento Físico';
        sentiment = 'exausto';
        moodColor = 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      } else if (lowerText.includes('ansiosa') || lowerText.includes('muita coisa')) {
        moodLevel = 2;
        moodLabel = 'Ansiosa / Mente Acelerada';
        sentiment = 'ansioso';
        moodColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      }

      const fallbackData: AgentResponse = {
        summary: `Organizamos suas anotações em ${tasks.length} ${tasks.length === 1 ? 'item acionável' : 'itens acionáveis'}, identificamos os pontos de sobrecarga e classificamos seu humor.`,
        tasks: tasks.slice(0, 8),
        insights: 'Lembre-se: produtividade consciente consiste em focar no essencial primeiro. Respire fundo e execute por prioridade.',
        detectedKeywords,
        mood: {
          level: moodLevel,
          label: moodLabel,
          sentiment,
          color: moodColor
        },
        solutionActivity: {
          title: 'Pausa Restaurativa 4-7-8 & Hidratação',
          description: 'Sente-se, feche os olhos por 3 minutos e faça 4 ciclos de respiração diafragmática (inspire 4s, retenha 7s, expire 8s). Em seguida, beba um copo de água.',
          duration: '5 min',
          type: 'respiracao',
          benefit: 'Desacelera a mente e normaliza os níveis de cortisol imediatamente.'
        }
      };

      setResult(fallbackData);
      toast.success('Pensamentos organizados com sucesso pelo Agente OHEL!');
    } finally {
      setLoading(false);
    }
  };

  const mapCategoryAndPriorityToQuadrant = (category: string, priority: number): { quadrant: EisenhowerQuadrant, moduleId: string } => {
    let moduleId = 'familiar';
    const catLower = (category || '').toLowerCase();

    if (catLower.includes('trabalho') || catLower.includes('profissional')) {
      moduleId = 'profissional';
    } else if (catLower.includes('autocuidado') || catLower.includes('saúde') || catLower.includes('fitness')) {
      moduleId = 'fitness';
    } else if (catLower.includes('família') || catLower.includes('casa')) {
      moduleId = 'familiar';
    }

    // Priority 1: urgent-important (Faça agora)
    // Priority 2: important-not-urgent (Agende)
    // Priority 3: urgent-not-important (Delegue/Rápido)
    let quadrant: EisenhowerQuadrant = 'important-not-urgent';
    if (priority === 1) {
      quadrant = 'urgent-important';
    } else if (priority === 2) {
      quadrant = 'important-not-urgent';
    } else {
      quadrant = 'urgent-not-important';
    }

    return { quadrant, moduleId };
  };

  const handleSaveSingleTask = async (task: AgentTask, index: number) => {
    if (!userId) {
      toast.error('Usuário não autenticado.');
      return;
    }

    try {
      const isBday = task.isBirthday || task.title.includes('🎂') || task.title.toLowerCase().includes('niver') || task.title.toLowerCase().includes('aniversário') || task.title.toLowerCase().includes('aniversario');
      const isCal = task.isCalendarEvent || isBday || !!task.dueDate;

      let { quadrant, moduleId } = mapCategoryAndPriorityToQuadrant(task.category, task.priority);
      if (isCal || isBday) {
        quadrant = 'important-not-urgent'; // Agendar no Calendário
      }

      const tags = [task.category, `P${task.priority}`];
      if (isBday) tags.push('Aniversário');
      if (isCal) tags.push('Calendário');

      const dueDateValue = task.dueDate || (isCal || isBday ? Date.now() + 86400000 : undefined);

      await addDoc(collection(db, 'tasks'), {
        userId,
        title: task.title,
        description: `Categoria: ${task.category} | Prioridade P${task.priority} ${isBday ? '| 🎂 Aniversário / Calendário' : ''} (Organizado pelo Motor Central OHEL)`,
        quadrant,
        moduleId,
        status: 'PENDING',
        completed: false,
        type: 'PERSONAL' as TaskType,
        tags,
        ...(dueDateValue ? { dueDate: dueDateValue } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Synchronize to Family Events if it's a family/birthday event
      if (isBday || task.category === 'Família') {
        try {
          await addDoc(collection(db, 'personal_family'), {
            userId,
            title: task.title,
            date: dueDateValue ? new Date(dueDateValue) : new Date(),
            category: 'EVENT',
            createdAt: serverTimestamp()
          });
        } catch (syncErr) {
          console.warn('Family events sync note:', syncErr);
        }
      }

      setSavedTasks(prev => ({ ...prev, [index]: true }));
      if (isBday) {
        toast.success(`🎂 Aniversário "${task.title}" adicionado ao seu Calendário e Mural da Família!`);
      } else if (isCal) {
        toast.success(`📅 Evento "${task.title}" adicionado ao seu Calendário!`);
      } else {
        toast.success(`Tarefa "${task.title}" adicionada ao seu painel!`);
      }
      if (onTasksAdded) onTasksAdded();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const handleSaveAllTasks = async () => {
    if (!result?.tasks?.length || !userId) return;
    setSavingAll(true);

    try {
      for (let i = 0; i < result.tasks.length; i++) {
        if (!savedTasks[i]) {
          const task = result.tasks[i];
          const isBday = task.isBirthday || task.title.includes('🎂') || task.title.toLowerCase().includes('niver') || task.title.toLowerCase().includes('aniversário') || task.title.toLowerCase().includes('aniversario');
          const isCal = task.isCalendarEvent || isBday || !!task.dueDate;

          let { quadrant, moduleId } = mapCategoryAndPriorityToQuadrant(task.category, task.priority);
          if (isCal || isBday) {
            quadrant = 'important-not-urgent';
          }

          const tags = [task.category, `P${task.priority}`];
          if (isBday) tags.push('Aniversário');
          if (isCal) tags.push('Calendário');

          const dueDateValue = task.dueDate || (isCal || isBday ? Date.now() + 86400000 : undefined);

          await addDoc(collection(db, 'tasks'), {
            userId,
            title: task.title,
            description: `Categoria: ${task.category} | Prioridade P${task.priority} ${isBday ? '| 🎂 Aniversário / Calendário' : ''} (Organizado pelo Motor Central OHEL)`,
            quadrant,
            moduleId,
            status: 'PENDING',
            completed: false,
            type: 'PERSONAL' as TaskType,
            tags,
            ...(dueDateValue ? { dueDate: dueDateValue } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          if (isBday || task.category === 'Família') {
            try {
              await addDoc(collection(db, 'personal_family'), {
                userId,
                title: task.title,
                date: dueDateValue ? new Date(dueDateValue) : new Date(),
                category: 'EVENT',
                createdAt: serverTimestamp()
              });
            } catch (syncErr) {
              console.warn('Family events sync note:', syncErr);
            }
          }

          setSavedTasks(prev => ({ ...prev, [i]: true }));
        }
      }
      toast.success('Todas as tarefas e eventos foram salvos no seu OHEL e Calendário!');
      if (onTasksAdded) onTasksAdded();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    } finally {
      setSavingAll(false);
    }
  };

  const handleCopyJSON = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedJson(true);
    toast.success('JSON copiado para a área de transferência!');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge className="bg-red-500/15 text-red-600 border border-red-500/30 text-[10px] font-black uppercase tracking-wider">P1 • Urgente</Badge>;
      case 2:
        return <Badge className="bg-blue-500/15 text-blue-600 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider">P2 • Importante</Badge>;
      case 3:
      default:
        return <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">P3 • Rotina</Badge>;
    }
  };

  const getCategoryColor = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('trabalho')) return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
    if (cat.includes('casa')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (cat.includes('família') || cat.includes('familia')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    if (cat.includes('autocuidado')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.25em] text-primary">Motor de Inteligência Central</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase italic">
              Agente de Gestão OHEL
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed font-medium">
              Transforme desabafos, áudios transcritos, anotações rápidas e pensamentos soltos em um plano de vida organizado, acolhedor e com prioridades claras.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-background/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border text-xs font-bold text-muted-foreground shadow-sm">
            <Brain className="w-4 h-4 text-primary" />
            <span>Sincronização & Rotina Familiar</span>
          </div>
        </div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Input Section */}
      <Card className="rounded-3xl border shadow-lg overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Entrada em Linguagem Natural
              </CardTitle>
              <CardDescription className="text-xs">
                Despeje sua mente: anotações, transcrição de áudio, desabafos ou listas do dia a dia.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant={isRecording ? 'destructive' : 'outline'}
              size="sm"
              onClick={toggleRecording}
              className="rounded-xl font-bold text-xs gap-2 h-9 px-3.5 transition-all shadow-sm"
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4 animate-bounce" />
                  <span>Parar Gravação</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-primary" />
                  <span>Gravar Áudio</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {isRecording && (
            <div className="flex items-center justify-between p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl animate-pulse">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-red-600">Microfone gravando em tempo real... Fale suas tarefas ou pensamentos.</span>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-xs font-black uppercase text-red-600 hover:bg-red-500/20"
                onClick={toggleRecording}
              >
                Concluir
              </Button>
            </div>
          )}

          <div className="relative">
            <Textarea
              placeholder="Exemplo: 'Preciso organizar as compras da semana, levar o Theo na natação às 16h, responder o e-mail do financeiro da empresa e reservar um tempo para meditar...'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[140px] text-base p-4 rounded-2xl bg-background border resize-y focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            {inputText && (
              <button
                onClick={() => setInputText('')}
                className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground font-bold px-2 py-1 bg-muted rounded-md"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Quick Inspiration Pills */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Exemplos Rápidos de Despejo Mental:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(prompt.text)}
                  className="text-left text-xs bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border rounded-xl px-3 py-1.5 transition-all font-medium"
                >
                  ✨ {prompt.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              onClick={handleProcess}
              disabled={loading || !inputText.trim()}
              className="rounded-2xl h-12 px-8 font-black uppercase tracking-wider text-xs gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando Estrutura...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Processar com Agente OHEL</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state skeleton/feedback */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl border border-primary/20 bg-card/60 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4 shadow-sm"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <Brain className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="font-black uppercase tracking-tight text-base">O Motor Central está atuando</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Categorizando em Trabalho, Casa, Família e Autocuidado, definindo prioridades de 1 a 3 e gerando reflexões empáticas...
            </p>
          </div>
        </motion.div>
      )}

      {/* Response Display Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Executive Summary Card */}
            <Card className="rounded-3xl border-primary/30 shadow-xl overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
              <CardHeader className="pb-3 border-b bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-primary">
                      Resumo Executivo Acolhedor
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyJSON}
                    className="h-8 text-[11px] font-bold gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-base text-foreground leading-relaxed font-medium">
                  {result.summary}
                </p>
              </CardContent>
            </Card>

            {/* Mental Dump Keywords & Mood Classification Card */}
            {(result.mood || (result.detectedKeywords && result.detectedKeywords.length > 0)) && (
              <Card className="rounded-3xl border-blue-500/30 shadow-xl overflow-hidden bg-gradient-to-br from-card via-card to-blue-500/5">
                <CardHeader className="pb-3 border-b bg-blue-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600">
                        <Brain className="w-4 h-4" />
                      </span>
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-blue-600">
                        Diagnóstico Emocional & Descarrego Mental
                      </CardTitle>
                    </div>
                    {result.mood && (
                      <Badge variant="outline" className={`text-xs font-black uppercase tracking-wider px-3 py-1 border ${result.mood.color || 'border-blue-500/30 text-blue-600'}`}>
                        Nível {result.mood.level}/5 • {result.mood.label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {result.detectedKeywords && result.detectedKeywords.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Palavras & Gatilhos de Descarrego Identificados:</p>
                      <div className="flex flex-wrap gap-2">
                        {result.detectedKeywords.map((kw, kIdx) => (
                          <span key={kIdx} className="text-xs px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Coherent Solution Activity Card */}
            {result.solutionActivity && (
              <Card className="rounded-3xl border-emerald-500/30 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-500/5 via-card to-background">
                <CardHeader className="pb-3 border-b bg-emerald-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-600">
                        Atividade de Solução Coerente Recomendada
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
                      ⏱ {result.solutionActivity.duration}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-foreground">
                      {result.solutionActivity.title}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.solutionActivity.description}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      <strong className="font-bold">Benefício Imediato:</strong> {result.solutionActivity.benefit}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSingleTask({
                        title: `${result.solutionActivity!.title} (${result.solutionActivity!.duration})`,
                        category: 'Autocuidado',
                        priority: 1
                      }, 999)}
                      className="rounded-xl text-xs font-black uppercase tracking-wider gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Solução ao Autocuidado</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actionable Tasks List */}
            <Card className="rounded-3xl border shadow-xl">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                      <ListPlus className="w-4 h-4 text-primary" />
                      Tarefas e Compromissos Estruturados ({result.tasks?.length || 0})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Categorias estritas: Trabalho, Casa, Família e Autocuidado com prioridade de 1 (alta) a 3 (baixa).
                    </CardDescription>
                  </div>

                  {result.tasks?.length > 0 && (
                    <Button
                      onClick={handleSaveAllTasks}
                      disabled={savingAll || Object.keys(savedTasks).length === result.tasks.length}
                      size="sm"
                      className="rounded-xl font-black uppercase tracking-wider text-[11px] h-9 px-4 gap-1.5 self-start sm:self-auto"
                    >
                      {savingAll ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : Object.keys(savedTasks).length === result.tasks.length ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <FolderSync className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {Object.keys(savedTasks).length === result.tasks.length 
                          ? 'Todas Salvas no OHEL' 
                          : 'Salvar Todas no OHEL'}
                      </span>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-3">
                  {result.tasks?.map((task, idx) => {
                    const isAdded = !!savedTasks[idx];
                    const isBday = task.isBirthday || task.title.includes('🎂') || task.title.toLowerCase().includes('niver') || task.title.toLowerCase().includes('aniversário') || task.title.toLowerCase().includes('aniversario');
                    const isCal = task.isCalendarEvent || isBday || !!task.dueDate || !!task.dateString;
                    const displayDate = task.dateFormatted || (task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : undefined);

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isAdded 
                            ? 'bg-muted/40 border-green-500/30' 
                            : isBday
                            ? 'bg-pink-500/5 border-pink-500/30 hover:border-pink-500/50 hover:shadow-md'
                            : 'bg-card hover:border-primary/40 hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getCategoryColor(task.category)}`}>
                              {task.category}
                            </span>
                            {getPriorityBadge(task.priority)}

                            {isBday && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30 flex items-center gap-1">
                                <Cake className="w-3 h-3 text-pink-600" />
                                Aniversário
                              </span>
                            )}

                            {isCal && displayDate && (
                              <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3 text-blue-600" />
                                {displayDate}
                              </span>
                            )}

                            {isAdded && (
                              <Badge variant="outline" className="text-[10px] font-black text-green-600 bg-green-500/10 border-green-500/20">
                                Salva no Painel & Calendário
                              </Badge>
                            )}
                          </div>
                          <p className="font-bold text-sm text-foreground tracking-tight">
                            {task.title}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant={isAdded ? "secondary" : isBday ? "default" : "outline"}
                          size="sm"
                          disabled={isAdded}
                          onClick={() => handleSaveSingleTask(task, idx)}
                          className={`rounded-xl text-[11px] font-black uppercase tracking-wider h-8 px-3 gap-1 shrink-0 self-end sm:self-auto ${
                            isBday && !isAdded ? 'bg-pink-600 hover:bg-pink-700 text-white shadow-sm' : ''
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Salvo</span>
                            </>
                          ) : isBday ? (
                            <>
                              <Cake className="w-3.5 h-3.5" />
                              <span>Adicionar ao Calendário</span>
                            </>
                          ) : isCal ? (
                            <>
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>Agendar no Calendário</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}

                  {(!result.tasks || result.tasks.length === 0) && (
                    <div className="py-8 text-center text-muted-foreground opacity-60">
                      <p className="text-xs uppercase font-bold tracking-widest">Nenhuma tarefa direta identificada.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Insights & Encouragement Card */}
            {result.insights && (
              <Card className="rounded-3xl border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-background shadow-xl overflow-hidden">
                <CardHeader className="pb-2 border-b bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600">
                      <Heart className="w-4 h-4 fill-amber-500/20" />
                    </span>
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-amber-600">
                      Reflexão, Direcionamento & Encorajamento
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm md:text-base text-foreground/90 italic leading-relaxed font-medium">
                    "{result.insights}"
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

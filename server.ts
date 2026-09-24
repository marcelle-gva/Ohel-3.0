import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { StreamClient } from '@stream-io/node-sdk';
import { GoogleGenAI, Type } from '@google/genai';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId?: string; [key: string]: any };
    }
  }
}

dotenv.config();

// Helper function: High-grade heuristic NLP fallback when Gemini API key is offline or quota reached
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

  // 1. Check relative days: "hoje", "amanhã", "amanha", "depois de amanhã"
  if (lower.includes('depois de amanhã') || lower.includes('depois de amanha')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 0, 0);
  } else if (lower.includes('amanhã') || lower.includes('amanha')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
  } else if (lower.includes('hoje')) {
    extractedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  }

  // 2. Check days of the week: "próximo sábado", "sábado", "domingo", etc.
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

  const isValidDate = (year: number, month: number, day: number, date: Date) => {
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  };

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
        const candidate = new Date(yearNum, monthIndex, dayNum, 9, 0, 0);
        if (isValidDate(yearNum, monthIndex, dayNum, candidate)) {
          extractedDate = candidate;
        }
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
        const candidate = new Date(yearNum, monthNum, dayNum, 9, 0, 0);
        if (isValidDate(yearNum, monthNum, dayNum, candidate)) {
          extractedDate = candidate;
        }
      }
    }
  }

  // 5. Pattern: "dia 25" (without month)
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
        const candidate = new Date(yearNum, monthIndex, dayNum, 9, 0, 0);
        if (isValidDate(yearNum, monthIndex, dayNum, candidate)) {
          extractedDate = candidate;
        }
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

function parseInputHeuristically(input: string) {
  const cleanInput = input.trim();
  const lowerInput = cleanInput.toLowerCase();

  const rawSegments = cleanInput
    .split(/(?:\r?\n|;|\. |\be\b|\balém de\b|\btambém\b)/i)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const tasks: Array<{ 
    title: string; 
    category: 'Trabalho' | 'Casa' | 'Família' | 'Autocuidado'; 
    priority: 1 | 2 | 3;
    isBirthday?: boolean;
    isCalendarEvent?: boolean;
    dueDate?: number;
    dateString?: string;
  }> = [];

  const workKeywords = ['trabalho', 'reunião', 'apresentação', 'projeto', 'cliente', 'e-mail', 'email', 'relatório', 'prazo', 'demanda', 'meta', 'equipe', 'time', 'entrega', 'documento', 'empresa'];
  const familyKeywords = ['filho', 'filha', 'criança', 'crianças', 'escola', 'mãe', 'pai', 'marido', 'esposa', 'pediatra', 'família', 'pais', 'irmão', 'irmã', 'jantar em família', 'casa', 'niver', 'aniversário', 'aniversario', 'bday', 'aniversariante', 'cumpleaños', 'parabéns'];
  const selfCareKeywords = ['respirar', 'caminhada', 'médico', 'consulta', 'academia', 'exercício', 'treino', 'descanso', 'dormir', 'massagem', 'terapia', 'autocuidado', 'oração', 'leitura', 'meditação', 'água'];

  for (const seg of rawSegments) {
    const lower = seg.toLowerCase();
    const dateInfo = extractEventAndDate(seg);
    
    // Determine category
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

    // Determine priority
    let priority: 1 | 2 | 3 = 2;
    if (
      lower.includes('urgente') || 
      lower.includes('hoje') || 
      lower.includes('agora') || 
      lower.includes('antes das') || 
      lower.includes('às ') || 
      lower.includes('remédio') || 
      lower.includes('imediato') ||
      lower.includes('7h') ||
      lower.includes('8h') ||
      lower.includes('11h')
    ) {
      priority = 1;
    } else if (lower.includes('sábado') || lower.includes('domingo') || lower.includes('quando der') || lower.includes('fim de semana')) {
      priority = 3;
    }

    // Clean title & add birthday emoji if birthday detected
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
        dateString: dateInfo.dateString
      });
    }
  }

  // If no granular tasks were split, use the entire input as a single task
  if (tasks.length === 0) {
    const dateInfo = extractEventAndDate(cleanInput);
    let title = cleanInput.length > 80 ? cleanInput.slice(0, 80) + '...' : cleanInput;
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
      dateString: dateInfo.dateString
    });
  }

  // --- MENTAL DUMP KEYWORDS & MOOD CLASSIFICATION ---
  const dumpKeywordMap: Record<string, string> = {
    'exausta': 'Exaustão física',
    'exausto': 'Exaustão física',
    'cansada': 'Cansaço acumulado',
    'cansado': 'Cansaço acumulado',
    'sobrecarregada': 'Sobrecarga mental',
    'sobrecarregado': 'Sobrecarga mental',
    'estressada': 'Alto estresse',
    'estressado': 'Alto estresse',
    'ansiosa': 'Ansiedade / Agitação',
    'ansioso': 'Ansiedade / Agitação',
    'angústia': 'Angústia emocional',
    'não aguento': 'Limite emocional',
    'socorro': 'Urgência de alívio',
    'muita coisa': 'Acúmulo de demandas',
    'caos': 'Caos mental',
    'perdida': 'Desorientação',
    'perdido': 'Desorientação',
    'sem tempo': 'Sensação de escassez de tempo',
    'sem paciência': 'Esgotamento de paciência',
    'pressão': 'Pressão externa',
    'dormir': 'Privação de sono',
    'insônia': 'Insônia',
    'preocupada': 'Preocupação excessiva',
    'preocupado': 'Preocupação excessiva',
    'desabafo': 'Necessidade de desabafo',
    'respirar': 'Necessidade de pausa',
    'paz': 'Busca por serenidade',
    'calma': 'Busca por equilíbrio',
    'foco': 'Busca por direcionamento',
    'empolgada': 'Entusiasmo positivo',
    'feliz': 'Estado de contentamento',
    'aliviada': 'Alívio perceptível',
    'grata': 'Gratidão consciente'
  };

  const detectedKeywords: string[] = [];
  for (const [key, label] of Object.entries(dumpKeywordMap)) {
    if (lowerInput.includes(key) && !detectedKeywords.includes(label)) {
      detectedKeywords.push(label);
    }
  }

  if (detectedKeywords.length === 0) {
    if (tasks.length > 3) detectedKeywords.push('Múltiplas demandas simultâneas');
    else detectedKeywords.push('Organização de rotina diária');
  }

  // Calculate mood level (1-5) and classification
  let moodLevel = 3;
  let moodLabel = 'Neutra / Em Processo de Organização';
  let sentiment: 'sobrecarregado' | 'exausto' | 'ansioso' | 'neutro' | 'focado' | 'positivo' = 'neutro';
  let moodColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';

  const hasHighStress = ['sobrecarregada', 'sobrecarregado', 'não aguento', 'socorro', 'caos', 'estressada', 'estressado', 'sem paciência'].some(k => lowerInput.includes(k));
  const hasExhaustion = ['exausta', 'exausto', 'cansada', 'cansado', 'sem energia', 'insônia', 'dormir mal'].some(k => lowerInput.includes(k));
  const hasAnxiety = ['ansiosa', 'ansioso', 'angústia', 'perdida', 'perdido', 'preocupada', 'preocupado', 'muita coisa'].some(k => lowerInput.includes(k));
  const hasPositive = ['feliz', 'empolgada', 'grata', 'produtiva', 'aliviada', 'ótimo', 'foco'].some(k => lowerInput.includes(k));

  if (hasHighStress) {
    moodLevel = 1;
    moodLabel = 'Sobrecarregada / Caos Mental';
    sentiment = 'sobrecarregado';
    moodColor = 'text-red-500 bg-red-500/10 border-red-500/30';
  } else if (hasExhaustion) {
    moodLevel = 2;
    moodLabel = 'Exausta / Esgotamento Físico & Mental';
    sentiment = 'exausto';
    moodColor = 'text-orange-500 bg-orange-500/10 border-orange-500/30';
  } else if (hasAnxiety) {
    moodLevel = 2;
    moodLabel = 'Ansiosa / Mente Acelerada';
    sentiment = 'ansioso';
    moodColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
  } else if (hasPositive) {
    moodLevel = 5;
    moodLabel = 'Leve, Motivada & Focada';
    sentiment = 'positivo';
    moodColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  } else {
    moodLevel = 3;
    moodLabel = 'Equilibrada / Em Transição';
    sentiment = 'neutro';
    moodColor = 'text-blue-500 bg-blue-500/10 border-blue-500/30';
  }

  // Formulate coherent solution activity
  let solutionActivity: {
    title: string;
    description: string;
    duration: string;
    type: 'respiracao' | 'alongamento' | 'pausa_cafe' | 'agua' | 'caminhada' | 'organizacao' | 'delegar' | 'oracao' | 'desconexao';
    benefit: string;
  } = {
    title: 'Pausa de Respiração Diafragmática 4-7-8',
    description: 'Sente-se confortavelmente, feche os olhos. Inspire pelo nariz por 4 segundos, segure o ar por 7 segundos e expire suavemente pela boca por 8 segundos. Repita 4 vezes.',
    duration: '3 a 5 min',
    type: 'respiracao',
    benefit: 'Acalma o sistema nervoso central, reduzindo o cortisol e restaurando o controle imediato.'
  };

  if (sentiment === 'sobrecarregado') {
    solutionActivity = {
      title: 'Descarrego dos 3 Essenciais & Pausa Sem Telas',
      description: 'Defina apenas 1 tarefa inegociável para hoje. Delegue ou adie o restante. Afaste-se de telas por 5 minutos e beba um copo grande de água (400ml).',
      duration: '5 a 10 min',
      type: 'organizacao',
      benefit: 'Elimina a paralisia por sobrecarga e traz alívio mental instantâneo.'
    };
  } else if (sentiment === 'exausto') {
    solutionActivity = {
      title: 'Pausa Restaurativa & Hidratação Consciente',
      description: 'Beba um copo grande de água, faça 3 respirações profundas soltando os ombros e, se possível, feche os olhos por 10 minutos em silêncio antes de prosseguir.',
      duration: '10 min',
      type: 'agua',
      benefit: 'Restaura a oxigenação celular e diminui o cansaço ocular e muscular.'
    };
  } else if (sentiment === 'ansioso') {
    solutionActivity = {
      title: 'Alongamento Suave de Ombros & Caminhada Curta',
      description: 'Gire os ombros para trás 10 vezes, incline a cabeça lateralmente e caminhe por alguns minutos ao redor do ambiente, focando nos seus passos.',
      duration: '5 min',
      type: 'caminhada',
      benefit: 'Dissipa o excesso de adrenalina e ancora a mente no presente.'
    };
  } else if (sentiment === 'positivo') {
    solutionActivity = {
      title: 'Bloco de Foco Imersivo (Técnica Pomodoro)',
      description: 'Aproveite seu bom momento de energy para trabalhar 25 minutos seguidos na sua prioridade nº 1 sem interrupções.',
      duration: '25 min',
      type: 'organizacao',
      benefit: 'Maximiza sua realização mantendo a clareza e ritmo produtivo.'
    };
  }

  // Canonical biblical verses with bibliaonline.com.br reference
  let biblicalVerse = {
    reference: 'Filipenses 4:6-7',
    text: 'Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus. E a paz de Deus, que excede todo o entendimento, guardará os seus corações e as suas mentes em Cristo Jesus.',
    version: 'NVI (Bíblia Online)',
    sourceUrl: 'https://www.bibliaonline.com.br/nvi/fp/4/6-7',
    theme: 'Oração, Entrega e Paz que Excede o Entendimento',
    meditation: 'Entregue o que você não pode controlar nas mãos de Deus em oração. A paz Dele guardará sua mente contra o turbilhão de pensamentos.',
    isAnxietyVerse: true
  };

  if (sentiment === 'ansioso') {
    biblicalVerse = {
      reference: 'Filipenses 4:6-7',
      text: 'Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus. E a paz de Deus, que excede todo o entendimento, guardará os seus corações e as suas mentes em Cristo Jesus.',
      version: 'NVI (Bíblia Online)',
      sourceUrl: 'https://www.bibliaonline.com.br/nvi/fp/4/6-7',
      theme: 'Oração, Entrega e Paz de Deus',
      meditation: 'Respire fundo, descarregue cada inquietação em oração sincera e permita que a paz inabalável de Deus proteja seus pensamentos.',
      isAnxietyVerse: true
    };
  } else if (sentiment === 'exausto') {
    biblicalVerse = {
      reference: 'Mateus 11:28-29',
      text: 'Venham a mim, todos os que estão cansados e sobrecarregados, e eu lhes darei descanso. Tomem sobre vocês o meu jugo e aprendam de mim, pois sou manso e humilde de coração; e vocês encontrarão descanso para as suas almas.',
      version: 'NVI (Bíblia Online)',
      sourceUrl: 'https://www.bibliaonline.com.br/nvi/mt/11/28-29',
      theme: 'Descanso Sagrado para a Alma Cansada',
      meditation: 'Jesus convida você a desacelerar e repousar Nele. A sua força se renova no descanso e na confiança.',
      isAnxietyVerse: false
    };
  } else if (sentiment === 'sobrecarregado') {
    biblicalVerse = {
      reference: '1 Pedro 5:7',
      text: 'Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês.',
      version: 'NVI (Bíblia Online)',
      sourceUrl: 'https://www.bibliaonline.com.br/nvi/1pe/5/7',
      theme: 'Descarregar o Fardo no Cuidado Divino',
      meditation: 'Você não precisa carregar o peso do mundo sozinha hoje. Descarregue cada preocupação no Senhor, pois Ele cuida de você.',
      isAnxietyVerse: true
    };
  } else if (sentiment === 'positivo') {
    biblicalVerse = {
      reference: 'Filipenses 4:13',
      text: 'Tudo posso naquele que me fortalece.',
      version: 'NVI (Bíblia Online)',
      sourceUrl: 'https://www.bibliaonline.com.br/nvi/fp/4/13',
      theme: 'Fortalecimento e Foco em Deus',
      meditation: 'Aproveite seu bom ânimo com gratidão, mantendo o foco no que realmente edifica a sua vida e a sua família.',
      isAnxietyVerse: false
    };
  }

  return {
    summary: `Organizamos suas anotações em ${tasks.length} ${tasks.length === 1 ? 'item acionável' : 'itens acionáveis'}, identificamos os pontos de sobrecarga e associamos um versículo de meditação da Bíblia Online para o seu alívio.`,
    tasks: tasks.slice(0, 8),
    insights: 'Lembre-se: produtividade consciente consiste em focar no essencial primeiro. Respire fundo, execute por prioridade e proteja seus momentos de equilíbrio pessoal e meditação.',
    detectedKeywords,
    mood: {
      level: moodLevel,
      label: moodLabel,
      sentiment,
      color: moodColor
    },
    solutionActivity,
    biblicalVerse
  };
}

// Lazy Gemini API Client with dynamic reconnection & key rotation
let genAIClient: GoogleGenAI | null = null;
let lastUsedApiKey: string | null = null;

function getGenAI(): GoogleGenAI | null {
  const currentApiKey = process.env.GEMINI_API_KEY;
  if (!currentApiKey) {
    return null;
  }
  // Re-instantiate if client doesn't exist or API key changed at runtime
  if (!genAIClient || lastUsedApiKey !== currentApiKey) {
    genAIClient = new GoogleGenAI({
      apiKey: currentApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    lastUsedApiKey = currentApiKey;
  }
  return genAIClient;
}

function resetGenAI(): void {
  genAIClient = null;
  lastUsedApiKey = null;
}

// Rate Limiter for OHEL AI Agent to protect quota
const agentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Max 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições enviadas ao Agente de IA. Por favor, aguarde um minuto e tente novamente.'
  }
});

// Initialize Stream Client
const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;
const streamClient = streamApiKey && streamApiSecret 
  ? new StreamClient(streamApiKey, streamApiSecret) 
  : null;

// Helper to safely parse Firebase Service Account from various formats
function parseServiceAccount(raw: string | undefined): admin.ServiceAccount | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fallback parsers
  }

  // 2. Base64 encoded JSON
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (decoded.includes('{') && decoded.includes('}')) {
      return JSON.parse(decoded);
    }
  } catch {
    // Continue
  }

  // 3. Extracted JSON object from JS code (e.g. var serviceAccount = { ... })
  try {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = trimmed.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonCandidate);
    }
  } catch {
    // Continue
  }

  return null;
}

// Initialize Firebase Admin with smarter credential detection
let firebaseAdminAvailable = false;
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseAdminAvailable = true;
        console.log('Firebase Admin initialized with service account from ENV.');
      } else {
        console.warn('FIREBASE_SERVICE_ACCOUNT is set but does not contain valid JSON (e.g. {"type": "service_account", ...}). Running in fallback mode.');
      }
    } else if (
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_PROJECT_ID
    ) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      firebaseAdminAvailable = true;
      console.log('Firebase Admin initialized with separate env vars (email/key/project).');
    } else {
      console.log('Firebase Admin: Running without service account credentials in dev container.');
    }
    } catch (error) {
    console.warn('Firebase Admin initialization skipped or failed:', error);
  }
} else {
  firebaseAdminAvailable = true;
}

const db = firebaseAdminAvailable ? admin.firestore() : null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- AUTH MIDDLEWARE ---
// Augment Express Request with the decoded Firebase ID token once verified.
type AuthedRequest = express.Request & { auth?: admin.auth.DecodedIdToken };

/**
 * Requires a valid Firebase ID token in the Authorization: Bearer header.
 * On success, attaches the decoded token to req.auth. Never trusts uid/email
 * supplied in the request body/query — those are only usable as-is once this
 * middleware has run, and any identity checks must compare against req.auth.
 */
async function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  if (!firebaseAdminAvailable) {
    return res.status(503).json({ error: 'Serviço de autenticação indisponível no momento.' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
  // Email verification is a security gate for privileged operations; deny
  // unverified identities before they can reach protected routes.
  if (decoded.email_verified === false) {
    return res.status(403).json({ error: 'Email ainda não verificado.' });
  }
  req.auth = decoded;
  next();
} catch (err: any) {
  console.warn('Auth token verification failed:', err?.message);
  return res.status(401).json({ error: 'Token inválido ou expirado.' });
}
}

/**
 * Must run after requireAuth. Allows the request through only if the
 * verified token carries admin privileges (custom claim), falling back to
 * the Firestore user document only as a secondary signal (e.g. claim not
 * yet propagated to the client's token). Never reads admin status from the
 * request body.
 */
async function requireAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const decoded = req.auth;
  if (!decoded) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  const configuredAdmin = process.env.ADMIN_EMAIL;
  const hasAdminClaim = decoded.admin === true || decoded.role === 'ADMIN';
  const isConfiguredAdminEmail = !!configuredAdmin && decoded.email === configuredAdmin;

  if (hasAdminClaim || isConfiguredAdminEmail) {
    return next();
  }

  if (db) {
    try {
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.isPlatformAdmin === true) {
        return next();
      }
    } catch (e) {
      // Fall through to deny below
    }
  }

  return res.status(403).json({ error: 'Acesso restrito a administradores da plataforma.' });
}

async function startServer() {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL is required in production mode.');
  }

  const app = express();
  const PORT = 3000; // Mandatory port for AIS environment and proxy consistency

  // Basic Security & Logging
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false, // Managed via vercel.json on Vercel frontend; avoided here to allow local dev Vite middleware
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(morgan('dev'));
  
  // Trust proxy for correct IP behind Render/Cloud Run
  app.set('trust proxy', 1);

  // Strict CORS configuration
  const configuredFrontendUrl = process.env.FRONTEND_URL || 'https://app.ohel.app';
  const allowedOrigins = Array.from(new Set([
    configuredFrontendUrl,
    ...((process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)),
    'https://app.ohel.app',
    'https://ohel-api.onrender.com', // Self
    'https://api.ohel.app',
    'https://ipo-azure.vercel.app' // Vercel production
  ]));

  const resolveFrontendUrl = (origin?: string) => {
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }

    return configuredFrontendUrl;
  };

  const allowedOriginPatterns = [
    /^https:\/\/ais-(?:dev|pre)-[a-zA-Z0-9]+-644833630029\.[a-z0-9-]+\.run\.app$/,
    /^https:\/\/[a-zA-Z0-9-]+\.ohel\.app$/
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. server-to-server or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Explicit allowed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Explicit authorized domain patterns
      if (allowedOriginPatterns.some(pattern => pattern.test(origin))) {
        return callback(null, true);
      }

      // Development fallback (strict to local/preview environments only)
      if (process.env.NODE_ENV !== 'production') {
        if (
          origin === 'http://localhost:3000' ||
          origin === 'http://localhost:5173' ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.endsWith('.run.app')
        ) {
          return callback(null, true);
        }
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
  }));

  // Strict Cache-Control for all sensitive API endpoints (prevents caching of user data, tasks, tokens)
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // General rate limit as defense-in-depth on top of per-route limiters
  // (e.g. protects /api/invite/validate against invite-code brute forcing).
  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Por favor, tente novamente mais tarde.' }
  });
  app.use('/api', generalApiLimiter);

  // Initialize Stripe
  const stripe = process.env.STRIPE_SECRET_KEY 
    ? new Stripe(process.env.STRIPE_SECRET_KEY) 
    : null;

  // Webhook endpoint (Raw body needed)
  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // Stripe webhooks must fail as a server-side dependency issue, not as a
    // malformed payload, when Firestore or the Stripe client is unavailable.
    if (!stripe || !db) {
      return res.status(503).json({ error: 'Stripe or Firestore unavailable' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const userId = session.client_reference_id;
        const stripeCustomerId = session.customer as string | undefined;
        const eventId = event.id;

        if (userId) {
          const eventRef = db.collection('processed_events').doc(eventId);
          const eventDoc = await eventRef.get();

          if (!eventDoc.exists) {
            const batch = db.batch();
            batch.update(db.collection('users').doc(userId), {
              planType: 'PRO',
              status: 'ACTIVE',
              stripeCustomerId: stripeCustomerId || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            batch.set(db.collection('subscriptions').doc(userId), {
              userId,
              planType: 'PRO',
              status: 'ACTIVE',
              stripeCustomerId: stripeCustomerId || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            batch.set(eventRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: event.type
            });

            await batch.commit();
            console.log(`User ${userId} upgraded to PRO.`);
          }
        }
      }
      return res.json({ received: true });
    } catch (err: any) {
      const message = err?.message || 'Unknown webhook error';
      const isValidationFailure = err?.type === 'StripeSignatureVerificationError' || err instanceof SyntaxError;

      console.error(`Webhook Error: ${message}`);

      if (isValidationFailure) {
        return res.status(400).send(`Webhook Error: ${message}`);
      }

      // Any Firestore or Stripe infrastructure issue is transient and must not
      // be reported back to Stripe as a bad payload.
      return res.status(503).json({ error: 'Webhook processing unavailable' });
    }
  });

  // Regular JSON parsing for other routes
  app.use(express.json());

  // --- API ENDPOINTS ---

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      stripe: !!stripe,
      firebase: !!admin.apps.length,
      stream: !!streamClient
    });
  });

  // Stream Token Generation
  // Video calls are a Plus-only feature (2026-09-17 plan decision), and the
  // plan lives on the Household/Institution doc, not on the individual
  // user — so the caller must say which context they're calling from.
  const PLUS_PLANS = ['PERSONAL_PLUS', 'INSTITUTION_PLUS'];
  async function contextHasVideoCallFeature(contextType?: string, contextId?: string): Promise<boolean> {
    if (!contextType || contextType === 'PERSONAL') return false; // no bare-personal video calls; must be inside a Plus household/institution
    if (!contextId || !db) return false;
    const collectionName = contextType === 'HOUSEHOLD' ? 'households' : 'institutions';
    const doc = await db.collection(collectionName).doc(contextId).get();
    if (!doc.exists) return false;
    return PLUS_PLANS.includes(doc.data()?.planType);
  }

  app.post('/api/stream-token', requireAuth, async (req: AuthedRequest, res) => {
    if (!streamClient) {
      return res.status(500).json({ error: 'Stream not configured' });
    }
    if (!db) {
      return res.status(503).json({ error: 'Firestore indisponível' });
    }

    const { userId, contextType, contextId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // A caller may only mint a video token for themselves (unless platform admin).
    const isSelf = req.auth?.uid === userId;
    const isAdminCaller = req.auth?.admin === true || req.auth?.role === 'ADMIN';
    if (!isSelf && !isAdminCaller) {
      return res.status(403).json({ error: 'Você só pode gerar um token de vídeo para sua própria conta.' });
    }

    if (!isAdminCaller) {
      const eligible = await contextHasVideoCallFeature(contextType, contextId);
      if (!eligible) {
        return res.status(402).json({ error: 'Videochamada é um recurso do plano Plus.' });
      }
      // Caller must actually belong to the context they're claiming Plus through.
      const memberDoc = await db.collection(contextType === 'HOUSEHOLD' ? 'households' : 'institutions')
        .doc(contextId).collection('members').doc(userId).get();
      if (!memberDoc.exists) {
        return res.status(403).json({ error: 'Você não pertence a esse contexto.' });
      }
    }

    try {
      // Validate that the user exists in Firebase to prevent token harvesting
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Expire in 1 hour
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;
      const issuedAt = Math.floor(Date.now() / 1000) - 60;
      
      const token = streamClient.generateUserToken({ 
        user_id: userId,
        validity_in_seconds: 3600
      });

      res.json({ token, apiKey: streamApiKey });
    } catch (error: any) {
      console.error('Error generating Stream token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate Invitation Code (New)
  // A member token can now belong to either an Institution (CNPJ) or a
  // Household (CPF) — the login screen has one input field and this route
  // tells the client which one it is, per the onboarding flow decided on
  // 2026-09-17: "insiro o token de membro (e ele valida se sou membro de
  // CNPJ ou CPF)". Institutions are checked first only because that was the
  // original behavior; a code is expected to be unique across both
  // collections in practice (enforced client-side at creation time).
  app.post('/api/invite/validate', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    try {
      if (db) {
        const normalizedCode = code.toUpperCase();

        const instSnapshot = await db.collection('institutions')
          .where('inviteCode', '==', normalizedCode).limit(1).get();
        if (!instSnapshot.empty) {
          const instDoc = instSnapshot.docs[0];
          return res.json({
            type: 'INSTITUTION',
            id: instDoc.id,
            name: instDoc.data().name,
            logo: instDoc.data().logo,
            planType: instDoc.data().planType,
          });
        }

        const householdSnapshot = await db.collection('households')
          .where('inviteCode', '==', normalizedCode).limit(1).get();
        if (!householdSnapshot.empty) {
          const householdDoc = householdSnapshot.docs[0];
          return res.json({
            type: 'HOUSEHOLD',
            id: householdDoc.id,
            name: householdDoc.data().name,
            planType: householdDoc.data().planType,
          });
        }

        return res.status(404).json({ error: 'Código de convite inválido ou expirado.' });
      }
      // If server Firestore is offline, return basic format so client can perform client-side verification
      res.json({ type: 'INSTITUTION', id: 'INST-' + code.toUpperCase(), name: 'Instituição ' + code.toUpperCase() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // A user who already has an account (CPF or CNPJ) can attach MORE
  // institution tokens later — "Preciso de um local onde insiro tokens de
  // outras possíveis instituições para membrar caso já tenha o sistema."
  // This just creates the pending membership doc; Firestore rules require
  // role == 'MEMBER' for a self-created membership, so this can never be
  // used to self-grant ADMIN/MANAGER on someone else's institution.
  app.post('/api/institution/join', requireAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    if (!db) return res.status(503).json({ error: 'Firestore indisponível' });

    try {
      const normalizedCode = code.toUpperCase();
      const instSnapshot = await db.collection('institutions')
        .where('inviteCode', '==', normalizedCode).limit(1).get();
      if (instSnapshot.empty) {
        return res.status(404).json({ error: 'Código de convite inválido ou expirado.' });
      }
      const instDoc = instSnapshot.docs[0];
      await db.collection('institutions').doc(instDoc.id)
        .collection('members').doc(req.auth!.uid).set({
          institutionId: instDoc.id,
          userId: req.auth!.uid,
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      res.json({ id: instDoc.id, name: instDoc.data().name });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get User Subscription Status
  app.get('/api/user-subscription/:userId', requireAuth, async (req: AuthedRequest, res) => {
    const isSelf = req.auth?.uid === req.params.userId;
    const isAdminCaller = req.auth?.admin === true || req.auth?.role === 'ADMIN';
    if (!isSelf && !isAdminCaller) {
      return res.status(403).json({ error: 'Você só pode consultar sua própria assinatura.' });
    }

    try {
      if (db) {
        const doc = await db.collection('subscriptions').doc(req.params.userId).get();
        if (doc.exists) return res.json(doc.data());
      }
      return res.json({ planType: 'PERSONAL_BASIC', status: 'ACTIVE' });
    } catch (error: any) {
      res.json({ planType: 'PERSONAL_BASIC', status: 'ACTIVE' });
    }
  });

  // Create Stripe Checkout Session
  app.post('/api/create-checkout-session', requireAuth, async (req: AuthedRequest, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    // Always derive identity from the verified token — never trust the body,
    // otherwise a caller could attribute a purchase (or webhook side-effects)
    // to an arbitrary victim userId.
    const userId = req.auth!.uid;
    const email = req.auth!.email;

    try {
      const frontendBaseUrl = resolveFrontendUrl(req.headers.origin as string | undefined);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: email,
        client_reference_id: userId,
        line_items: [{
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${frontendBaseUrl}/?success=true`,
        cancel_url: `${frontendBaseUrl}/?canceled=true`,
        allow_promotion_codes: true,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Customer Portal
  app.post('/api/create-portal-session', requireAuth, async (req: AuthedRequest, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    if (!db) return res.status(500).json({ error: 'Firestore not configured' });

    try {
      // Never trust a client-supplied customerId — an attacker could pass any
      // Stripe customer ID and get billing-portal access to someone else's
      // account. Resolve it server-side from the caller's own subscription doc.
      const subDoc = await db.collection('subscriptions').doc(req.auth!.uid).get();
      const customerId = subDoc.exists ? subDoc.data()?.stripeCustomerId : null;

      if (!customerId) {
        return res.status(404).json({ error: 'Nenhuma assinatura Stripe encontrada para este usuário.' });
      }

      const frontendBaseUrl = resolveFrontendUrl(req.headers.origin as string | undefined);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: frontendBaseUrl,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // OHEL Central Intelligence Engine Agent with Rate Limiter and Auto-Reconnection
  // Rankings are written server-side only (Firestore rules restrict client
  // writes to isPlatformAdmin) so nobody can just write themselves to the
  // top of the board. Called from handleTaskComplete right after a task is
  // marked done; looks the task up itself rather than trusting whatever
  // context/points the client claims.
  app.post('/api/rankings/award', requireAuth, async (req: AuthedRequest, res) => {
    if (!db) return res.status(503).json({ error: 'Firestore indisponível' });
    const { taskId, points = 10 } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });

    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      return res.status(400).json({ error: 'points must be an integer between 1 and 1000.' });
    }

    try {
      const taskSnap = await db.collection('tasks').doc(taskId).get();
      if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' });
      const task = taskSnap.data()!;

      const contextType = task.contextType || 'PERSONAL';
      const contextId = task.contextId || null;
      if (contextType === 'PERSONAL' || !contextId) {
        // No ranking outside a Household/Institution — nothing to award into.
        return res.status(403).json({ error: 'Task não pertence a um contexto com ranking.' });
      }

      if (task.status !== 'COMPLETED' && task.completed !== true) {
        return res.status(403).json({ error: 'Só é possível pontuar tarefas concluídas.' });
      }

      const contextCollection = contextType === 'HOUSEHOLD' ? 'households' : 'institutions';
      const contextDoc = await db.collection(contextCollection).doc(contextId).get();
      if (!contextDoc.exists || !contextDoc.data()?.rankingEnabled) {
        return res.status(403).json({ error: 'Ranking não habilitado para este contexto.' });
      }

      const awardedUserId = (task.assignedTo && task.assignedTo.length > 0) ? task.assignedTo[0] : task.userId;
      const callerUserId = req.auth!.uid;
      const allowedAwardUsers = new Set([task.userId, ...(task.assignedTo || [])]);
      if (!allowedAwardUsers.has(callerUserId)) {
        return res.status(403).json({ error: 'Você não pode pontuar essa tarefa.' });
      }

      const memberRef = db.collection(contextCollection).doc(contextId).collection('members').doc(callerUserId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        return res.status(403).json({ error: 'Você não pertence a esse contexto.' });
      }

      const now = new Date();
      const weekId = `${now.getFullYear()}-W${String(Math.ceil(((Number(now) - Number(new Date(now.getFullYear(), 0, 1))) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`;
      const rankingId = `${contextType}_${contextId}_${awardedUserId}_${weekId}`;
      const awardMarkerId = `${awardedUserId}_${taskId}`;
      const awardRef = db.collection('ranking_awards').doc(awardMarkerId);

      const result = await db.runTransaction(async (transaction) => {
        const awardSnap = await transaction.get(awardRef);
        if (awardSnap.exists) {
          throw Object.assign(new Error('already awarded'), { statusCode: 409 });
        }

        const rankingRef = db.collection('rankings').doc(rankingId);
        const userDocRef = db.collection('users').doc(awardedUserId);
        const userDocSnap = await transaction.get(userDocRef);
        const userName = userDocSnap.exists ? (userDocSnap.data()?.name || 'Usuário') : 'Usuário';

        transaction.set(awardRef, {
          taskId,
          userId: awardedUserId,
          contextType,
          contextId,
          weekId,
          points,
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.set(rankingRef, {
          userId: awardedUserId,
          userName,
          contextType,
          contextId,
          weekId,
          points: admin.firestore.FieldValue.increment(points)
        }, { merge: true });

        return { awarded: true, weekId };
      });

      res.json(result);
    } catch (error: any) {
      if (error?.statusCode === 409) {
        return res.status(409).json({ error: 'already awarded' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/agent/process', requireAuth, agentRateLimiter, async (req: AuthedRequest, res) => {
    const { input } = req.body;
    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({ error: 'O texto de entrada é obrigatório.' });
    }

    try {
      const ai = getGenAI();

      // If Gemini is configured, invoke Gemini 3.7 Flash
      if (ai) {
        try {
          const systemInstruction = `Atue como o motor de inteligência central do aplicativo OHEL, um sistema de gestão de vida, rotina e sincronização familiar. Sua função é receber entradas de texto bruto em linguagem natural (como anotações rápidas, transcrições de áudio, desabafos de sobrecarga mental ou listas mentais enviadas pela usuária) e processá-las para gerar uma estrutura organizada, acionável e acolhedora.

Você deve:
1. Extrair tarefas práticas com categoria ('Trabalho', 'Casa', 'Família', 'Autocuidado') e prioridade (1 = urgente/alta, 2 = média, 3 = baixa).
2. Identificar palavras ou expressões de descarrego mental (ex: 'sobrecarga', 'exaustão', 'ansiedade', 'urgência', 'insônia', 'pressão', 'desabafo', 'foco', 'paz', 'medo de esquecer').
3. Classificar o humor/estado emocional da usuária em uma escala de 1 a 5, com rótulo descritivo e sentimento ('sobrecarregado', 'exausto', 'ansioso', 'neutro', 'focado', 'positivo').
4. Sugerir uma atividade prática, coerente e imediata de solução/descompressão (ex: Pausa 4-7-8, Hidratação, Caminhada sem telas, Descarrego dos 3 Essenciais, Bloco Pomodoro).
5. Associar um Versículo Bíblico do Dia para meditação referenciando a Bíblia Online (bibliaonline.com.br, versão NVI ou ACF/ARA). Ao descarregar ansiedade, angústia ou medo, utilize estritamente versículos canônicos de combate à ansiedade e fortalecimento (ex: Filipenses 4:6-7, 1 Pedro 5:7, Mateus 6:34, Salmos 94:19, Isaías 41:10, Salmos 55:22, Josué 1:9, Mateus 11:28-29, João 14:27), acompanhado do link direto no bibliaonline.com.br, o texto e uma reflexão edificante.
6. IDENTIFICAR ANIVERSÁRIOS E EVENTOS DE CALENDÁRIO: Quando a usuária mencionar aniversários ou comemorações (usando termos como 'niver', 'aniversário', 'aniversario', 'bday', 'aniversariante', 'comemoração', 'festa de aniversário', 'parabéns') ou compromissos com data:
   - Marque a tarefa com "isBirthday": true e "isCalendarEvent": true.
   - Categorize prioritariamente como 'Família' ou 'Pessoal'.
   - Extraia a data no formato ISO YYYY-MM-DD em "dateString" e o timestamp correspondente em milissegundos em "dueDate" (utilize o ano de 2026).
   - No "title", adicione o emoji 🎂 e o nome/descrição clara (ex: "🎂 Aniversário da Júlia (15/09)").

Sua resposta deve ser estritamente em formato JSON, seguindo exatamente este schema:

{
  "summary": "Um resumo executivo acolhedor e claro do que foi processado.",
  "tasks": [
    {
      "title": "Título claro e direto da tarefa ou compromisso",
      "category": "Trabalho | Casa | Família | Autocuidado",
      "priority": 1,
      "isBirthday": false,
      "isCalendarEvent": false,
      "dueDate": 1789462800000,
      "dateString": "2026-09-15"
    }
  ],
  "insights": "Uma breve reflexão, direcionamento ou palavra de encorajamento alinhada ao momento da usuária.",
  "detectedKeywords": ["Sobrecarga mental", "Urgência de prazos"],
  "mood": {
    "level": 2,
    "label": "Ansiosa / Mente Acelerada",
    "sentiment": "ansioso",
    "color": "text-amber-500 bg-amber-500/10 border-amber-500/30"
  },
  "solutionActivity": {
    "title": "Pausa de Respiração Diafragmática 4-7-8",
    "description": "Inspire por 4s, segure por 7s e expire por 8s. Repita 4 ciclos para acalmar o sistema nervoso.",
    "duration": "3 a 5 min",
    "type": "respiracao",
    "benefit": "Reduz o cortisol e acalma a mente acelerada em minutos."
  },
  "biblicalVerse": {
    "reference": "Filipenses 4:6-7",
    "text": "Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus. E a paz de Deus, que excede todo o entendimento, guardará os seus corações e as suas mentes em Cristo Jesus.",
    "version": "NVI (Bíblia Online)",
    "sourceUrl": "https://www.bibliaonline.com.br/nvi/fp/4/6-7",
    "theme": "Oração, Entrega e Paz de Deus",
    "meditation": "Entregue a Deus cada detalhe que você não pode controlar. A paz Dele guardará sua mente contra o turbilhão de pensamentos.",
    "isAnxietyVerse": true
  }
}`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: input.trim(),
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: {
                    type: Type.STRING,
                    description: 'Um resumo executivo acolhedor e claro do que foi processado.'
                  },
                  tasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: {
                          type: Type.STRING,
                          description: 'Título claro e direto da tarefa ou compromisso'
                        },
                        category: {
                          type: Type.STRING,
                          description: "Escolher estritamente entre: 'Trabalho', 'Casa', 'Família', 'Autocuidado'"
                        },
                        priority: {
                          type: Type.INTEGER,
                          description: 'Número inteiro de 1 a 3 (onde 1 é a maior urgência/prioridade)'
                        },
                        isBirthday: {
                          type: Type.BOOLEAN,
                          description: 'Verdadeiro se for aniversário, niver ou comemoração de aniversário'
                        },
                        isCalendarEvent: {
                          type: Type.BOOLEAN,
                          description: 'Verdadeiro se for um evento agendado ou com data específica'
                        },
                        dueDate: {
                          type: Type.NUMBER,
                          description: 'Timestamp em milissegundos da data do evento para o calendário'
                        },
                        dateString: {
                          type: Type.STRING,
                          description: 'Data no formato YYYY-MM-DD'
                        }
                      },
                      required: ['title', 'category', 'priority']
                    }
                  },
                  insights: {
                    type: Type.STRING,
                    description: 'Uma breve reflexão, direcionamento ou palavra de encorajamento alinhada ao momento da usuária.'
                  },
                  detectedKeywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Palavras ou temas de descarrego mental identificados.'
                  },
                  mood: {
                    type: Type.OBJECT,
                    properties: {
                      level: { type: Type.INTEGER, description: 'Escala de 1 a 5' },
                      label: { type: Type.STRING, description: 'Rótulo do humor classificado' },
                      sentiment: { type: Type.STRING, description: 'sobrecarregado, exausto, ansioso, neutro, focado, ou positivo' },
                      color: { type: Type.STRING, description: 'Classe Tailwind de cor' }
                    },
                    required: ['level', 'label', 'sentiment']
                  },
                  solutionActivity: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: 'Título da atividade de solução recomendada' },
                      description: { type: Type.STRING, description: 'Passo a passo prático da atividade' },
                      duration: { type: Type.STRING, description: 'Duração estimada (ex: 5 min)' },
                      type: { type: Type.STRING, description: 'Tipo da atividade (ex: respiracao, caminhada, agua, organizacao)' },
                      benefit: { type: Type.STRING, description: 'Benefício imediato para o bem-estar' }
                    },
                    required: ['title', 'description', 'duration', 'type', 'benefit']
                  },
                  biblicalVerse: {
                    type: Type.OBJECT,
                    properties: {
                      reference: { type: Type.STRING, description: 'Referência bíblica (ex: Filipenses 4:6-7)' },
                      text: { type: Type.STRING, description: 'Texto sagrado do versículo' },
                      version: { type: Type.STRING, description: 'Versão bíblica (ex: NVI (Bíblia Online))' },
                      sourceUrl: { type: Type.STRING, description: 'URL canônica do versículo em bibliaonline.com.br' },
                      theme: { type: Type.STRING, description: 'Tema do versículo' },
                      meditation: { type: Type.STRING, description: 'Reflexão prática para meditar e acalmar a mente' },
                      isAnxietyVerse: { type: Type.BOOLEAN, description: 'Verdadeiro se for versículo focado em ansiedade' }
                    },
                    required: ['reference', 'text', 'sourceUrl']
                  }
                },
                required: ['summary', 'tasks', 'insights', 'detectedKeywords', 'mood', 'solutionActivity']
              }
            }
          });

          let rawText = response.text || '';
          
          // Strip any markdown fences if present
          if (rawText.includes('```')) {
            rawText = rawText.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
          }

          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed && parsed.tasks && Array.isArray(parsed.tasks)) {
              // Post-enrich tasks with date/birthday checks if needed
              parsed.tasks = parsed.tasks.map((t: any) => {
                const dateInfo = extractEventAndDate(`${t.title} ${input}`);
                const isBirthday = t.isBirthday || dateInfo.isBirthday;
                const isCalendarEvent = t.isCalendarEvent || dateInfo.isCalendarEvent || isBirthday;
                const dueDate = t.dueDate || dateInfo.dueDate;
                const dateString = t.dateString || dateInfo.dateString;
                let title = t.title;
                if (isBirthday && !title.includes('🎂')) {
                  title = `🎂 ${title}`;
                }
                return {
                  ...t,
                  title,
                  isBirthday,
                  isCalendarEvent,
                  dueDate,
                  dateString
                };
              });
              return res.json(parsed);
            }
          }
        } catch (geminiError: any) {
          console.warn('Gemini API call warning, executing resilient fallback:', geminiError.message);
          if (
            geminiError?.status === 401 || 
            geminiError?.status === 403 || 
            geminiError?.message?.includes('API_KEY') || 
            geminiError?.message?.includes('auth') || 
            geminiError?.message?.includes('UNAUTHENTICATED')
          ) {
            resetGenAI();
          }
        }
      }

      // Fallback NLP processing ensures 100% service continuity
      const fallbackResult = parseInputHeuristically(input);
      return res.json(fallbackResult);
    } catch (error: any) {
      console.error('Error processing agent request:', error);
      const emergencyResult = parseInputHeuristically(input);
      return res.json(emergencyResult);
    }
  });

  // --- ADMIN CUSTOM CLAIMS & PLATFORM GOVERNANCE ENDPOINTS ---

  // Sync Admin Claims for the calling user (self-service bootstrap only).
  // This route can ONLY grant admin to the caller's own account, and only
  // based on identity proven by a verified Firebase ID token — it never
  // trusts an email/uid supplied in the request body. Granting admin to a
  // DIFFERENT user must go through /api/admin/set-claim, which requires the
  // caller to already be an admin.
  app.post('/api/admin/sync-admin-claims', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const email = req.auth!.email;
      const uid = req.auth!.uid;

      const configuredAdmin = process.env.ADMIN_EMAIL;
      if (!configuredAdmin) {
        throw new Error('ADMIN_EMAIL is required in production.');
      }
      const isTargetAdmin = email === configuredAdmin || email === 'admin@ohel.app';

      // Check Firestore users document if server DB available
      let targetUid = uid;
      let docIsAdmin = false;
      const failures: string[] = [];

      if (db && firebaseAdminAvailable) {
        if (!targetUid && email) {
          try {
            const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
            if (!userQuery.empty) {
              targetUid = userQuery.docs[0].id;
            }
          } catch (e) {
            failures.push(`user lookup failed: ${(e as Error).message}`);
          }
        }

        if (targetUid) {
          try {
            const userDocRef = db.collection('users').doc(targetUid);
            const userDocSnap = await userDocRef.get();
            docIsAdmin = userDocSnap.exists && userDocSnap.data()?.isPlatformAdmin === true;
          } catch (e) {
            failures.push(`admin status lookup failed: ${(e as Error).message}`);
          }
        }
      }

      if (isTargetAdmin || docIsAdmin) {
        if (!targetUid || !firebaseAdminAvailable) {
          return res.status(500).json({ error: 'Administrador indisponível para sincronização.', failures });
        }

        try {
          await admin.auth().setCustomUserClaims(targetUid, {
            admin: true,
            role: 'ADMIN'
          });
        } catch (claimsErr: any) {
          failures.push(`setCustomUserClaims failed: ${claimsErr.message}`);
        }

        if (db) {
          try {
            await db.collection('users').doc(targetUid).set({
              isPlatformAdmin: true,
              role: 'ADMIN',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (dbErr: any) {
            failures.push(`users write failed: ${dbErr.message}`);
          }

          try {
            await db.collection('admins').doc(targetUid).set({
              uid: targetUid,
              email: email || configuredAdmin,
              role: 'ADMIN',
              isPlatformAdmin: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (dbErr: any) {
            failures.push(`admins write failed: ${dbErr.message}`);
          }
        }

        if (failures.length > 0) {
          return res.status(500).json({
            success: false,
            admin: false,
            failures,
            message: 'Falha na sincronização de administrador.'
          });
        }

        return res.json({
          success: true,
          admin: true,
          message: 'Status de Administrador da Plataforma sincronizado com sucesso.',
          uid: targetUid,
          email: email
        });
      }

      res.status(403).json({ error: 'Usuário não autorizado para privilégios de plataforma.' });
    } catch (error: any) {
      console.error('Error in sync-admin-claims:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set custom claims for any user (Admin only)
  app.post('/api/admin/set-claim', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const { email, uid, claims } = req.body;
      if (!email && !uid) {
        return res.status(400).json({ error: 'Target user email or uid is required.' });
      }

      let targetUid = uid as string | undefined;
      const newClaims = claims || { admin: true, role: 'ADMIN' };

      if (!targetUid && email && firebaseAdminAvailable) {
        try {
          const user = await admin.auth().getUserByEmail(email);
          targetUid = user.uid;
        } catch (lookupErr: any) {
          return res.status(404).json({ error: `User not found for email: ${email}` });
        }
      }

      if (!targetUid) {
        return res.status(400).json({ error: 'Target user email or uid is required.' });
      }

      if (!firebaseAdminAvailable) {
        return res.status(503).json({ error: 'Firebase Admin indisponível.' });
      }

      const failures: string[] = [];
      try {
        await admin.auth().setCustomUserClaims(targetUid, newClaims);
      } catch (claimsErr: any) {
        failures.push(`setCustomUserClaims failed: ${claimsErr.message}`);
      }

      if (newClaims.admin === true && db) {
        try {
          await db.collection('users').doc(targetUid).set({
            isPlatformAdmin: true,
            role: newClaims.role || 'ADMIN',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (e: any) {
          failures.push(`users write failed: ${e.message}`);
        }

        try {
          await db.collection('admins').doc(targetUid).set({
            uid: targetUid,
            email: email || '',
            role: newClaims.role || 'ADMIN',
            isPlatformAdmin: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (e: any) {
          failures.push(`admins write failed: ${e.message}`);
        }
      }

      if (failures.length > 0) {
        return res.status(500).json({
          success: false,
          uid: targetUid,
          email: email,
          customClaims: newClaims,
          failures
        });
      }

      res.json({
        success: true,
        uid: targetUid,
        email: email,
        customClaims: newClaims
      });
    } catch (error: any) {
      console.error('Error in set-claim:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Global Platform Aggregated Summary API
  app.get('/api/admin/global-summary', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
    try {
      if (!db) {
        return res.json({
          totalUsers: 0,
          personalUsersCount: 0,
          institutionalUsersCount: 0,
          adminUsersCount: 0,
          totalInstitutions: 0,
          totalTasks: 0,
          completedTasksCount: 0,
          pendingTasksCount: 0,
          completionRate: 0,
          quadrantBreakdown: {}
        });
      }

      const [usersSnap, instSnap, tasksSnap] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('institutions').count().get(),
        db.collection('tasks').count().get()
      ]);

      let personalUsersCount = 0;
      let institutionalUsersCount = 0;
      let adminUsersCount = 0;
      let completedTasksCount = 0;
      let pendingTasksCount = 0;
      const quadrantBreakdown: Record<string, number> = {
        'urgent-important': 0,
        'important-not-urgent': 0,
        'urgent-not-important': 0,
        'not-urgent-not-important': 0
      };

      // At summary time we count documents without loading full payloads into memory,
      // which avoids large unbounded reads and keeps this route bounded.
      const usersSummary = await db.collection('users').select('isPlatformAdmin', 'profileType', 'institutionId', 'type').get();
      usersSummary.forEach(doc => {
        const d = doc.data();
        if (d.isPlatformAdmin) adminUsersCount++;
        if (d.profileType === 'INSTITUTIONAL' || d.institutionId || d.type === 'institution_owner' || d.type === 'institution_member') {
          institutionalUsersCount++;
        } else {
          personalUsersCount++;
        }
      });

      const tasksSummary = await db.collection('tasks').select('completed', 'quadrant').get();
      tasksSummary.forEach(doc => {
        const t = doc.data();
        if (t.completed) completedTasksCount++;
        else pendingTasksCount++;

        if (t.quadrant && quadrantBreakdown[t.quadrant] !== undefined) {
          quadrantBreakdown[t.quadrant]++;
        }
      });

      res.json({
        totalUsers: usersSnap.data().count,
        personalUsersCount,
        institutionalUsersCount,
        adminUsersCount,
        totalInstitutions: instSnap.data().count,
        totalTasks: tasksSnap.data().count,
        completedTasksCount,
        pendingTasksCount,
        completionRate: tasksSnap.data().count > 0 ? Math.round((completedTasksCount / tasksSnap.data().count) * 100) : 0,
        quadrantBreakdown,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error in global-summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- STATIC FILES / VITE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Long-lived cache for hashed static assets
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));
    // Default static files (favicon, manifest, etc.)
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
    // SPA Fallback: must-revalidate so HTML entry point is never stale
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OHEL Backend running on http://localhost:${PORT}`);
  });
}

startServer();

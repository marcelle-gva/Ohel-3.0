import React from 'react';
import { TrendingUp, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HeroBannerProps {
  firstName: string;
  verse?: { text: string; reference: string };
  inviteCode?: string;
  journeyDay: number;
  journeyTotalDays: number;
  urgentCount: number;
  onEditJourney?: () => void;
  onInviteClick?: () => void;
}

const DEFAULT_VERSE = { text: '"Porque a sua tenda está com eles, e você habita no meio deles."', reference: 'Êxodo 33:7' };

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Bespoke tent-and-mountains illustration (no stock photo — the Ohel brand
 * itself means "tent", so this is the one place worth being illustrative
 * rather than decorative). Pure SVG, themeable via currentColor/opacity so
 * it never needs an external asset.
 */
const TentIllustration: React.FC = () => (
  <svg viewBox="0 0 400 260" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="duskSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0B1220" />
        <stop offset="45%" stopColor="#1E2A4A" />
        <stop offset="75%" stopColor="#5B3A5C" />
        <stop offset="100%" stopColor="#C97B4A" />
      </linearGradient>
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFF6D8" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#FFF6D8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="400" height="260" fill="url(#duskSky)" />
    {/* stars */}
    {[[30,30],[70,55],[120,25],[200,40],[260,20],[320,50],[350,30],[90,80],[180,70]].map(([x,y], i) => (
      <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.8} fill="#fff" opacity={0.6} />
    ))}
    <circle cx="330" cy="55" r="26" fill="url(#moonGlow)" />
    <circle cx="330" cy="55" r="12" fill="#FFF6D8" opacity="0.85" />
    {/* distant mountains */}
    <path d="M0,180 L60,120 L130,170 L190,110 L260,175 L330,130 L400,175 L400,260 L0,260 Z" fill="#2A3B63" opacity="0.7" />
    <path d="M0,210 L90,150 L170,205 L240,150 L320,200 L400,160 L400,260 L0,260 Z" fill="#1B2748" />
    {/* tent */}
    <g>
      <polygon points="200,95 260,220 140,220" fill="#3A2A22" />
      <polygon points="200,95 225,220 175,220" fill="#4A362C" />
      <line x1="200" y1="95" x2="200" y2="220" stroke="#1B140F" strokeWidth="2" />
      <polygon points="185,190 215,190 210,220 190,220" fill="#0B0906" />
      {/* warm glow from inside the tent */}
      <ellipse cx="200" cy="210" rx="26" ry="14" fill="#F4A343" opacity="0.55" />
    </g>
    {/* ground line */}
    <rect x="0" y="235" width="400" height="25" fill="#141B2E" />
  </svg>
);

export const HeroBanner: React.FC<HeroBannerProps> = ({
  firstName, verse = DEFAULT_VERSE, inviteCode, journeyDay, journeyTotalDays, urgentCount, onEditJourney, onInviteClick,
}) => {
  const progress = Math.min(100, Math.round((journeyDay / Math.max(1, journeyTotalDays)) * 100));

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border/50 bg-card">
      <div className="relative flex flex-col lg:flex-row">
        <div className="relative z-10 flex-1 p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {getGreeting()}, {firstName}!  👋
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-sm">
              Que esta seja mais uma semana de propósito e grandes conquistas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {inviteCode && (
              <button
                onClick={onInviteClick}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-background/60 border border-border/60 hover:border-primary/40 transition-colors text-left"
              >
                <QrCode className="w-4 h-4 text-primary shrink-0" />
                <div className="leading-tight">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Membro</p>
                  <p className="text-sm font-black tracking-widest">{inviteCode}</p>
                </div>
              </button>
            )}

            <button
              onClick={onEditJourney}
              className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-background/60 border border-border/60 hover:border-primary/40 transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div className="leading-tight text-left min-w-[92px]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Jornada atual</p>
                <p className="text-sm font-black">{journeyDay}/{journeyTotalDays} dias</p>
                <div className="h-1 w-16 rounded-full bg-muted mt-1 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </button>

            <div className={cn(
              'flex items-center gap-2.5 px-4 py-2 rounded-2xl border',
              urgentCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-background/60 border-border/60'
            )}>
              <div className={cn('w-2 h-2 rounded-full', urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500')} />
              <div className="leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Foco total</p>
                <p className={cn('text-sm font-black', urgentCount > 0 && 'text-red-500')}>
                  {urgentCount > 0 ? `${urgentCount} urgência(s)` : 'Sem urgências'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative w-full lg:w-[380px] h-40 lg:h-auto">
          <TentIllustration />
          <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8">
            <p className="text-white/90 italic text-sm leading-snug max-w-[220px]">{verse.text}</p>
            <p className="text-white/60 text-xs mt-1.5">{verse.reference}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

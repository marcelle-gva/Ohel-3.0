import type { FC } from 'react';
import { BrainCircuit, RefreshCcw } from 'lucide-react';

import type { AgentHeaderProps } from '@/types/agent';

const gradients = {
  card: 'bg-gradient-to-br from-[#0F1F3A] via-[#0B1830] to-[#0A1628]',
  accent: 'from-blue-500 to-cyan-400',
  border: 'border border-cyan-400/20',
};

export const AgentHeaderCard: FC<AgentHeaderProps> = ({
  title = 'AGENTE DE GESTÃO OHEL',
  subtitle = 'Transforme desabafos, áudios transcritos, anotações rápidas e pensamentos soltos em um plano de vida organizado, acolhedor e com prioridades claras.',
  badgeText = 'Sincronização & Rotina Familiar',
  onBadgeClick,
}) => {
  return (
    <header className={`relative overflow-hidden rounded-[24px] p-6 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] ${gradients.card} ${gradients.border}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_35%)]" />
      <div className="relative flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradients.accent} shadow-[0_0_24px_rgba(59,130,246,0.4)]`}>
            <BrainCircuit className="h-6 w-6 text-slate-50" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" />
              MOTOR DE INTELIGÊNCIA CENTRAL
            </div>

            <h1 className="text-3xl font-black italic tracking-tight text-slate-100 md:text-4xl">
              {title}
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBadgeClick}
          className="hidden items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1628] md:inline-flex"
          aria-label="Sincronização e rotina familiar"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {badgeText}
        </button>
      </div>
    </header>
  );
};

export default AgentHeaderCard;

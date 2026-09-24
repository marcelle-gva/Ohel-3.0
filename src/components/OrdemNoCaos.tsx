import React from 'react';
import { motion } from 'motion/react';
import { Users, Briefcase, Heart, ChevronRight, Activity, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PILAR_CONFIG, PILAR_TAB_CONFIG, PILAR_VIEW_MAP, PILARES } from '@/config/permissions';

interface PillarCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

const PillarCard: React.FC<PillarCardProps> = ({ title, description, icon, color, onClick, disabled }) => (
  <motion.button
    whileHover={!disabled ? { scale: 1.02, y: -4 } : {}}
    whileTap={!disabled ? { scale: 0.98 } : {}}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'relative overflow-hidden group p-6 rounded-2xl border border-border/50 bg-card text-left transition-all glow-blue flex flex-col h-64',
      disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/50'
    )}
  >
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {disabled ? <Lock className="w-6 h-6" /> : icon}
    </div>
    <div className="flex-1">
      <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2 group-hover:text-primary transition-colors leading-none">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>

    {!disabled ? (
      <div className="flex items-center gap-2 text-primary font-bold text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        Acessar Módulo <ChevronRight className="w-4 h-4" />
      </div>
    ) : (
      <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm mt-4">
        Apenas para Instituições <Lock className="w-3 h-3" />
      </div>
    )}

    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
  </motion.button>
);

interface OrdemNoCaosProps {
  onNavigate: (view: string) => void;
  profileType: 'personal' | 'institutional';
}

const pillarIcons: Record<string, React.ReactNode> = {
  FAMILIAR: <Users className="w-8 h-8" />,
  PESSOAL: <Activity className="w-8 h-8" />,
  PROFISSIONAL: <Briefcase className="w-8 h-8" />,
  ESPIRITUAL: <Heart className="w-8 h-8" />,
};

export const OrdemNoCaos: React.FC<OrdemNoCaosProps> = ({ onNavigate, profileType }) => {
  const pillars = PILARES.map((pillar) => ({
    id: PILAR_VIEW_MAP[pillar],
    title: pillar,
    description: PILAR_CONFIG[pillar].subtitulo,
    icon: pillarIcons[pillar],
    color: PILAR_CONFIG[pillar].cor,
    tabs: PILAR_TAB_CONFIG[pillar].tabs,
  }));

  return (
    <div className="space-y-12 py-6">
      <div className="flex flex-col gap-3 text-center max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold tracking-tight uppercase">Ordem no Caos</h2>
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold opacity-70">Estrutura de Gestão</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
        {pillars.map((pillar) => (
          <PillarCard
            key={pillar.id}
            title={pillar.title}
            description={pillar.description}
            icon={pillar.icon}
            color={pillar.color}
            disabled={false}
            onClick={() => onNavigate(pillar.id)}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-2">Abas configuradas por pilar:</p>
        <div className="flex flex-wrap gap-2">
          {pillars.flatMap((pillar) => pillar.tabs.map((tab) => (
            <span key={`${pillar.id}-${tab.key}`} className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: `${pillar.color}55`, color: pillar.color }}>
              {pillar.title}: {tab.label}
            </span>
          )))}
        </div>
      </div>
    </div>
  );
};

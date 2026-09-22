import React from 'react';

/**
 * Ilustração original em SVG — evoca a referência da "tenda sob o céu
 * noturno" (2026-09-20: "gostaria que a inspiração que mandei da tenda
 * fosse real") sem usar uma foto de banco de imagens: é desenhada aqui,
 * então não existe risco de direito autoral em embutir isso num produto
 * distribuído. Usa `currentColor`/CSS vars onde faz sentido pra herdar o
 * tema automaticamente; o brilho quente da lanterna é intencionalmente a
 * ÚNICA cor não-azul da tela — um detalhe de ilustração, não um novo tom
 * de UI (mantendo a identidade azul/grafite pedida em 2026-09-20).
 */
export const TentNightIllustration: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 420 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ohel-moonglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ohel-lanternglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5A623" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ohel-mountain-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="ohel-mountain-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* Moon glow */}
      <circle cx="330" cy="55" r="70" fill="url(#ohel-moonglow)" />
      <circle cx="330" cy="55" r="14" fill="currentColor" opacity="0.5" />

      {/* Stars */}
      {[
        [40, 30], [80, 60], [130, 25], [180, 50], [230, 20], [270, 45],
        [370, 90], [20, 100], [110, 80], [200, 90], [310, 130], [60, 140],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.6 : 1} fill="currentColor" opacity={0.5} />
      ))}

      {/* Far mountain range */}
      <path d="M0 190 L60 140 L100 165 L150 120 L210 175 L260 145 L320 180 L420 150 L420 260 L0 260 Z" fill="url(#ohel-mountain-far)" />
      {/* Near mountain range */}
      <path d="M0 220 L50 180 L90 205 L140 165 L190 215 L260 185 L330 225 L420 195 L420 260 L0 260 Z" fill="url(#ohel-mountain-near)" />

      {/* Lantern glow escaping the tent opening */}
      <ellipse cx="205" cy="230" rx="60" ry="30" fill="url(#ohel-lanternglow)" />

      {/* Tent */}
      <path d="M205 130 L150 235 L260 235 Z" fill="currentColor" opacity="0.22" />
      <path d="M205 130 L150 235 L175 235 Z" fill="currentColor" opacity="0.32" />
      {/* Tent entrance cut-out, with the lantern peeking through */}
      <path d="M205 165 L182 235 L228 235 Z" fill="#0A0E1A" />
      <path d="M205 175 L190 232 L220 232 Z" fill="#F5A623" opacity="0.5" />
      {/* Guy line */}
      <line x1="205" y1="130" x2="240" y2="150" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" />
      <circle cx="240" cy="150" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
};

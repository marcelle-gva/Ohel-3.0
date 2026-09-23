import type React from 'react';

// Colors here are the 700-weight of the same hue already used for each
// pillar's icon in OrdemNoCaos.tsx (which uses the 500-weight as a tinted
// icon color, e.g. `text-purple-500` on a `bg-purple-500/10` chip — that
// pairing never puts white text directly on the solid color, so contrast
// isn't an issue there). Here the color becomes `--primary`, which DOES
// get paired with white/near-white text everywhere (buttons, active nav
// pill, badges) — the 500-weight fails WCAG AA contrast against white text
// (as low as 2.08:1 for green, checked 2026-09-19), so this uses the
// 700-weight instead, which passes 4.5:1 for all five hues while staying
// recognizably "the same color family" as the icon.
export const PILLAR_ACCENT: Record<string, string> = {
  familiar: '#7e22ce', // purple-700 (icon uses purple-500)
  fitness: '#15803d', // green-700 (icon uses green-500) — Pessoal/Fitness pillar
  financeiro: '#047857', // emerald-700 (icon uses emerald-500) — Financeiro, personal profile
  profissional: '#1d4ed8', // blue-700 (icon uses blue-500) — Profissional, institutional profile
  spiritual: '#b91c1c', // red-700 (icon uses red-500)
};

/**
 * Returns the inline style to spread onto the page's outermost wrapper so
 * every existing `bg-primary` / `text-primary` / `border-primary` class
 * already used throughout that pillar's components picks up its color for
 * free, with no per-component changes needed. Views that aren't one of the
 * 4 pillars (dashboard, settings, etc.) get `undefined` — i.e. the normal
 * theme color, untouched.
 */
export function getPillarAccentStyle(view: string): React.CSSProperties | undefined {
  const color = PILLAR_ACCENT[view];
  if (!color) return undefined;
  return { ['--primary' as any]: color } as React.CSSProperties;
}

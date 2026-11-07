/** Figure extras: saved outfits, effects around the figure and things to carry in the hand. */
import type { BadgeId } from './progress';

export const OUTFIT_SLOTS = 5;

/* ---------------- effects ---------------- */

export interface EffectDef {
  name: string;
  icon: string;
  /** Unlocked by this badge or this level. */
  badge?: BadgeId;
  level?: number;
  /** Free for everyone while a hotel event is running. */
  duringEvents?: boolean;
}

export const EFFECTS = {
  none: { name: 'Ingen', icon: '⭕' },
  shadowPink: { name: 'Lyserød skygge', icon: '🩷', level: 2 },
  shadowBlue: { name: 'Blå skygge', icon: '💙', level: 2 },
  glow: { name: 'Gyldent skær', icon: '✨', level: 4 },
  sparkle: { name: 'Stjernestøv', icon: '🌟', badge: 'stjernekigger' },
  aura: { name: 'Festaura', icon: '🎉', badge: 'event', duringEvents: true },
} as const satisfies Record<string, EffectDef>;
export type EffectId = keyof typeof EFFECTS;
export const EFFECT_IDS = Object.keys(EFFECTS) as EffectId[];

export function effectUnlocked(
  id: string,
  badges: readonly string[],
  level: number,
  eventRunning = false,
): boolean {
  const e = (EFFECTS as Record<string, EffectDef>)[id];
  if (!e) return false;
  if (e.duringEvents && eventRunning) return true;
  if (e.badge && !badges.includes(e.badge)) return false;
  if (e.level && level < e.level) return false;
  return true;
}

/* ---------------- carrying things ---------------- */

export const CARRY = {
  kaffe: { name: 'Kop kaffe', icon: '☕' },
  is: { name: 'Is', icon: '🍦' },
  sodavand: { name: 'Sodavand', icon: '🥤' },
  blomst: { name: 'Blomst', icon: '🌹' },
  kage: { name: 'Cupcake', icon: '🧁' },
} as const;
export type CarryKind = keyof typeof CARRY;
export const CARRY_IDS = Object.keys(CARRY) as CarryKind[];
/** You put it down by yourself after this long. */
export const CARRY_MS = 10 * 60_000;

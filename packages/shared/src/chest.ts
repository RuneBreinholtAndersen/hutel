/**
 * Golden chests: now and then a glittering chest appears somewhere in a public room.
 * The first guest to reach it gets a rare piece of furniture that can't be bought.
 */
import type { FurnitureType } from './catalog';

export const CHEST = {
  /** On average one chest every this many minutes, while people are online. */
  meanMinutes: 240,
  /** It vanishes again if nobody finds it. */
  lifetimeMs: 8 * 60_000,
  /** What can be inside, and how often (higher = more common). */
  loot: [
    { type: 'guldand', weight: 40 },
    { type: 'krystallampe', weight: 30 },
    { type: 'guldtrone', weight: 20 },
    { type: 'regnbuekugle', weight: 10 },
  ] as { type: FurnitureType; weight: number }[],
};

export interface ChestView {
  id: number;
  x: number;
  z: number;
  /** Epoch ms when it disappears. */
  until: number;
}

export function pickLoot(rnd: () => number = Math.random): FurnitureType {
  const total = CHEST.loot.reduce((n, l) => n + l.weight, 0);
  let r = rnd() * total;
  for (const l of CHEST.loot) {
    r -= l.weight;
    if (r < 0) return l.type;
  }
  return CHEST.loot[0]!.type;
}

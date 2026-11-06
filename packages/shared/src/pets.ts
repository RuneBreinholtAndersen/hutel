/** Pets: follow their owner around the hotel, can be fed, learn tricks and level up. */

export interface PetKindDef {
  name: string;
  icon: string;
  price: number;
  minLevel?: number;
  defaultName: string;
  /** Fur/scale colours (first is the default). */
  colors: readonly number[];
  /** Short sounds shown in the pet's speech bubble. */
  sounds: readonly string[];
}

export const PET_KINDS = {
  hund: {
    name: 'Hund',
    icon: '🐶',
    price: 40,
    defaultName: 'Fido',
    colors: [0xc98f5c, 0x3a2a20, 0xf4efe6, 0xe0b06a],
    sounds: ['Vov!', 'Vov vov! 🐾', '*logrer med halen*', 'Vuf!'],
  },
  kat: {
    name: 'Kat',
    icon: '🐱',
    price: 40,
    defaultName: 'Misser',
    colors: [0xe08a3a, 0x2a2a35, 0xf4efe6, 0x8a8a95],
    sounds: ['Mjav!', 'Prrr… 😺', '*spinder*', 'Mjaaav?'],
  },
  drage: {
    name: 'Drage',
    icon: '🐲',
    price: 120,
    minLevel: 4,
    defaultName: 'Glød',
    colors: [0x4fa86a, 0xc94f3d, 0x6f4a8f, 0x3f7fb6],
    sounds: ['Rawr! 🔥', '*puster en lille røgsky*', 'Grrr…', '*flapper med vingerne*'],
  },
} as const satisfies Record<string, PetKindDef>;

export type PetKind = keyof typeof PET_KINDS;
export const PET_KIND_IDS = Object.keys(PET_KINDS) as PetKind[];

export const PET_TRICKS = {
  sit: { name: 'Sæt dig', icon: '🪑', level: 1 },
  jump: { name: 'Hop', icon: '⬆️', level: 2 },
  roll: { name: 'Rul rundt', icon: '🔄', level: 3 },
  beg: { name: 'Tig', icon: '🙏', level: 4 },
  dance: { name: 'Dans', icon: '💃', level: 5 },
} as const;
export type PetTrick = keyof typeof PET_TRICKS;
export const PET_TRICK_IDS = Object.keys(PET_TRICKS) as PetTrick[];

/** What a pet does in front of others. */
export type PetAct = PetTrick | 'eat' | 'happy' | 'sulk';

export const PET_MAX = 3;
export const PET_FEED_PRICE = 2;
/** A pet that hasn't eaten for this long is hungry and won't do tricks. */
export const PET_HUNGRY_AFTER_MS = 24 * 3600 * 1000;
/** You can feed again after this long. */
export const PET_FEED_COOLDOWN_MS = 2 * 3600 * 1000;
export const PET_FEED_XP = 5;
export const PET_TRICK_XP = 2;
export const PET_TRICK_COOLDOWN_MS = 15_000;
/** Most XP a pet can earn from tricks per day (so it can't be farmed). */
export const PET_TRICK_XP_PER_DAY = 40;
export const PET_MAX_LEVEL = 10;

/** XP needed to reach a level: 0, 10, 40, 90, 160 … */
export const petXpFor = (level: number) => 10 * (level - 1) ** 2;

export function petLevel(xp: number): number {
  let l = 1;
  while (l < PET_MAX_LEVEL && xp >= petXpFor(l + 1)) l++;
  return l;
}

/** Pet as everyone in the room sees it. */
export interface PetView {
  kind: PetKind;
  name: string;
  color: number;
  level: number;
}

/** Pet as its owner sees it in the pet panel. */
export interface PetInfo extends PetView {
  id: string;
  xp: number;
  hungry: boolean;
  /** When you may feed it again (ms epoch), 0 = now. */
  feedAt: number;
}

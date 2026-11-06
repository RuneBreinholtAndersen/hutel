/** Wallpapers and floors you buy once and can use in all your own rooms. */

export interface WallpaperDef {
  name: string;
  price: number;
  minLevel?: number;
  /** Pattern drawn in code (never images): base colour, stripe colour, dot colour. */
  base: string;
  stripe: string;
  dot: string;
  pattern: 'stripes' | 'diamonds' | 'plain' | 'bricks' | 'wood' | 'stars';
}

export interface FloorDef {
  name: string;
  price: number;
  minLevel?: number;
  /** The two alternating tile colours. */
  a: number;
  b: number;
}

export const WALLPAPERS = {
  creme: {
    name: 'Cremestriber',
    price: 15,
    base: '#f3dfc2',
    stripe: '#ecd3b0',
    dot: 'rgba(190,120,80,.28)',
    pattern: 'stripes',
  },
  mint: {
    name: 'Mintgrøn',
    price: 15,
    base: '#cfe8d8',
    stripe: '#c2dfcc',
    dot: 'rgba(60,120,90,.3)',
    pattern: 'stripes',
  },
  rosa: {
    name: 'Rosa',
    price: 15,
    base: '#f4d3d8',
    stripe: '#efc6cc',
    dot: 'rgba(170,70,90,.25)',
    pattern: 'plain',
  },
  natblaa: {
    name: 'Natteblå',
    price: 20,
    base: '#24305a',
    stripe: '#2a3768',
    dot: 'rgba(255,220,140,.5)',
    pattern: 'stars',
  },
  smaragd: {
    name: 'Smaragd',
    price: 25,
    base: '#2f5d5a',
    stripe: '#285250',
    dot: 'rgba(242,194,90,.35)',
    pattern: 'diamonds',
  },
  mursten: {
    name: 'Mursten',
    price: 25,
    minLevel: 2,
    base: '#a5573d',
    stripe: '#8f4a33',
    dot: 'rgba(240,220,200,.35)',
    pattern: 'bricks',
  },
  trae: {
    name: 'Træpaneler',
    price: 30,
    minLevel: 3,
    base: '#9a6a44',
    stripe: '#8a5c3a',
    dot: 'rgba(60,30,15,.35)',
    pattern: 'wood',
  },
  sort: {
    name: 'Sort med guld',
    price: 40,
    minLevel: 5,
    base: '#1f1c22',
    stripe: '#26222a',
    dot: 'rgba(224,176,74,.55)',
    pattern: 'diamonds',
  },
} as const satisfies Record<string, WallpaperDef>;

export const FLOORS = {
  egetrae: { name: 'Lyst træ', price: 15, a: 0xbd8250, b: 0xc98f5c },
  moerktrae: { name: 'Mørkt træ', price: 15, a: 0x6e4528, b: 0x7a4e2e },
  skak: { name: 'Skakbræt', price: 20, a: 0xf0ebe0, b: 0x2a2a35 },
  mint: { name: 'Mint fliser', price: 20, a: 0xd6c8ad, b: 0x3f6f6a },
  havblaa: { name: 'Havblå', price: 20, a: 0xb8c8cb, b: 0x6f9fac },
  marmor: { name: 'Marmor', price: 30, minLevel: 3, a: 0xe8e4dc, b: 0xcfc8bc },
  terrakotta: { name: 'Terrakotta', price: 25, minLevel: 2, a: 0xb5643c, b: 0xa25634 },
  neon: { name: 'Disco', price: 45, minLevel: 5, a: 0x3a2a5a, b: 0xff5ab0 },
} as const satisfies Record<string, FloorDef>;

export type WallpaperId = keyof typeof WALLPAPERS;
export type FloorId = keyof typeof FLOORS;
export type DecorKind = 'wall' | 'floor';

/** Key stored in the user's owned list, e.g. "wall:mint". */
export const decorKey = (kind: DecorKind, id: string) => `${kind}:${id}`;

export function decorDef(kind: DecorKind, id: string): WallpaperDef | FloorDef | undefined {
  const table: Record<string, WallpaperDef | FloorDef> = kind === 'wall' ? WALLPAPERS : FLOORS;
  return Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;
}

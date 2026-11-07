import type { BadgeId } from './progress';

export interface FurnitureDef {
  name: string;
  icon: string;
  price: number;
  /** Footprint along local x (width) and z (depth) at rotation 0. */
  w: number;
  d: number;
  /** Avatars can sit on every tile of this item. */
  seat?: boolean;
  /** Flat items (rugs) that can be walked on and placed under other items. */
  walk?: boolean;
  /** Not sold in the shop (fixtures in public rooms). */
  noShop?: boolean;
  /** Only for sale once you have this badge. */
  unlock?: BadgeId;
  /** Colour choices for the main fabric/paint (first is the default). */
  colors?: readonly number[];
  /** Only for sale from this hotel level. */
  minLevel?: number;
  /** Avatars lie down instead of sitting (beds, loungers). */
  lie?: boolean;
  /** Clicking switches between this many states (0 = off). `defaultState` when bought. */
  states?: number;
  defaultState?: number;
  /** Sold as a linked pair: one is placed, the twin goes to your inventory. */
  pair?: boolean;
  /**
   * Hangs on a wall instead of standing on the floor. `w` is the width along the wall.
   * rot 0 = back wall, rot 1 = left wall; `x` is the tile index along that wall.
   */
  wall?: boolean;
}

const FABRIC = [
  0x3f7f86, 0xc94f3d, 0xd29b3a, 0x5b8f4a, 0x6f4a8f, 0x2f4a7a, 0xe7dcc8, 0x2a2a35,
] as const;

export const FURNITURE = {
  plant: { name: 'Plante', icon: '🪴', price: 6, w: 1, d: 1 },
  cactus: { name: 'Kaktus', icon: '🌵', price: 5, w: 1, d: 1 },
  lamp: { name: 'Gulvlampe', icon: '💡', price: 8, w: 1, d: 1, states: 2, defaultState: 1 },
  rug: {
    name: 'Tæppe',
    icon: '🟥',
    price: 8,
    w: 2,
    d: 2,
    walk: true,
    colors: [0x9e3b3b, 0x2f4a7a, 0x3d7a5a, 0x6f4a8f, 0xb8862e],
  },
  table: { name: 'Sofabord', icon: '☕', price: 10, w: 1, d: 1 },
  stool: {
    name: 'Taburet',
    icon: '🪑',
    price: 7,
    w: 1,
    d: 1,
    seat: true,
    colors: [0xc94f3d, 0x3f7f86, 0xe0a93b, 0x2a2a35],
  },
  chair: { name: 'Spisestol', icon: '🪑', price: 9, w: 1, d: 1, seat: true, colors: FABRIC },
  armchair: {
    name: 'Lænestol',
    icon: '🪑',
    price: 12,
    w: 1,
    d: 1,
    seat: true,
    colors: [0xd29b3a, ...FABRIC.filter((c) => c !== 0xd29b3a)],
  },
  shelf: { name: 'Bogreol', icon: '📚', price: 15, w: 2, d: 1 },
  aquarium: { name: 'Akvarie', icon: '🐠', price: 18, w: 1, d: 1 },
  sofa: { name: 'Sofa', icon: '🛋️', price: 20, w: 2, d: 1, seat: true, colors: FABRIC },
  bed: {
    name: 'Seng',
    icon: '🛏️',
    price: 25,
    w: 2,
    d: 2,
    seat: true,
    lie: true,
    colors: [0x5a77b0, 0xc94f3d, 0x5b8f4a, 0x6f4a8f, 0xe0a93b],
  },
  // Unlocked by badges
  beanbag: {
    name: 'Sækkestol',
    icon: '🫘',
    price: 14,
    w: 1,
    d: 1,
    seat: true,
    unlock: 'onboarded',
    colors: [0xe0a93b, 0xc94f3d, 0x3f7f86, 0x6f4a8f, 0x5b8f4a],
  },
  tv: {
    name: 'Fjernsyn',
    icon: '📺',
    price: 22,
    w: 2,
    d: 1,
    unlock: 'onboarded',
    states: 4,
    defaultState: 0,
  },
  fireplace: {
    name: 'Pejs',
    icon: '🔥',
    price: 40,
    w: 2,
    d: 1,
    unlock: 'hotelkender',
    states: 2,
    defaultState: 1,
  },
  piano: {
    name: 'Klaver',
    icon: '🎹',
    price: 45,
    w: 2,
    d: 1,
    unlock: 'hotelkender',
    colors: [0x2a2a35, 0xf4efe6, 0x8a5634],
  },
  jukebox: {
    name: 'Jukebox',
    icon: '🎵',
    price: 35,
    w: 1,
    d: 1,
    unlock: 'streak7',
    states: 2,
    defaultState: 1,
  },
  lounger: {
    name: 'Liggestol',
    icon: '🏖️',
    price: 16,
    w: 1,
    d: 2,
    seat: true,
    lie: true,
    unlock: 'hotelkender',
    colors: [0x3f7f86, 0xc94f3d, 0xe0a93b, 0x2f4a7a, 0x5b8f4a],
  },
  // Apartment furniture (from a hotel level)
  nightstand: {
    name: 'Natbord',
    icon: '🌙',
    price: 10,
    w: 1,
    d: 1,
    minLevel: 3,
    states: 2,
    defaultState: 1,
  },
  bathtub: {
    name: 'Badekar',
    icon: '🛁',
    price: 30,
    w: 2,
    d: 1,
    seat: true,
    lie: true,
    minLevel: 4,
    colors: [0xf4f1ea, 0xd98fa8, 0x8fc6d9, 0x2a2a35],
  },
  sink: { name: 'Håndvask', icon: '🚰', price: 14, w: 1, d: 1, minLevel: 4 },
  kitchen: {
    name: 'Køkkenbord',
    icon: '🍳',
    price: 28,
    w: 2,
    d: 1,
    minLevel: 5,
    colors: [0xf4f1ea, 0x3f7f86, 0x2a2a35, 0xc94f3d],
  },
  fridge: {
    name: 'Køleskab',
    icon: '🧊',
    price: 24,
    w: 1,
    d: 1,
    minLevel: 5,
    colors: [0xe8eef0, 0xc94f3d, 0x5b8f4a],
  },
  grill: {
    name: 'Grill',
    icon: '🍖',
    price: 26,
    w: 1,
    d: 1,
    minLevel: 6,
    states: 2,
    defaultState: 0,
  },
  pool: { name: 'Pool', icon: '🏊', price: 0, w: 3, d: 2, noShop: true },
  arcade: { name: 'Spilleautomat', icon: '🕹️', price: 0, w: 1, d: 1, noShop: true },
  // ---- Room games (the server runs the rules) ----
  gamebox: { name: 'Spilkonsol', icon: '🕹️', price: 25, w: 1, d: 1, minLevel: 2 },
  colortile: {
    name: 'Farvefelt',
    icon: '🟦',
    price: 3,
    w: 1,
    d: 1,
    walk: true,
    states: 3,
    defaultState: 0,
  },
  racestart: { name: 'Startfelt', icon: '🟩', price: 4, w: 1, d: 1, walk: true },
  racegoal: { name: 'Målfelt', icon: '🏁', price: 6, w: 1, d: 1, walk: true },
  teleport: {
    name: 'Teleporter (par)',
    icon: '🌀',
    price: 35,
    w: 1,
    d: 1,
    pair: true,
    minLevel: 2,
    colors: [0x5a8fd6, 0xc94f3d, 0x3d7a5a, 0x6f4a8f],
  },
  // ---- On the wall ----
  painting: {
    name: 'Maleri',
    icon: '🖼️',
    price: 12,
    w: 1,
    d: 1,
    wall: true,
    colors: [0xc89a3c, 0x2a2a35, 0xf4efe6, 0x8a5634],
  },
  bigpainting: {
    name: 'Stort maleri',
    icon: '🏞️',
    price: 22,
    w: 2,
    d: 1,
    wall: true,
    colors: [0xc89a3c, 0x2a2a35, 0xf4efe6],
  },
  poster: {
    name: 'Plakat',
    icon: '📜',
    price: 6,
    w: 1,
    d: 1,
    wall: true,
    colors: [0xe0564a, 0x3f7f86, 0xe0a93b, 0x6f4a8f],
  },
  window: {
    name: 'Vindue',
    icon: '🪟',
    price: 25,
    w: 2,
    d: 1,
    wall: true,
    colors: [0x9e2f3a, 0x2f4a7a, 0x3d7a5a, 0xe7dcc8],
  },
  wallshelf: {
    name: 'Væghylde',
    icon: '🪴',
    price: 10,
    w: 1,
    d: 1,
    wall: true,
    colors: [0x8a5634, 0xf4efe6, 0x2a2a35],
  },
  clock: { name: 'Vægur', icon: '🕰️', price: 9, w: 1, d: 1, wall: true },
  noteboard: { name: 'Opslagstavle', icon: '📌', price: 12, w: 2, d: 1, wall: true },
  mirror: { name: 'Spejl', icon: '🪞', price: 14, w: 1, d: 1, wall: true, minLevel: 2 },
  neon: {
    name: 'Neonskilt',
    icon: '💖',
    price: 30,
    w: 2,
    d: 1,
    wall: true,
    minLevel: 4,
    states: 2,
    defaultState: 1,
    colors: [0xff5ab0, 0x5ad8ff, 0xffd04a, 0x7dff8a],
  },
  desk: { name: 'Reception', icon: '🛎️', price: 0, w: 3, d: 1, noShop: true },
  counter: { name: 'Cafédisk', icon: '🧁', price: 0, w: 3, d: 1, noShop: true },
} as const satisfies Record<string, FurnitureDef>;

export type FurnitureType = keyof typeof FURNITURE;
export const FURNITURE_TYPES = Object.keys(FURNITURE) as FurnitureType[];

export function furniture(type: FurnitureType): FurnitureDef {
  return FURNITURE[type];
}

export function sellPrice(type: FurnitureType): number {
  return Math.floor(furniture(type).price / 2);
}

/** Shop departments. Every furniture type sold in the shop belongs to exactly one. */
export const SHOP_CATEGORIES = [
  {
    id: 'sit',
    name: 'Siddepladser',
    icon: '🛋️',
    types: ['stool', 'chair', 'armchair', 'sofa', 'beanbag', 'lounger'],
  },
  { id: 'table', name: 'Borde og opbevaring', icon: '🪑', types: ['table', 'shelf', 'nightstand'] },
  { id: 'bed', name: 'Seng og bad', icon: '🛏️', types: ['bed', 'bathtub', 'sink'] },
  { id: 'kitchen', name: 'Køkken og have', icon: '🍳', types: ['kitchen', 'fridge', 'grill'] },
  {
    id: 'light',
    name: 'Lys og lyd',
    icon: '💡',
    types: ['lamp', 'tv', 'fireplace', 'jukebox', 'piano'],
  },
  {
    id: 'deco',
    name: 'Planter og pynt',
    icon: '🪴',
    types: ['plant', 'cactus', 'rug', 'aquarium'],
  },
  {
    id: 'wall',
    name: 'Til væggen',
    icon: '🖼️',
    types: [
      'painting',
      'bigpainting',
      'poster',
      'window',
      'wallshelf',
      'clock',
      'mirror',
      'neon',
      'noteboard',
    ],
  },
  {
    id: 'games',
    name: 'Spil og teleport',
    icon: '🕹️',
    types: ['gamebox', 'colortile', 'racestart', 'racegoal', 'teleport'],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  icon: string;
  types: readonly FurnitureType[];
}[];
export type ShopCategoryId = (typeof SHOP_CATEGORIES)[number]['id'];

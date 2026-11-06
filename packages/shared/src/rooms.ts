import type { PlacedItem } from './placement';
import { isFloorTile, leftWallLength, type Floor } from './layout';

export type RoomTheme =
  | 'home'
  | 'lobby'
  | 'cafe'
  | 'roof'
  | 'arcade'
  | 'pool'
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'balcony';

/** Extra rooms you can buy for your apartment. Your first room is the living room. */
export const APARTMENT_ROOMS = [
  { kind: 'bedroom', name: 'Soveværelse', icon: '🛏️', price: 60, level: 3, theme: 'bedroom' },
  { kind: 'bathroom', name: 'Badeværelse', icon: '🛁', price: 80, level: 4, theme: 'bathroom' },
  { kind: 'kitchen', name: 'Køkken', icon: '🍳', price: 100, level: 5, theme: 'kitchen' },
  { kind: 'balcony', name: 'Altan', icon: '🌿', price: 120, level: 6, theme: 'balcony' },
] as const satisfies readonly {
  kind: string;
  name: string;
  icon: string;
  price: number;
  level: number;
  theme: RoomTheme;
}[];
export type ApartmentKind = (typeof APARTMENT_ROOMS)[number]['kind'];

/** Starting furniture for each bought room. */
export const APARTMENT_START_ITEMS: Record<ApartmentKind, Omit<PlacedItem, 'id'>[]> = {
  bedroom: [
    { type: 'bed', x: 1, z: 1, rot: 0 },
    { type: 'nightstand', x: 3, z: 1, rot: 0 },
    { type: 'rug', x: 1, z: 3, rot: 0, color: 3 },
  ],
  bathroom: [
    { type: 'bathtub', x: 1, z: 0, rot: 0 },
    { type: 'sink', x: 4, z: 0, rot: 0 },
    { type: 'plant', x: 0, z: 7, rot: 0 },
  ],
  kitchen: [
    { type: 'kitchen', x: 1, z: 0, rot: 0 },
    { type: 'fridge', x: 3, z: 0, rot: 0 },
    { type: 'table', x: 3, z: 4, rot: 0 },
    { type: 'chair', x: 2, z: 4, rot: 1 },
    { type: 'chair', x: 4, z: 4, rot: 3 },
  ],
  balcony: [
    { type: 'grill', x: 1, z: 1, rot: 0 },
    { type: 'plant', x: 0, z: 0, rot: 0 },
    { type: 'plant', x: 7, z: 7, rot: 0 },
    { type: 'lounger', x: 4, z: 3, rot: 0 },
    { type: 'cactus', x: 0, z: 6, rot: 0 },
  ],
};
export type RoomAccess = 'open' | 'locked' | 'password';

/** Navigator categories for rooms. */
export const ROOM_CATEGORIES = {
  fest: { name: 'Fest', icon: '🎉' },
  chill: { name: 'Chill', icon: '😌' },
  spil: { name: 'Spil', icon: '🎮' },
  handel: { name: 'Handel', icon: '🤝' },
  andet: { name: 'Andet', icon: '🏠' },
} as const;
export type RoomCategory = keyof typeof ROOM_CATEGORIES;
export const ROOM_CATEGORY_IDS = Object.keys(ROOM_CATEGORIES) as RoomCategory[];

/** Built-in window on the left wall per theme: tile index (z) of its centre. */
const THEME_WINDOW: Partial<Record<RoomTheme, number>> = {
  home: 2,
  bedroom: 2,
  bathroom: 5,
  kitchen: 5,
};

/** Where the theme's window sits on the left wall for this floor plan (null = no window). */
export function themeWindowTile(theme: RoomTheme, floor: Floor): number | null {
  const c = THEME_WINDOW[theme];
  if (c === undefined) return null;
  const len = leftWallLength(floor);
  if (len < 3) return null;
  return Math.min(c, len - 2);
}

/** Wall tiles taken by the built-in window, so pictures can't hang on top of it. */
export function themeWallBlocks(
  theme: RoomTheme,
  floor: Floor,
): { back?: readonly number[]; left?: readonly number[] } {
  const c = themeWindowTile(theme, floor);
  return c === null ? {} : { left: [c - 1, c, c + 1] };
}

/** A door inside your apartment that leads to another of your rooms. */
export interface AptDoor {
  roomId: string;
  name: string;
  icon: string;
  /** 0 = back wall (idx = x), 1 = left wall (idx = z). */
  wall: 0 | 1;
  idx: number;
}

/** The floor tile in front of an apartment door (walk onto it to go through). */
export const doorSpot = (d: Pick<AptDoor, 'wall' | 'idx'>): [number, number] =>
  d.wall === 0 ? [d.idx, 0] : [0, d.idx];

/**
 * Free places for apartment doors in a room: three on the back wall (away from the main door), then
 * along the left wall from the front, skipping the theme's window.
 */
export function doorSlots(theme: RoomTheme, floor: Floor): { wall: 0 | 1; idx: number }[] {
  const out: { wall: 0 | 1; idx: number }[] = [];
  for (const x of [2, 0, 4]) if (isFloorTile(floor, x, 0)) out.push({ wall: 0, idx: x });
  const len = leftWallLength(floor);
  const win = themeWallBlocks(theme, floor).left ?? [];
  for (let z = len - 2; z >= 1 && out.length < 6; z -= 2)
    if (!win.includes(z) && !win.includes(z - 1) && !win.includes(z + 1))
      out.push({ wall: 1, idx: z });
  return out;
}

/** The door tile in every room (in front of the door on the back wall). */
export const DOOR_TILE = [6, 0] as const;

export interface PublicRoomDef {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
  /** Floor size in tiles (square). Defaults to ROOM_SIZE. */
  size?: number;
  category: RoomCategory;
  items: PlacedItem[];
}

export const PUBLIC_ROOMS: PublicRoomDef[] = [
  {
    id: 'lobby',
    category: 'chill',
    name: 'Lobbyen',
    description: 'Hotellets hjerte. Mød Ida i receptionen.',
    theme: 'lobby',
    size: 12,
    items: [
      { id: 1001, type: 'desk', x: 2, z: 2, rot: 0 },
      { id: 1002, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 1003, type: 'plant', x: 11, z: 0, rot: 0 },
      { id: 1004, type: 'plant', x: 0, z: 11, rot: 0 },
      { id: 1005, type: 'rug', x: 5, z: 6, rot: 0 },
      { id: 1006, type: 'table', x: 5, z: 6, rot: 0 },
      { id: 1007, type: 'armchair', x: 4, z: 6, rot: 1 },
      { id: 1008, type: 'armchair', x: 7, z: 6, rot: 3 },
      { id: 1009, type: 'sofa', x: 5, z: 9, rot: 2 },
      { id: 1010, type: 'aquarium', x: 0, z: 6, rot: 1 },
      { id: 1011, type: 'lamp', x: 1, z: 0, rot: 0 },
      { id: 1012, type: 'plant', x: 11, z: 11, rot: 0 },
      { id: 1013, type: 'sofa', x: 11, z: 5, rot: 3 },
      { id: 1014, type: 'table', x: 9, z: 6, rot: 0 },
      { id: 1015, type: 'lamp', x: 11, z: 3, rot: 0 },
      { id: 1016, type: 'aquarium', x: 0, z: 7, rot: 1 },
      { id: 1017, type: 'plant', x: 6, z: 11, rot: 0 },
    ],
  },
  {
    id: 'cafe',
    category: 'chill',
    name: 'Caféen',
    description: 'Kaffe, kage og god snak. Luna står bag disken.',
    theme: 'cafe',
    size: 12,
    items: [
      { id: 2001, type: 'counter', x: 1, z: 1, rot: 0 },
      { id: 2002, type: 'stool', x: 1, z: 2, rot: 2 },
      { id: 2003, type: 'stool', x: 3, z: 2, rot: 2 },
      { id: 2007, type: 'table', x: 2, z: 8, rot: 0 },
      { id: 2008, type: 'armchair', x: 1, z: 8, rot: 1 },
      { id: 2009, type: 'armchair', x: 3, z: 8, rot: 3 },
      { id: 2010, type: 'rug', x: 1, z: 9, rot: 0 },
      { id: 2011, type: 'sofa', x: 5, z: 11, rot: 2 },
      { id: 2012, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 2013, type: 'plant', x: 11, z: 11, rot: 0 },
      { id: 2014, type: 'lamp', x: 11, z: 1, rot: 0 },
      { id: 2015, type: 'shelf', x: 0, z: 4, rot: 1 },
      { id: 2016, type: 'table', x: 8, z: 4, rot: 0 },
      { id: 2017, type: 'stool', x: 7, z: 4, rot: 1 },
      { id: 2018, type: 'stool', x: 9, z: 4, rot: 3 },
      { id: 2019, type: 'table', x: 8, z: 8, rot: 0 },
      { id: 2020, type: 'stool', x: 7, z: 8, rot: 1 },
      { id: 2021, type: 'stool', x: 9, z: 8, rot: 3 },
      { id: 2022, type: 'plant', x: 0, z: 11, rot: 0 },
      { id: 2023, type: 'lamp', x: 4, z: 11, rot: 0 },
    ],
  },
  {
    id: 'roof',
    category: 'fest',
    name: 'Tagterrassen',
    description: 'Stjerner, lyskæder og udsigt over byen. Viggo kender alle stjernebilleder.',
    theme: 'roof',
    items: [
      { id: 3001, type: 'rug', x: 2, z: 2, rot: 0 },
      { id: 3002, type: 'sofa', x: 2, z: 1, rot: 0 },
      { id: 3003, type: 'table', x: 2, z: 3, rot: 0 },
      { id: 3004, type: 'beanbag', x: 1, z: 3, rot: 1, color: 1 },
      { id: 3005, type: 'beanbag', x: 4, z: 3, rot: 3, color: 2 },
      { id: 3006, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 3007, type: 'plant', x: 0, z: 7, rot: 0 },
      { id: 3008, type: 'plant', x: 7, z: 7, rot: 0 },
      { id: 3009, type: 'cactus', x: 7, z: 3, rot: 0 },
      { id: 3010, type: 'fireplace', x: 4, z: 7, rot: 2 },
      { id: 3011, type: 'lounger', x: 6, z: 4, rot: 0 },
      { id: 3012, type: 'lamp', x: 0, z: 4, rot: 0 },
    ],
  },
  {
    id: 'arcade',
    category: 'spil',
    name: 'Spillehallen',
    description: 'Terninger, sten-saks-papir og quiz. Sofus står for spillene.',
    theme: 'arcade',
    items: [
      { id: 4001, type: 'arcade', x: 0, z: 1, rot: 1 },
      { id: 4002, type: 'arcade', x: 0, z: 2, rot: 1 },
      { id: 4003, type: 'arcade', x: 0, z: 3, rot: 1 },
      { id: 4004, type: 'jukebox', x: 7, z: 2, rot: 3 },
      { id: 4005, type: 'rug', x: 3, z: 3, rot: 0, color: 3 },
      { id: 4006, type: 'table', x: 4, z: 4, rot: 0 },
      { id: 4007, type: 'stool', x: 3, z: 4, rot: 1, color: 3 },
      { id: 4008, type: 'stool', x: 5, z: 4, rot: 3, color: 1 },
      { id: 4009, type: 'beanbag', x: 4, z: 6, rot: 2, color: 3 },
      { id: 4010, type: 'sofa', x: 2, z: 7, rot: 2, color: 7 },
      { id: 4011, type: 'tv', x: 2, z: 0, rot: 0 },
    ],
  },
  {
    id: 'pool',
    category: 'fest',
    name: 'Poolen',
    description: 'Varmt vand, liggestole og palmer. Freja holder øje fra tårnet.',
    theme: 'pool',
    items: [
      { id: 5001, type: 'pool', x: 2, z: 3, rot: 0 },
      { id: 5002, type: 'lounger', x: 0, z: 2, rot: 0, color: 1 },
      { id: 5003, type: 'lounger', x: 0, z: 5, rot: 0, color: 3 },
      { id: 5004, type: 'lounger', x: 7, z: 3, rot: 0, color: 4 },
      { id: 5005, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 5006, type: 'plant', x: 7, z: 7, rot: 0 },
      { id: 5007, type: 'plant', x: 0, z: 7, rot: 0 },
      { id: 5008, type: 'cactus', x: 7, z: 1, rot: 0 },
      { id: 5009, type: 'chair', x: 4, z: 1, rot: 0, color: 6 },
      { id: 5010, type: 'table', x: 3, z: 1, rot: 0 },
    ],
  },
];

/** Starting furniture for every new guest room. */
export const DEFAULT_HOME_ITEMS: Omit<PlacedItem, 'id'>[] = [
  { type: 'rug', x: 2, z: 1, rot: 0 },
  { type: 'sofa', x: 2, z: 0, rot: 0 },
  { type: 'table', x: 2, z: 2, rot: 0 },
  { type: 'lamp', x: 1, z: 0, rot: 0 },
  { type: 'plant', x: 0, z: 0, rot: 0 },
  { type: 'shelf', x: 0, z: 4, rot: 1 },
  { type: 'armchair', x: 5, z: 2, rot: 3 },
];

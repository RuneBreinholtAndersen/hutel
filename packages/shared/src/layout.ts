/**
 * Room floor plans. Every shape keeps the whole back row (the door is on it) and starts the
 * left wall at the back corner, so walls never hang over empty space.
 */

export const ROOM_SHAPES = {
  square: { name: 'Kvadrat', icon: '⬛' },
  wide: { name: 'Bred', icon: '▬' },
  L: { name: 'L-form', icon: '◣' },
  J: { name: 'Spejlet L', icon: '◢' },
  U: { name: 'U-form', icon: '⊔' },
} as const;
export type RoomShape = keyof typeof ROOM_SHAPES;
export const ROOM_SHAPE_IDS = Object.keys(ROOM_SHAPES) as RoomShape[];

export const MIN_USER_ROOM_SIZE = 7;
export const MAX_USER_ROOM_SIZE = 12;

/** Raised tiles: "x,z" → height in steps (1..MAX_TILE_HEIGHT). Flat tiles are left out. */
export type TileHeights = Record<string, number>;
export const MAX_TILE_HEIGHT = 3;
/** World height of one step. */
export const STEP_HEIGHT = 0.35;

/** A floor: either a plain square size or a size with a shape and raised tiles. */
export type Floor = number | { size: number; shape?: RoomShape; heights?: TileHeights };

/** Height of a tile in steps (0 = floor level). */
export function tileHeight(f: Floor, x: number, z: number): number {
  return typeof f === 'number' ? 0 : (f.heights?.[`${x},${z}`] ?? 0);
}

export const floorSize = (f: Floor) => (typeof f === 'number' ? f : f.size);
export const floorShape = (f: Floor): RoomShape =>
  typeof f === 'number' ? 'square' : (f.shape ?? 'square');

/** Whether tile (x, z) is part of the floor. */
export function isFloorTile(f: Floor, x: number, z: number): boolean {
  const n = floorSize(f);
  if (x < 0 || z < 0 || x >= n || z >= n) return false;
  const h = Math.ceil(n / 2);
  switch (floorShape(f)) {
    case 'wide':
      return z < Math.ceil(n * 0.6);
    case 'L':
      return !(x >= h && z >= h);
    case 'J':
      return !(x < n - h && z >= h);
    case 'U':
      return !(z >= h && x >= Math.floor(n / 3) && x < n - Math.floor(n / 3));
    default:
      return true;
  }
}

/** How far the left wall reaches (the floor along x = 0). */
export function leftWallLength(f: Floor): number {
  let z = 0;
  while (isFloorTile(f, 0, z)) z++;
  return z;
}

export function floorTileCount(f: Floor): number {
  const n = floorSize(f);
  let c = 0;
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) if (isFloorTile(f, x, z)) c++;
  return c;
}

/** Price to build a room of this size (sizes up to 8 are free). Bigger also needs a level. */
export const SIZE_PRICES: Record<number, { price: number; minLevel: number }> = {
  7: { price: 0, minLevel: 1 },
  8: { price: 0, minLevel: 1 },
  9: { price: 40, minLevel: 2 },
  10: { price: 80, minLevel: 3 },
  11: { price: 130, minLevel: 4 },
  12: { price: 200, minLevel: 5 },
};

/** Coins to pay going from the biggest size you've already paid for to `size`. */
export function renovationPrice(paidSize: number, size: number): number {
  const p = (s: number) => SIZE_PRICES[s]?.price ?? 0;
  return Math.max(0, p(size) - p(paidSize));
}

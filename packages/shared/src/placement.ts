import { furniture, type FurnitureType } from './catalog';
import { createGrid, type Grid, type Tile } from './grid';
import { DOOR_TILE } from './rooms';

export interface PlacedItem {
  id: number;
  type: FurnitureType;
  x: number;
  z: number;
  /** 0..3, quarter turns. */
  rot: number;
  /** Index into the item's colour choices (0 = default). */
  color?: number;
  /** For switchable items (lamps, TV…): 0 = off, 1.. = on / channel. */
  state?: number;
}

/** Current state of a switchable item (falls back to its default). */
export function itemState(it: Pick<PlacedItem, 'type' | 'state'>): number {
  return it.state ?? furniture(it.type).defaultState ?? 0;
}

export function footprint(it: Pick<PlacedItem, 'type' | 'rot'>): { w: number; d: number } {
  const f = furniture(it.type);
  return it.rot % 2 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

export const isWallItem = (type: FurnitureType) => !!furniture(type).wall;

/** Tiles along the wall a wall item covers (index range on its wall). */
export function wallSpan(it: Pick<PlacedItem, 'type' | 'x'>): number[] {
  const w = furniture(it.type).w;
  return Array.from({ length: w }, (_, i) => it.x + i);
}

/** Floor tiles an item stands on (wall items stand on none). */
export function tilesOf(it: Pick<PlacedItem, 'type' | 'rot' | 'x' | 'z'>): Tile[] {
  if (isWallItem(it.type)) return [];
  const { w, d } = footprint(it);
  const out: Tile[] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([it.x + i, it.z + j]);
  return out;
}

/** Grid where non-walkable furniture blocks tiles. */
export function buildGrid(size: number, items: readonly PlacedItem[], excludeId?: number): Grid {
  const g = createGrid(size, size);
  for (const it of items) {
    if (it.id === excludeId || furniture(it.type).walk) continue;
    for (const [x, z] of tilesOf(it))
      if (x >= 0 && z >= 0 && x < size && z < size) g.cells[x]![z] = it.id;
  }
  return g;
}

/**
 * Whether `it` can stand at its position. Rugs only collide with rugs; everything else only
 * collides with non-rug furniture and with tiles where avatars stand (`occupied`).
 */
export function canPlace(
  size: number,
  items: readonly PlacedItem[],
  it: PlacedItem,
  occupied: readonly Tile[] = [],
  blocked: { back?: readonly number[]; left?: readonly number[] } = {},
): boolean {
  if (isWallItem(it.type)) {
    // rot 0 = back wall, rot 1 = left wall. Never over the door, never on top of another wall item.
    if (it.rot !== 0 && it.rot !== 1) return false;
    if (it.z !== 0) return false;
    const span = wallSpan(it);
    if (span[0]! < 0 || span[span.length - 1]! >= size) return false;
    if (it.rot === 0 && span.includes(DOOR_TILE[0])) return false;
    const taken = (it.rot === 0 ? blocked.back : blocked.left) ?? [];
    if (span.some((x) => taken.includes(x))) return false;
    return !items.some(
      (o) =>
        o.id !== it.id &&
        isWallItem(o.type) &&
        o.rot === it.rot &&
        wallSpan(o).some((x) => span.includes(x)),
    );
  }
  const walk = !!furniture(it.type).walk;
  for (const [x, z] of tilesOf(it)) {
    if (x < 0 || z < 0 || x >= size || z >= size) return false;
    for (const o of items) {
      if (o.id === it.id || !!furniture(o.type).walk !== walk) continue;
      if (tilesOf(o).some(([a, b]) => a === x && b === z)) return false;
    }
    if (!walk && occupied.some(([a, b]) => a === x && b === z)) return false;
  }
  return true;
}

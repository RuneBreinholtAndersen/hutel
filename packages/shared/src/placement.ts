import { furniture, type FurnitureType } from './catalog';
import { createGrid, type Grid, type Tile } from './grid';

export interface PlacedItem {
  id: number;
  type: FurnitureType;
  x: number;
  z: number;
  /** 0..3, quarter turns. */
  rot: number;
  /** Index into the item's colour choices (0 = default). */
  color?: number;
}

export function footprint(it: Pick<PlacedItem, 'type' | 'rot'>): { w: number; d: number } {
  const f = furniture(it.type);
  return it.rot % 2 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

export function tilesOf(it: Pick<PlacedItem, 'type' | 'rot' | 'x' | 'z'>): Tile[] {
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
): boolean {
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

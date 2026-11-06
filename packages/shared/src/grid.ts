/** A tile coordinate on a room grid. */
export type Tile = readonly [x: number, z: number];

export interface Grid {
  readonly width: number;
  readonly depth: number;
  /** 0 = free, otherwise the id of the furniture item occupying the tile. */
  readonly cells: number[][];
}

export function createGrid(width: number, depth: number): Grid {
  return { width, depth, cells: Array.from({ length: width }, () => Array<number>(depth).fill(0)) };
}

export function inBounds(grid: Grid, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < grid.width && z < grid.depth;
}

export function isFree(grid: Grid, x: number, z: number): boolean {
  return inBounds(grid, x, z) && grid.cells[x]![z] === 0;
}

const DIRS: readonly Tile[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Breadth-first search with 8 directions. Diagonal steps are only allowed when both
 * orthogonal neighbours are free (no corner cutting). The goal tile may be occupied by
 * `seatId` so avatars can walk onto a seat. Returns the path excluding the start tile,
 * or null if the goal is unreachable.
 */
export function findPath(grid: Grid, start: Tile, goal: Tile, seatId = -1): Tile[] | null {
  const [sx, sz] = start;
  const [gx, gz] = goal;
  const isGoal = (x: number, z: number) => x === gx && z === gz;
  const ok = (x: number, z: number) =>
    isFree(grid, x, z) || (isGoal(x, z) && inBounds(grid, x, z) && grid.cells[x]![z] === seatId);
  if (!ok(gx, gz)) return null;

  const key = (x: number, z: number) => x * grid.depth + z;
  const prev = new Map<number, number>([[key(sx, sz), -1]]);
  const queue: Tile[] = [[sx, sz]];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i]!;
    if (isGoal(x, z)) {
      const path: Tile[] = [];
      let k = key(x, z);
      while (k !== key(sx, sz)) {
        path.unshift([Math.floor(k / grid.depth), k % grid.depth]);
        k = prev.get(k)!;
      }
      return path;
    }
    for (const [dx, dz] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!ok(nx, nz) || prev.has(key(nx, nz))) continue;
      if (dx && dz && (!isFree(grid, x + dx, z) || !isFree(grid, x, z + dz))) continue;
      prev.set(key(nx, nz), key(x, z));
      queue.push([nx, nz]);
    }
  }
  return null;
}

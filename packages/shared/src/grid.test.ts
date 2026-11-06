import { describe, expect, it } from 'vitest';
import { createGrid, findPath } from './grid';

describe('findPath', () => {
  it('finds a diagonal path on an empty grid', () => {
    const g = createGrid(8, 8);
    expect(findPath(g, [0, 0], [3, 3])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('walks around furniture', () => {
    const g = createGrid(8, 8);
    g.cells[1]![0] = 5;
    g.cells[1]![1] = 5;
    const path = findPath(g, [0, 0], [2, 0]);
    expect(path).not.toBeNull();
    expect(path!.some(([x, z]) => x === 1 && (z === 0 || z === 1))).toBe(false);
  });

  it('does not cut corners diagonally', () => {
    const g = createGrid(3, 3);
    g.cells[1]![0] = 1;
    const path = findPath(g, [0, 0], [1, 1])!;
    expect(path).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('allows walking onto a seat but not other furniture', () => {
    const g = createGrid(4, 4);
    g.cells[2]![2] = 7;
    expect(findPath(g, [0, 0], [2, 2])).toBeNull();
    expect(findPath(g, [0, 0], [2, 2], 7)?.at(-1)).toEqual([2, 2]);
  });

  it('returns null when the goal is walled in', () => {
    const g = createGrid(3, 3);
    for (const [x, z] of [
      [0, 1],
      [1, 1],
      [1, 0],
    ] as const)
      g.cells[x]![z] = 1;
    expect(findPath(g, [2, 2], [0, 0])).toBeNull();
  });
});

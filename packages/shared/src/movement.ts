import { RUN_MULTIPLIER, WALK_SPEED } from './constants';

/**
 * Position along a path at time `now`. Both server and clients use this so they agree on
 * where an avatar is. `from` is the tile the path starts at; each step is one tile.
 */
export function positionAt(
  from: readonly [number, number],
  path: readonly (readonly [number, number])[],
  pathStart: number,
  run: boolean,
  now: number,
): { x: number; z: number; done: boolean; dir: [number, number] } {
  const speed = WALK_SPEED * (run ? RUN_MULTIPLIER : 1);
  let t = Math.max(0, (now - pathStart) / 1000) * speed;
  let [px, pz] = from;
  let dir: [number, number] = [0, 1];
  for (const [nx, nz] of path) {
    const len = Math.hypot(nx - px, nz - pz);
    dir = [nx - px, nz - pz];
    if (t <= len) {
      const k = len === 0 ? 1 : t / len;
      return { x: px + (nx - px) * k, z: pz + (nz - pz) * k, done: false, dir };
    }
    t -= len;
    px = nx;
    pz = nz;
  }
  return { x: px, z: pz, done: true, dir };
}

/** Total duration in ms of walking a path. */
export function pathDuration(from: readonly [number, number], path: readonly (readonly [number, number])[], run: boolean): number {
  const speed = WALK_SPEED * (run ? RUN_MULTIPLIER : 1);
  let [px, pz] = from;
  let len = 0;
  for (const [nx, nz] of path) {
    len += Math.hypot(nx - px, nz - pz);
    px = nx;
    pz = nz;
  }
  return (len / speed) * 1000;
}

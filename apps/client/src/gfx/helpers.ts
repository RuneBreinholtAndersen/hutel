import * as THREE from 'three';

export { THREE as T };

/** Hex colours are authored in sRGB; three r128 needs them in linear space. */
export const lin = (c: number) => new THREE.Color(c).convertSRGBToLinear();

export function M(c: number, o: THREE.MeshStandardMaterialParameters & { emissive?: number } = {}) {
  const opts: THREE.MeshStandardMaterialParameters = {
    roughness: 0.78,
    metalness: 0,
    ...o,
    color: lin(c),
  };
  if (o.emissive !== undefined) opts.emissive = lin(o.emissive as number);
  return new THREE.MeshStandardMaterial(opts);
}

export function shade<T extends THREE.Object3D>(m: T, cast = true): T {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return shade(m);
}

export function cyl(
  rt: number,
  rb: number,
  h: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  seg = 22,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return shade(m);
}

export function sph(r: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat);
  m.position.set(x, y, z);
  return shade(m);
}

const RBC: Record<string, THREE.BufferGeometry> = {};
function rbGeo(w: number, h: number, d: number, r: number) {
  r = Math.max(0.004, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const k = [w, h, d, r].map((v) => v.toFixed(3)).join();
  if (RBC[k]) return RBC[k];
  const sh = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const ww = w - 2 * r;
  const hh = h - 2 * r;
  sh.moveTo(x, y);
  sh.lineTo(x + ww, y);
  sh.lineTo(x + ww, y + hh);
  sh.lineTo(x, y + hh);
  sh.lineTo(x, y);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.001, d - 2 * r),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: 4,
  });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  return (RBC[k] = g);
}

/** Box with rounded edges – gives furniture its soft, toy-like look. */
export function rbox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  r?: number,
) {
  const m = new THREE.Mesh(rbGeo(w, h, d, r ?? Math.min(0.07, w * 0.25, h * 0.25, d * 0.25)), mat);
  m.position.set(x, y, z);
  return shade(m);
}

export function canvasTex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

export function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <V>(a: readonly V[]) => a[Math.floor(Math.random() * a.length)];

/** Current room size in tiles. Changes when you walk into a room of another size. */
export let N = 8;
export function setRoomSizeN(n: number) {
  N = n;
}
/** Tile index → world coordinate (tile centre). */
export const tw = (v: number) => v - N / 2 + 0.5;

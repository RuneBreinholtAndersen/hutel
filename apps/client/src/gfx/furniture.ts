import { furniture, type FurnitureType } from '@hutel/shared';
import { cyl, M, pick, rbox, rnd, shade, sph, T } from './helpers';

const wood = M(0x8a5634, { roughness: 0.6 });
const woodDark = M(0x5e3820, { roughness: 0.6 });
const gold = M(0xe0b04a, { metalness: 0.6, roughness: 0.35 });
const legs = (g: T.Group, xs: number, zs: number) => {
  for (const [x, z] of [
    [-xs, -zs],
    [xs, -zs],
    [-xs, zs],
    [xs, zs],
  ])
    g.add(cyl(0.04, 0.03, 0.15, woodDark, x, 0.075, z));
};

/** Lighter shade of a colour, for cushions. */
const lighter = (c: number, k = 0.18) => {
  const r = (c >> 16) & 255,
    g = (c >> 8) & 255,
    b = c & 255;
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * k));
  return (f(r) << 16) | (f(g) << 8) | f(b);
};

const BUILD: Record<FurnitureType, (c: number) => T.Group> = {
  plant() {
    const g = new T.Group();
    g.add(cyl(0.2, 0.15, 0.32, M(0xc0643b), 0, 0.16, 0));
    g.add(cyl(0.18, 0.18, 0.02, M(0x4a3020), 0, 0.32, 0));
    const l1 = M(0x4f8f3a);
    const l2 = M(0x6aa84f);
    for (const [x, y, z, r, m] of [
      [0, 0.62, 0, 0.2, l1],
      [0.12, 0.5, 0.08, 0.15, l2],
      [-0.12, 0.52, -0.05, 0.16, l2],
      [0.05, 0.78, -0.06, 0.14, l2],
      [-0.08, 0.72, 0.1, 0.13, l1],
      [0.1, 0.68, -0.12, 0.12, l1],
    ] as const)
      g.add(sph(r, m, x, y, z));
    return g;
  },
  lamp() {
    const g = new T.Group();
    g.add(cyl(0.18, 0.2, 0.05, woodDark, 0, 0.025, 0));
    g.add(cyl(0.025, 0.025, 1.35, gold, 0, 0.72, 0));
    const sh = new T.Mesh(
      new T.CylinderGeometry(0.16, 0.3, 0.34, 26, 1, true),
      M(0xf6d9a8, { emissive: 0xffaa55, emissiveIntensity: 1.3, side: T.DoubleSide }),
    );
    sh.position.y = 1.47;
    g.add(shade(sh));
    const bulb = new T.Mesh(
      new T.SphereGeometry(0.07, 14, 10),
      new T.MeshBasicMaterial({ color: 0xfff1c9 }),
    );
    bulb.position.y = 1.4;
    g.add(bulb);
    const pl = new T.PointLight(0xffaa55, 1.0, 5.5, 2);
    pl.position.y = 1.3;
    g.add(pl);
    return g;
  },
  rug(main) {
    const g = new T.Group();
    for (const [s, c, y] of [
      [1.8, main, 0.01],
      [1.5, 0xd8a35a, 0.012],
      [1.2, main, 0.014],
      [0.5, 0xe9c98a, 0.016],
    ] as const)
      g.add(shade(rbox(s, 0.02 + y, s, M(c, { roughness: 1 }), 0, y, 0), false));
    return g;
  },
  table() {
    const g = new T.Group();
    g.add(cyl(0.4, 0.4, 0.06, wood, 0, 0.44, 0, 30));
    g.add(cyl(0.05, 0.06, 0.4, woodDark, 0, 0.22, 0));
    g.add(cyl(0.22, 0.24, 0.04, woodDark, 0, 0.02, 0));
    g.add(cyl(0.05, 0.045, 0.09, M(0xf4efe6), 0.14, 0.515, 0.06));
    g.add(rbox(0.24, 0.04, 0.17, M(0x2f6b8f), -0.1, 0.49, -0.05));
    return g;
  },
  stool(c) {
    const g = new T.Group();
    g.add(cyl(0.24, 0.24, 0.08, M(c), 0, 0.55, 0, 24));
    g.add(cyl(0.04, 0.05, 0.5, gold, 0, 0.27, 0));
    g.add(cyl(0.18, 0.2, 0.04, woodDark, 0, 0.02, 0));
    return g;
  },
  armchair(c) {
    const g = new T.Group();
    const f = M(c);
    g.add(rbox(0.9, 0.3, 0.86, f, 0, 0.3, 0));
    g.add(rbox(0.9, 0.58, 0.22, f, 0, 0.62, -0.32));
    g.add(rbox(0.18, 0.44, 0.86, f, -0.36, 0.43, 0));
    g.add(rbox(0.18, 0.44, 0.86, f, 0.36, 0.43, 0));
    g.add(rbox(0.56, 0.12, 0.62, M(lighter(c)), 0, 0.51, 0.07));
    legs(g, 0.38, 0.35);
    return g;
  },
  shelf() {
    const g = new T.Group();
    g.add(rbox(0.06, 1.65, 0.4, wood, -0.93, 0.825, -0.28));
    g.add(rbox(0.06, 1.65, 0.4, wood, 0.93, 0.825, -0.28));
    g.add(rbox(1.9, 1.65, 0.03, woodDark, 0, 0.825, -0.47));
    for (const y of [0.05, 0.58, 1.1, 1.63]) g.add(rbox(1.9, 0.05, 0.4, wood, 0, y, -0.28));
    const cols = [0x2f6b8f, 0xc94f3d, 0xe0a93b, 0x5b8f4a, 0x6f4a8f, 0xf0e6d2, 0x8a3b2a];
    for (const y of [0.075, 0.605, 1.125]) {
      let x = -0.86;
      while (x < 0.8) {
        const bw = rnd(0.07, 0.14);
        const bh = rnd(0.3, 0.42);
        if (Math.random() < 0.12) {
          x += 0.15;
          continue;
        }
        g.add(rbox(bw, bh, 0.28, M(pick(cols)), x + bw / 2, y + 0.025 + bh / 2, -0.3));
        x += bw + 0.01;
      }
    }
    return g;
  },
  aquarium() {
    const g = new T.Group();
    g.add(rbox(0.86, 0.5, 0.6, woodDark, 0, 0.25, 0));
    g.add(rbox(0.8, 0.06, 0.54, M(0xd9c08a), 0, 0.53, 0));
    const tank = new T.Mesh(
      new T.BoxGeometry(0.82, 0.55, 0.56),
      new T.MeshStandardMaterial({
        color: 0x8fdcff,
        transparent: true,
        opacity: 0.42,
        emissive: 0x2a9fd6,
        emissiveIntensity: 0.45,
        roughness: 0.1,
      }),
    );
    tank.position.y = 0.78;
    g.add(tank);
    const f1 = sph(
      0.05,
      M(0xff8c3a, { emissive: 0x7a3000, emissiveIntensity: 0.3 }),
      -0.15,
      0.8,
      0.05,
    );
    f1.scale.set(1.6, 1, 0.7);
    const f2 = sph(0.04, M(0xffd24a), 0.15, 0.68, -0.08);
    f2.scale.set(1.6, 1, 0.7);
    g.add(f1, f2, sph(0.07, M(0x4f8f3a), 0.25, 0.62, -0.12));
    g.userData.fish = [f1, f2];
    return g;
  },
  sofa(c) {
    const g = new T.Group();
    const f = M(c);
    const f2 = M(lighter(c, 0.12));
    g.add(rbox(1.9, 0.3, 0.86, f, 0, 0.3, 0));
    g.add(rbox(1.9, 0.58, 0.22, f, 0, 0.62, -0.32));
    g.add(rbox(0.22, 0.46, 0.86, f, -0.84, 0.43, 0));
    g.add(rbox(0.22, 0.46, 0.86, f, 0.84, 0.43, 0));
    g.add(rbox(0.72, 0.12, 0.62, f2, -0.37, 0.51, 0.07));
    g.add(rbox(0.72, 0.12, 0.62, f2, 0.37, 0.51, 0.07));
    const p = rbox(0.42, 0.34, 0.12, M(0xe7c27a), -0.5, 0.74, -0.16);
    p.rotation.x = -0.2;
    g.add(p);
    legs(g, 0.85, 0.35);
    return g;
  },
  bed(c) {
    const g = new T.Group();
    g.add(rbox(1.8, 0.3, 1.9, wood, 0, 0.2, 0));
    g.add(rbox(1.7, 0.18, 1.8, M(0xf3efe6), 0, 0.44, 0.02));
    g.add(rbox(1.76, 0.09, 1.2, M(c), 0, 0.56, 0.33));
    g.add(rbox(1.76, 0.1, 0.18, M(lighter(c, -0.0)), 0, 0.57, -0.26));
    g.add(rbox(0.62, 0.13, 0.36, M(0xffffff), -0.42, 0.6, -0.62));
    g.add(rbox(0.62, 0.13, 0.36, M(0xffffff), 0.42, 0.6, -0.62));
    g.add(rbox(1.9, 0.95, 0.1, woodDark, 0, 0.55, -0.92));
    return g;
  },
  cactus() {
    const g = new T.Group();
    g.add(cyl(0.17, 0.13, 0.26, M(0xd9a066), 0, 0.13, 0));
    g.add(cyl(0.15, 0.15, 0.02, M(0x8a6a48), 0, 0.26, 0));
    const green = M(0x4f8f3a, { roughness: 0.9 });
    const body = cyl(0.09, 0.1, 0.5, green, 0, 0.5, 0, 16);
    g.add(body, sph(0.09, green, 0, 0.75, 0));
    const arm = cyl(0.05, 0.05, 0.18, green, 0.13, 0.55, 0, 12);
    g.add(arm, sph(0.05, green, 0.13, 0.64, 0), cyl(0.04, 0.04, 0.1, green, 0.08, 0.48, 0, 10));
    g.add(sph(0.035, M(0xff7aa8), 0, 0.85, 0));
    return g;
  },
  chair(c) {
    const g = new T.Group();
    g.add(rbox(0.5, 0.06, 0.5, wood, 0, 0.45, 0));
    g.add(rbox(0.46, 0.06, 0.46, M(c), 0, 0.5, 0));
    g.add(rbox(0.5, 0.5, 0.06, wood, 0, 0.72, -0.22));
    for (const [x, z] of [
      [-0.21, -0.21],
      [0.21, -0.21],
      [-0.21, 0.21],
      [0.21, 0.21],
    ] as const)
      g.add(cyl(0.025, 0.025, 0.45, woodDark, x, 0.225, z, 8));
    return g;
  },
  beanbag(c) {
    const g = new T.Group();
    const m = M(c, { roughness: 0.95 });
    const base = sph(0.42, m, 0, 0.26, 0.02);
    base.scale.set(1, 0.62, 1);
    const back = sph(0.3, m, 0, 0.5, -0.2);
    back.scale.set(1.15, 0.9, 0.7);
    g.add(base, back);
    return g;
  },
  tv() {
    const g = new T.Group();
    g.add(rbox(1.7, 0.42, 0.5, woodDark, 0, 0.21, -0.12));
    g.add(rbox(1.5, 0.86, 0.06, M(0x1c1c22, { roughness: 0.3 }), 0, 0.95, -0.2));
    const screen = new T.Mesh(
      new T.PlaneGeometry(1.4, 0.76),
      M(0x5fb0d8, { emissive: 0x3a8fd0, emissiveIntensity: 0.9, roughness: 0.2 }),
    );
    screen.position.set(0, 0.95, -0.165);
    g.add(screen);
    g.add(cyl(0.06, 0.08, 0.1, M(0x1c1c22), 0, 0.47, -0.2));
    return g;
  },
  fireplace() {
    const g = new T.Group();
    const brick = M(0xa9573a, { roughness: 0.95 });
    g.add(rbox(1.9, 1.15, 0.5, brick, 0, 0.575, -0.22));
    g.add(rbox(2.05, 0.1, 0.62, M(0xe8dcc6), 0, 1.2, -0.2));
    g.add(rbox(1.0, 0.62, 0.3, M(0x2a1a14), 0, 0.38, -0.08));
    const fire = new T.Mesh(
      new T.ConeGeometry(0.22, 0.42, 14),
      new T.MeshBasicMaterial({ color: 0xffa040 }),
    );
    fire.position.set(0, 0.3, 0);
    const fire2 = new T.Mesh(
      new T.ConeGeometry(0.12, 0.3, 12),
      new T.MeshBasicMaterial({ color: 0xffe08a }),
    );
    fire2.position.set(0.08, 0.26, 0.04);
    g.add(fire, fire2, rbox(0.6, 0.08, 0.14, woodDark, 0, 0.1, 0));
    const pl = new T.PointLight(0xff8a3a, 1.2, 4.5, 2);
    pl.position.set(0, 0.5, 0.3);
    g.add(pl);
    g.add(
      cyl(0.06, 0.06, 0.2, gold, -0.7, 1.35, -0.2),
      cyl(0.06, 0.06, 0.2, gold, 0.7, 1.35, -0.2),
    );
    g.userData.flame = [fire, fire2];
    return g;
  },
  piano(c) {
    const g = new T.Group();
    const body = M(c, { roughness: 0.3, metalness: 0.1 });
    g.add(rbox(1.8, 1.15, 0.5, body, 0, 0.575, -0.2));
    g.add(rbox(1.8, 0.12, 0.42, body, 0, 0.72, 0.18));
    g.add(rbox(1.6, 0.04, 0.2, M(0xf6f3ea), 0, 0.79, 0.2));
    for (let i = 0; i < 11; i++)
      g.add(rbox(0.05, 0.03, 0.11, M(0x1c1c22), -0.72 + i * 0.145, 0.82, 0.15));
    g.add(
      rbox(0.06, 0.66, 0.06, body, -0.82, 0.33, 0.33),
      rbox(0.06, 0.66, 0.06, body, 0.82, 0.33, 0.33),
    );
    g.add(rbox(0.36, 0.26, 0.04, M(0xf6f3ea), 0, 1.0, 0.07));
    return g;
  },
  jukebox() {
    const g = new T.Group();
    g.add(rbox(0.8, 1.2, 0.55, M(0x8a3b2a, { roughness: 0.4 }), 0, 0.6, -0.05));
    const top = cyl(0.4, 0.4, 0.55, M(0x8a3b2a, { roughness: 0.4 }), 0, 1.2, -0.05, 24);
    top.rotation.x = Math.PI / 2;
    g.add(top);
    const glow = M(0xffc35a, { emissive: 0xff9a2a, emissiveIntensity: 1.2 });
    g.add(rbox(0.62, 0.4, 0.04, glow, 0, 1.05, 0.23));
    g.add(
      rbox(
        0.5,
        0.3,
        0.04,
        M(0x5fb0d8, { emissive: 0x3a8fd0, emissiveIntensity: 0.8 }),
        0,
        0.55,
        0.23,
      ),
    );
    g.add(
      rbox(0.05, 1.1, 0.05, gold, -0.36, 0.6, 0.23),
      rbox(0.05, 1.1, 0.05, gold, 0.36, 0.6, 0.23),
    );
    const pl = new T.PointLight(0xffb060, 0.7, 3.5, 2);
    pl.position.set(0, 1.0, 0.5);
    g.add(pl);
    return g;
  },
  lounger(c) {
    const g = new T.Group();
    const frame = M(0xe8e2d6, { roughness: 0.5 });
    g.add(rbox(0.7, 0.08, 1.6, frame, 0, 0.3, 0.1));
    g.add(rbox(0.62, 0.08, 1.1, M(c), 0, 0.37, 0.32));
    const back = rbox(0.62, 0.08, 0.6, M(c), 0, 0.55, -0.45);
    back.rotation.x = 0.7;
    g.add(back);
    for (const [x, z] of [
      [-0.3, -0.55],
      [0.3, -0.55],
      [-0.3, 0.75],
      [0.3, 0.75],
    ] as const)
      g.add(cyl(0.025, 0.025, 0.3, frame, x, 0.15, z, 8));
    g.add(rbox(0.3, 0.05, 0.12, M(0xf6f3ea), 0, 0.42, 0.8));
    return g;
  },
  pool() {
    const g = new T.Group();
    const tile = M(0xe8f2f4, { roughness: 0.4 });
    g.add(
      rbox(2.96, 0.14, 0.12, tile, 0, 0.07, -0.94),
      rbox(2.96, 0.14, 0.12, tile, 0, 0.07, 0.94),
    );
    g.add(
      rbox(0.12, 0.14, 1.96, tile, -1.42, 0.07, 0),
      rbox(0.12, 0.14, 1.96, tile, 1.42, 0.07, 0),
    );
    const water = new T.Mesh(
      new T.BoxGeometry(2.74, 0.06, 1.76),
      new T.MeshStandardMaterial({
        color: 0x3fb7e0,
        emissive: 0x1f8fc0,
        emissiveIntensity: 0.55,
        roughness: 0.1,
        transparent: true,
        opacity: 0.85,
      }),
    );
    water.position.y = 0.08;
    g.add(water);
    const steel = M(0xd0d4d8, { metalness: 0.8, roughness: 0.25 });
    for (const x of [1.05, 1.25]) {
      const rail = cyl(0.02, 0.02, 0.5, steel, x, 0.3, -0.92, 8);
      g.add(rail);
    }
    const ring = new T.Mesh(new T.TorusGeometry(0.18, 0.06, 10, 20), M(0xff6a4a));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-0.6, 0.21, 0.3);
    g.add(ring);
    g.userData.water = water;
    return g;
  },
  arcade() {
    const g = new T.Group();
    const body = M(0x3a2a6a, { roughness: 0.5 });
    g.add(rbox(0.7, 1.5, 0.6, body, 0, 0.75, -0.05));
    const screen = new T.Mesh(
      new T.PlaneGeometry(0.5, 0.42),
      M(0x52e0a0, { emissive: 0x2acf80, emissiveIntensity: 1.1 }),
    );
    screen.position.set(0, 1.12, 0.26);
    screen.rotation.x = -0.25;
    g.add(screen);
    g.add(rbox(0.66, 0.1, 0.3, M(0x22184a), 0, 0.82, 0.32));
    g.add(
      cyl(0.02, 0.02, 0.1, M(0x222222), -0.15, 0.92, 0.33, 8),
      sph(0.04, M(0xe04a4a), -0.15, 0.98, 0.33),
    );
    g.add(sph(0.035, M(0xffd24a), 0.08, 0.89, 0.36), sph(0.035, M(0x4ab0ff), 0.18, 0.89, 0.32));
    g.add(
      rbox(
        0.7,
        0.16,
        0.06,
        M(0xff5ab0, { emissive: 0xff2a90, emissiveIntensity: 1.2 }),
        0,
        1.45,
        0.26,
      ),
    );
    return g;
  },
  desk() {
    const g = new T.Group();
    g.add(rbox(2.8, 1.0, 0.7, wood, 0, 0.5, 0));
    g.add(rbox(2.95, 0.08, 0.86, M(0xeee3cf, { roughness: 0.35 }), 0, 1.04, 0));
    g.add(rbox(2.6, 0.06, 0.03, gold, 0, 0.82, 0.36, 0.01));
    g.add(rbox(2.6, 0.06, 0.03, gold, 0, 0.25, 0.36, 0.01));
    g.add(cyl(0.07, 0.09, 0.06, gold, 0.9, 1.11, 0.15), sph(0.06, gold, 0.9, 1.15, 0.15));
    g.add(rbox(0.4, 0.03, 0.3, M(0xf4efe6), -0.6, 1.095, 0.1, 0.01));
    return g;
  },
  counter() {
    const g = new T.Group();
    g.add(rbox(2.8, 0.95, 0.7, M(0x6e3f2a), 0, 0.475, 0));
    g.add(rbox(2.95, 0.08, 0.86, M(0x2f5d5a, { roughness: 0.35 }), 0, 0.99, 0));
    const glass = new T.Mesh(
      new T.BoxGeometry(0.9, 0.35, 0.5),
      new T.MeshStandardMaterial({
        color: 0xcfefff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
      }),
    );
    glass.position.set(0.7, 1.21, 0);
    g.add(glass);
    for (const [x, c] of [
      [0.45, 0xe9a35b],
      [0.7, 0xf2d0a0],
      [0.95, 0xc96a3d],
    ] as const)
      g.add(cyl(0.09, 0.1, 0.08, M(c), x, 1.08, 0));
    g.add(rbox(0.3, 0.4, 0.3, M(0x2a2a35, { metalness: 0.5, roughness: 0.4 }), -0.8, 1.23, -0.05));
    g.add(cyl(0.05, 0.045, 0.09, M(0xf4efe6), -0.5, 1.08, 0.15));
    return g;
  },
};

export function buildFurniture(type: FurnitureType, itemId: number, color = 0): T.Group {
  const colors = furniture(type).colors;
  const g = BUILD[type](colors?.[color] ?? colors?.[0] ?? 0xffffff);
  const walk = type === 'rug';
  g.traverse((m) => {
    m.userData.itemId = itemId;
    if (walk) m.castShadow = false;
  });
  return g;
}

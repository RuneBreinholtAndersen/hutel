import { furniture, type FurnitureType } from '@hutel/shared';
import { canvasTex, cyl, M, pick, rbox, rnd, shade, sph, T } from './helpers';

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

/** Gold/black/white frame with a picture, hanging at eye height. */
function framed(w: number, h: number, c: number, tex: T.Texture) {
  const g = new T.Group();
  g.add(
    rbox(w + 0.12, h + 0.12, 0.05, M(c, { metalness: 0.3, roughness: 0.45 }), 0, 1.8, 0.025, 0.02),
  );
  const p = new T.Mesh(new T.PlaneGeometry(w, h), M(0xffffff, { map: tex, roughness: 0.85 }));
  p.position.set(0, 1.8, 0.055);
  g.add(p);
  return g;
}

/** Simple generated artworks (never copied images). */
function art(kind: number) {
  return canvasTex(160, 100, (g, w, h) => {
    if (kind === 1) {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#ffb35c');
      sky.addColorStop(1, '#f1d6cf');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe08a';
      g.beginPath();
      g.arc(w * 0.7, h * 0.45, 12, 0, 7);
      g.fill();
      g.fillStyle = '#5b8f4a';
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) g.lineTo(x, h * 0.65 - Math.sin(x * 0.05) * 10);
      g.lineTo(w, h);
      g.fill();
      g.fillStyle = '#3d6a35';
      g.fillRect(0, h * 0.85, w, h);
      return;
    }
    const cols = ['#e0564a', '#3f7f86', '#e0a93b', '#6f4a8f', '#f4efe6'];
    g.fillStyle = '#2a2a35';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = pick(cols)!;
      g.beginPath();
      g.arc(rnd(10, w - 10), rnd(10, h - 10), rnd(8, 26), 0, 7);
      g.fill();
    }
  });
}

let skyCache: T.Texture | null = null;
function sky() {
  return (skyCache ??= canvasTex(128, 96, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3a2a5a');
    gr.addColorStop(0.6, '#ff9a5c');
    gr.addColorStop(1, '#ffd08a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a2f3a';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.8 - (x % 24 < 12 ? 10 : 2));
    g.lineTo(w, h);
    g.fill();
  }));
}

const BUILD: Record<FurnitureType, (c: number, state: number) => T.Group> = {
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
  lamp(_c, on) {
    const g = new T.Group();
    g.add(cyl(0.18, 0.2, 0.05, woodDark, 0, 0.025, 0));
    g.add(cyl(0.025, 0.025, 1.35, gold, 0, 0.72, 0));
    const sh = new T.Mesh(
      new T.CylinderGeometry(0.16, 0.3, 0.34, 26, 1, true),
      M(0xf6d9a8, {
        emissive: 0xffaa55,
        emissiveIntensity: on ? 1.3 : 0,
        side: T.DoubleSide,
      }),
    );
    sh.position.y = 1.47;
    g.add(shade(sh));
    const bulb = new T.Mesh(
      new T.SphereGeometry(0.07, 14, 10),
      new T.MeshBasicMaterial({ color: on ? 0xfff1c9 : 0x8a8478 }),
    );
    bulb.position.y = 1.4;
    g.add(bulb);
    if (on) {
      const pl = new T.PointLight(0xffaa55, 1.0, 5.5, 2);
      pl.position.y = 1.3;
      g.add(pl);
    }
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
  tv(_c, channel) {
    const g = new T.Group();
    g.add(rbox(1.7, 0.42, 0.5, woodDark, 0, 0.21, -0.12));
    g.add(rbox(1.5, 0.86, 0.06, M(0x1c1c22, { roughness: 0.3 }), 0, 0.95, -0.2));
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 140;
    const tex = new T.CanvasTexture(canvas);
    tex.encoding = T.sRGBEncoding;
    const screen = new T.Mesh(
      new T.PlaneGeometry(1.4, 0.76),
      channel
        ? new T.MeshBasicMaterial({ map: tex, toneMapped: false })
        : M(0x15171c, { roughness: 0.15, metalness: 0.3 }),
    );
    screen.position.set(0, 0.95, -0.165);
    g.add(screen);
    g.add(cyl(0.06, 0.08, 0.1, M(0x1c1c22), 0, 0.47, -0.2));
    g.add(
      sph(
        0.018,
        M(channel ? 0x4fd16b : 0xd8433a, { emissive: channel ? 0x4fd16b : 0x5a1010 }),
        0.68,
        0.56,
        -0.165,
      ),
    );
    if (channel) {
      const pl = new T.PointLight(0x9ad0ff, 0.5, 3.5, 2);
      pl.position.set(0, 0.95, 0.4);
      g.add(pl);
      g.userData.tv = { canvas, tex, channel };
    }
    return g;
  },
  fireplace(_c, on) {
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
    g.add(rbox(0.6, 0.08, 0.14, woodDark, 0, 0.1, 0));
    if (on) {
      g.add(fire, fire2);
      const pl = new T.PointLight(0xff8a3a, 1.2, 4.5, 2);
      pl.position.set(0, 0.5, 0.3);
      g.add(pl);
    }
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
  jukebox(_c, on) {
    const g = new T.Group();
    g.add(rbox(0.8, 1.2, 0.55, M(0x8a3b2a, { roughness: 0.4 }), 0, 0.6, -0.05));
    const top = cyl(0.4, 0.4, 0.55, M(0x8a3b2a, { roughness: 0.4 }), 0, 1.2, -0.05, 24);
    top.rotation.x = Math.PI / 2;
    g.add(top);
    const glow = M(0xffc35a, { emissive: 0xff9a2a, emissiveIntensity: on ? 1.2 : 0.05 });
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
    if (on) {
      const pl = new T.PointLight(0xffb060, 0.7, 3.5, 2);
      pl.position.set(0, 1.0, 0.5);
      g.add(pl);
      g.userData.music = true;
    }
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
  nightstand(_c, on) {
    const g = new T.Group();
    g.add(rbox(0.6, 0.5, 0.5, wood, 0, 0.25, -0.1));
    g.add(rbox(0.5, 0.04, 0.03, woodDark, 0, 0.32, 0.16));
    g.add(sph(0.025, gold, 0, 0.26, 0.17));
    g.add(cyl(0.08, 0.1, 0.06, gold, 0.1, 0.53, -0.12));
    g.add(cyl(0.015, 0.015, 0.22, gold, 0.1, 0.65, -0.12, 8));
    const sh = new T.Mesh(
      new T.CylinderGeometry(0.08, 0.14, 0.16, 18, 1, true),
      M(0xf6d9a8, { emissive: 0xffaa55, emissiveIntensity: on ? 1.2 : 0, side: T.DoubleSide }),
    );
    sh.position.set(0.1, 0.8, -0.12);
    g.add(shade(sh));
    if (on) {
      const pl = new T.PointLight(0xffaa55, 0.6, 3.5, 2);
      pl.position.set(0.1, 0.75, 0);
      g.add(pl);
    }
    g.add(rbox(0.16, 0.05, 0.12, M(0x8a3b2a), -0.15, 0.53, -0.05));
    return g;
  },
  bathtub(c) {
    const g = new T.Group();
    const m = M(c, { roughness: 0.25 });
    g.add(rbox(1.85, 0.5, 0.85, m, 0, 0.3, 0));
    const water = new T.Mesh(
      new T.BoxGeometry(1.6, 0.04, 0.62),
      M(0x8fd0e8, { emissive: 0x2a8fb8, emissiveIntensity: 0.2, roughness: 0.05 }),
    );
    water.position.y = 0.5;
    g.add(water);
    for (let i = 0; i < 5; i++)
      g.add(
        sph(0.08, M(0xffffff, { roughness: 0.9 }), -0.4 + i * 0.18, 0.54, (i % 2) * 0.12 - 0.05),
      );
    const steel = M(0xd0d4d8, { metalness: 0.8, roughness: 0.25 });
    g.add(cyl(0.03, 0.03, 0.25, steel, 0.8, 0.65, -0.3, 8));
    const spout = cyl(0.025, 0.025, 0.18, steel, 0.74, 0.76, -0.3, 8);
    spout.rotation.z = Math.PI / 2;
    g.add(spout);
    for (const x of [-0.8, 0.8]) for (const z of [-0.32, 0.32]) g.add(sph(0.06, gold, x, 0.05, z));
    return g;
  },
  sink() {
    const g = new T.Group();
    const white = M(0xf4f1ea, { roughness: 0.3 });
    g.add(cyl(0.08, 0.12, 0.7, white, 0, 0.35, -0.1));
    const bowl = cyl(0.3, 0.22, 0.16, white, 0, 0.78, -0.05, 24);
    g.add(bowl, cyl(0.25, 0.25, 0.02, M(0x8fd0e8, { roughness: 0.1 }), 0, 0.86, -0.05, 20));
    const steel = M(0xd0d4d8, { metalness: 0.8, roughness: 0.25 });
    g.add(cyl(0.02, 0.02, 0.2, steel, 0, 0.95, -0.3, 8));
    g.add(rbox(0.7, 0.9, 0.04, M(0xbfe6f2, { metalness: 0.6, roughness: 0.05 }), 0, 1.55, -0.45));
    return g;
  },
  kitchen(c) {
    const g = new T.Group();
    const front = M(c, { roughness: 0.5 });
    g.add(rbox(1.9, 0.85, 0.6, front, 0, 0.425, -0.15));
    g.add(rbox(1.96, 0.06, 0.66, M(0x3a3a40, { roughness: 0.3 }), 0, 0.88, -0.15));
    for (const x of [-0.5, 0.5]) g.add(rbox(0.6, 0.03, 0.02, gold, x, 0.7, 0.16));
    // hob
    for (const [x, z] of [
      [0.45, -0.25],
      [0.7, -0.25],
      [0.45, -0.02],
      [0.7, -0.02],
    ] as const)
      g.add(cyl(0.08, 0.08, 0.01, M(0x111111), x, 0.915, z, 16));
    // sink
    g.add(
      rbox(0.45, 0.02, 0.35, M(0xd0d4d8, { metalness: 0.8, roughness: 0.25 }), -0.45, 0.915, -0.15),
    );
    g.add(cyl(0.12, 0.1, 0.12, M(0xc94f3d), 0.6, 0.98, -0.15));
    return g;
  },
  fridge(c) {
    const g = new T.Group();
    const m = M(c, { roughness: 0.3 });
    g.add(rbox(0.75, 1.85, 0.65, m, 0, 0.925, -0.1));
    g.add(rbox(0.72, 0.02, 0.02, M(0x9aa0a6), 0, 1.25, 0.23));
    const steel = M(0xd0d4d8, { metalness: 0.8, roughness: 0.25 });
    g.add(
      rbox(0.04, 0.3, 0.04, steel, 0.28, 1.5, 0.25),
      rbox(0.04, 0.4, 0.04, steel, 0.28, 0.85, 0.25),
    );
    g.add(
      rbox(0.12, 0.12, 0.01, M(0xffd24a), -0.15, 1.5, 0.235),
      rbox(0.1, 0.14, 0.01, M(0x5ab0ff), 0.05, 1.45, 0.235),
    );
    return g;
  },
  grill(_c, on) {
    const g = new T.Group();
    const black = M(0x22222a, { roughness: 0.4, metalness: 0.3 });
    g.add(cyl(0.32, 0.22, 0.32, black, 0, 0.78, 0, 24));
    for (const a of [0, 2.1, 4.2]) {
      const leg = cyl(0.025, 0.025, 0.65, black, Math.sin(a) * 0.2, 0.33, Math.cos(a) * 0.2, 8);
      g.add(leg);
    }
    g.add(cyl(0.3, 0.3, 0.02, M(0x9aa0a6, { metalness: 0.8 }), 0, 0.95, 0, 20));
    if (on) {
      g.add(
        cyl(
          0.27,
          0.27,
          0.02,
          M(0xff5a1a, { emissive: 0xff4a0a, emissiveIntensity: 1.5 }),
          0,
          0.93,
          0,
          20,
        ),
      );
      for (const [x, z] of [
        [-0.1, 0],
        [0.1, 0.05],
      ] as const) {
        const s = rbox(0.16, 0.05, 0.07, M(0x8a3b2a), x, 0.99, z);
        g.add(s);
      }
      const pl = new T.PointLight(0xff7a3a, 0.8, 3, 2);
      pl.position.set(0, 1.2, 0);
      g.add(pl);
    }
    return g;
  },
  // ---- Wall items: built facing +z with their back on the wall (z = 0) ----
  painting(c) {
    return framed(0.8, 0.62, c, art(0));
  },
  bigpainting(c) {
    return framed(1.7, 0.95, c, art(1));
  },
  poster(c) {
    const g = new T.Group();
    const hex = '#' + c.toString(16).padStart(6, '0');
    const tex = canvasTex(96, 128, (x, w, h) => {
      x.fillStyle = hex;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.85)';
      x.beginPath();
      x.arc(w / 2, h * 0.42, w * 0.26, 0, 7);
      x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.fillRect(w * 0.15, h * 0.78, w * 0.7, 8);
      x.fillRect(w * 0.25, h * 0.86, w * 0.5, 6);
    });
    const p = new T.Mesh(new T.PlaneGeometry(0.6, 0.82), M(0xffffff, { map: tex, roughness: 0.9 }));
    p.position.set(0, 1.75, 0.02);
    g.add(p);
    for (const [x, y] of [
      [-0.26, 2.12],
      [0.26, 2.12],
    ] as const)
      g.add(sph(0.025, M(0xd8433a), x, y, 0.03));
    return g;
  },
  window(c) {
    const g = new T.Group();
    const wy = 1.8,
      ww = 1.6,
      wh = 1.2;
    const glass = new T.Mesh(new T.PlaneGeometry(ww, wh), new T.MeshBasicMaterial({ map: sky() }));
    glass.position.set(0, wy, 0.01);
    g.add(glass);
    const fr = M(0xf4efe6, { roughness: 0.6 });
    g.add(rbox(ww + 0.16, 0.08, 0.1, fr, 0, wy + wh / 2 + 0.04, 0.05, 0.02));
    g.add(rbox(ww + 0.16, 0.08, 0.1, fr, 0, wy - wh / 2 - 0.04, 0.05, 0.02));
    g.add(rbox(0.08, wh, 0.1, fr, -ww / 2 - 0.04, wy, 0.05, 0.02));
    g.add(rbox(0.08, wh, 0.1, fr, ww / 2 + 0.04, wy, 0.05, 0.02));
    g.add(rbox(0.05, wh, 0.05, fr, 0, wy, 0.03, 0.015));
    g.add(rbox(ww + 0.35, 0.06, 0.26, fr, 0, wy - wh / 2 - 0.11, 0.13, 0.02));
    const cur = M(c, { roughness: 0.9 });
    g.add(rbox(0.32, wh + 0.6, 0.1, cur, -ww / 2 - 0.2, wy - 0.05, 0.12, 0.04));
    g.add(rbox(0.32, wh + 0.6, 0.1, cur, ww / 2 + 0.2, wy - 0.05, 0.12, 0.04));
    g.add(cyl(0.02, 0.02, ww + 1.0, gold, 0, wy + wh / 2 + 0.3, 0.16).rotateZ(Math.PI / 2));
    return g;
  },
  wallshelf(c) {
    const g = new T.Group();
    const m = M(c, { roughness: 0.6 });
    g.add(rbox(0.86, 0.05, 0.26, m, 0, 1.55, 0.13, 0.015));
    for (const x of [-0.32, 0.32]) g.add(rbox(0.04, 0.16, 0.2, m, x, 1.47, 0.1, 0.01));
    g.add(cyl(0.07, 0.055, 0.12, M(0xc0643b), -0.22, 1.64, 0.13));
    g.add(sph(0.09, M(0x5b9a45), -0.22, 1.76, 0.13));
    for (const [x, h, col] of [
      [0.08, 0.22, 0x2f4a7a],
      [0.15, 0.19, 0xc94f3d],
      [0.22, 0.24, 0xe0a93b],
    ] as const)
      g.add(rbox(0.06, h, 0.16, M(col), x, 1.575 + h / 2, 0.12, 0.01));
    return g;
  },
  clock() {
    const g = new T.Group();
    const face = canvasTex(128, 128, (x, w) => {
      x.fillStyle = '#f7f0e2';
      x.beginPath();
      x.arc(w / 2, w / 2, w / 2, 0, 7);
      x.fill();
      x.strokeStyle = '#3a2616';
      x.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        x.lineWidth = i % 3 ? 3 : 6;
        x.beginPath();
        x.moveTo(w / 2 + Math.sin(a) * 50, w / 2 - Math.cos(a) * 50);
        x.lineTo(w / 2 + Math.sin(a) * 58, w / 2 - Math.cos(a) * 58);
        x.stroke();
      }
      const d = new Date();
      const hand = (a: number, len: number, lw: number) => {
        x.lineWidth = lw;
        x.beginPath();
        x.moveTo(w / 2, w / 2);
        x.lineTo(w / 2 + Math.sin(a) * len, w / 2 - Math.cos(a) * len);
        x.stroke();
      };
      hand(((d.getHours() % 12) + d.getMinutes() / 60) * (Math.PI / 6), 30, 7);
      hand(d.getMinutes() * (Math.PI / 30), 44, 4);
    });
    g.add(cyl(0.32, 0.32, 0.06, woodDark, 0, 1.9, 0.03).rotateX(Math.PI / 2));
    const f = new T.Mesh(
      new T.CircleGeometry(0.28, 32),
      M(0xffffff, { map: face, roughness: 0.6 }),
    );
    f.position.set(0, 1.9, 0.065);
    g.add(f);
    return g;
  },
  mirror() {
    const g = new T.Group();
    const frame = new T.Mesh(new T.TorusGeometry(0.32, 0.04, 10, 40), gold);
    frame.scale.set(0.8, 1.15, 1);
    frame.position.set(0, 1.75, 0.04);
    g.add(shade(frame));
    const glass = new T.Mesh(
      new T.CircleGeometry(0.32, 40),
      M(0xcfe3ea, { metalness: 0.9, roughness: 0.08, emissive: 0x24333a, emissiveIntensity: 0.4 }),
    );
    glass.scale.set(0.8, 1.15, 1);
    glass.position.set(0, 1.75, 0.03);
    g.add(glass);
    return g;
  },
  neon(c, on) {
    const g = new T.Group();
    const tube = M(c, { emissive: c, emissiveIntensity: on ? 2.2 : 0, roughness: 0.3 });
    const heart = new T.Shape();
    heart.moveTo(0, -0.3);
    heart.bezierCurveTo(-0.55, 0.05, -0.32, 0.42, 0, 0.18);
    heart.bezierCurveTo(0.32, 0.42, 0.55, 0.05, 0, -0.3);
    const pts = heart.getSpacedPoints(60).map((p) => new T.Vector3(p.x, p.y, 0));
    const curve = new T.CatmullRomCurve3(pts, true);
    const m = new T.Mesh(new T.TubeGeometry(curve, 80, 0.03, 8, true), tube);
    m.position.set(-0.35, 1.9, 0.08);
    g.add(m);
    const bar = new T.Mesh(
      new T.TubeGeometry(
        new T.LineCurve3(new T.Vector3(0.1, 1.75, 0.08), new T.Vector3(0.75, 1.75, 0.08)),
        4,
        0.03,
        8,
      ),
      tube,
    );
    const bar2 = new T.Mesh(
      new T.TubeGeometry(
        new T.LineCurve3(new T.Vector3(0.1, 2.05, 0.08), new T.Vector3(0.6, 2.05, 0.08)),
        4,
        0.03,
        8,
      ),
      tube,
    );
    g.add(bar, bar2);
    g.add(rbox(1.75, 0.7, 0.03, M(0x1a1a22, { roughness: 0.4 }), 0, 1.9, 0.015, 0.02));
    if (on) {
      const l = new T.PointLight(c, 0.5, 3, 2);
      l.position.set(0, 1.9, 0.5);
      g.add(l);
    }
    return g;
  },
  teleport(c) {
    // A booth with a glowing door (built in code, our own design).
    const g = new T.Group();
    const shell = M(c, { roughness: 0.4, metalness: 0.2 });
    g.add(rbox(0.86, 0.12, 0.86, M(0x2a2a35, { roughness: 0.5 }), 0, 0.06, 0, 0.04));
    g.add(rbox(0.12, 1.9, 0.86, shell, -0.37, 1.07, 0, 0.05));
    g.add(rbox(0.12, 1.9, 0.86, shell, 0.37, 1.07, 0, 0.05));
    g.add(rbox(0.86, 1.9, 0.12, shell, 0, 1.07, -0.37, 0.05));
    g.add(rbox(0.86, 0.14, 0.86, shell, 0, 2.06, 0, 0.05));
    const glow = new T.Mesh(
      new T.PlaneGeometry(0.62, 1.75),
      new T.MeshStandardMaterial({
        color: 0xbfe8ff,
        emissive: 0x7ac8ff,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.55,
      }),
    );
    glow.position.set(0, 1.02, 0.3);
    g.add(glow);
    g.add(sph(0.06, M(0xffffff, { emissive: 0x7ac8ff, emissiveIntensity: 2 }), 0, 2.2, 0.32));
    const l = new T.PointLight(0x7ac8ff, 0.5, 2.5, 2);
    l.position.set(0, 1.2, 0.6);
    g.add(l);
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

export function buildFurniture(type: FurnitureType, itemId: number, color = 0, state = 0): T.Group {
  const colors = furniture(type).colors;
  const g = BUILD[type](colors?.[color] ?? colors?.[0] ?? 0xffffff, state);
  const walk = type === 'rug';
  g.traverse((m) => {
    m.userData.itemId = itemId;
    if (walk) m.castShadow = false;
  });
  return g;
}

/** Draws the current frame of a TV channel. */
export function drawTv(
  tv: { canvas: HTMLCanvasElement; tex: T.CanvasTexture; channel: number },
  t: number,
) {
  const g = tv.canvas.getContext('2d')!;
  const w = tv.canvas.width;
  const h = tv.canvas.height;
  if (tv.channel === 1) {
    // Hutel Nyt: studio + ticker
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1b3a6b');
    gr.addColorStop(1, '#0d1d38');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c25a';
    g.font = 'bold 22px sans-serif';
    g.fillText('HUTEL NYT', 14, 30);
    g.fillStyle = '#f6efe0';
    g.font = '14px sans-serif';
    g.fillText('Direkte fra lobbyen', 14, 50);
    g.fillStyle = '#ffd5b0';
    g.beginPath();
    g.arc(190, 70, 22, 0, 7);
    g.fill();
    g.fillStyle = '#2f4a7a';
    g.fillRect(166, 92, 48, 30);
    g.fillStyle = '#c0392b';
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    const news =
      'Fredagsfest i caféen kl. 19 ✦ Luna har bagt æblekage ✦ Nye møbler i butikken ✦ Bob og Bent har det godt i akvariet ✦ ';
    const x = w - ((t * 60) % (g.measureText(news).width + w));
    g.fillText(news, x, h - 8);
  } else if (tv.channel === 2) {
    // Fiskekanalen
    g.fillStyle = '#1f7fae';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9d6a0';
    g.fillRect(0, h - 18, w, 18);
    for (let i = 0; i < 6; i++) {
      const fx = ((t * (20 + i * 9) + i * 70) % (w + 40)) - 20;
      const fy = 25 + i * 17 + Math.sin(t * 2 + i) * 6;
      g.fillStyle = ['#ff8c3a', '#ffd24a', '#ff6aa8', '#7affc8', '#ffffff', '#ffb35c'][i]!;
      g.beginPath();
      g.ellipse(fx, fy, 11, 6, 0, 0, 7);
      g.fill();
      g.beginPath();
      g.moveTo(fx - 10, fy);
      g.lineTo(fx - 18, fy - 6);
      g.lineTo(fx - 18, fy + 6);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 8; i++) {
      const by = h - ((t * 30 + i * 37) % h);
      g.beginPath();
      g.arc(30 + i * 28, by, 2.5, 0, 7);
      g.fill();
    }
  } else {
    // Musikkanalen: equalizer
    g.fillStyle = '#1a1030';
    g.fillRect(0, 0, w, h);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const v = 0.3 + 0.7 * Math.abs(Math.sin(t * (2 + (i % 5)) + i));
      const bh = v * (h - 30);
      const hue = (i / n) * 300 + t * 40;
      g.fillStyle = `hsl(${hue % 360},80%,60%)`;
      g.fillRect(8 + i * 15, h - 10 - bh, 11, bh);
    }
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    g.fillText('♪ HUTEL FM', 10, 20);
  }
  tv.tex.needsUpdate = true;
}

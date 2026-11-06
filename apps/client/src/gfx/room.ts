import {
  DOOR_TILE,
  isFloorTile,
  leftWallLength,
  themeWindowTile,
  type FloorDef,
  type RoomShape,
  type RoomTheme,
  type WallpaperDef,
} from '@hutel/shared';
import { box, canvasTex, cyl, lin, M, N, rbox, rnd, setRoomSizeN, sph, T, tw } from './helpers';

const H = 3.0;
/** Floor plan of the current room (set by setSize). */
let SHAPE: RoomShape = 'square';
const floorNow = () => ({ size: N, shape: SHAPE });

const trim = M(0x7a4528, { roughness: 0.6 });
const gold = M(0xe0b04a, { metalness: 0.6, roughness: 0.35 });

function wallpaper(base: string, stripe: string, dot: string, diamond = false) {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = stripe;
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
    g.fillStyle = dot;
    for (let y = 16; y < h; y += 32)
      for (let x = 23; x < w; x += 32) {
        g.beginPath();
        if (diamond) {
          g.moveTo(x, y - 5);
          g.lineTo(x + 4, y);
          g.lineTo(x, y + 5);
          g.lineTo(x - 4, y);
        } else g.arc(x, y, 3, 0, 7);
        g.fill();
      }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(5, 1.9);
  return t;
}

const wallCache = new Map<string, T.Texture>();
/** Wallpaper texture for a bought wallpaper (patterns drawn in code). */
function wallTex(def: WallpaperDef): T.Texture {
  const key = def.name;
  const hit = wallCache.get(key);
  if (hit) return hit;
  let t: T.Texture;
  if (def.pattern === 'stripes' || def.pattern === 'diamonds')
    t = wallpaper(def.base, def.stripe, def.dot, def.pattern === 'diamonds');
  else {
    t = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = def.base;
      g.fillRect(0, 0, w, h);
      if (def.pattern === 'bricks') {
        g.fillStyle = def.stripe;
        for (let y = 0; y < h; y += 16)
          for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) g.fillRect(x + 2, y + 2, 28, 12);
        g.fillStyle = def.dot;
        for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 1);
      } else if (def.pattern === 'wood') {
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = (x / 16) % 2 ? def.stripe : def.base;
          g.fillRect(x, 0, 16, h);
          g.fillStyle = def.dot;
          g.fillRect(x, 0, 1, h);
          g.fillRect(x + 6, 20 + ((x * 7) % 60), 1, 30);
        }
      } else if (def.pattern === 'stars') {
        g.fillStyle = def.dot;
        for (let i = 0; i < 26; i++) {
          g.beginPath();
          g.arc((i * 53) % w, (i * 37) % h, i % 4 ? 1.4 : 2.6, 0, 7);
          g.fill();
        }
      } else {
        g.fillStyle = def.stripe;
        g.fillRect(0, h - 10, w, 10);
      }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(5, 1.9);
  }
  wallCache.set(key, t);
  return t;
}

const THEMES: Record<RoomTheme, { wall: T.Texture; wain: number; floor: [number, number] }> = {
  home: {
    wall: wallpaper('#f3dfc2', '#ecd3b0', 'rgba(190,120,80,.28)'),
    wain: 0x9c5f3a,
    floor: [0xbd8250, 0xc98f5c],
  },
  lobby: {
    wall: wallpaper('#2f5d5a', '#285250', 'rgba(242,194,90,.35)', true),
    wain: 0x4a2a1a,
    floor: [0xd6c8ad, 0x3f6f6a],
  },
  cafe: {
    wall: wallpaper('#f1d6cf', '#e9c7bd', 'rgba(160,70,70,.25)'),
    wain: 0x6e3f2a,
    floor: [0x8a5634, 0x7a4a2c],
  },
  roof: { wall: nightSky(), wain: 0x5a5f66, floor: [0x8f7a66, 0x7d6a58] },
  arcade: {
    wall: wallpaper('#241a3a', '#2c2048', 'rgba(255,90,180,.45)', true),
    wain: 0x16102a,
    floor: [0x2a2040, 0x3a2a5a],
  },
  bedroom: {
    wall: wallpaper('#d6dff0', '#cbd6ea', 'rgba(90,110,170,.3)'),
    wain: 0x5a6a8f,
    floor: [0xb08a6a, 0xa07a5c],
  },
  bathroom: {
    wall: wallpaper('#e8f2f2', '#dcecec', 'rgba(60,140,160,.28)', true),
    wain: 0x5aa3b8,
    floor: [0xb8c8cb, 0x6f9fac],
  },
  kitchen: {
    wall: wallpaper('#f3ead6', '#ecdfc4', 'rgba(200,120,60,.3)'),
    wain: 0x6e5a3a,
    floor: [0x2f2f36, 0xe8e2d6],
  },
  balcony: { wall: nightSky(), wain: 0x6a6f76, floor: [0x9a7a5a, 0x8a6a4c] },
  pool: {
    wall: wallpaper('#bfe0e4', '#b2d6db', 'rgba(40,120,150,.35)'),
    wain: 0x3f8aa0,
    floor: [0x8fb0b5, 0x7fa2a8],
  },
};

/** Starry night with a city skyline, used as "walls" on the roof terrace. */
function nightSky() {
  const t = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#141a3a');
    gr.addColorStop(0.7, '#3a2a5a');
    gr.addColorStop(1, '#e0687a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6d8';
    for (let i = 0; i < 70; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.4, 1.4);
    g.fillStyle = '#1c1830';
    let x = 0;
    while (x < w) {
      const bw = 10 + Math.random() * 22;
      const bh = 18 + Math.random() * 40;
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(255,210,120,.8)';
      for (let y = h - bh + 4; y < h - 4; y += 7)
        for (let wx = x + 3; wx < x + bw - 3; wx += 6)
          if (Math.random() < 0.35) g.fillRect(wx, y, 2, 3);
      g.fillStyle = '#1c1830';
      x += bw + 2;
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

/** A garland of glowing bulbs along a wall. */
function stringLights(group: T.Group, lights: T.Light[], alongLeft: boolean, y = 2.55) {
  const cols = [0xffd27a, 0xff8a6a, 0x9ad0ff, 0xb8ff9a];
  for (let i = 0; i < 12; i++) {
    const t = -N / 2 + 0.4 + i * ((N - 0.8) / 11);
    const sag = Math.sin((i / 11) * Math.PI) * 0.25;
    const b = sph(0.05, M(cols[i % 4]!, { emissive: cols[i % 4]!, emissiveIntensity: 2 }), 0, 0, 0);
    if (alongLeft) b.position.set(-N / 2 + 0.15, y - sag, t);
    else b.position.set(t, y - sag, -N / 2 + 0.15);
    group.add(b);
  }
  const l = new T.PointLight(0xffc27a, 0.7, 8, 2);
  l.position.set(alongLeft ? -N / 2 + 1 : 0, y - 0.3, alongLeft ? 0 : -N / 2 + 1);
  lights.push(l);
  group.add(l);
}

const skyTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#5b3a78');
  gr.addColorStop(0.45, '#e0687a');
  gr.addColorStop(0.8, '#ffb35c');
  gr.addColorStop(1, '#ffd58a');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff1c0';
  g.beginPath();
  g.arc(w * 0.6, h * 0.72, 13, 0, 7);
  g.fill();
  g.fillStyle = '#3d2a3f';
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 8)
    g.lineTo(x, h * 0.84 - Math.sin(x * 0.07) * 8 - Math.sin(x * 0.19) * 4);
  g.lineTo(w, h);
  g.fill();
  g.fillStyle = '#2a1d2e';
  for (let i = 0; i < 6; i++) {
    const x = i * 24 + 4;
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + 8, h * 0.66);
    g.lineTo(x + 16, h);
    g.fill();
  }
});

const artTex = canvasTex(128, 96, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#8fc3e8');
  gr.addColorStop(1, '#f6e1b5');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#6aa84f';
  g.beginPath();
  g.ellipse(30, h, 70, 34, 0, 0, 7);
  g.fill();
  g.fillStyle = '#4f8f3a';
  g.beginPath();
  g.ellipse(100, h + 6, 60, 30, 0, 0, 7);
  g.fill();
  g.fillStyle = '#c94f3d';
  g.fillRect(74, 48, 22, 18);
  g.fillStyle = '#5e3820';
  g.beginPath();
  g.moveTo(70, 50);
  g.lineTo(85, 36);
  g.lineTo(100, 50);
  g.fill();
  g.fillStyle = '#ffd27a';
  g.fillRect(81, 54, 6, 6);
  g.fillStyle = '#fff6d0';
  g.beginPath();
  g.arc(28, 22, 9, 0, 7);
  g.fill();
});

function textTex(text: string, font: string, color: string, w = 512, h = 128, bg?: string) {
  return canvasTex(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (!bg) {
      g.fillStyle = '#7a4a12';
      g.fillText(text, w / 2 + 4, h / 2 + 5);
    }
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
}

function windowOnLeftWall(group: T.Group, wz: number) {
  const wy = 1.8;
  const ww = 1.7;
  const wh = 1.3;
  const x = -N / 2;
  const glass = new T.Mesh(new T.PlaneGeometry(ww, wh), new T.MeshBasicMaterial({ map: skyTex }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(x + 0.01, wy, wz);
  group.add(glass);
  group.add(box(0.12, 0.1, ww + 0.2, trim, x + 0.06, wy + wh / 2 + 0.05, wz));
  group.add(box(0.12, 0.1, ww + 0.2, trim, x + 0.06, wy - wh / 2 - 0.05, wz));
  group.add(box(0.12, wh + 0.2, 0.1, trim, x + 0.06, wy, wz - ww / 2 - 0.05));
  group.add(box(0.12, wh + 0.2, 0.1, trim, x + 0.06, wy, wz + ww / 2 + 0.05));
  group.add(box(0.06, wh, 0.05, trim, x + 0.04, wy, wz));
  group.add(box(0.06, 0.05, ww, trim, x + 0.04, wy + 0.1, wz));
  group.add(box(0.32, 0.06, ww + 0.35, trim, x + 0.16, wy - wh / 2 - 0.12, wz));
  const cur = M(0x9e2f3a, { roughness: 0.9 });
  group.add(box(0.12, wh + 0.7, 0.36, cur, x + 0.14, wy - 0.05, wz - ww / 2 - 0.22));
  group.add(box(0.12, wh + 0.7, 0.36, cur, x + 0.14, wy - 0.05, wz + ww / 2 + 0.22));
  group.add(
    cyl(0.025, 0.025, ww + 1.2, gold, x + 0.2, wy + wh / 2 + 0.32, wz).rotateX(Math.PI / 2),
  );
  group.add(cyl(0.08, 0.06, 0.13, M(0xc0643b), x + 0.17, wy - wh / 2 - 0.03, wz + 0.5));
  group.add(sph(0.09, M(0x5b9a45), x + 0.17, wy - wh / 2 + 0.08, wz + 0.5));
}

function painting(group: T.Group, px: number, py: number, onLeft = false) {
  const frame = box(1.25, 0.95, 0.06, M(0xc89a3c, { metalness: 0.4, roughness: 0.4 }), 0, 0, 0);
  const art = new T.Mesh(
    new T.PlaneGeometry(1.05, 0.75),
    M(0xffffff, { map: artTex, roughness: 0.8 }),
  );
  art.position.z = 0.035;
  const g = new T.Group();
  g.add(frame, art);
  if (onLeft) {
    g.rotation.y = Math.PI / 2;
    g.position.set(-N / 2 + 0.03, py, px);
  } else g.position.set(px, py, -N / 2 + 0.03);
  group.add(g);
}

/** The theme's own window, placed by tile so it follows the room's size and shape. */
function themeWindow(group: T.Group, theme: RoomTheme) {
  const c = themeWindowTile(theme, floorNow());
  if (c !== null) windowOnLeftWall(group, tw(c));
}

function decor(theme: RoomTheme): { group: T.Group; lights: T.Light[]; windowLight: boolean } {
  const group = new T.Group();
  const lights: T.Light[] = [];
  const z = -N / 2;
  const x = -N / 2;
  if (theme === 'home') {
    themeWindow(group, theme);
    return { group, lights, windowLight: true };
  }
  if (theme === 'lobby') {
    const sign = new T.Mesh(
      new T.PlaneGeometry(2.4, 0.6),
      new T.MeshBasicMaterial({
        map: textTex('HUTEL', 'bold 92px Georgia, serif', '#f2c25a'),
        transparent: true,
      }),
    );
    sign.position.set(-0.5, 2.35, z + 0.07);
    group.add(sign);
    for (const px of [-2.3, 1.4]) {
      group.add(box(0.12, 0.22, 0.1, gold, px, 2.25, z + 0.06));
      group.add(
        sph(0.1, M(0xffe2a8, { emissive: 0xffb35c, emissiveIntensity: 1.6 }), px, 2.45, z + 0.12),
      );
    }
    const ez = -0.5;
    const steel = M(0xb9b4aa, { metalness: 0.7, roughness: 0.3 });
    group.add(box(0.1, 2.5, 1.7, gold, x + 0.05, 1.25, ez));
    group.add(box(0.06, 2.25, 0.72, steel, x + 0.1, 1.13, ez - 0.37));
    group.add(box(0.06, 2.25, 0.72, steel, x + 0.1, 1.13, ez + 0.37));
    const lab = new T.Mesh(
      new T.PlaneGeometry(1.0, 0.25),
      new T.MeshBasicMaterial({
        map: textTex('Elevator · snart', '600 26px sans-serif', '#f2c25a', 256, 64, '#2b1d14'),
      }),
    );
    lab.rotation.y = Math.PI / 2;
    lab.position.set(x + 0.12, 2.6, ez);
    group.add(lab);
    painting(group, 2.2, 1.9, true);
    for (const p of [
      [-1.5, 2.6, 0.5],
      [1.8, 2.6, 1.2],
    ] as const) {
      const l = new T.PointLight(0xffc27a, 0.6, 7, 2);
      l.position.set(p[0], p[1], p[2]);
      lights.push(l);
      group.add(l);
    }
    return { group, lights, windowLight: false };
  }
  if (theme === 'bedroom') {
    themeWindow(group, theme);
    return { group, lights, windowLight: true };
  }
  if (theme === 'bathroom') {
    themeWindow(group, theme);
    return { group, lights, windowLight: true };
  }
  if (theme === 'kitchen') {
    themeWindow(group, theme);
    for (const px of [-1.2, 0.8]) {
      group.add(cyl(0.01, 0.01, 0.5, M(0x222222), px, 2.75, -1.6));
      group.add(
        sph(0.09, M(0xfff1c9, { emissive: 0xffb35c, emissiveIntensity: 1.8 }), px, 2.45, -1.6),
      );
      const l = new T.PointLight(0xffb35c, 0.5, 5, 2);
      l.position.set(px, 2.3, -1.6);
      lights.push(l);
      group.add(l);
    }
    return { group, lights, windowLight: true };
  }
  if (theme === 'balcony') {
    stringLights(group, lights, false);
    return { group, lights, windowLight: false };
  }
  if (theme === 'roof') {
    stringLights(group, lights, true);
    stringLights(group, lights, false);
    const moon = sph(
      0.25,
      M(0xfff1c9, { emissive: 0xfff1c9, emissiveIntensity: 1.2 }),
      2.2,
      2.4,
      z + 0.1,
    );
    group.add(moon);
    return { group, lights, windowLight: false };
  }
  if (theme === 'arcade') {
    const neon = (text: string, color: string, px: number, py: number, left = false) => {
      const sign = new T.Mesh(
        new T.PlaneGeometry(2.2, 0.55),
        new T.MeshBasicMaterial({
          map: textTex(text, 'bold 80px sans-serif', color),
          transparent: true,
        }),
      );
      if (left) {
        sign.rotation.y = Math.PI / 2;
        sign.position.set(x + 0.07, py, px);
      } else sign.position.set(px, py, z + 0.07);
      group.add(sign);
    };
    neon('SPILLEHAL', '#ff5ab0', -0.8, 2.4);
    neon('★ QUIZ ★', '#5ae0ff', 1.2, 2.4, true);
    for (const [px, c] of [
      [-2, 0xff5ab0],
      [1.6, 0x5ae0ff],
    ] as const) {
      const l = new T.PointLight(c, 0.9, 7, 2);
      l.position.set(px, 2.2, 0);
      lights.push(l);
      group.add(l);
    }
    return { group, lights, windowLight: false };
  }
  if (theme === 'pool') {
    windowOnLeftWall(group, -2);
    windowOnLeftWall(group, 1.2);
    const sign = new T.Mesh(
      new T.PlaneGeometry(2.0, 0.5),
      new T.MeshBasicMaterial({
        map: textTex('POOL · 28°', 'bold 70px sans-serif', '#2a7f9a'),
        transparent: true,
      }),
    );
    sign.position.set(-1, 2.4, z + 0.07);
    group.add(sign);
    const l = new T.PointLight(0x7ac8ff, 0.5, 6, 2);
    l.position.set(0.5, 0.8, 0.5);
    lights.push(l);
    group.add(l);
    return { group, lights, windowLight: false };
  }
  // café
  windowOnLeftWall(group, 1.5);
  const board = new T.Mesh(
    new T.PlaneGeometry(1.6, 1.0),
    new T.MeshBasicMaterial({
      map: canvasTex(320, 200, (g, w, h) => {
        g.fillStyle = '#26302b';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#c89a3c';
        g.lineWidth = 10;
        g.strokeRect(5, 5, w - 10, h - 10);
        g.fillStyle = '#f6efe0';
        g.font = '600 30px Georgia, serif';
        g.textAlign = 'center';
        g.fillText('Caféen', w / 2, 48);
        g.font = '20px sans-serif';
        g.textAlign = 'left';
        [
          'Kaffe ......... 3',
          'Kakao ......... 4',
          'Æblekage ...... 5',
          'Kanelsnegl .... 4',
        ].forEach((l, i) => g.fillText(l, 40, 90 + i * 28));
      }),
    }),
  );
  board.position.set(-1.6, 2.1, z + 0.06);
  group.add(board);
  for (const px of [-2.6, -0.4, 1.8]) {
    group.add(cyl(0.01, 0.01, 0.6, M(0x222222), px, 2.75, -1.2));
    const shade = new T.Mesh(
      new T.ConeGeometry(0.22, 0.2, 20, 1, true),
      M(0x2f5d5a, { side: T.DoubleSide }),
    );
    shade.position.set(px, 2.4, -1.2);
    group.add(shade);
    group.add(sph(0.06, M(0xfff1c9, { emissive: 0xffb35c, emissiveIntensity: 2 }), px, 2.33, -1.2));
    const l = new T.PointLight(0xffb35c, 0.45, 5, 2);
    l.position.set(px, 2.2, -1.2);
    lights.push(l);
    group.add(l);
  }
  return { group, lights, windowLight: true };
}

export function createRoom(scene: T.Scene) {
  const tiles: T.Mesh[] = [];
  /** Back and left wall meshes, for hanging pictures and windows. */
  const walls: T.Mesh[] = [];
  const wallMat = M(0xffffff, { map: THEMES.home.wall, roughness: 0.9 });
  const wain = M(0x9c5f3a, { roughness: 0.7 });
  const shell = new T.Group();
  scene.add(shell);
  /** (Re)builds floor and walls for the current room size N. */
  function buildShell() {
    for (const c of [...shell.children]) {
      shell.remove(c);
      if (c instanceof T.Mesh) c.geometry.dispose();
    }
    tiles.length = 0;
    walls.length = 0;
    const fl = floorNow();
    const base = M(0x4e3121);
    if (SHAPE === 'square') shell.add(box(N + 0.5, 0.5, N + 0.5, base, 0, -0.37, 0));
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) {
        if (!isFloorTile(fl, x, z)) continue;
        // Other floor plans get a base block under every tile (no slab under the holes).
        if (SHAPE !== 'square') shell.add(box(1.04, 0.5, 1.04, base, tw(x), -0.37, tw(z)));
        const t = rbox(
          0.97,
          0.12,
          0.97,
          M(0xbd8250, { roughness: 0.55 }),
          tw(x),
          -0.06,
          tw(z),
          0.03,
        );
        t.castShadow = false;
        t.userData.tile = { x, z };
        t.userData.alt = (x + z) % 2;
        shell.add(t);
        tiles.push(t);
      }
    const back = box(N + 0.2, H, 0.2, wallMat, -0.1, H / 2, -N / 2 - 0.1);
    const LW = leftWallLength(fl);
    const lz = -N / 2 + LW / 2;
    const left = box(0.2, H, LW, wallMat, -N / 2 - 0.1, H / 2, lz);
    back.userData.wall = 0;
    left.userData.wall = 1;
    walls.push(back, left);
    shell.add(back, left);
    shell.add(box(N, 1.0, 0.06, wain, 0, 0.5, -N / 2 + 0.03));
    shell.add(box(0.06, 1.0, LW, wain, -N / 2 + 0.03, 0.5, lz));
    shell.add(box(N, 0.08, 0.11, trim, 0, 1.03, -N / 2 + 0.05));
    shell.add(box(0.11, 0.08, LW, trim, -N / 2 + 0.05, 1.03, lz));
    shell.add(box(N + 0.2, 0.14, 0.28, trim, -0.1, H + 0.07, -N / 2 - 0.1));
    shell.add(box(0.28, 0.14, LW, trim, -N / 2 - 0.1, H + 0.07, lz));
    // The door always sits in front of the door tile on the back wall.
    doorGroup.position.set(tw(DOOR_TILE[0]) - 0.5, 0, -N / 2);
  }

  // Door with an opening leaf (built around the origin, moved by buildShell).
  const doorGroup = new T.Group();
  scene.add(doorGroup);
  const dx = 0.5;
  doorGroup.add(box(1.2, 2.3, 0.06, trim, dx, 1.15, 0.03));
  const dark = new T.Mesh(
    new T.PlaneGeometry(1.0, 2.15),
    new T.MeshBasicMaterial({ color: 0x3a2418 }),
  );
  dark.position.set(dx, 1.075, 0.065);
  doorGroup.add(dark);
  const glow = new T.Mesh(
    new T.PlaneGeometry(0.7, 1.6),
    new T.MeshBasicMaterial({ color: 0xffb766, transparent: true, opacity: 0.35 }),
  );
  glow.position.set(dx, 1.2, 0.067);
  doorGroup.add(glow);
  const doorPivot = new T.Group();
  doorPivot.position.set(dx - 0.5, 0, 0.11);
  doorGroup.add(doorPivot);
  const L = (m: T.Object3D) => {
    m.position.x += 0.5;
    doorPivot.add(m);
  };
  L(box(1.0, 2.15, 0.08, M(0x6e3f24, { roughness: 0.6 }), 0, 1.075, 0));
  for (const [px, py, h] of [
    [-0.22, 1.55, 0.75],
    [0.22, 1.55, 0.75],
    [-0.22, 0.55, 0.65],
    [0.22, 0.55, 0.65],
  ] as const)
    L(box(0.36, h, 0.03, M(0x84502f), px, py, 0.05));
  L(sph(0.05, gold, 0.38, 1.05, 0.08));
  doorGroup.add(box(0.5, 0.16, 0.03, gold, dx, 2.4, 0.04));
  const exitLamp = new T.Mesh(
    new T.SphereGeometry(0.06, 14, 10),
    new T.MeshBasicMaterial({ color: 0xd8433a }),
  );
  exitLamp.position.set(dx + 0.42, 2.4, 0.08);
  doorGroup.add(exitLamp);
  let doorTarget = 0;
  buildShell();

  const winSpot = new T.SpotLight(0xff9a48, 1.5, 13, 0.75, 0.9, 1);
  winSpot.castShadow = true;
  winSpot.shadow.mapSize.set(1024, 1024);
  winSpot.shadow.bias = -0.0005;
  scene.add(winSpot, winSpot.target);

  // Dust motes floating in the window light.
  const DN = 110;
  const dp = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    dp[i * 3] = rnd(-3.8, 1);
    dp[i * 3 + 1] = rnd(0.3, 2.7);
    dp[i * 3 + 2] = rnd(-3.2, 0.6);
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dp, 3));
  const dust = new T.Points(
    dustGeo,
    new T.PointsMaterial({
      color: 0xffd9a0,
      size: 2.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  scene.add(dust);

  let current: ReturnType<typeof decor> | null = null;
  let currentTheme: RoomTheme = 'home';
  let customWall: WallpaperDef | null = null;
  let customFloor: FloorDef | null = null;
  function paint() {
    const th = THEMES[currentTheme];
    wallMat.map = customWall ? wallTex(customWall) : th.wall;
    wallMat.needsUpdate = true;
    const fl: readonly [number, number] = customFloor ? [customFloor.a, customFloor.b] : th.floor;
    for (const t of tiles)
      (t.material as T.MeshStandardMaterial).color.copy(lin(fl[t.userData.alt as number]!));
  }
  function setTheme(theme: RoomTheme) {
    currentTheme = theme;
    if (current) scene.remove(current.group);
    current = decor(theme);
    scene.add(current.group);
    const th = THEMES[theme];
    wain.color.copy(lin(th.wain));
    paint();
    winSpot.visible = current.windowLight;
    dust.visible = current.windowLight;
    const wt = themeWindowTile(theme, floorNow());
    const wz = wt !== null ? tw(wt) : theme === 'cafe' ? 1.5 : -1.5;
    winSpot.position.set(-N / 2 + 0.25, 2.5, wz);
    winSpot.target.position.set(1.6, 0, wz + 0.9);
  }

  return {
    tiles,
    walls,
    doorGroup,
    setTheme,
    /** Owner's own wallpaper/floor on top of the theme (null = the theme's). */
    setDecor(wall: WallpaperDef | null, floor: FloorDef | null) {
      customWall = wall;
      customFloor = floor;
      paint();
    },
    /** Changes the floor size. Call setTheme afterwards to recolour the new tiles. */
    setSize(n: number, shape: RoomShape = 'square') {
      if (n === N && shape === SHAPE && tiles.length) return;
      setRoomSizeN(n);
      SHAPE = shape;
      buildShell();
    },
    setDoorUnlocked: (on: boolean) =>
      (exitLamp.material as T.MeshBasicMaterial).color.setHex(on ? 0x4fd16b : 0xd8433a),
    openDoor: (open: boolean) => (doorTarget = open ? -1.35 : 0),
    update(dt: number, time: number) {
      doorPivot.rotation.y += (doorTarget - doorPivot.rotation.y) * Math.min(1, dt * 7);
      const p = dustGeo.attributes.position!.array as Float32Array;
      for (let i = 0; i < DN; i++) {
        p[i * 3 + 1] += Math.sin(time * 0.6 + i) * 0.0012;
        p[i * 3] += Math.cos(time * 0.4 + i * 1.7) * 0.0008;
      }
      dustGeo.attributes.position!.needsUpdate = true;
    },
  };
}
export type RoomGfx = ReturnType<typeof createRoom>;

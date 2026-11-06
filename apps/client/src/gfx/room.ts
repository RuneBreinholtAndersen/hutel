import type { RoomTheme } from '@hutel/shared';
import { box, canvasTex, cyl, lin, M, N, rbox, rnd, sph, T, tw } from './helpers';

const H = 3.0;

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
};

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

function decor(theme: RoomTheme): { group: T.Group; lights: T.Light[]; windowLight: boolean } {
  const group = new T.Group();
  const lights: T.Light[] = [];
  const z = -N / 2;
  const x = -N / 2;
  if (theme === 'home') {
    windowOnLeftWall(group, -1.5);
    painting(group, -1.0, 2.0);
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
  scene.add(box(N + 0.5, 0.5, N + 0.5, M(0x4e3121), 0, -0.37, 0));
  const tiles: T.Mesh[] = [];
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const t = rbox(0.97, 0.12, 0.97, M(0xbd8250, { roughness: 0.55 }), tw(x), -0.06, tw(z), 0.03);
      t.castShadow = false;
      t.userData.tile = { x, z };
      t.userData.alt = (x + z) % 2;
      scene.add(t);
      tiles.push(t);
    }
  const wallMat = M(0xffffff, { map: THEMES.home.wall, roughness: 0.9 });
  scene.add(box(N + 0.2, H, 0.2, wallMat, -0.1, H / 2, -N / 2 - 0.1));
  scene.add(box(0.2, H, N, wallMat, -N / 2 - 0.1, H / 2, 0));
  const wain = M(0x9c5f3a, { roughness: 0.7 });
  scene.add(box(N, 1.0, 0.06, wain, 0, 0.5, -N / 2 + 0.03));
  scene.add(box(0.06, 1.0, N, wain, -N / 2 + 0.03, 0.5, 0));
  scene.add(box(N, 0.08, 0.11, trim, 0, 1.03, -N / 2 + 0.05));
  scene.add(box(0.11, 0.08, N, trim, -N / 2 + 0.05, 1.03, 0));
  scene.add(box(N + 0.2, 0.14, 0.28, trim, -0.1, H + 0.07, -N / 2 - 0.1));
  scene.add(box(0.28, 0.14, N, trim, -N / 2 - 0.1, H + 0.07, 0));

  // Door with an opening leaf.
  const doorGroup = new T.Group();
  scene.add(doorGroup);
  const dx = 2.5;
  doorGroup.add(box(1.2, 2.3, 0.06, trim, dx, 1.15, -N / 2 + 0.03));
  const dark = new T.Mesh(
    new T.PlaneGeometry(1.0, 2.15),
    new T.MeshBasicMaterial({ color: 0x3a2418 }),
  );
  dark.position.set(dx, 1.075, -N / 2 + 0.065);
  doorGroup.add(dark);
  const glow = new T.Mesh(
    new T.PlaneGeometry(0.7, 1.6),
    new T.MeshBasicMaterial({ color: 0xffb766, transparent: true, opacity: 0.35 }),
  );
  glow.position.set(dx, 1.2, -N / 2 + 0.067);
  doorGroup.add(glow);
  const doorPivot = new T.Group();
  doorPivot.position.set(dx - 0.5, 0, -N / 2 + 0.11);
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
  doorGroup.add(box(0.5, 0.16, 0.03, gold, dx, 2.4, -N / 2 + 0.04));
  const exitLamp = new T.Mesh(
    new T.SphereGeometry(0.06, 14, 10),
    new T.MeshBasicMaterial({ color: 0xd8433a }),
  );
  exitLamp.position.set(dx + 0.42, 2.4, -N / 2 + 0.08);
  doorGroup.add(exitLamp);
  let doorTarget = 0;

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
  function setTheme(theme: RoomTheme) {
    if (current) scene.remove(current.group);
    current = decor(theme);
    scene.add(current.group);
    const th = THEMES[theme];
    wallMat.map = th.wall;
    wallMat.needsUpdate = true;
    wain.color.copy(lin(th.wain));
    for (const t of tiles)
      (t.material as T.MeshStandardMaterial).color.copy(lin(th.floor[t.userData.alt as number]));
    winSpot.visible = current.windowLight;
    dust.visible = current.windowLight;
    const wz = theme === 'cafe' ? 1.5 : -1.5;
    winSpot.position.set(-N / 2 + 0.25, 2.5, wz);
    winSpot.target.position.set(1.6, 0, wz + 0.9);
  }

  return {
    tiles,
    doorGroup,
    setTheme,
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

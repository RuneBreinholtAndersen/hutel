import type { Look } from '@hutel/shared';
import { cyl, lin, M, rbox, rnd, shade, sph, T } from './helpers';

export interface AvatarParts {
  mats: Record<'skin' | 'hair' | 'shirt' | 'pants' | 'shoe' | 'eyes', T.MeshStandardMaterial>;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  head: T.Group;
  rig: T.Group;
  eyes: T.Group[];
  parts: T.Group;
  /** Clothing extras on the body (collars, hoods, jackets…). */
  outfit: T.Group;
}

export function makeAvatar(look: Look): T.Group {
  const g = new T.Group();
  const rig = new T.Group();
  g.add(rig);
  const mats = {
    skin: M(look.skin, { roughness: 0.55 }),
    hair: M(look.hair, { roughness: 0.65 }),
    shirt: M(look.shirt, { roughness: 0.8 }),
    pants: M(look.pants, { roughness: 0.8 }),
    shoe: M(0x3a2a24, { roughness: 0.6 }),
    eyes: M(look.eyes, { roughness: 0.3 }),
  };
  const white = M(0xffffff, { roughness: 0.25 });
  const pupil = M(0x14100e, { roughness: 0.2 });
  const hl = new T.MeshBasicMaterial({ color: 0xffffff });
  const leg = (x: number) => {
    const l = new T.Group();
    l.position.set(x, 0.3, 0);
    l.add(cyl(0.07, 0.065, 0.2, mats.pants, 0, -0.1, 0));
    l.add(rbox(0.15, 0.09, 0.23, mats.shoe, 0, -0.25, 0.03, 0.04));
    rig.add(l);
    return l;
  };
  const arm = (x: number) => {
    const a = new T.Group();
    a.position.set(x, 0.66, 0);
    a.add(cyl(0.058, 0.05, 0.26, mats.shirt, 0, -0.12, 0));
    a.add(sph(0.065, mats.skin, 0, -0.28, 0));
    rig.add(a);
    return a;
  };
  const legL = leg(-0.09);
  const legR = leg(0.09);
  const torso = sph(0.22, mats.shirt, 0, 0.5, 0);
  torso.scale.set(1, 1.15, 0.9);
  rig.add(torso);
  const armL = arm(-0.225);
  const armR = arm(0.225);
  const head = new T.Group();
  head.position.y = 1.0;
  rig.add(head);
  const skull = sph(0.34, mats.skin);
  skull.scale.set(1, 0.95, 0.95);
  head.add(skull, sph(0.07, mats.skin, -0.33, -0.03, 0), sph(0.07, mats.skin, 0.33, -0.03, 0));
  const eyes: T.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = new T.Group();
    e.position.set(sx * 0.12, 0, 0.27);
    const w = sph(0.098, white);
    w.scale.set(1, 1.15, 0.6);
    const ir = sph(0.066, mats.eyes, 0, -0.01, 0.03);
    ir.scale.set(1, 1.1, 0.5);
    const pu = sph(0.036, pupil, 0, -0.01, 0.05);
    pu.scale.set(1, 1.1, 0.5);
    const h = new T.Mesh(new T.SphereGeometry(0.016, 10, 8), hl);
    h.position.set(0.026, 0.03, 0.07);
    e.add(w, ir, pu, h);
    head.add(e);
    eyes.push(e);
    const br = rbox(0.11, 0.028, 0.035, mats.hair, sx * 0.12, 0.135, 0.3, 0.012);
    br.rotation.z = -sx * 0.15;
    head.add(br);
  }
  head.add(sph(0.045, mats.skin, 0, -0.07, 0.325));
  const mouth = new T.Mesh(
    new T.TorusGeometry(0.05, 0.011, 8, 16, Math.PI),
    M(0x5a1e1a, { roughness: 0.5 }),
  );
  mouth.rotation.set(-0.35, 0, Math.PI);
  mouth.position.set(0, -0.135, 0.285);
  head.add(mouth);
  const ch = M(0xf28c80, { roughness: 0.9, transparent: true, opacity: 0.55 });
  head.add(sph(0.055, ch, -0.2, -0.1, 0.25), sph(0.055, ch, 0.2, -0.1, 0.25));
  const parts = new T.Group();
  head.add(parts);
  const outfit = new T.Group();
  rig.add(outfit);
  g.scale.setScalar(0.95);
  const ud: AvatarParts = { mats, legL, legR, armL, armR, head, rig, eyes, parts, outfit };
  g.userData = ud as unknown as Record<string, unknown>;
  buildParts(g, look);
  return g;
}

export const parts = (g: T.Group) => g.userData as unknown as AvatarParts;

/** (Re)builds hair, glasses and beard – call after changing the look. */
export function buildParts(g: T.Group, look: Look) {
  const P = parts(g);
  const { mats } = P;
  for (const k of ['skin', 'hair', 'shirt', 'pants', 'eyes'] as const)
    mats[k].color.copy(lin(look[k]));
  const Hm = mats.hair;
  const grp = P.parts;
  while (grp.children.length) grp.remove(grp.children[0]!);
  buildOutfit(P, look);
  const add = <O extends T.Object3D>(m: O) => {
    grp.add(m);
    return m;
  };
  const capShell = () => {
    const c = add(
      shade(new T.Mesh(new T.SphereGeometry(0.36, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.48), Hm)),
    );
    c.position.y = 0.03;
    c.rotation.x = -0.35;
  };
  const backHair = () => {
    const b = add(sph(0.345, Hm, 0, -0.02, -0.07));
    b.scale.set(1.02, 0.95, 0.9);
    return b;
  };
  const fringe = (pts: [number, number, number][]) =>
    pts.forEach((p) => add(sph(0.11, Hm, ...p)).scale.set(1.1, 0.7, 0.7));
  switch (look.hairStyle) {
    case 'kort':
      capShell();
      backHair();
      fringe([
        [-0.16, 0.26, 0.21],
        [0, 0.29, 0.24],
        [0.16, 0.26, 0.21],
      ]);
      break;
    case 'krøller':
      backHair();
      for (let i = 0; i < 26; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.random() * 1.15;
        const x = Math.sin(ph) * Math.cos(th) * 0.33;
        const y = Math.cos(ph) * 0.33 * 0.95 + 0.02;
        const z = Math.sin(ph) * Math.sin(th) * 0.33;
        if (z > 0.18 && y < 0.2) continue;
        add(sph(rnd(0.09, 0.12), Hm, x, y, z));
      }
      break;
    case 'hestehale': {
      capShell();
      backHair();
      add(sph(0.12, Hm, 0, 0.1, -0.38));
      add(sph(0.1, Hm, 0, -0.06, -0.43));
      add(sph(0.08, Hm, 0, -0.2, -0.42));
      const tie = add(shade(new T.Mesh(new T.TorusGeometry(0.07, 0.02, 8, 16), M(0xc94f3d))));
      tie.position.set(0, 0.12, -0.33);
      break;
    }
    case 'langt': {
      capShell();
      const b = backHair();
      b.scale.set(1.05, 1.2, 0.85);
      b.position.set(0, -0.08, -0.13);
      add(rbox(0.11, 0.5, 0.26, Hm, -0.3, -0.16, 0.02, 0.05));
      add(rbox(0.11, 0.5, 0.26, Hm, 0.3, -0.16, 0.02, 0.05));
      fringe([
        [-0.16, 0.26, 0.21],
        [0.02, 0.29, 0.24],
        [0.17, 0.25, 0.2],
      ]);
      break;
    }
    case 'kasket': {
      backHair();
      const cm = mats.shirt;
      const dome = add(
        shade(new T.Mesh(new T.SphereGeometry(0.37, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), cm)),
      );
      dome.position.y = 0.11;
      dome.rotation.x = -0.3;
      dome.scale.set(1, 0.9, 1);
      const brim = add(cyl(0.2, 0.2, 0.025, cm, 0, 0.22, 0.3, 26));
      brim.scale.set(1, 1, 0.75);
      brim.rotation.x = 0.3;
      add(sph(0.032, cm, 0, 0.43, -0.02));
      break;
    }
    case 'skaldet':
      break;
  }
  if (look.glasses !== 'ingen') {
    const fm = M(look.glasses === 'sol' ? 0x1a1a1a : 0x3a2a20, { roughness: 0.4, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      const ring = add(shade(new T.Mesh(new T.TorusGeometry(0.088, 0.013, 8, 24), fm)));
      ring.position.set(sx * 0.12, 0, 0.335);
      if (look.glasses === 'sol') {
        const lens = add(
          new T.Mesh(
            new T.CircleGeometry(0.085, 24),
            M(0x141820, { roughness: 0.15, metalness: 0.5 }),
          ),
        );
        lens.position.set(sx * 0.12, 0, 0.34);
      }
      const armM = add(rbox(0.012, 0.012, 0.3, fm, sx * 0.215, 0.02, 0.19, 0.005));
      armM.rotation.y = sx * 0.12;
    }
    add(rbox(0.07, 0.012, 0.012, fm, 0, 0.02, 0.34, 0.005));
  }
  if (look.beard !== 'ingen') {
    const stubble = look.beard === 'stubbe';
    const bm = stubble
      ? M(look.hair, { roughness: 0.95, transparent: true, opacity: 0.5, depthWrite: false })
      : Hm;
    const b = add(sph(stubble ? 0.29 : 0.3, bm, 0, stubble ? -0.15 : -0.17, stubble ? 0.06 : 0.07));
    b.scale.set(1.02, stubble ? 0.55 : 0.62, 0.85);
    if (!stubble) add(sph(0.06, Hm, 0, -0.1, 0.31)).scale.set(1.6, 0.5, 0.6);
  }
  buildHat(add, look);
}

/** Torso extras for the chosen top (the shirt colour is the main colour). */
function buildOutfit(P: AvatarParts, look: Look) {
  const o = P.outfit;
  while (o.children.length) o.remove(o.children[0]!);
  const top = look.top ?? 'tshirt';
  const shirt = P.mats.shirt;
  const white = M(0xf4f1ea, { roughness: 0.7 });
  const front = (w: number, h: number, mat: T.Material, x: number, y: number, z = 0.19) => {
    const m = rbox(w, h, 0.05, mat, x, y, z, 0.02);
    o.add(m);
    return m;
  };
  switch (top) {
    case 'stribet': {
      for (const y of [0.4, 0.5, 0.6]) {
        const ring = shade(new T.Mesh(new T.TorusGeometry(0.205, 0.018, 8, 28), white));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        ring.scale.set(1.02, 0.92, 1);
        o.add(ring);
      }
      break;
    }
    case 'hoodie': {
      const hood = sph(0.2, shirt, 0, 0.74, -0.14);
      hood.scale.set(1.15, 0.6, 0.8);
      o.add(hood);
      front(0.22, 0.09, M(look.shirt, { roughness: 0.95 }), 0, 0.42, 0.18);
      o.add(
        cyl(0.008, 0.008, 0.14, white, -0.05, 0.62, 0.2, 6),
        cyl(0.008, 0.008, 0.14, white, 0.05, 0.62, 0.2, 6),
      );
      break;
    }
    case 'skjorte': {
      for (const sx of [-1, 1]) {
        const c = front(0.1, 0.06, white, sx * 0.05, 0.72, 0.15);
        c.rotation.z = sx * 0.5;
      }
      front(0.05, 0.22, M(0xb3302a, { roughness: 0.5 }), 0, 0.58, 0.2);
      front(0.07, 0.05, M(0xb3302a, { roughness: 0.5 }), 0, 0.7, 0.18);
      break;
    }
    case 'jakke':
    case 'smoking': {
      const jm = M(top === 'jakke' ? 0x2a211d : 0x16161c, {
        roughness: top === 'jakke' ? 0.45 : 0.6,
      });
      const jacket = sph(0.228, jm, 0, 0.5, -0.015);
      jacket.scale.set(1, 1.15, 0.9);
      o.add(jacket);
      // open front shows the shirt (white for the tuxedo)
      front(0.09, 0.4, top === 'smoking' ? white : shirt, 0, 0.52, 0.19);
      for (const sx of [-1, 1]) {
        const lapel = front(0.05, 0.2, jm, sx * 0.07, 0.6, 0.2);
        lapel.rotation.z = -sx * 0.35;
      }
      if (top === 'smoking') {
        const bow = M(0x111111, { roughness: 0.4 });
        o.add(sph(0.035, bow, -0.035, 0.7, 0.22), sph(0.035, bow, 0.035, 0.7, 0.22));
      }
      // sleeves in jacket colour
      for (const arm of [P.armL, P.armR]) {
        const sl = cyl(0.064, 0.056, 0.2, jm, 0, -0.1, 0);
        sl.userData.outfit = true;
        arm.add(sl);
      }
      break;
    }
  }
  // remove sleeves from an earlier jacket if the top changed
  for (const arm of [P.armL, P.armR])
    for (const c of [...arm.children])
      if (c.userData.outfit && top !== 'jakke' && top !== 'smoking') arm.remove(c);
}

function buildHat(add: <O extends T.Object3D>(m: O) => O, look: Look) {
  switch (look.hat ?? 'ingen') {
    case 'hue': {
      const m = M(0xc94f3d, { roughness: 0.95 });
      const cap = add(
        shade(new T.Mesh(new T.SphereGeometry(0.37, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), m)),
      );
      cap.position.y = 0.08;
      const band = add(shade(new T.Mesh(new T.TorusGeometry(0.335, 0.05, 10, 28), M(0xe8e2d6))));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.14;
      add(sph(0.08, M(0xe8e2d6), 0, 0.46, 0));
      break;
    }
    case 'cowboy': {
      const m = M(0x8a5a34, { roughness: 0.8 });
      const brim = add(cyl(0.6, 0.6, 0.03, m, 0, 0.24, 0, 32));
      brim.scale.set(1, 1, 0.85);
      add(cyl(0.26, 0.3, 0.26, m, 0, 0.38, 0, 24));
      add(cyl(0.305, 0.305, 0.05, M(0x3a2414), 0, 0.28, 0, 24));
      break;
    }
    case 'hoejhat': {
      const m = M(0x16161c, { roughness: 0.5 });
      add(cyl(0.48, 0.48, 0.03, m, 0, 0.27, 0, 32));
      add(cyl(0.25, 0.25, 0.42, m, 0, 0.49, 0, 26));
      add(cyl(0.255, 0.255, 0.06, M(0xb3302a), 0, 0.32, 0, 26));
      break;
    }
    case 'krone': {
      const gm = M(0xf0c24a, { metalness: 0.7, roughness: 0.3 });
      add(cyl(0.24, 0.24, 0.1, gm, 0, 0.33, 0, 24));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = add(shade(new T.Mesh(new T.ConeGeometry(0.05, 0.13, 8), gm)));
        spike.position.set(Math.sin(a) * 0.21, 0.44, Math.cos(a) * 0.21);
        add(
          sph(
            0.025,
            M(i % 2 ? 0xc94f3d : 0x3f7fd6, { roughness: 0.2 }),
            Math.sin(a) * 0.24,
            0.33,
            Math.cos(a) * 0.24,
          ),
        );
      }
      break;
    }
  }
}

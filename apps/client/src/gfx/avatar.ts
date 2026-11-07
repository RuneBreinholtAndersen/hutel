import type { Look } from '@hutel/shared';
import { cyl, lin, M, rbox, rnd, shade, sph, T } from './helpers';

export interface AvatarParts {
  mats: Record<
    'skin' | 'hair' | 'shirt' | 'pants' | 'shoe' | 'eyes' | 'extra',
    T.MeshStandardMaterial
  >;
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
  torso: T.Mesh;
  brows: T.Mesh[];
  /** Lashes, shown for the female figure. */
  lashes: T.Group;
  mouth: T.Mesh;
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
    extra: M(look.extra ?? 0xc94f3d, { roughness: 0.75 }),
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
  const brows: T.Mesh[] = [];
  const lashes = new T.Group();
  head.add(lashes);
  const lashMat = M(0x1e1412, { roughness: 0.5 });
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
    brows.push(br);
    // Three little lashes on the outer side of each eye.
    for (let i = 0; i < 3; i++) {
      const l = rbox(
        0.014,
        0.05,
        0.014,
        lashMat,
        sx * (0.17 + i * 0.022),
        0.1 - i * 0.025,
        0.3,
        0.005,
      );
      l.rotation.z = -sx * (0.5 + i * 0.35);
      lashes.add(l);
    }
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
  const ud: AvatarParts = {
    mats,
    legL,
    legR,
    armL,
    armR,
    head,
    rig,
    eyes,
    parts,
    outfit,
    torso,
    brows,
    lashes,
    mouth,
  };
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
  mats.extra.color.copy(lin(look.extra ?? 0xc94f3d));
  // Body type: small, friendly differences – lashes and a softer mouth, or broader shoulders.
  const g2 = look.gender ?? 'andet';
  P.lashes.visible = g2 === 'kvinde';
  P.torso.scale.set(g2 === 'mand' ? 1.07 : g2 === 'kvinde' ? 0.94 : 1, 1.15, 0.9);
  for (const b of P.brows) b.scale.set(1, g2 === 'mand' ? 1.45 : g2 === 'kvinde' ? 0.8 : 1, 1);
  (P.mouth.material as T.MeshStandardMaterial).color.copy(
    lin(g2 === 'kvinde' ? 0xb8344a : 0x5a1e1a),
  );
  P.armL.position.x = g2 === 'mand' ? -0.24 : g2 === 'kvinde' ? -0.212 : -0.225;
  P.armR.position.x = -P.armL.position.x;
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
  // Parts we added to arms/legs for the previous look (sleeves, boots…).
  for (const limb of [P.armL, P.armR, P.legL, P.legR])
    for (const c of [...limb.children]) if (c.userData.outfit) limb.remove(c);
  const tag = <O extends T.Object3D>(m: O) => {
    m.userData.outfit = true;
    return m;
  };
  const top = look.top ?? 'tshirt';
  const X = P.mats.extra;
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
      for (const arm of [P.armL, P.armR]) arm.add(tag(cyl(0.064, 0.056, 0.2, jm, 0, -0.1, 0)));
      break;
    }
    case 'kjole': {
      // A flared skirt in the shirt colour, with a little belt.
      o.add(shade(cyl(0.2, 0.32, 0.3, shirt, 0, 0.3, 0, 28)));
      const belt = shade(new T.Mesh(new T.TorusGeometry(0.2, 0.02, 8, 28), X));
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 0.44;
      o.add(belt);
      break;
    }
    case 'dunjakke': {
      // Puffy rings around the body and puffy sleeves.
      for (const [y, rr] of [
        [0.36, 0.2],
        [0.48, 0.22],
        [0.6, 0.205],
      ] as const) {
        const ring = shade(new T.Mesh(new T.TorusGeometry(rr, 0.055, 10, 28), shirt));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        ring.scale.set(1, 0.9, 1);
        o.add(ring);
      }
      const collar = shade(new T.Mesh(new T.TorusGeometry(0.13, 0.05, 10, 24), shirt));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.74;
      o.add(collar);
      front(0.03, 0.34, X, 0, 0.52, 0.22);
      for (const arm of [P.armL, P.armR]) {
        arm.add(tag(sph(0.075, shirt, 0, -0.05, 0)));
        arm.add(tag(sph(0.07, shirt, 0, -0.17, 0)));
      }
      break;
    }
  }
  buildShoes(P, look, tag);
  buildAccessory(P, look, front);
}

function buildShoes(P: AvatarParts, look: Look, tag: <O extends T.Object3D>(m: O) => O) {
  const shoes = look.shoes ?? 'standard';
  const base = {
    standard: 0x3a2a24,
    sneakers: look.extra ?? 0xf0efe8,
    stoevler: 0x6b4a33,
    sandaler: 0x8a5a34,
  };
  P.mats.shoe.color.copy(lin(base[shoes]));
  const white = M(0xf4f1ea, { roughness: 0.6 });
  for (const leg of [P.legL, P.legR]) {
    if (shoes === 'sneakers') {
      leg.add(tag(rbox(0.16, 0.035, 0.25, white, 0, -0.29, 0.03, 0.015)));
      leg.add(tag(rbox(0.1, 0.012, 0.02, white, 0, -0.22, 0.14, 0.004)));
    } else if (shoes === 'stoevler') {
      leg.add(tag(cyl(0.078, 0.075, 0.15, P.mats.shoe, 0, -0.17, 0)));
      leg.add(tag(cyl(0.08, 0.08, 0.02, P.mats.extra, 0, -0.1, 0)));
    } else if (shoes === 'sandaler') {
      // Skin-coloured feet on a thin sole, with straps.
      leg.add(tag(rbox(0.152, 0.07, 0.232, P.mats.skin, 0, -0.24, 0.03, 0.035)));
      leg.add(tag(rbox(0.16, 0.025, 0.24, P.mats.shoe, 0, -0.285, 0.03, 0.01)));
      leg.add(tag(rbox(0.155, 0.02, 0.03, P.mats.extra, 0, -0.22, 0.08, 0.008)));
    }
  }
}

function buildAccessory(
  P: AvatarParts,
  look: Look,
  front: (w: number, h: number, mat: T.Material, x: number, y: number, z?: number) => T.Mesh,
) {
  const o = P.outfit;
  const X = P.mats.extra;
  switch (look.acc ?? 'ingen') {
    case 'halstoerklaede': {
      const ring = shade(new T.Mesh(new T.TorusGeometry(0.13, 0.05, 10, 24), X));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.74;
      o.add(ring);
      const end = front(0.08, 0.2, X, 0.08, 0.6, 0.17);
      end.rotation.z = 0.15;
      break;
    }
    case 'sloejfe':
      o.add(
        sph(0.04, X, -0.04, 0.72, 0.19),
        sph(0.04, X, 0.04, 0.72, 0.19),
        sph(0.02, X, 0, 0.72, 0.21),
      );
      break;
    case 'rygsaek': {
      o.add(rbox(0.3, 0.32, 0.14, X, 0, 0.52, -0.25, 0.05));
      o.add(rbox(0.22, 0.12, 0.05, X, 0, 0.44, -0.33, 0.03));
      const strap = M(0x2a2a35, { roughness: 0.7 });
      for (const sx of [-1, 1]) o.add(rbox(0.04, 0.34, 0.03, strap, sx * 0.1, 0.54, 0.18, 0.01));
      break;
    }
    case 'halskaede': {
      const gm = M(0xf0c24a, { metalness: 0.7, roughness: 0.3 });
      const chain = shade(new T.Mesh(new T.TorusGeometry(0.15, 0.012, 6, 28), gm));
      chain.rotation.x = Math.PI / 2 - 0.5;
      chain.position.set(0, 0.68, 0.04);
      o.add(chain, sph(0.035, gm, 0, 0.6, 0.19));
      break;
    }
  }
}

/** A small object held in the right hand (coffee, ice cream, flower…). */
export function buildCarry(kind: string): T.Group {
  const g = new T.Group();
  switch (kind) {
    case 'kaffe':
      g.add(cyl(0.05, 0.04, 0.1, M(0xf4f1ea, { roughness: 0.4 }), 0, 0, 0));
      g.add(cyl(0.045, 0.045, 0.01, M(0x5a3420), 0, 0.05, 0));
      g.add(
        shade(new T.Mesh(new T.TorusGeometry(0.025, 0.008, 6, 12), M(0xf4f1ea))).translateX(0.055),
      );
      break;
    case 'is':
      g.add(
        shade(
          new T.Mesh(new T.ConeGeometry(0.045, 0.13, 12), M(0xd9a35b, { roughness: 0.9 })),
        ).rotateX(Math.PI),
      );
      g.add(sph(0.05, M(0xffc1d9, { roughness: 0.7 }), 0, 0.08, 0));
      g.add(sph(0.012, M(0xd8433a), 0, 0.13, 0));
      break;
    case 'sodavand':
      g.add(cyl(0.045, 0.04, 0.13, M(0xc94f3d, { roughness: 0.3 }), 0, 0, 0));
      g.add(cyl(0.006, 0.006, 0.1, M(0xf4f1ea), 0.015, 0.1, 0));
      break;
    case 'blomst': {
      const st = cyl(0.008, 0.008, 0.22, M(0x4f8f3a), 0, 0.06, 0, 6);
      g.add(st, sph(0.05, M(0xd8433a, { roughness: 0.6 }), 0, 0.18, 0));
      g.add(sph(0.03, M(0x4f8f3a), 0.03, 0.08, 0));
      break;
    }
    case 'kage':
      g.add(cyl(0.05, 0.04, 0.05, M(0xf2a3c0), 0, 0, 0));
      g.add(sph(0.05, M(0xfff3e8, { roughness: 0.8 }), 0, 0.05, 0));
      g.add(sph(0.014, M(0xd8433a), 0, 0.1, 0));
      break;
  }
  return g;
}

function buildHat(add: <O extends T.Object3D>(m: O) => O, look: Look) {
  switch (look.hat ?? 'ingen') {
    case 'hue': {
      const m = M(look.extra ?? 0xc94f3d, { roughness: 0.95 });
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
    case 'baret': {
      const m = M(look.extra ?? 0x2a2a35, { roughness: 0.9 });
      const b = add(sph(0.37, m, -0.04, 0.33, 0));
      b.scale.set(1.12, 0.4, 1.1);
      b.rotation.z = 0.18;
      add(sph(0.028, m, -0.06, 0.48, 0));
      break;
    }
    case 'solhat': {
      const straw = M(0xe8cf8a, { roughness: 0.9 });
      const brim = add(cyl(0.62, 0.62, 0.025, straw, 0, 0.22, 0, 32));
      brim.rotation.x = 0.08;
      add(cyl(0.28, 0.32, 0.2, straw, 0, 0.32, 0, 24));
      add(cyl(0.325, 0.325, 0.05, M(look.extra ?? 0xc94f3d), 0, 0.25, 0, 24));
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

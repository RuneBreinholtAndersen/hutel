import { PET_KINDS, type PetAct, type PetView } from '@hutel/shared';
import { cyl, M, rbox, sph, T } from './helpers';

const dark = M(0x2a1a12, { roughness: 0.5 });
const white = M(0xffffff, { roughness: 0.4 });

/** Small round eyes with a white glint, like the avatars. */
function eyes(g: T.Group, y: number, z: number, gap: number, size = 0.045) {
  for (const s of [-1, 1]) {
    g.add(sph(size, dark, s * gap, y, z));
    g.add(sph(size * 0.35, white, s * gap + 0.012, y + 0.015, z + size * 0.8));
  }
}

function dog(c: number) {
  const g = new T.Group();
  const fur = M(c, { roughness: 0.8 });
  const light = M(0xf4efe6, { roughness: 0.8 });
  g.add(rbox(0.26, 0.2, 0.42, fur, 0, 0.24, 0, 0.09));
  for (const [x, z] of [
    [-0.08, 0.13],
    [0.08, 0.13],
    [-0.08, -0.13],
    [0.08, -0.13],
  ] as const)
    g.add(cyl(0.035, 0.035, 0.16, fur, x, 0.08, z));
  const head = new T.Group();
  head.position.set(0, 0.42, 0.22);
  head.add(rbox(0.24, 0.22, 0.22, fur, 0, 0, 0, 0.09));
  head.add(rbox(0.13, 0.09, 0.12, light, 0, -0.04, 0.13, 0.04));
  head.add(sph(0.03, dark, 0, -0.01, 0.2));
  eyes(head, 0.04, 0.11, 0.06);
  for (const s of [-1, 1]) {
    const ear = rbox(0.06, 0.14, 0.09, M(c, { roughness: 0.9 }), s * 0.13, 0.0, -0.02, 0.03);
    ear.rotation.z = s * 0.35;
    head.add(ear);
  }
  head.name = 'head';
  g.add(head);
  const tail = cyl(0.025, 0.018, 0.2, fur, 0, 0.34, -0.24);
  tail.rotation.x = -0.9;
  tail.name = 'tail';
  g.add(tail);
  return g;
}

function cat(c: number) {
  const g = new T.Group();
  const fur = M(c, { roughness: 0.8 });
  g.add(rbox(0.2, 0.17, 0.36, fur, 0, 0.2, 0, 0.08));
  for (const [x, z] of [
    [-0.06, 0.11],
    [0.06, 0.11],
    [-0.06, -0.11],
    [0.06, -0.11],
  ] as const)
    g.add(cyl(0.028, 0.028, 0.13, fur, x, 0.065, z));
  const head = new T.Group();
  head.position.set(0, 0.36, 0.18);
  head.add(sph(0.12, fur, 0, 0, 0));
  for (const s of [-1, 1]) {
    const ear = new T.Mesh(new T.ConeGeometry(0.045, 0.09, 4), fur);
    ear.position.set(s * 0.07, 0.11, 0);
    ear.castShadow = true;
    head.add(ear);
  }
  head.add(sph(0.018, M(0xe58a9a), 0, -0.02, 0.115));
  eyes(head, 0.03, 0.095, 0.05, 0.035);
  head.name = 'head';
  g.add(head);
  const tail = cyl(0.02, 0.015, 0.32, fur, 0, 0.35, -0.22);
  tail.rotation.x = -0.35;
  tail.name = 'tail';
  g.add(tail);
  return g;
}

function dragon(c: number) {
  const g = new T.Group();
  const scale = M(c, { roughness: 0.55 });
  const belly = M(0xf2d08a, { roughness: 0.7 });
  g.add(rbox(0.28, 0.24, 0.4, scale, 0, 0.3, 0, 0.1));
  g.add(rbox(0.2, 0.14, 0.3, belly, 0, 0.24, 0.04, 0.06));
  for (const [x, z] of [
    [-0.09, 0.12],
    [0.09, 0.12],
    [-0.09, -0.12],
    [0.09, -0.12],
  ] as const)
    g.add(cyl(0.04, 0.035, 0.18, scale, x, 0.09, z));
  const head = new T.Group();
  head.position.set(0, 0.52, 0.2);
  head.add(rbox(0.24, 0.2, 0.26, scale, 0, 0, 0, 0.08));
  head.add(rbox(0.16, 0.1, 0.12, scale, 0, -0.04, 0.16, 0.04));
  for (const s of [-1, 1]) {
    const horn = new T.Mesh(new T.ConeGeometry(0.03, 0.12, 6), belly);
    horn.position.set(s * 0.08, 0.13, -0.04);
    horn.rotation.x = -0.4;
    head.add(horn);
  }
  eyes(head, 0.04, 0.12, 0.07);
  head.name = 'head';
  g.add(head);
  for (const s of [-1, 1]) {
    const wing = new T.Group();
    wing.position.set(s * 0.14, 0.42, -0.02);
    const membrane = new T.Mesh(
      new T.BoxGeometry(0.34, 0.02, 0.24),
      M(c, { roughness: 0.6, emissive: c, emissiveIntensity: 0.15 }),
    );
    membrane.position.x = s * 0.17;
    wing.add(membrane);
    wing.name = s < 0 ? 'wingL' : 'wingR';
    wing.rotation.z = s * 0.5;
    g.add(wing);
  }
  const tail = cyl(0.05, 0.015, 0.36, scale, 0, 0.26, -0.3);
  tail.rotation.x = -1.2;
  tail.name = 'tail';
  g.add(tail);
  return g;
}

const BUILD = { hund: dog, kat: cat, drage: dragon } as const;

/** A pet that trots after its owner. Pure visuals – the server owns XP, food and tricks. */
export class Pet {
  readonly obj = new T.Group();
  private body: T.Group;
  private act: PetAct | null = null;
  private actT = 0;
  private time = Math.random() * 10;
  private face = 0;
  x = 0;
  z = 0;
  y = 0;
  private gy = 0;

  constructor(
    public view: PetView,
    readonly ownerId: string,
    scene: T.Scene,
    start: { x: number; z: number },
  ) {
    const kind = PET_KINDS[view.kind];
    this.body = BUILD[view.kind](kind.colors[view.color] ?? kind.colors[0]);
    // Grows a little with each level.
    const s = 1.3 + Math.min(view.level - 1, 9) * 0.04;
    this.body.scale.setScalar(s);
    this.obj.add(this.body);
    this.obj.traverse((m) => (m.userData.petOwner = ownerId));
    this.x = start.x + 0.6;
    this.z = start.z + 0.6;
    this.obj.position.set(this.x, 0, this.z);
    scene.add(this.obj);
  }

  play(act: PetAct) {
    this.act = act;
    this.actT = 0;
  }

  update(dt: number, owner: { x: number; z: number }, ground = 0) {
    this.time += dt;
    const dx = owner.x - this.x;
    const dz = owner.z - this.z;
    const d = Math.hypot(dx, dz);
    const busy = this.act !== null && this.act !== 'happy';
    let moving = false;
    // Keep about one tile behind the owner; run to catch up when far away.
    if (d > 0.85 && !busy) {
      const speed = Math.min(6, 1.8 + (d - 0.85) * 3);
      const step = Math.min(d - 0.8, speed * dt);
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
      this.face = Math.atan2(dx, dz);
      moving = true;
    } else if (d > 0.01 && !busy) {
      this.face +=
        (((Math.atan2(dx, dz) - this.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * dt * 2;
    }
    if (d > 6) {
      // Teleported owner (new room spot): just appear next to them.
      this.x = owner.x - 0.6;
      this.z = owner.z + 0.4;
    }
    const b = this.body;
    const head = b.getObjectByName('head');
    const tail = b.getObjectByName('tail');
    const flying = this.view.kind === 'drage';
    b.rotation.set(0, 0, 0);
    b.position.set(0, 0, 0);
    let y = flying ? 0.12 + Math.sin(this.time * 2.4) * 0.05 : 0;
    if (moving) y += Math.abs(Math.sin(this.time * 14)) * 0.05;
    if (tail) tail.rotation.y = Math.sin(this.time * (moving ? 14 : 6)) * 0.5;
    if (head) head.rotation.set(0, 0, 0);
    for (const n of ['wingL', 'wingR']) {
      const w = b.getObjectByName(n);
      if (w)
        w.rotation.z =
          (n === 'wingL' ? 1 : -1) * (-0.5 - Math.sin(this.time * (moving ? 16 : 5)) * 0.4);
    }
    if (this.act) {
      this.actT += dt;
      const t = this.actT;
      const len = this.act === 'roll' || this.act === 'dance' ? 1.6 : 1.4;
      if (this.act === 'sit') {
        b.rotation.x = -0.45;
        b.position.y = -0.05;
      } else if (this.act === 'jump') y += Math.abs(Math.sin(t * 7)) * 0.4;
      else if (this.act === 'roll') {
        b.rotation.z = Math.min(1, t / 1.2) * Math.PI * 2;
        y += 0.08;
      } else if (this.act === 'beg') {
        b.rotation.x = -0.9;
        y += 0.08;
        if (head) head.rotation.x = 0.4;
      } else if (this.act === 'dance') {
        b.rotation.y = t * 8;
        y += Math.abs(Math.sin(t * 10)) * 0.12;
      } else if (this.act === 'eat') {
        if (head) head.rotation.x = 0.5 + Math.sin(t * 16) * 0.2;
      } else if (this.act === 'happy') y += Math.abs(Math.sin(t * 12)) * 0.12;
      else if (this.act === 'sulk') {
        b.position.y = -0.04;
        if (head) head.rotation.x = 0.5;
      }
      if (t > len) this.act = null;
    }
    this.gy += (ground - this.gy) * Math.min(1, dt * 12);
    this.y = y;
    this.obj.position.set(this.x, y + this.gy, this.z);
    this.obj.rotation.y = this.face;
  }

  dispose(scene: T.Scene) {
    scene.remove(this.obj);
  }
}

import {
  footprint,
  ACTIONS,
  ACTION_MS,
  type ActionKind,
  furniture,
  positionAt,
  RUN_MULTIPLIER,
  WALK_SPEED,
  type Look,
  type PlacedItem,
  type PlayerView,
} from '@hutel/shared';
import { buildCarry, buildParts, makeAvatar, parts } from './gfx/avatar';
import { canvasTex, lerpAngle, lin, M, rnd, T, tw } from './gfx/helpers';

let glowTex: T.Texture | null = null;
const glowTexture = () =>
  (glowTex ??= canvasTex(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,220,140,0.9)');
    g.addColorStop(0.4, 'rgba(255,190,90,0.35)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  }));

/** The visual side of one player: follows the server path and animates. */
export class Actor {
  readonly obj: T.Group;
  readonly tag: HTMLDivElement;
  from: [number, number];
  path: [number, number][];
  pathStart: number;
  run: boolean;
  seatId: number | null;
  action: ActionKind | null;
  private actionAt = 0;
  private face = 0;
  private phase = Math.random() * 10;
  private blink = rnd(1, 4);
  private time = Math.random() * 10;
  x = 0;
  z = 0;
  walking = false;

  constructor(
    public view: PlayerView,
    scene: T.Scene,
    overlay: HTMLElement,
    public isMe: boolean,
  ) {
    this.obj = makeAvatar(view.look);
    this.obj.traverse((m) => (m.userData.playerId = view.id));
    scene.add(this.obj);
    this.tag = document.createElement('div');
    this.tag.className = 'tag' + (isMe ? ' me' : '') + (view.bot ? ' bot' : '');
    this.setTag(view.level);
    overlay.appendChild(this.tag);
    this.from = [view.x, view.z];
    this.path = view.path;
    this.pathStart = view.pathStart;
    this.run = view.run;
    this.seatId = view.seatId;
    this.action = view.action;
    this.x = view.x;
    this.z = view.z;
    this.setCarry(view.carry ?? null);
    this.setEffect(view.effect);
  }

  carry: string | null = null;
  private carryObj: T.Object3D | null = null;
  /** Something to hold in the right hand. */
  setCarry(kind: string | null) {
    this.view.carry = kind as PlayerView['carry'];
    this.carry = kind;
    const arm = parts(this.obj).armR;
    if (this.carryObj) arm.remove(this.carryObj);
    this.carryObj = null;
    if (!kind) return;
    const o = buildCarry(kind);
    o.position.set(0, -0.34, 0.07);
    arm.add(o);
    this.carryObj = o;
  }

  private fx: T.Group | null = null;
  private fxKind = 'none';
  /** Glow, coloured shadow, sparkles or a party aura. */
  setEffect(effect: string | undefined) {
    this.view.effect = effect;
    if (this.fx) this.obj.remove(this.fx);
    this.fx = null;
    this.fxKind = effect ?? 'none';
    if (!effect || effect === 'none') return;
    const g = new T.Group();
    if (effect === 'shadowPink' || effect === 'shadowBlue') {
      const disc = new T.Mesh(
        new T.CircleGeometry(0.42, 32),
        new T.MeshBasicMaterial({
          color: lin(effect === 'shadowPink' ? 0xff6fae : 0x4fa8ff),
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      g.add(disc);
    } else if (effect === 'glow') {
      const sp = new T.Sprite(
        new T.SpriteMaterial({
          map: glowTexture(),
          blending: T.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      sp.scale.set(2.1, 2.1, 1);
      sp.position.y = 0.75;
      g.add(sp);
    } else if (effect === 'sparkle' || effect === 'aura') {
      const col = effect === 'sparkle' ? 0xfff0a8 : 0xff8fd8;
      const mat = M(col, { emissive: col, emissiveIntensity: 2.5 });
      for (let i = 0; i < 10; i++) {
        const m = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), mat);
        m.userData.k = i;
        g.add(m);
      }
      if (effect === 'aura') {
        const ring = new T.Mesh(new T.TorusGeometry(0.45, 0.02, 8, 40), mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.04;
        ring.userData.ring = true;
        g.add(ring);
      }
    }
    this.obj.add(g);
    this.fx = g;
  }

  get id() {
    return this.view.id;
  }

  setPath(
    from: [number, number],
    path: [number, number][],
    pathStart: number,
    run: boolean,
    seatId: number | null,
  ) {
    this.from = from;
    this.path = path;
    this.pathStart = pathStart;
    this.run = run;
    this.seatId = path.length ? null : seatId;
    this.pendingSeat = seatId;
    if (this.action && !ACTIONS[this.action].timed) this.action = null;
  }
  private pendingSeat: number | null = null;

  private animateFx() {
    if (!this.fx || (this.fxKind !== 'sparkle' && this.fxKind !== 'aura')) return;
    const t = this.time;
    for (const c of this.fx.children) {
      if (c.userData.ring) {
        const k = 1 + Math.sin(t * 3) * 0.06;
        c.scale.set(k, k, k);
        continue;
      }
      const i = c.userData.k as number;
      const a = t * (this.fxKind === 'aura' ? 1.2 : 2) + (i / 10) * Math.PI * 2;
      const rise = (t * 0.35 + i * 0.1) % 1;
      const rad = this.fxKind === 'aura' ? 0.45 : 0.35 + Math.sin(t + i) * 0.05;
      c.position.set(
        Math.cos(a) * rad,
        this.fxKind === 'aura' ? rise * 1.4 : 0.6 + Math.sin(a * 2) * 0.35,
        Math.sin(a) * rad,
      );
      c.scale.setScalar(this.fxKind === 'aura' ? 1 - rise : 0.7 + Math.sin(t * 6 + i) * 0.3);
    }
  }

  setAction(kind: ActionKind | null) {
    this.action = kind;
    this.actionAt = this.time;
  }

  setLook(look: Look) {
    this.view.look = look;
    buildParts(this.obj, look);
  }

  /** The next waypoint the avatar is walking towards (or its tile when standing). */
  heading(now: number): [number, number] {
    if (!this.walking || !this.path.length) return this.tile();
    const speed = WALK_SPEED * (this.run ? RUN_MULTIPLIER : 1);
    let d = Math.max(0, (now - this.pathStart) / 1000) * speed;
    let [px, pz] = this.from;
    for (const [nx, nz] of this.path) {
      d -= Math.hypot(nx - px, nz - pz);
      if (d < 0) return [nx, nz];
      px = nx;
      pz = nz;
    }
    return [px, pz];
  }

  /** Name tag: name followed by the level (AI residents get 🤖 instead). */
  setTag(level?: number) {
    this.view.level = level;
    this.tag.textContent = (this.view.bot ? '🤖 ' : '') + this.view.name;
    if (!this.view.bot && level) {
      const lv = document.createElement('span');
      lv.className = 'lv';
      lv.textContent = `Lv ${level}`;
      this.tag.append(lv);
    }
  }

  /** Arrow-key walking: place the figure directly (no path) and keep the walk animation going. */
  glide(x: number, z: number, run: boolean, face: number) {
    this.from = [x, z];
    this.path = [];
    this.run = run;
    this.face = face;
    this.seatId = null;
    this.pendingSeat = null;
    if (this.action && !ACTIONS[this.action].timed) this.action = null;
    this.glideAt = this.time;
  }
  private glideAt = -1;

  /** Tile the avatar is on (or heading to). */
  tile(): [number, number] {
    return [Math.round(this.x), Math.round(this.z)];
  }

  /** Current ground height under the figure (eases between steps). */
  private hy = 0;

  update(
    dt: number,
    now: number,
    items: Map<number, PlacedItem>,
    ground: (x: number, z: number) => number = () => 0,
  ) {
    const u = parts(this.obj);
    this.time += dt;
    const pos = positionAt(this.from, this.path, this.pathStart, this.run, now);
    this.x = pos.x;
    this.z = pos.z;
    this.walking = !pos.done || this.time - this.glideAt < 0.08;
    if (pos.done && this.path.length) {
      this.from = [this.path[this.path.length - 1]![0], this.path[this.path.length - 1]![1]];
      this.path = [];
      this.seatId = this.pendingSeat;
    }
    const seat = this.seatId !== null ? items.get(this.seatId) : undefined;
    // Only paths steer the face; arrow-key glides set it themselves.
    if (this.path.length && !pos.done && (pos.dir[0] || pos.dir[1]))
      this.face = Math.atan2(pos.dir[0], pos.dir[1]);
    // In the bathtub you lean back in the water instead of lying flat on top of it.
    const bath = !!seat && seat.type === 'bathtub';
    const lying = !!seat && !!furniture(seat.type).lie && !bath;
    // Lie down on beds and loungers: tip the rig over, head towards the back.
    const sleepingOnFloor = !this.walking && this.action === 'sleep' && !seat;
    const tilt = bath
      ? -1.05
      : lying
        ? -Math.PI / 2 + 0.12
        : sleepingOnFloor
          ? -Math.PI / 2 + 0.25
          : 0;
    u.rig.rotation.x += (tilt - u.rig.rotation.x) * Math.min(1, dt * 8);
    // The tub is long along its own x axis, so turn the body along it (feet to the tap).
    if (seat) this.obj.rotation.y = ((seat.rot + (bath ? 1 : 0)) * Math.PI) / 2;
    else this.obj.rotation.y = lerpAngle(this.obj.rotation.y, this.face, Math.min(1, dt * 14));

    const runF = this.run ? 1.5 : 1;
    this.phase += dt * 11 * (this.walking ? runF : 1);
    const s = Math.sin(this.phase);
    const amp = this.run ? 0.85 : 0.55;
    let bob = 0;
    if (this.walking) {
      u.legL.rotation.x = s * amp;
      u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * amp;
      u.armR.rotation.x = s * amp;
      u.armR.rotation.z = 0;
      bob = Math.abs(Math.cos(this.phase)) * (this.run ? 0.09 : 0.05);
    } else if (bath) {
      u.legL.rotation.x = u.legR.rotation.x = -0.5;
      u.armL.rotation.x = u.armR.rotation.x = 0.3;
    } else if (lying) {
      u.legL.rotation.x = u.legR.rotation.x = 0;
      u.armL.rotation.x = u.armR.rotation.x = 0.1;
    } else if (seat) {
      u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2;
      u.armL.rotation.x = u.armR.rotation.x = -0.35;
    } else {
      for (const l of [u.legL, u.legR, u.armL, u.armR]) l.rotation.x *= 0.8;
      bob = Math.sin(this.time * 2) * 0.012;
    }
    if (this.action && ACTIONS[this.action].timed && this.time - this.actionAt > ACTION_MS / 1000)
      this.action = null;
    const act = this.walking ? null : this.action;
    const floorSit = act === 'sitfloor' && !seat;
    const asleep = act === 'sleep' && !seat;
    if (floorSit) {
      u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2;
      u.armL.rotation.x = u.armR.rotation.x = -0.25;
    }
    if (asleep) {
      // Curled up on the floor, gently breathing.
      u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2;
      u.armL.rotation.x = u.armR.rotation.x = -0.9;
    }
    if (act === 'hug') {
      u.armL.rotation.x = u.armR.rotation.x = -1.35;
      u.armL.rotation.z = -0.35;
      u.armR.rotation.z = 0.35;
    } else if (act === 'highfive') {
      const k = Math.min(1, (this.time - this.actionAt) * 4);
      u.armR.rotation.z = 2.9 * k;
      u.armR.rotation.x = -0.3;
    } else if (act === 'think') {
      u.armR.rotation.x = -2.1;
      u.armR.rotation.z = 0.5;
      u.head.rotation.x = -0.12;
    } else if (act === 'wave') {
      u.armR.rotation.z = 2.6 + Math.sin(this.time * 12) * 0.35;
      u.armR.rotation.x = 0;
    } else if (act === 'dance' && !seat) {
      const d = Math.sin(this.time * 8);
      bob = Math.abs(d) * 0.08;
      u.armL.rotation.z = -2.2 - d * 0.4;
      u.armR.rotation.z = 2.2 - d * 0.4;
      this.obj.rotation.y += dt * 2.5;
    } else {
      u.armR.rotation.z *= 0.8;
      u.armL.rotation.z *= 0.8;
    }
    // Holding something: keep the right arm forward instead of swinging it.
    if (this.carry && act !== 'wave' && act !== 'highfive' && act !== 'dance' && !lying)
      u.armR.rotation.x = this.walking ? -0.7 : -0.9;
    this.animateFx();
    u.head.rotation.z = Math.sin(this.time * 1.3) * 0.05;
    if (act !== 'think') u.head.rotation.x *= 0.9;
    this.blink -= dt;
    const bs = asleep || this.blink < 0 ? 0.1 : 1;
    u.eyes.forEach((e) => (e.scale.y = bs));
    if (this.blink < -0.13) this.blink = rnd(2, 5);
    const k = this.walking ? (0.05 - bob) * 0.5 : 0;
    u.rig.scale.set(1 + k, 1 - k, 1 + k);
    const g = ground(this.x, this.z);
    this.hy += (g - this.hy) * Math.min(1, dt * 14);
    if (Math.abs(g - this.hy) > 1.5) this.hy = g;
    const sitY = floorSit ? -0.28 : asleep ? 0.1 + Math.sin(this.time * 1.5) * 0.01 : bob;
    this.obj.position.set(tw(this.x), (lying ? 0.62 : seat ? 0.27 : sitY) + this.hy, tw(this.z));
    if (bath) {
      // Centre in the tub, sitting low in the water with the head at the far end from the tap.
      const f = footprint(seat!);
      const r = ((seat!.rot + 1) * Math.PI) / 2;
      this.obj.position.set(
        tw(seat!.x) + (f.w - 1) / 2 + Math.sin(r) * 0.4,
        0.22 + this.hy,
        tw(seat!.z) + (f.d - 1) / 2 + Math.cos(r) * 0.4,
      );
    } else if (lying) {
      // shift so the body lies along the bed (head on the pillow side)
      const r = (seat!.rot * Math.PI) / 2;
      this.obj.position.x -= Math.sin(r) * 0.35;
      this.obj.position.z -= Math.cos(r) * 0.35;
    }
  }

  dispose(scene: T.Scene) {
    scene.remove(this.obj);
    this.tag.remove();
  }
}

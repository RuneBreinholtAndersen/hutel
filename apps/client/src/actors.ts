import {
  positionAt,
  RUN_MULTIPLIER,
  WALK_SPEED,
  type Look,
  type PlacedItem,
  type PlayerView,
} from '@hutel/shared';
import { buildParts, makeAvatar, parts } from './gfx/avatar';
import { lerpAngle, rnd, T, tw } from './gfx/helpers';

/** The visual side of one player: follows the server path and animates. */
export class Actor {
  readonly obj: T.Group;
  readonly tag: HTMLDivElement;
  from: [number, number];
  path: [number, number][];
  pathStart: number;
  run: boolean;
  seatId: number | null;
  action: 'wave' | 'dance' | null;
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
    this.tag.textContent = (view.bot ? '🤖 ' : '') + view.name;
    overlay.appendChild(this.tag);
    this.from = [view.x, view.z];
    this.path = view.path;
    this.pathStart = view.pathStart;
    this.run = view.run;
    this.seatId = view.seatId;
    this.action = view.action;
    this.x = view.x;
    this.z = view.z;
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
    if (this.action === 'dance') this.action = null;
  }
  private pendingSeat: number | null = null;

  setAction(kind: 'wave' | 'dance' | null) {
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

  /** Arrow-key walking: place the figure directly (no path) and keep the walk animation going. */
  glide(x: number, z: number, run: boolean, face: number) {
    this.from = [x, z];
    this.path = [];
    this.run = run;
    this.face = face;
    this.seatId = null;
    this.pendingSeat = null;
    if (this.action === 'dance') this.action = null;
    this.glideAt = this.time;
  }
  private glideAt = -1;

  /** Tile the avatar is on (or heading to). */
  tile(): [number, number] {
    return [Math.round(this.x), Math.round(this.z)];
  }

  update(dt: number, now: number, items: Map<number, PlacedItem>) {
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
    if (seat) this.obj.rotation.y = (seat.rot * Math.PI) / 2;
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
    } else if (seat) {
      u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2;
      u.armL.rotation.x = u.armR.rotation.x = -0.35;
    } else {
      for (const l of [u.legL, u.legR, u.armL, u.armR]) l.rotation.x *= 0.8;
      bob = Math.sin(this.time * 2) * 0.012;
    }
    if (this.action === 'wave' && !this.walking) {
      if (this.time - this.actionAt > 2.5) this.action = null;
      u.armR.rotation.z = 2.6 + Math.sin(this.time * 12) * 0.35;
      u.armR.rotation.x = 0;
    } else if (this.action === 'dance' && !this.walking && !seat) {
      const d = Math.sin(this.time * 8);
      bob = Math.abs(d) * 0.08;
      u.armL.rotation.z = -2.2 - d * 0.4;
      u.armR.rotation.z = 2.2 - d * 0.4;
      this.obj.rotation.y += dt * 2.5;
    } else {
      u.armR.rotation.z *= 0.8;
      u.armL.rotation.z *= 0.8;
    }
    u.head.rotation.z = Math.sin(this.time * 1.3) * 0.05;
    this.blink -= dt;
    const bs = this.blink < 0 ? 0.1 : 1;
    u.eyes.forEach((e) => (e.scale.y = bs));
    if (this.blink < -0.13) this.blink = rnd(2, 5);
    const k = this.walking ? (0.05 - bob) * 0.5 : 0;
    u.rig.scale.set(1 + k, 1 - k, 1 + k);
    this.obj.position.set(tw(this.x), seat ? 0.27 : bob, tw(this.z));
  }

  dispose(scene: T.Scene) {
    scene.remove(this.obj);
    this.tag.remove();
  }
}

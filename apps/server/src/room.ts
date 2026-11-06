import {
  buildGrid,
  canPlace,
  DOOR_TILE,
  findPath,
  furniture,
  positionAt,
  RUN_MULTIPLIER,
  WALK_SPEED,
  tilesOf,
  themeWallBlocks,
  type Look,
  type PlacedItem,
  type PlayerView,
  type PetView,
  type RoomShape,
  type RoomCategory,
  type TileHeights,
  canStep,
  type RoomAccess,
  type RoomTheme,
  type RoomView,
  type ServerMsg,
  type Tile,
} from '@hutel/shared';

export interface PlayerState {
  id: string;
  name: string;
  look: Look;
  bot: boolean;
  from: [number, number];
  path: [number, number][];
  pathStart: number;
  run: boolean;
  seatId: number | null;
  /** Seat we are walking towards; becomes seatId on arrival. */
  goalSeat: number | null;
  action: 'wave' | 'dance' | null;
  actionUntil: number;
  send: ((msg: ServerMsg) => void) | null;
  /** Icon of the badge shown by the name. */
  badge?: string;
  level?: number;
  pet?: PetView;
  /** Time of the last arrow-key glide (for the speed check). */
  lastGlide?: number;
  /** Users whose chat this player does not want to see. */
  blocked: () => readonly string[];
}

export interface RoomMeta {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
  /** Floor size in tiles (square). */
  size: number;
  shape: RoomShape;
  category: RoomCategory;
  heights: TileHeights;
  paidSize: number;
  wall: string | null;
  floor: string | null;
  isPublic: boolean;
  ownerId: string | null;
  ownerName: string | null;
  access: RoomAccess;
}

export interface RoomHooks {
  onArrive(room: RoomInstance, p: PlayerState, tile: Tile, seated: boolean): void;
  canBuild(room: RoomInstance, userId: string): boolean;
}

export class RoomInstance {
  readonly players = new Map<string, PlayerState>();

  constructor(
    public meta: RoomMeta,
    /** Live reference: for guest rooms this is the stored array, so edits persist. */
    public items: PlacedItem[],
    private readonly hooks: RoomHooks,
  ) {}

  /** Size and floor plan, for the grid and placement rules. */
  floor() {
    return { size: this.meta.size, shape: this.meta.shape, heights: this.meta.heights };
  }

  humans(): PlayerState[] {
    return [...this.players.values()].filter((p) => !p.bot);
  }

  tileOf(p: PlayerState, now = Date.now()): Tile {
    const pos = positionAt(p.from, p.path, p.pathStart, p.run, now);
    return [Math.round(pos.x), Math.round(pos.z)];
  }

  occupiedTiles(except?: string): Tile[] {
    const now = Date.now();
    return [...this.players.values()]
      .filter((p) => p.id !== except)
      .map((p) => this.tileOf(p, now));
  }

  view(p: PlayerState): PlayerView {
    return {
      id: p.id,
      name: p.name,
      look: p.look,
      x: p.from[0],
      z: p.from[1],
      path: p.path,
      pathStart: p.pathStart,
      run: p.run,
      seatId: p.seatId,
      action: p.action,
      bot: p.bot,
      badge: p.badge,
      level: p.level,
      pet: p.pet,
    };
  }

  roomView(forUser: string): RoomView {
    return {
      id: this.meta.id,
      name: this.meta.name,
      description: this.meta.description,
      theme: this.meta.theme,
      size: this.meta.size,
      shape: this.meta.shape,
      category: this.meta.category,
      heights: this.meta.heights,
      paidSize: this.meta.paidSize,
      wall: this.meta.wall,
      floor: this.meta.floor,
      ownerId: this.meta.ownerId,
      ownerName: this.meta.ownerName,
      access: this.meta.access,
      canBuild: this.hooks.canBuild(this, forUser),
      items: this.items,
      players: [...this.players.values()].map((p) => this.view(p)),
    };
  }

  broadcast(msg: ServerMsg, opts: { except?: string; fromUser?: string } = {}) {
    for (const p of this.players.values()) {
      if (!p.send || p.id === opts.except) continue;
      if (opts.fromUser && p.blocked().includes(opts.fromUser)) continue;
      p.send(msg);
    }
  }

  /** Adds a player at the door (or the nearest free tile). */
  add(p: PlayerState, at: Tile = DOOR_TILE) {
    const grid = buildGrid(this.floor(), this.items);
    const taken = new Set(this.occupiedTiles(p.id).map((t) => t.join()));
    const free = (x: number, z: number) => grid.cells[x]![z] === 0 && !taken.has(`${x},${z}`);
    let start: Tile = at;
    if (!free(at[0], at[1])) {
      outer: for (let r = 1; r < this.meta.size; r++)
        for (let x = 0; x < this.meta.size; x++)
          for (let z = 0; z < this.meta.size; z++)
            if (Math.max(Math.abs(x - at[0]), Math.abs(z - at[1])) === r && free(x, z)) {
              start = [x, z];
              break outer;
            }
    }
    Object.assign(p, {
      from: [start[0], start[1]],
      path: [],
      pathStart: Date.now(),
      seatId: null,
      goalSeat: null,
      action: null,
    });
    this.players.set(p.id, p);
    this.broadcast({ t: 'playerJoin', player: this.view(p) }, { except: p.id });
  }

  remove(id: string) {
    if (this.players.delete(id)) this.broadcast({ t: 'playerLeave', id });
  }

  /** Re-anchors a player at the tile they are on right now. */
  private settle(p: PlayerState, now: number): Tile {
    const tile = this.tileOf(p, now);
    p.from = [tile[0], tile[1]];
    p.path = [];
    p.pathStart = now;
    return tile;
  }

  /**
   * Arrow-key walking: the client moves freely and reports its position ~10×/s.
   * The server caps the speed, keeps the figure inside the room and off furniture.
   */
  glide(p: PlayerState, x: number, z: number, run = false): boolean {
    const now = Date.now();
    const cur = positionAt(p.from, p.path, p.pathStart, p.run, now);
    const dt = Math.min(1, (now - (p.lastGlide ?? now - 200)) / 1000);
    p.lastGlide = now;
    const max = WALK_SPEED * RUN_MULTIPLIER * dt * 1.5 + 0.25;
    const dx = x - cur.x;
    const dz = z - cur.z;
    const d = Math.hypot(dx, dz);
    if (d > max) {
      x = cur.x + (dx / d) * max;
      z = cur.z + (dz / d) * max;
    }
    x = Math.min(this.meta.size - 0.68, Math.max(-0.32, x));
    z = Math.min(this.meta.size - 0.68, Math.max(-0.32, z));
    const tx = Math.round(x);
    const tz = Math.round(z);
    const here = tx === Math.round(cur.x) && tz === Math.round(cur.z);
    const grid = buildGrid(this.floor(), this.items);
    const ok =
      here ||
      (tx >= 0 &&
        tz >= 0 &&
        tx < this.meta.size &&
        tz < this.meta.size &&
        grid.cells[tx]![tz] === 0 &&
        canStep(grid, Math.round(cur.x), Math.round(cur.z), tx, tz));
    p.seatId = null;
    p.goalSeat = null;
    if (p.action === 'dance') p.action = null;
    p.from = [cur.x, cur.z];
    p.path = ok ? [[x, z]] : [];
    p.pathStart = now;
    p.run = run;
    // A rejected glide is sent without `glide` so the player's own client snaps back.
    this.broadcast({
      t: 'path',
      id: p.id,
      path: p.path,
      pathStart: now,
      run,
      seatId: null,
      from: p.from,
      glide: ok || undefined,
    });
    return ok;
  }

  walk(p: PlayerState, goal: Tile, run = false, seatItem?: PlacedItem): boolean {
    const now = Date.now();
    const start = this.settle(p, now);
    const grid = buildGrid(this.floor(), this.items);
    const path = findPath(grid, start, goal, seatItem?.id ?? -1);
    if (!path) return false;
    p.seatId = null;
    p.goalSeat = seatItem?.id ?? null;
    if (p.action === 'dance') p.action = null;
    p.from = [start[0], start[1]];
    p.path = path.map(([x, z]) => [x, z]);
    p.pathStart = now;
    p.run = run;
    if (!path.length) this.arrive(p);
    this.broadcast({
      t: 'path',
      id: p.id,
      path: p.path,
      pathStart: now,
      run,
      seatId: p.goalSeat,
      from: p.from,
    });
    return true;
  }

  sit(p: PlayerState, itemId: number, run = false): boolean {
    const it = this.items.find((i) => i.id === itemId);
    if (!it || !furniture(it.type).seat) return false;
    const taken = new Set(
      [...this.players.values()]
        .filter((o) => o !== p && (o.seatId === itemId || o.goalSeat === itemId))
        .map((o) => this.tileOf(o).join()),
    );
    const here = this.tileOf(p);
    const seats = tilesOf(it)
      .filter((t) => !taken.has(t.join()))
      .sort(
        (a, b) =>
          Math.hypot(a[0] - here[0], a[1] - here[1]) - Math.hypot(b[0] - here[0], b[1] - here[1]),
      );
    for (const s of seats) if (this.walk(p, s, run, it)) return true;
    return false;
  }

  private arrive(p: PlayerState) {
    const seated = p.goalSeat !== null && this.items.some((i) => i.id === p.goalSeat);
    p.seatId = seated ? p.goalSeat : null;
    p.goalSeat = null;
    this.hooks.onArrive(this, p, [Math.round(p.from[0]), Math.round(p.from[1])], seated);
  }

  /** Called ~10×/s: finishes paths and expires short actions. */
  tick(now: number) {
    for (const p of this.players.values()) {
      if (p.path.length) {
        const pos = positionAt(p.from, p.path, p.pathStart, p.run, now);
        if (pos.done) {
          const last = p.path[p.path.length - 1]!;
          p.from = [last[0], last[1]];
          p.path = [];
          p.pathStart = now;
          this.arrive(p);
        }
      }
      if (p.action === 'wave' && now > p.actionUntil) p.action = null;
    }
  }

  /** Stands up anyone sitting on an item that is being moved or removed. */
  standUpFrom(itemId: number) {
    for (const p of this.players.values())
      if (p.seatId === itemId || p.goalSeat === itemId) {
        p.seatId = null;
        p.goalSeat = null;
        this.broadcast({
          t: 'path',
          id: p.id,
          path: [],
          pathStart: Date.now(),
          run: false,
          seatId: null,
          from: p.from,
        });
      }
  }

  placeable(it: PlacedItem): boolean {
    const others = this.items.filter((o) => o.id !== it.id);
    const occupied = [...this.players.values()]
      .filter((p) => p.seatId !== it.id)
      .map((p) => this.tileOf(p));
    return canPlace(
      this.floor(),
      others,
      it,
      occupied,
      themeWallBlocks(this.meta.theme, this.floor()),
    );
  }
}

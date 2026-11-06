import {
  buildGrid, canPlace, DOOR_TILE, findPath, furniture, positionAt, ROOM_SIZE, tilesOf,
  type Look, type PlacedItem, type PlayerView, type RoomAccess, type RoomTheme, type RoomView,
  type ServerMsg, type Tile,
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
  /** Users whose chat this player does not want to see. */
  blocked: () => readonly string[];
}

export interface RoomMeta {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
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

  humans(): PlayerState[] {
    return [...this.players.values()].filter((p) => !p.bot);
  }

  tileOf(p: PlayerState, now = Date.now()): Tile {
    const pos = positionAt(p.from, p.path, p.pathStart, p.run, now);
    return [Math.round(pos.x), Math.round(pos.z)];
  }

  occupiedTiles(except?: string): Tile[] {
    const now = Date.now();
    return [...this.players.values()].filter((p) => p.id !== except).map((p) => this.tileOf(p, now));
  }

  view(p: PlayerState): PlayerView {
    return {
      id: p.id, name: p.name, look: p.look, x: p.from[0], z: p.from[1], path: p.path,
      pathStart: p.pathStart, run: p.run, seatId: p.seatId, action: p.action, bot: p.bot,
    };
  }

  roomView(forUser: string): RoomView {
    return {
      id: this.meta.id, name: this.meta.name, description: this.meta.description, theme: this.meta.theme,
      ownerId: this.meta.ownerId, ownerName: this.meta.ownerName, access: this.meta.access,
      canBuild: this.hooks.canBuild(this, forUser),
      items: this.items, players: [...this.players.values()].map((p) => this.view(p)),
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
    const grid = buildGrid(ROOM_SIZE, this.items);
    let start: Tile = at;
    if (grid.cells[start[0]]![start[1]] !== 0) {
      outer: for (let r = 1; r < ROOM_SIZE; r++)
        for (let x = 0; x < ROOM_SIZE; x++)
          for (let z = 0; z < ROOM_SIZE; z++)
            if (Math.max(Math.abs(x - at[0]), Math.abs(z - at[1])) === r && grid.cells[x]![z] === 0) {
              start = [x, z];
              break outer;
            }
    }
    Object.assign(p, { from: [start[0], start[1]], path: [], pathStart: Date.now(), seatId: null, goalSeat: null, action: null });
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

  walk(p: PlayerState, goal: Tile, run = false, seatItem?: PlacedItem): boolean {
    const now = Date.now();
    const start = p.seatId !== null || p.path.length ? this.settle(p, now) : p.from;
    const grid = buildGrid(ROOM_SIZE, this.items);
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
    this.broadcast({ t: 'path', id: p.id, path: p.path, pathStart: now, run, seatId: p.goalSeat, from: p.from });
    return true;
  }

  sit(p: PlayerState, itemId: number, run = false): boolean {
    const it = this.items.find((i) => i.id === itemId);
    if (!it || !furniture(it.type).seat) return false;
    const taken = new Set(
      [...this.players.values()].filter((o) => o !== p && (o.seatId === itemId || o.goalSeat === itemId)).map((o) => this.tileOf(o).join()),
    );
    const here = this.tileOf(p);
    const seats = tilesOf(it)
      .filter((t) => !taken.has(t.join()))
      .sort((a, b) => Math.hypot(a[0] - here[0], a[1] - here[1]) - Math.hypot(b[0] - here[0], b[1] - here[1]));
    for (const s of seats) if (this.walk(p, s, run, it)) return true;
    return false;
  }

  private arrive(p: PlayerState) {
    const seated = p.goalSeat !== null && this.items.some((i) => i.id === p.goalSeat);
    p.seatId = seated ? p.goalSeat : null;
    p.goalSeat = null;
    this.hooks.onArrive(this, p, p.from, seated);
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
        this.broadcast({ t: 'path', id: p.id, path: [], pathStart: Date.now(), run: false, seatId: null, from: p.from });
      }
  }

  placeable(it: PlacedItem): boolean {
    const others = this.items.filter((o) => o.id !== it.id);
    const occupied = [...this.players.values()]
      .filter((p) => p.seatId !== it.id)
      .map((p) => this.tileOf(p));
    return canPlace(ROOM_SIZE, others, it, occupied);
  }
}

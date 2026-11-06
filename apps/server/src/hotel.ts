import {
  BADGES, ClientMsgSchema, COINS_PER_ONLINE_MINUTE, DOOR_TILE, filterChat, furniture, isGreeting,
  PUBLIC_ROOMS, QUESTS, sanitizeChat, sellPrice, type BadgeId, type ClientMsg, type FriendView, type Me,
  type NavigatorRoom, type PlacedItem, type QuestId, type ServerMsg, type Tile,
} from '@hutel/shared';
import { Bots } from './bots';
import { createLimits, type Bucket, type LimitKind } from './ratelimit';
import { RoomInstance, type PlayerState, type RoomHooks } from './room';
import { hashSecret, type RoomRecord, type Store, type UserRecord } from './store';

export interface HotelConfig {
  /** New guests must finish the starter quests before leaving their own room. */
  onboardingLock: boolean;
  anthropicApiKey?: string;
  botModel: string;
  botMaxCallsPerDay: number;
}

export interface Connection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface Session {
  conn: Connection;
  user: UserRecord | null;
  room: RoomInstance | null;
  player: PlayerState | null;
  limits: Record<LimitKind, Bucket>;
  strikes: number;
}

const LIMIT_FOR: Partial<Record<ClientMsg['t'], LimitKind>> = {
  move: 'move', sit: 'move', chat: 'chat', whisper: 'chat', action: 'move',
  buy: 'build', moveItem: 'build', sellItem: 'build', roomSettings: 'build', rights: 'build', look: 'build',
  friendRequest: 'social', friendRespond: 'social', friendRemove: 'social', block: 'social', report: 'social',
  profile: 'social', motto: 'social', navigator: 'social',
};

export class Hotel {
  private sessions = new Set<Session>();
  private byUser = new Map<string, Session>();
  private rooms = new Map<string, RoomInstance>();
  private bots: Bots;
  private ticker: NodeJS.Timeout;
  private secondTicker: NodeJS.Timeout;

  constructor(
    private readonly store: Store,
    private readonly cfg: HotelConfig,
  ) {
    for (const def of PUBLIC_ROOMS) {
      const meta = { id: def.id, name: def.name, description: def.description, theme: def.theme, isPublic: true, ownerId: null, ownerName: null, access: 'open' as const };
      this.rooms.set(def.id, new RoomInstance(meta, def.items.map((i) => ({ ...i })), this.hooks));
    }
    this.bots = new Bots(
      {
        room: (id) => this.rooms.get(id),
        say: (room, bot, text) => this.sayInRoom(room, bot, text),
        recent: (roomId) => this.store.recentChat(roomId, 8).map((c) => ({ name: c.name, text: c.text })),
      },
      { apiKey: cfg.anthropicApiKey, model: cfg.botModel, maxCallsPerDay: cfg.botMaxCallsPerDay },
    );
    this.ticker = setInterval(() => this.tick(), 100);
    this.secondTicker = setInterval(() => this.everySecond(), 1000);
  }

  stop() {
    clearInterval(this.ticker);
    clearInterval(this.secondTicker);
    this.store.flush();
  }

  get aiEnabled() {
    return this.bots.aiEnabled;
  }

  /* ---------------- connections ---------------- */

  open(conn: Connection) {
    const s: Session = { conn, user: null, room: null, player: null, limits: createLimits(), strikes: 0 };
    this.sessions.add(s);
    return {
      message: (raw: string) => this.onRaw(s, raw),
      close: () => this.onClose(s),
    };
  }

  private send(s: Session, msg: ServerMsg) {
    s.conn.send(JSON.stringify(msg));
  }
  private toast(s: Session, text: string, kind: 'info' | 'error' = 'info') {
    this.send(s, { t: 'toast', text, kind });
  }

  private strike(s: Session) {
    if (++s.strikes > 25) s.conn.close(4008, 'too many invalid messages');
  }

  private onRaw(s: Session, raw: string) {
    if (!s.limits.any.take()) return this.strike(s);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.strike(s);
    }
    const parsed = ClientMsgSchema.safeParse(json);
    if (!parsed.success) return this.strike(s);
    const msg = parsed.data;
    const kind = LIMIT_FOR[msg.t];
    if (kind && !s.limits[kind].take()) {
      if (kind === 'chat') this.toast(s, 'Du skriver lidt hurtigt – vent et øjeblik 🙂');
      return;
    }
    if (msg.t === 'auth') return this.auth(s, msg.token);
    if (msg.t === 'ping') return this.send(s, { t: 'pong', serverTime: Date.now() });
    if (!s.user) return this.strike(s);
    this.handle(s, s.user, msg);
  }

  private onClose(s: Session) {
    this.sessions.delete(s);
    if (s.user && this.byUser.get(s.user.id) === s) {
      this.byUser.delete(s.user.id);
      s.user.lastSeen = new Date().toISOString();
      this.store.touch();
      this.notifyFriendsOf(s.user);
    }
    this.leaveRoom(s);
  }

  private auth(s: Session, token: string) {
    const user = this.store.getUserByToken(token);
    if (!user) {
      this.send(s, { t: 'toast', text: 'Din session er udløbet – opret dig igen.', kind: 'error' });
      return s.conn.close(4001, 'invalid token');
    }
    if (user.bannedUntil && user.bannedUntil > Date.now()) return s.conn.close(4003, 'banned');
    const old = this.byUser.get(user.id);
    if (old && old !== s) {
      this.toast(old, 'Du er logget ind et andet sted.');
      old.conn.close(4000, 'replaced');
      this.onClose(old);
    }
    s.user = user;
    this.byUser.set(user.id, s);
    this.send(s, { t: 'welcome', me: this.me(user), serverTime: Date.now() });
    this.sendFriends(user);
    this.notifyFriendsOf(user);
    this.join(s, user.homeRoomId);
  }

  private me(u: UserRecord): Me {
    return { id: u.id, name: u.name, look: u.look, coins: u.coins, onlineSec: u.onlineSec, quests: u.quests, badges: u.badges, homeRoomId: u.homeRoomId, motto: u.motto };
  }

  /* ---------------- rooms ---------------- */

  private hooks: RoomHooks = {
    onArrive: (room, p, tile, seated) => {
      if (p.bot) return;
      const user = this.store.getUser(p.id);
      const s = this.byUser.get(p.id);
      if (!user || !s) return;
      if (seated) this.quest(s, user, 'sit');
      if (room.meta.id === user.homeRoomId && tile[0] <= 1 && tile[1] >= 1 && tile[1] <= 3) this.quest(s, user, 'walk');
    },
    canBuild: (room, userId) => !!room.meta.ownerId && (room.meta.ownerId === userId || this.roomRecord(room)?.rights.includes(userId) === true),
  };

  private roomRecord(room: RoomInstance): RoomRecord | undefined {
    return room.meta.isPublic ? undefined : this.store.getRoom(room.meta.id);
  }

  private loadRoom(id: string): RoomInstance | undefined {
    const existing = this.rooms.get(id);
    if (existing) return existing;
    const rec = this.store.getRoom(id);
    if (!rec) return undefined;
    const owner = this.store.getUser(rec.ownerId);
    const room = new RoomInstance(
      { id: rec.id, name: rec.name, description: rec.description, theme: 'home', isPublic: false, ownerId: rec.ownerId, ownerName: owner?.name ?? null, access: rec.access },
      rec.items,
      this.hooks,
    );
    this.rooms.set(id, room);
    return room;
  }

  private onboarded(u: UserRecord) {
    return QUESTS.every((q) => u.quests.includes(q.id));
  }

  private join(s: Session, roomId: string, password?: string) {
    const user = s.user!;
    const room = this.loadRoom(roomId);
    if (!room) return this.toast(s, 'Rummet findes ikke længere.', 'error');
    if (room === s.room) return;
    const isHome = roomId === user.homeRoomId;
    if (!isHome && this.cfg.onboardingLock && !this.onboarded(user))
      return this.toast(s, 'Klar dine startopgaver først – så åbner døren 🚪');
    const rec = this.roomRecord(room);
    if (rec && !isHome && !rec.rights.includes(user.id) && user.role === 'user') {
      if (rec.access === 'locked') return this.toast(s, 'Værelset er låst 🔒');
      if (rec.access === 'password') {
        if (!password) return this.send(s, { t: 'needPassword', roomId });
        if (hashSecret(password) !== rec.passwordHash) return this.toast(s, 'Forkert adgangskode', 'error');
      }
    }
    this.leaveRoom(s);
    const player: PlayerState = {
      id: user.id, name: user.name, look: user.look, bot: false, from: [DOOR_TILE[0], DOOR_TILE[1]], path: [], pathStart: Date.now(),
      run: false, seatId: null, goalSeat: null, action: null, actionUntil: 0,
      send: (m) => this.send(s, m), blocked: () => user.blocked,
    };
    room.add(player);
    s.room = room;
    s.player = player;
    this.send(s, { t: 'room', room: room.roomView(user.id), serverTime: Date.now() });
    this.bots.onHumanJoin(room, player);
    this.notifyFriendsOf(user);
  }

  private leaveRoom(s: Session) {
    const room = s.room;
    if (!room || !s.player) return;
    room.remove(s.player.id);
    s.room = null;
    s.player = null;
    if (!room.meta.isPublic && room.humans().length === 0) this.rooms.delete(room.meta.id);
  }

  private navigator(user: UserRecord): NavigatorRoom[] {
    const out: NavigatorRoom[] = PUBLIC_ROOMS.map((r) => ({
      id: r.id, name: r.name, description: r.description, ownerName: null, access: 'open', public: true,
      users: this.rooms.get(r.id)?.humans().length ?? 0,
    }));
    const guest = this.store
      .listRooms()
      .map((rec) => ({ rec, users: this.rooms.get(rec.id)?.humans().length ?? 0 }))
      .filter(({ rec, users }) => users > 0 || rec.ownerId === user.id || user.friends.includes(rec.ownerId))
      .sort((a, b) => b.users - a.users)
      .slice(0, 40)
      .map(({ rec, users }) => ({
        id: rec.id, name: rec.name, description: rec.description, ownerName: this.store.getUser(rec.ownerId)?.name ?? null,
        access: rec.access, users, public: false,
      }));
    return [...out, ...guest];
  }

  /* ---------------- progress ---------------- */

  private coins(s: Session, user: UserRecord, delta: number, reason?: string) {
    user.coins = Math.max(0, user.coins + delta);
    this.store.touch();
    this.send(s, { t: 'coins', coins: user.coins, reason });
  }

  private quest(s: Session, user: UserRecord, id: QuestId) {
    if (user.quests.includes(id)) return;
    const q = QUESTS.find((x) => x.id === id)!;
    user.quests.push(id);
    const all = this.onboarded(user);
    this.send(s, { t: 'quest', id, reward: q.reward, all });
    this.coins(s, user, q.reward);
    if (all) this.badge(s, user, 'onboarded');
  }

  private badge(s: Session | undefined, user: UserRecord, id: BadgeId) {
    if (user.badges.includes(id)) return;
    user.badges.push(id);
    this.store.touch();
    if (s) this.send(s, { t: 'badge', id });
  }

  /* ---------------- chat ---------------- */

  private sayInRoom(room: RoomInstance, p: PlayerState, text: string) {
    room.broadcast({ t: 'chat', id: p.id, name: p.name, text, bot: p.bot }, { fromUser: p.id });
    this.store.logChat({ at: Date.now(), roomId: room.meta.id, userId: p.id, name: p.name, text });
  }

  /* ---------------- message handling ---------------- */

  private handle(s: Session, user: UserRecord, msg: Exclude<ClientMsg, { t: 'auth' } | { t: 'ping' }>) {
    const room = s.room;
    const player = s.player;
    switch (msg.t) {
      case 'join':
        return this.join(s, msg.roomId, msg.password);
      case 'navigator':
        return this.send(s, { t: 'navigator', rooms: this.navigator(user) });
      case 'move':
        if (room && player) room.walk(player, [msg.x, msg.z], msg.run);
        return;
      case 'sit':
        if (room && player) room.sit(player, msg.itemId);
        return;
      case 'chat': {
        if (!room || !player) return;
        const text = filterChat(sanitizeChat(msg.text));
        if (!text) return;
        this.sayInRoom(room, player, text);
        user.stats.chats++;
        if (user.stats.chats >= 100) this.badge(s, user, 'chatty');
        if (isGreeting(text)) this.quest(s, user, 'hello');
        this.bots.onChat(room, player, text);
        return;
      }
      case 'action':
        if (!room || !player) return;
        player.action = msg.kind === 'stop' ? null : msg.kind;
        player.actionUntil = Date.now() + 2500;
        room.broadcast({ t: 'action', id: player.id, kind: player.action });
        return;
      case 'look':
        user.look = msg.look;
        this.store.touch();
        if (player) player.look = msg.look;
        room?.broadcast({ t: 'look', id: user.id, look: msg.look });
        this.quest(s, user, 'look');
        return;
      case 'motto':
        user.motto = filterChat(sanitizeChat(msg.motto)).slice(0, 60);
        this.store.touch();
        return this.toast(s, 'Motto gemt');
      case 'buy':
        return this.buy(s, user, msg.type, msg.x, msg.z, msg.rot);
      case 'moveItem':
        return this.moveItem(s, user, msg.id, msg.x, msg.z, msg.rot);
      case 'sellItem':
        return this.sellItem(s, user, msg.id);
      case 'roomSettings':
        return this.roomSettings(s, user, msg);
      case 'rights':
        return this.rights(s, user, msg.userId, msg.grant);
      case 'friendRequest':
        return this.friendRequest(s, user, msg.name);
      case 'friendRespond':
        return this.friendRespond(s, user, msg.userId, msg.accept);
      case 'friendRemove':
        return this.friendRemove(user, msg.userId);
      case 'whisper':
        return this.whisper(s, user, msg.to, msg.text);
      case 'block':
        return this.block(s, user, msg.userId, msg.block);
      case 'report':
        return this.report(s, user, msg.userId, msg.reason);
      case 'profile':
        return this.profile(s, user, msg.userId);
    }
  }

  private ownRoom(s: Session, user: UserRecord): { room: RoomInstance; rec: RoomRecord } | null {
    const room = s.room;
    const rec = room && this.roomRecord(room);
    if (!room || !rec) return null;
    if (rec.ownerId !== user.id && !rec.rights.includes(user.id)) return null;
    return { room, rec };
  }

  private buy(s: Session, user: UserRecord, type: PlacedItem['type'], x: number, z: number, rot: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id) return this.toast(s, 'Du kan kun købe møbler til dit eget værelse.', 'error');
    const def = furniture(type);
    if (def.noShop) return;
    if (own.rec.items.length >= 120) return this.toast(s, 'Værelset er fyldt helt op.', 'error');
    if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const item: PlacedItem = { id: own.rec.nextItemId, type, x, z, rot };
    if (!own.room.placeable(item)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.rec.nextItemId++;
    own.rec.items.push(item);
    user.stats.buys++;
    this.coins(s, user, -def.price);
    own.room.broadcast({ t: 'itemPut', item });
    this.quest(s, user, 'buy');
    if (user.stats.buys >= 5) this.badge(s, user, 'shopper');
  }

  private moveItem(s: Session, user: UserRecord, id: number, x: number, z: number, rot: number) {
    const own = this.ownRoom(s, user);
    if (!own) return this.toast(s, 'Du har ikke rettigheder her.', 'error');
    const item = own.rec.items.find((i) => i.id === id);
    if (!item) return;
    const moved = { ...item, x, z, rot };
    if (!own.room.placeable(moved)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.room.standUpFrom(id);
    Object.assign(item, { x, z, rot });
    this.store.touch();
    own.room.broadcast({ t: 'itemPut', item });
    user.stats.moves++;
    if (user.homeRoomId === own.rec.id) this.quest(s, user, 'move');
    if (user.stats.moves >= 25) this.badge(s, user, 'decorator');
  }

  private sellItem(s: Session, user: UserRecord, id: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id) return this.toast(s, 'Kun ejeren kan sælge møbler.', 'error');
    const idx = own.rec.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const [item] = own.rec.items.splice(idx, 1);
    own.room.standUpFrom(id);
    own.room.broadcast({ t: 'itemRemove', id });
    this.coins(s, user, sellPrice(item!.type), 'sold');
  }

  private roomSettings(s: Session, user: UserRecord, msg: Extract<ClientMsg, { t: 'roomSettings' }>) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id) return this.toast(s, 'Kun ejeren kan ændre værelset.', 'error');
    const { rec, room } = own;
    if (msg.name) rec.name = filterChat(sanitizeChat(msg.name)).slice(0, 30) || rec.name;
    if (msg.description !== undefined) rec.description = filterChat(sanitizeChat(msg.description)).slice(0, 80);
    if (msg.access) {
      if (msg.access === 'password' && !msg.password && !rec.passwordHash) return this.toast(s, 'Vælg en adgangskode.', 'error');
      rec.access = msg.access;
    }
    if (msg.password) rec.passwordHash = hashSecret(msg.password);
    Object.assign(room.meta, { name: rec.name, description: rec.description, access: rec.access });
    this.store.touch();
    room.broadcast({ t: 'roomMeta', name: rec.name, description: rec.description, access: rec.access });
    this.toast(s, 'Værelset er opdateret');
  }

  private rights(s: Session, user: UserRecord, targetId: string, grant: boolean) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id || targetId === user.id) return;
    const target = this.store.getUser(targetId);
    if (!target) return;
    own.rec.rights = own.rec.rights.filter((r) => r !== targetId);
    if (grant) own.rec.rights.push(targetId);
    this.store.touch();
    this.toast(s, grant ? `${target.name} kan nu flytte møbler her` : `${target.name} har ikke længere rettigheder`);
    const ts = this.byUser.get(targetId);
    if (ts && ts.room === own.room) this.send(ts, { t: 'room', room: own.room.roomView(targetId), serverTime: Date.now() });
  }

  /* ---------------- social ---------------- */

  private friendViews(user: UserRecord): FriendView[] {
    return user.friends
      .map((id) => this.store.getUser(id))
      .filter((f): f is UserRecord => !!f)
      .map((f) => {
        const fs = this.byUser.get(f.id);
        return { id: f.id, name: f.name, online: !!fs, roomId: fs?.room?.meta.id ?? null, roomName: fs?.room?.meta.name ?? null };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'da'));
  }

  private sendFriends(user: UserRecord) {
    const s = this.byUser.get(user.id);
    if (!s) return;
    const requests = user.requests.map((id) => this.store.getUser(id)).filter((u): u is UserRecord => !!u).map((u) => ({ id: u.id, name: u.name }));
    this.send(s, { t: 'friends', friends: this.friendViews(user), requests });
  }

  private notifyFriendsOf(user: UserRecord) {
    for (const id of user.friends) {
      const f = this.store.getUser(id);
      if (f) this.sendFriends(f);
    }
  }

  private friendRequest(s: Session, user: UserRecord, name: string) {
    const target = this.store.getUserByName(name.trim());
    if (!target || target.id === user.id) return this.toast(s, 'Fandt ingen gæst med det navn.', 'error');
    if (user.friends.includes(target.id)) return this.toast(s, `I er allerede venner`);
    if (target.blocked.includes(user.id)) return this.toast(s, 'Venneanmodning sendt');
    if (user.requests.includes(target.id)) return this.friendRespond(s, user, target.id, true);
    if (!target.requests.includes(user.id)) target.requests.push(user.id);
    this.store.touch();
    this.toast(s, 'Venneanmodning sendt');
    const ts = this.byUser.get(target.id);
    if (ts) this.toast(ts, `${user.name} vil gerne være venner 💌`);
    this.sendFriends(target);
  }

  private friendRespond(s: Session, user: UserRecord, otherId: string, accept: boolean) {
    const other = this.store.getUser(otherId);
    user.requests = user.requests.filter((r) => r !== otherId);
    if (other && accept) {
      if (!user.friends.includes(other.id)) user.friends.push(other.id);
      if (!other.friends.includes(user.id)) other.friends.push(user.id);
      other.requests = other.requests.filter((r) => r !== user.id);
      this.toast(s, `Du og ${other.name} er nu venner 🎉`);
      const os = this.byUser.get(other.id);
      if (os) this.toast(os, `${user.name} accepterede din venneanmodning 🎉`);
      for (const u of [user, other]) if (u.friends.length >= 5) this.badge(this.byUser.get(u.id), u, 'social');
      this.sendFriends(other);
    }
    this.store.touch();
    this.sendFriends(user);
  }

  private friendRemove(user: UserRecord, otherId: string) {
    const other = this.store.getUser(otherId);
    user.friends = user.friends.filter((f) => f !== otherId);
    if (other) {
      other.friends = other.friends.filter((f) => f !== user.id);
      this.sendFriends(other);
    }
    this.store.touch();
    this.sendFriends(user);
  }

  private whisper(s: Session, user: UserRecord, to: string, raw: string) {
    const target = this.store.getUser(to);
    if (!target || !user.friends.includes(to)) return this.toast(s, 'Du kan kun skrive privat til venner.', 'error');
    const text = filterChat(sanitizeChat(raw));
    if (!text) return;
    const ts = this.byUser.get(to);
    if (!ts) return this.toast(s, `${target.name} er ikke online lige nu.`);
    const msg: ServerMsg = { t: 'whisper', from: user.id, fromName: user.name, to, text };
    if (!target.blocked.includes(user.id)) this.send(ts, msg);
    this.send(s, msg);
    this.store.logChat({ at: Date.now(), roomId: `pm:${[user.id, to].sort().join(':')}`, userId: user.id, name: user.name, text });
  }

  private block(s: Session, user: UserRecord, otherId: string, block: boolean) {
    if (otherId === user.id) return;
    user.blocked = user.blocked.filter((b) => b !== otherId);
    if (block) {
      user.blocked.push(otherId);
      this.friendRemove(user, otherId);
    }
    this.store.touch();
    this.toast(s, block ? 'Blokeret. Du ser ikke længere deres beskeder.' : 'Blokering fjernet');
  }

  private report(s: Session, user: UserRecord, targetId: string, reason: string) {
    const roomId = s.room?.meta.id ?? null;
    this.store.addReport({
      fromId: user.id, targetId, reason: sanitizeChat(reason).slice(0, 300), roomId,
      context: roomId ? this.store.recentChat(roomId, 20) : [],
    });
    this.toast(s, 'Tak. En moderator kigger på det.');
  }

  private profile(s: Session, user: UserRecord, targetId: string) {
    const target = this.store.getUser(targetId);
    const botPlayer = s.room?.players.get(targetId);
    if (!target && botPlayer?.bot) {
      return this.send(s, { t: 'profile', profile: { id: targetId, name: botPlayer.name, look: botPlayer.look, motto: 'AI-beboer på Hutel 🤖', badges: [], since: '', bot: true, friend: false, blocked: false } });
    }
    if (!target) return;
    this.send(s, {
      t: 'profile',
      profile: {
        id: target.id, name: target.name, look: target.look, motto: target.motto, badges: target.badges,
        since: target.createdAt.slice(0, 10), bot: false, friend: user.friends.includes(target.id), blocked: user.blocked.includes(target.id),
      },
    });
  }

  /* ---------------- timers ---------------- */

  private tick() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      room.tick(now);
      this.bots.tick(room, now);
    }
  }

  private everySecond() {
    for (const s of this.byUser.values()) {
      const u = s.user!;
      u.onlineSec++;
      if (u.onlineSec % 60 === 0) {
        this.coins(s, u, COINS_PER_ONLINE_MINUTE, 'online');
        this.send(s, { t: 'online', onlineSec: u.onlineSec });
      }
      if (u.onlineSec === 3600) this.badge(s, u, 'online1h');
      if (u.onlineSec === 36_000) this.badge(s, u, 'online10h');
    }
    if (this.byUser.size) this.store.touch();
  }

  /** Test helper. */
  roomOf(userId: string): RoomInstance | null {
    return this.byUser.get(userId)?.room ?? null;
  }

  static badgeName(id: BadgeId) {
    return BADGES[id].name;
  }
}

export type { Tile };

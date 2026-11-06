import {
  BADGES,
  EVENTS,
  scheduledEvents,
  type ActiveEvent,
  type AdminReport,
  CLOTHES,
  lookAllowed,
  ClientMsgSchema,
  COINS_PER_ONLINE_MINUTE,
  DOOR_TILE,
  filterChat,
  furniture,
  isGreeting,
  PUBLIC_ROOMS,
  DAILY_BONUS,
  DAILY_POOL,
  dailyQuestsFor,
  danishDate,
  HOTEL_BONUS,
  HOTEL_QUESTS,
  QUESTS,
  tilesOf,
  sanitizeChat,
  sellPrice,
  type BadgeId,
  type DailyId,
  type DailyView,
  type ClientMsg,
  type FriendView,
  type Look,
  type Me,
  type NavigatorRoom,
  type PlacedItem,
  type QuestId,
  type ServerMsg,
  type Tile,
} from '@hutel/shared';
import { Bots } from './bots';
import { createLimits, type Bucket, type LimitKind } from './ratelimit';
import { RoomInstance, type PlayerState, type RoomHooks } from './room';
import { hashSecret, type RoomRecord, type Store, type UserRecord } from './store';
import {
  GAME_COINS_PER_DAY,
  HAND_ICON,
  HANDS,
  isAnswer,
  QUIZ,
  rps,
  type Hand,
  type RoomQuiz,
} from './games';
import { checkOffer, executeTrade, Trade, tradeView, type Offer } from './trade';

export interface HotelConfig {
  /** New guests must finish the starter quests before leaving their own room. */
  onboardingLock: boolean;
  anthropicApiKey?: string;
  botModel: string;
  botMaxCallsPerDay: number;
  /** Test phase: players may reset their own progress ("Start forfra"). */
  allowReset?: boolean;
  /** Names (lower-case) that get the admin role. They should log in with Google (2FA). */
  adminNames?: string[];
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

const GUIDE_TIPS: Record<(typeof QUESTS)[number]['id'], string> = {
  walk: 'Prøv at gå hen til vinduet – brug piletasterne eller klik på gulvet 🪟',
  hello: 'Skriv "hej" i chatten nederst, så siger jeg hej tilbage 👋',
  sit: 'Klik på sofaen eller lænestolen for at sætte dig 🛋️',
  look: 'Tryk på Figur nederst og giv dig selv et nyt look 👕',
  move: 'Tryk på Byg 🔨, tag fat i et møbel og flyt det et andet sted hen',
  buy: 'Åbn Butik 🛒, køb noget for dine mønter og placér det på værelset',
};

/** [room where it happens, hint] for each hotel quest. */
const HOTEL_TIPS: Record<(typeof HOTEL_QUESTS)[number]['id'], [string, string]> = {
  lobby: ['', 'Tryk på Rum og find lobbyen 🧭'],
  ida: ['lobby', 'Skriv "Hej Ida" i chatten, så siger jeg hej 🛎️'],
  aquarium: ['lobby', 'Gå hen og kig på akvariet – fiskene hedder Bob og Bent 🐠'],
  coffee: ['cafe', 'Skriv "kaffe" i chatten, så laver jeg en kop til dig ☕'],
  cafeSit: ['cafe', 'Find en ledig stol eller sofa og sæt dig 🪑'],
  greetHuman: ['', 'Sig hej til en rigtig gæst, når du møder en – det giver flest mønter 👋'],
};

const LIMIT_FOR: Partial<Record<ClientMsg['t'], LimitKind>> = {
  move: 'move',
  glide: 'glide',
  reset: 'build',
  admin: 'build',
  stash: 'build',
  placeInv: 'build',
  tradeStart: 'social',
  tradeReply: 'social',
  tradeOffer: 'build',
  tradeAccept: 'build',
  tradeCancel: 'build',
  sit: 'move',
  chat: 'chat',
  whisper: 'chat',
  action: 'move',
  buy: 'build',
  moveItem: 'build',
  sellItem: 'build',
  roomSettings: 'build',
  rights: 'build',
  look: 'build',
  friendRequest: 'social',
  friendRespond: 'social',
  friendRemove: 'social',
  block: 'social',
  report: 'social',
  profile: 'social',
  motto: 'social',
  navigator: 'nav',
};

export class Hotel {
  private sessions = new Set<Session>();
  private byUser = new Map<string, Session>();
  private rooms = new Map<string, RoomInstance>();
  /** Event started by an admin (in addition to the weekly schedule). */
  manualEvent: ActiveEvent | null = null;
  private eventsKey = '';
  /** Open quiz questions per room. */
  private quizzes = new Map<string, RoomQuiz>();
  private quizCooldown = new Map<string, number>();
  /** Open trades, by both players' ids. */
  private trades = new Map<string, Trade>();
  private bots: Bots;
  private ticker: NodeJS.Timeout;
  private secondTicker: NodeJS.Timeout;

  constructor(
    private readonly store: Store,
    private readonly cfg: HotelConfig,
  ) {
    for (const def of PUBLIC_ROOMS) {
      const meta = {
        id: def.id,
        name: def.name,
        description: def.description,
        theme: def.theme,
        isPublic: true,
        ownerId: null,
        ownerName: null,
        access: 'open' as const,
      };
      this.rooms.set(
        def.id,
        new RoomInstance(
          meta,
          def.items.map((i) => ({ ...i })),
          this.hooks,
        ),
      );
    }
    this.bots = new Bots(
      {
        room: (id) => this.rooms.get(id),
        say: (room, bot, text) => this.sayInRoom(room, bot, text),
        recent: (roomId) =>
          this.store.recentChat(roomId, 8).map((c) => ({ name: c.name, text: c.text })),
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
    const s: Session = {
      conn,
      user: null,
      room: null,
      player: null,
      limits: createLimits(),
      strikes: 0,
    };
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
    const shouldBeAdmin = (this.cfg.adminNames ?? []).includes(user.name.toLowerCase());
    if (shouldBeAdmin && user.role === 'user') user.role = 'admin';
    if (!shouldBeAdmin && user.role === 'admin') user.role = 'user';
    const old = this.byUser.get(user.id);
    if (old && old !== s) {
      this.toast(old, 'Du er logget ind et andet sted.');
      old.conn.close(4000, 'replaced');
      this.onClose(old);
    }
    s.user = user;
    this.byUser.set(user.id, s);
    this.send(s, {
      t: 'welcome',
      me: this.me(user),
      serverTime: Date.now(),
      onboardingLock: this.cfg.onboardingLock,
      canReset: this.cfg.allowReset ?? false,
    });
    this.sendFriends(user);
    this.notifyFriendsOf(user);
    this.join(s, user.homeRoomId);
    this.daily(s, user, 'd_login');
    this.send(s, { t: 'events', events: this.currentEvents() });
  }

  private me(u: UserRecord): Me {
    return {
      id: u.id,
      name: u.name,
      look: u.look,
      coins: u.coins,
      onlineSec: u.onlineSec,
      quests: u.quests,
      badges: u.badges,
      homeRoomId: u.homeRoomId,
      motto: u.motto,
      daily: this.dailyView(u),
      wardrobe: u.wardrobe ?? [],
      inventory: u.inventory ?? [],
      role: u.role,
    };
  }

  /* ---------------- rooms ---------------- */

  private hooks: RoomHooks = {
    onArrive: (room, p, tile, seated) => {
      if (p.bot) return;
      const user = this.store.getUser(p.id);
      const s = this.byUser.get(p.id);
      if (!user || !s) return;
      if (seated) this.quest(s, user, 'sit');
      if (seated && room.meta.id === 'cafe') this.quest(s, user, 'cafeSit');
      if (seated && room.meta.id !== user.homeRoomId) this.daily(s, user, 'd_sit');
      if (
        room.meta.id === 'lobby' &&
        room.items.some(
          (it) =>
            it.type === 'aquarium' &&
            tilesOf(it).some(
              ([x, z]) => Math.max(Math.abs(x - tile[0]), Math.abs(z - tile[1])) <= 1,
            ),
        )
      )
        this.quest(s, user, 'aquarium');
      if (room.meta.id === user.homeRoomId && tile[0] <= 1 && tile[1] >= 1 && tile[1] <= 3)
        this.quest(s, user, 'walk');
    },
    canBuild: (room, userId) =>
      !!room.meta.ownerId &&
      (room.meta.ownerId === userId || this.roomRecord(room)?.rights.includes(userId) === true),
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
      {
        id: rec.id,
        name: rec.name,
        description: rec.description,
        theme: 'home',
        isPublic: false,
        ownerId: rec.ownerId,
        ownerName: owner?.name ?? null,
        access: rec.access,
      },
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
        if (hashSecret(password) !== rec.passwordHash)
          return this.toast(s, 'Forkert adgangskode', 'error');
      }
    }
    this.leaveRoom(s);
    const player: PlayerState = {
      id: user.id,
      name: user.name,
      look: user.look,
      bot: false,
      from: [DOOR_TILE[0], DOOR_TILE[1]],
      path: [],
      pathStart: Date.now(),
      run: false,
      seatId: null,
      goalSeat: null,
      action: null,
      actionUntil: 0,
      send: (m) => this.send(s, m),
      blocked: () => user.blocked,
    };
    room.add(player);
    s.room = room;
    s.player = player;
    this.send(s, { t: 'room', room: room.roomView(user.id), serverTime: Date.now() });
    if (room.meta.id === user.homeRoomId && !this.onboarded(user))
      this.bots.startGuide(room, () => this.nextTip(user));
    this.bots.onHumanJoin(room, player);
    if (room.meta.id === 'lobby') this.quest(s, user, 'lobby');
    const ev = this.currentEvents().find((e) => e.roomId === room.meta.id);
    if (ev)
      this.bots.hostSay(room, `Velkommen til ${ev.name}, ${user.name}! Dobbelt mønter 🎉`, 2500);
    if (room.meta.id === 'cafe') this.daily(s, user, 'd_cafe');
    if (!room.meta.isPublic && room.meta.ownerId && room.meta.ownerId !== user.id)
      this.daily(s, user, 'd_visit');
    if (room.meta.isPublic && this.onboarded(user)) {
      const tip = this.hotelTip(user, room.meta.id);
      if (tip) this.bots.hostSay(room, tip, 4500);
    }
    this.notifyFriendsOf(user);
  }

  private leaveRoom(s: Session) {
    if (s.user) this.endTrade(s.user.id, 'Byttehandlen blev afbrudt.');
    const room = s.room;
    if (!room || !s.player) return;
    room.remove(s.player.id);
    s.room = null;
    s.player = null;
    if (!room.meta.isPublic && room.humans().length === 0) this.rooms.delete(room.meta.id);
  }

  private navigator(user: UserRecord): NavigatorRoom[] {
    const out: NavigatorRoom[] = PUBLIC_ROOMS.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ownerName: null,
      access: 'open',
      public: true,
      users: this.rooms.get(r.id)?.humans().length ?? 0,
    }));
    const guest = this.store
      .listRooms()
      .map((rec) => ({ rec, users: this.rooms.get(rec.id)?.humans().length ?? 0 }))
      .filter(
        ({ rec, users }) =>
          users > 0 || rec.ownerId === user.id || user.friends.includes(rec.ownerId),
      )
      .sort((a, b) => b.users - a.users)
      .slice(0, 40)
      .map(({ rec, users }) => ({
        id: rec.id,
        name: rec.name,
        description: rec.description,
        ownerName: this.store.getUser(rec.ownerId)?.name ?? null,
        access: rec.access,
        users,
        public: false,
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
    const start = QUESTS.find((x) => x.id === id);
    const hotel = HOTEL_QUESTS.find((x) => x.id === id);
    if (!start && (!hotel || !this.onboarded(user))) return;
    const reward = (start ?? hotel)!.reward;
    user.quests.push(id);
    const all = !!start && this.onboarded(user);
    const hotelAll = !!hotel && HOTEL_QUESTS.every((q) => user.quests.includes(q.id));
    this.send(s, { t: 'quest', id, reward, all, hotelAll });
    this.coins(s, user, reward);
    if (all) {
      this.badge(s, user, 'onboarded');
      this.daily(s, user, 'd_login');
    }
    if (hotelAll) {
      this.badge(s, user, 'hotelkender');
      this.coins(s, user, HOTEL_BONUS);
    }
    if (start && s.room?.meta.id === user.homeRoomId) {
      if (all) this.bots.endGuide(s.room, user.name);
      else this.bots.guideTip(s.room);
    }
    if (hotel && s.room?.meta.isPublic && !hotelAll) {
      const tip = this.hotelTip(user, s.room.meta.id);
      if (tip) this.bots.hostSay(s.room, `Flot! ${tip}`, 2200);
    }
  }

  /** Ida's/Luna's hint for the next hotel quest that can be done in this room (or elsewhere). */
  private hotelTip(user: UserRecord, roomId: string): string | null {
    const left = HOTEL_QUESTS.filter((q) => !user.quests.includes(q.id)).map((q) => q.id);
    if (!left.length) return null;
    const here = left.find((id) => HOTEL_TIPS[id][0] === roomId) ?? left[0]!;
    return HOTEL_TIPS[here][1];
  }

  /* ---------------- moderation ---------------- */

  private adminReports(): AdminReport[] {
    const who = (id: string) => this.store.getUser(id);
    return [...this.store.listReports()]
      .sort((a, b) =>
        a.status === b.status
          ? b.createdAt.localeCompare(a.createdAt)
          : a.status === 'open'
            ? -1
            : 1,
      )
      .slice(0, 60)
      .map((r) => {
        const t = who(r.targetId);
        return {
          id: r.id,
          createdAt: r.createdAt,
          status: r.status,
          from: { id: r.fromId, name: who(r.fromId)?.name ?? '?' },
          target: {
            id: r.targetId,
            name: t?.name ?? '?',
            bannedUntil: t?.bannedUntil ?? null,
            mutedUntil: t?.mutedUntil ?? null,
          },
          reason: r.reason,
          roomId: r.roomId,
          context: r.context.slice(-12).map((c) => ({ name: c.name, text: c.text, at: c.at })),
        };
      });
  }

  private admin(s: Session, user: UserRecord, msg: Extract<ClientMsg, { t: 'admin' }>) {
    if (user.role === 'user') return this.strike(s);
    const log = (action: string, target?: string, detail?: string) =>
      this.store.logAdmin({ at: new Date().toISOString(), by: user.id, action, target, detail });
    const target = msg.userId ? this.store.getUser(msg.userId) : undefined;
    const ts = target && this.byUser.get(target.id);
    const done = (text: string) => {
      this.toast(s, `🛡️ ${text}`);
      this.send(s, { t: 'adminReports', reports: this.adminReports() });
    };
    switch (msg.action) {
      case 'reports':
        return this.send(s, { t: 'adminReports', reports: this.adminReports() });
      case 'resolve': {
        const r = this.store.listReports().find((x) => x.id === msg.reportId);
        if (!r) return;
        r.status = r.status === 'open' ? 'closed' : 'open';
        this.store.touch();
        log('resolve', r.targetId, r.id);
        return done(r.status === 'closed' ? 'Sagen er løst' : 'Sagen er åbnet igen');
      }
      case 'warn':
        if (!target) return;
        if (ts)
          this.toast(
            ts,
            `⚠️ Besked fra en moderator: ${msg.text ?? 'Husk at være venlig på Hutel.'}`,
            'error',
          );
        log('warn', target.id, msg.text);
        return done(`${target.name} har fået en advarsel`);
      case 'mute':
      case 'unmute':
        if (!target) return;
        target.mutedUntil =
          msg.action === 'mute' ? Date.now() + (msg.minutes ?? 60) * 60_000 : null;
        this.store.touch();
        if (ts && msg.action === 'mute')
          this.toast(
            ts,
            `🔇 Du er sat på pause i chatten i ${msg.minutes ?? 60} minutter.`,
            'error',
          );
        log(msg.action, target.id, String(msg.minutes ?? ''));
        return done(
          msg.action === 'mute'
            ? `${target.name} er sat på pause`
            : `${target.name} kan skrive igen`,
        );
      case 'ban':
      case 'unban':
        if (!target || target.role !== 'user') return;
        target.bannedUntil =
          msg.action === 'ban' ? Date.now() + (msg.minutes ?? 7 * 24 * 60) * 60_000 : null;
        this.store.touch();
        if (ts && msg.action === 'ban') ts.conn.close(4003, 'banned');
        log(msg.action, target.id, String(msg.minutes ?? ''));
        return done(
          msg.action === 'ban'
            ? `${target.name} er udelukket`
            : `${target.name} er ikke længere udelukket`,
        );
      case 'kick':
        if (!target || !ts) return;
        this.toast(ts, 'En moderator har sendt dig tilbage til dit værelse.', 'error');
        this.join(ts, target.homeRoomId);
        log('kick', target.id);
        return done(`${target.name} er sendt hjem`);
      case 'eventStart': {
        const r = PUBLIC_ROOMS.find((x) => x.id === msg.roomId);
        if (!r) return;
        this.manualEvent = {
          id: `special_${Date.now()}`,
          name: msg.text || `Fest i ${r.name}`,
          roomId: r.id,
          until: Date.now() + (msg.minutes ?? 60) * 60_000,
        };
        log('eventStart', undefined, `${r.id} ${msg.minutes ?? 60}`);
        this.checkEvents();
        return done('Eventet er startet');
      }
      case 'eventStop':
        this.manualEvent = null;
        log('eventStop');
        this.checkEvents();
        return done('Eventet er stoppet');
    }
  }

  /* ---------------- events ---------------- */

  currentEvents(now = Date.now()): ActiveEvent[] {
    if (this.manualEvent && this.manualEvent.until <= now) this.manualEvent = null;
    return [...scheduledEvents(now), ...(this.manualEvent ? [this.manualEvent] : [])];
  }

  /** Tells everyone when an event starts or stops. */
  private checkEvents() {
    const events = this.currentEvents();
    const key = events.map((e) => e.id).join();
    if (key === this.eventsKey) return;
    const started = events.filter((e) => !this.eventsKey.split(',').includes(e.id));
    this.eventsKey = key;
    for (const s of this.byUser.values()) {
      this.send(s, { t: 'events', events });
      for (const e of started) this.toast(s, `🎉 ${e.name} er begyndt – dobbelt mønter!`);
    }
  }

  /** Once a minute: double coins and attendance for guests at an event. */
  private eventMinute(s: Session, u: UserRecord) {
    const e = this.currentEvents().find((x) => x.roomId === s.room?.meta.id);
    if (!e) return;
    this.coins(s, u, COINS_PER_ONLINE_MINUTE, 'event');
    const key = `${danishDate()}:${e.id}`;
    if (u.eventMins?.key !== key) u.eventMins = { key, mins: 0 };
    u.eventMins.mins++;
    if (u.eventMins.mins >= 5)
      this.badge(s, u, EVENTS.find((x) => x.id === e.id)?.badge ?? 'event');
  }

  /* ---------------- mini games ---------------- */

  private gameReward(s: Session, u: UserRecord, n: number): number {
    const d = this.ensureDaily(u);
    const left = Math.max(0, GAME_COINS_PER_DAY - (d.gameCoins ?? 0));
    const got = Math.min(n, left);
    if (got > 0) {
      d.gameCoins = (d.gameCoins ?? 0) + got;
      this.coins(s, u, got, 'game');
    }
    return got;
  }

  private sys(room: RoomInstance, text: string, id?: string) {
    room.broadcast({ t: 'sys', text, id });
  }

  /** Handles /terning, /ssp and /quiz. Returns true if the text was a game command. */
  private game(
    s: Session,
    user: UserRecord,
    room: RoomInstance,
    player: PlayerState,
    text: string,
  ): boolean {
    const [cmd, arg] = text.slice(1).toLowerCase().split(/\s+/);
    if (cmd === 'terning' || cmd === 'dice') {
      const n = 1 + Math.floor(Math.random() * 6);
      this.sys(
        room,
        `🎲 ${user.name} slog en ${['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n - 1]} ${n}`,
        user.id,
      );
      return true;
    }
    if (cmd === 'ssp') {
      const you = arg as Hand;
      if (!HANDS.includes(you)) {
        this.toast(s, 'Skriv /ssp sten, /ssp saks eller /ssp papir');
        return true;
      }
      const bot = HANDS[Math.floor(Math.random() * 3)]!;
      const r = rps(you, bot);
      let line = `${HAND_ICON[you]} ${user.name} mod ${HAND_ICON[bot]} – `;
      if (r === 1) {
        const got = this.gameReward(s, user, 2);
        line += `${user.name} vinder! 🎉${got ? ` +${got} 🪙` : ''}`;
      } else line += r === 0 ? 'uafgjort 🤝' : 'huset vinder 😎';
      this.sys(room, line, user.id);
      return true;
    }
    if (cmd === 'quiz') {
      if (!room.meta.isPublic) {
        this.toast(s, 'Quiz kan spilles i lobbyen, caféen og spillehallen 🎮');
        return true;
      }
      if (this.quizzes.has(room.meta.id)) {
        this.toast(s, 'Der er allerede et spørgsmål i gang – svar i chatten!');
        return true;
      }
      if ((this.quizCooldown.get(room.meta.id) ?? 0) > Date.now()) {
        this.toast(s, 'Vent et øjeblik før næste spørgsmål ⏳');
        return true;
      }
      const q = QUIZ[Math.floor(Math.random() * QUIZ.length)]!;
      this.quizzes.set(room.meta.id, { q, until: Date.now() + 40_000 });
      this.sys(room, `❓ Quiz: ${q.q} (svar i chatten – første rigtige svar vinder)`);
      return true;
    }
    return false;
  }

  private quizAnswer(s: Session, user: UserRecord, room: RoomInstance, text: string) {
    const quiz = this.quizzes.get(room.meta.id);
    if (!quiz || !isAnswer(quiz.q, text)) return;
    this.quizzes.delete(room.meta.id);
    this.quizCooldown.set(room.meta.id, Date.now() + 15_000);
    const got = this.gameReward(s, user, 5);
    this.sys(
      room,
      `✅ ${user.name} svarede rigtigt: ${quiz.q.a[0]}!${got ? ` +${got} 🪙` : ''}`,
      user.id,
    );
  }

  private expireQuizzes() {
    const now = Date.now();
    for (const [roomId, quiz] of this.quizzes) {
      if (quiz.until > now) continue;
      this.quizzes.delete(roomId);
      this.quizCooldown.set(roomId, now + 5000);
      const room = this.rooms.get(roomId);
      if (room) this.sys(room, `⏰ Tiden er gået! Svaret var: ${quiz.q.a[0]}`);
    }
  }

  /* ---------------- daily quests ---------------- */

  private ensureDaily(u: UserRecord) {
    const date = danishDate();
    if (u.daily?.date === date) return u.daily;
    u.daily = {
      date,
      progress: {},
      done: [],
      streak: u.daily?.streak ?? 0,
      lastFull: u.daily?.lastFull,
    };
    return u.daily;
  }

  private dailyView(u: UserRecord): DailyView {
    const d = this.ensureDaily(u);
    const yesterday = danishDate(Date.now() - 86_400_000);
    const streak = d.lastFull === d.date || d.lastFull === yesterday ? d.streak : 0;
    return {
      date: d.date,
      streak,
      quests: dailyQuestsFor(d.date).map((id) => {
        const q = DAILY_POOL.find((x) => x.id === id)!;
        return {
          id,
          text: q.text,
          reward: q.reward,
          goal: q.goal,
          progress: Math.min(q.goal, d.progress[id] ?? 0),
          done: d.done.includes(id),
        };
      }),
    };
  }

  /** Counts towards one of today's quests (only once the start quests are done). */
  private daily(s: Session, u: UserRecord, id: DailyId, amount = 1) {
    if (!this.onboarded(u)) return;
    const d = this.ensureDaily(u);
    const today = dailyQuestsFor(d.date);
    if (!today.includes(id) || d.done.includes(id)) return;
    const q = DAILY_POOL.find((x) => x.id === id)!;
    d.progress[id] = (d.progress[id] ?? 0) + amount;
    this.store.touch();
    if (d.progress[id]! < q.goal) return this.send(s, { t: 'daily', daily: this.dailyView(u) });
    d.done.push(id);
    this.coins(s, u, q.reward);
    let bonus: number | undefined;
    if (today.every((t) => d.done.includes(t))) {
      const yesterday = danishDate(Date.now() - 86_400_000);
      d.streak = d.lastFull === yesterday ? d.streak + 1 : 1;
      d.lastFull = d.date;
      bonus = DAILY_BONUS;
      this.coins(s, u, DAILY_BONUS);
      if (d.streak >= 7) this.badge(s, u, 'streak7');
    }
    this.send(s, { t: 'daily', daily: this.dailyView(u), doneId: id, bonus });
  }

  /** Guide-Magnus' hint for the next start quest the guest hasn't done. */
  private nextTip(user: UserRecord): string | null {
    const next = QUESTS.find((q) => !user.quests.includes(q.id));
    if (!next) return null;
    return GUIDE_TIPS[next.id];
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

  private handle(
    s: Session,
    user: UserRecord,
    msg: Exclude<ClientMsg, { t: 'auth' } | { t: 'ping' }>,
  ) {
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
      case 'reset': {
        if (!this.cfg.allowReset) return;
        const home = user.homeRoomId;
        this.leaveRoom(s);
        // Anyone visiting the room is sent back to the lobby, then the room is rebuilt.
        const inst = this.rooms.get(home);
        if (inst) {
          for (const other of this.sessions) if (other.room === inst) this.join(other, 'lobby');
          this.rooms.delete(home);
        }
        this.bots.forgetGuide(home);
        this.store.resetProgress(user);
        return this.send(s, { t: 'resetDone' });
      }
      case 'glide':
        if (room && player) room.glide(player, msg.x, msg.z, msg.run);
        return;
      case 'sit':
        if (room && player) room.sit(player, msg.itemId);
        return;
      case 'chat': {
        if (!room || !player) return;
        const text = filterChat(sanitizeChat(msg.text));
        if (!text) return;
        if (user.mutedUntil && user.mutedUntil > Date.now())
          return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
        if (text.startsWith('/') && this.game(s, user, room, player, text)) return;
        this.sayInRoom(room, player, text);
        this.quizAnswer(s, user, room, text);
        user.stats.chats++;
        if (user.stats.chats >= 100) this.badge(s, user, 'chatty');
        if (isGreeting(text)) this.quest(s, user, 'hello');
        this.daily(s, user, 'd_chat');
        const lower = text.toLowerCase();
        if (room.meta.id === 'lobby' && /\bida\b/.test(lower)) this.quest(s, user, 'ida');
        if (room.meta.id === 'cafe' && lower.includes('kaffe') && !user.quests.includes('coffee')) {
          this.quest(s, user, 'coffee');
          if (user.quests.includes('coffee'))
            this.bots.hostSay(room, `Værsgo, ${user.name} – en varm kop kaffe ☕`, 1200);
        }
        if (isGreeting(text) && room.humans().some((h) => h.id !== player.id))
          this.quest(s, user, 'greetHuman');
        this.bots.onChat(room, player, text);
        return;
      }
      case 'action':
        if (!room || !player) return;
        player.action = msg.kind === 'stop' ? null : msg.kind;
        player.actionUntil = Date.now() + 2500;
        room.broadcast({ t: 'action', id: player.id, kind: player.action });
        if (msg.kind === 'wave' && room.players.size > 1) this.daily(s, user, 'd_wave');
        return;
      case 'stash':
        return this.stash(s, user, msg.id);
      case 'placeInv':
        return this.placeInv(s, user, msg.index, msg.x, msg.z, msg.rot);
      case 'tradeStart':
        return this.tradeStart(s, user, msg.userId);
      case 'tradeReply':
        return this.tradeReply(s, user, msg.accept);
      case 'tradeOffer':
        return this.tradeOffer(s, user, { coins: msg.coins, inv: msg.inv, clothes: msg.clothes });
      case 'tradeAccept':
        return this.tradeAccept(s, user);
      case 'tradeCancel':
        return this.endTrade(user.id, `${user.name} afbrød byttehandlen.`);
      case 'buyClothes': {
        const item = CLOTHES[msg.key];
        const owned = (user.wardrobe ??= []);
        if (!item || item.price === 0 || owned.includes(msg.key)) return;
        if (item.unlock && !user.badges.includes(item.unlock as BadgeId))
          return this.toast(
            s,
            `🔒 Kræver badget "${BADGES[item.unlock as BadgeId].name}"`,
            'error',
          );
        if (user.coins < item.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
        owned.push(msg.key);
        this.coins(s, user, -item.price);
        this.store.touch();
        this.send(s, { t: 'wardrobe', wardrobe: owned });
        return this.toast(s, `👕 Du har købt: ${item.name}`);
      }
      case 'look':
        if (!lookAllowed(msg.look, user.wardrobe ?? []))
          return this.toast(s, 'Det tøj skal købes først 🛍️', 'error');
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
        return this.buy(s, user, msg.type, msg.x, msg.z, msg.rot, msg.color);
      case 'moveItem':
        return this.moveItem(s, user, msg.id, msg.x, msg.z, msg.rot, msg.color);
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
        if (user.mutedUntil && user.mutedUntil > Date.now())
          return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
        return this.whisper(s, user, msg.to, msg.text);
      case 'admin':
        return this.admin(s, user, msg);
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

  private buy(
    s: Session,
    user: UserRecord,
    type: PlacedItem['type'],
    x: number,
    z: number,
    rot: number,
    color?: number,
  ) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Du kan kun købe møbler til dit eget værelse.', 'error');
    const def = furniture(type);
    if (def.noShop) return;
    if (def.unlock && !user.badges.includes(def.unlock))
      return this.toast(s, `🔒 Kræver badget "${BADGES[def.unlock].name}"`, 'error');
    if (own.rec.items.length >= 120) return this.toast(s, 'Værelset er fyldt helt op.', 'error');
    if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const item: PlacedItem = { id: own.rec.nextItemId, type, x, z, rot };
    if (color && def.colors && color < def.colors.length) item.color = color;
    if (!own.room.placeable(item)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.rec.nextItemId++;
    own.rec.items.push(item);
    user.stats.buys++;
    this.coins(s, user, -def.price);
    own.room.broadcast({ t: 'itemPut', item });
    this.quest(s, user, 'buy');
    if (user.stats.buys >= 5) this.badge(s, user, 'shopper');
  }

  private moveItem(
    s: Session,
    user: UserRecord,
    id: number,
    x: number,
    z: number,
    rot: number,
    color?: number,
  ) {
    const own = this.ownRoom(s, user);
    if (!own) return this.toast(s, 'Du har ikke rettigheder her.', 'error');
    const item = own.rec.items.find((i) => i.id === id);
    if (!item) return;
    const moved = { ...item, x, z, rot };
    if (!own.room.placeable(moved)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.room.standUpFrom(id);
    Object.assign(item, { x, z, rot });
    const colors = furniture(item.type).colors;
    if (color !== undefined && colors && color < colors.length) item.color = color || undefined;
    this.store.touch();
    own.room.broadcast({ t: 'itemPut', item });
    user.stats.moves++;
    if (user.homeRoomId === own.rec.id) this.quest(s, user, 'move');
    if (user.stats.moves >= 25) this.badge(s, user, 'decorator');
  }

  /* ---------------- inventory ---------------- */

  private sendInventory(s: Session, u: UserRecord) {
    this.send(s, { t: 'inventory', items: u.inventory ?? [] });
  }

  private stash(s: Session, user: UserRecord, id: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Kun ejeren kan gemme møbler væk.', 'error');
    const idx = own.rec.items.findIndex((i) => i.id === id);
    const it = own.rec.items[idx];
    if (!it || furniture(it.type).noShop) return;
    if ((user.inventory ??= []).length >= 200)
      return this.toast(s, 'Dit inventar er fyldt.', 'error');
    own.rec.items.splice(idx, 1);
    own.room.standUpFrom(id);
    user.inventory.push(it.color ? { type: it.type, color: it.color } : { type: it.type });
    this.store.touch();
    own.room.broadcast({ t: 'itemRemove', id });
    this.sendInventory(s, user);
  }

  private placeInv(s: Session, user: UserRecord, index: number, x: number, z: number, rot: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Du kan kun stille ting på dit eget værelse.', 'error');
    const inv = user.inventory ?? [];
    const entry = inv[index];
    if (!entry) return;
    if (own.rec.items.length >= 120) return this.toast(s, 'Værelset er fyldt helt op.', 'error');
    const item: PlacedItem = { id: own.rec.nextItemId, type: entry.type, x, z, rot };
    if (entry.color) item.color = entry.color;
    if (!own.room.placeable(item)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.rec.nextItemId++;
    own.rec.items.push(item);
    inv.splice(index, 1);
    this.store.touch();
    own.room.broadcast({ t: 'itemPut', item });
    this.sendInventory(s, user);
  }

  /* ---------------- trading ---------------- */

  private sendTrade(t: Trade) {
    for (const id of [t.a, t.b]) {
      const s = this.byUser.get(id);
      const me = this.store.getUser(id);
      const them = this.store.getUser(t.other(id));
      if (s && me && them) this.send(s, { t: 'trade', trade: tradeView(t, me, them) });
    }
  }

  private tradeStart(s: Session, user: UserRecord, otherId: string) {
    const o = this.byUser.get(otherId);
    const other = o?.user;
    if (!o || !other || otherId === user.id || o.room !== s.room || !s.room)
      return this.toast(s, 'I skal være i samme rum for at bytte.', 'error');
    if (!this.onboarded(user)) return this.toast(s, 'Klar startopgaverne først 🙂', 'error');
    if (other.blocked.includes(user.id) || user.blocked.includes(other.id))
      return this.toast(s, 'Du kan ikke bytte med den person.', 'error');
    if (this.trades.has(user.id) || this.trades.has(otherId))
      return this.toast(s, 'En af jer er allerede i gang med at bytte.', 'error');
    const t = new Trade(user.id, otherId);
    this.trades.set(user.id, t);
    this.trades.set(otherId, t);
    this.send(o, { t: 'tradeAsk', from: { id: user.id, name: user.name } });
    this.toast(s, `🤝 Du har spurgt ${other.name}, om I skal bytte…`);
  }

  private tradeReply(s: Session, user: UserRecord, accept: boolean) {
    const t = this.trades.get(user.id);
    if (!t || !t.pending || t.b !== user.id) return;
    if (!accept) return this.endTrade(user.id, `${user.name} vil ikke bytte lige nu.`);
    t.pending = false;
    this.sendTrade(t);
  }

  private tradeOffer(s: Session, user: UserRecord, offer: Offer) {
    const t = this.trades.get(user.id);
    if (!t || t.pending) return;
    const err = checkOffer(user, offer);
    if (err) return this.toast(s, err, 'error');
    t.offers.set(user.id, offer);
    t.ok.clear();
    this.sendTrade(t);
  }

  private tradeAccept(s: Session, user: UserRecord) {
    const t = this.trades.get(user.id);
    if (!t || t.pending) return;
    t.ok.add(user.id);
    if (t.ok.size < 2) return this.sendTrade(t);
    const a = this.store.getUser(t.a)!;
    const b = this.store.getUser(t.b)!;
    const sa = this.byUser.get(a.id);
    const sb = this.byUser.get(b.id);
    if (!sa || !sb || sa.room !== sb.room)
      return this.endTrade(user.id, 'Byttehandlen blev afbrudt.');
    const err = checkOffer(a, t.offers.get(a.id)!) ?? checkOffer(b, t.offers.get(b.id)!);
    if (err) {
      t.ok.clear();
      this.sendTrade(t);
      return this.toast(s, `Byttet gik ikke igennem: ${err}`, 'error');
    }
    const dupe = (giver: UserRecord, taker: UserRecord) =>
      t.offers.get(giver.id)!.clothes.some((k) => (taker.wardrobe ?? []).includes(k));
    if (dupe(a, b) || dupe(b, a)) {
      t.ok.clear();
      this.sendTrade(t);
      return this.toast(s, 'Den anden har allerede noget af det tøj.', 'error');
    }
    const gave = executeTrade(a, b, t);
    this.store.logTrade({ at: new Date().toISOString(), a: a.id, b: b.id, gave });
    this.store.touch();
    for (const [u, sess] of [
      [a, sa],
      [b, sb],
    ] as const) {
      this.send(sess, { t: 'coins', coins: u.coins });
      this.send(sess, { t: 'wardrobe', wardrobe: u.wardrobe ?? [] });
      this.sendInventory(sess, u);
      if (!lookAllowed(u.look, u.wardrobe ?? [])) {
        const free = (slot: 'top' | 'hat', v: string | undefined) =>
          v &&
          (CLOTHES[`${slot}:${v}`]?.price ?? 0) > 0 &&
          !(u.wardrobe ?? []).includes(`${slot}:${v}`)
            ? undefined
            : v;
        u.look = {
          ...u.look,
          top: free('top', u.look.top) as Look['top'],
          hat: free('hat', u.look.hat) as Look['hat'],
        };
        sess.room?.broadcast({ t: 'look', id: u.id, look: u.look });
      }
    }
    this.trades.delete(a.id);
    this.trades.delete(b.id);
    for (const sess of [sa, sb])
      this.send(sess, { t: 'tradeEnd', text: '🤝 Byttet er gennemført!', done: true });
  }

  private endTrade(userId: string, text: string) {
    const t = this.trades.get(userId);
    if (!t) return;
    this.trades.delete(t.a);
    this.trades.delete(t.b);
    for (const id of [t.a, t.b]) {
      const sess = this.byUser.get(id);
      if (sess) this.send(sess, { t: 'tradeEnd', text, done: false });
    }
  }

  private sellItem(s: Session, user: UserRecord, id: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Kun ejeren kan sælge møbler.', 'error');
    const idx = own.rec.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const [item] = own.rec.items.splice(idx, 1);
    own.room.standUpFrom(id);
    own.room.broadcast({ t: 'itemRemove', id });
    this.coins(s, user, sellPrice(item!.type), 'sold');
  }

  private roomSettings(
    s: Session,
    user: UserRecord,
    msg: Extract<ClientMsg, { t: 'roomSettings' }>,
  ) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Kun ejeren kan ændre værelset.', 'error');
    const { rec, room } = own;
    if (msg.name) rec.name = filterChat(sanitizeChat(msg.name)).slice(0, 30) || rec.name;
    if (msg.description !== undefined)
      rec.description = filterChat(sanitizeChat(msg.description)).slice(0, 80);
    if (msg.access) {
      if (msg.access === 'password' && !msg.password && !rec.passwordHash)
        return this.toast(s, 'Vælg en adgangskode.', 'error');
      rec.access = msg.access;
    }
    if (msg.password) rec.passwordHash = hashSecret(msg.password);
    Object.assign(room.meta, { name: rec.name, description: rec.description, access: rec.access });
    this.store.touch();
    room.broadcast({
      t: 'roomMeta',
      name: rec.name,
      description: rec.description,
      access: rec.access,
    });
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
    this.toast(
      s,
      grant
        ? `${target.name} kan nu flytte møbler her`
        : `${target.name} har ikke længere rettigheder`,
    );
    const ts = this.byUser.get(targetId);
    if (ts && ts.room === own.room)
      this.send(ts, { t: 'room', room: own.room.roomView(targetId), serverTime: Date.now() });
  }

  /* ---------------- social ---------------- */

  private friendViews(user: UserRecord): FriendView[] {
    return user.friends
      .map((id) => this.store.getUser(id))
      .filter((f): f is UserRecord => !!f)
      .map((f) => {
        const fs = this.byUser.get(f.id);
        return {
          id: f.id,
          name: f.name,
          online: !!fs,
          roomId: fs?.room?.meta.id ?? null,
          roomName: fs?.room?.meta.name ?? null,
        };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'da'));
  }

  private sendFriends(user: UserRecord) {
    const s = this.byUser.get(user.id);
    if (!s) return;
    const requests = user.requests
      .map((id) => this.store.getUser(id))
      .filter((u): u is UserRecord => !!u)
      .map((u) => ({ id: u.id, name: u.name }));
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
    if (!target || target.id === user.id)
      return this.toast(s, 'Fandt ingen gæst med det navn.', 'error');
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
      for (const u of [user, other])
        if (u.friends.length >= 5) this.badge(this.byUser.get(u.id), u, 'social');
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
    if (!target || !user.friends.includes(to))
      return this.toast(s, 'Du kan kun skrive privat til venner.', 'error');
    const text = filterChat(sanitizeChat(raw));
    if (!text) return;
    const ts = this.byUser.get(to);
    if (!ts) return this.toast(s, `${target.name} er ikke online lige nu.`);
    const msg: ServerMsg = { t: 'whisper', from: user.id, fromName: user.name, to, text };
    if (!target.blocked.includes(user.id)) this.send(ts, msg);
    this.send(s, msg);
    this.store.logChat({
      at: Date.now(),
      roomId: `pm:${[user.id, to].sort().join(':')}`,
      userId: user.id,
      name: user.name,
      text,
    });
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
      fromId: user.id,
      targetId,
      reason: sanitizeChat(reason).slice(0, 300),
      roomId,
      context: roomId ? this.store.recentChat(roomId, 20) : [],
    });
    this.toast(s, 'Tak. En moderator kigger på det.');
  }

  private profile(s: Session, user: UserRecord, targetId: string) {
    const target = this.store.getUser(targetId);
    const botPlayer = s.room?.players.get(targetId);
    if (!target && botPlayer?.bot) {
      return this.send(s, {
        t: 'profile',
        profile: {
          id: targetId,
          name: botPlayer.name,
          look: botPlayer.look,
          motto: 'AI-beboer på Hutel 🤖',
          badges: [],
          since: '',
          bot: true,
          friend: false,
          blocked: false,
        },
      });
    }
    if (!target) return;
    this.send(s, {
      t: 'profile',
      profile: {
        id: target.id,
        name: target.name,
        look: target.look,
        motto: target.motto,
        badges: target.badges,
        since: target.createdAt.slice(0, 10),
        bot: false,
        friend: user.friends.includes(target.id),
        blocked: user.blocked.includes(target.id),
        here: !!s.room && this.byUser.get(target.id)?.room === s.room,
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
    this.expireQuizzes();
    this.checkEvents();
    for (const s of this.byUser.values()) {
      const u = s.user!;
      u.onlineSec++;
      if (u.onlineSec % 60 === 0) {
        this.coins(s, u, COINS_PER_ONLINE_MINUTE, 'online');
        this.send(s, { t: 'online', onlineSec: u.onlineSec });
        this.daily(s, u, 'd_online');
        this.eventMinute(s, u);
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

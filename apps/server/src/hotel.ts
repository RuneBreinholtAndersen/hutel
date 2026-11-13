import {
  ACTION_COMMANDS,
  ACTION_MS,
  EMOTE_COMMANDS,
  NOTES_PER_ROOM,
  SHOUT_COOLDOWN_MS,
  bubbleUnlocked,
  shoutText,
  type ActionKind,
  CARRY,
  CARRY_MS,
  OUTFIT_SLOTS,
  effectUnlocked,
  type CarryKind,
  type EmoteKind,
  type RelationKind,
  type RoomNote,
  BADGES,
  EVENTS,
  scheduledEvents,
  levelOf,
  APARTMENT_ROOMS,
  APARTMENT_START_ITEMS,
  type ApartmentKind,
  type ActiveEvent,
  type AdminReport,
  CLOTHES,
  lookAllowed,
  ClientMsgSchema,
  LookSchema,
  repairLook,
  COINS_PER_ONLINE_MINUTE,
  DOOR_TILE,
  filterChat,
  isFriendCode,
  isJuniorPhrase,
  newFriendCode,
  furniture,
  isGreeting,
  PUBLIC_ROOMS,
  CHEST,
  pickLoot,
  INVITE_REWARD,
  INVITE_REWARD_MAX,
  betaStats,
  loginGiftFor,
  LOGIN_GIFTS,
  activeDrop,
  activeDrops,
  canTrade,
  serialLabel,
  type InvItem,
  type LimitedView,
  type FeedbackView,
  type JuniorOverview,
  type AdminStats,
  type LimitedDrop,
  LIMITED_DROPS,
  type ChestView,
  DAILY_BONUS,
  DAILY_POOL,
  dailyQuestsFor,
  danishDate,
  HOTEL_BONUS,
  HOTEL_QUESTS,
  QUESTS,
  tilesOf,
  itemState,
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
  ROOM_CAPACITY,
  themeWindowTile,
  themeWallBlocks,
  canPlace,
  isFloorTile,
  WALK_SPEED,
  PROTOCOL_VERSION,
  RELEASE_NOTES,
  ROOM_GAMES,
  GAME_COUNTDOWN_MS,
  TEAM_NAMES,
  SNOW,
  CINEMA,
  type CinemaEntry,
  type CinemaView,
  type RoomGameKind,
  MARKET_FEE,
  MARKET_MAX_LISTINGS,
  MARKET_MAX_PRICE,
  buildGrid,
  isFree,
  canStep,
  doorSlots,
  doorSpot,
  type AptDoor,
  MAX_USER_ROOM_SIZE,
  SIZE_PRICES,
  renovationPrice,
  type RoomShape,
  type RoomCategory,
  decorDef,
  decorKey,
  type DecorKind,
  ROOM_SIZE,
  PET_FEED_COOLDOWN_MS,
  PET_FEED_PRICE,
  PET_FEED_XP,
  PET_HUNGRY_AFTER_MS,
  PET_KINDS,
  PET_MAX,
  PET_TRICK_COOLDOWN_MS,
  PET_TRICK_XP,
  PET_TRICK_XP_PER_DAY,
  PET_TRICKS,
  petLevel,
  type PetInfo,
  type PetKindDef,
  isValidName,
  type PetKind,
  type PetTrick,
  type PetView,
} from '@hutel/shared';
import { Bots } from './bots';
import { createLimits, type Bucket, type LimitKind } from './ratelimit';
import { RoomInstance, type PlayerState, type RoomHooks } from './room';
import {
  hashSecret,
  newId,
  type PetRecord,
  type RoomRecord,
  type Store,
  type UserRecord,
} from './store';
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
import { reportWarning } from './monitoring';

/** More than this many coins earned within one hour raises an alarm (sales on the market included). */
const COIN_ALARM_PER_HOUR = 3000;

export interface HotelConfig {
  /** New guests must finish the starter quests before leaving their own room. */
  onboardingLock: boolean;
  /** Build id of the shipped client (from dist/version.json). */
  clientBuild?: string;
  anthropicApiKey?: string;
  botModel: string;
  botMaxCallsPerDay: number;
  /** Test phase: players may reset their own progress ("Start forfra"). */
  allowReset?: boolean;
  /** Names (lower-case) that get the admin role. They should log in with Google (2FA). */
  adminNames?: string[];
  /** Lobbi Junior: no free text between strangers and no cinema (open YouTube). */
  junior?: boolean;
  /** Look up video titles at YouTube (off in tests). */
  videoTitles?: boolean;
  /** Golden chests appear by themselves (off in tests). */
  chests?: boolean;
  /** Daily login gift (default on; off in most tests so coin counts stay simple). */
  loginGifts?: boolean;
  /** For the admin panel: newest backup and how many there are. */
  backupInfo?: () => { lastBackup: string | null; backups: number };
  /** Adult server: where Lobbi Junior's staff API is, and the shared key. */
  juniorApi?: { url: string; key: string };
  /** Override the limited-edition drops (tests). */
  limitedDrops?: LimitedDrop[];
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
  /** Last time this player went through an apartment door (prevents bouncing back). */
  doorAt?: number;
  shoutAt?: number;
  /** Bumped by every new walk order, so an old "go through the door" plan is dropped. */
  doorTicket?: number;
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
  likeRoom: 'build',
  feedback: 'social',
  giftSend: 'build',
  giftOpen: 'build',
  move: 'move',
  use: 'build',
  glide: 'glide',
  reset: 'build',
  deleteAccount: 'build',
  chestOpen: 'move',
  buyRoom: 'build',
  decor: 'build',
  buyPet: 'build',
  petOut: 'build',
  petFeed: 'build',
  renovate: 'build',
  setHeight: 'build',
  teleport: 'move',
  aptDoor: 'move',
  gameStart: 'build',
  jukebox: 'build',
  cinemaAdd: 'build',
  cinemaGet: 'nav',
  cinemaSkip: 'social',
  cinemaStop: 'build',
  cinemaRemove: 'build',
  snowThrow: 'move',
  market: 'nav',
  marketSell: 'build',
  marketBuy: 'build',
  marketCancel: 'build',
  guestbookWrite: 'chat',
  guestbookDelete: 'build',
  petTrick: 'social',
  petRename: 'build',
  admin: 'build',
  showBadge: 'social',
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
  hush: 'chat',
  pmHistory: 'social',
  action: 'move',
  emote: 'social',
  outfitSave: 'build',
  outfitWear: 'build',
  setEffect: 'social',
  dispense: 'move',
  carryDrop: 'social',
  carryGive: 'social',
  setBubble: 'social',
  setPrivacy: 'social',
  setRelation: 'social',
  notes: 'nav',
  noteWrite: 'chat',
  noteApprove: 'build',
  noteDelete: 'build',
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
  favorite: 'nav',
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
        size: def.size ?? ROOM_SIZE,
        shape: 'square' as const,
        category: def.category,
        heights: {},
        doors: [],
        paidSize: def.size ?? ROOM_SIZE,
        wall: null,
        floor: null,
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
      {
        // Junior bots only use their fixed, friendly lines – no AI replies to children.
        apiKey: cfg.junior ? undefined : cfg.anthropicApiKey,
        model: cfg.botModel,
        maxCallsPerDay: cfg.botMaxCallsPerDay,
      },
    );
    this.ticker = setInterval(() => this.tick(), 100);
    this.secondTicker = setInterval(() => this.everySecond(), 1000);
  }

  stop() {
    clearInterval(this.ticker);
    clearInterval(this.secondTicker);
    // Remember where everyone is, so a deploy feels like a short hiccup.
    for (const s of this.sessions) this.rememberSpot(s);
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

  private spotTick = 0;

  private rememberSpot(s: Session) {
    if (!s.user || !s.room) return;
    const t = s.player ? s.room.tileOf(s.player) : undefined;
    const tile: [number, number] | undefined = t ? [t[0], t[1]] : undefined;
    s.user.lastRoom = { id: s.room.meta.id, at: Date.now(), tile };
  }

  private onClose(s: Session) {
    this.sessions.delete(s);
    this.rememberSpot(s);
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
    // Junior: nobody plays before a parent has said yes in the e-mail.
    if (this.cfg.junior && !user.parentConsentAt) return s.conn.close(4005, 'waiting for parent');
    const shouldBeAdmin = (this.cfg.adminNames ?? []).includes(user.name.toLowerCase());
    if (shouldBeAdmin && user.role === 'user') user.role = 'admin';
    if (!shouldBeAdmin && user.role === 'admin' && !user.staff) user.role = 'user';
    const old = this.byUser.get(user.id);
    if (old && old !== s) {
      this.toast(old, 'Du er logget ind et andet sted.');
      old.conn.close(4000, 'replaced');
      this.onClose(old);
    }
    s.user = user;
    this.byUser.set(user.id, s);
    // A stored look the schema no longer accepts would make every later look change fail.
    if (!LookSchema.safeParse(user.look).success) {
      user.look = repairLook(user.look);
      this.store.touch();
    }
    this.send(s, {
      t: 'welcome',
      me: this.me(user),
      serverTime: Date.now(),
      onboardingLock: this.cfg.onboardingLock,
      canReset: this.cfg.allowReset ?? false,
      build: this.cfg.clientBuild,
      protocol: PROTOCOL_VERSION,
      notes: RELEASE_NOTES[0],
    });
    this.send(s, { t: 'limited', drops: this.limitedViews() });
    this.markActive(user);
    this.loginGift(s, user);
    if (user.gifts?.length) this.send(s, { t: 'gifts', gifts: user.gifts });
    this.sendFriends(user);
    this.notifyFriendsOf(user);
    // Back to the room you were in if you were only gone a little while (reconnect, update).
    const last = user.lastRoom;
    const exists = (id: string) =>
      PUBLIC_ROOMS.some((r) => r.id === id) || !!this.store.getRoom(id);
    const recent = last && Date.now() - last.at < 15 * 60_000 && exists(last.id);
    // Back on the same tile too (a deploy can take a minute or two).
    const tile = recent ? last.tile : undefined;
    if (recent && last.id !== user.homeRoomId) this.join(s, last.id, undefined, tile);
    if (!s.room)
      this.join(
        s,
        user.homeRoomId,
        undefined,
        recent && last.id === user.homeRoomId ? tile : undefined,
      );
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
      pets: (u.pets ?? []).map((p) => this.petInfo(p)),
      activePet: u.activePet ?? null,
      decor: u.decor ?? [],
      inventory: u.inventory ?? [],
      apartment: this.apartment(u),
      role: u.role,
      showBadge: u.showBadge,
      bubble: u.bubble,
      outfits: u.outfits ?? Array(OUTFIT_SLOTS).fill(null),
      effect: u.effect,
      noFollow: u.noFollow,
      relations: u.relations ?? {},
    };
  }

  /* ---------------- rooms ---------------- */

  private hooks: RoomHooks = {
    onArrive: (room, p, tile, seated) => {
      if (p.bot) return;
      const user = this.store.getUser(p.id);
      const s = this.byUser.get(p.id);
      if (!user || !s) return;
      // Doors are only used when you click them (aptDoor) or walk into the wall with the
      // arrow keys – just stopping in front of one by accident must not move you.
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
      const win = themeWindowTile(room.meta.theme, room.floor());
      if (
        room.meta.id === user.homeRoomId &&
        win !== null &&
        tile[0] <= 1 &&
        Math.abs(tile[1] - win) <= 1
      )
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
        theme: rec.theme ?? 'home',
        size: rec.size ?? ROOM_SIZE,
        shape: rec.shape ?? 'square',
        category: rec.category ?? 'andet',
        heights: (rec.heights ??= {}),
        doors: [],
        paidSize: rec.paidSize ?? ROOM_SIZE,
        wall: rec.wall ?? null,
        floor: rec.floor ?? null,
        isPublic: false,
        ownerId: rec.ownerId,
        ownerName: owner?.name ?? null,
        access: rec.access,
      },
      rec.items,
      this.hooks,
    );
    room.meta.doors = this.aptDoors(rec);
    this.rooms.set(id, room);
    return room;
  }

  private onboarded(u: UserRecord) {
    return QUESTS.every((q) => u.quests.includes(q.id));
  }

  private join(s: Session, roomId: string, password?: string, at?: [number, number]) {
    const user = s.user!;
    const room = this.loadRoom(roomId);
    if (!room) return this.toast(s, 'Rummet findes ikke længere.', 'error');
    if (room === s.room) return;
    const isHome = roomId === user.homeRoomId;
    if (!isHome && this.cfg.onboardingLock && !this.onboarded(user))
      return this.toast(s, 'Klar dine startopgaver først – så åbner døren 🚪');
    const rec = this.roomRecord(room);
    const mine = isHome || rec?.ownerId === user.id;
    if (rec && !mine && !rec.rights.includes(user.id) && user.role === 'user') {
      if (rec.access === 'locked') return this.toast(s, 'Værelset er låst 🔒');
      if (rec.access === 'password') {
        if (!password) return this.send(s, { t: 'needPassword', roomId });
        if (hashSecret(password) !== rec.passwordHash)
          return this.toast(s, 'Forkert adgangskode', 'error');
      }
    }
    if (!mine && user.role === 'user' && room.humans().length >= ROOM_CAPACITY)
      return this.toast(s, `${room.meta.name} er fyldt lige nu – prøv igen om lidt 🙂`);
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
      badge: this.badgeIcon(user),
      level: levelOf(user).level,
      pet: this.activePetView(user),
      effect: user.effect,
    };
    room.add(player, at);
    s.room = room;
    user.lastRoom = { id: room.meta.id, at: Date.now() };
    s.player = player;
    this.send(s, { t: 'room', room: room.roomView(user.id), serverTime: Date.now() });
    this.send(s, {
      t: 'chest',
      chest: this.chest?.roomId === room.meta.id ? this.chest.view : null,
    });
    this.send(s, this.likesMsg(room.meta.id, user.id));
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

  /**
   * Rooms for the navigator. Without a search: public rooms, plus guest rooms with people in them,
   * your own, your friends' and your favourites (busiest first). With a search: every guest room
   * whose name, description or owner matches.
   */
  private navigator(
    user: UserRecord,
    q?: string,
    cat?: RoomCategory,
    top?: boolean,
  ): NavigatorRoom[] {
    const favs = new Set(user.favorites ?? []);
    const query = (q ?? '').trim().toLowerCase();
    const out: NavigatorRoom[] = PUBLIC_ROOMS.filter(
      (r) => !query || r.name.toLowerCase().includes(query),
    ).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ownerName: null,
      access: 'open',
      public: true,
      users: this.rooms.get(r.id)?.humans().length ?? 0,
      max: ROOM_CAPACITY,
      category: r.category,
      fav: favs.has(r.id),
    }));
    const guest = this.store
      .listRooms()
      .map((rec) => ({
        rec,
        owner: this.store.getUser(rec.ownerId)?.name ?? null,
        users: this.rooms.get(rec.id)?.humans().length ?? 0,
      }))
      .filter(({ rec, users, owner }) =>
        top
          ? (rec.likes?.length ?? 0) > 0 && rec.access !== 'locked'
          : query
            ? `${rec.name} ${rec.description} ${owner ?? ''}`.toLowerCase().includes(query)
            : cat
              ? (rec.category ?? 'andet') === cat &&
                (rec.access !== 'locked' || rec.ownerId === user.id)
              : users > 0 ||
                rec.ownerId === user.id ||
                user.friends.includes(rec.ownerId) ||
                favs.has(rec.id),
      )
      .sort((a, b) =>
        top
          ? (b.rec.likes?.length ?? 0) - (a.rec.likes?.length ?? 0) || b.users - a.users
          : b.users - a.users || a.rec.name.localeCompare(b.rec.name, 'da'),
      )
      .slice(0, top ? 30 : 60)
      .map(({ rec, users, owner }) => ({
        id: rec.id,
        name: rec.name,
        description: rec.description,
        ownerName: owner,
        access: rec.access,
        users,
        max: ROOM_CAPACITY,
        public: false,
        category: rec.category ?? 'andet',
        fav: favs.has(rec.id),
        likes: rec.likes?.length ?? 0,
      }));
    return [...out, ...guest];
  }

  /* ---------------- progress ---------------- */

  /** Coins earned per user in the current hour – for the "unusual activity" alarm. */
  private earned = new Map<string, { hour: number; sum: number; warned: boolean }>();

  private coins(s: Session, user: UserRecord, delta: number, reason?: string) {
    if (delta > 0) {
      const hour = Math.floor(Date.now() / 3600_000);
      let e = this.earned.get(user.id);
      if (!e || e.hour !== hour) this.earned.set(user.id, (e = { hour, sum: 0, warned: false }));
      e.sum += delta;
      if (e.sum > COIN_ALARM_PER_HOUR && !e.warned) {
        e.warned = true;
        reportWarning(`${user.name} har tjent ${e.sum} mønter inden for en time`);
      }
    }
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
    this.checkLevel(s, user);
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
      case 'feedback':
        return this.send(s, { t: 'adminFeedback', items: this.feedbackViews() });
      case 'feedbackDone': {
        const f = this.store.listFeedback().find((x) => x.id === msg.reportId);
        if (f) {
          f.done = !f.done;
          this.store.touch();
        }
        return this.send(s, { t: 'adminFeedback', items: this.feedbackViews() });
      }
      case 'chestSpawn':
        if (user.role !== 'admin') return;
        return this.spawnChest(s.room ?? undefined)
          ? done('Der er gemt en guldkiste ✨')
          : done('Kunne ikke gemme en kiste her (kun i offentlige rum).');
      case 'users': {
        // Only admins see the whole list (moderators handle reports).
        if (user.role !== 'admin') return this.toast(s, 'Kun for administratorer.', 'error');
        return this.send(s, { t: 'adminUsers', ...this.adminUsersData() });
      }
      case 'junior':
      case 'juniorOpen': {
        if (user.role !== 'admin') return this.toast(s, 'Kun for administratorer.', 'error');
        void this.juniorStaff(s, msg.action);
        return;
      }
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
            `⚠️ Besked fra en moderator: ${msg.text ?? 'Husk at være venlig på Lobbi.'}`,
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

  /* ---------------- room games (furniture games) ---------------- */

  /** Extra state per running game that clients don't need to see. */
  private gameState = new Map<
    string,
    { startedBy: string; lastSent: number; cooldownUntil: number }
  >();

  private gameStart(s: Session, user: UserRecord, itemId: number, kind: RoomGameKind) {
    const room = s.room;
    if (!room || !s.player) return;
    const box = room.items.find((i) => i.id === itemId && i.type === 'gamebox');
    if (!box) return;
    if (room.game) return this.toast(s, 'Der er allerede et spil i gang.');
    const st = this.gameState.get(room.meta.id);
    if (st && st.cooldownUntil > Date.now())
      return this.toast(s, 'Vent et øjeblik før næste spil.');
    const def = ROOM_GAMES[kind];
    const count = (t: string) => room.items.filter((i) => i.type === t).length;
    if (kind === 'paint' && count('colortile') < 4)
      return this.toast(s, `${def.name} kræver: ${def.needs.toLowerCase()}.`, 'error');
    if (kind === 'race' && (!count('racestart') || !count('racegoal')))
      return this.toast(s, `${def.name} kræver: ${def.needs.toLowerCase()}.`, 'error');
    if (kind === 'snow' && !count('snedrive'))
      return this.toast(s, `${def.name} kræver: ${def.needs.toLowerCase()}.`, 'error');
    const players = room.humans();
    const until = Date.now() + GAME_COUNTDOWN_MS;
    if (kind === 'snow') {
      const order = [...players].sort(() => Math.random() - 0.5);
      const teams: Record<string, 1 | 2> = {};
      const ammo: Record<string, number> = {};
      order.forEach((p, i) => {
        teams[p.id] = i % 2 === 0 ? 1 : 2;
        ammo[p.id] = SNOW.ammo;
      });
      room.game = { kind, phase: 'countdown', until, teams, score: [0, 0], ammo };
      this.snowCd.clear();
    } else if (kind === 'paint') {
      // Shuffle into two teams of (almost) equal size.
      const order = [...players].sort(() => Math.random() - 0.5);
      const teams: Record<string, 1 | 2> = {};
      order.forEach((p, i) => (teams[p.id] = i % 2 === 0 ? 1 : 2));
      for (const it of room.items)
        if (it.type === 'colortile' && itemState(it) !== 0) {
          it.state = 0;
          room.broadcast({ t: 'itemPut', item: it });
        }
      room.game = { kind, phase: 'countdown', until, teams, score: [0, 0] };
    } else {
      const onStart = players.filter((p) => {
        const [x, z] = room.tileOf(p);
        return room.items.some((i) => i.type === 'racestart' && i.x === x && i.z === z);
      });
      room.game = {
        kind,
        phase: 'countdown',
        until,
        racers: (onStart.length ? onStart : players).map((p) => p.id),
      };
    }
    this.gameState.set(room.meta.id, { startedBy: user.id, lastSent: 0, cooldownUntil: 0 });
    room.broadcast({ t: 'roomGame', game: room.game });
    this.sys(room, `${def.icon} ${user.name} starter ${def.name}! ${def.rules}`);
  }

  /** Runs every tick for rooms with a game. */
  private gameTick(room: RoomInstance, now: number) {
    const g = room.game;
    if (!g) return;
    const st = this.gameState.get(room.meta.id);
    if (!room.humans().length) return this.gameEnd(room, null);
    if (g.phase === 'countdown') {
      if (now < g.until) return;
      g.phase = 'play';
      g.until = now + ROOM_GAMES[g.kind].secs * 1000;
      room.broadcast({ t: 'roomGame', game: g });
      this.sys(
        room,
        g.kind === 'race' ? '🏁 Løb!' : g.kind === 'snow' ? '❄️ Kast løs!' : '🎨 Farv løs!',
      );
      return;
    }
    if (g.kind === 'snow') {
      // Standing next to a snow pile refills your snowballs.
      let changed = false;
      const piles = room.items.filter((i) => i.type === 'snedrive');
      for (const p of room.humans()) {
        if (!g.teams?.[p.id] || !g.ammo) continue;
        const [x, z] = room.tileOf(p);
        const near = piles.some((i) => Math.max(Math.abs(i.x - x), Math.abs(i.z - z)) <= 1);
        if (near && (g.ammo[p.id] ?? 0) < SNOW.ammo) {
          g.ammo[p.id] = SNOW.ammo;
          changed = true;
        }
      }
      if (changed) room.broadcast({ t: 'roomGame', game: g });
      if (now >= g.until) {
        const [r, b] = g.score ?? [0, 0];
        this.gameEnd(room, r === b ? null : r > b ? 1 : 2);
      }
      return;
    }
    if (g.kind === 'paint') {
      let changed = false;
      for (const p of room.humans()) {
        const team = g.teams?.[p.id];
        if (!team) continue;
        const [x, z] = room.tileOf(p);
        const tile = room.items.find((i) => i.type === 'colortile' && i.x === x && i.z === z);
        if (tile && itemState(tile) !== team) {
          tile.state = team;
          room.broadcast({ t: 'itemPut', item: tile });
          changed = true;
        }
      }
      if (changed || (st && now - st.lastSent > 1000)) {
        const tiles = room.items.filter((i) => i.type === 'colortile');
        g.score = [
          tiles.filter((t) => itemState(t) === 1).length,
          tiles.filter((t) => itemState(t) === 2).length,
        ];
        if (st) st.lastSent = now;
        room.broadcast({ t: 'roomGame', game: g });
      }
      if (now >= g.until) {
        const [r, b] = g.score ?? [0, 0];
        this.gameEnd(room, r === b ? null : r > b ? 1 : 2);
      }
    } else {
      for (const id of g.racers ?? []) {
        const p = room.players.get(id);
        if (!p) continue;
        const [x, z] = room.tileOf(p);
        if (room.items.some((i) => i.type === 'racegoal' && i.x === x && i.z === z))
          return this.gameEnd(room, id);
      }
      if (now >= g.until) this.gameEnd(room, null);
    }
  }

  /** Last throw and "frozen until" per player in a Sneboldkamp. */
  private snowCd = new Map<string, { at: number; frozen: number }>();

  private snowThrow(s: Session, room: RoomInstance, p: PlayerState, targetId: string) {
    const g = room.game;
    if (!g || g.kind !== 'snow' || g.phase !== 'play' || !g.teams || !g.ammo) return;
    const myTeam = g.teams[p.id];
    const theirTeam = g.teams[targetId];
    const target = room.players.get(targetId);
    if (!myTeam || !theirTeam || myTeam === theirTeam || !target) return;
    const now = Date.now();
    const cd = this.snowCd.get(p.id) ?? { at: 0, frozen: 0 };
    if (cd.frozen > now) return this.toast(s, '🥶 Du er ramt – vent et øjeblik');
    if (now - cd.at < SNOW.cooldownMs) return;
    if ((g.ammo[p.id] ?? 0) <= 0) return this.toast(s, '❄️ Ingen snebolde – gå hen til snedriven');
    const [ax, az] = room.tileOf(p);
    const [bx, bz] = room.tileOf(target);
    if (Math.max(Math.abs(ax - bx), Math.abs(az - bz)) > SNOW.range)
      return this.toast(s, 'For langt væk – gå tættere på');
    cd.at = now;
    this.snowCd.set(p.id, cd);
    g.ammo[p.id] = (g.ammo[p.id] ?? 0) - 1;
    const tc = this.snowCd.get(target.id) ?? { at: 0, frozen: 0 };
    // A player who was just hit can't be hit again right away.
    const hit = tc.frozen <= now;
    if (hit) {
      tc.frozen = now + SNOW.freezeMs;
      this.snowCd.set(target.id, tc);
      const [r, b] = g.score ?? [0, 0];
      g.score = myTeam === 1 ? [r + 1, b] : [r, b + 1];
    }
    room.broadcast({ t: 'snowball', from: p.id, to: target.id, hit });
    room.broadcast({ t: 'roomGame', game: g });
  }

  /** Ends the game: winner is a team (Farvekamp) or a player id (Kapløb), or null. */
  private gameEnd(room: RoomInstance, winner: 1 | 2 | string | null) {
    const g = room.game;
    if (!g) return;
    room.game = null;
    const st = this.gameState.get(room.meta.id);
    if (st) st.cooldownUntil = Date.now() + 5000;
    room.broadcast({ t: 'roomGame', game: null });
    const def = ROOM_GAMES[g.kind];
    const playing = g.teams ? Object.keys(g.teams) : (g.racers ?? []);
    const enough = playing.filter((id) => room.players.has(id)).length >= 2;
    const winners =
      winner === null
        ? []
        : typeof winner === 'number'
          ? playing.filter((id) => g.teams?.[id] === winner)
          : [winner];
    for (const id of winners) {
      const s = this.byUser.get(id);
      const u = this.store.getUser(id);
      if (!s || !u) continue;
      // Coins only when at least two people played (no farming alone).
      const got = enough ? this.gameReward(s, u, def.reward) : 0;
      this.toast(s, got ? `🏆 Du vandt ${def.name}! +${got} 🪙` : `🏆 Du vandt ${def.name}!`);
    }
    const score = g.score ? ` (${g.score[0]}–${g.score[1]})` : '';
    if (winner === null) this.sys(room, `${def.icon} ${def.name} slut – uafgjort${score}.`);
    else if (typeof winner === 'number')
      this.sys(room, `${def.icon} ${TEAM_NAMES[winner]} hold vinder ${def.name}${score}! 🎉`);
    else
      this.sys(
        room,
        `${def.icon} ${this.store.getUser(winner)?.name ?? '?'} vinder ${def.name}! 🎉`,
      );
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
    if (cmd === 'penge') {
      // Admin-only cheat for testing: +100 coins, logged in the admin log.
      if (user.role === 'user') return false;
      this.coins(s, user, 100, 'cheat');
      this.store.logAdmin({
        at: new Date().toISOString(),
        by: user.id,
        action: 'cheatCoins',
        target: user.id,
        detail: '+100',
      });
      this.toast(s, '🪙 +100 mønter');
      return true;
    }
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
    if (s) this.checkLevel(s, user);
  }

  /** Icon shown by the name: chosen badge, or the newest one. */
  private badgeIcon(u: UserRecord): string | undefined {
    if (u.showBadge === null) return undefined;
    const id = (
      u.showBadge && u.badges.includes(u.showBadge as BadgeId) ? u.showBadge : u.badges.at(-1)
    ) as BadgeId | undefined;
    return id ? BADGES[id]?.icon : undefined;
  }

  private updateTag(s: Session, u: UserRecord) {
    const icon = this.badgeIcon(u);
    const level = levelOf(u).level;
    if (s.player) {
      s.player.badge = icon;
      s.player.level = level;
    }
    s.room?.broadcast({ t: 'tag', id: u.id, badge: icon, level });
    this.send(s, { t: 'tag', id: u.id, badge: icon, shown: u.showBadge, level });
  }

  /** Re-sends the name tag when the level went up. */
  private checkLevel(s: Session, u: UserRecord) {
    const level = levelOf(u).level;
    if (s.player && s.player.level !== level) {
      const up = (s.player.level ?? 1) < level;
      this.updateTag(s, u);
      if (up) this.toast(s, `⭐ Du er nu level ${level}!`);
      if (up && level >= 2) this.payReferral(s, u);
    }
  }

  /* ---------------- chat ---------------- */

  private sayInRoom(room: RoomInstance, p: PlayerState, text: string, shout = false) {
    const style = p.bot ? undefined : this.store.getUser(p.id)?.bubble;
    room.broadcast(
      { t: 'chat', id: p.id, name: p.name, text, bot: p.bot, style, shout: shout || undefined },
      { fromUser: p.id },
    );
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
    if (this.cfg.junior && !this.juniorAllows(s, msg)) return;
    switch (msg.t) {
      case 'join':
        return this.join(s, msg.roomId, msg.password);
      case 'navigator':
        return this.send(s, {
          t: 'navigator',
          rooms: this.navigator(user, msg.q, msg.cat as RoomCategory | undefined, msg.top),
          q: msg.q,
          cat: msg.cat as RoomCategory | undefined,
        });
      case 'favorite': {
        const favs = (user.favorites ??= []).filter((id) => id !== msg.roomId);
        if (
          msg.on &&
          (this.store.getRoom(msg.roomId) || PUBLIC_ROOMS.some((r) => r.id === msg.roomId))
        )
          favs.unshift(msg.roomId);
        user.favorites = favs.slice(0, 50);
        this.store.touch();
        return this.send(s, { t: 'navigator', rooms: this.navigator(user) });
      }
      case 'move':
        s.doorTicket = (s.doorTicket ?? 0) + 1;
        if (room && player) room.walk(player, [msg.x, msg.z], msg.run);
        return;
      case 'chestOpen':
        return this.chestOpen(s, user, msg.id);
      case 'likeRoom':
        return this.likeRoom(s, user, msg.on);
      case 'feedback':
        return this.feedback(s, user, msg);
      case 'giftSend':
        return this.giftSend(s, user, msg);
      case 'giftOpen':
        return this.giftOpen(s, user, msg.id);
      case 'deleteAccount':
        return this.deleteAccount(s, user, msg.confirm);
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
      case 'glide': {
        if (!room || !player) return;
        room.glide(player, msg.x, msg.z, msg.run);
        // Walking into an apartment door with the arrow keys takes you through it.
        const t = room.tileOf(player);
        const door = room.meta.doors.find(
          (d) => doorSpot(d).join() === t.join() && (d.wall === 0 ? msg.z < -0.15 : msg.x < -0.15),
        );
        if (door) this.throughDoor(s, room, door);
        return;
      }
      case 'sit':
        if (room && player) room.sit(player, msg.itemId);
        return;
      case 'use': {
        if (!room) return;
        const it = room.items.find((i) => i.id === msg.itemId);
        const def = it && furniture(it.type);
        if (!it || !def?.states) return;
        // Colour tiles are painted by the game, not switched by hand.
        if (it.type === 'colortile') return;
        const own = this.ownRoom(s, user);
        if (!own && user.role === 'user')
          return this.toast(s, 'Du kan kun tænde og slukke på dit eget værelse 💡', 'error');
        it.state = (itemState(it) + 1) % def.states;
        const rec = own?.rec.items.find((i) => i.id === it.id);
        if (rec && rec !== it) rec.state = it.state;
        this.store.touch();
        room.broadcast({ t: 'itemPut', item: it });
        return;
      }
      case 'chat': {
        if (!room || !player) return;
        const text = filterChat(sanitizeChat(msg.text));
        if (!text) return;
        if (user.mutedUntil && user.mutedUntil > Date.now())
          return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
        // ":sit", ":kram", ":heart" … do the action or emote instead of saying it.
        const cmd = /^:([\p{L}-]+)$/u.exec(text.trim())?.[1]?.toLowerCase();
        if (cmd && ACTION_COMMANDS[cmd]) return this.doAction(s, user, ACTION_COMMANDS[cmd]);
        if (cmd && EMOTE_COMMANDS[cmd]) return this.emote(room, player, EMOTE_COMMANDS[cmd]);
        const shout = shoutText(text);
        if (shout !== null) {
          if (s.shoutAt && Date.now() - s.shoutAt < SHOUT_COOLDOWN_MS)
            return this.toast(
              s,
              `Du kan råbe igen om ${Math.ceil((SHOUT_COOLDOWN_MS - (Date.now() - s.shoutAt)) / 1000)} sek 📢`,
              'error',
            );
          s.shoutAt = Date.now();
          this.sayInRoom(room, player, shout, true);
          this.bots.onChat(room, player, shout);
          return;
        }
        if (text.startsWith('/') && this.game(s, user, room, player, text)) return;
        // Junior: anything that wasn't a command must be one of the ready-made sentences.
        if (this.cfg.junior && !isJuniorPhrase(text))
          return this.toast(s, 'Vælg en sætning fra chat-menuen 💬', 'error');
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
        this.petHears(user, room, text);
        return;
      }
      case 'action':
        return this.doAction(s, user, msg.kind === 'stop' ? null : (msg.kind as ActionKind));
      case 'outfitSave': {
        const outfits = (user.outfits ??= Array(OUTFIT_SLOTS).fill(null));
        outfits[msg.slot] = { ...user.look };
        this.store.touch();
        return this.toast(s, `👕 Outfit ${msg.slot + 1} gemt`);
      }
      case 'outfitWear': {
        const look = user.outfits?.[msg.slot];
        if (!look) return this.toast(s, 'Den plads er tom – gem et outfit først.', 'error');
        this.handle(s, user, { t: 'look', look });
        return;
      }
      case 'setEffect': {
        const eventOn = this.currentEvents().length > 0;
        if (!effectUnlocked(msg.effect, user.badges, levelOf(user).level, eventOn))
          return this.toast(s, '🔒 Den effekt er ikke låst op endnu', 'error');
        user.effect = msg.effect === 'none' ? undefined : msg.effect;
        this.store.touch();
        if (player) player.effect = user.effect;
        room?.broadcast({ t: 'effect', id: user.id, effect: user.effect ?? 'none' });
        return;
      }
      case 'dispense':
        if (room && player) this.dispense(s, room, player, msg.itemId, msg.kind as CarryKind);
        return;
      case 'carryDrop':
        if (room && player) this.setCarry(room, player, null);
        return;
      case 'carryGive': {
        if (!room || !player?.carry) return;
        const to = room.players.get(msg.userId);
        if (!to || to.bot || to.id === player.id)
          return this.toast(s, 'Personen skal være i samme rum.', 'error');
        const what = player.carry;
        this.setCarry(room, player, null);
        this.setCarry(room, to, what);
        const ts = this.byUser.get(to.id);
        if (ts)
          this.toast(
            ts,
            `${CARRY[what].icon} ${user.name} gav dig: ${CARRY[what].name.toLowerCase()}`,
          );
        this.emote(room, to, 'heart');
        return this.toast(s, `${CARRY[what].icon} Du gav ${to.name} en gave`);
      }
      case 'emote':
        if (room && player) this.emote(room, player, msg.kind as EmoteKind);
        return;
      case 'setBubble':
        if (!bubbleUnlocked(msg.style, user.badges, levelOf(user).level))
          return this.toast(s, '🔒 Den boble er ikke låst op endnu', 'error');
        user.bubble = msg.style;
        this.store.touch();
        return this.toast(s, '💬 Ny chatboble valgt');
      case 'setPrivacy':
        user.noFollow = msg.noFollow;
        this.store.touch();
        this.notifyFriendsOf(user);
        return this.toast(
          s,
          msg.noFollow ? '🔒 Venner kan ikke længere følge dig' : '👣 Venner kan følge dig igen',
        );
      case 'setRelation': {
        if (!user.friends.includes(msg.userId))
          return this.toast(s, 'Du kan kun markere dine venner.', 'error');
        const rel = (user.relations ??= {});
        if (msg.kind) rel[msg.userId] = msg.kind as RelationKind;
        else delete rel[msg.userId];
        this.store.touch();
        return;
      }
      case 'notes':
        if (room) this.sendNotes(s, user, room);
        return;
      case 'noteWrite':
        if (room) this.noteWrite(s, user, room, msg.text, msg.color);
        return;
      case 'noteApprove':
      case 'noteDelete':
        if (room) this.noteModerate(s, user, room, msg.id, msg.t === 'noteApprove');
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
      case 'buyRoom':
        return this.buyRoom(s, user, msg.kind);
      case 'buyPet':
        return this.buyPet(s, user, msg.kind as PetKind, msg.name, msg.color);
      case 'petOut':
        return this.petOut(s, user, msg.id);
      case 'setHeight':
        return this.setHeight(s, user, msg.x, msg.z, msg.h);
      case 'market':
        return this.sendMarket(s, user, msg.q);
      case 'marketSell':
        return this.marketSell(s, user, msg.index, msg.price);
      case 'marketBuy':
        return this.marketBuy(s, user, msg.id);
      case 'marketCancel':
        return this.marketCancel(s, user, msg.id);
      case 'guestbookWrite':
        return this.guestbookWrite(s, user, msg.userId, msg.text);
      case 'guestbookDelete':
        return this.guestbookDelete(s, user, msg.userId, msg.id);
      case 'teleport':
        return this.teleport(s, user, msg.itemId);
      case 'cinemaAdd':
        if (room) void this.cinemaAdd(s, user, room, msg.itemId, msg.video);
        return;
      case 'cinemaGet': {
        const it = room?.items.find((i) => i.id === msg.itemId && i.type === 'laerred');
        if (room && it) this.send(s, { t: 'cinema', view: this.cinemaView(room, it, user) });
        return;
      }
      case 'cinemaSkip':
        if (room) this.cinemaSkip(s, user, room, msg.itemId);
        return;
      case 'cinemaStop':
        if (room) this.cinemaStop(s, user, room, msg.itemId);
        return;
      case 'cinemaRemove':
        if (room) this.cinemaRemove(s, user, room, msg.itemId, msg.id);
        return;
      case 'snowThrow':
        if (room && player) this.snowThrow(s, room, player, msg.targetId);
        return;
      case 'jukebox': {
        if (!room) return;
        const it = room.items.find((i) => i.id === msg.itemId && i.type === 'jukebox');
        if (!it) return;
        const rec = this.roomRecord(room);
        const allowed =
          user.role !== 'user' ||
          (rec && (rec.ownerId === user.id || rec.rights.includes(user.id)));
        if (!allowed) return this.toast(s, 'Kun ejeren kan vælge musik her 🎵', 'error');
        if (msg.song) {
          it.state = 1;
          it.song = msg.song;
          it.songAt = Date.now();
        } else {
          it.state = 0;
          delete it.song;
          delete it.songAt;
        }
        const saved = rec?.items.find((i) => i.id === it.id);
        if (saved && saved !== it)
          Object.assign(saved, { state: it.state, song: it.song, songAt: it.songAt });
        this.store.touch();
        room.broadcast({ t: 'itemPut', item: it });
        return;
      }
      case 'gameStart':
        return this.gameStart(s, user, msg.itemId, msg.kind as RoomGameKind);
      case 'aptDoor': {
        const d = room?.meta.doors[msg.index];
        if (!room || !player || !d) return;
        const [dx, dz] = doorSpot(d);
        const here = room.tileOf(player);
        if (Math.max(Math.abs(here[0] - dx), Math.abs(here[1] - dz)) <= 1)
          return this.throughDoor(s, room, d);
        // Walk to the door (or as close as furniture allows), then go through.
        const goal = room.walk(player, [dx, dz]) ? null : this.freeNeighbour(room, dx, dz);
        if (goal && !room.walk(player, goal)) return;
        if (!player.path.length) return;
        const ms = (player.path.length / WALK_SPEED) * 1000 + 250;
        const ticket = (s.doorTicket = (s.doorTicket ?? 0) + 1);
        setTimeout(() => {
          if (s.room !== room || s.player !== player || s.doorTicket !== ticket) return;
          const t = room.tileOf(player);
          if (Math.max(Math.abs(t[0] - dx), Math.abs(t[1] - dz)) <= 1) this.throughDoor(s, room, d);
        }, ms);
        return;
      }
      case 'renovate':
        return this.renovate(s, user, msg.size, msg.shape as RoomShape);
      case 'petFeed':
        return this.petFeed(s, user);
      case 'petTrick':
        return this.petTrick(s, user, msg.trick as PetTrick);
      case 'petRename': {
        const pet = (user.pets ?? []).find((p) => p.id === msg.id);
        const name = filterChat(sanitizeChat(msg.name)).trim();
        if (!pet || !isValidName(name)) return this.toast(s, 'Det navn kan ikke bruges.', 'error');
        pet.name = name;
        this.store.touch();
        this.sendPets(s, user);
        if (user.activePet === pet.id) this.broadcastPet(s, user);
        return;
      }
      case 'decor':
        return this.setDecor(s, user, msg.kind, msg.id);
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
        // Junior: no beards for children, whatever the client sends.
        user.look = this.cfg.junior ? { ...msg.look, beard: 'ingen' } : msg.look;
        this.store.touch();
        if (player) player.look = user.look;
        room?.broadcast({ t: 'look', id: user.id, look: user.look });
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
      case 'hush':
        if (user.mutedUntil && user.mutedUntil > Date.now())
          return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
        return msg.t === 'hush'
          ? this.hush(s, user, msg.to, msg.text)
          : this.whisper(s, user, msg.to, msg.text);
      case 'pmHistory':
        return this.pmHistory(s, user, msg.with);
      case 'admin':
        return this.admin(s, user, msg);
      case 'showBadge':
        if (msg.id !== null && !user.badges.includes(msg.id as BadgeId)) return;
        user.showBadge = msg.id;
        this.store.touch();
        return this.updateTag(s, user);
      case 'block':
        return this.block(s, user, msg.userId, msg.block);
      case 'report':
        return this.report(s, user, msg.userId, msg.reason);
      case 'profile':
        return this.profile(s, user, msg.userId);
    }
  }

  /* ---------------- stairs and platforms ---------------- */

  private setHeight(s: Session, user: UserRecord, x: number, z: number, h: number) {
    const room = s.room;
    const rec = room && this.roomRecord(room);
    if (!room || !rec || (rec.ownerId !== user.id && !rec.rights.includes(user.id)))
      return this.toast(s, 'Du kan kun bygge i rum, hvor du har byggerettigheder.', 'error');
    const floor = room.floor();
    if (!isFloorTile(floor, x, z)) return;
    if (x === DOOR_TILE[0] && z === DOOR_TILE[1])
      return this.toast(s, 'Feltet foran døren skal blive på gulvet.', 'error');
    if (room.items.some((it) => tilesOf(it).some(([a, b]) => a === x && b === z)))
      return this.toast(s, 'Flyt møblet væk fra feltet først.', 'error');
    const heights = (rec.heights ??= {});
    if (h === 0) delete heights[`${x},${z}`];
    else heights[`${x},${z}`] = h;
    room.meta.heights = heights;
    this.store.touch();
    room.broadcast({ t: 'heights', heights });
  }

  /* ---------------- renovation ---------------- */

  /**
   * New size and floor plan for one of your own rooms. Furniture that no longer fits goes to your
   * inventory; everyone in the room starts again at the door.
   */
  private renovate(s: Session, user: UserRecord, size: number, shape: RoomShape) {
    const room = s.room;
    const rec = room && this.roomRecord(room);
    if (!room || !rec || rec.ownerId !== user.id)
      return this.toast(s, 'Du kan kun bygge om i dine egne rum.', 'error');
    const paid = rec.paidSize ?? ROOM_SIZE;
    const tier = SIZE_PRICES[size];
    if (!tier || size > MAX_USER_ROOM_SIZE) return;
    if (size > paid && levelOf(user).level < tier.minLevel)
      return this.toast(s, `🔒 ${size}×${size} kræver level ${tier.minLevel}`, 'error');
    const price = renovationPrice(paid, size);
    if (user.coins < price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const heights = Object.fromEntries(
      Object.entries(rec.heights ?? {}).filter(([k]) => {
        const [hx, hz] = k.split(',').map(Number) as [number, number];
        return isFloorTile({ size, shape }, hx, hz);
      }),
    );
    const floor = { size, shape, heights };
    const blocks = themeWallBlocks(room.meta.theme, floor);
    const keep: PlacedItem[] = [];
    const moved: PlacedItem[] = [];
    for (const it of rec.items) (canPlace(floor, keep, it, [], blocks) ? keep : moved).push(it);
    const inv = (user.inventory ??= []);
    if (inv.length + moved.length > 200)
      return this.toast(s, 'Der er ikke plads i dit inventar til møblerne.', 'error');
    for (const it of moved) inv.push(this.invOf(it));
    rec.items.splice(0, rec.items.length, ...keep);
    rec.heights = room.meta.heights = heights;
    rec.size = room.meta.size = size;
    rec.shape = room.meta.shape = shape;
    rec.paidSize = room.meta.paidSize = Math.max(paid, size);
    if (price) this.coins(s, user, -price);
    this.store.touch();
    room.meta.doors = this.aptDoors(rec);
    // Everyone starts again at the door of the new floor plan.
    const here = [...room.players.values()];
    for (const p of here) room.remove(p.id);
    for (const p of here) room.add(p);
    for (const p of here) {
      const ps = this.byUser.get(p.id);
      if (ps && !p.bot)
        this.send(ps, { t: 'room', room: room.roomView(p.id), serverTime: Date.now() });
    }
    if (moved.length) this.sendInventory(s, user);
    this.toast(
      s,
      `📐 Rummet er bygget om til ${size}×${size}${moved.length ? ` · ${moved.length} møbler lagt i dit inventar` : ''}`,
    );
  }

  /* ---------------- pets ---------------- */

  private petView(p: PetRecord): PetView {
    return { kind: p.kind, name: p.name, color: p.color, level: petLevel(p.xp) };
  }
  private petInfo(p: PetRecord): PetInfo {
    const now = Date.now();
    return {
      ...this.petView(p),
      id: p.id,
      xp: p.xp,
      hungry: now - p.lastFed > PET_HUNGRY_AFTER_MS,
      feedAt: p.lastFed + PET_FEED_COOLDOWN_MS > now ? p.lastFed + PET_FEED_COOLDOWN_MS : 0,
    };
  }
  private activePet(user: UserRecord): PetRecord | undefined {
    return (user.pets ?? []).find((p) => p.id === user.activePet);
  }
  private activePetView(user: UserRecord): PetView | undefined {
    const p = this.activePet(user);
    return p && this.petView(p);
  }
  private sendPets(s: Session, user: UserRecord) {
    this.send(s, {
      t: 'pets',
      pets: (user.pets ?? []).map((p) => this.petInfo(p)),
      active: user.activePet ?? null,
    });
  }
  /** Tells the room which pet (if any) follows this player now. */
  private broadcastPet(s: Session, user: UserRecord) {
    const pet = this.activePetView(user);
    if (s.player) s.player.pet = pet;
    s.room?.broadcast({ t: 'petView', ownerId: user.id, pet: pet ?? null });
  }
  private petSound(p: PetRecord) {
    const sounds = PET_KINDS[p.kind].sounds;
    return sounds[Math.floor(Math.random() * sounds.length)]!;
  }
  private petXp(s: Session, user: UserRecord, p: PetRecord, xp: number) {
    const before = petLevel(p.xp);
    p.xp += xp;
    const after = petLevel(p.xp);
    if (after > before) {
      this.toast(s, `🐾 ${p.name} er nu level ${after}!`);
      if (user.activePet === p.id) this.broadcastPet(s, user);
    }
  }

  private buyPet(s: Session, user: UserRecord, kind: PetKind, rawName: string, color: number) {
    const def: PetKindDef = PET_KINDS[kind];
    const pets = (user.pets ??= []);
    if (pets.length >= PET_MAX)
      return this.toast(s, `Du kan højst have ${PET_MAX} kæledyr.`, 'error');
    if (def.minLevel && levelOf(user).level < def.minLevel)
      return this.toast(s, `🔒 Kræver level ${def.minLevel}`, 'error');
    if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    // Junior: pets get their kind as name, so no free text reaches other children.
    const name = this.cfg.junior ? def.name : filterChat(sanitizeChat(rawName)).trim();
    if (!isValidName(name)) return this.toast(s, 'Det navn kan ikke bruges.', 'error');
    const pet: PetRecord = {
      id: newId('pet'),
      kind,
      name,
      color: Math.min(color, def.colors.length - 1),
      xp: 0,
      lastFed: Date.now(),
      trickXp: 0,
      trickDate: '',
      lastTrick: 0,
    };
    pets.push(pet);
    this.coins(s, user, -def.price);
    user.activePet = pet.id;
    this.store.touch();
    this.toast(
      s,
      `${def.icon} Velkommen til ${pet.name}! Klik på ${pet.name} for at fodre og lære tricks.`,
    );
    this.sendPets(s, user);
    this.broadcastPet(s, user);
  }

  private petOut(s: Session, user: UserRecord, id: string | null) {
    if (id !== null && !(user.pets ?? []).some((p) => p.id === id)) return;
    user.activePet = id;
    this.store.touch();
    this.sendPets(s, user);
    this.broadcastPet(s, user);
  }

  private petFeed(s: Session, user: UserRecord) {
    const p = this.activePet(user);
    if (!p) return this.toast(s, 'Tag et kæledyr med først 🐾', 'error');
    const now = Date.now();
    if (now - p.lastFed < PET_FEED_COOLDOWN_MS) return this.toast(s, `${p.name} er mæt lige nu 😋`);
    if (user.coins < PET_FEED_PRICE) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    this.coins(s, user, -PET_FEED_PRICE);
    p.lastFed = now;
    this.petXp(s, user, p, PET_FEED_XP);
    this.store.touch();
    s.room?.broadcast({ t: 'petAct', ownerId: user.id, act: 'eat', say: 'Nam nam! 🍖' });
    this.sendPets(s, user);
  }

  private petTrick(s: Session, user: UserRecord, trick: PetTrick) {
    const p = this.activePet(user);
    if (!p || !s.room) return;
    const t = PET_TRICKS[trick];
    if (petLevel(p.xp) < t.level)
      return this.toast(s, `${p.name} kan først lære "${t.name}" på level ${t.level}.`, 'error');
    const now = Date.now();
    if (now - p.lastFed > PET_HUNGRY_AFTER_MS) {
      s.room.broadcast({ t: 'petAct', ownerId: user.id, act: 'sulk', say: '*er for sulten…*' });
      return this.toast(s, `${p.name} er sulten – giv mad først 🍖`);
    }
    if (now - p.lastTrick < PET_TRICK_COOLDOWN_MS) return;
    p.lastTrick = now;
    const today = danishDate();
    if (p.trickDate !== today) {
      p.trickDate = today;
      p.trickXp = 0;
    }
    if (p.trickXp < PET_TRICK_XP_PER_DAY) {
      p.trickXp += PET_TRICK_XP;
      this.petXp(s, user, p, PET_TRICK_XP);
    }
    this.store.touch();
    s.room.broadcast({ t: 'petAct', ownerId: user.id, act: trick, say: this.petSound(p) });
    this.sendPets(s, user);
  }

  /** The pet answers when its owner says its name. */
  private petHears(user: UserRecord, room: RoomInstance, text: string) {
    const p = this.activePet(user);
    if (!p || !text.toLowerCase().includes(p.name.toLowerCase())) return;
    setTimeout(
      () => room.broadcast({ t: 'petAct', ownerId: user.id, act: 'happy', say: this.petSound(p) }),
      700,
    );
  }

  /** Buys a wallpaper/floor if needed and uses it in the (own) room you are in. */
  private setDecor(s: Session, user: UserRecord, kind: DecorKind, id: string | null) {
    const room = s.room;
    const rec = room && this.roomRecord(room);
    if (!room || !rec || rec.ownerId !== user.id)
      return this.toast(s, 'Du kan kun ændre tapet og gulv i dine egne rum.', 'error');
    const owned = (user.decor ??= []);
    if (id !== null) {
      const def = decorDef(kind, id);
      if (!def) return;
      const key = decorKey(kind, id);
      if (!owned.includes(key)) {
        if (def.minLevel && levelOf(user).level < def.minLevel)
          return this.toast(s, `🔒 Kræver level ${def.minLevel}`, 'error');
        if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
        owned.push(key);
        this.coins(s, user, -def.price);
        this.toast(s, `🎨 Du har købt: ${def.name}`);
      }
    }
    if (kind === 'wall') rec.wall = room.meta.wall = id;
    else rec.floor = room.meta.floor = id;
    this.store.touch();
    room.broadcast(
      { t: 'decor', wall: room.meta.wall, floor: room.meta.floor },
      { except: user.id },
    );
    this.send(s, { t: 'decor', wall: room.meta.wall, floor: room.meta.floor, owned });
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
    const drop = def.limited
      ? activeDrop(type, Date.now(), this.cfg.limitedDrops ?? LIMITED_DROPS)
      : undefined;
    if (def.noShop && !drop) {
      if (def.limited) this.toast(s, 'Den er ikke til salg lige nu.', 'error');
      return;
    }
    if (drop && this.store.serialCount(type) >= drop.total)
      return this.toast(s, `${def.name} er udsolgt 😮`, 'error');
    if (def.unlock && !user.badges.includes(def.unlock))
      return this.toast(s, `🔒 Kræver badget "${BADGES[def.unlock].name}"`, 'error');
    if (def.minLevel && levelOf(user).level < def.minLevel)
      return this.toast(s, `🔒 Kræver level ${def.minLevel}`, 'error');
    if (own.rec.items.length >= 120) return this.toast(s, 'Værelset er fyldt helt op.', 'error');
    if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const item: PlacedItem = { id: own.rec.nextItemId, type, x, z, rot };
    if (color && def.colors && color < def.colors.length) item.color = color;
    if (!own.room.placeable(item)) return this.toast(s, 'Det kan ikke stå der 🙃', 'error');
    own.rec.nextItemId++;
    if (drop) item.serial = this.store.nextSerial(type);
    own.rec.items.push(item);
    user.stats.buys++;
    this.coins(s, user, -def.price);
    if (drop) {
      this.toast(s, `✨ Du har nr. ${serialLabel(item.serial!, drop.total)} af ${def.name}!`);
      this.store.logMarket({
        at: new Date().toISOString(),
        listingId: `limited:${type}#${item.serial}`,
        sellerId: 'shop',
        buyerId: user.id,
        item: type,
        price: def.price,
      });
      this.broadcastLimited();
    }
    if (def.pair) {
      // Teleporters come in pairs: the twin goes to your inventory.
      item.pair = newId('tp');
      (user.inventory ??= []).push(this.invOf(item));
      this.sendInventory(s, user);
      this.toast(
        s,
        '🌀 Den anden teleporter ligger i dit inventar – stil den i et andet rum, eller giv den til en ven.',
      );
    }
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

  /* ---------------- apartment ---------------- */

  private apartment(u: UserRecord) {
    const main = this.store.getRoom(u.homeRoomId);
    const out = [{ kind: 'living', id: u.homeRoomId, name: main?.name ?? 'Stue' }];
    for (const def of APARTMENT_ROOMS) {
      const id = u.apartment?.[def.kind];
      const rec = id && this.store.getRoom(id);
      if (rec) out.push({ kind: def.kind, id: rec.id, name: rec.name });
    }
    return out;
  }

  /** Doors in an apartment room: the living room leads to every other room, the others back to it. */
  private aptDoors(rec: RoomRecord): AptDoor[] {
    const owner = this.store.getUser(rec.ownerId);
    if (!owner) return [];
    const apt = this.apartment(owner);
    if (apt.length < 2 || !apt.some((r) => r.id === rec.id)) return [];
    const living = apt[0]!;
    const targets = rec.id === living.id ? apt.slice(1) : [living];
    const floor = { size: rec.size ?? ROOM_SIZE, shape: rec.shape ?? 'square' };
    const slots = doorSlots(rec.theme ?? 'home', floor);
    return targets.slice(0, slots.length).map((t, i) => ({
      roomId: t.id,
      // Short label for the sign above the door ("Badeværelse", "Stue").
      name:
        t.kind === 'living'
          ? 'Stue'
          : (APARTMENT_ROOMS.find((a) => a.kind === t.kind)?.name ?? t.name),
      icon:
        t.kind === 'living' ? '🛋️' : (APARTMENT_ROOMS.find((a) => a.kind === t.kind)?.icon ?? '🚪'),
      ...slots[i]!,
    }));
  }

  /** New doors after buying or rebuilding a room; everyone inside sees them at once. */
  private refreshAptDoors(owner: UserRecord) {
    for (const a of this.apartment(owner)) {
      const room = this.rooms.get(a.id);
      const rec = this.store.getRoom(a.id);
      if (!room || !rec) continue;
      const doors = this.aptDoors(rec);
      if (JSON.stringify(doors) === JSON.stringify(room.meta.doors)) continue;
      room.meta.doors = doors;
      for (const p of room.humans()) {
        const ps = this.byUser.get(p.id);
        if (ps) this.send(ps, { t: 'room', room: room.roomView(p.id), serverTime: Date.now() });
      }
    }
  }

  private throughDoor(s: Session, room: RoomInstance, door: AptDoor) {
    if (s.room !== room) return;
    if (s.doorAt && Date.now() - s.doorAt < 1500) return;
    s.doorAt = Date.now();
    const target = this.loadRoom(door.roomId);
    if (!target) return;
    // Arrive in front of the door that leads back.
    const back = target.meta.doors.find((d) => d.roomId === room.meta.id);
    this.join(s, target.meta.id, undefined, back ? doorSpot(back) : undefined);
  }

  private buyRoom(s: Session, user: UserRecord, kind: ApartmentKind) {
    const def = APARTMENT_ROOMS.find((r) => r.kind === kind)!;
    if (user.apartment?.[kind] && this.store.getRoom(user.apartment[kind]!))
      return this.toast(s, `Du har allerede et ${def.name.toLowerCase()}.`);
    if (levelOf(user).level < def.level)
      return this.toast(s, `🔒 ${def.name} kræver level ${def.level}.`, 'error');
    if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const rec = this.store.createRoom(
      user.id,
      `${user.name}s ${def.name.toLowerCase()}`,
      def.theme,
      APARTMENT_START_ITEMS[kind],
    );
    (user.apartment ??= {})[kind] = rec.id;
    this.coins(s, user, -def.price);
    this.store.touch();
    this.send(s, { t: 'apartment', rooms: this.apartment(user) });
    this.toast(s, `${def.icon} Dit nye ${def.name.toLowerCase()} er klar!`);
    this.join(s, rec.id);
    this.refreshAptDoors(user);
  }

  /* ---------------- inventory ---------------- */

  private sendInventory(s: Session, u: UserRecord) {
    this.send(s, { t: 'inventory', items: u.inventory ?? [] });
  }

  /** Inventory entry for a placed item (keeps colour and teleporter twin). */
  private invOf(it: PlacedItem) {
    const e: InvItem = { type: it.type };
    if (it.color) e.color = it.color;
    if (it.pair) e.pair = it.pair;
    if (it.serial) e.serial = it.serial;
    return e;
  }

  /** The admin list: newest players and the numbers. Also served to the adult admins from Junior. */
  adminUsersData() {
    const all = this.store.listUsers().filter((u) => !u.staff);
    const now = Date.now();
    const since = (ms: number) => all.filter((u) => now - Date.parse(u.createdAt) < ms).length;
    const users = [...all]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 100)
      .map((u) => ({
        id: u.id,
        name: u.name,
        createdAt: u.createdAt,
        lastSeen: u.lastSeen,
        online: this.byUser.has(u.id),
        role: u.role,
        login: (u.authId ? 'google' : 'password') as 'google' | 'password',
        coins: u.coins,
        onlineMin: Math.floor(u.onlineSec / 60),
        banned: !!u.bannedUntil && u.bannedUntil > now,
        muted: !!u.mutedUntil && u.mutedUntil > now,
        ...(this.cfg.junior ? { waiting: !u.parentConsentAt } : {}),
      }));
    const stats: AdminStats = {
      total: all.length,
      today: since(24 * 3600_000),
      week: since(7 * 24 * 3600_000),
      online: [...this.byUser.values()].filter((x) => !x.user?.staff).length,
      beta: betaStats(all),
      ...(this.cfg.junior ? { waitingParent: all.filter((u) => !u.parentConsentAt).length } : {}),
      ...(this.cfg.backupInfo?.() ?? {}),
    };
    return { stats, users };
  }

  /** Lobbi Junior: what the adult admins see (no e-mail addresses, no chat). */
  staffOverview(): JuniorOverview {
    return {
      ...this.adminUsersData(),
      reportsOpen: this.store.listReports().filter((r) => r.status === 'open').length,
      feedbackOpen: this.store.listFeedback().filter((f) => !f.done).length,
    };
  }

  /** Adult server: ask Lobbi Junior's staff API for its numbers or a one-time login link. */
  private async juniorStaff(s: Session, action: 'junior' | 'juniorOpen') {
    const api = this.cfg.juniorApi;
    if (!api)
      return this.send(s, {
        t: 'adminJunior',
        overview: null,
        error: 'Forbindelsen til Lobbi Junior er ikke sat op (STAFF_API_KEY og JUNIOR_URL).',
      });
    const base = api.url.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/staff/${action === 'junior' ? 'overview' : 'login'}`, {
        method: action === 'junior' ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${api.key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (action === 'junior') {
        const overview = (await res.json()) as JuniorOverview;
        return this.send(s, { t: 'adminJunior', overview });
      }
      const { url } = (await res.json()) as { url: string };
      return this.send(s, { t: 'adminJuniorLink', url });
    } catch (e) {
      return this.send(s, {
        t: 'adminJunior',
        overview: null,
        error: `Kunne ikke nå Lobbi Junior (${(e as Error).message}).`,
      });
    }
  }

  /* ---------------- feedback ---------------- */

  private feedback(s: Session, user: UserRecord, msg: Extract<ClientMsg, { t: 'feedback' }>) {
    const text = filterChat(sanitizeChat(msg.text)).slice(0, 500);
    if (text.trim().length < 3) return;
    this.store.addFeedback({
      userId: user.id,
      name: user.name,
      kind: msg.kind,
      text,
      device: sanitizeChat(msg.device).slice(0, 160),
      roomName: s.room?.meta.name ?? null,
    });
    this.toast(s, 'Tak! Din besked er sendt til holdet bag Lobbi 💛');
    for (const other of this.byUser.values())
      if (other.user?.role === 'admin' && other !== s)
        this.toast(other, `💬 Ny ${msg.kind === 'bug' ? 'fejl' : 'idé'} fra ${user.name}`);
  }

  private feedbackViews(): FeedbackView[] {
    return [...this.store.listFeedback()]
      .reverse()
      .slice(0, 200)
      .map((f) => ({ ...f, done: !!f.done }));
  }

  /** Remembers that the player was online today (for the beta statistics). */
  private markActive(u: UserRecord) {
    const today = danishDate();
    const days = (u.days ??= []);
    if (days.at(-1) === today) return;
    days.push(today);
    if (days.length > 90) days.splice(0, days.length - 90);
    this.store.touch();
  }

  /* ---------------- daily gift, room likes and gifts ---------------- */

  /** Once a day: coins for logging in, more for each day in a row (fixed amounts, no luck). */
  private loginGift(s: Session, user: UserRecord) {
    if (this.cfg.loginGifts === false) return;
    const today = danishDate();
    const g = user.loginGift;
    if (g?.last === today) return;
    const yesterday = danishDate(Date.now() - 86_400_000);
    const days = g?.last === yesterday ? g.days + 1 : 1;
    user.loginGift = { last: today, days };
    const coins = loginGiftFor(days);
    this.coins(s, user, coins);
    this.send(s, { t: 'loginGift', day: ((days - 1) % LOGIN_GIFTS.length) + 1, coins });
  }

  private likesMsg(roomId: string, userId: string) {
    const rec = this.store.getRoom(roomId);
    const likes = rec?.likes ?? [];
    return {
      t: 'roomLikes',
      roomId,
      likes: likes.length,
      liked: likes.includes(userId),
      canLike: !!rec && rec.ownerId !== userId,
    } as const;
  }

  private likeRoom(s: Session, user: UserRecord, on: boolean) {
    const room = s.room;
    const rec = room && this.store.getRoom(room.meta.id);
    if (!room || !rec || rec.ownerId === user.id) return;
    const likes = (rec.likes ?? []).filter((id) => id !== user.id);
    if (on) likes.push(user.id);
    rec.likes = likes;
    this.store.touch();
    for (const other of this.sessions)
      if (other.room === room && other.user) this.send(other, this.likesMsg(rec.id, other.user.id));
    const owner = this.byUser.get(rec.ownerId);
    if (on && owner && owner.room !== room)
      this.toast(owner, `👍 ${user.name} kan lide dit værelse ${rec.name}!`);
  }

  private giftSend(s: Session, user: UserRecord, msg: Extract<ClientMsg, { t: 'giftSend' }>) {
    const to = this.store.getUser(msg.to);
    if (!to || to.id === user.id) return;
    if (!user.friends.includes(to.id))
      return this.toast(s, 'Du kan kun give gaver til dine venner.', 'error');
    if (to.blocked?.includes(user.id)) return this.toast(s, 'Gaven kunne ikke sendes.', 'error');
    if ((to.gifts?.length ?? 0) >= 30)
      return this.toast(s, `${to.name} har for mange gaver, der ikke er pakket ud.`, 'error');
    let item: InvItem;
    let price = 0;
    if (msg.index !== undefined) {
      const inv = user.inventory ?? [];
      const e = inv[msg.index];
      if (!e || !canTrade(e.type)) return;
      inv.splice(msg.index, 1);
      item = e;
      this.sendInventory(s, user);
    } else if (msg.buy) {
      const def = furniture(msg.buy.type);
      if (def.noShop) return this.toast(s, 'Den kan ikke købes som gave.', 'error');
      if (user.coins < def.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
      item = { type: msg.buy.type };
      if (msg.buy.color && def.colors?.[msg.buy.color] !== undefined) item.color = msg.buy.color;
      price = def.price;
      user.stats.buys++;
      this.coins(s, user, -price);
    } else return;
    // Junior: no free text between children, so gifts come without a note.
    const note = this.cfg.junior ? '' : filterChat(sanitizeChat(msg.note)).slice(0, 60);
    const gift = {
      id: newId('gift'),
      fromId: user.id,
      fromName: user.name,
      item,
      note,
      at: new Date().toISOString(),
    };
    (to.gifts ??= []).push(gift);
    this.store.touch();
    this.store.logMarket({
      at: gift.at,
      listingId: `gift:${gift.id}`,
      sellerId: user.id,
      buyerId: to.id,
      item: item.type,
      price,
    });
    this.toast(s, `🎁 Gaven er pakket ind og sendt til ${to.name}!`);
    const ts = this.byUser.get(to.id);
    if (ts) this.send(ts, { t: 'gifts', gifts: to.gifts!, fresh: true });
  }

  private giftOpen(s: Session, user: UserRecord, id: string) {
    const i = user.gifts?.findIndex((g) => g.id === id) ?? -1;
    if (i < 0) return;
    const [g] = user.gifts!.splice(i, 1);
    (user.inventory ??= []).push(g!.item);
    this.store.touch();
    this.sendInventory(s, user);
    this.send(s, { t: 'gifts', gifts: user.gifts! });
    const def = furniture(g!.item.type);
    this.toast(
      s,
      `🎁 Du fik ${def.icon} ${def.name}${g!.item.serial ? ` #${g!.item.serial}` : ''} fra ${g!.fromName}! Den ligger i dit inventar.`,
    );
  }

  /* ---------------- limited editions ---------------- */

  private limitedViews(): LimitedView[] {
    return activeDrops(Date.now(), this.cfg.limitedDrops ?? LIMITED_DROPS).map((d) => ({
      type: d.type,
      total: d.total,
      sold: this.store.serialCount(d.type),
      to: Date.parse(d.to),
    }));
  }

  private broadcastLimited() {
    const msg = { t: 'limited', drops: this.limitedViews() } as const;
    for (const ss of this.byUser.values()) this.send(ss, msg);
  }

  /* ---------------- market ---------------- */

  private sendMarket(s: Session, user: UserRecord, q?: string) {
    const query = (q ?? '').trim().toLowerCase();
    const all = this.store.market();
    const listings = all
      .filter((l) => l.sellerId !== user.id)
      .filter(
        (l) =>
          !query ||
          furniture(l.item.type).name.toLowerCase().includes(query) ||
          l.sellerName.toLowerCase().includes(query),
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, 80);
    const mine = all.filter((l) => l.sellerId === user.id);
    this.send(s, { t: 'market', listings, mine });
  }

  /** Put an inventory item up for sale. It leaves your inventory until it sells or you cancel. */
  private marketSell(s: Session, user: UserRecord, index: number, price: number) {
    const inv = user.inventory ?? [];
    const entry = inv[index];
    if (!entry) return;
    if (!canTrade(entry.type)) return;
    if (price < 1 || price > MARKET_MAX_PRICE) return;
    if (this.store.market().filter((l) => l.sellerId === user.id).length >= MARKET_MAX_LISTINGS)
      return this.toast(s, `Du kan højst have ${MARKET_MAX_LISTINGS} ting til salg.`, 'error');
    if (this.trades.has(user.id)) return this.toast(s, 'Afslut din byttehandel først.', 'error');
    inv.splice(index, 1);
    this.store.market().push({
      id: newId('mk'),
      sellerId: user.id,
      sellerName: user.name,
      item: { ...entry },
      price,
      at: Date.now(),
    });
    this.store.touch();
    this.sendInventory(s, user);
    this.toast(s, `🏪 ${furniture(entry.type).name} er sat til salg for ${price} mønter`);
    this.sendMarket(s, user);
  }

  /**
   * Buying is one synchronous step (no awaits), so nothing can change in between: the listing is
   * removed, the coins move and the item lands in the buyer's inventory together. Every sale is logged.
   */
  private marketBuy(s: Session, user: UserRecord, id: string) {
    const market = this.store.market();
    const idx = market.findIndex((l) => l.id === id);
    const l = market[idx];
    if (!l) {
      this.toast(s, 'Den er allerede solgt 🙃');
      return this.sendMarket(s, user);
    }
    if (l.sellerId === user.id) return;
    if (user.coins < l.price) return this.toast(s, 'Du har ikke mønter nok.', 'error');
    const inv = (user.inventory ??= []);
    if (inv.length >= 200) return this.toast(s, 'Dit inventar er fyldt.', 'error');
    const seller = this.store.getUser(l.sellerId);
    market.splice(idx, 1);
    inv.push({ ...l.item });
    this.coins(s, user, -l.price);
    const earned = l.price - Math.floor(l.price * MARKET_FEE);
    if (seller) {
      seller.coins += earned;
      const ss = this.byUser.get(seller.id);
      if (ss) {
        this.send(ss, { t: 'coins', coins: seller.coins, reason: 'sold' });
        this.toast(ss, `🏪 ${user.name} købte din ${furniture(l.item.type).name} · +${earned} 🪙`);
      }
    }
    this.store.logMarket({
      at: new Date().toISOString(),
      listingId: l.id,
      sellerId: l.sellerId,
      buyerId: user.id,
      item: l.item.type,
      price: l.price,
    });
    this.store.touch();
    this.sendInventory(s, user);
    this.toast(s, `🏪 Du købte ${furniture(l.item.type).name} – den ligger i dit inventar`);
    this.sendMarket(s, user);
  }

  private marketCancel(s: Session, user: UserRecord, id: string) {
    const market = this.store.market();
    const idx = market.findIndex((l) => l.id === id && l.sellerId === user.id);
    const l = market[idx];
    if (!l) return;
    market.splice(idx, 1);
    (user.inventory ??= []).push({ ...l.item });
    this.store.touch();
    this.sendInventory(s, user);
    this.sendMarket(s, user);
  }

  /* ---------------- cinema ---------------- */

  private cinemas = new Map<
    string,
    {
      queue: (CinemaEntry & { paid: number })[];
      skips: Set<string>;
      current: (CinemaEntry & { startedAt: number; until: number }) | null;
    }
  >();

  private screen(room: RoomInstance, itemId: number) {
    return room.items.find((i) => i.id === itemId && i.type === 'laerred');
  }

  private cinemaState(room: RoomInstance, it: PlacedItem) {
    const key = `${room.meta.id}:${it.id}`;
    let st = this.cinemas.get(key);
    if (!st) {
      st = { queue: [], skips: new Set(), current: null };
      // A video that was playing before a restart keeps playing.
      if (it.video && it.videoAt && it.videoAt + CINEMA.slotMs > Date.now())
        st.current = {
          id: 'resume',
          video: it.video,
          title: 'YouTube-video',
          byId: '',
          byName: '',
          startedAt: it.videoAt,
          until: it.videoAt + CINEMA.slotMs,
        };
      this.cinemas.set(key, st);
    }
    return st;
  }

  private cinemaView(room: RoomInstance, it: PlacedItem, user: UserRecord): CinemaView {
    const st = this.cinemaState(room, it);
    const manage = this.canModerateRoom(user, room);
    const viewers = room.humans().length;
    return {
      itemId: it.id,
      now: st.current,
      queue: st.queue.map((e) => ({
        id: e.id,
        video: e.video,
        title: e.title,
        byId: e.byId,
        byName: e.byName,
      })),
      skips: st.skips.size,
      needed: Math.max(1, Math.ceil(viewers * CINEMA.skipShare)),
      canManage: manage,
      canAdd: !this.cfg.junior && (manage || room.meta.isPublic),
      price: room.meta.isPublic && !manage ? CINEMA.publicPrice : 0,
    };
  }

  private cinemaBroadcast(room: RoomInstance, it: PlacedItem) {
    for (const p of room.humans()) {
      const ps = this.byUser.get(p.id);
      const pu = this.store.getUser(p.id);
      if (ps && pu && ps.room === room)
        this.send(ps, { t: 'cinema', view: this.cinemaView(room, it, pu) });
    }
  }

  /** The video's title from YouTube; null if it doesn't exist or may not be embedded. */
  private async videoTitle(video: string): Promise<string | null> {
    if (this.cfg.videoTitles === false) return 'YouTube-video';
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video}`)}`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (r.status === 401 || r.status === 403 || r.status === 404 || r.status === 400) return null;
      if (!r.ok) return 'YouTube-video';
      const j = (await r.json()) as { title?: string };
      return sanitizeChat(j.title ?? 'YouTube-video').slice(0, 90) || 'YouTube-video';
    } catch {
      return 'YouTube-video';
    }
  }

  private async cinemaAdd(
    s: Session,
    user: UserRecord,
    room: RoomInstance,
    itemId: number,
    video: string,
  ) {
    if (this.cfg.junior) return this.toast(s, 'Biografen findes ikke i Lobbi Junior.', 'error');
    const it = this.screen(room, itemId);
    if (!it) return;
    const manage = this.canModerateRoom(user, room);
    if (!room.meta.isPublic && !manage)
      return this.toast(s, 'Kun ejeren og dem med rettigheder kan vælge video her 🎬', 'error');
    const st = this.cinemaState(room, it);
    if (st.queue.length >= CINEMA.queueMax)
      return this.toast(s, 'Køen er fuld – vent lidt 🍿', 'error');
    if (!manage && st.queue.some((e) => e.byId === user.id))
      return this.toast(s, 'Du har allerede en video i køen.', 'error');
    const price = room.meta.isPublic && !manage ? CINEMA.publicPrice : 0;
    if (user.coins < price)
      return this.toast(s, `Det koster ${price} 🪙 at vælge en video her.`, 'error');
    const title = await this.videoTitle(video);
    if (s.room !== room) return;
    if (title === null)
      return this.toast(
        s,
        'Den video findes ikke, eller den må ikke vises uden for YouTube.',
        'error',
      );
    if (price) this.coins(s, user, -price, 'cinema');
    const entry = { id: newId('v'), video, title, byId: user.id, byName: user.name, paid: price };
    if (!st.current) this.cinemaStart(room, it, entry);
    else {
      st.queue.push(entry);
      this.toast(s, `🎬 Sat i køen som nr. ${st.queue.length}`);
    }
    this.cinemaBroadcast(room, it);
  }

  private cinemaStart(room: RoomInstance, it: PlacedItem, entry: CinemaEntry | null) {
    const st = this.cinemaState(room, it);
    st.skips.clear();
    const now = Date.now();
    st.current = entry ? { ...entry, startedAt: now, until: now + CINEMA.slotMs } : null;
    if (entry) {
      it.video = entry.video;
      it.videoAt = now;
      it.state = 1;
      this.sys(room, `🎬 Nu på lærredet: "${entry.title}" – valgt af ${entry.byName}`);
    } else {
      delete it.video;
      delete it.videoAt;
      it.state = 0;
    }
    const saved = this.roomRecord(room)?.items.find((i) => i.id === it.id);
    if (saved && saved !== it)
      Object.assign(saved, { state: it.state, video: it.video, videoAt: it.videoAt });
    this.store.touch();
    room.broadcast({ t: 'itemPut', item: it });
  }

  private cinemaNext(room: RoomInstance, it: PlacedItem) {
    const st = this.cinemaState(room, it);
    const next = st.queue.shift() ?? null;
    this.cinemaStart(room, it, next);
    this.cinemaBroadcast(room, it);
  }

  private cinemaSkip(s: Session, user: UserRecord, room: RoomInstance, itemId: number) {
    const it = this.screen(room, itemId);
    if (!it) return;
    const st = this.cinemaState(room, it);
    if (!st.current) return;
    if (this.canModerateRoom(user, room) || st.current.byId === user.id)
      return this.cinemaNext(room, it);
    st.skips.add(user.id);
    const needed = Math.max(1, Math.ceil(room.humans().length * CINEMA.skipShare));
    if (st.skips.size >= needed) {
      this.sys(room, '⏭️ Flertallet ville springe videoen over.');
      return this.cinemaNext(room, it);
    }
    this.cinemaBroadcast(room, it);
  }

  private cinemaStop(s: Session, user: UserRecord, room: RoomInstance, itemId: number) {
    const it = this.screen(room, itemId);
    if (!it) return;
    if (!this.canModerateRoom(user, room))
      return this.toast(s, 'Kun ejeren kan stoppe videoen.', 'error');
    this.cinemaNext(room, it);
  }

  private cinemaRemove(
    s: Session,
    user: UserRecord,
    room: RoomInstance,
    itemId: number,
    id: string,
  ) {
    const it = this.screen(room, itemId);
    if (!it) return;
    const st = this.cinemaState(room, it);
    const e = st.queue.find((q) => q.id === id);
    if (!e) return;
    if (!this.canModerateRoom(user, room) && e.byId !== user.id) return;
    st.queue = st.queue.filter((q) => q !== e);
    // Money back for a video that never played.
    const owner = this.store.getUser(e.byId);
    const os = this.byUser.get(e.byId);
    if (e.paid && owner && os) this.coins(os, owner, e.paid, 'cinema-refund');
    else if (e.paid && owner) owner.coins += e.paid;
    this.cinemaBroadcast(room, it);
  }

  /** Called every second: a video that has had its time gives way to the next. */
  private cinemaTick(now: number) {
    for (const [key, st] of this.cinemas) {
      if (!st.current || now < st.current.until) continue;
      const [roomId, itemIdStr] = [
        key.slice(0, key.lastIndexOf(':')),
        key.slice(key.lastIndexOf(':') + 1),
      ];
      const room = this.rooms.get(roomId);
      const it = room && this.screen(room, Number(itemIdStr));
      if (!room || !it) {
        this.cinemas.delete(key);
        continue;
      }
      this.cinemaNext(room, it);
    }
  }

  /* ---------------- carrying things ---------------- */

  private setCarry(room: RoomInstance, p: PlayerState, item: CarryKind | null) {
    p.carry = item;
    p.carryUntil = item ? Date.now() + CARRY_MS : undefined;
    room.broadcast({ t: 'carry', id: p.id, item });
  }

  /** Walk to the counter / machine and take something; from far away we walk there first. */
  private dispense(
    s: Session,
    room: RoomInstance,
    p: PlayerState,
    itemId: number,
    kind: CarryKind,
  ) {
    const it = room.items.find((i) => i.id === itemId);
    if (!it || !furniture(it.type).dispense?.includes(kind)) return;
    const tiles = tilesOf(it);
    const near = () => {
      const [x, z] = room.tileOf(p);
      return tiles.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - z)) <= 1);
    };
    const give = () => {
      this.setCarry(room, p, kind);
      this.toast(s, `${CARRY[kind].icon} Værsgo – ${CARRY[kind].name.toLowerCase()}!`);
    };
    if (near()) return give();
    let walking = false;
    for (const [x, z] of tiles) {
      const goal = this.freeNeighbour(room, x, z);
      if (goal && room.walk(p, goal)) {
        walking = true;
        break;
      }
    }
    if (!walking || !p.path.length) return this.toast(s, 'Kan ikke komme derhen 🙈', 'error');
    const ticket = (s.doorTicket = (s.doorTicket ?? 0) + 1);
    const ms = (p.path.length / WALK_SPEED) * 1000 + 250;
    setTimeout(() => {
      if (s.room === room && s.player === p && s.doorTicket === ticket && near()) give();
    }, ms);
  }

  /* ---------------- actions, emotes, notes ---------------- */

  private doAction(s: Session, user: UserRecord, kind: ActionKind | null) {
    const room = s.room;
    const player = s.player;
    if (!room || !player) return;
    // Sleeping or sitting on the floor makes no sense on a chair.
    if (kind && (kind === 'sitfloor' || kind === 'sleep') && player.seatId !== null)
      return this.toast(s, 'Rejs dig først 🙂');
    if (kind && (kind === 'sitfloor' || kind === 'sleep') && player.path.length)
      room.walk(player, room.tileOf(player));
    player.action = kind;
    player.actionUntil = Date.now() + ACTION_MS;
    room.broadcast({ t: 'action', id: player.id, kind });
    if (kind === 'wave' && room.players.size > 1) this.daily(s, user, 'd_wave');
    if (kind === 'sleep') this.emote(room, player, 'sleep');
    if (kind === 'hug') this.emote(room, player, 'heart');
  }

  private emote(room: RoomInstance, p: PlayerState, kind: EmoteKind) {
    room.broadcast({ t: 'emote', id: p.id, kind });
  }

  private relationLists(u: UserRecord) {
    const rel = u.relations ?? {};
    return (['heart', 'smile', 'skull'] as RelationKind[])
      .map((kind) => ({
        kind,
        users: Object.entries(rel)
          .filter(([id, k]) => k === kind && u.friends.includes(id))
          .map(([id]) => this.store.getUser(id))
          .filter((x): x is UserRecord => !!x)
          .slice(0, 12)
          .map((x) => ({ id: x.id, name: x.name })),
      }))
      .filter((r) => r.users.length);
  }

  private canModerateRoom(user: UserRecord, room: RoomInstance) {
    const rec = this.roomRecord(room);
    return (
      user.role !== 'user' || (!!rec && (rec.ownerId === user.id || rec.rights.includes(user.id)))
    );
  }

  private sendNotes(s: Session, user: UserRecord, room: RoomInstance) {
    const rec = this.roomRecord(room);
    const mod = this.canModerateRoom(user, room);
    const notes = (rec?.notes ?? []).filter((n) => n.approved || mod || n.fromId === user.id);
    this.send(s, { t: 'notes', notes, canModerate: mod });
  }

  private refreshNotes(room: RoomInstance) {
    for (const p of room.humans()) {
      const ps = this.byUser.get(p.id);
      const pu = this.store.getUser(p.id);
      if (ps && pu && ps.room === room) this.sendNotes(ps, pu, room);
    }
  }

  private noteWrite(s: Session, user: UserRecord, room: RoomInstance, raw: string, color: number) {
    const rec = this.roomRecord(room);
    if (!rec || !room.items.some((i) => i.type === 'noteboard'))
      return this.toast(s, 'Der er ingen opslagstavle her.', 'error');
    if (user.mutedUntil && user.mutedUntil > Date.now())
      return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
    const text = filterChat(sanitizeChat(raw)).slice(0, 100);
    if (!text) return;
    const notes = (rec.notes ??= []);
    if (notes.filter((n) => n.fromId === user.id && !n.approved).length >= 3)
      return this.toast(s, 'Du har allerede 3 sedler, der venter på godkendelse.', 'error');
    const mod = this.canModerateRoom(user, room);
    const note: RoomNote = {
      id: newId('n'),
      fromId: user.id,
      fromName: user.name,
      text,
      color,
      at: Date.now(),
      approved: mod,
    };
    notes.unshift(note);
    // Keep the newest; drop the oldest approved ones first.
    while (notes.length > NOTES_PER_ROOM) notes.splice(notes.length - 1, 1);
    this.store.touch();
    this.toast(s, mod ? '📌 Sedlen er sat op' : '📌 Sedlen venter på, at ejeren godkender den');
    if (!mod) {
      const os = this.byUser.get(rec.ownerId);
      if (os && os !== s) this.toast(os, `📌 ${user.name} har sat en seddel op i ${rec.name}`);
    }
    this.refreshNotes(room);
  }

  private noteModerate(
    s: Session,
    user: UserRecord,
    room: RoomInstance,
    id: string,
    approve: boolean,
  ) {
    const rec = this.roomRecord(room);
    const note = rec?.notes?.find((n) => n.id === id);
    if (!rec || !note) return;
    const mod = this.canModerateRoom(user, room);
    if (!mod && !(note.fromId === user.id && !approve))
      return this.toast(s, 'Kun ejeren kan godkende sedler.', 'error');
    if (approve) note.approved = true;
    else rec.notes = rec.notes!.filter((n) => n !== note);
    this.store.touch();
    this.refreshNotes(room);
  }

  /* ---------------- guestbook ---------------- */

  private guestbookWrite(s: Session, user: UserRecord, targetId: string, raw: string) {
    const target = this.store.getUser(targetId);
    if (!target) return;
    if (target.blocked.includes(user.id)) return this.toast(s, 'Du kan ikke skrive her.', 'error');
    if (user.mutedUntil && user.mutedUntil > Date.now())
      return this.toast(s, 'Du er sat på pause i chatten et stykke tid.', 'error');
    const text = filterChat(sanitizeChat(raw)).slice(0, 200);
    if (!text) return;
    const book = (target.guestbook ??= []);
    book.unshift({ id: newId('gb'), fromId: user.id, fromName: user.name, text, at: Date.now() });
    if (book.length > 50) book.length = 50;
    this.store.touch();
    // Logged like chat, so moderators can see it in reports.
    this.store.logChat({
      at: Date.now(),
      roomId: `gb:${target.id}`,
      userId: user.id,
      name: user.name,
      text,
    });
    const ts = this.byUser.get(target.id);
    if (ts && ts !== s) this.toast(ts, `📖 ${user.name} skrev i din gæstebog`);
    this.profile(s, user, target.id);
  }

  private guestbookDelete(s: Session, user: UserRecord, targetId: string, id: string) {
    const target = this.store.getUser(targetId);
    if (!target) return;
    const entry = (target.guestbook ?? []).find((e) => e.id === id);
    if (!entry) return;
    // The owner, the writer and moderators may delete an entry.
    if (target.id !== user.id && entry.fromId !== user.id && user.role === 'user') return;
    target.guestbook = (target.guestbook ?? []).filter((e) => e.id !== id);
    this.store.touch();
    this.profile(s, user, target.id);
  }

  /* ---------------- teleporters ---------------- */

  /** Where the twin of a teleporter stands (any room), if it is placed. */
  private findTwin(pair: string, notId: number, roomId: string) {
    for (const rec of this.store.listRooms()) {
      const it = rec.items.find((i) => i.pair === pair && !(rec.id === roomId && i.id === notId));
      if (it) return { rec, it };
    }
    return null;
  }

  private teleport(s: Session, user: UserRecord, itemId: number) {
    const room = s.room;
    const player = s.player;
    if (!room || !player) return;
    const it = room.items.find((i) => i.id === itemId);
    if (!it || it.type !== 'teleport' || !it.pair) return;
    const here = room.tileOf(player);
    const near = Math.max(Math.abs(here[0] - it.x), Math.abs(here[1] - it.z)) <= 1;
    if (!near) {
      // Walk up to it first, then step in.
      const n = this.freeNeighbour(room, it.x, it.z);
      if (!n || !room.walk(player, n))
        return this.toast(s, 'Du kan ikke komme hen til teleporteren.');
      const ms = (player.path.length / WALK_SPEED) * 1000 + 250;
      setTimeout(() => {
        if (s.room === room && s.player === player) this.teleport(s, user, itemId);
      }, ms);
      return;
    }
    const twin = this.findTwin(it.pair, it.id, room.meta.id);
    if (!twin) return this.toast(s, '🌀 Den anden teleporter er ikke stillet op endnu.');
    const target = this.loadRoom(twin.rec.id);
    if (!target) return;
    const mine = twin.rec.ownerId === user.id || twin.rec.rights.includes(user.id);
    if (!mine && user.role === 'user' && twin.rec.access !== 'open')
      return this.toast(s, '🔒 Teleporteren fører til et låst rum.');
    if (!mine && user.role === 'user' && target !== room && target.humans().length >= ROOM_CAPACITY)
      return this.toast(s, `${target.meta.name} er fyldt lige nu.`);
    room.broadcast({ t: 'action', id: player.id, kind: 'wave' });
    setTimeout(() => {
      if (s.room !== room) return;
      const spot = this.freeNeighbour(target, twin.it.x, twin.it.z) ?? undefined;
      if (target === room && spot) {
        // Same room: just appear at the other booth.
        room.remove(player.id);
        room.add(player, spot);
        this.send(s, { t: 'room', room: room.roomView(user.id), serverTime: Date.now() });
      } else this.join(s, target.meta.id, undefined, spot);
      this.toast(s, `🌀 Teleporteret til ${target.meta.name}`);
    }, 600);
  }

  /** A walkable tile next to (x, z), preferring the front. */
  private freeNeighbour(room: RoomInstance, x: number, z: number): [number, number] | null {
    const grid = buildGrid(room.floor(), room.items);
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (isFree(grid, nx, nz) && canStep(grid, x, z, nx, nz)) return [nx, nz];
    }
    return null;
  }

  private stash(s: Session, user: UserRecord, id: number) {
    const own = this.ownRoom(s, user);
    if (!own || own.rec.ownerId !== user.id)
      return this.toast(s, 'Kun ejeren kan gemme møbler væk.', 'error');
    const idx = own.rec.items.findIndex((i) => i.id === id);
    const it = own.rec.items[idx];
    if (!it || !canTrade(it.type)) return;
    if ((user.inventory ??= []).length >= 200)
      return this.toast(s, 'Dit inventar er fyldt.', 'error');
    own.rec.items.splice(idx, 1);
    own.room.standUpFrom(id);
    user.inventory.push(this.invOf(it));
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
    if (entry.pair) item.pair = entry.pair;
    if (entry.serial) item.serial = entry.serial;
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
    if (other.blocked.includes(user.id) || user.blocked.includes(other.id) || other.staff)
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

  /* ---------------- golden chests ---------------- */

  private chest: { roomId: string; view: ChestView } | null = null;
  private chestSeq = 1;
  /** Players walking towards the chest: they open it when they get there. */
  private chestWalkers = new Map<string, number>();

  /** Hides a chest on a free tile in a busy public room (or `inRoom`). */
  private spawnChest(inRoom?: RoomInstance): boolean {
    if (this.chest) return false;
    const publicIds = new Set(PUBLIC_ROOMS.map((r) => r.id));
    const candidates = inRoom
      ? [inRoom].filter((r) => publicIds.has(r.meta.id))
      : [...this.rooms.values()].filter((r) => publicIds.has(r.meta.id) && r.humans().length > 0);
    if (!candidates.length) return false;
    const room = candidates[Math.floor(Math.random() * candidates.length)]!;
    const grid = buildGrid(room.floor(), room.items);
    const taken = new Set(room.occupiedTiles().map((t) => t.join()));
    const free: [number, number][] = [];
    for (let x = 1; x < grid.cells.length - 1; x++)
      for (let z = 1; z < (grid.cells[x]?.length ?? 0) - 1; z++)
        if (
          isFree(grid, x, z) &&
          !taken.has(`${x},${z}`) &&
          !(x === DOOR_TILE[0] && z === DOOR_TILE[1])
        )
          free.push([x, z]);
    if (!free.length) return false;
    const [x, z] = free[Math.floor(Math.random() * free.length)]!;
    const view: ChestView = { id: this.chestSeq++, x, z, until: Date.now() + CHEST.lifetimeMs };
    this.chest = { roomId: room.meta.id, view };
    room.broadcast({ t: 'chest', chest: view });
    this.sys(room, '✨ Noget glimter i rummet … Hvem finder guldkisten først?');
    return true;
  }

  private clearChest(text?: string) {
    if (!this.chest) return;
    const room = this.rooms.get(this.chest.roomId);
    this.chest = null;
    this.chestWalkers.clear();
    if (!room) return;
    room.broadcast({ t: 'chest', chest: null });
    if (text) this.sys(room, text);
  }

  private chestOpen(s: Session, user: UserRecord, id: number) {
    const c = this.chest;
    const room = s.room;
    const p = s.player;
    if (!c || c.view.id !== id || !room || !p || room.meta.id !== c.roomId) return;
    const [tx, tz] = room.tileOf(p);
    if (Math.max(Math.abs(tx - c.view.x), Math.abs(tz - c.view.z)) > 1) {
      // Too far away: walk there first, then open it on arrival.
      if (room.walk(p, [c.view.x, c.view.z], true)) this.chestWalkers.set(user.id, id);
      return;
    }
    const type = pickLoot();
    const serial = this.store.nextSerial(type);
    (user.inventory ??= []).push({ type, serial });
    this.store.touch();
    this.sendInventory(s, user);
    const def = furniture(type);
    this.toast(
      s,
      `🎉 Du fandt ${def.icon} ${def.name} nr. ${serialLabel(serial)} i guldkisten! Den ligger i dit inventar.`,
    );
    this.clearChest(`🎉 ${user.name} fandt guldkisten og fik ${def.icon} ${def.name}!`);
  }

  /** Once a second: chests appear now and then, vanish after a while, and walkers arrive. */
  private chestTick(now: number) {
    if (this.chest) {
      if (now > this.chest.view.until)
        return this.clearChest('Guldkisten forsvandt igen … måske næste gang ✨');
      for (const [userId, id] of this.chestWalkers) {
        const ps = this.byUser.get(userId);
        const u = ps && this.store.getUser(userId);
        if (!ps || !u || ps.room?.meta.id !== this.chest.roomId) {
          this.chestWalkers.delete(userId);
          continue;
        }
        const [tx, tz] = ps.room.tileOf(ps.player!, now);
        if (Math.max(Math.abs(tx - this.chest.view.x), Math.abs(tz - this.chest.view.z)) <= 1)
          return this.chestOpen(ps, u, id);
      }
      return;
    }
    // On average once every `meanMinutes` (checked every second).
    if (this.cfg.chests !== false && Math.random() < 1 / (CHEST.meanMinutes * 60))
      this.spawnChest();
  }

  /** The player deletes their own account: rooms, listings, friends and all. Can't be undone. */
  private deleteAccount(s: Session, user: UserRecord, confirm: string) {
    if (confirm.trim().toLowerCase() !== user.name.toLowerCase())
      return this.toast(s, 'Skriv dit navn præcis, som det står, for at slette kontoen.', 'error');
    this.endTrade(user.id, `${user.name} har forladt Lobbi.`);
    this.leaveRoom(s);
    // Everyone in one of my rooms goes to the lobby before the rooms disappear.
    const mine = this.store.listRooms().filter((r) => r.ownerId === user.id);
    for (const r of mine) {
      const inst = this.rooms.get(r.id);
      if (!inst) continue;
      for (const other of this.sessions) if (other.room === inst) this.join(other, 'lobby');
      this.rooms.delete(r.id);
    }
    const market = this.store.market();
    for (let i = market.length - 1; i >= 0; i--)
      if (market[i]!.sellerId === user.id) market.splice(i, 1);
    const friends = [...user.friends];
    this.store.deleteUser(user.id);
    this.store.flush();
    for (const id of friends) {
      const f = this.store.getUser(id);
      if (f) this.sendFriends(f);
    }
    s.conn.close(4009, 'account deleted');
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
    if (msg.category) rec.category = msg.category as RoomCategory;
    Object.assign(room.meta, {
      name: rec.name,
      description: rec.description,
      access: rec.access,
      category: rec.category ?? 'andet',
    });
    this.store.touch();
    room.broadcast({
      t: 'roomMeta',
      name: rec.name,
      description: rec.description,
      access: rec.access,
      category: rec.category ?? 'andet',
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
          // "Må ikke følges": friends see that you're online, but not where.
          roomId: f.noFollow ? null : (fs?.room?.meta.id ?? null),
          roomName: f.noFollow ? null : (fs?.room?.meta.name ?? null),
          unread: this.unread(user, f.id),
        };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'da'));
  }

  /** Lobbi Junior: what children may send. Everything is checked here, not in the client. */
  private juniorAllows(
    s: Session,
    msg: Exclude<ClientMsg, { t: 'auth' } | { t: 'ping' }>,
  ): boolean {
    const no = (text = 'Det kan man ikke i Lobbi Junior.') => {
      this.toast(s, text, 'error');
      return false;
    };
    switch (msg.t) {
      case 'chat': {
        const text = msg.text.trim();
        // ":vink", ":dans" … and game commands like "/terning" are fine – they never show free text.
        if (/^:[\p{L}-]+$/u.test(text) || /^\/[a-zæøå]+$/u.test(text)) return true;
        return isJuniorPhrase(text) || no('Vælg en sætning fra chat-menuen 💬');
      }
      case 'whisper':
      case 'hush':
        return no('Hvisken findes ikke i Lobbi Junior.');
      case 'motto':
      case 'guestbookWrite':
      case 'noteWrite':
      case 'petRename':
        return no('Man kan ikke skrive egen tekst i Lobbi Junior.');
      case 'cinemaAdd':
        return no('Biografen findes ikke i Lobbi Junior.');
      case 'friendRequest':
      case 'giftSend':
      case 'tradeStart':
        if (s.user?.staff) return no('Lobbi-vagten kan ikke blive venner, give gaver eller bytte.');
        return true;
      case 'roomSettings':
        if (msg.name !== undefined || msg.description !== undefined)
          return no('Værelsets navn kan ikke ændres i Lobbi Junior.');
        return true;
      default:
        return true;
    }
  }

  private friendCodeOf(user: UserRecord) {
    if (!user.friendCode) {
      let c = newFriendCode();
      while (this.store.getUserByFriendCode(c)) c = newFriendCode();
      user.friendCode = c;
      this.store.touch();
    }
    return user.friendCode;
  }

  private sendFriends(user: UserRecord) {
    const s = this.byUser.get(user.id);
    if (!s) return;
    const requests = user.requests
      .map((id) => this.store.getUser(id))
      .filter((u): u is UserRecord => !!u)
      .map((u) => ({ id: u.id, name: u.name }));
    this.send(s, {
      t: 'friends',
      friends: this.friendViews(user),
      requests,
      code: this.friendCodeOf(user),
      invited: user.invited ?? 0,
    });
  }

  /** Someone joined through `byId`'s invite link: they are friends now, so refresh the list. */
  referred(byId: string) {
    const by = this.store.getUser(byId);
    if (by) this.sendFriends(by);
  }

  /** At level 2, a player who came through an invite link earns coins for both. */
  private payReferral(s: Session, u: UserRecord) {
    if (!u.referredBy || u.referralPaid) return;
    u.referralPaid = true;
    this.coins(s, u, INVITE_REWARD);
    this.toast(s, `🔗 +${INVITE_REWARD} mønter, fordi du kom med på en invitation!`);
    const by = this.store.getUser(u.referredBy);
    if (by && (by.invited ?? 0) < INVITE_REWARD_MAX) {
      by.invited = (by.invited ?? 0) + 1;
      const bs = this.byUser.get(by.id);
      if (bs) {
        this.coins(bs, by, INVITE_REWARD);
        this.toast(bs, `🔗 ${u.name} er nået level 2 – I får begge ${INVITE_REWARD} mønter!`);
        this.sendFriends(by);
      } else by.coins += INVITE_REWARD;
    }
    this.store.touch();
  }

  private notifyFriendsOf(user: UserRecord) {
    for (const id of user.friends) {
      const f = this.store.getUser(id);
      if (f) this.sendFriends(f);
    }
  }

  private friendRequest(s: Session, user: UserRecord, name: string) {
    // Junior: you can only add someone who gave you their friend code.
    const target = this.cfg.junior
      ? isFriendCode(name)
        ? this.store.getUserByFriendCode(name)
        : undefined
      : this.store.getUserByName(name.trim());
    if (!target || target.id === user.id)
      return this.toast(
        s,
        this.cfg.junior
          ? 'Den vennekode findes ikke. Tjek bogstaverne 🔎'
          : 'Fandt ingen gæst med det navn.',
        'error',
      );
    if (target.staff) return this.toast(s, 'Lobbi-vagten kan ikke blive din ven 🛡️', 'error');
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

  private pmRoom(a: string, b: string) {
    return `pm:${[a, b].sort().join(':')}`;
  }

  private unread(user: UserRecord, friendId: string) {
    const since = user.pmRead?.[friendId] ?? 0;
    return this.store
      .recentChat(this.pmRoom(user.id, friendId), 50)
      .filter((c) => c.userId === friendId && c.at > since).length;
  }

  /** Messenger: private message to a friend anywhere in the hotel. Waits if they are offline. */
  private whisper(s: Session, user: UserRecord, to: string, raw: string) {
    const target = this.store.getUser(to);
    if (!target || !user.friends.includes(to))
      return this.toast(s, 'Du kan kun skrive i messengeren med venner.', 'error');
    const text = filterChat(sanitizeChat(raw));
    if (!text) return;
    const at = Date.now();
    this.store.logChat({
      at,
      roomId: this.pmRoom(user.id, to),
      userId: user.id,
      name: user.name,
      text,
    });
    (user.pmRead ??= {})[to] = at;
    const msg: ServerMsg = { t: 'whisper', from: user.id, fromName: user.name, to, text, at };
    this.send(s, msg);
    const ts = this.byUser.get(to);
    if (ts && !target.blocked.includes(user.id)) {
      this.send(ts, msg);
      this.sendFriends(target);
    }
  }

  private pmHistory(s: Session, user: UserRecord, withId: string) {
    if (!user.friends.includes(withId)) return;
    const msgs = this.store
      .recentChat(this.pmRoom(user.id, withId), 50)
      .map((c) => ({ from: c.userId, text: c.text, at: c.at }));
    (user.pmRead ??= {})[withId] = Date.now();
    this.store.touch();
    this.send(s, { t: 'pmHistory', with: withId, msgs });
    this.sendFriends(user);
  }

  /** Whisper to someone in the same room: only the two of you see it. */
  private hush(s: Session, user: UserRecord, to: string, raw: string) {
    const room = s.room;
    const ts = this.byUser.get(to);
    const target = this.store.getUser(to);
    if (!room || !ts || !target || ts.room !== room)
      return this.toast(s, 'Du kan kun hviske til nogen i samme rum.', 'error');
    if (to === user.id) return;
    const text = filterChat(sanitizeChat(raw));
    if (!text) return;
    const msg: ServerMsg = {
      t: 'hush',
      from: user.id,
      fromName: user.name,
      to,
      toName: target.name,
      text,
    };
    this.send(s, msg);
    if (!target.blocked.includes(user.id)) this.send(ts, msg);
    // Logged separately so AI residents never see whispers, but moderators do.
    this.store.logChat({
      at: Date.now(),
      roomId: `hush:${room.meta.id}`,
      userId: user.id,
      name: user.name,
      text: `(hvisker til ${target.name}) ${text}`,
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
      context: roomId
        ? [...this.store.recentChat(roomId, 20), ...this.store.recentChat(`hush:${roomId}`, 10)]
            .sort((a, b) => a.at - b.at)
            .slice(-24)
        : [],
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
          motto: 'AI-beboer på Lobbi 🤖',
          badges: [],
          since: '',
          bot: true,
          friend: false,
          blocked: false,
        },
      });
    }
    if (!target) return;
    const ts = this.byUser.get(target.id);
    const friends = target.friends
      .map((id) => this.store.getUser(id))
      .filter((u): u is UserRecord => !!u)
      .slice(0, 12)
      .map((u) => ({ id: u.id, name: u.name }));
    const rooms = this.store
      .listRooms()
      .filter((r) => r.ownerId === target.id && (r.access === 'open' || target.id === user.id))
      .slice(0, 10)
      .map((r) => ({ id: r.id, name: r.name, users: this.rooms.get(r.id)?.humans().length ?? 0 }));
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
        here: !!s.room && s.room.players.has(target.id),
        online: !!ts,
        level: levelOf(target).level,
        friends,
        friendCount: target.friends.length,
        rooms,
        pet: this.activePetView(target),
        guestbook: (target.guestbook ?? []).slice(0, 20),
        relations: this.relationLists(target),
      },
    });
  }

  /* ---------------- timers ---------------- */

  private tick() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      room.tick(now);
      this.bots.tick(room, now);
      if (room.game) this.gameTick(room, now);
    }
  }

  private everySecond() {
    this.expireQuizzes();
    this.checkEvents();
    this.chestTick(Date.now());
    // Save where everyone stands every few seconds, so even a hard restart (deploy, crash)
    // puts people back on their own tile instead of at the door.
    // Things in the hand don't last forever.
    const now = Date.now();
    this.cinemaTick(now);
    for (const room of this.rooms.values())
      for (const p of room.players.values())
        if (p.carry && p.carryUntil && p.carryUntil < now) this.setCarry(room, p, null);
    if (++this.spotTick % 5 === 0 && this.sessions.size) {
      for (const s of this.sessions) this.rememberSpot(s);
      this.store.touch();
    }
    for (const s of this.byUser.values()) {
      const u = s.user!;
      u.onlineSec++;
      if (u.onlineSec % 60 === 0) {
        this.markActive(u);
        this.coins(s, u, COINS_PER_ONLINE_MINUTE, 'online');
        this.send(s, { t: 'online', onlineSec: u.onlineSec });
        this.daily(s, u, 'd_online');
        this.eventMinute(s, u);
        this.checkLevel(s, u);
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

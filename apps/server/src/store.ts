import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  RelationKind,
  RoomNote,
  BadgeId,
  DailyId,
  Look,
  PlacedItem,
  PetKind,
  GuestbookEntry,
  MarketListing,
  RoomShape,
  RoomCategory,
  TileHeights,
  QuestId,
  RoomAccess,
  RoomTheme,
} from '@hutel/shared';

export interface UserRecord {
  id: string;
  name: string;
  nameLower: string;
  tokenHash: string;
  /** scrypt$salt$hash – absent for very old dev accounts. */
  passwordHash?: string;
  /** Id from the external login provider (Supabase Auth: e-mail, Google, Facebook). */
  authId?: string;
  look: Look;
  coins: number;
  onlineSec: number;
  quests: QuestId[];
  badges: BadgeId[];
  homeRoomId: string;
  motto: string;
  friends: string[];
  /** Room ids on my favourites list. */
  favorites?: string[];
  pets?: PetRecord[];
  activePet?: string | null;
  /** Owned wallpapers and floors ("wall:mint"). */
  decor?: string[];
  /** Messenger: friend id → timestamp of the last message read. */
  pmRead?: Record<string, number>;
  requests: string[];
  blocked: string[];
  stats: { chats: number; buys: number; moves: number };
  /** Room the user was last in (to come back after a reconnect or update). */
  /** Where you were when you left (back there after a reconnect or a deploy). */
  lastRoom?: { id: string; at: number; tile?: [number, number] };
  /** Clothes bought in the shop. */
  wardrobe?: string[];
  /** Extra apartment rooms: kind → room id. */
  apartment?: Record<string, string>;
  /** Minutes at the current event (key: date:eventId). */
  eventMins?: { key: string; mins: number };
  /** Furniture not placed in a room. */
  inventory?: { type: PlacedItem['type']; color?: number; pair?: string }[];
  guestbook?: GuestbookEntry[];
  /** Today's daily quests (rolls over at Danish midnight). */
  daily?: {
    date: string;
    progress: Partial<Record<DailyId, number>>;
    done: DailyId[];
    streak: number;
    lastFull?: string;
    /** Coins won in mini games today (capped). */
    gameCoins?: number;
  };
  role: 'user' | 'moderator' | 'admin';
  bannedUntil: number | null;
  /** Badge shown by the name: null = hidden, undefined = newest. */
  showBadge?: string | null;
  /** Chat bubble style id. */
  bubble?: string;
  /** Saved outfits (OUTFIT_SLOTS slots). */
  outfits?: (Look | null)[];
  /** Glow / shadow / aura around the figure. */
  effect?: string;
  /** Friends may not follow me into rooms. */
  noFollow?: boolean;
  /** friend id → ❤️ / 😊 / 💀 */
  relations?: Record<string, RelationKind>;
  /** Can't chat until this time. */
  mutedUntil?: number | null;
  createdAt: string;
  lastSeen: string;
}

export interface PetRecord {
  id: string;
  kind: PetKind;
  name: string;
  color: number;
  xp: number;
  lastFed: number;
  /** Trick XP earned today (capped) and the Danish date it counts for. */
  trickXp: number;
  trickDate: string;
  lastTrick: number;
}

export interface RoomRecord {
  /** Post-its on the room's notice board. */
  notes?: RoomNote[];
  id: string;
  ownerId: string;
  name: string;
  description: string;
  access: RoomAccess;
  passwordHash: string | null;
  rights: string[];
  items: PlacedItem[];
  nextItemId: number;
  createdAt: string;
  /** Look of the room; home rooms default to 'home'. */
  theme?: RoomTheme;
  wall?: string | null;
  floor?: string | null;
  size?: number;
  shape?: RoomShape;
  category?: RoomCategory;
  /** Raised tiles: "x,z" → steps. */
  heights?: TileHeights;
  paidSize?: number;
}

export interface ReportRecord {
  id: string;
  fromId: string;
  targetId: string;
  reason: string;
  roomId: string | null;
  context: ChatLogRecord[];
  createdAt: string;
  status: 'open' | 'closed';
}

export interface ChatLogRecord {
  at: number;
  roomId: string;
  userId: string;
  name: string;
  text: string;
}

export interface AdminLogRecord {
  at: string;
  by: string;
  action: string;
  target?: string;
  detail?: string;
}

export interface MarketLogRecord {
  at: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  item: string;
  price: number;
}

export interface TradeRecord {
  at: string;
  a: string;
  b: string;
  /** What each side gave. */
  gave: Record<string, { coins: number; items: string[]; clothes: string[] }>;
}

interface Data {
  version: 1;
  users: Record<string, UserRecord>;
  rooms: Record<string, RoomRecord>;
  reports: ReportRecord[];
  chatlog: ChatLogRecord[];
  trades?: TradeRecord[];
  adminLog?: AdminLogRecord[];
  market?: MarketListing[];
  marketLog?: MarketLogRecord[];
}

/**
 * Persistence boundary. The dev implementation keeps everything in one JSON file.
 * In production this is replaced by a Supabase-backed implementation with the same methods.
 */
export interface Store {
  getUser(id: string): UserRecord | undefined;
  getUserByName(name: string): UserRecord | undefined;
  getUserByToken(token: string): UserRecord | undefined;
  getUserByAuthId(authId: string): UserRecord | undefined;
  createUser(
    name: string,
    look: Look,
    auth: { password: string } | { authId: string },
  ): { user: UserRecord; token: string };
  /** Issues a new session token (old ones stop working). */
  rotateToken(user: UserRecord): string;
  /** Wipes progress (coins, quests, badges, stats, home room) but keeps the account and name. */
  resetProgress(user: UserRecord): void;
  getRoom(id: string): RoomRecord | undefined;
  /** Creates an extra room owned by a user. */
  createRoom(
    ownerId: string,
    name: string,
    theme: RoomTheme,
    items: Omit<PlacedItem, 'id'>[],
  ): RoomRecord;
  deleteRoom(id: string): void;
  listRooms(): RoomRecord[];
  addReport(r: Omit<ReportRecord, 'id' | 'createdAt' | 'status'>): void;
  logChat(entry: ChatLogRecord): void;
  /** Every completed trade is logged (for support and fraud checks). */
  logTrade(entry: TradeRecord): void;
  listReports(): ReportRecord[];
  /** Open market listings (the items are held here, out of the seller's inventory). */
  market(): MarketListing[];
  /** Every market sale is logged. */
  logMarket(entry: MarketLogRecord): void;
  /** Every moderator action is logged. */
  logAdmin(entry: AdminLogRecord): void;
  recentChat(roomId: string, limit: number): ChatLogRecord[];
  /** Call after mutating a record returned by the store. */
  touch(): void;
  flush(): void;
}

export const hashSecret = (s: string) => createHash('sha256').update(s).digest('hex');
export const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, salt, a.length);
  return a.length === b.length && timingSafeEqual(a, b);
}
const CHAT_RETENTION_MS = 30 * 24 * 3600 * 1000;
const CHAT_MAX_ENTRIES = 20_000;

export class JsonFileStore implements Store {
  private data: Data;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string | null,
    private readonly newRoomItems: () => PlacedItem[],
  ) {
    this.data = { version: 1, users: {}, rooms: {}, reports: [], chatlog: [] };
    if (file && existsSync(file)) this.data = JSON.parse(readFileSync(file, 'utf8')) as Data;
    this.pruneChat();
  }

  getUser(id: string) {
    return this.data.users[id];
  }
  getUserByName(name: string) {
    const lower = name.toLowerCase();
    return Object.values(this.data.users).find((u) => u.nameLower === lower);
  }
  getUserByAuthId(authId: string) {
    return Object.values(this.data.users).find((u) => u.authId === authId);
  }
  getUserByToken(token: string) {
    const h = hashSecret(token);
    return Object.values(this.data.users).find((u) => u.tokenHash === h);
  }

  resetProgress(user: UserRecord) {
    user.coins = 30;
    user.onlineSec = 0;
    user.quests = [];
    user.badges = ['welcome'];
    user.motto = '';
    user.stats = { chats: 0, buys: 0, moves: 0 };
    user.daily = undefined;
    user.wardrobe = [];
    user.inventory = [];
    user.pets = [];
    user.activePet = null;
    for (const id of Object.values(user.apartment ?? {})) delete this.data.rooms[id];
    user.apartment = {};
    user.look = { ...user.look, top: undefined, hat: undefined };
    const room = this.data.rooms[user.homeRoomId];
    if (room) {
      room.items = this.newRoomItems();
      room.nextItemId = room.items.length + 1;
      room.access = 'open';
      room.passwordHash = null;
      room.rights = [];
      room.description = '';
    }
    this.touch();
  }

  rotateToken(user: UserRecord) {
    const token = randomBytes(32).toString('hex');
    user.tokenHash = hashSecret(token);
    this.touch();
    return token;
  }

  createUser(name: string, look: Look, auth: { password: string } | { authId: string }) {
    const token = randomBytes(32).toString('hex');
    const id = newId('u');
    const roomId = newId('r');
    const now = new Date().toISOString();
    const items = this.newRoomItems();
    this.data.rooms[roomId] = {
      id: roomId,
      ownerId: id,
      name: `${name}s værelse`,
      description: '',
      access: 'open',
      passwordHash: null,
      rights: [],
      items,
      nextItemId: items.length + 1,
      createdAt: now,
    };
    const user: UserRecord = {
      id,
      name,
      nameLower: name.toLowerCase(),
      tokenHash: hashSecret(token),
      ...('password' in auth
        ? { passwordHash: hashPassword(auth.password) }
        : { authId: auth.authId }),
      look,
      coins: 30,
      onlineSec: 0,
      quests: [],
      badges: ['welcome'],
      homeRoomId: roomId,
      motto: '',
      friends: [],
      requests: [],
      blocked: [],
      stats: { chats: 0, buys: 0, moves: 0 },
      role: 'user',
      bannedUntil: null,
      createdAt: now,
      lastSeen: now,
    };
    this.data.users[id] = user;
    this.touch();
    return { user, token };
  }

  getRoom(id: string) {
    return this.data.rooms[id];
  }
  createRoom(ownerId: string, name: string, theme: RoomTheme, items: Omit<PlacedItem, 'id'>[]) {
    const id = newId('r');
    const rec: RoomRecord = {
      id,
      ownerId,
      name,
      description: '',
      access: 'open',
      passwordHash: null,
      rights: [],
      items: items.map((it, i) => ({ ...it, id: i + 1 })),
      nextItemId: items.length + 1,
      createdAt: new Date().toISOString(),
      theme,
    };
    this.data.rooms[id] = rec;
    this.touch();
    return rec;
  }
  deleteRoom(id: string) {
    delete this.data.rooms[id];
    this.touch();
  }
  listRooms() {
    return Object.values(this.data.rooms);
  }

  addReport(r: Omit<ReportRecord, 'id' | 'createdAt' | 'status'>) {
    this.data.reports.push({
      ...r,
      id: newId('rep'),
      createdAt: new Date().toISOString(),
      status: 'open',
    });
    this.touch();
  }

  logTrade(entry: TradeRecord) {
    (this.data.trades ??= []).push(entry);
    if (this.data.trades.length > 5000) this.data.trades.splice(0, 500);
    this.touch();
  }
  listReports() {
    return this.data.reports;
  }
  logAdmin(entry: AdminLogRecord) {
    (this.data.adminLog ??= []).push(entry);
    if (this.data.adminLog.length > 5000) this.data.adminLog.splice(0, 500);
    this.touch();
  }

  market() {
    return (this.data.market ??= []);
  }
  logMarket(entry: MarketLogRecord) {
    (this.data.marketLog ??= []).push(entry);
    if (this.data.marketLog.length > 20_000) this.data.marketLog.splice(0, 1000);
    this.touch();
  }

  logChat(entry: ChatLogRecord) {
    this.data.chatlog.push(entry);
    if (this.data.chatlog.length > CHAT_MAX_ENTRIES) this.data.chatlog.splice(0, 1000);
    this.touch();
  }
  recentChat(roomId: string, limit: number) {
    const out: ChatLogRecord[] = [];
    for (let i = this.data.chatlog.length - 1; i >= 0 && out.length < limit; i--) {
      const c = this.data.chatlog[i]!;
      if (c.roomId === roomId) out.unshift(c);
    }
    return out;
  }

  private pruneChat() {
    const cutoff = Date.now() - CHAT_RETENTION_MS;
    this.data.chatlog = this.data.chatlog.filter((c) => c.at >= cutoff);
  }

  touch() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 1500);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    this.pruneChat();
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }
}

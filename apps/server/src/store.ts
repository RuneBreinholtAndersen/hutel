import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BadgeId, Look, PlacedItem, QuestId, RoomAccess } from '@hutel/shared';

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
  requests: string[];
  blocked: string[];
  stats: { chats: number; buys: number; moves: number };
  role: 'user' | 'moderator' | 'admin';
  bannedUntil: number | null;
  createdAt: string;
  lastSeen: string;
}

export interface RoomRecord {
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

interface Data {
  version: 1;
  users: Record<string, UserRecord>;
  rooms: Record<string, RoomRecord>;
  reports: ReportRecord[];
  chatlog: ChatLogRecord[];
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
  getRoom(id: string): RoomRecord | undefined;
  listRooms(): RoomRecord[];
  addReport(r: Omit<ReportRecord, 'id' | 'createdAt' | 'status'>): void;
  logChat(entry: ChatLogRecord): void;
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

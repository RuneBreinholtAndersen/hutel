import { z } from 'zod';
import { FURNITURE_TYPES, type FurnitureType } from './catalog';
import { CHAT_MAX_LENGTH, ROOM_SIZE } from './constants';
import { LookSchema, type Look } from './look';
import type { PlacedItem } from './placement';
import type { RoomAccess, RoomTheme } from './rooms';
import type { BadgeId, DailyView, QuestId } from './progress';
import type { ActiveEvent } from './events';

const tileCoord = z.number().int().min(0).max(31);
const furnitureType = z.enum(FURNITURE_TYPES as [FurnitureType, ...FurnitureType[]]);
const userId = z.string().min(1).max(40);

/** Every message a client may send. Anything else is rejected by the server. */
export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('auth'), token: z.string().min(10).max(200) }),
  z.object({
    t: z.literal('join'),
    roomId: z.string().min(1).max(40),
    password: z.string().max(40).optional(),
  }),
  z.object({ t: z.literal('move'), x: tileCoord, z: tileCoord, run: z.boolean().optional() }),
  /** Free (non-tile) walking with the arrow keys: where my figure is now. */
  z.object({
    t: z.literal('glide'),
    x: z.number().min(-1).max(ROOM_SIZE),
    z: z.number().min(-1).max(ROOM_SIZE),
    run: z.boolean().optional(),
  }),
  z.object({ t: z.literal('sit'), itemId: z.number().int() }),
  /** Buy a piece of clothing, key like "hat:cowboy". */
  z.object({ t: z.literal('buyClothes'), key: z.string().max(30) }),
  /** Put one of my placed items back into my inventory. */
  z.object({ t: z.literal('stash'), id: z.number().int() }),
  /** Place an item from my inventory in my own room. */
  z.object({
    t: z.literal('placeInv'),
    index: z.number().int().min(0).max(500),
    x: tileCoord,
    z: tileCoord,
    rot: z.number().int().min(0).max(3),
  }),
  /** Trading between two players in the same room. */
  z.object({ t: z.literal('tradeStart'), userId: z.string().max(40) }),
  z.object({ t: z.literal('tradeReply'), accept: z.boolean() }),
  z.object({
    t: z.literal('tradeOffer'),
    coins: z.number().int().min(0).max(1_000_000),
    inv: z.array(z.number().int().min(0).max(500)).max(20),
    clothes: z.array(z.string().max(30)).max(20),
  }),
  z.object({ t: z.literal('tradeAccept') }),
  z.object({ t: z.literal('tradeCancel') }),
  /** Moderators and admins only (checked on the server). */
  z.object({
    t: z.literal('admin'),
    action: z.enum([
      'reports',
      'resolve',
      'warn',
      'mute',
      'unmute',
      'ban',
      'unban',
      'kick',
      'eventStart',
      'eventStop',
    ]),
    reportId: z.string().max(40).optional(),
    userId: z.string().max(40).optional(),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(60 * 24 * 365)
      .optional(),
    text: z.string().max(200).optional(),
    roomId: z.string().max(40).optional(),
  }),
  /** Choose which badge is shown by my name (null hides it). */
  z.object({ t: z.literal('showBadge'), id: z.string().max(30).nullable() }),
  /** Test phase: wipe my progress (coins, quests, badges, room) and start over. */
  z.object({ t: z.literal('reset') }),
  z.object({
    t: z.literal('chat'),
    text: z
      .string()
      .min(1)
      .max(CHAT_MAX_LENGTH * 2),
  }),
  z.object({ t: z.literal('action'), kind: z.enum(['wave', 'dance', 'stop']) }),
  z.object({ t: z.literal('look'), look: LookSchema }),
  z.object({
    t: z.literal('buy'),
    type: furnitureType,
    x: tileCoord,
    z: tileCoord,
    rot: z.number().int().min(0).max(3),
    color: z.number().int().min(0).max(15).optional(),
  }),
  z.object({
    t: z.literal('moveItem'),
    id: z.number().int(),
    x: tileCoord,
    z: tileCoord,
    rot: z.number().int().min(0).max(3),
    color: z.number().int().min(0).max(15).optional(),
  }),
  z.object({ t: z.literal('sellItem'), id: z.number().int() }),
  z.object({
    t: z.literal('roomSettings'),
    name: z.string().min(2).max(30).optional(),
    description: z.string().max(80).optional(),
    access: z.enum(['open', 'locked', 'password']).optional(),
    password: z.string().min(3).max(40).optional(),
  }),
  z.object({ t: z.literal('rights'), userId, grant: z.boolean() }),
  z.object({ t: z.literal('friendRequest'), name: z.string().min(2).max(16) }),
  z.object({ t: z.literal('friendRespond'), userId, accept: z.boolean() }),
  z.object({ t: z.literal('friendRemove'), userId }),
  z.object({
    t: z.literal('whisper'),
    to: userId,
    text: z
      .string()
      .min(1)
      .max(CHAT_MAX_LENGTH * 2),
  }),
  z.object({ t: z.literal('block'), userId, block: z.boolean() }),
  z.object({ t: z.literal('report'), userId, reason: z.string().min(3).max(300) }),
  z.object({ t: z.literal('profile'), userId }),
  z.object({ t: z.literal('motto'), motto: z.string().max(60) }),
  z.object({ t: z.literal('navigator') }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMsg = z.infer<typeof ClientMsgSchema>;

export interface PlayerView {
  id: string;
  name: string;
  look: Look;
  x: number;
  z: number;
  /** Remaining path and when (server ms) it started; clients animate along it. */
  path: [number, number][];
  pathStart: number;
  run: boolean;
  seatId: number | null;
  action: 'wave' | 'dance' | null;
  bot: boolean;
  /** Icon of the badge shown next to the name. */
  badge?: string;
}

export interface RoomView {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
  ownerId: string | null;
  ownerName: string | null;
  access: RoomAccess;
  canBuild: boolean;
  items: PlacedItem[];
  players: PlayerView[];
}

export interface Me {
  id: string;
  name: string;
  look: Look;
  coins: number;
  onlineSec: number;
  quests: QuestId[];
  badges: BadgeId[];
  homeRoomId: string;
  motto: string;
  daily: DailyView;
  /** Clothes bought in the shop ("slot:value"). */
  wardrobe: string[];
  /** Furniture not placed in a room. */
  inventory: InvItem[];
  role: 'user' | 'moderator' | 'admin';
  /** Badge shown by my name; null = hidden, undefined = newest. */
  showBadge?: string | null;
}

export interface AdminReport {
  id: string;
  createdAt: string;
  status: 'open' | 'closed';
  from: { id: string; name: string };
  target: { id: string; name: string; bannedUntil: number | null; mutedUntil: number | null };
  reason: string;
  roomId: string | null;
  context: { name: string; text: string; at: number }[];
}

export interface InvItem {
  type: FurnitureType;
  color?: number;
}

export interface TradeOfferView {
  coins: number;
  items: InvItem[];
  clothes: string[];
}

export interface TradeView {
  partner: { id: string; name: string };
  mine: TradeOfferView & { inv: number[] };
  theirs: TradeOfferView;
  myOk: boolean;
  theirOk: boolean;
}

export interface FriendView {
  id: string;
  name: string;
  online: boolean;
  roomId: string | null;
  roomName: string | null;
}

export interface NavigatorRoom {
  id: string;
  name: string;
  description: string;
  ownerName: string | null;
  access: RoomAccess;
  users: number;
  public: boolean;
}

export interface ProfileView {
  id: string;
  name: string;
  look: Look;
  motto: string;
  badges: BadgeId[];
  since: string;
  bot: boolean;
  friend: boolean;
  blocked: boolean;
  /** In the same room as you right now (so you can trade). */
  here?: boolean;
}

export type ServerMsg =
  | { t: 'welcome'; me: Me; serverTime: number; onboardingLock: boolean; canReset: boolean }
  | { t: 'resetDone' }
  | { t: 'tag'; id: string; badge?: string; shown?: string | null }
  | { t: 'adminReports'; reports: AdminReport[] }
  | { t: 'events'; events: ActiveEvent[] }
  /** A system line in the room (game results etc.); shown over `id` if given. */
  | { t: 'sys'; text: string; id?: string }
  | { t: 'wardrobe'; wardrobe: string[] }
  | { t: 'inventory'; items: InvItem[] }
  | { t: 'tradeAsk'; from: { id: string; name: string } }
  | { t: 'trade'; trade: TradeView }
  | { t: 'tradeEnd'; text: string; done: boolean }
  | { t: 'daily'; daily: DailyView; doneId?: string; bonus?: number }
  | { t: 'room'; room: RoomView; serverTime: number }
  | { t: 'playerJoin'; player: PlayerView }
  | { t: 'playerLeave'; id: string }
  | {
      t: 'path';
      id: string;
      path: [number, number][];
      pathStart: number;
      run: boolean;
      seatId: number | null;
      from: [number, number];
      /** Set when this is an echo of the player's own arrow-key glide. */
      glide?: boolean;
    }
  | { t: 'chat'; id: string; name: string; text: string; bot: boolean }
  | { t: 'action'; id: string; kind: 'wave' | 'dance' | null }
  | { t: 'look'; id: string; look: Look }
  | { t: 'itemPut'; item: PlacedItem }
  | { t: 'itemRemove'; id: number }
  | { t: 'roomMeta'; name: string; description: string; access: RoomAccess }
  | { t: 'coins'; coins: number; reason?: string }
  | { t: 'online'; onlineSec: number }
  | { t: 'quest'; id: QuestId; reward: number; all: boolean; hotelAll?: boolean }
  | { t: 'badge'; id: BadgeId }
  | { t: 'friends'; friends: FriendView[]; requests: { id: string; name: string }[] }
  | { t: 'whisper'; from: string; fromName: string; to: string; text: string }
  | { t: 'profile'; profile: ProfileView }
  | { t: 'navigator'; rooms: NavigatorRoom[] }
  | { t: 'toast'; text: string; kind?: 'info' | 'error' }
  | { t: 'needPassword'; roomId: string }
  | { t: 'pong'; serverTime: number };

export type { Look, PlacedItem, FurnitureType };

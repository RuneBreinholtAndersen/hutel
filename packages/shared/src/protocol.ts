import { z } from 'zod';
import { CARRY_IDS, EFFECT_IDS, OUTFIT_SLOTS, type CarryKind } from './style';
import {
  ACTION_IDS,
  BUBBLE_STYLE_IDS,
  EMOTE_IDS,
  NOTE_COLORS,
  NOTE_MAX_LENGTH,
  RELATION_IDS,
  type ActionKind,
  type EmoteKind,
  type RelationKind,
  type RoomNote,
  type CinemaView,
} from './social';
import { FURNITURE_TYPES, type FurnitureType } from './catalog';
import { CHAT_MAX_LENGTH, MAX_ROOM_SIZE } from './constants';
import { LookSchema, type Look } from './look';
import type { PlacedItem } from './placement';
import {
  ROOM_CATEGORY_IDS,
  type AptDoor,
  type RoomAccess,
  type RoomCategory,
  type RoomTheme,
} from './rooms';
import type { BadgeId, DailyView, QuestId } from './progress';
import type { ActiveEvent } from './events';
import {
  MAX_TILE_HEIGHT,
  MAX_USER_ROOM_SIZE,
  MIN_USER_ROOM_SIZE,
  ROOM_SHAPE_IDS,
  type RoomShape,
  type TileHeights,
} from './layout';
import { ROOM_GAME_IDS, type RoomGameView } from './roomgames';
import type { ReleaseNote } from './releases';
import { MELODY_IDS } from './music';
import { PET_KIND_IDS, PET_TRICK_IDS, type PetAct, type PetInfo, type PetView } from './pets';

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
    x: z.number().min(-1).max(MAX_ROOM_SIZE),
    z: z.number().min(-1).max(MAX_ROOM_SIZE),
    run: z.boolean().optional(),
  }),
  z.object({ t: z.literal('sit'), itemId: z.number().int() }),
  /** Switch a lamp, TV, fireplace or jukebox. */
  z.object({ t: z.literal('use'), itemId: z.number().int() }),
  /** Buy a piece of clothing, key like "hat:cowboy". */
  z.object({ t: z.literal('buyClothes'), key: z.string().max(30) }),
  z.object({
    t: z.literal('buyPet'),
    kind: z.enum(PET_KIND_IDS as [string, ...string[]]),
    name: z.string().min(2).max(14),
    color: z.number().int().min(0).max(7),
  }),
  /** Take a pet out (it follows you) or send it home (null). */
  z.object({ t: z.literal('petOut'), id: z.string().max(40).nullable() }),
  z.object({ t: z.literal('petFeed') }),
  /** Play a tune on a jukebox (null = stop). */
  z.object({
    t: z.literal('jukebox'),
    itemId: z.number().int(),
    song: z.enum(MELODY_IDS as [string, ...string[]]).nullable(),
  }),
  /** Cinema: put a YouTube video (11-character id) in the queue (plays at once if empty). */
  z.object({
    t: z.literal('cinemaAdd'),
    itemId: z.number().int(),
    video: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  }),
  /** Cinema: ask for the queue, vote to skip, stop the current video, remove from the queue. */
  z.object({ t: z.literal('cinemaGet'), itemId: z.number().int() }),
  z.object({ t: z.literal('cinemaSkip'), itemId: z.number().int() }),
  z.object({ t: z.literal('cinemaStop'), itemId: z.number().int() }),
  z.object({ t: z.literal('cinemaRemove'), itemId: z.number().int(), id: z.string().max(40) }),
  /** Sneboldkamp: throw at a player from the other team. */
  z.object({ t: z.literal('snowThrow'), targetId: z.string().max(40) }),
  /** Start a room game from a game console. */
  z.object({
    t: z.literal('gameStart'),
    itemId: z.number().int(),
    kind: z.enum(ROOM_GAME_IDS as [string, ...string[]]),
  }),
  /** Go through one of the apartment doors (walks there first if needed). */
  z.object({ t: z.literal('aptDoor'), index: z.number().int().min(0).max(10) }),
  /** Step into a teleporter (walks there first if needed). */
  z.object({ t: z.literal('teleport'), itemId: z.number().int() }),
  z.object({ t: z.literal('guestbookWrite'), userId, text: z.string().min(1).max(200) }),
  z.object({ t: z.literal('guestbookDelete'), userId, id: z.string().max(40) }),
  z.object({ t: z.literal('market'), q: z.string().max(30).optional() }),
  z.object({
    t: z.literal('marketSell'),
    index: z.number().int().min(0).max(500),
    price: z.number().int().min(1).max(10_000),
  }),
  z.object({ t: z.literal('marketBuy'), id: z.string().max(40) }),
  z.object({ t: z.literal('marketCancel'), id: z.string().max(40) }),
  /** Raise or lower one floor tile in my own room (0 = floor level). */
  z.object({
    t: z.literal('setHeight'),
    x: tileCoord,
    z: tileCoord,
    h: z.number().int().min(0).max(MAX_TILE_HEIGHT),
  }),
  /** Change the size and floor plan of my own room. */
  z.object({
    t: z.literal('renovate'),
    size: z.number().int().min(MIN_USER_ROOM_SIZE).max(MAX_USER_ROOM_SIZE),
    shape: z.enum(ROOM_SHAPE_IDS as [string, ...string[]]),
  }),
  z.object({ t: z.literal('petTrick'), trick: z.enum(PET_TRICK_IDS as [string, ...string[]]) }),
  z.object({ t: z.literal('petRename'), id: z.string().max(40), name: z.string().min(2).max(14) }),
  /** Buy (if needed) and use a wallpaper or floor in the room I am in. null = room default. */
  z.object({
    t: z.literal('decor'),
    kind: z.enum(['wall', 'floor']),
    id: z.string().max(20).nullable(),
  }),
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
  /** Buy an extra room for my apartment. */
  z.object({
    t: z.literal('buyRoom'),
    kind: z.enum(['bedroom', 'bathroom', 'kitchen', 'balcony']),
  }),
  /** Test phase: wipe my progress (coins, quests, badges, room) and start over. */
  z.object({ t: z.literal('reset') }),
  /** Delete my own account for good. `confirm` must be my name, typed by hand. */
  z.object({ t: z.literal('deleteAccount'), confirm: z.string().max(40) }),
  z.object({
    t: z.literal('chat'),
    text: z
      .string()
      .min(1)
      .max(CHAT_MAX_LENGTH * 2),
  }),
  z.object({
    t: z.literal('action'),
    kind: z.enum(['stop', ...ACTION_IDS] as [string, ...string[]]),
  }),
  /** Saved outfits: store the current look in a slot, or put one on. */
  z.object({
    t: z.literal('outfitSave'),
    slot: z
      .number()
      .int()
      .min(0)
      .max(OUTFIT_SLOTS - 1),
  }),
  z.object({
    t: z.literal('outfitWear'),
    slot: z
      .number()
      .int()
      .min(0)
      .max(OUTFIT_SLOTS - 1),
  }),
  /** Glow, coloured shadow, sparkles or a party aura around my figure. */
  z.object({ t: z.literal('setEffect'), effect: z.enum(EFFECT_IDS as [string, ...string[]]) }),
  /** Take something from a counter, coffee machine, vase… (walks there first). */
  z.object({
    t: z.literal('dispense'),
    itemId: z.number().int(),
    kind: z.enum(CARRY_IDS as [string, ...string[]]),
  }),
  z.object({ t: z.literal('carryDrop') }),
  /** Give what I hold to someone in the same room. */
  z.object({ t: z.literal('carryGive'), userId: z.string().max(40) }),
  /** A little icon that floats up from my head. */
  z.object({ t: z.literal('emote'), kind: z.enum(EMOTE_IDS as [string, ...string[]]) }),
  /** Choose my chat bubble style (must be unlocked). */
  z.object({ t: z.literal('setBubble'), style: z.enum(BUBBLE_STYLE_IDS as [string, ...string[]]) }),
  /** Privacy: may friends follow me into my room? */
  z.object({ t: z.literal('setPrivacy'), noFollow: z.boolean() }),
  /** Mark a friend as ❤️ / 😊 / 💀 on my profile (null removes it). */
  z.object({
    t: z.literal('setRelation'),
    userId: z.string().max(40),
    kind: z.enum(RELATION_IDS as [string, ...string[]]).nullable(),
  }),
  /** Post-it notes on a room's notice board. */
  z.object({ t: z.literal('notes') }),
  z.object({
    t: z.literal('noteWrite'),
    text: z
      .string()
      .min(1)
      .max(NOTE_MAX_LENGTH * 2),
    color: z
      .number()
      .int()
      .min(0)
      .max(NOTE_COLORS.length - 1),
  }),
  z.object({ t: z.literal('noteApprove'), id: z.string().max(40) }),
  z.object({ t: z.literal('noteDelete'), id: z.string().max(40) }),
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
    category: z.enum(ROOM_CATEGORY_IDS as [string, ...string[]]).optional(),
  }),
  z.object({ t: z.literal('rights'), userId, grant: z.boolean() }),
  z.object({ t: z.literal('friendRequest'), name: z.string().min(2).max(16) }),
  z.object({ t: z.literal('friendRespond'), userId, accept: z.boolean() }),
  z.object({ t: z.literal('friendRemove'), userId }),
  z.object({
    t: z.literal('hush'),
    to: userId,
    text: z.string().min(1).max(CHAT_MAX_LENGTH),
  }),
  z.object({ t: z.literal('pmHistory'), with: userId }),
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
  z.object({
    t: z.literal('navigator'),
    q: z.string().max(30).optional(),
    /** List every open guest room in this category. */
    cat: z.enum(ROOM_CATEGORY_IDS as [string, ...string[]]).optional(),
  }),
  z.object({ t: z.literal('favorite'), roomId: z.string().max(40), on: z.boolean() }),
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
  action: ActionKind | null;
  effect?: string;
  carry?: CarryKind | null;
  bot: boolean;
  /** Icon of the badge shown next to the name. */
  badge?: string;
  /** Hotel level, shown after the name. */
  level?: number;
  /** The pet following this player, if any. */
  pet?: PetView;
}

export interface RoomView {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
  /** Floor size in tiles (square). */
  size: number;
  /** Floor plan (holes in the square). */
  shape: RoomShape;
  category: RoomCategory;
  /** Raised tiles (stairs and platforms). */
  heights: TileHeights;
  /** Doors to the owner's other apartment rooms. */
  doors: AptDoor[];
  /** A game running in the room right now. */
  game: RoomGameView | null;
  /** Biggest size the owner has paid for (renovating up to it again is free). */
  paidSize: number;
  /** Wallpaper / floor chosen by the owner (null = the theme's own). */
  wall: string | null;
  floor: string | null;
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
  pets: PetInfo[];
  activePet: string | null;
  /** Wallpapers and floors I own, e.g. "wall:mint". */
  decor: string[];
  /** Furniture not placed in a room. */
  inventory: InvItem[];
  role: 'user' | 'moderator' | 'admin';
  /** My apartment rooms (the first is my living room). */
  apartment: { kind: string; id: string; name: string }[];
  /** Badge shown by my name; null = hidden, undefined = newest. */
  showBadge?: string | null;
  bubble?: string;
  noFollow?: boolean;
  outfits?: (Look | null)[];
  effect?: string;
  /** friend id → relation */
  relations?: Record<string, RelationKind>;
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
  /** Teleporter twin id. */
  pair?: string;
}

export interface GuestbookEntry {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  item: InvItem;
  price: number;
  at: number;
}

/** Share of a market sale that disappears (keeps the economy from inflating). */
export const MARKET_FEE = 0.05;
export const MARKET_MAX_LISTINGS = 20;
export const MARKET_MAX_PRICE = 10_000;

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
  /** Messenger messages from this friend you have not read yet. */
  unread: number;
}

export interface PmLine {
  from: string;
  text: string;
  at: number;
}

export interface NavigatorRoom {
  id: string;
  name: string;
  description: string;
  ownerName: string | null;
  access: RoomAccess;
  users: number;
  /** Max guests; the room is full when users >= max. */
  max: number;
  public: boolean;
  category: RoomCategory;
  /** On my favourites list. */
  fav: boolean;
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
  online?: boolean;
  level?: number;
  /** A few friends and how many there are in all. */
  friends?: { id: string; name: string }[];
  friendCount?: number;
  /** Rooms the player owns. */
  rooms?: { id: string; name: string; users: number }[];
  pet?: PetView;
  guestbook?: GuestbookEntry[];
  /** Friends marked ❤️ / 😊 / 💀. */
  relations?: { kind: RelationKind; users: { id: string; name: string }[] }[];
}

export type ServerMsg =
  | {
      t: 'welcome';
      me: Me;
      serverTime: number;
      onboardingLock: boolean;
      canReset: boolean;
      /** Build id of the client the server ships; an older open tab offers an update. */
      build?: string;
      /** Old tabs with another protocol version must reload. */
      protocol?: number;
      /** What's new in the server's version (old tabs don't know it yet). */
      notes?: ReleaseNote;
    }
  | { t: 'resetDone' }
  | { t: 'apartment'; rooms: { kind: string; id: string; name: string }[] }
  | { t: 'tag'; id: string; badge?: string; shown?: string | null; level?: number }
  | { t: 'adminReports'; reports: AdminReport[] }
  | { t: 'events'; events: ActiveEvent[] }
  /** A system line in the room (game results etc.); shown over `id` if given. */
  | { t: 'sys'; text: string; id?: string }
  | { t: 'wardrobe'; wardrobe: string[] }
  | { t: 'heights'; heights: TileHeights }
  | { t: 'roomGame'; game: RoomGameView | null }
  | { t: 'market'; listings: MarketListing[]; mine: MarketListing[] }
  | { t: 'pets'; pets: PetInfo[]; active: string | null }
  | { t: 'petView'; ownerId: string; pet: PetView | null }
  | { t: 'petAct'; ownerId: string; act: PetAct; say?: string }
  | { t: 'decor'; wall: string | null; floor: string | null; owned?: string[] }
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
  | {
      t: 'chat';
      id: string;
      name: string;
      text: string;
      bot: boolean;
      /** Bubble style id. */
      style?: string;
      /** A shout: bold, bigger and shown to the whole room. */
      shout?: boolean;
    }
  | { t: 'emote'; id: string; kind: EmoteKind }
  | { t: 'effect'; id: string; effect: string }
  | { t: 'carry'; id: string; item: CarryKind | null }
  | { t: 'snowball'; from: string; to: string; hit: boolean }
  | { t: 'cinema'; view: CinemaView }
  | { t: 'notes'; notes: RoomNote[]; canModerate: boolean }
  | { t: 'action'; id: string; kind: ActionKind | null }
  | { t: 'look'; id: string; look: Look }
  | { t: 'itemPut'; item: PlacedItem }
  | { t: 'itemRemove'; id: number }
  | {
      t: 'roomMeta';
      name: string;
      description: string;
      access: RoomAccess;
      category: RoomCategory;
    }
  | { t: 'coins'; coins: number; reason?: string }
  | { t: 'online'; onlineSec: number }
  | { t: 'quest'; id: QuestId; reward: number; all: boolean; hotelAll?: boolean }
  | { t: 'badge'; id: BadgeId }
  | {
      t: 'friends';
      friends: FriendView[];
      requests: { id: string; name: string }[];
      /** Lobbi Junior: my friend code. */
      code?: string;
    }
  | { t: 'whisper'; from: string; fromName: string; to: string; text: string; at: number }
  | { t: 'hush'; from: string; fromName: string; to: string; toName: string; text: string }
  | { t: 'pmHistory'; with: string; msgs: PmLine[] }
  | { t: 'profile'; profile: ProfileView }
  | { t: 'navigator'; rooms: NavigatorRoom[]; q?: string; cat?: RoomCategory }
  | { t: 'toast'; text: string; kind?: 'info' | 'error' }
  | { t: 'needPassword'; roomId: string }
  | { t: 'pong'; serverTime: number };

export type { Look, PlacedItem, FurnitureType };

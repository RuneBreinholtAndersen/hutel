import { z } from 'zod';
import { FURNITURE_TYPES, type FurnitureType } from './catalog';
import { CHAT_MAX_LENGTH, ROOM_SIZE } from './constants';
import { LookSchema, type Look } from './look';
import type { PlacedItem } from './placement';
import type { RoomAccess, RoomTheme } from './rooms';
import type { BadgeId, QuestId } from './progress';

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
  }),
  z.object({
    t: z.literal('moveItem'),
    id: z.number().int(),
    x: tileCoord,
    z: tileCoord,
    rot: z.number().int().min(0).max(3),
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
}

export type ServerMsg =
  | { t: 'welcome'; me: Me; serverTime: number; onboardingLock: boolean; canReset: boolean }
  | { t: 'resetDone' }
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
  | { t: 'quest'; id: QuestId; reward: number; all: boolean }
  | { t: 'badge'; id: BadgeId }
  | { t: 'friends'; friends: FriendView[]; requests: { id: string; name: string }[] }
  | { t: 'whisper'; from: string; fromName: string; to: string; text: string }
  | { t: 'profile'; profile: ProfileView }
  | { t: 'navigator'; rooms: NavigatorRoom[] }
  | { t: 'toast'; text: string; kind?: 'info' | 'error' }
  | { t: 'needPassword'; roomId: string }
  | { t: 'pong'; serverTime: number };

export type { Look, PlacedItem, FurnitureType };

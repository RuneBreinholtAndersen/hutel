/** Chat extras: shouting, bubble styles, emotes, actions, relations and room notes. */
import type { BadgeId } from './progress';

/* ---------------- actions ---------------- */

/** Things a figure can do. Timed ones stop by themselves; the rest last until you walk. */
export const ACTIONS = {
  wave: { name: 'Vink', icon: '👋', timed: true },
  dance: { name: 'Dans', icon: '💃', timed: false },
  hug: { name: 'Kram', icon: '🤗', timed: true },
  highfive: { name: 'High-five', icon: '✋', timed: true },
  sleep: { name: 'Sov', icon: '😴', timed: false },
  think: { name: 'Tænk', icon: '🤔', timed: false },
  sitfloor: { name: 'Sid på gulvet', icon: '🧘', timed: false },
} as const;
export type ActionKind = keyof typeof ACTIONS;
export const ACTION_IDS = Object.keys(ACTIONS) as ActionKind[];
export const ACTION_MS = 2500;

/** Chat shortcuts like ":sit" or ":kram". */
export const ACTION_COMMANDS: Record<string, ActionKind> = {
  sit: 'sitfloor',
  sid: 'sitfloor',
  sov: 'sleep',
  sleep: 'sleep',
  kram: 'hug',
  hug: 'hug',
  highfive: 'highfive',
  'high-five': 'highfive',
  tænk: 'think',
  think: 'think',
  dans: 'dance',
  dance: 'dance',
  vink: 'wave',
  wave: 'wave',
};

/* ---------------- emotes ---------------- */

export const EMOTES = {
  heart: '❤️',
  laugh: '😂',
  sleep: '💤',
  zap: '⚡',
  wow: '😮',
  thumbs: '👍',
  sad: '😢',
  music: '🎵',
} as const;
export type EmoteKind = keyof typeof EMOTES;
export const EMOTE_IDS = Object.keys(EMOTES) as EmoteKind[];

/** Chat shortcuts like ":heart" or ":haha". */
export const EMOTE_COMMANDS: Record<string, EmoteKind> = {
  heart: 'heart',
  hjerte: 'heart',
  love: 'heart',
  haha: 'laugh',
  lol: 'laugh',
  zzz: 'sleep',
  zap: 'zap',
  wow: 'wow',
  ok: 'thumbs',
  tommel: 'thumbs',
  trist: 'sad',
  sad: 'sad',
  musik: 'music',
};

/* ---------------- shouting ---------------- */

/** One shout per this many ms per player. */
export const SHOUT_COOLDOWN_MS = 20_000;
/** ":shout hej" or "/råb hej" → "hej" (null = not a shout). */
export function shoutText(text: string): string | null {
  const m = /^(?::shout|:råb|\/råb|\/shout)\s+(.+)$/i.exec(text.trim());
  return m ? m[1]!.trim() : null;
}

/* ---------------- bubble styles ---------------- */

export interface BubbleStyle {
  name: string;
  /** Background and text colour of the bubble. */
  bg: string;
  fg: string;
  /** Rounder, square or cloud shape. */
  shape: 'round' | 'square' | 'cloud';
  /** Unlocked by owning this badge or reaching this level. */
  badge?: BadgeId;
  level?: number;
}

export const BUBBLE_STYLES = {
  classic: { name: 'Klassisk', bg: '#fff8ec', fg: '#3a2418', shape: 'round' },
  mint: { name: 'Mynte', bg: '#d6f5e8', fg: '#1d4a3a', shape: 'round', level: 2 },
  sky: { name: 'Himmel', bg: '#d8e9ff', fg: '#1d3257', shape: 'cloud', level: 3 },
  night: { name: 'Nat', bg: '#2a2340', fg: '#f3e9ff', shape: 'square', level: 5 },
  party: { name: 'Fest', bg: '#ffd1ec', fg: '#5a1240', shape: 'cloud', badge: 'festabe' },
  chatty: { name: 'Snakkehoved', bg: '#ffb347', fg: '#3a2418', shape: 'round', badge: 'chatty' },
  stars: { name: 'Stjerne', bg: '#1d2a4a', fg: '#ffe9a8', shape: 'cloud', badge: 'stjernekigger' },
  host: {
    name: 'Hotelkender',
    bg: '#7a2e2e',
    fg: '#fff0d8',
    shape: 'square',
    badge: 'hotelkender',
  },
} as const satisfies Record<string, BubbleStyle>;
export type BubbleStyleId = keyof typeof BUBBLE_STYLES;
export const BUBBLE_STYLE_IDS = Object.keys(BUBBLE_STYLES) as BubbleStyleId[];

export function bubbleUnlocked(id: string, badges: readonly string[], level: number): boolean {
  const st = (BUBBLE_STYLES as Record<string, BubbleStyle>)[id];
  if (!st) return false;
  if (st.badge && !badges.includes(st.badge)) return false;
  if (st.level && level < st.level) return false;
  return true;
}

/* ---------------- relations ---------------- */

export const RELATIONS = {
  heart: { icon: '❤️', name: 'Hjerte' },
  smile: { icon: '😊', name: 'Gode venner' },
  skull: { icon: '💀', name: 'Rivaler' },
} as const;
export type RelationKind = keyof typeof RELATIONS;
export const RELATION_IDS = Object.keys(RELATIONS) as RelationKind[];

/* ---------------- room notes (post-its) ---------------- */

export const NOTE_MAX_LENGTH = 100;
/** Notes kept per room (approved + waiting). */
export const NOTES_PER_ROOM = 30;
export const NOTE_COLORS = ['#fff3a3', '#ffd1dc', '#c9f2d3', '#cfe4ff'] as const;

export interface RoomNote {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  color: number;
  at: number;
  approved: boolean;
}

/* ---------------- cinema ---------------- */

export const CINEMA = {
  /** Longest time one video gets before the next in the queue starts. */
  slotMs: 10 * 60_000,
  queueMax: 10,
  /** Coins to put a video in the queue in a public cinema (free in your own room). */
  publicPrice: 5,
  /** Share of the viewers that must vote to skip. */
  skipShare: 0.5,
} as const;

export interface CinemaEntry {
  id: string;
  video: string;
  title: string;
  byId: string;
  byName: string;
}

/** What everyone sees in the cinema panel. */
export interface CinemaView {
  itemId: number;
  now: (CinemaEntry & { startedAt: number; until: number }) | null;
  queue: CinemaEntry[];
  skips: number;
  needed: number;
  /** This player may stop, skip at once and remove any entry. */
  canManage: boolean;
  /** Coins it costs this player to add a video (0 = free). */
  price: number;
  /** This player may add videos at all. */
  canAdd: boolean;
}

export const QUESTS = [
  { id: 'walk', text: 'Gå hen til vinduet på dit værelse', reward: 5 },
  { id: 'hello', text: 'Sig hej i chatten', reward: 5 },
  { id: 'sit', text: 'Sæt dig i en sofa eller stol', reward: 5 },
  { id: 'look', text: 'Skift udseende under Min figur', reward: 5 },
  { id: 'move', text: 'Flyt et møbel med Byg', reward: 10 },
  { id: 'buy', text: 'Køb og placér noget fra butikken', reward: 10 },
] as const;

/** Second chain, unlocked when the start quests are done: explore the hotel and meet people. */
export const HOTEL_QUESTS = [
  { id: 'lobby', text: 'Find vej til lobbyen via Rum', reward: 5 },
  { id: 'ida', text: 'Skriv til Ida i receptionen', reward: 5 },
  { id: 'aquarium', text: 'Gå hen og kig på akvariet i lobbyen', reward: 5 },
  { id: 'coffee', text: 'Bestil en kaffe hos Luna i caféen (skriv "kaffe")', reward: 5 },
  { id: 'cafeSit', text: 'Sæt dig i caféen', reward: 5 },
  { id: 'greetHuman', text: 'Sig hej til en rigtig gæst (ikke en AI-beboer)', reward: 15 },
] as const;
export const HOTEL_BONUS = 25;

/** Daily quests: "log in" every day plus two more picked by date. Reset at midnight (Danish time). */
export const DAILY_POOL = [
  { id: 'd_login', text: 'Kig forbi hotellet i dag', reward: 5, goal: 1 },
  { id: 'd_chat', text: 'Skriv 3 beskeder i chatten', reward: 5, goal: 3 },
  { id: 'd_visit', text: 'Besøg en andens værelse', reward: 10, goal: 1 },
  { id: 'd_sit', text: 'Sæt dig et sted uden for dit værelse', reward: 5, goal: 1 },
  { id: 'd_wave', text: 'Vink til nogen 👋', reward: 5, goal: 1 },
  { id: 'd_cafe', text: 'Tag en tur i caféen', reward: 5, goal: 1 },
  { id: 'd_online', text: 'Vær på hotellet i 15 minutter', reward: 10, goal: 15 },
] as const;
export type DailyId = (typeof DAILY_POOL)[number]['id'];
/** Extra coins when all of today's quests are done. */
export const DAILY_BONUS = 10;

/**
 * Daily gift for logging in, by day in a row (1–7, then it starts over). Always coins and always
 * the same amounts – no random prizes.
 */
export const LOGIN_GIFTS = [10, 15, 20, 25, 30, 40, 100] as const;
export function loginGiftFor(dayInRow: number): number {
  return LOGIN_GIFTS[(Math.max(1, dayInRow) - 1) % LOGIN_GIFTS.length]!;
}

/** Today's date in Denmark, e.g. "2026-11-06". */
export function danishDate(now = Date.now()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(now);
}

/** The three quests for a given day: always "log in", plus two that change daily. */
export function dailyQuestsFor(date: string): DailyId[] {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rest = DAILY_POOL.slice(1).map((q) => q.id);
  const a = rest[h % rest.length]!;
  const others = rest.filter((id) => id !== a);
  const b = others[(Math.imul(h ^ (h >>> 13), 2654435761) >>> 0) % others.length]!;
  return ['d_login', a, b];
}

export interface DailyView {
  date: string;
  quests: {
    id: DailyId;
    text: string;
    reward: number;
    goal: number;
    progress: number;
    done: boolean;
  }[];
  /** Days in a row with all daily quests done. */
  streak: number;
}

export type QuestId = (typeof QUESTS)[number]['id'] | (typeof HOTEL_QUESTS)[number]['id'];

export const BADGES = {
  welcome: { name: 'Ny gæst', icon: '🔑', text: 'Tjekkede ind på Lobbi' },
  onboarded: { name: 'Klar til hotellet', icon: '🎉', text: 'Klarede alle startopgaver' },
  festabe: { name: 'Festaben', icon: '🎉', text: 'Var med til Fredagsfest' },
  stjernekigger: { name: 'Stjernekigger', icon: '🔭', text: 'Var med til Stjerneaften' },
  poolhaj: { name: 'Poolhaj', icon: '🏊', text: 'Var med til Poolparty' },
  quizhjerne: { name: 'Quizhjerne', icon: '🧠', text: 'Var med til Søndagsquiz' },
  event: { name: 'Eventgæst', icon: '🎈', text: 'Var med til et særligt event' },
  streak7: { name: 'Trofast gæst', icon: '📅', text: 'Dagens opgaver 7 dage i træk' },
  hotelkender: { name: 'Hotelkender', icon: '🗝️', text: 'Klarede alle hotel-opgaver' },
  online1h: { name: 'Stamgæst', icon: '⏱️', text: '1 time online' },
  online10h: { name: 'Fast inventar', icon: '🏆', text: '10 timer online' },
  social: { name: 'Social sommerfugl', icon: '🦋', text: '5 venner' },
  shopper: { name: 'Shoppinglysten', icon: '🛍️', text: 'Købte 5 møbler' },
  decorator: { name: 'Indretningsarkitekt', icon: '🎨', text: 'Flyttede møbler 25 gange' },
  chatty: { name: 'Snakkesalig', icon: '💬', text: 'Skrev 100 beskeder' },
} as const;
export type BadgeId = keyof typeof BADGES;

/** Experience: minutes online + 10 per quest + 20 per badge. */
export function xpOf(u: {
  onlineSec: number;
  quests: readonly string[];
  badges: readonly string[];
}) {
  const badges = u.badges.filter((b) => b !== 'welcome').length;
  return Math.floor(u.onlineSec / 60) + u.quests.length * 10 + badges * 20;
}
/** XP needed to reach a level (level 1 = 0 XP, then 15, 60, 135, 240 …). */
export const xpForLevel = (level: number) => 15 * (level - 1) ** 2;
export function levelOf(u: {
  onlineSec: number;
  quests: readonly string[];
  badges: readonly string[];
}) {
  const xp = xpOf(u);
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return { level, xp, next: xpForLevel(level + 1), prev: xpForLevel(level) };
}

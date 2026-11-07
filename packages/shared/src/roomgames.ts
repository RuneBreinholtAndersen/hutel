/** Games played with furniture in a room. The server runs the rules; clients only show them. */

export const ROOM_GAMES = {
  paint: {
    name: 'Farvekamp',
    icon: '🎨',
    secs: 60,
    rules:
      'To hold. Løb hen over farvefelterne for at farve dem – flest felter i jeres farve vinder.',
    needs: 'Mindst 4 farvefelter',
    reward: 3,
  },
  race: {
    name: 'Kapløb',
    icon: '🏁',
    secs: 90,
    rules: 'Stil dig på et startfelt. Når der står "Løb!", gælder det om at nå målfeltet først.',
    needs: 'Mindst ét startfelt og ét målfelt',
    reward: 5,
  },
} as const;
export type RoomGameKind = keyof typeof ROOM_GAMES;
export const ROOM_GAME_IDS = Object.keys(ROOM_GAMES) as RoomGameKind[];

/** Countdown before a game starts. */
export const GAME_COUNTDOWN_MS = 3000;
/** Teams in Farvekamp: 1 = red, 2 = blue (also the colour tile state). */
export const TEAM_COLORS = { 1: 0xe0564a, 2: 0x3f7fb6 } as const;
export const TEAM_NAMES = { 1: '🔴 Rød', 2: '🔵 Blå' } as const;

/** A running game as everyone in the room sees it. */
export interface RoomGameView {
  kind: RoomGameKind;
  phase: 'countdown' | 'play';
  /** When the countdown ends (countdown) or the game ends (play), ms epoch. */
  until: number;
  /** Farvekamp: player id → team (1 or 2). */
  teams?: Record<string, 1 | 2>;
  /** Farvekamp: tiles per team [red, blue]. */
  score?: [number, number];
  /** Kapløb: who is racing. */
  racers?: string[];
}

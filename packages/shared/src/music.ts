/**
 * Lobbi's own little tunes, written as notes (nothing copied). Each song is a loop of 32 eighth-
 * note steps. A token is a note like "C4", "F#3", or "-" for a rest. Drums: k = kick, s = snare,
 * h = hi-hat, "-" = nothing.
 */

export interface Melody {
  name: string;
  icon: string;
  bpm: number;
  /** Oscillator shape of the lead voice. */
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  lead: string;
  bass: string;
  drums: string;
}

export const MELODIES = {
  hotelbar: {
    name: 'Hotelbar-jazz',
    icon: '🎷',
    bpm: 96,
    wave: 'triangle',
    lead: 'E4 - G4 A4 - G4 E4 - D4 - E4 - G4 - - - E4 - G4 A4 - C5 A4 - G4 - E4 - D4 - - -',
    bass: 'C2 - E2 - G2 - A2 - F2 - A2 - C3 - A2 - C2 - E2 - G2 - A2 - G2 - B2 - D3 - B2 -',
    drums: 'k - h - s - h h k - h - s - h - k - h - s - h h k - h - s h h -',
  },
  fredag: {
    name: 'Fredagsfest',
    icon: '🎉',
    bpm: 124,
    wave: 'square',
    lead: 'A4 - A4 C5 - A4 G4 - E4 - G4 - A4 - - - A4 - A4 C5 - D5 C5 - A4 - G4 - A4 - - -',
    bass: 'A2 A2 - A2 A2 - A2 - F2 F2 - F2 F2 - F2 - C3 C3 - C3 C3 - C3 - G2 G2 - G2 G2 - G2 -',
    drums: 'k h s h k h s h k h s h k h s h k h s h k h s h k h s h k s s s',
  },
  regnvejr: {
    name: 'Regnvejr i caféen',
    icon: '🌧️',
    bpm: 76,
    wave: 'sine',
    lead: 'G4 - - B4 - D5 - - C5 - B4 - A4 - - - G4 - - B4 - D5 - E5 D5 - - B4 - - - -',
    bass: 'G2 - - - - - D3 - C3 - - - - - G2 - E2 - - - - - B2 - C3 - - - D3 - - -',
    drums: 'k - - - s - - h k - h - s - - - k - - - s - - h k - h - s - h -',
  },
  pool: {
    name: 'Poolparty',
    icon: '🏝️',
    bpm: 108,
    wave: 'triangle',
    lead: 'C5 - E5 - G5 E5 - C5 D5 - F5 - A5 F5 - D5 E5 - G5 - C6 G5 - E5 D5 - B4 - G4 - - -',
    bass: 'C3 - - C3 - - G2 - D3 - - D3 - - A2 - E3 - - E3 - - B2 - G2 - - G2 - - D3 -',
    drums: 'k - h k - h s - k - h k - h s - k - h k - h s - k - h k - s s h',
  },
  stjerner: {
    name: 'Under stjernerne',
    icon: '✨',
    bpm: 66,
    wave: 'sine',
    lead: 'E5 - - - D5 - - - C5 - - - G4 - - - A4 - - - B4 - C5 - D5 - - - - - - -',
    bass: 'C3 - - - - - - - A2 - - - - - - - F2 - - - - - - - G2 - - - - - - -',
    drums: '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -',
  },
  arkade: {
    name: 'Arkade-hop',
    icon: '👾',
    bpm: 140,
    wave: 'square',
    lead: 'C5 E5 G5 C6 G5 E5 C5 - D5 F5 A5 D6 A5 F5 D5 - E5 G5 B5 E6 B5 G5 E5 - G5 - G5 A5 B5 - C6 -',
    bass: 'C3 - C3 - G2 - G2 - D3 - D3 - A2 - A2 - E3 - E3 - B2 - B2 - G2 - G2 - G2 - C3 -',
    drums: 'k - s - k k s - k - s - k k s - k - s - k k s - k - s s k s s s',
  },
} as const satisfies Record<string, Melody>;

export type MelodyId = keyof typeof MELODIES;
export const MELODY_IDS = Object.keys(MELODIES) as MelodyId[];
export const MELODY_STEPS = 32;

/** Length of one loop in milliseconds. */
export const melodyLoopMs = (m: Melody) => (MELODY_STEPS * 60_000) / m.bpm / 2;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note like "C4" or "F#3" (A4 = 440 Hz), or null for a rest. */
export function noteFreq(tok: string): number | null {
  const m = /^([A-G])(#?)(\d)$/.exec(tok);
  if (!m) return null;
  const semis = NOTE[m[1]!]! + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((semis - 69) / 12);
}

export const steps = (s: string) => s.trim().split(/\s+/);

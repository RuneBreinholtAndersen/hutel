/**
 * Bump when old clients can no longer talk to the new server (they must reload).
 * Small changes keep the number, and players just see an "update available" button.
 */
export const PROTOCOL_VERSION = 2;

export interface ReleaseNote {
  date: string;
  title: string;
  items: string[];
}

/** What's new, newest first. Add an entry for every deploy players should hear about. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-11-07',
    title: 'Rum-spil, ny butik og opdateringer uden afbrydelser',
    items: [
      '🕹️ Spilkonsol med Farvekamp og Kapløb',
      '🛒 Butikken er delt i kategorier og har søgning',
      '🚪 Døre mellem rummene i din lejlighed',
      '✨ Nye versioner viser en knap i stedet for at genindlæse siden',
    ],
  },
  {
    date: '2026-11-06',
    title: 'Kæledyr, marked og teleportere',
    items: [
      '🐾 Hund, kat og drage der følger dig',
      '🏪 Marked hvor du kan sælge og købe møbler',
      '🌀 Teleportere i par',
      '📖 Gæstebog på profilen',
    ],
  },
];

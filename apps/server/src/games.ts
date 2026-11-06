/** Small chat games: dice, rock-paper-scissors against a bot, and quiz. */

export const GAME_COINS_PER_DAY = 20;

export interface QuizQuestion {
  q: string;
  /** Accepted answers, lower-case. */
  a: string[];
}

export const QUIZ: QuizQuestion[] = [
  { q: 'Hvad er hovedstaden i Danmark?', a: ['københavn', 'kobenhavn', 'kbh'] },
  { q: 'Hvor mange ben har en edderkop?', a: ['8', 'otte'] },
  { q: 'Hvilken planet kaldes den røde planet?', a: ['mars'] },
  { q: 'Hvor mange dage er der i et skudår?', a: ['366'] },
  { q: 'Hvad hedder Danmarks højeste naturlige punkt?', a: ['møllehøj', 'mollehoj'] },
  { q: 'Hvad er 7 × 8?', a: ['56', 'seksoghalvtreds'] },
  { q: 'Hvilket dyr er Danmarks nationalfugl?', a: ['knopsvane', 'svane'] },
  {
    q: 'Hvem skrev eventyret om Den Grimme Ælling?',
    a: ['h.c. andersen', 'hc andersen', 'andersen', 'h c andersen'],
  },
  { q: 'Hvor mange farver har en regnbue (traditionelt)?', a: ['7', 'syv'] },
  { q: 'Hvad hedder den største ø i Danmark?', a: ['sjælland', 'sjaelland'] },
  { q: 'Hvilket hav ligger vest for Jylland?', a: ['nordsøen', 'nordsoen', 'vesterhavet'] },
  { q: 'Hvor mange minutter er der i en time?', a: ['60', 'tres'] },
  { q: 'Hvilken farve får man ved at blande blå og gul?', a: ['grøn', 'gron'] },
  { q: 'Hvad hedder LEGO-byen i Jylland, hvor LEGO kommer fra?', a: ['billund'] },
  { q: 'Hvor mange spillere har et fodboldhold på banen?', a: ['11', 'elleve'] },
  { q: 'Hvilket metal er flydende ved stuetemperatur?', a: ['kviksølv', 'kviksolv'] },
  { q: 'Hvad er det kemiske tegn for vand?', a: ['h2o'] },
  { q: 'Hvilken by ligger Den Lille Havfrue i?', a: ['københavn', 'kobenhavn'] },
  { q: 'Hvor mange kontinenter er der?', a: ['7', 'syv'] },
  { q: 'Hvad hedder Jordens største ocean?', a: ['stillehavet', 'stille ocean'] },
];

export type Hand = 'sten' | 'saks' | 'papir';
export const HANDS: Hand[] = ['sten', 'saks', 'papir'];
const BEATS: Record<Hand, Hand> = { sten: 'saks', saks: 'papir', papir: 'sten' };
export const HAND_ICON: Record<Hand, string> = { sten: '🪨', saks: '✂️', papir: '📄' };

/** 1 = you win, 0 = draw, -1 = you lose. */
export function rps(you: Hand, bot: Hand): 1 | 0 | -1 {
  if (you === bot) return 0;
  return BEATS[you] === bot ? 1 : -1;
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[!?.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function isAnswer(q: QuizQuestion, text: string) {
  const t = normalize(text);
  return q.a.some((a) => t === a || t.split(' ').includes(a));
}

/** An open quiz question in a room. */
export interface RoomQuiz {
  q: QuizQuestion;
  until: number;
}

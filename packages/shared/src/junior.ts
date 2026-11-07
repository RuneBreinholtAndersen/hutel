/**
 * Lobbi Junior (8–12 år): the same game, but children can only "say" ready-made sentences,
 * pick a fun made-up name, and only become friends with someone who gives them a friend code.
 * The server checks every message against these lists, so a changed client can't get around it.
 */

/** Ready-made sentences, grouped like in the chat menu. Emojis are part of the sentence. */
export const JUNIOR_PHRASES: Record<string, { icon: string; lines: string[] }> = {
  hilsner: {
    icon: '👋',
    lines: [
      'Hej! 👋',
      'Hej alle sammen!',
      'Godmorgen ☀️',
      'Godaften 🌙',
      'Vi ses! 👋',
      'Farvel! 😊',
    ],
  },
  spørgsmål: {
    icon: '❓',
    lines: [
      'Hvordan går det?',
      'Vil du være min ven?',
      'Vil du lege?',
      'Hvor skal vi hen?',
      'Vil du se mit værelse?',
      'Hvad laver du?',
      'Skal vi spille et spil?',
    ],
  },
  svar: {
    icon: '💬',
    lines: [
      'Ja! 😄',
      'Nej tak',
      'Måske 🤔',
      'Okay 👍',
      'Det ved jeg ikke',
      'Om lidt',
      'Tak! 🙏',
      'Undskyld 😅',
    ],
  },
  ros: {
    icon: '🌟',
    lines: [
      'Flot værelse! 🏠',
      'Sejt tøj! 😎',
      'Godt spillet! 🏆',
      'Du er sjov 😂',
      'Det var hyggeligt!',
      'Sødt kæledyr! 🐶',
    ],
  },
  leg: {
    icon: '🎲',
    lines: [
      'Kom med i caféen ☕',
      'Lad os tage til poolen 🏊',
      'Farvekamp! 🎨',
      'Sneboldkamp! ❄️',
      'Kapløb! 🏁',
      'Følg mig!',
      'Lad os danse 💃',
    ],
  },
  følelser: {
    icon: '😊',
    lines: [
      'Jeg er glad 😊',
      'Jeg keder mig 😴',
      'Det er sjovt! 🥳',
      'Jeg er ked af det 😢',
      'Wow! 😮',
      'Haha 😂',
    ],
  },
};

const ALL = new Set(Object.values(JUNIOR_PHRASES).flatMap((c) => c.lines));

/** True if the text is exactly one of the ready-made sentences. */
export const isJuniorPhrase = (text: string) => ALL.has(text.trim());

/* ---------------- names: "Glad Odder 12" ---------------- */

export const JUNIOR_ADJ = [
  'Glad',
  'Modig',
  'Kvik',
  'Sød',
  'Sjov',
  'Rolig',
  'Hurtig',
  'Klog',
  'Venlig',
  'Frisk',
  'Lun',
  'Lille',
  'Stor',
  'Vild',
  'Blå',
  'Grøn',
] as const;
export const JUNIOR_ANIMALS = [
  'Odder',
  'Panda',
  'Ræv',
  'Ugle',
  'Sæl',
  'Hval',
  'Tiger',
  'Kanin',
  'Egern',
  'Delfin',
  'Koala',
  'Lama',
  'Bjørn',
  'Frø',
  'Hest',
  'Mus',
] as const;

export function randomJuniorName(rnd: () => number = Math.random): string {
  const a = JUNIOR_ADJ[Math.floor(rnd() * JUNIOR_ADJ.length)]!;
  const b = JUNIOR_ANIMALS[Math.floor(rnd() * JUNIOR_ANIMALS.length)]!;
  return `${a} ${b} ${1 + Math.floor(rnd() * 99)}`;
}

/** Junior names must be made from the lists – never a child's real name. */
export function isJuniorName(name: string): boolean {
  const m = /^(\S+) (\S+) (\d{1,2})$/.exec(name.trim());
  return (
    !!m &&
    (JUNIOR_ADJ as readonly string[]).includes(m[1]!) &&
    (JUNIOR_ANIMALS as readonly string[]).includes(m[2]!) &&
    Number(m[3]) >= 1
  );
}

/* ---------------- friend codes ---------------- */

/** Letters that can't be mixed up (no 0/O, 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newFriendCode(rnd: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
  return c;
}
export const isFriendCode = (c: string) =>
  new RegExp(`^[${CODE_CHARS}]{6}$`).test(c.trim().toUpperCase());

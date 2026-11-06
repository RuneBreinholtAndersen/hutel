import { CHAT_MAX_LENGTH } from './constants';

// A small starter list. Moderators extend this server-side; matching is on whole words.
const BLOCKED = [
  'fuck',
  'fucking',
  'kælling',
  'luder',
  'nigger',
  'neger',
  'perker',
  'bøsserøv',
  'cunt',
  'whore',
];
const BLOCKED_RE = new RegExp(`(^|[^\\p{L}])(${BLOCKED.join('|')})(?=$|[^\\p{L}])`, 'giu');

/** Trims, strips control characters, collapses whitespace and caps the length. */
export function sanitizeChat(raw: string): string {
  return (
    raw
      // eslint-disable-next-line no-control-regex -- stripping control characters is the point
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CHAT_MAX_LENGTH)
  );
}

/** Masks blocked words with asterisks. */
export function filterChat(text: string): string {
  return text.replace(BLOCKED_RE, (_m, pre: string, word: string) => pre + '*'.repeat(word.length));
}

export function isGreeting(text: string): boolean {
  return /(^|[^\p{L}])(hej|hejsa|hey|hi|hallo|halløj|davs|godag|goddag|hello)(?=$|[^\p{L}])/iu.test(
    text,
  );
}

const NAME_RE = /^[\p{L}\p{N}_\- ]{2,16}$/u;
export function isValidName(name: string): boolean {
  return NAME_RE.test(name) && name.trim() === name && !/\s{2}/.test(name);
}

/**
 * Small windows into the hotel further down the pages: a real room from the game with guests
 * who walk around and chat. Each one starts when it scrolls into view, so pages stay light.
 */
import { JUNIOR_PHRASES, type Look } from '@hutel/shared';
import { startRoomScene, type Guest } from './lobby';

const ADULT: Record<string, Guest[]> = {
  cafe: [
    {
      name: 'Luna',
      bot: true,
      look: { hair: 0x2a2a35, hairStyle: 'langt', shirt: 0x6a4a8a, top: 'skjorte' },
      lines: ['Velkommen i caféen ☕', 'Dagens kage er gulerod 🥕'],
    },
    {
      name: 'Kasper',
      look: { hair: 0x6a4428, hairStyle: 'kort', shirt: 0x2f6b8f, top: 'hoodie' },
      lines: ['En latte, tak ☕', 'Nogen der vil spille Kapløb bagefter? 🏁'],
    },
    {
      name: 'Line',
      look: { hair: 0xd9a35b, hairStyle: 'hestehale', shirt: 0xc25a4a, top: 'stribet' },
      lines: ['Hvor hyggeligt her er 😊', 'Jeg har lige fået en ny lampe 💡'],
    },
    {
      name: 'Emil',
      look: { hair: 0x3b2416, hairStyle: 'krøller', shirt: 0x5b8f4a, glasses: 'runde' },
      lines: ['Godaften alle 🌙', 'Har I set biografen? 🎬'],
    },
  ],
  pool: [
    {
      name: 'Sofie',
      look: { hair: 0xd9a35b, hairStyle: 'langt', shirt: 0xff8fb0, glasses: 'sol' },
      lines: ['Vandet er perfekt 🏊', 'Hvem tør hoppe? 😄'],
    },
    {
      name: 'Ali',
      look: { hair: 0x3b2416, hairStyle: 'kort', shirt: 0x2f6b8f, skin: 0x9a6343 },
      lines: ['Kom med til poolen 🏊', 'Fest på taget senere 🎉'],
    },
    {
      name: 'Mette',
      look: { hair: 0xb33a2a, hairStyle: 'krøller', shirt: 0xe0a93b },
      lines: ['Hej allesammen 👋', 'Jeg tager solbriller på 😎'],
    },
    {
      name: 'Jonas',
      look: { hair: 0x2a2a35, hairStyle: 'kasket', shirt: 0x5b8f4a, top: 'hoodie' },
      lines: ['Sneboldkamp i aften? ❄️', 'Haha 😂'],
    },
  ],
  arcade: [
    {
      name: 'Oskar',
      bot: true,
      look: { hair: 0x6a4428, hairStyle: 'kasket', shirt: 0x2f6b8f },
      lines: ['Start et spil på konsollen 🎮', 'Vinderne får mønter 🪙'],
    },
    {
      name: 'Freja',
      look: { hair: 0x2a2a35, hairStyle: 'hestehale', shirt: 0x6a4a8a, top: 'dunjakke' },
      lines: ['Farvekamp nu! 🎨', 'Jeg vinder den her 😤'],
    },
    {
      name: 'Mads',
      look: { hair: 0xd9a35b, hairStyle: 'kort', shirt: 0xc25a4a, glasses: 'runde' },
      lines: ['Godt spillet! 🏆', 'En gang til? 🔁'],
    },
  ],
  cinema: [
    {
      name: 'Ida',
      bot: true,
      look: { hair: 0x3b2416, hairStyle: 'hestehale', shirt: 0x7a2e2e },
      lines: ['Filmen starter om lidt 🍿', 'Sæt en video i kø 🎬'],
    },
    {
      name: 'Nanna',
      look: { hair: 0xb33a2a, hairStyle: 'langt', shirt: 0x2f6b8f, top: 'kjole' },
      lines: ['Popcorn, nogen? 🍿', 'Den her er sjov 😂'],
    },
    {
      name: 'Rasmus',
      look: { hair: 0x2a2a35, hairStyle: 'krøller', shirt: 0x5b8f4a },
      lines: ['Stem for at springe over ⏭️', 'Sid her ved siden af 👋'],
    },
  ],
};

const kidLines = Object.values(JUNIOR_PHRASES).flatMap((c) => c.lines);
const pick = (n: number) =>
  Array.from({ length: 3 }, (_, i) => kidLines[(n * 7 + i * 11) % kidLines.length]!);
const KIDS = (looks: Partial<Look>[], names: string[]): Guest[] =>
  looks.map((look, i) => ({ name: names[i]!, look, lines: pick(i + 1) }));
const JUNIOR: Guest[] = KIDS(
  [
    { hair: 0xd9a35b, hairStyle: 'krøller', shirt: 0x3f8f86, top: 'hoodie' },
    { hair: 0x2a2a35, hairStyle: 'hestehale', shirt: 0xff8fb0, top: 'kjole' },
    { hair: 0x6a4428, hairStyle: 'kasket', shirt: 0xe0a93b },
    { hair: 0xb33a2a, hairStyle: 'langt', shirt: 0x6a4a8a, glasses: 'runde' },
  ],
  ['Glad Odder 12', 'Sød Panda 33', 'Kvik Ræv 7', 'Modig Ugle 5'],
);

export function startScenes() {
  const els = document.querySelectorAll<HTMLElement>('.room-scene');
  if (!els.length) return;
  const gl = (() => {
    try {
      return !!document.createElement('canvas').getContext('webgl');
    } catch {
      return false;
    }
  })();
  if (!gl) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        const roomId = el.dataset.room ?? 'cafe';
        const guests = el.dataset.crowd === 'junior' ? JUNIOR : (ADULT[roomId] ?? ADULT.cafe!);
        startRoomScene(el, {
          roomId,
          guests,
          view: Number(el.dataset.view ?? 4),
          target: [0, 0.6, 0],
          shiftX: Number(el.dataset.shift ?? 0),
          talkEvery: 2.2,
        });
      }
    },
    { rootMargin: '200px 0px' },
  );
  els.forEach((el) => io.observe(el));
}

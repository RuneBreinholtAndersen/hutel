import {
  BADGES,
  BEARDS,
  CLOTHES,
  GLASSES,
  HAIR_STYLES,
  HATS,
  GENDERS,
  SHOES,
  ACCESSORIES,
  PALETTE,
  TOPS,
  type BadgeId,
  type Look,
} from '@hutel/shared';

export const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as E;
export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

let toastT: number | undefined;
/** Lobbi's own gold coin (the 🪙 emoji looks silver on some systems). */
export const COIN = '<i class="coin" aria-label="mønter"></i>';

/** Put text in an element safely, drawing every 🪙 as a gold coin. */
export function setCoinText(el: HTMLElement, text: string) {
  el.textContent = '';
  text.split('🪙').forEach((part, i) => {
    if (i) {
      const c = document.createElement('i');
      c.className = 'coin';
      c.setAttribute('aria-label', 'mønter');
      el.append(c);
    }
    el.append(part);
  });
}

export function toast(text: string, kind: 'info' | 'error' = 'info') {
  const el = $('toast');
  setCoinText(el, text);
  el.className = 'show' + (kind === 'error' ? ' error' : '');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (el.className = ''), 2600);
}

export function pop(text: string) {
  const d = document.createElement('div');
  d.className = 'pop';
  setCoinText(d, text);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1700);
}

export function logLine(parts: { name?: string; text: string; cls?: string }) {
  const d = document.createElement('div');
  if (parts.cls) d.className = parts.cls;
  if (parts.name) {
    const b = document.createElement('b');
    b.textContent = parts.name + ': ';
    d.appendChild(b);
  }
  d.appendChild(document.createTextNode(parts.text));
  const L = $('log');
  L.appendChild(d);
  while (L.children.length > 9) L.removeChild(L.firstChild!);
}

export function confetti() {
  const c = $<HTMLCanvasElement>('confetti');
  const g = c.getContext('2d')!;
  c.width = innerWidth;
  c.height = innerHeight;
  const cols = ['#ffb347', '#ff6b6b', '#4fd1c5', '#f9e07f', '#9f7aea', '#68d391', '#fff6ea'];
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const P = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + r(-60, 60),
    y: innerHeight * 0.45,
    vx: r(-9, 9),
    vy: r(-15, -5),
    a: r(0, 6.3),
    va: r(-0.3, 0.3),
    w: r(6, 11),
    h: r(4, 7),
    c: cols[Math.floor(Math.random() * cols.length)]!,
  }));
  const t0 = performance.now();
  const f = () => {
    const t = (performance.now() - t0) / 1000;
    g.clearRect(0, 0, c.width, c.height);
    for (const p of P) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2.2));
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t < 3.3) requestAnimationFrame(f);
    else g.clearRect(0, 0, c.width, c.height);
  };
  f();
}

const LABELS = {
  skin: 'Hud',
  hair: 'Hår',
  eyes: 'Øjne',
  shirt: 'Trøje',
  pants: 'Bukser',
  extra: 'Hat, sko og tilbehør',
} as const;
/** Lobbi Junior says "pige/dreng" instead of "kvinde/mand". */
export function useJuniorWords() {
  Object.assign(OPTS.gender.names, { kvinde: 'Pige', mand: 'Dreng' });
}
const OPTS = {
  gender: {
    label: 'Køn',
    vals: GENDERS,
    names: { kvinde: 'Kvinde', mand: 'Mand', andet: 'Vil ikke sige' } as Record<string, string>,
  },
  hairStyle: {
    label: 'Frisure',
    vals: HAIR_STYLES,
    names: {
      kort: 'Kort',
      krøller: 'Krøller',
      hestehale: 'Hestehale',
      langt: 'Langt',
      kasket: 'Kasket',
      skaldet: 'Skaldet',
    },
  },
  glasses: {
    label: 'Briller',
    vals: GLASSES,
    names: { ingen: 'Ingen', runde: 'Runde', sol: 'Solbriller' },
  },
  beard: {
    label: 'Skæg',
    vals: BEARDS,
    names: { ingen: 'Intet', stubbe: 'Stubbe', fuld: 'Fuldskæg' },
  },
} as const;

export interface Wardrobe {
  owned: readonly string[];
  badges: readonly string[];
  coins: number;
  /** Buy and then wear this piece ("slot:value"). */
  onBuy: (key: string) => void;
}

/** Chips for the clothing slots. Without a wardrobe (sign-up) only free clothes are shown. */
function clothesRows(look: Look, w?: Wardrobe) {
  const slots = [
    ['top', 'Overdel', TOPS, look.top ?? 'tshirt'],
    ['hat', 'Hat', HATS, look.hat ?? 'ingen'],
    ['shoes', 'Sko', SHOES, look.shoes ?? 'standard'],
    ['acc', 'Tilbehør', ACCESSORIES, look.acc ?? 'ingen'],
  ] as const;
  return slots
    .map(([slot, label, vals, cur]) => {
      const chips = (vals as readonly string[])
        .map((v) => {
          const key = `${slot}:${v}`;
          const c = CLOTHES[key]!;
          const owned = c.price === 0 || !!w?.owned.includes(key);
          if (!owned && !w) return '';
          const locked = !owned && c.unlock && !w!.badges.includes(c.unlock);
          const tag = owned ? '' : locked ? ' 🔒' : ` · ${c.price}🪙`;
          const title = locked ? `Kræver badget ${BADGES[c.unlock as BadgeId].name}` : c.name;
          return `<button type="button" data-cl="${key}" title="${esc(title)}" class="${cur === v ? 'on' : ''}${owned ? '' : ' buy'}" ${locked ? 'disabled' : ''}>${esc(c.name)}${tag}</button>`;
        })
        .join('');
      return `<div class="row"><label>${label}</label><div class="chips">${chips}</div></div>`;
    })
    .join('');
}

/** Renders swatches and chips for editing a look. */
export function lookEditor(
  el: HTMLElement,
  look: Look,
  onChange: (look: Look) => void,
  wardrobe?: Wardrobe,
) {
  const render = () => {
    el.innerHTML =
      clothesRows(look, wardrobe) +
      Object.entries(OPTS)
        .map(
          ([k, o]) =>
            `<div class="row"><label>${o.label}</label><div class="chips">${o.vals.map((v) => `<button type="button" data-k="${k}" data-v="${v}" class="${(look[k as keyof Look] ?? (k === 'gender' ? 'andet' : undefined)) === v ? 'on' : ''}">${(o.names as Record<string, string>)[v]}</button>`).join('')}</div></div>`,
        )
        .join('') +
      (Object.keys(LABELS) as (keyof typeof LABELS)[])
        .map(
          (k) =>
            `<div class="row"><label>${LABELS[k]}</label><div class="sw">${PALETTE[k].map((c) => `<i data-c="${k}" data-v="${c}" style="background:${hex(c)}" class="${look[k] === c ? 'sel' : ''}"></i>`).join('')}</div></div>`,
        )
        .join('');
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        look = { ...look, [b.dataset.k!]: b.dataset.v } as Look;
        render();
        onChange(look);
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-cl]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.cl!;
        const [slot, v] = key.split(':') as ['top' | 'hat' | 'shoes' | 'acc', string];
        const c = CLOTHES[key]!;
        if (c.price > 0 && !wardrobe?.owned.includes(key)) {
          if (!wardrobe) return;
          if (wardrobe.coins < c.price)
            return toast('Du har ikke mønter nok – klar en opgave 🙂', 'error');
          return wardrobe.onBuy(key);
        }
        look = { ...look, [slot]: v } as Look;
        render();
        onChange(look);
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-c]').forEach((b) =>
      b.addEventListener('click', () => {
        look = { ...look, [b.dataset.c!]: Number(b.dataset.v) } as Look;
        render();
        onChange(look);
      }),
    );
  };
  render();
}

/**
 * Small animated "how to play" films for the room games, drawn live on a 2D canvas in Hutel's
 * own isometric style. No video files: each film is a timeline of scenes with a caption.
 */
import type { RoomGameKind } from '@hutel/shared';

type Pt = [number, number];
interface Runner {
  color: string;
  team: 1 | 2;
  /** [time (s), x, z] waypoints */
  path: [number, number, number][];
}
interface Film {
  length: number;
  captions: [number, string][];
  /** Furniture that pops in at a given time. */
  props: { t: number; kind: 'console' | 'tile' | 'start' | 'goal'; at: Pt }[];
  runners: Runner[];
  countdown: number; // when "3" shows
  play: [number, number];
  /** Paint tiles in the runner's colour (Farvekamp). */
  paint?: boolean;
  end: { t: number; text: string };
  click?: { t: number; at: Pt };
}

const tiles: Pt[] = [];
for (let x = 1; x <= 4; x++) for (const z of [2, 3]) tiles.push([x, z]);

const FILMS: Record<RoomGameKind, Film> = {
  paint: {
    length: 17,
    captions: [
      [0, '1. Køb en 🕹️ spilkonsol og mindst 4 farvefelter i Butik → Spil'],
      [3, '2. Stil dem i rummet med 🔨 Byg – klik så på konsollen og tryk Start'],
      [5.2, '3. Alle i rummet deles i to hold: 🔴 Rød og 🔵 Blå'],
      [8, '4. Løb hen over felterne – de får dit holds farve (også dem, de andre har taget!)'],
      [
        14,
        '5. Når tiden er gået, tælles felterne: holdet med flest felter i sin farve vinder mønter 🪙',
      ],
    ],
    props: [
      { t: 0.6, kind: 'console', at: [5, 0] },
      ...tiles.map((at, i) => ({ t: 1 + i * 0.18, kind: 'tile' as const, at })),
    ],
    runners: [
      {
        color: '#e8574f',
        team: 1,
        path: [
          [0, 0, 1],
          [8, 0, 2],
          [9, 1, 2],
          [10, 2, 2],
          [11, 3, 2],
          [12, 3, 3],
          [13.4, 4, 3],
        ],
      },
      {
        color: '#4f8de8',
        team: 2,
        path: [
          [0, 5, 4],
          [8, 5, 3],
          [9, 4, 3],
          [10, 4, 2],
          [11.2, 3, 3],
          [12, 2, 3],
          [13, 1, 3],
          [13.6, 1, 2],
        ],
      },
    ],
    countdown: 5.2,
    play: [8, 14],
    paint: true,
    end: { t: 14, text: '' },
    click: { t: 3.6, at: [5, 0] },
  },
  race: {
    length: 14,
    captions: [
      [0, '1. Køb en 🕹️ spilkonsol, et 🏁 startfelt og et målfelt i Butik → Spil'],
      [3, '2. Alle der vil være med, stiller sig på startfeltet. Klik på konsollen → Start'],
      [5.2, '3. Vent på nedtællingen…'],
      [8, '4. Når der står "Løb!", gælder det om at nå målfeltet først'],
      [11.6, '5. Den første på målfeltet vinder mønter 🪙'],
    ],
    props: [
      { t: 0.6, kind: 'console', at: [5, 5] },
      { t: 1.2, kind: 'start', at: [0, 4] },
      { t: 1.8, kind: 'goal', at: [5, 0] },
    ],
    runners: [
      {
        color: '#e8574f',
        team: 1,
        path: [
          [0, 1, 5],
          [3.5, 0, 4],
          [8, 0, 4],
          [9, 1, 3],
          [10, 2, 2],
          [10.8, 4, 1],
          [11.6, 5, 0],
        ],
      },
      {
        color: '#4f8de8',
        team: 2,
        path: [
          [0, 2, 5],
          [4, 0.35, 4.35],
          [8.3, 0.35, 4.35],
          [9.6, 2, 4],
          [10.8, 3, 2],
          [12, 4, 1],
          [12.8, 4.6, 0.4],
        ],
      },
    ],
    countdown: 5.2,
    play: [8, 11.6],
    end: { t: 11.6, text: '🔴 Rød er først i mål!' },
    click: { t: 4.4, at: [5, 5] },
  },
};

const N = 6;
const TW = 64;
const TH = 32;

function pos(r: Runner, t: number): Pt {
  const p = r.path;
  if (t <= p[0]![0]) return [p[0]![1], p[0]![2]];
  for (let i = 1; i < p.length; i++) {
    const [t1, x1, z1] = p[i]!;
    const [t0, x0, z0] = p[i - 1]!;
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [x0 + (x1 - x0) * k, z0 + (z1 - z0) * k];
    }
  }
  const l = p[p.length - 1]!;
  return [l[1], l[2]];
}

/** Starts the film on the canvas. Returns a function that stops it. */
export function playTutorial(
  canvas: HTMLCanvasElement,
  kind: RoomGameKind,
  onCaption: (text: string, step: number, total: number) => void,
): { stop: () => void; toggle: () => boolean; restart: () => void } {
  const film = FILMS[kind];
  const W = 520;
  const H = 300;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.aspectRatio = `${W} / ${H}`;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const cx = W / 2;
  const cy = 58;
  const iso = (x: number, z: number): Pt => [cx + (x - z) * (TW / 2), cy + (x + z) * (TH / 2)];

  let start = performance.now();
  let pausedAt: number | null = null;
  let raf = 0;
  let lastCap = -1;

  const diamond = (x: number, z: number, fill: string, lift = 0, inset = 0) => {
    const [sx, sy] = iso(x, z);
    const w = TW / 2 - inset;
    const h = TH / 2 - inset / 2;
    const y = sy + TH / 2 - lift;
    g.beginPath();
    g.moveTo(sx, y - h);
    g.lineTo(sx + w, y);
    g.lineTo(sx, y + h);
    g.lineTo(sx - w, y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };

  const draw = (t: number) => {
    g.clearRect(0, 0, W, H);
    // floor + walls
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) diamond(x, z, (x + z) % 2 ? '#e9dcc4' : '#5f9a8c', 0, 1);
    const [lx, ly] = iso(0, 0);
    g.fillStyle = 'rgba(120,70,50,0.55)';
    g.fillRect(lx - 2, ly - 46, 4, 46);
    // tile paint states
    const paint = new Map<string, string>();
    if (film.paint && t >= film.play[0]) {
      for (const r of film.runners)
        for (let s = film.play[0]; s <= Math.min(t, film.play[1]); s += 0.05) {
          const [px, pz] = pos(r, s);
          const k = `${Math.round(px)},${Math.round(pz)}`;
          if (tiles.some(([x, z]) => `${x},${z}` === k)) paint.set(k, r.color);
        }
    }
    // props
    for (const p of film.props) {
      if (t < p.t) continue;
      const pop = Math.min(1, (t - p.t) / 0.3);
      const bounce = pop < 1 ? Math.sin(pop * Math.PI) * 6 : 0;
      const [x, z] = p.at;
      if (p.kind === 'tile') {
        diamond(x, z, paint.get(`${x},${z}`) ?? '#b9a6e0', 2 + bounce, 6);
      } else if (p.kind === 'start' || p.kind === 'goal') {
        diamond(x, z, p.kind === 'start' ? '#ffb347' : '#ffffff', 2 + bounce, 6);
        const [sx, sy] = iso(x, z);
        g.font = '18px sans-serif';
        g.textAlign = 'center';
        g.fillText(p.kind === 'start' ? 'START' : '🏁', sx, sy + TH / 2 + 6 - bounce);
      } else {
        const [sx, sy] = iso(x, z);
        const y = sy + TH / 2 - bounce;
        const glow = film.click && t > film.click.t && t < film.countdown + 3;
        g.fillStyle = '#2b2430';
        g.fillRect(sx - 12, y - 34, 24, 34);
        g.fillStyle = glow ? '#7df0c8' : '#5b6aa8';
        g.fillRect(sx - 10, y - 32, 20, 10);
      }
    }
    // runners (sorted back to front)
    const rs = film.runners
      .map((r) => ({ r, p: pos(r, t) }))
      .sort((a, b) => a.p[0] + a.p[1] - (b.p[0] + b.p[1]));
    for (const { r, p } of rs) {
      const [sx, sy] = iso(p[0], p[1]);
      const moving = t > 0.2 && pos(r, t - 0.1).some((v, i) => Math.abs(v - p[i]!) > 0.01);
      const bob = moving ? Math.abs(Math.sin(t * 12)) * 4 : 0;
      const y = sy + TH / 2 - bob;
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(sx, sy + TH / 2, 12, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = r.color;
      g.beginPath();
      g.roundRect(sx - 9, y - 30, 18, 24, 7);
      g.fill();
      g.fillStyle = '#f1c9a5';
      g.beginPath();
      g.arc(sx, y - 40, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(sx - 4, y - 41, 2, 0, Math.PI * 2);
      g.arc(sx + 4, y - 41, 2, 0, Math.PI * 2);
      g.fill();
      if (t >= film.countdown) {
        g.fillStyle = r.color;
        g.font = 'bold 11px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillText(r.team === 1 ? 'Rød' : 'Blå', sx, y - 56);
      }
    }
    // pointer click
    if (film.click && t > film.click.t - 0.8 && t < film.click.t + 0.6) {
      const [sx, sy] = iso(...film.click.at);
      const k = Math.min(1, (t - (film.click.t - 0.8)) / 0.8);
      const px = sx + 60 * (1 - k);
      const py = sy - 10 + 40 * (1 - k);
      g.font = '24px sans-serif';
      g.fillText('👆', px + 8, py + 18);
      if (t > film.click.t) {
        g.strokeStyle = '#ffb347';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(sx, sy, 10 + (t - film.click.t) * 40, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // HUD: countdown, score, end
    g.textAlign = 'center';
    if (t >= film.countdown && t < film.play[0] + 0.6) {
      const n = 3 - Math.floor(t - film.countdown);
      const txt = n > 0 ? String(n) : kind === 'race' ? 'Løb!' : 'Start!';
      g.font = 'bold 64px Fredoka, sans-serif';
      g.fillStyle = '#ffb347';
      g.strokeStyle = '#3a2418';
      g.lineWidth = 6;
      g.strokeText(txt, W / 2, H / 2 + 20);
      g.fillText(txt, W / 2, H / 2 + 20);
    }
    if (t >= film.play[0] && t < film.play[1]) {
      const left = Math.ceil((film.play[1] - t) * (kind === 'paint' ? 10 : 25));
      let txt = `⏱ ${left} sek`;
      if (film.paint) {
        const red = [...paint.values()].filter((c) => c === film.runners[0]!.color).length;
        txt += `   🔴 ${red}  ·  🔵 ${paint.size - red}`;
      }
      g.font = 'bold 15px Fredoka, sans-serif';
      g.fillStyle = 'rgba(40,24,16,0.8)';
      g.beginPath();
      g.roundRect(W / 2 - 110, 8, 220, 28, 10);
      g.fill();
      g.fillStyle = '#fff4e0';
      g.fillText(txt, W / 2, 27);
    }
    if (t >= film.end.t) {
      g.font = 'bold 26px Fredoka, sans-serif';
      g.fillStyle = 'rgba(40,24,16,0.85)';
      g.beginPath();
      g.roundRect(W / 2 - 150, H - 70, 300, 52, 14);
      g.fill();
      g.fillStyle = '#ffb347';
      let endText = film.end.text;
      if (film.paint) {
        // The winner is whoever really has the most tiles in the film – never hard-coded.
        const red = [...paint.values()].filter((c) => c === film.runners[0]!.color).length;
        const blue = paint.size - red;
        endText =
          red === blue
            ? `Uafgjort ${red}–${blue}`
            : red > blue
              ? `🔴 Rød vinder ${red}–${blue}!`
              : `🔵 Blå vinder ${blue}–${red}!`;
      }
      g.fillText(`${endText} +🪙`, W / 2, H - 35);
    }
    // progress bar
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(0, H - 4, W, 4);
    g.fillStyle = '#ffb347';
    g.fillRect(0, H - 4, (W * t) / film.length, 4);
  };

  const frame = () => {
    const now = pausedAt ?? performance.now();
    let t = (now - start) / 1000;
    if (t > film.length + 1.5) {
      start = performance.now();
      t = 0;
    }
    const tt = Math.min(t, film.length);
    let cap = 0;
    film.captions.forEach(([at], i) => tt >= at && (cap = i));
    if (cap !== lastCap) {
      lastCap = cap;
      onCaption(film.captions[cap]![1], cap + 1, film.captions.length);
    }
    draw(tt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    stop: () => cancelAnimationFrame(raf),
    toggle: () => {
      if (pausedAt === null) pausedAt = performance.now();
      else {
        start += performance.now() - pausedAt;
        pausedAt = null;
      }
      return pausedAt !== null;
    },
    restart: () => {
      start = performance.now();
      if (pausedAt !== null) pausedAt = start;
      lastCap = -1;
    },
  };
}

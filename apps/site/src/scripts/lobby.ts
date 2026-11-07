/**
 * The hero: Lobbi's real lobby, drawn with the game's own 3D code. A few guests and the
 * AI receptionist wander about and chat in speech bubbles that tell new visitors what Lobbi is.
 */
import {
  buildGrid,
  DEFAULT_LOOK,
  findPath,
  footprint,
  furniture,
  isWallItem,
  PUBLIC_ROOMS,
  type Look,
  type PlacedItem,
  type PlayerView,
} from '@hutel/shared';
import { Actor } from '@game/actors';
import { buildFurniture } from '@game/gfx/furniture';
import { createRoom } from '@game/gfx/room';
import { T, tw } from '@game/gfx/helpers';
import { miniStage } from './stage';

export interface Guest {
  name: string;
  bot?: boolean;
  look: Partial<Look>;
  /** Starting tile; a random free one when left out or blocked. */
  start?: [number, number];
  lines: string[];
}

const GUESTS: Guest[] = [
  {
    name: 'Ida',
    bot: true,
    look: { hair: 0x3b2416, hairStyle: 'hestehale', shirt: 0x7a2e2e, skin: 0xe8b896 },
    start: [3, 3],
    lines: [
      'Velkommen til Lobbi! 🛎️',
      'Jeg er AI-beboer – derfor 🤖 ved mit navn',
      'Caféen er lige derovre ☕',
    ],
  },
  {
    name: 'Sofie',
    look: {
      hair: 0xd9a35b,
      hairStyle: 'langt',
      shirt: 0x5b8f4a,
      top: 'kjole',
      extra: 0xff8fb0,
      hat: 'baret',
    },
    start: [6, 8],
    lines: ['Nogen med i biografen i aften? 🎬', 'Jeg har lige malet mit værelse mynte 💚'],
  },
  {
    name: 'Jonas',
    look: { hair: 0x2a2a35, hairStyle: 'kasket', shirt: 0x2f6b8f, glasses: 'sol', top: 'hoodie' },
    start: [9, 4],
    lines: ['Sneboldkamp om 5 min ❄️', 'Hvem vil bytte en lampe? 💡'],
  },
  {
    name: 'Mette',
    look: {
      hair: 0xb33a2a,
      hairStyle: 'krøller',
      shirt: 0xe0a93b,
      top: 'dunjakke',
      acc: 'halstoerklaede',
      extra: 0x2f6b8f,
    },
    start: [4, 9],
    lines: ['Hej allesammen 👋', 'Min hund har lært et nyt trick 🐶'],
  },
  {
    name: 'Ali',
    look: {
      hair: 0x3b2416,
      hairStyle: 'kort',
      beard: 'fuld',
      shirt: 0x2a2a35,
      top: 'jakke',
      skin: 0x9a6343,
    },
    start: [8, 9],
    lines: ['Kom og se mit nye værelse 🛋️', 'Lobbi FM spiller godt i dag 🎵'],
  },
];

export function startLobby(el: HTMLElement) {
  const wide = el.clientWidth > 860;
  startRoomScene(el, {
    roomId: 'lobby',
    guests: GUESTS,
    view: 6.2,
    target: [-0.2, 0.6, -0.2],
    shiftX: wide ? 0.17 : 0,
  });
}

export interface SceneOpts {
  roomId: string;
  guests: Guest[];
  /** Half the visible height in tiles – smaller is closer. */
  view: number;
  target?: [number, number, number];
  shiftX?: number;
  /** Seconds between speech bubbles. */
  talkEvery?: number;
}

/** One of the hotel's public rooms, drawn with the game's own code, with guests who walk and talk. */
export function startRoomScene(el: HTMLElement, opts: SceneOpts) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = miniStage(el, {
    view: opts.view,
    target: opts.target ?? [-0.2, 0.6, -0.2],
    shiftX: opts.shiftX ?? 0,
  });
  const lobby = PUBLIC_ROOMS.find((r) => r.id === opts.roomId)!;
  const size = typeof lobby.size === 'number' ? lobby.size : 12;
  const room = createRoom(stage.scene);
  room.setSize(size);
  room.setTheme(lobby.theme);
  const GUESTS = opts.guests;

  const items = new Map<number, PlacedItem>();
  for (const it of lobby.items) {
    items.set(it.id, it);
    const g = buildFurniture(
      it.type,
      it.id,
      it.color ?? 0,
      it.state ?? furniture(it.type).defaultState ?? 0,
    );
    if (isWallItem(it.type)) {
      const c = tw(it.x) + (furniture(it.type).w - 1) / 2;
      g.position.set(it.rot % 2 ? -size / 2 : c, 0, it.rot % 2 ? c : -size / 2);
      g.rotation.y = it.rot % 2 ? Math.PI / 2 : 0;
    } else {
      const f = footprint(it);
      g.position.set(tw(it.x) + (f.w - 1) / 2, 0, tw(it.z) + (f.d - 1) / 2);
      g.rotation.y = (it.rot * Math.PI) / 2;
    }
    stage.scene.add(g);
  }

  const overlay = document.createElement('div');
  overlay.className = 'scene-overlay';
  el.appendChild(overlay);
  const grid = buildGrid(size, [...items.values()]);
  const now = () => Date.now();

  // A free tile for guests without a fixed starting place.
  const taken = new Set<string>();
  const freeTile = (want?: [number, number]): [number, number] => {
    if (want && grid.cells[want[0]]?.[want[1]] === 0 && !taken.has(want.join())) {
      taken.add(want.join());
      return want;
    }
    for (let i = 0; i < 200; i++) {
      const t: [number, number] = [
        1 + Math.floor(Math.random() * (size - 2)),
        1 + Math.floor(Math.random() * (size - 2)),
      ];
      if (grid.cells[t[0]]?.[t[1]] === 0 && !taken.has(t.join())) {
        taken.add(t.join());
        return t;
      }
    }
    return [Math.floor(size / 2), Math.floor(size / 2)];
  };

  const actors = GUESTS.map((g, i) => {
    const [sx0, sz0] = freeTile(g.start);
    const view: PlayerView = {
      id: `g${i}`,
      name: g.name,
      look: { ...DEFAULT_LOOK, ...g.look } as Look,
      x: sx0,
      z: sz0,
      path: [],
      pathStart: now(),
      run: false,
      seatId: null,
      action: null,
      bot: !!g.bot,
    };
    const a = new Actor(view, stage.scene, overlay, false);
    return { a, g, next: now() + 1500 + i * 1700, line: 0 };
  });

  const bubbles: { el: HTMLDivElement; who: Actor; born: number }[] = [];
  function say(a: Actor, name: string, text: string) {
    for (const b of bubbles) if (b.who === a) b.el.remove();
    const el2 = document.createElement('div');
    el2.className = 'bubble';
    const b = document.createElement('b');
    b.textContent = name + ': ';
    el2.append(b, document.createTextNode(text));
    overlay.appendChild(el2);
    bubbles.push({ el: el2, who: a, born: performance.now() });
  }

  function wander(a: Actor) {
    const [sx, sz] = a.tile();
    for (let tries = 0; tries < 20; tries++) {
      const gx = 1 + Math.floor(Math.random() * (size - 2));
      const gz = 1 + Math.floor(Math.random() * (size - 2));
      if (grid.cells[gx]?.[gz] !== 0) continue;
      const path = findPath(grid, [sx, sz], [gx, gz], -1);
      if (path && path.length > 1 && path.length < 9) {
        a.setPath([sx, sz], path as [number, number][], now(), false, null);
        return;
      }
    }
  }

  let speaker = 0;
  let nextLine = now() + 900;
  const clock = new T.Clock();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting)).observe(el);

  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = now();
    if (!reduce) {
      for (const s of actors)
        if (t > s.next) {
          s.next = t + 4000 + Math.random() * 5000;
          if (Math.random() < 0.75) wander(s.a);
          else s.a.setAction('wave');
        }
      if (t > nextLine) {
        const s = actors[speaker % actors.length]!;
        say(s.a, (s.g.bot ? '🤖 ' : '') + s.g.name, s.g.lines[s.line % s.g.lines.length]!);
        s.line++;
        speaker++;
        nextLine = t + (opts.talkEvery ?? 2.6) * 1000;
      }
    }
    room.update(dt, t / 1000);
    for (const s of actors) {
      s.a.update(dt, t, items);
      const [x, y] = stage.project(s.a.obj, 1.5);
      s.a.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
    const pt = performance.now();
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]!;
      const age = (pt - b.born) / 1000;
      if (age > 6) {
        b.el.remove();
        bubbles.splice(i, 1);
        continue;
      }
      const [x, y] = stage.project(b.who.obj, 1.5);
      b.el.style.transform = `translate(${x}px,${y - 26 - age * 4}px) translate(-50%,-100%)`;
      b.el.style.opacity = String(age > 4.8 ? Math.max(0, (6 - age) / 1.2) : 1);
    }
    stage.render();
  }
  loop();
}

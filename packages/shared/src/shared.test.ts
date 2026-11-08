import { describe, expect, it } from 'vitest';
import {
  APARTMENT_START_ITEMS,
  scheduledEvents,
  dailyQuestsFor,
  danishDate,
  WALK_SPEED,
  buildGrid,
  canPlace,
  ClientMsgSchema,
  DEFAULT_HOME_ITEMS,
  DEFAULT_LOOK,
  filterChat,
  footprint,
  isGreeting,
  isValidName,
  LookSchema,
  positionAt,
  PUBLIC_ROOMS,
  sanitizeChat,
  ROOM_SIZE,
  DOOR_TILE,
  findPath,
  MELODIES,
  MELODY_STEPS,
  noteFreq,
  steps,
  SHOP_CATEGORIES,
  FURNITURE_TYPES,
  furniture,
  doorSlots,
  doorSpot,
  canStep,
  MIN_USER_ROOM_SIZE,
  MAX_USER_ROOM_SIZE,
  ROOM_SHAPE_IDS,
  isFloorTile,
  floorTileCount,
  leftWallLength,
  renovationPrice,
  petLevel,
  type PlacedItem,
  activeDrop,
  canTrade,
  LIMITED_DROPS,
  betaStats,
} from './index';

describe('placement', () => {
  it('swaps footprint when rotated', () => {
    expect(footprint({ type: 'sofa', rot: 0 })).toEqual({ w: 2, d: 1 });
    expect(footprint({ type: 'sofa', rot: 1 })).toEqual({ w: 1, d: 2 });
  });
  it('lets rugs sit under furniture but not furniture on furniture', () => {
    const items = [
      { id: 1, type: 'rug' as const, x: 0, z: 0, rot: 0 },
      { id: 2, type: 'table' as const, x: 0, z: 0, rot: 0 },
    ];
    expect(canPlace(8, items, { id: 3, type: 'plant', x: 0, z: 0, rot: 0 })).toBe(false);
    expect(canPlace(8, items, { id: 3, type: 'plant', x: 1, z: 1, rot: 0 })).toBe(true);
    expect(canPlace(8, items, { id: 3, type: 'rug', x: 1, z: 1, rot: 0 })).toBe(false);
  });
  it('rejects out of bounds and tiles with avatars', () => {
    expect(canPlace(8, [], { id: 1, type: 'sofa', x: 7, z: 0, rot: 0 })).toBe(false);
    expect(canPlace(8, [], { id: 1, type: 'plant', x: 3, z: 3, rot: 0 }, [[3, 3]])).toBe(false);
  });
  it('keeps every predefined room valid and the door tile free', () => {
    const rooms: { n: number; items: PlacedItem[] }[] = [
      ...PUBLIC_ROOMS.map((r) => ({ n: r.size ?? ROOM_SIZE, items: r.items })),
      { n: ROOM_SIZE, items: DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 })) },
      ...Object.values(APARTMENT_START_ITEMS).map((list) => ({
        n: ROOM_SIZE,
        items: list.map((it, i) => ({ ...it, id: i + 1 })),
      })),
    ];
    for (const { n, items } of rooms) {
      for (const it of items) expect(canPlace(n, items, it)).toBe(true);
      expect(buildGrid(n, items).cells[DOOR_TILE[0]]![DOOR_TILE[1]]).toBe(0);
    }
  });

  it('lets you reach every free tile of every room from the door', () => {
    const all = [
      ...PUBLIC_ROOMS.map((r) => ({ id: r.id, n: r.size ?? ROOM_SIZE, items: r.items })),
      {
        id: 'home',
        n: ROOM_SIZE,
        items: DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 })),
      },
      ...Object.entries(APARTMENT_START_ITEMS).map(([id, list]) => ({
        id,
        n: ROOM_SIZE,
        items: list.map((it, i) => ({ ...it, id: i + 1 })),
      })),
    ];
    for (const r of all) {
      const n = r.n;
      const g = buildGrid(n, r.items);
      for (let x = 0; x < n; x++)
        for (let z = 0; z < n; z++)
          if (g.cells[x]![z] === 0)
            expect(
              findPath(g, [DOOR_TILE[0], DOOR_TILE[1]], [x, z]),
              `${r.id} ${x},${z}`,
            ).not.toBeNull();
    }
  });
});

describe('floor plans', () => {
  it('keeps the door on the floor and every tile reachable in every size and shape', () => {
    for (let n = MIN_USER_ROOM_SIZE; n <= MAX_USER_ROOM_SIZE; n++)
      for (const shape of ROOM_SHAPE_IDS) {
        const f = { size: n, shape };
        expect(isFloorTile(f, DOOR_TILE[0], DOOR_TILE[1]), `${shape} ${n}`).toBe(true);
        const g = buildGrid(f, []);
        let free = 0;
        for (let x = 0; x < n; x++)
          for (let z = 0; z < n; z++)
            if (g.cells[x]![z] === 0) {
              free++;
              expect(
                findPath(g, [DOOR_TILE[0], DOOR_TILE[1]], [x, z]),
                `${shape} ${n} ${x},${z}`,
              ).not.toBeNull();
            }
        expect(free).toBe(floorTileCount(f));
        // Holes are never mistaken for a seat.
        let hole: [number, number] | null = null;
        for (let x = 0; x < n && !hole; x++)
          for (let z = 0; z < n && !hole; z++) if (!isFloorTile(f, x, z)) hole = [x, z];
        if (shape !== 'square') expect(hole).not.toBeNull();
        if (hole) expect(findPath(g, [DOOR_TILE[0], DOOR_TILE[1]], hole, -1)).toBeNull();
      }
  });
  it('blocks furniture on holes and wall items beyond a short left wall', () => {
    const f = { size: 8, shape: 'J' as const };
    expect(canPlace(f, [], { id: 1, type: 'plant', x: 0, z: 7, rot: 0 })).toBe(false);
    expect(canPlace(f, [], { id: 1, type: 'plant', x: 7, z: 7, rot: 0 })).toBe(true);
    expect(leftWallLength(f)).toBe(4);
    expect(canPlace(f, [], { id: 1, type: 'painting', x: 5, z: 0, rot: 1 })).toBe(false);
    expect(renovationPrice(8, 10)).toBe(80);
    expect(renovationPrice(10, 9)).toBe(0);
  });
});

describe('stairs and platforms', () => {
  it('walks one step up or down at a time and keeps furniture level', () => {
    // A staircase 1-2-3 along x on row z=3, and a tall block at (5,5).
    const f = { size: 8, heights: { '1,3': 1, '2,3': 2, '3,3': 3, '5,5': 3 } };
    const g = buildGrid(f, []);
    expect(canStep(g, 0, 3, 1, 3)).toBe(true);
    expect(canStep(g, 0, 3, 2, 3)).toBe(false);
    const path = findPath(g, [0, 3], [3, 3])!;
    expect(path.map(([x]) => x)).toEqual([1, 2, 3]);
    // The 3-high block can't be climbed from the floor.
    expect(findPath(g, [5, 4], [5, 5])).toBeNull();
    // A sofa (2 wide) can't stand half on a step.
    expect(canPlace(f, [], { id: 1, type: 'sofa', x: 0, z: 3, rot: 0 })).toBe(false);
    expect(canPlace(f, [], { id: 1, type: 'plant', x: 3, z: 3, rot: 0 })).toBe(true);
  });
});

describe('apartment doors', () => {
  it('finds door places that are reachable and never on the main door or the window', () => {
    for (const theme of ['home', 'bedroom', 'bathroom', 'kitchen', 'balcony'] as const) {
      const items =
        theme === 'home'
          ? DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 }))
          : APARTMENT_START_ITEMS[theme].map((it, i) => ({ ...it, id: i + 1 }));
      const slots = doorSlots(theme, 8);
      expect(slots.length).toBeGreaterThanOrEqual(4);
      const g = buildGrid(8, items);
      for (const d of slots) {
        const [x, z] = doorSpot(d);
        expect(d.wall === 0 && Math.abs(d.idx - DOOR_TILE[0]) <= 1, theme).toBe(false);
        // You can get to the door or right next to it, even with the starter furniture.
        const near = [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => [x + a, z + b] as const));
        expect(
          near.some(([nx, nz]) => findPath(g, [DOOR_TILE[0], DOOR_TILE[1]], [nx, nz])),
          `${theme} ${x},${z}`,
        ).toBe(true);
      }
    }
  });
});

describe('shop categories', () => {
  it('puts every shop item in exactly one category', () => {
    const shop = FURNITURE_TYPES.filter((t) => !furniture(t).noShop);
    for (const t of shop)
      expect(
        SHOP_CATEGORIES.filter((c) => (c.types as readonly string[]).includes(t)).length,
        t,
      ).toBe(1);
    for (const c of SHOP_CATEGORIES)
      for (const t of c.types) expect(furniture(t).noShop ?? false, t).toBe(false);
  });
});

describe('music', () => {
  it('has tunes of exactly 32 steps with valid notes', () => {
    for (const [id, m] of Object.entries(MELODIES)) {
      for (const part of [m.lead, m.bass, m.drums])
        expect(steps(part).length, id).toBe(MELODY_STEPS);
      for (const t of [...steps(m.lead), ...steps(m.bass)])
        if (t !== '-') expect(noteFreq(t), `${id} ${t}`).not.toBeNull();
      for (const t of steps(m.drums)) expect('kshx-'.includes(t), `${id} ${t}`).toBe(true);
    }
    expect(noteFreq('A4')).toBeCloseTo(440);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
  });
});

describe('pets', () => {
  it('levels up with XP', () => {
    expect(petLevel(0)).toBe(1);
    expect(petLevel(9)).toBe(1);
    expect(petLevel(10)).toBe(2);
    expect(petLevel(40)).toBe(3);
    expect(petLevel(1e6)).toBe(10);
  });
});

describe('wall items', () => {
  it('hang on the back or left wall, never over the door or on each other', () => {
    const pic = (id: number, x: number, rot: number, type: PlacedItem['type'] = 'painting') => ({
      id,
      type,
      x,
      z: 0,
      rot,
    });
    expect(canPlace(8, [], pic(1, 2, 0))).toBe(true);
    expect(canPlace(8, [], pic(1, 2, 1))).toBe(true);
    expect(canPlace(8, [], pic(1, DOOR_TILE[0], 0))).toBe(false); // the door
    expect(canPlace(8, [], pic(1, DOOR_TILE[0], 1))).toBe(true); // left wall is fine
    expect(canPlace(8, [], pic(1, 7, 0, 'window'))).toBe(false); // 2 wide, sticks out
    expect(canPlace(8, [], pic(1, 2, 2))).toBe(false);
    expect(canPlace(8, [pic(2, 3, 0, 'window')], pic(1, 2, 0, 'window'))).toBe(false);
    expect(canPlace(8, [pic(2, 3, 1, 'window')], pic(1, 2, 0, 'window'))).toBe(true);
    // A picture does not block the floor or collide with a sofa below it.
    const sofa: PlacedItem = { id: 3, type: 'sofa', x: 2, z: 0, rot: 0 };
    expect(canPlace(8, [sofa], pic(1, 2, 0))).toBe(true);
    expect(canPlace(8, [pic(1, 2, 0)], sofa)).toBe(true);
    expect(buildGrid(8, [pic(1, 2, 0)]).cells[2]![0]).toBe(0);
    // Not over a theme's built-in window.
    expect(canPlace(8, [], pic(1, 2, 1), [], { left: [1, 2, 3] })).toBe(false);
    expect(canPlace(8, [], pic(1, 5, 1), [], { left: [1, 2, 3] })).toBe(true);
  });
});

describe('chat', () => {
  it('sanitizes and caps', () => {
    expect(sanitizeChat('  hej\n\u0000  med   dig ')).toBe('hej med dig');
    expect(sanitizeChat('x'.repeat(500)).length).toBe(120);
  });
  it('masks blocked words but not substrings', () => {
    expect(filterChat('det er fuck')).toBe('det er ****');
    expect(filterChat('Negeren')).toBe('Negeren');
  });
  it('detects greetings', () => {
    expect(isGreeting('Hej Magnus!')).toBe(true);
    expect(isGreeting('Thejsen')).toBe(false);
  });
  it('validates names', () => {
    expect(isValidName('Rune')).toBe(true);
    expect(isValidName('R')).toBe(false);
    expect(isValidName('<script>')).toBe(false);
  });
});

describe('protocol', () => {
  it('accepts valid and rejects unknown messages', () => {
    expect(ClientMsgSchema.safeParse({ t: 'move', x: 2, z: 3 }).success).toBe(true);
    expect(ClientMsgSchema.safeParse({ t: 'give_me_coins', amount: 1e9 }).success).toBe(false);
    expect(ClientMsgSchema.safeParse({ t: 'move', x: -1, z: 3 }).success).toBe(false);
  });
  it('validates looks against the palette', () => {
    expect(LookSchema.safeParse(DEFAULT_LOOK).success).toBe(true);
    expect(LookSchema.safeParse({ ...DEFAULT_LOOK, skin: 0x123456 }).success).toBe(false);
  });
});

describe('movement', () => {
  it('interpolates along a path', () => {
    const p = positionAt(
      [0, 0],
      [
        [1, 0],
        [2, 0],
      ],
      0,
      false,
      1000 / WALK_SPEED,
    );
    expect(p.x).toBeCloseTo(1);
    expect(positionAt([0, 0], [[1, 0]], 0, false, 10_000).done).toBe(true);
  });
});

describe('daily quests', () => {
  it('always has log-in plus two different quests that change by date', () => {
    const a = dailyQuestsFor('2026-11-06');
    expect(a[0]).toBe('d_login');
    expect(new Set(a).size).toBe(3);
    const days = new Set(
      Array.from({ length: 10 }, (_, i) => dailyQuestsFor(`2026-11-${10 + i}`).join()),
    );
    expect(days.size).toBeGreaterThan(3);
    expect(danishDate(Date.UTC(2026, 10, 6, 23, 30))).toBe('2026-11-07'); // past midnight in DK
  });
});

describe('events', () => {
  it('finds the Friday party in Danish time', () => {
    const fri20 = Date.UTC(2026, 10, 6, 19, 0); // 20:00 in Copenhagen
    const ev = scheduledEvents(fri20);
    expect(ev.map((e) => e.id)).toEqual(['fredagsfest']);
    expect(ev[0]!.until).toBe(Date.UTC(2026, 10, 6, 22, 0));
    expect(scheduledEvents(Date.UTC(2026, 10, 6, 12, 0))).toEqual([]);
  });
});

describe('limited editions', () => {
  const drops = [
    {
      type: 'nordlyslampe' as const,
      total: 5,
      from: '2026-11-07T00:00:00+01:00',
      to: '2026-11-22T00:00:00+01:00',
    },
  ];
  it('is only on sale inside its window', () => {
    expect(activeDrop('nordlyslampe', Date.parse('2026-11-10T12:00:00Z'), drops)).toBeTruthy();
    expect(activeDrop('nordlyslampe', Date.parse('2026-11-06T12:00:00Z'), drops)).toBeUndefined();
    expect(
      activeDrop('nordlyslampe', Date.parse('2026-11-22T00:00:00+01:00'), drops),
    ).toBeUndefined();
  });
  it('lets rares and limited editions be traded, but not fixtures', () => {
    expect(canTrade('nordlyslampe')).toBe(true);
    expect(canTrade('guldand')).toBe(true);
    expect(canTrade('pool')).toBe(false);
    expect(canTrade('sofa')).toBe(true);
  });
  it('every drop is for a limited item', () => {
    for (const d of LIMITED_DROPS) expect(furniture(d.type).limited, d.type).toBe(true);
  });
});

describe('beta stats', () => {
  const day = (d: string) => `${d}T10:00:00Z`;
  it('counts active and new players per day', () => {
    const s = betaStats(
      [
        { createdAt: day('2026-11-07'), days: ['2026-11-07', '2026-11-08'] },
        { createdAt: day('2026-11-08'), days: ['2026-11-08'] },
      ],
      '2026-11-08',
      3,
    );
    expect(s.daily).toEqual([
      { date: '2026-11-06', active: 0, new: 0 },
      { date: '2026-11-07', active: 1, new: 1 },
      { date: '2026-11-08', active: 2, new: 1 },
    ]);
  });
  it('measures who comes back the next day and within the week', () => {
    const s = betaStats(
      [
        // Came back the next day.
        { createdAt: day('2026-10-25'), days: ['2026-10-25', '2026-10-26'] },
        // Came back on day 5.
        { createdAt: day('2026-10-25'), days: ['2026-10-25', '2026-10-30'] },
        // Never came back.
        { createdAt: day('2026-10-25'), days: ['2026-10-25'] },
        // Too new to count.
        { createdAt: day('2026-11-08'), days: ['2026-11-08'] },
      ],
      '2026-11-08',
    );
    expect(s.nextDay).toEqual({ of: 3, came: 1 });
    expect(s.week).toEqual({ of: 3, came: 2 });
  });
});

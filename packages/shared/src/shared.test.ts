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
  type PlacedItem,
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

  it('lets you reach every free tile of the big public rooms from the door', () => {
    for (const r of PUBLIC_ROOMS.filter((x) => (x.size ?? ROOM_SIZE) > ROOM_SIZE)) {
      const n = r.size!;
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

import { describe, expect, it } from 'vitest';
import {
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
    const rooms = [
      ...PUBLIC_ROOMS.map((r) => r.items),
      DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 })),
    ];
    for (const items of rooms) {
      for (const it of items) expect(canPlace(ROOM_SIZE, items, it)).toBe(true);
      expect(buildGrid(ROOM_SIZE, items).cells[DOOR_TILE[0]]![DOOR_TILE[1]]).toBe(0);
    }
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

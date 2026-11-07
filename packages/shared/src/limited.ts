/**
 * Limited editions: furniture that is only sold for a short while and/or in a fixed number.
 * Every copy gets a serial number (#1, #2 …) that follows it through trades and the market.
 * Add a new drop here with its dates; the shop shows it while it runs.
 */
import type { FurnitureType } from './catalog';

export interface LimitedDrop {
  type: FurnitureType;
  /** How many copies exist at most. */
  total: number;
  /** ISO times (Danish time): on sale from `from` until `to`. */
  from: string;
  to: string;
}

export const LIMITED_DROPS: LimitedDrop[] = [
  {
    type: 'nordlyslampe',
    total: 100,
    from: '2026-11-07T00:00:00+01:00',
    to: '2026-11-22T00:00:00+01:00',
  },
];

/** What the shop needs to show a running drop. */
export interface LimitedView {
  type: FurnitureType;
  total: number;
  sold: number;
  /** ms epoch */
  to: number;
}

/** The drop for this item that is on sale right now, if any. */
export function activeDrop(
  type: FurnitureType,
  now = Date.now(),
  drops: readonly LimitedDrop[] = LIMITED_DROPS,
): LimitedDrop | undefined {
  return drops.find((d) => d.type === type && Date.parse(d.from) <= now && now < Date.parse(d.to));
}

export function activeDrops(
  now = Date.now(),
  drops: readonly LimitedDrop[] = LIMITED_DROPS,
): LimitedDrop[] {
  return drops.filter((d) => Date.parse(d.from) <= now && now < Date.parse(d.to));
}

/** "#7 af 100" style label for a numbered item. */
export function serialLabel(serial: number, total?: number) {
  return total ? `#${serial} af ${total}` : `#${serial}`;
}

/** Total copies of a limited item (sum of its drops), for labels. */
export function limitedTotal(type: FurnitureType): number | undefined {
  const sum = LIMITED_DROPS.filter((d) => d.type === type).reduce((n, d) => n + d.total, 0);
  return sum || undefined;
}

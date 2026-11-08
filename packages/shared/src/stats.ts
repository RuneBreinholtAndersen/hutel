/**
 * Beta numbers for the admin panel: how many play each day, and – the important one – how many
 * come back after their first day. Based on the Danish dates each player was online.
 */
import { danishDate } from './progress';

export interface StatUser {
  createdAt: string;
  /** Danish dates the player was online, oldest first. */
  days?: string[];
}

export interface DayStat {
  date: string;
  active: number;
  new: number;
}

export interface Retention {
  /** Players in the group (signed up long enough ago to count). */
  of: number;
  came: number;
}

export interface BetaStats {
  daily: DayStat[];
  /** Came back the day after they signed up (signed up 2–30 days ago). */
  nextDay: Retention;
  /** Came back at least once within the first week (signed up 8–30 days ago). */
  week: Retention;
}

/** "2026-11-08" + n days, as a Danish date. */
export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function betaStats(users: StatUser[], today = danishDate(), days = 14): BetaStats {
  const daily: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    daily.push({
      date,
      active: users.filter((u) => u.days?.includes(date)).length,
      new: users.filter((u) => danishDate(Date.parse(u.createdAt)) === date).length,
    });
  }
  const nextDay: Retention = { of: 0, came: 0 };
  const week: Retention = { of: 0, came: 0 };
  for (const u of users) {
    const start = danishDate(Date.parse(u.createdAt));
    const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000;
    if (age > 30) continue;
    const seen = new Set(u.days ?? []);
    if (age >= 2) {
      nextDay.of++;
      if (seen.has(addDays(start, 1))) nextDay.came++;
    }
    if (age >= 8) {
      week.of++;
      if ([1, 2, 3, 4, 5, 6, 7].some((n) => seen.has(addDays(start, n)))) week.came++;
    }
  }
  return { daily, nextDay, week };
}

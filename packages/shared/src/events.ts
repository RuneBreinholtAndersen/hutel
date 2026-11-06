import type { BadgeId } from './progress';

/** Weekly events (Danish time). While one runs, guests in its room earn double coins. */
export interface EventDef {
  id: string;
  name: string;
  roomId: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  start: number;
  end: number;
  /** Given after 5 minutes at the event. */
  badge: BadgeId;
}

export const EVENTS: EventDef[] = [
  {
    id: 'fredagsfest',
    name: 'Fredagsfest i caféen',
    roomId: 'cafe',
    weekday: 5,
    start: 19,
    end: 23,
    badge: 'festabe',
  },
  {
    id: 'stjerneaften',
    name: 'Stjerneaften på taget',
    roomId: 'roof',
    weekday: 3,
    start: 20,
    end: 22,
    badge: 'stjernekigger',
  },
  {
    id: 'poolparty',
    name: 'Poolparty',
    roomId: 'pool',
    weekday: 6,
    start: 14,
    end: 17,
    badge: 'poolhaj',
  },
  {
    id: 'quizsoendag',
    name: 'Søndagsquiz i spillehallen',
    roomId: 'arcade',
    weekday: 0,
    start: 19,
    end: 21,
    badge: 'quizhjerne',
  },
];

export const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

export interface ActiveEvent {
  id: string;
  name: string;
  roomId: string;
  /** Epoch ms when it ends. */
  until: number;
}

/** Weekday and hour in Denmark. */
export function danishClock(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday, hour: Number(get('hour')), minute: Number(get('minute')) };
}

/** Scheduled events running right now. */
export function scheduledEvents(now = Date.now()): ActiveEvent[] {
  const c = danishClock(now);
  return EVENTS.filter((e) => e.weekday === c.weekday && c.hour >= e.start && c.hour < e.end).map(
    (e) => ({
      id: e.id,
      name: e.name,
      roomId: e.roomId,
      until: now + ((e.end - c.hour) * 60 - c.minute) * 60_000,
    }),
  );
}

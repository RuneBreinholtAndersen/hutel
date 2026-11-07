/**
 * All of Hutel's sound is made in code with Web Audio – no sound files, nothing copied.
 * Sound effects are short synth blips; jukebox tunes are played by a tiny step sequencer that
 * is locked to the server clock, so everyone in a room hears the same beat at the same time.
 */
import { MELODIES, MELODY_STEPS, noteFreq, steps, type MelodyId } from '@hutel/shared';

export interface AudioSettings {
  /** 0..1 */
  volume: number;
  /** Everything off (the speaker button top right). */
  muted: boolean;
  sfx: boolean;
  music: boolean;
}

const KEY = 'hutel-audio';
const DEFAULTS: AudioSettings = { volume: 0.7, muted: false, sfx: true, music: true };

function load(): AudioSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: AudioSettings = load();

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;
/** The server's clock (set by main once the connection exists). */
let serverNow = () => Date.now();
export function setClock(fn: () => number) {
  serverNow = fn;
}

function applySettings() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 0.8 : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? 0.5 : 0, t, 0.05);
}

export function saveSettings(patch: Partial<AudioSettings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode – fine */
  }
  applySettings();
}

/** Browsers only allow sound after a click or key press. */
function unlock() {
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applySettings();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

/* ---------------- building blocks ---------------- */

function tone(
  out: AudioNode,
  freq: number,
  at: number,
  dur: number,
  opts: { wave?: OscillatorType; vol?: number; slideTo?: number; attack?: number } = {},
) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.wave ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, at + dur);
  const v = opts.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noise(out: AudioNode, at: number, dur: number, vol: number, hp = 1000) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(out);
  s.start(at);
  s.stop(at + dur + 0.05);
}

/* ---------------- sound effects ---------------- */

export type Sfx =
  | 'click'
  | 'open'
  | 'door'
  | 'teleport'
  | 'coin'
  | 'spend'
  | 'chat'
  | 'whisper'
  | 'badge'
  | 'quest'
  | 'tick'
  | 'go'
  | 'win'
  | 'error'
  | 'place'
  | 'woof'
  | 'meow'
  | 'roar'
  | 'whoosh'
  | 'splat';

const lastSfx = new Map<Sfx, number>();

export function sfx(name: Sfx) {
  if (!ctx || settings.muted || !settings.sfx || ctx.state !== 'running') return;
  // Avoid machine-gun repeats (many coins at once etc.).
  const nowMs = performance.now();
  if (nowMs - (lastSfx.get(name) ?? 0) < 60) return;
  lastSfx.set(name, nowMs);
  const t = ctx.currentTime + 0.01;
  const o = sfxBus;
  switch (name) {
    case 'click':
      return tone(o, 900, t, 0.05, { wave: 'triangle', vol: 0.12 });
    case 'open':
      tone(o, 520, t, 0.08, { wave: 'triangle', vol: 0.12 });
      return tone(o, 780, t + 0.05, 0.1, { wave: 'triangle', vol: 0.1 });
    case 'door':
      // A soft, friendly "ding-dong": two gentle sine notes with a slow fade.
      tone(o, 784, t, 0.7, { wave: 'sine', vol: 0.09, attack: 0.03 });
      tone(o, 1568, t, 0.35, { wave: 'sine', vol: 0.02, attack: 0.03 });
      tone(o, 587, t + 0.22, 0.9, { wave: 'sine', vol: 0.08, attack: 0.04 });
      return;
    case 'teleport':
      tone(o, 300, t, 0.45, { wave: 'sawtooth', vol: 0.08, slideTo: 1800 });
      return tone(o, 600, t + 0.05, 0.4, { wave: 'sine', vol: 0.15, slideTo: 2400 });
    case 'coin':
      tone(o, 988, t, 0.08, { wave: 'square', vol: 0.08 });
      return tone(o, 1319, t + 0.07, 0.25, { wave: 'square', vol: 0.08 });
    case 'spend':
      tone(o, 660, t, 0.08, { wave: 'triangle', vol: 0.15 });
      return tone(o, 440, t + 0.07, 0.18, { wave: 'triangle', vol: 0.15 });
    case 'chat':
      return tone(o, 700, t, 0.07, { wave: 'sine', vol: 0.12, slideTo: 1000 });
    case 'whisper':
      tone(o, 1200, t, 0.1, { wave: 'sine', vol: 0.08 });
      return tone(o, 900, t + 0.09, 0.12, { wave: 'sine', vol: 0.08 });
    case 'badge':
    case 'quest': {
      const notes = name === 'badge' ? [523, 659, 784, 1047] : [659, 784, 988];
      notes.forEach((f, i) => tone(o, f, t + i * 0.09, 0.22, { wave: 'triangle', vol: 0.15 }));
      return;
    }
    case 'tick':
      return tone(o, 880, t, 0.08, { wave: 'square', vol: 0.07 });
    case 'go':
      return tone(o, 1320, t, 0.35, { wave: 'square', vol: 0.09 });
    case 'win':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
        tone(o, f, t + i * 0.11, 0.25, { wave: 'square', vol: 0.07 }),
      );
      return;
    case 'error':
      return tone(o, 220, t, 0.2, { wave: 'sawtooth', vol: 0.08, slideTo: 160 });
    case 'place':
      noise(o, t, 0.06, 0.1, 2000);
      return tone(o, 260, t, 0.1, { wave: 'sine', vol: 0.2, slideTo: 140 });
    case 'woof':
      tone(o, 320, t, 0.12, { wave: 'sawtooth', vol: 0.12, slideTo: 180 });
      return tone(o, 300, t + 0.18, 0.12, { wave: 'sawtooth', vol: 0.12, slideTo: 170 });
    case 'meow':
      return tone(o, 600, t, 0.4, { wave: 'triangle', vol: 0.12, slideTo: 900, attack: 0.1 });
    case 'whoosh':
      return noise(o, t, 0.25, 0.08, 2500);
    case 'splat':
      noise(o, t, 0.18, 0.2, 600);
      return tone(o, 300, t, 0.12, { wave: 'sine', vol: 0.12, slideTo: 120 });
    case 'roar':
      noise(o, t, 0.5, 0.12, 200);
      return tone(o, 110, t, 0.5, { wave: 'sawtooth', vol: 0.15, slideTo: 70 });
  }
}

/* ---------------- jukebox sequencer ---------------- */

interface Player {
  song: MelodyId;
  songAt: number;
  gain: GainNode;
  /** Next step (counted from songAt) that still has to be scheduled. */
  next: number;
  lead: string[];
  bass: string[];
  drums: string[];
}

const players = new Map<number, Player>();
const LOOKAHEAD = 0.15; // seconds

/** Start, change or stop (song = undefined) the tune on one jukebox. */
export function setJukebox(itemId: number, song: string | undefined, songAt: number | undefined) {
  pending.delete(itemId);
  const cur = players.get(itemId);
  if (cur && cur.song === song && cur.songAt === songAt) return;
  if (cur) stopPlayer(itemId);
  if (!song || songAt === undefined || !(song in MELODIES) || !ctx) {
    if (song && songAt !== undefined && !ctx) pending.set(itemId, { song, songAt });
    return;
  }
  const m = MELODIES[song as MelodyId];
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(musicBus);
  const stepMs = 60_000 / m.bpm / 2;
  players.set(itemId, {
    song: song as MelodyId,
    songAt,
    gain,
    next: Math.max(0, Math.ceil((serverNow() - songAt) / stepMs)),
    lead: steps(m.lead),
    bass: steps(m.bass),
    drums: steps(m.drums),
  });
}

/** Tunes that were set before the first click unlocked the audio. */
const pending = new Map<number, { song: string; songAt: number }>();

function stopPlayer(itemId: number) {
  const p = players.get(itemId);
  if (!p || !ctx) return;
  p.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  setTimeout(() => p.gain.disconnect(), 400);
  players.delete(itemId);
}

export function stopAllJukeboxes() {
  pending.clear();
  for (const id of [...players.keys()]) stopPlayer(id);
}

/** How loud each jukebox is for the listener (0..1), e.g. from distance. */
export function setJukeboxVolume(itemId: number, v: number) {
  const p = players.get(itemId);
  if (p && ctx) p.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.15);
}

export const jukeboxIds = () => [...new Set([...players.keys(), ...pending.keys()])];

function drum(out: AudioNode, tok: string, at: number) {
  if (tok === 'k') tone(out, 150, at, 0.18, { wave: 'sine', vol: 0.6, slideTo: 45, attack: 0.002 });
  else if (tok === 's') {
    noise(out, at, 0.15, 0.25, 1500);
    tone(out, 200, at, 0.08, { wave: 'triangle', vol: 0.15 });
  } else if (tok === 'h') noise(out, at, 0.04, 0.12, 7000);
  else if (tok === 'x') noise(out, at, 0.5, 0.15, 4000);
}

function schedule() {
  if (!ctx) return;
  if (pending.size && ctx.state === 'running') {
    for (const [id, p] of pending) {
      pending.delete(id);
      setJukebox(id, p.song, p.songAt);
    }
  }
  const nowS = serverNow();
  for (const p of players.values()) {
    const m = MELODIES[p.song];
    const stepMs = 60_000 / m.bpm / 2;
    // If the tab slept, jump forward instead of playing a backlog.
    const behind = Math.floor((nowS - p.songAt) / stepMs);
    if (p.next < behind) p.next = behind;
    for (;;) {
      const stepServer = p.songAt + p.next * stepMs;
      const at = ctx.currentTime + (stepServer - nowS) / 1000;
      if (at > ctx.currentTime + LOOKAHEAD) break;
      const i = p.next % MELODY_STEPS;
      const dur = (stepMs / 1000) * 0.9;
      const lf = noteFreq(p.lead[i]);
      if (lf) tone(p.gain, lf, at, dur * 1.6, { wave: m.wave, vol: 0.16 });
      const bf = noteFreq(p.bass[i]);
      if (bf) tone(p.gain, bf, at, dur * 1.8, { wave: 'triangle', vol: 0.3 });
      drum(p.gain, p.drums[i], at);
      p.next++;
    }
  }
}
setInterval(schedule, 40);

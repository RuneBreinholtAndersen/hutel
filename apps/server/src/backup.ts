/**
 * Daily backups of the data file, kept next to it on the same volume (`<data dir>/backups`).
 * Fly also snapshots the volume, but these copies can be restored in seconds with one command:
 *
 *   fly ssh console -C "node_modules/.bin/tsx src/restore.ts --list"
 *   fly ssh console -C "node_modules/.bin/tsx src/restore.ts hutel-db-2026-11-08.json.gz"
 *   fly apps restart hutel        ← the backup is swapped in when the server starts
 *
 * A backup is only written if the data file is valid JSON with users and rooms, so a broken
 * file never pushes the good copies out.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export const KEEP_BACKUPS = 14;

export const backupDir = (dataFile: string) => join(dirname(dataFile), 'backups');

const day = (d: Date) => d.toISOString().slice(0, 10);
const nameFor = (dataFile: string, d: Date) =>
  `${basename(dataFile).replace(/\.json$/, '')}-${day(d)}.json.gz`;

/** Is this text a usable data file? */
export function looksValid(text: string): boolean {
  try {
    const d = JSON.parse(text) as { users?: unknown; rooms?: unknown };
    return (
      typeof d === 'object' && !!d && typeof d.users === 'object' && typeof d.rooms === 'object'
    );
  } catch {
    return false;
  }
}

export interface BackupInfo {
  file: string;
  bytes: number;
  at: string;
}

export function listBackups(dataFile: string): BackupInfo[] {
  const dir = backupDir(dataFile);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json.gz'))
    .sort()
    .reverse()
    .map((f) => {
      const st = statSync(join(dir, f));
      return { file: f, bytes: st.size, at: st.mtime.toISOString() };
    });
}

/**
 * Takes today's backup if it doesn't exist yet (or always with `force`), then deletes all but
 * the newest `keep`. Returns the file name, or null when there was nothing (valid) to back up.
 */
export function backupNow(
  dataFile: string,
  opts: { now?: Date; force?: boolean; keep?: number } = {},
): string | null {
  if (!existsSync(dataFile)) return null;
  const now = opts.now ?? new Date();
  const dir = backupDir(dataFile);
  const name = nameFor(dataFile, now);
  const target = join(dir, name);
  if (existsSync(target) && !opts.force) return name;
  const text = readFileSync(dataFile, 'utf8');
  if (!looksValid(text)) {
    console.error(`[backup] ${dataFile} er ikke gyldig – tager ikke backup af den`);
    return null;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${target}.tmp`, gzipSync(text));
  copyFileSync(`${target}.tmp`, target);
  unlinkSync(`${target}.tmp`);
  for (const old of listBackups(dataFile).slice(opts.keep ?? KEEP_BACKUPS))
    unlinkSync(join(dir, old.file));
  return name;
}

export const pendingFile = (dataFile: string) => `${dataFile}.restore-pending`;

/**
 * Lays a backup ready to replace the data file the next time the server starts. (It can't be
 * swapped in while the server runs: the server saves its own state when it shuts down.)
 */
export function prepareRestore(dataFile: string, backupFile: string): void {
  const path = existsSync(backupFile) ? backupFile : join(backupDir(dataFile), backupFile);
  if (!existsSync(path)) throw new Error(`Fandt ikke backuppen ${backupFile}`);
  const raw = readFileSync(path);
  const text = path.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  if (!looksValid(text)) throw new Error(`${backupFile} er ikke en gyldig datafil`);
  writeFileSync(pendingFile(dataFile), text);
}

/**
 * Called at startup before the data is loaded. Swaps in a prepared restore and keeps the old
 * file as `<name>.before-restore-…`, so a restore can be undone. Returns that name, or null.
 */
export function applyPendingRestore(dataFile: string): string | null {
  const pending = pendingFile(dataFile);
  if (!existsSync(pending)) return null;
  const text = readFileSync(pending, 'utf8');
  if (!looksValid(text)) {
    console.error('[backup] den forberedte gendannelse er ugyldig – springes over');
    unlinkSync(pending);
    return null;
  }
  let saved = '';
  if (existsSync(dataFile)) {
    saved = `${dataFile}.before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    copyFileSync(dataFile, saved);
  }
  copyFileSync(pending, dataFile);
  unlinkSync(pending);
  return saved;
}

import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPendingRestore, backupDir, backupNow, listBackups, prepareRestore } from './backup';
import { createApp } from './app';

const data = (users: Record<string, unknown>) =>
  JSON.stringify({ version: 1, users, rooms: {}, reports: [], chatlog: [] });

function tmpData(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'lobbi-backup-'));
  const file = join(dir, 'hutel-db.json');
  writeFileSync(file, text);
  return file;
}

describe('backups', () => {
  it('takes one per day and keeps the newest 14', () => {
    const file = tmpData(data({}));
    for (let d = 1; d <= 20; d++) backupNow(file, { now: new Date(Date.UTC(2026, 10, d, 12)) });
    const list = listBackups(file);
    expect(list).toHaveLength(14);
    expect(list[0]!.file).toBe('hutel-db-2026-11-20.json.gz');
    expect(list.at(-1)!.file).toBe('hutel-db-2026-11-07.json.gz');
    // Same day again: nothing new.
    backupNow(file, { now: new Date(Date.UTC(2026, 10, 20, 18)) });
    expect(readdirSync(backupDir(file))).toHaveLength(14);
  });

  it('never backs up a broken data file', () => {
    const file = tmpData('{"users": {"a": ');
    expect(backupNow(file)).toBeNull();
    expect(existsSync(backupDir(file))).toBe(false);
  });

  it('restores a backup at the next start and keeps the old file', () => {
    const file = tmpData(data({ old: { id: 'old' } }));
    const name = backupNow(file, { now: new Date(Date.UTC(2026, 10, 1)) })!;
    writeFileSync(file, data({ new: { id: 'new' } }));
    prepareRestore(file, name);
    // Still the current data until the server restarts.
    expect(readFileSync(file, 'utf8')).toContain('"new"');
    const saved = applyPendingRestore(file)!;
    expect(readFileSync(file, 'utf8')).toContain('"old"');
    expect(readFileSync(saved, 'utf8')).toContain('"new"');
    expect(applyPendingRestore(file)).toBeNull();
  });

  it('the server loads a prepared restore when it starts', async () => {
    const file = tmpData(data({}));
    const app = createApp({
      clientOrigins: [],
      dataFile: file,
      clientDist: null,
      onboardingLock: false,
      backups: false,
      chests: false,
    });
    await app.close();
    const u = { id: 'u_1', name: 'Gemt', nameLower: 'gemt', coins: 77 };
    const backup = tmpData(data({ u_1: u }));
    prepareRestore(file, backup);
    const app2 = createApp({
      clientOrigins: [],
      dataFile: file,
      clientDist: null,
      onboardingLock: false,
      backups: false,
      chests: false,
    });
    expect(app2.store.getUser('u_1')?.coins).toBe(77);
    await app2.close();
  });

  it('starts from the newest backup if the data file is broken', async () => {
    const file = tmpData(data({ u_1: { id: 'u_1', name: 'Gemt', nameLower: 'gemt', coins: 5 } }));
    backupNow(file, { now: new Date(Date.UTC(2026, 10, 1)) });
    writeFileSync(file, '{"users": {"u_1": {');
    const app = createApp({
      clientOrigins: [],
      dataFile: file,
      clientDist: null,
      onboardingLock: false,
      backups: false,
      chests: false,
    });
    expect(app.store.getUser('u_1')?.coins).toBe(5);
    await app.close();
  });
});

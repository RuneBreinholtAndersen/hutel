/**
 * Lists backups or prepares one to be restored at the next server start.
 *
 *   tsx src/restore.ts --list
 *   tsx src/restore.ts hutel-db-2026-11-08.json.gz
 *   tsx src/restore.ts --now          (take a backup right now)
 */
import { resolve } from 'node:path';
import { backupNow, listBackups, prepareRestore } from './backup';

const dataFile = resolve(process.env.DATA_FILE ?? 'data/hutel-db.json');
const arg = process.argv[2];

if (!arg || arg === '--list') {
  const list = listBackups(dataFile);
  if (!list.length) console.log('Ingen backups endnu.');
  for (const b of list) console.log(`${b.file}  ${(b.bytes / 1024).toFixed(0)} KB  ${b.at}`);
  console.log('\nGendan med: tsx src/restore.ts <filnavn>  – og genstart så serveren.');
} else if (arg === '--now') {
  console.log(backupNow(dataFile, { force: true }) ?? 'Intet at tage backup af.');
} else {
  prepareRestore(dataFile, arg);
  console.log(
    `${arg} er lagt klar. Genstart serveren (fly apps restart hutel), så tages den i brug.\n` +
      'Den nuværende datafil gemmes som hutel-db.json.before-restore-… så det kan fortrydes.',
  );
}

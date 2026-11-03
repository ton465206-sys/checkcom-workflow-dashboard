import {open, readFile, rename, unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mergeTriageTasks} from './ticket-triage.mjs';

export const STORE_FORMAT = 'checkcom-ticket-triage-prototype-v1';

// Local file only. The adjacent exclusive lock serializes concurrent writers.
// An unknown existing file is rejected rather than overwritten with demo tasks.
export async function savePrototypeTasks(path, incoming) {
  const target = resolve(path), lockPath = `${target}.lock`, tempPath = `${target}.${randomUUID()}.tmp`;
  const lock = await open(lockPath, 'wx');
  try {
    let current;
    try { current = JSON.parse(await readFile(target, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; current = {format: STORE_FORMAT, tasks: []}; }
    if (current?.format !== STORE_FORMAT || !Array.isArray(current.tasks)) throw Error('Refusing to overwrite a non-prototype store');
    const result = mergeTriageTasks(current.tasks, incoming);
    if (result.added.length) {
      const temp = await open(tempPath, 'wx', 0o600);
      try { await temp.writeFile(JSON.stringify({format: STORE_FORMAT, tasks: result.tasks}, null, 2) + '\n'); await temp.sync(); }
      finally { await temp.close(); }
      await rename(tempPath, target);
    }
    return result;
  } finally {
    try {
      try { await unlink(tempPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    } finally {
      try { await lock.close(); } finally { await unlink(lockPath); }
    }
  }
}

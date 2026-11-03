import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {triageTickets} from './ticket-triage.mjs';
import {savePrototypeTasks} from './ticket-triage-store.mjs';

export async function run(args) {
  if (![1, 3].includes(args.length) || (args.length === 3 && args[1] !== '--store')) throw Error('Usage: node apps/workflow/ticket-triage-cli.mjs <local-tickets.json> [--store <local-prototype-store.json>]');
  if (args[2] && resolve(args[0]) === resolve(args[2])) throw Error('Input and store must be different files');
  const result = triageTickets(JSON.parse(await readFile(args[0], 'utf8')));
  if (args[2]) result.persistence = await savePrototypeTasks(args[2], result.tasks);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.errors.length || result.conflicts.length || result.persistence?.conflicts.length) process.exitCode = 2;
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}

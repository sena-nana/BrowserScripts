import { buildUserscript, listUserscriptIds } from '../packages/build-kit/src/build-userscript.ts';

const requestedScriptId = process.argv[2];
const scriptIds = requestedScriptId ? [requestedScriptId] : await listUserscriptIds(process.cwd());

if (scriptIds.length === 0) {
  throw new Error('No userscripts found');
}

for (const scriptId of scriptIds) {
  const result = await buildUserscript({
    repoRoot: process.cwd(),
    scriptId,
    dev: false
  });

  console.log(`built ${scriptId}: ${result.outfile}`);
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadUserscriptMeta,
  listUserscriptIds
} from '../packages/build-kit/src/build-userscript.ts';
import { getMetaGrants } from '../packages/build-kit/src/validate-meta.ts';

const requestedScriptId = process.argv[2];
const repoRoot = process.cwd();
const scriptIds = requestedScriptId ? [requestedScriptId] : await listUserscriptIds(repoRoot);

function parseMetadataBlock(source) {
  if (!source.startsWith('// ==UserScript==\n')) {
    throw new Error('metadata block must start at the first byte');
  }

  const endMarker = '// ==/UserScript==';
  const endIndex = source.indexOf(endMarker);

  if (endIndex < 0) {
    throw new Error('metadata end marker is missing');
  }

  return source.slice(0, endIndex + endMarker.length);
}

function parseGrants(metadataBlock) {
  const grants = [];

  for (const line of metadataBlock.split('\n')) {
    const match = line.match(/^\/\/ @grant\s+(.+)$/);

    if (match) {
      grants.push(match[1].trim());
    }
  }

  return grants;
}

for (const scriptId of scriptIds) {
  const distPath = path.join(repoRoot, 'dist', `${scriptId}.user.js`);
  const source = await readFile(distPath, 'utf8');
  const metadataBlock = parseMetadataBlock(source);
  const actualGrants = parseGrants(metadataBlock);
  const expectedMeta = await loadUserscriptMeta(repoRoot, scriptId);
  const expectedGrants = getMetaGrants(expectedMeta);

  if (actualGrants.join('\n') !== expectedGrants.join('\n')) {
    throw new Error(
      `${scriptId}: emitted grants do not match meta.ts. expected ${expectedGrants.join(', ')}, got ${actualGrants.join(', ')}`
    );
  }

  console.log(`metadata ok: ${scriptId}`);
}

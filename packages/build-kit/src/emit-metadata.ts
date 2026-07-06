import {
  type UserscriptMeta,
  getMetaGrants,
  getMetaMatches,
  validateUserscriptMeta
} from './validate-meta.ts';

function line(key: string, value: string): string {
  return `// @${key.padEnd(Math.max(12, key.length + 1), ' ')}${value}`;
}

export function emitMetadata(meta: UserscriptMeta): string {
  validateUserscriptMeta(meta);

  const lines = ['// ==UserScript=='];
  lines.push(line('name', meta.name));
  lines.push(line('namespace', meta.namespace));
  lines.push(line('version', meta.version));
  lines.push(line('description', meta.description));

  for (const match of getMetaMatches(meta)) {
    lines.push(line('match', match));
  }

  for (const excludeMatch of meta.excludeMatch ?? []) {
    lines.push(line('exclude-match', excludeMatch));
  }

  if (meta.runAt) {
    lines.push(line('run-at', meta.runAt));
  }

  if (meta.injectInto) {
    lines.push(line('inject-into', meta.injectInto));
  }

  if (meta.noframes) {
    lines.push('// @noframes');
  }

  for (const grant of getMetaGrants(meta)) {
    lines.push(line('grant', grant));
  }

  for (const connect of meta.connect ?? []) {
    lines.push(line('connect', connect));
  }

  for (const [name, url] of Object.entries(meta.resource ?? {})) {
    lines.push(line('resource', `${name} ${url}`));
  }

  for (const [key, value] of Object.entries({
    downloadURL: meta.downloadURL,
    updateURL: meta.updateURL,
    supportURL: meta.supportURL,
    homepageURL: meta.homepageURL
  })) {
    if (value) {
      lines.push(line(key, value));
    }
  }

  lines.push('// ==/UserScript==');
  return `${lines.join('\n')}\n`;
}

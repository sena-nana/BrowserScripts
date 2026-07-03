import { pathToFileURL } from 'node:url';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { emitMetadata } from './emit-metadata.ts';
import { type UserscriptMeta } from './validate-meta.ts';

export interface BuildUserscriptOptions {
  repoRoot?: string;
  scriptId: string;
  dev?: boolean;
}

export interface BuildUserscriptResult {
  scriptId: string;
  outfile: string;
}

export async function listUserscriptIds(repoRoot = process.cwd()): Promise<string[]> {
  const userscriptsDir = path.join(repoRoot, 'userscripts');
  const entries = await readdir(userscriptsDir, { withFileTypes: true });
  const ids: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_template') {
      continue;
    }

    const metaPath = path.join(userscriptsDir, entry.name, 'meta.ts');

    try {
      const metaStat = await stat(metaPath);

      if (metaStat.isFile()) {
        ids.push(entry.name);
      }
    } catch {
      continue;
    }
  }

  return ids.sort();
}

export async function loadUserscriptMeta(
  repoRoot: string,
  scriptId: string
): Promise<UserscriptMeta> {
  const metaPath = path.join(repoRoot, 'userscripts', scriptId, 'meta.ts');
  const metaUrl = `${pathToFileURL(metaPath).href}?t=${Date.now()}`;
  const module = (await import(metaUrl)) as { default?: UserscriptMeta };

  if (!module.default) {
    throw new Error(`${metaPath} must export default metadata`);
  }

  return module.default;
}

export async function buildUserscript(
  options: BuildUserscriptOptions
): Promise<BuildUserscriptResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const scriptDir = path.join(repoRoot, 'userscripts', options.scriptId);
  const entryPoint = path.join(scriptDir, 'src', 'main.ts');
  const distDir = path.join(repoRoot, 'dist');
  const outfile = path.join(distDir, `${options.scriptId}.user.js`);
  const meta = await loadUserscriptMeta(repoRoot, options.scriptId);
  const metadataBlock = emitMetadata(meta);

  await mkdir(distDir, { recursive: true });

  await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    banner: {
      js: metadataBlock
    },
    define: {
      __DEV__: JSON.stringify(Boolean(options.dev))
    },
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    legalComments: 'none',
    loader: {
      '.css': 'text'
    }
  });

  return {
    scriptId: options.scriptId,
    outfile
  };
}

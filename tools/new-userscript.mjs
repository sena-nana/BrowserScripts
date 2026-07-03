import { cp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const scriptId = process.argv[2];

if (!scriptId || !/^[a-z0-9][a-z0-9-]*$/.test(scriptId)) {
  throw new Error('Usage: pnpm new <script-id>. Use lowercase letters, numbers, and hyphens.');
}

const repoRoot = process.cwd();
const templateDir = path.join(repoRoot, 'userscripts', '_template');
const targetDir = path.join(repoRoot, 'userscripts', scriptId);
const scriptName = scriptId
  .split('-')
  .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
  .join(' ');
const debugGlobal = `__VM_${scriptId.toUpperCase().replaceAll('-', '_')}_DEBUG__`;

await cp(templateDir, targetDir, {
  recursive: true,
  errorOnExist: true,
  force: false
});

async function rewriteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await rewriteFiles(fullPath);
      continue;
    }

    if (!/\.(json|md|ts|css)$/.test(entry.name)) {
      continue;
    }

    const source = await readFile(fullPath, 'utf8');
    const next = source
      .replaceAll('template-userscript', scriptId)
      .replaceAll('Template Userscript', `${scriptName} Userscript`)
      .replaceAll('Starter userscript template.', `${scriptName} userscript.`)
      .replaceAll('__VM_TEMPLATE_USERSCRIPT_DEBUG__', debugGlobal);

    await writeFile(fullPath, next);
  }
}

await rewriteFiles(targetDir);

console.log(`created userscripts/${scriptId}`);
console.log(`next: update userscripts/${scriptId}/meta.ts and userscripts/${scriptId}/README.md`);

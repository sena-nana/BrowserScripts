import { createServer } from 'node:http';
import { createReadStream, watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { buildUserscript } from '../packages/build-kit/src/build-userscript.ts';

const scriptId = process.argv[2];

if (!scriptId) {
  throw new Error('Usage: pnpm dev <script-id>');
}

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const watchedDirs = [
  path.join(repoRoot, 'userscripts', scriptId),
  path.join(repoRoot, 'packages', 'vm-kit'),
  path.join(repoRoot, 'packages', 'build-kit')
];
let building = false;
let pending = false;

async function rebuild() {
  if (building) {
    pending = true;
    return;
  }

  building = true;

  try {
    const result = await buildUserscript({
      repoRoot,
      scriptId,
      dev: true
    });
    console.log(`rebuilt ${scriptId}: ${result.outfile}`);
  } finally {
    building = false;

    if (pending) {
      pending = false;
      await rebuild();
    }
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.map')) {
    return 'application/json; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }

  return 'application/octet-stream';
}

await rebuild();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = requestUrl.pathname === '/' ? `/${scriptId}.user.js` : requestUrl.pathname;
  const filePath = path.normalize(path.join(distDir, pathname));
  const relativePath = path.relative(distDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentType(filePath),
      'cache-control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to read dev server address');
  }

  console.log(`install URL: http://127.0.0.1:${address.port}/${scriptId}.user.js`);
});

let rebuildTimer;
const watchers = watchedDirs.map((dir) =>
  watch(dir, { recursive: true }, () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      void rebuild().catch((error) => {
        console.error(error);
      });
    }, 100);
  })
);

process.on('SIGINT', () => {
  for (const watcher of watchers) {
    watcher.close();
  }

  server.close(() => process.exit(0));
});

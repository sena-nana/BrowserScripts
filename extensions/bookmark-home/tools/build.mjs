import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageRoot = path.join(workspaceRoot, "packages", "extension");
const sourceRoot = path.join(packageRoot, "src");
const publicRoot = path.join(packageRoot, "public");
const outputRoot = path.join(packageRoot, "dist");
const artifactsRoot = path.join(workspaceRoot, "artifacts");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await mkdir(artifactsRoot, { recursive: true });
await cp(publicRoot, outputRoot, { recursive: true });

const result = await build({
  absWorkingDir: packageRoot,
  entryPoints: [path.join(sourceRoot, "main.ts")],
  outdir: outputRoot,
  bundle: true,
  format: "esm",
  target: "chrome134",
  minify: true,
  splitting: true,
  treeShaking: true,
  sourcemap: false,
  metafile: true,
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  assetNames: "assets/[name]-[hash]",
  loader: {
    ".svg": "file",
  },
});

const manifest = JSON.parse(
  await readFile(path.join(outputRoot, "manifest.json"), "utf8"),
);
const forbiddenKeys = [
  "background",
  "content_scripts",
  "side_panel",
  "web_accessible_resources",
];
for (const key of forbiddenKeys) {
  if (key in manifest) {
    throw new Error(`Forbidden manifest surface: ${key}`);
  }
}
const forbiddenPermissions = new Set([
  "sidePanel",
  "scripting",
  "tabs",
  "topSites",
  "unlimitedStorage",
]);
for (const permission of manifest.permissions ?? []) {
  if (forbiddenPermissions.has(permission)) {
    throw new Error(`Forbidden permission: ${permission}`);
  }
}
if (manifest.chrome_url_overrides?.newtab !== "newtab.html") {
  throw new Error("The new tab override is missing");
}

await writeFile(
  path.join(artifactsRoot, "build-meta.json"),
  `${JSON.stringify(result.metafile, null, 2)}\n`,
);

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { chromium } from "playwright";

import { BookmarkTreeModel } from "../packages/extension/src/bookmarks/tree-model";
import type {
  BookmarkNode,
  BookmarkRepository,
} from "../packages/extension/src/core/types";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionPath = path.join(workspaceRoot, "packages", "extension", "dist");
const artifactPath = path.join(
  workspaceRoot,
  "artifacts",
  "perf",
  "bookmark-home.json",
);

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return sorted[index] ?? 0;
}

async function fileSize(filePath: string): Promise<number> {
  return (await stat(filePath)).size;
}

async function directorySize(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory()
      ? await directorySize(entryPath)
      : await fileSize(entryPath);
  }
  return total;
}

class LargeBookmarkRepository implements BookmarkRepository {
  readonly #children: BookmarkNode[];

  constructor(count: number) {
    this.#children = Array.from({ length: count }, (_, index) => ({
      id: `bookmark-${index}`,
      parentId: "bar",
      index,
      title: `Synthetic bookmark ${index}`,
      url: `https://example.com/${index}`,
    }));
  }

  getRootChildren(): Promise<BookmarkNode[]> {
    return Promise.resolve([
      { id: "bar", title: "Bookmarks bar", folderType: "bookmarks-bar" },
      { id: "other", title: "Other bookmarks", folderType: "other" },
    ]);
  }

  getAll(): Promise<BookmarkNode[]> {
    return Promise.resolve(this.#children.map((node) => ({ ...node })));
  }

  getChildren(parentId: string): Promise<BookmarkNode[]> {
    return Promise.resolve(
      parentId === "bar" ? this.#children.map((node) => ({ ...node })) : [],
    );
  }

  getNode(id: string): Promise<BookmarkNode | null> {
    return Promise.resolve(
      id === "bar"
        ? { id: "bar", title: "Bookmarks bar", folderType: "bookmarks-bar" }
        : (this.#children.find((node) => node.id === id) ?? null),
    );
  }

  getSubTree(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }

  search(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }

  create(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  update(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  move(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  remove(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

const modelStart = performance.now();
const largeModel = new BookmarkTreeModel(new LargeBookmarkRepository(10_000));
await largeModel.initialize(new Set());
const modelRows = largeModel.rows();
const modelDuration = performance.now() - modelStart;
assert.equal(modelRows.length, 10_000);
largeModel.dispose();

const mainJsBytes = await fileSize(path.join(extensionPath, "main.js"));
const mainCssBytes = await fileSize(path.join(extensionPath, "main.css"));
const assetBytes = await directorySize(path.join(extensionPath, "assets"));
const unpackedBytes = await directorySize(extensionPath);
const startupBytes = mainJsBytes + mainCssBytes + assetBytes;

const profilePath = await mkdtemp(
  path.join(os.tmpdir(), "bookmark-home-perf-"),
);
const context = await chromium.launchPersistentContext(profilePath, {
  channel: "chromium",
  headless: true,
  locale: "en-US",
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

let browserUserAgent: string;
let performanceFolderId: string;
const shellReady: number[] = [];
const firstRows: number[] = [];
const localSuggestions: number[] = [];
let renderedRows: number;
let expandDuration: number;

try {
  const setupPage = context.pages()[0] ?? (await context.newPage());
  await setupPage.goto("chrome://newtab/");
  await setupPage.waitForSelector("#app");
  browserUserAgent = await setupPage.evaluate(() => navigator.userAgent);
  performanceFolderId = await setupPage.evaluate(async () => {
    const [root] = await chrome.bookmarks.getTree();
    const bar = root?.children?.find(
      (node) => node.folderType === "bookmarks-bar",
    );
    if (!bar) {
      throw new Error("Bookmarks bar was not found");
    }
    const folder = await chrome.bookmarks.create({
      parentId: bar.id,
      title: "Bookmark Home Performance",
    });
    for (let offset = 0; offset < 5_000; offset += 100) {
      await Promise.all(
        Array.from({ length: 100 }, (_, innerIndex) => {
          const index = offset + innerIndex;
          return chrome.bookmarks.create({
            parentId: folder.id,
            title: `Performance Bookmark ${String(index).padStart(4, "0")}`,
            url: `https://example.com/performance/${index}`,
          });
        }),
      );
    }
    const stored = await chrome.storage.sync.get("settings");
    const persistedSettings = stored.settings as
      | {
          version: number;
          appearance: Record<string, unknown>;
          search: Record<string, unknown>;
        }
      | undefined;
    const settings = persistedSettings ?? {
      version: 4,
      appearance: {
        theme: "system",
        sidebarWidth: 320,
        sidebarCollapsed: false,
        sidebarDensity: "standard",
        panelTransparency: 20,
        backdropBlur: 7,
      },
      search: {
        provider: "google",
        customName: "",
        customSearchUrl: "https://example.com/search?q={query}",
        historySuggestions: true,
        onlineSuggestions: true,
      },
    };
    await chrome.storage.sync.set({
      settings: {
        ...settings,
        search: {
          ...settings.search,
          historySuggestions: false,
          onlineSuggestions: false,
        },
      },
    });
    return folder.id;
  });
  await setupPage.close();

  for (let run = 0; run < 10; run += 1) {
    const page = await context.newPage();
    await page.goto("chrome://newtab/");
    await page.waitForFunction(
      () =>
        performance.getEntriesByName("bookmark-home:first-bookmark-rows")
          .length > 0,
    );
    const metrics = await page.evaluate(() => ({
      shell:
        performance.getEntriesByName("bookmark-home:shell-ready").at(-1)
          ?.startTime ?? 0,
      rows:
        performance.getEntriesByName("bookmark-home:first-bookmark-rows").at(-1)
          ?.startTime ?? 0,
    }));
    shellReady.push(metrics.shell);
    firstRows.push(metrics.rows);
    await page.close();
  }

  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.waitForSelector(
    `.tree-row[data-id="${performanceFolderId}"] .node-icon.folder`,
  );
  const expandStarted = performance.now();
  await page
    .locator(`.tree-row[data-id="${performanceFolderId}"] .node-icon.folder`)
    .click();
  await page.getByText("Performance Bookmark 0000", { exact: true }).waitFor();
  expandDuration = performance.now() - expandStarted;
  renderedRows = await page.locator("#tree-content .tree-row").count();

  for (let index = 0; index < 10; index += 1) {
    const input = page.locator("#web-search-input");
    const title = `Performance Bookmark ${String(index).padStart(4, "0")}`;
    await input.fill(title);
    await page
      .locator("#search-suggestions .suggestion-title")
      .filter({ hasText: title })
      .waitFor();
    const duration = await page.evaluate(
      () =>
        performance.getEntriesByName("bookmark-home:local-suggestions").at(-1)
          ?.duration ?? 0,
    );
    localSuggestions.push(duration);
  }

  await page.evaluate(async (folderId) => {
    await chrome.bookmarks.removeTree(folderId);
  }, performanceFolderId);
  await page.close();
} finally {
  await context.close();
  await rm(profilePath, { recursive: true, force: true });
}

const metrics = {
  bundle: {
    mainJsBytes,
    mainCssBytes,
    startupBytes,
    unpackedBytes,
  },
  startup: {
    runs: shellReady.length,
    shellReadyMs: shellReady,
    shellReadyP95Ms: percentile(shellReady, 95),
    firstRowsMs: firstRows,
    firstRowsP95Ms: percentile(firstRows, 95),
  },
  bookmarks: {
    realBookmarkCount: 5_000,
    renderedRows,
    expandDurationMs: expandDuration,
    syntheticNodeCount: 10_000,
    syntheticRows: modelRows.length,
    syntheticMaterializeMs: modelDuration,
  },
  suggestions: {
    runs: localSuggestions.length,
    durationsMs: localSuggestions,
    p95Ms: percentile(localSuggestions, 95),
  },
};

const budgets = {
  mainJs: mainJsBytes <= 60 * 1024,
  mainCss: mainCssBytes <= 25 * 1024,
  startupAssets: startupBytes <= 100 * 1024,
  shellReadyP95: metrics.startup.shellReadyP95Ms <= 200,
  firstRowsP95: metrics.startup.firstRowsP95Ms <= 400,
  localSuggestionsP95: metrics.suggestions.p95Ms <= 100,
  renderedRows: renderedRows <= 100,
};

const artifact = {
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    browserUserAgent,
    platform: `${process.platform}-${process.arch}`,
  },
  stages: [
    {
      name: "shell-and-manifest",
      evidence: metrics.bundle,
    },
    {
      name: "bookmark-tree",
      evidence: metrics.bookmarks,
    },
    {
      name: "search-and-final-startup",
      evidence: {
        startup: metrics.startup,
        suggestions: metrics.suggestions,
      },
    },
  ],
  budgets,
  passed: Object.values(budgets).every(Boolean),
};

await mkdir(path.dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

if (!artifact.passed) {
  throw new Error(`Performance budgets failed: ${JSON.stringify(budgets)}`);
}
console.log(
  `Performance passed: shell p95 ${metrics.startup.shellReadyP95Ms.toFixed(1)}ms, first rows p95 ${metrics.startup.firstRowsP95Ms.toFixed(1)}ms, suggestions p95 ${metrics.suggestions.p95Ms.toFixed(1)}ms`,
);

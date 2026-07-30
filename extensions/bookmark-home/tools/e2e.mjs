import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionPath = path.join(workspaceRoot, "packages", "extension", "dist");
const artifactsPath = path.join(workspaceRoot, "artifacts");
const screenshotsPath = path.join(artifactsPath, "screenshots");
const profilePath = await mkdtemp(path.join(os.tmpdir(), "bookmark-home-e2e-"));
const startedAt = new Date().toISOString();
const checks = [];

function record(name) {
  checks.push(name);
}

await mkdir(screenshotsPath, { recursive: true });

const context = await chromium.launchPersistentContext(profilePath, {
  channel: "chromium",
  headless: true,
  locale: "en-US",
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route("https://suggestqueries.google.com/**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        query,
        query === "codex-network" ? ["codex online result"] : [],
      ]),
    });
  });
  await context.route("https://www.google.com/search**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Search reached</title>",
    });
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("chrome://newtab/");
  await page.waitForSelector("#app");
  assert.match(page.url(), /^chrome-extension:\/\//);
  record("native new-tab override");

  const manifest = await page.evaluate(() => chrome.runtime.getManifest());
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, [
    "bookmarks",
    "storage",
    "history",
    "favicon",
  ]);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.permissions.includes("topSites"), false);
  record("minimal manifest surface");

  const layout = await page.evaluate(() => {
    const sidebar = globalThis.document.querySelector("#bookmark-sidebar");
    const search = globalThis.document.querySelector("#web-search");
    if (!sidebar || !search) {
      throw new Error("Home layout is missing");
    }
    const searchRect = search.getBoundingClientRect();
    return {
      background: globalThis.getComputedStyle(globalThis.document.body)
        .backgroundColor,
      sidebarWidth: sidebar.getBoundingClientRect().width,
      searchWidth: searchRect.width,
      searchHeight: searchRect.height,
      headingCount: globalThis.document.querySelectorAll("h1").length,
      topLink: globalThis.document.querySelector("#top-links a")?.textContent,
    };
  });
  assert.deepEqual(layout, {
    background: "rgb(242, 242, 242)",
    sidebarWidth: 350,
    searchWidth: 650,
    searchHeight: 54,
    headingCount: 0,
    topLink: "Google",
  });
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-light.png"),
  });
  record("transparent preset desktop layout");

  const bookmarkBarId = await page.evaluate(async () => {
    const [root] = await chrome.bookmarks.getTree();
    const bar = root?.children?.find(
      (node) => node.folderType === "bookmarks-bar",
    );
    if (!bar) {
      throw new Error("Bookmarks bar was not found");
    }
    return bar.id;
  });

  await page.locator("#add-bookmark-item").click();
  await page.locator(".modal input[type='text']").nth(0).fill("E2E Bookmark");
  await page
    .locator(".modal input[type='text']")
    .nth(1)
    .fill("https://example.com/e2e-bookmark");
  await page.locator(".modal .button.primary").click();
  await page.getByText("E2E Bookmark", { exact: true }).waitFor();
  const bookmarkId = await page.evaluate(async () => {
    const [bookmark] = await chrome.bookmarks.search({
      url: "https://example.com/e2e-bookmark",
    });
    if (!bookmark) {
      throw new Error("Created bookmark was not found");
    }
    return bookmark.id;
  });
  record("create bookmark through UI");

  await page.locator(`.tree-row[data-id="${bookmarkId}"] .tree-menu`).click();
  await page.locator('.popover button[data-action="edit"]').click();
  await page
    .locator(".modal input[type='text']")
    .nth(0)
    .fill("E2E Bookmark Edited");
  await page.locator(".modal .button.primary").click();
  await page.getByText("E2E Bookmark Edited", { exact: true }).waitFor();
  record("edit bookmark through UI");

  await page.locator("#add-bookmark-item").click();
  await page.locator(".modal select").selectOption("folder");
  await page.locator(".modal input[type='text']").nth(0).fill("E2E Folder");
  await page.locator(".modal .button.primary").click();
  await page.getByText("E2E Folder", { exact: true }).waitFor();
  const folderId = await page.evaluate(async () => {
    const matches = await chrome.bookmarks.search({ title: "E2E Folder" });
    const folder = matches.find((node) => !node.url);
    if (!folder) {
      throw new Error("Created folder was not found");
    }
    return folder.id;
  });

  await page.locator(`.tree-row[data-id="${bookmarkId}"] .tree-menu`).click();
  await page.locator('.popover button[data-action="move"]').click();
  await page.locator(".modal select").selectOption(folderId);
  await page.locator(".modal .button.primary").click();
  await page.locator(`.tree-row[data-id="${folderId}"] .tree-toggle`).click();
  await page.getByText("E2E Bookmark Edited", { exact: true }).waitFor();
  const movedParent = await page.evaluate(async (id) => {
    const [node] = await chrome.bookmarks.get(id);
    return node?.parentId;
  }, bookmarkId);
  assert.equal(movedParent, folderId);
  record("move bookmark with keyboard-accessible dialog");

  await page.locator(`.tree-row[data-id="${bookmarkId}"] .tree-menu`).click();
  await page.locator('.popover button[data-action="delete"]').click();
  await page.locator(".modal .button.danger").click();
  await page
    .locator(`.tree-row[data-id="${bookmarkId}"]`)
    .waitFor({ state: "detached" });
  record("confirmed bookmark deletion");

  const externalIds = await page.evaluate(async (parentId) => {
    const first = await chrome.bookmarks.create({
      parentId,
      title: "Codex Bookmark E2E",
      url: "https://example.com/codex-e2e",
    });
    const second = await chrome.bookmarks.create({
      parentId,
      title: "Popular Bookmark E2E",
      url: "https://example.com/popular-e2e",
    });
    return [first.id, second.id];
  }, bookmarkBarId);
  await page.getByText("Codex Bookmark E2E", { exact: true }).waitFor();
  assert.equal(await page.locator("#quick-links").count(), 0);
  record("live bookmark synchronization without a shortcut grid");

  await page.evaluate(() => {
    chrome.history.search = async () => [
      {
        id: "e2e-history",
        title: "E2E History Result",
        url: "https://example.com/e2e-history",
        lastVisitTime: Date.now(),
        visitCount: 1,
        typedCount: 0,
      },
    ];
  });

  await page.locator("#web-search-input").fill("Codex Bookmark E2E");
  await page
    .locator('#search-suggestions .suggestion[data-source="bookmark"]')
    .waitFor();
  await page.locator("#web-search-input").fill("e2e-history");
  await page
    .locator('#search-suggestions .suggestion[data-source="history"]')
    .filter({ hasText: "E2E History Result" })
    .waitFor();
  await page.locator("#web-search-input").fill("codex-network");
  await page
    .getByText("codex online result", { exact: true })
    .waitFor({ timeout: 3_000 });
  record("bookmark, history, and online search suggestions");

  const openEditor = async () => {
    await page.locator("#edit-home").click();
    await page.locator("#home-editor").waitFor();
  };
  const saveEditor = async () => {
    await page.locator(".home-edit-bar .primary").click();
    await page.locator("#home-editor").waitFor({ state: "detached" });
  };

  await openEditor();
  const topInputs = page.locator(
    ".home-edit-group:nth-of-type(2) .link-editor-row input",
  );
  await topInputs.nth(0).fill("Temporary Link");
  await topInputs.nth(1).fill("https://temporary.example/");
  await page
    .locator(".home-edit-bar")
    .getByText("Cancel", { exact: true })
    .click();
  await page.locator("#home-editor").waitFor({ state: "detached" });
  assert.equal(
    await page.getByText("Temporary Link", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .locator("#top-links")
      .getByText("Google", { exact: true })
      .count(),
    1,
  );
  record("home editor cancel restores the persisted preview");

  await openEditor();
  const savedTopInputs = page.locator(
    ".home-edit-group:nth-of-type(2) .link-editor-row input",
  );
  await savedTopInputs.nth(0).fill("Saved Link");
  await savedTopInputs.nth(1).fill("https://saved.example/");
  await saveEditor();
  await page.locator("#top-links").getByText("Saved Link").waitFor();
  record("top links save without shortcut controls");

  await page.reload();
  await page.locator("#top-links").getByText("Saved Link").waitFor();
  assert.equal(await page.locator("#quick-links").count(), 0);
  record("top links persist across new-tab reloads");

  await openEditor();
  const png = await readFile(
    path.join(
      workspaceRoot,
      "packages",
      "extension",
      "public",
      "icons",
      "icon-128.png",
    ),
  );
  await page.locator('.home-edit-bar input[type="file"]').setInputFiles({
    name: "background.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.locator("body.has-custom-background").waitFor();
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-edit.png"),
  });
  await saveEditor();
  await page.reload();
  await page.locator("body.has-custom-background").waitFor();
  record("local background conversion and persistence");

  await openEditor();
  await page
    .locator(".home-edit-bar")
    .getByText("Remove background", { exact: true })
    .click();
  await saveEditor();
  await page
    .locator("body.has-custom-background")
    .waitFor({ state: "detached" });

  await page.evaluate(async () => {
    const stored = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({
      settings: {
        ...stored.settings,
        appearance: { ...stored.settings.appearance, theme: "dark" },
      },
    });
  });
  await page.reload();
  await page.waitForSelector("#app");
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.getComputedStyle(globalThis.document.body).backgroundColor,
    ),
    "rgb(61, 61, 61)",
  );
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-dark.png"),
  });
  record("dark transparent preset");

  await page.setViewportSize({ width: 720, height: 900 });
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-narrow.png"),
  });
  const narrowSidebar = await page
    .locator("#bookmark-sidebar")
    .evaluate((element) => globalThis.getComputedStyle(element).position);
  assert.equal(narrowSidebar, "fixed");
  await page.setViewportSize({ width: 1440, height: 900 });
  record("narrow internal bookmark drawer");

  await page.locator("#sidebar-menu").click();
  await page
    .locator(".sidebar-popover")
    .getByText("Collapse bookmarks", { exact: true })
    .click();
  await page.locator("body.sidebar-collapsed").waitFor();
  await page.reload();
  await page.locator("body.sidebar-collapsed").waitFor();
  record("sidebar preference persistence");

  const ordinaryPage = await context.newPage();
  await ordinaryPage.goto("https://example.com/no-injection");
  assert.equal(await ordinaryPage.locator("#bookmark-sidebar").count(), 0);
  await ordinaryPage.close();
  record("no ordinary-page injection");

  await page.evaluate(
    async (ids) => {
      for (const id of ids) {
        try {
          await chrome.bookmarks.removeTree(id);
        } catch {
          try {
            await chrome.bookmarks.remove(id);
          } catch {
            // The UI already removed this entry.
          }
        }
      }
    },
    [...externalIds, folderId],
  );

  await page.locator("#web-search-input").fill("e2e search phrase");
  await page.locator("#web-search-input").press("Enter");
  await page.waitForURL("https://www.google.com/search**");
  assert.equal(await page.title(), "Search reached");
  record("search navigation");
} finally {
  await context.close();
  await rm(profilePath, { recursive: true, force: true });
}

await mkdir(artifactsPath, { recursive: true });
await writeFile(
  path.join(artifactsPath, "e2e.json"),
  `${JSON.stringify(
    {
      startedAt,
      completedAt: new Date().toISOString(),
      checks,
      screenshots: [
        "screenshots/bookmark-home-light.png",
        "screenshots/bookmark-home-dark.png",
        "screenshots/bookmark-home-edit.png",
        "screenshots/bookmark-home-narrow.png",
      ],
      passed: checks.length,
    },
    null,
    2,
  )}\n`,
);
console.log(`E2E passed: ${checks.length} observable checks`);

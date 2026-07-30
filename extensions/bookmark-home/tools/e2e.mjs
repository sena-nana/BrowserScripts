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

  const assertTreePopoverWithinViewport = async () => {
    const geometry = await page.locator(".tree-popover").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: globalThis.innerWidth,
        viewportHeight: globalThis.innerHeight,
      };
    });
    assert.ok(geometry.left >= 8);
    assert.ok(geometry.top >= 8);
    assert.ok(geometry.right <= geometry.viewportWidth - 8);
    assert.ok(geometry.bottom <= geometry.viewportHeight - 8);
    return geometry;
  };

  const assertGlassSurface = async (selector, expected) => {
    const actual = await page.locator(selector).evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        background: style.backgroundColor,
        blur: style.backdropFilter,
        borderRadius: style.borderRadius,
      };
    });
    assert.deepEqual(actual, expected);
  };
  const defaultGlassSurface = {
    background: "rgba(255, 255, 255, 0.8)",
    blur: "blur(7px)",
    borderRadius: "6px",
  };

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
      topJumpCount: globalThis.document.querySelectorAll(
        "#top-links, .top-link",
      ).length,
    };
  });
  assert.deepEqual(layout, {
    background: "rgb(242, 242, 242)",
    sidebarWidth: 350,
    searchWidth: 650,
    searchHeight: 54,
    headingCount: 0,
    topJumpCount: 0,
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
  const rootIconInset = await page.evaluate((id) => {
    const sidebar = globalThis.document.querySelector("#bookmark-sidebar");
    const icon = globalThis.document.querySelector(
      `.tree-row[data-id="${id}"] .node-icon`,
    );
    if (!sidebar || !icon) {
      throw new Error("Root bookmark folder is missing");
    }
    return (
      icon.getBoundingClientRect().left - sidebar.getBoundingClientRect().left
    );
  }, bookmarkBarId);
  assert.ok(rootIconInset > 0);

  const bookmarkBarRow = page.locator(`.tree-row[data-id="${bookmarkBarId}"]`);
  const bookmarkBarBounds = await bookmarkBarRow.boundingBox();
  assert.ok(bookmarkBarBounds);
  const contextMenuPoint = { x: 120, y: 10 };
  await bookmarkBarRow.click({
    button: "right",
    position: contextMenuPoint,
  });
  await page.locator(".tree-popover").waitFor();
  assert.equal(
    await page.locator('.tree-popover button[data-action="edit"]').count(),
    0,
  );
  await page.waitForFunction(
    (id) =>
      globalThis.document
        .querySelector(`.tree-row[data-id="${id}"]`)
        ?.getAttribute("aria-selected") === "true",
    bookmarkBarId,
  );
  const rootPopoverGeometry = await assertTreePopoverWithinViewport();
  assert.ok(
    Math.abs(
      rootPopoverGeometry.left - (bookmarkBarBounds.x + contextMenuPoint.x),
    ) <= 1,
  );
  assert.ok(
    Math.abs(
      rootPopoverGeometry.top - (bookmarkBarBounds.y + contextMenuPoint.y),
    ) <= 1,
  );
  const compactMenuGeometry = await page
    .locator(".tree-popover")
    .evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      actionHeight:
        element.querySelector("button")?.getBoundingClientRect().height ??
        Number.POSITIVE_INFINITY,
    }));
  assert.ok(compactMenuGeometry.width <= 170);
  assert.ok(compactMenuGeometry.actionHeight <= 30);
  await assertGlassSurface(".tree-popover", defaultGlassSurface);
  await page.keyboard.press("Escape");
  await page.locator(".tree-popover").waitFor({ state: "detached" });
  record("root bookmark folders remain protected in the context menu");

  await page.locator("#add-bookmark-item").click();
  await assertGlassSurface(".modal", defaultGlassSurface);
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

  await page
    .locator(`.tree-row[data-id="${bookmarkId}"]`)
    .click({ button: "right" });
  await page.locator(".tree-popover").waitFor();
  await assertTreePopoverWithinViewport();
  await page.locator('.tree-popover button[data-action="edit"]').click();
  await assertGlassSurface(".modal", defaultGlassSurface);
  await page
    .locator(".modal input[type='text']")
    .nth(0)
    .fill("E2E Bookmark Edited");
  await page
    .locator(".modal input[type='text']")
    .nth(1)
    .fill("https://example.com/e2e-bookmark-edited");
  await page.locator(".modal .button.primary").click();
  await page.getByText("E2E Bookmark Edited", { exact: true }).waitFor();
  const editedBookmark = await page.evaluate(async (id) => {
    const [node] = await chrome.bookmarks.get(id);
    return { title: node?.title, url: node?.url };
  }, bookmarkId);
  assert.deepEqual(editedBookmark, {
    title: "E2E Bookmark Edited",
    url: "https://example.com/e2e-bookmark-edited",
  });
  record("edit bookmark title and URL through the context menu");

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

  await page
    .locator(`.tree-row[data-id="${folderId}"]`)
    .click({ button: "right" });
  await page.locator('.tree-popover button[data-action="edit"]').click();
  assert.equal(
    await page.locator(".modal input[type='text']").nth(1).isHidden(),
    true,
  );
  await page
    .locator(".modal input[type='text']")
    .nth(0)
    .fill("E2E Folder Edited");
  await page.locator(".modal .button.primary").click();
  await page.getByText("E2E Folder Edited", { exact: true }).waitFor();
  const editedFolder = await page.evaluate(async (id) => {
    const [node] = await chrome.bookmarks.get(id);
    return { title: node?.title, hasUrl: Boolean(node?.url) };
  }, folderId);
  assert.deepEqual(editedFolder, {
    title: "E2E Folder Edited",
    hasUrl: false,
  });
  record("edit folder title through the context menu");

  await page.locator(`.tree-row[data-id="${bookmarkId}"] .tree-menu`).click();
  await page.locator('.popover button[data-action="move"]').click();
  await page.locator(".modal select").selectOption(folderId);
  await page.locator(".modal .button.primary").click();
  assert.equal(await page.locator(".tree-toggle").count(), 0);
  const folderIcon = page.locator(
    `.tree-row[data-id="${folderId}"] .node-icon.folder`,
  );
  const collapsedFolderIcon = await folderIcon.evaluate(
    (element) => globalThis.getComputedStyle(element).maskImage,
  );
  await folderIcon.click();
  await page.waitForFunction(
    (id) =>
      globalThis.document
        .querySelector(`.tree-row[data-id="${id}"]`)
        ?.getAttribute("aria-expanded") === "true",
    folderId,
  );
  assert.notEqual(
    await folderIcon.evaluate(
      (element) => globalThis.getComputedStyle(element).maskImage,
    ),
    collapsedFolderIcon,
  );
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
  await page.getByText("Popular Bookmark E2E", { exact: true }).waitFor();
  const sameLevelIconOffsets = await page.evaluate(
    ([folder, bookmark]) =>
      [folder, bookmark].map(
        (id) =>
          globalThis.document
            .querySelector(`.tree-row[data-id="${id}"] .node-icon`)
            ?.getBoundingClientRect().left,
      ),
    [folderId, externalIds[1]],
  );
  assert.equal(sameLevelIconOffsets[0], sameLevelIconOffsets[1]);
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

  const openSettings = async () => {
    await page.locator("#open-settings").click();
    await page.locator(".settings-card").waitFor();
  };
  const glassPanelSelectors = [
    "#bookmark-sidebar",
    ".sidebar-rail-button",
    "#web-search-input",
    ".open-settings-button",
    ".settings-card",
  ];
  const assertPanelStyles = async (selectors, expected) => {
    const actual = await page.evaluate((targetSelectors) => {
      return targetSelectors.map((selector) => {
        const element = globalThis.document.querySelector(selector);
        if (!element) {
          throw new Error(`Panel is missing: ${selector}`);
        }
        const style = globalThis.getComputedStyle(element);
        return {
          background: style.backgroundColor,
          blur: style.backdropFilter,
        };
      });
    }, selectors);
    assert.deepEqual(actual, expected);
  };

  await openSettings();
  assert.equal(
    await page
      .locator(".settings-card")
      .evaluate((element) => element.getAnimations().length > 0),
    true,
  );
  await page.locator(".settings-card").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const anchoredCard = await page.evaluate(() => {
    const card = globalThis.document.querySelector(".settings-card");
    const trigger = globalThis.document.querySelector("#open-settings");
    if (!card || !trigger) {
      throw new Error("Settings card is missing");
    }
    const cardRect = card.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    return {
      cardRight: cardRect.right,
      cardBottom: cardRect.bottom,
      triggerRight: triggerRect.right,
      triggerTop: triggerRect.top,
    };
  });
  assert.equal(anchoredCard.cardRight, anchoredCard.triggerRight);
  assert.ok(anchoredCard.cardBottom < anchoredCard.triggerTop);
  const exitStarted = await page.evaluate(() => {
    const card = globalThis.document.querySelector(".settings-card");
    globalThis.document.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        bubbles: true,
        key: "Escape",
      }),
    );
    return Boolean(card?.isConnected && card.classList.contains("is-closing"));
  });
  assert.equal(exitStarted, true);
  await page.locator(".settings-card").waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => globalThis.document.activeElement?.id),
    "open-settings",
  );
  await page.locator("#sidebar-menu").click();
  await page
    .locator(".sidebar-popover")
    .getByText("Settings", { exact: true })
    .click();
  await page.locator(".settings-card").waitFor();
  await page.locator(".settings-close").click();
  await page.locator(".settings-card").waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => globalThis.document.activeElement?.id),
    "sidebar-menu",
  );
  await openSettings();
  await page.locator("#bookmark-count").click();
  await page.locator(".settings-card").waitFor({ state: "detached" });
  record("anchored settings card opens from both entry points");

  const densityIds = await page.evaluate(async (parentId) => {
    const ids = [];
    for (let index = 0; index < 40; index += 1) {
      const node = await chrome.bookmarks.create({
        parentId,
        title: `Density Bookmark ${String(index).padStart(2, "0")}`,
        url: `https://example.com/density-${index}`,
      });
      ids.push(node.id);
    }
    return ids;
  }, bookmarkBarId);
  externalIds.push(...densityIds);
  await page.waitForFunction(
    () =>
      Number(
        globalThis.document.querySelector("#bookmark-count")?.textContent,
      ) >= 42,
  );

  const bottomBookmarkId = densityIds[densityIds.length - 1];
  const bottomBookmarkRow = page.locator(
    `.tree-row[data-id="${bottomBookmarkId}"]`,
  );
  await page.locator("#bookmark-tree").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await bottomBookmarkRow.waitFor();
  const bottomBookmarkBounds = await bottomBookmarkRow.boundingBox();
  assert.ok(bottomBookmarkBounds);
  await page.mouse.click(
    bottomBookmarkBounds.x + Math.min(120, bottomBookmarkBounds.width - 2),
    bottomBookmarkBounds.y + bottomBookmarkBounds.height - 2,
    { button: "right" },
  );
  const bottomPopover = await assertTreePopoverWithinViewport();
  const bottomRowBounds = await bottomBookmarkRow.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
  assert.ok(
    bottomPopover.top < bottomRowBounds.top,
    `Expected the menu above the bottom row: ${JSON.stringify({
      popover: bottomPopover,
      row: bottomRowBounds,
    })}`,
  );
  await page.locator("#bookmark-tree").evaluate((element) => {
    element.scrollTop -= 30;
  });
  await page.locator(".tree-popover").waitFor({ state: "detached" });
  record("context menu flips above bottom rows and closes on scroll");

  await page.locator("#toggle-bookmark-filter").click();
  await page.locator(".sidebar-header.is-filtering").waitFor();
  await page.locator("#bookmark-filter").fill("Density Bookmark 39");
  await page.waitForFunction(
    () => globalThis.document.querySelectorAll(".tree-row").length === 1,
  );
  await page.getByText("Density Bookmark 39", { exact: true }).waitFor();
  assert.equal(await page.locator(".tree-row").count(), 1);
  await page.locator("#close-bookmark-filter").click();
  await page
    .locator(".sidebar-header.is-filtering")
    .waitFor({ state: "detached" });
  await page.waitForFunction(
    () => globalThis.document.querySelectorAll(".tree-row").length > 1,
  );
  record("integrated sidebar bookmark filtering");

  await openSettings();
  assert.equal(
    await page.locator("#settings-panel-transparency").isDisabled(),
    true,
  );
  assert.equal(
    await page.locator("#settings-backdrop-blur").isDisabled(),
    true,
  );
  await assertPanelStyles(
    ["#bookmark-sidebar", "#web-search-input", ".settings-card"],
    [
      { background: "rgba(255, 255, 255, 0.8)", blur: "blur(7px)" },
      { background: "rgb(255, 255, 255)", blur: "none" },
      { background: "rgba(255, 255, 255, 0.8)", blur: "blur(7px)" },
    ],
  );
  await page.locator("#settings-search-provider").selectOption("bing");
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector("#web-search-input")
        ?.getAttribute("placeholder")
        ?.includes("Bing") === true,
  );
  await page.locator("#settings-search-provider").selectOption("custom");
  await page.waitForFunction(async () => {
    const stored = await chrome.storage.sync.get("settings");
    return stored.settings.search.provider === "custom";
  });
  const savedCustomUrl = await page.evaluate(async () => {
    const stored = await chrome.storage.sync.get("settings");
    return stored.settings.search.customSearchUrl;
  });
  await page.locator("#settings-custom-url").fill("not-a-search-url");
  await page.locator("#settings-custom-url").press("Tab");
  assert.equal(
    await page.locator("#settings-custom-url").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await page.evaluate(async () => {
      const stored = await chrome.storage.sync.get("settings");
      return stored.settings.search.customSearchUrl;
    }),
    savedCustomUrl,
  );
  await page.locator("#settings-search-provider").selectOption("bing");
  await page.locator("#settings-history-suggestions").uncheck();
  await page.locator("#settings-online-suggestions").uncheck();
  await page.locator("#settings-sidebar-collapsed").check();
  await page.locator("body.sidebar-collapsed").waitFor();
  await page.locator("#settings-sidebar-collapsed").uncheck();
  await page.locator("body.sidebar-collapsed").waitFor({ state: "detached" });
  await page.locator("#settings-sidebar-width").fill("400");
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector("#bookmark-sidebar")
        ?.getBoundingClientRect().width === 400,
  );

  await page.locator("#bookmark-tree").evaluate((element) => {
    element.scrollTop = 237;
  });
  await page.locator("#settings-sidebar-density").selectOption("compact");
  await page.waitForFunction(
    () =>
      globalThis.document.documentElement.dataset.sidebarDensity === "compact",
  );
  const compactLayout = await page.evaluate(() => {
    const rootStyle = globalThis.getComputedStyle(
      globalThis.document.documentElement,
    );
    const viewport = globalThis.document.querySelector("#bookmark-tree");
    const row = globalThis.document.querySelector(".tree-row");
    const header = globalThis.document.querySelector(".sidebar-header");
    const control = globalThis.document.querySelector(
      "#toggle-bookmark-filter",
    );
    const menu = globalThis.document.querySelector("#sidebar-menu");
    const count = globalThis.document.querySelector("#bookmark-count");
    const title = globalThis.document.querySelector(".sidebar-title > span");
    const icon = row?.querySelector(".node-icon");
    const controlIcon = control?.querySelector(".icon");
    if (
      !viewport ||
      !row ||
      !header ||
      !control ||
      !controlIcon ||
      !menu ||
      !count ||
      !title ||
      !icon
    ) {
      throw new Error("Bookmark rows are missing");
    }
    const center = (element) => {
      const bounds = element.getBoundingClientRect();
      return [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2];
    };
    const headerCenter = center(header);
    const controlCenter = center(control);
    const controlIconCenter = center(controlIcon);
    const menuBounds = menu.getBoundingClientRect();
    const menuBottomTarget = globalThis.document.elementFromPoint(
      menuBounds.left + menuBounds.width / 2,
      menuBounds.bottom - 1,
    );
    return {
      rowHeight: row.getBoundingClientRect().height,
      rowFontSize: globalThis.getComputedStyle(row).fontSize,
      iconSize: icon.getBoundingClientRect().width,
      headerHeight: rootStyle
        .getPropertyValue("--sidebar-header-height")
        .trim(),
      headerControlSize: control.getBoundingClientRect().width,
      headerIconSize: controlIcon.getBoundingClientRect().width,
      headerControlAligned:
        controlCenter[0] === controlIconCenter[0] &&
        controlCenter[1] === controlIconCenter[1] &&
        controlCenter[1] === headerCenter[1] + 4.5,
      menuBottomVisible:
        menuBottomTarget === menu || menu.contains(menuBottomTarget),
      menuMarginRight: globalThis.getComputedStyle(menu).marginRight,
      countFontSize: globalThis.getComputedStyle(count).fontSize,
      countFontWeight: globalThis.getComputedStyle(count).fontWeight,
      titleFontSize: globalThis.getComputedStyle(title).fontSize,
      titleFontWeight: globalThis.getComputedStyle(title).fontWeight,
      titleOpacity: globalThis.getComputedStyle(title).opacity,
      scrollTop: viewport.scrollTop,
    };
  });
  assert.deepEqual(compactLayout, {
    rowHeight: 26,
    rowFontSize: "12px",
    iconSize: 14,
    headerHeight: "36px",
    headerControlSize: 34,
    headerIconSize: 18,
    headerControlAligned: true,
    menuBottomVisible: true,
    menuMarginRight: "-2px",
    countFontSize: "18px",
    countFontWeight: "400",
    titleFontSize: "10.8px",
    titleFontWeight: "500",
    titleOpacity: "0.7",
    scrollTop: 165,
  });
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-settings.png"),
  });
  await page.locator(".settings-close").click();
  await page.reload();
  await page.waitForSelector("#app");
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector("#bookmark-sidebar")
        ?.getBoundingClientRect().width === 400,
  );
  const persistedSettings = await page.evaluate(async () => {
    const stored = await chrome.storage.sync.get("settings");
    return {
      density: stored.settings.appearance.sidebarDensity,
      width: globalThis.document
        .querySelector("#bookmark-sidebar")
        ?.getBoundingClientRect().width,
      history: stored.settings.search.historySuggestions,
      online: stored.settings.search.onlineSuggestions,
      provider: stored.settings.search.provider,
    };
  });
  assert.deepEqual(persistedSettings, {
    density: "compact",
    width: 400,
    history: false,
    online: false,
    provider: "bing",
  });
  assert.equal(await page.locator("#top-links, .top-link").count(), 0);
  record("settings apply immediately and persist valid values");

  await openSettings();
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
  await page.locator("#settings-background-file").setInputFiles({
    name: "background.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.locator("body.has-custom-background").waitFor();
  assert.equal(
    await page.locator("#settings-panel-transparency").isEnabled(),
    true,
  );
  assert.equal(await page.locator("#settings-backdrop-blur").isEnabled(), true);
  await page.locator("#settings-panel-transparency").fill("55");
  await page.locator("#settings-backdrop-blur").fill("18");
  await page.waitForFunction(async () => {
    const stored = await chrome.storage.sync.get("settings");
    return (
      stored.settings.appearance.panelTransparency === 55 &&
      stored.settings.appearance.backdropBlur === 18
    );
  });
  const lightGlassStyles = glassPanelSelectors.map(() => ({
    background: "rgba(255, 255, 255, 0.45)",
    blur: "blur(18px)",
  }));
  await assertPanelStyles(glassPanelSelectors, lightGlassStyles);
  await page.locator(".settings-card").press("Escape");
  await page.reload();
  await page.locator("body.has-custom-background").waitFor();
  await page.locator("#sidebar-menu").click();
  await page.locator(".sidebar-popover").waitFor();
  await assertGlassSurface(".sidebar-popover", {
    background: "rgba(255, 255, 255, 0.45)",
    blur: "blur(18px)",
    borderRadius: "6px",
  });
  await page.keyboard.press("Escape");
  await page.locator("#add-bookmark-item").click();
  await assertGlassSurface(".modal", {
    background: "rgba(255, 255, 255, 0.45)",
    blur: "blur(18px)",
    borderRadius: "6px",
  });
  await page.locator(".modal .button:not(.primary)").click();
  await openSettings();
  assert.equal(
    await page.locator("#settings-panel-transparency").inputValue(),
    "55",
  );
  assert.equal(
    await page.locator("#settings-backdrop-blur").inputValue(),
    "18",
  );
  await assertPanelStyles(glassPanelSelectors, lightGlassStyles);
  record("custom glass settings preview immediately and persist");

  await page.locator("#settings-theme").selectOption("dark");
  await page.waitForFunction(
    () =>
      globalThis.getComputedStyle(
        globalThis.document.querySelector("#bookmark-sidebar"),
      ).backgroundColor === "rgba(0, 0, 0, 0.45)",
  );
  const darkGlassStyles = glassPanelSelectors.map(() => ({
    background: "rgba(0, 0, 0, 0.45)",
    blur: "blur(18px)",
  }));
  await assertPanelStyles(glassPanelSelectors, darkGlassStyles);
  await page.locator("#settings-remove-background").click();
  await page
    .locator("body.has-custom-background")
    .waitFor({ state: "detached" });
  assert.equal(
    await page.locator("#settings-panel-transparency").isDisabled(),
    true,
  );
  assert.equal(
    await page.locator("#settings-backdrop-blur").isDisabled(),
    true,
  );
  await assertPanelStyles(
    ["#bookmark-sidebar", "#web-search-input", ".settings-card"],
    [
      { background: "rgba(0, 0, 0, 0.8)", blur: "blur(7px)" },
      { background: "rgb(77, 77, 77)", blur: "none" },
      { background: "rgba(0, 0, 0, 0.8)", blur: "blur(7px)" },
    ],
  );
  const retainedGlassSettings = await page.evaluate(async () => {
    const stored = await chrome.storage.sync.get("settings");
    return {
      panelTransparency: stored.settings.appearance.panelTransparency,
      backdropBlur: stored.settings.appearance.backdropBlur,
    };
  });
  assert.deepEqual(retainedGlassSettings, {
    panelTransparency: 55,
    backdropBlur: 18,
  });
  await page.locator("#settings-background-file").setInputFiles({
    name: "background.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.locator("body.has-custom-background").waitFor();
  assert.equal(
    await page.locator("#settings-panel-transparency").inputValue(),
    "55",
  );
  assert.equal(
    await page.locator("#settings-backdrop-blur").inputValue(),
    "18",
  );
  await assertPanelStyles(glassPanelSelectors, darkGlassStyles);
  await page.locator("#settings-remove-background").click();
  await page
    .locator("body.has-custom-background")
    .waitFor({ state: "detached" });
  await page.locator(".settings-card").press("Escape");
  await page.reload();
  await page.waitForSelector("#app");
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.getComputedStyle(globalThis.document.body).backgroundColor,
    ),
    "rgb(61, 61, 61)",
  );
  assert.deepEqual(
    await page
      .locator("#web-search-input")
      .evaluate((element) => [
        globalThis.getComputedStyle(element).color,
        globalThis.getComputedStyle(element, "::placeholder").color,
      ]),
    ["rgb(238, 238, 238)", "rgb(170, 170, 170)"],
  );
  await page.screenshot({
    path: path.join(screenshotsPath, "bookmark-home-dark.png"),
  });
  record("glass settings follow theme and survive background removal");

  await page.setViewportSize({ width: 640, height: 900 });
  await openSettings();
  await page.locator(".settings-card").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const narrowSettings = await page.evaluate(() => {
    const card = globalThis.document.querySelector(".settings-card");
    const grid = globalThis.document.querySelector(".settings-grid");
    if (!card || !grid) {
      throw new Error("Narrow settings layout is missing");
    }
    const bounds = card.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      columns: globalThis.getComputedStyle(grid).gridTemplateColumns.split(" ")
        .length,
    };
  });
  assert.ok(narrowSettings.left >= 12);
  assert.ok(narrowSettings.right <= 628);
  assert.equal(narrowSettings.columns, 1);
  await page.locator(".settings-card").press("Escape");
  await page.locator(".settings-card").waitFor({ state: "detached" });
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

  await page.evaluate(async () => {
    const stored = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({
      settings: {
        ...stored.settings,
        search: { ...stored.settings.search, provider: "google" },
      },
    });
  });
  await page
    .locator("#web-search-input")
    .getAttribute("placeholder")
    .then((placeholder) =>
      assert.equal(placeholder, "Search Google or enter an address"),
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
        "screenshots/bookmark-home-settings.png",
        "screenshots/bookmark-home-narrow.png",
      ],
      passed: checks.length,
    },
    null,
    2,
  )}\n`,
);
console.log(`E2E passed: ${checks.length} observable checks`);

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  persistHomeDraftWithRollback,
  sanitizeHomeBackground,
  sanitizeSettings,
} from "./settings";

test("SettingsV1 migration keeps valid preferences", () => {
  const settings = sanitizeSettings({
    version: 1,
    appearance: {
      theme: "dark",
      sidebarWidth: 900,
      sidebarCollapsed: true,
    },
    search: {
      provider: "bing",
      customName: 12,
      customSearchUrl: "https://example.com/?q={query}",
      historySuggestions: false,
      onlineSuggestions: true,
    },
  });

  assert.deepEqual(settings, {
    version: 2,
    appearance: {
      theme: "dark",
      sidebarWidth: 480,
      sidebarCollapsed: true,
    },
    search: {
      provider: "bing",
      customName: "",
      customSearchUrl: "https://example.com/?q={query}",
      historySuggestions: false,
      onlineSuggestions: true,
    },
  });
});

test("invalid persisted values fall back to safe defaults", () => {
  const settings = sanitizeSettings({
    appearance: {
      theme: "neon",
      sidebarWidth: Number.NaN,
      sidebarCollapsed: "yes",
    },
    search: {
      provider: "unknown",
      customSearchUrl: null,
      historySuggestions: "yes",
    },
  });

  assert.deepEqual(settings, DEFAULT_SETTINGS);
  assert.notEqual(settings, DEFAULT_SETTINGS);
});

test("removed home link settings are discarded", () => {
  const settings = sanitizeSettings({
    home: {
      topLinks: [
        { id: "one", title: "One", url: "https://example.com" },
        { id: "duplicate", title: "Duplicate", url: "https://example.com/" },
        { id: "unsafe", title: "Unsafe", url: "javascript:alert(1)" },
      ],
      grid: {
        mode: "custom",
        columns: 99,
        rows: -5,
        customLinks: [
          { id: "two", title: "Two", url: "http://example.org/path" },
        ],
      },
    },
  });

  assert.equal("home" in settings, false);
});

test("background rejects unsupported persisted data", () => {
  assert.equal(
    sanitizeHomeBackground({
      version: 1,
      dataUrl: "data:image/png;base64,AAAA",
      updatedAt: 1,
    }),
    null,
  );
});

test("failed home draft persistence restores settings and background", async () => {
  const previous = structuredClone(DEFAULT_SETTINGS);
  const next = structuredClone(DEFAULT_SETTINGS);
  next.search.provider = "bing";
  const calls: string[] = [];
  let failBackground = true;

  await assert.rejects(
    persistHomeDraftWithRollback(
      {
        saveSettings: (settings) => {
          calls.push(`settings:${settings.search.provider}`);
          return Promise.resolve();
        },
        saveBackground: (background) => {
          calls.push(`background:${background ? "set" : "empty"}`);
          if (failBackground) {
            failBackground = false;
            return Promise.reject(new Error("quota"));
          }
          return Promise.resolve();
        },
      },
      next,
      { version: 1, dataUrl: "data:image/webp;base64,AAAA", updatedAt: 2 },
      previous,
      null,
    ),
  );

  assert.deepEqual(calls, [
    "settings:bing",
    "background:set",
    "settings:google",
    "background:empty",
  ]);
});

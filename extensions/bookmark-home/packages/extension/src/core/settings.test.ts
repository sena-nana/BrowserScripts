import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  sanitizeHomeBackground,
  sanitizeSettings,
} from "./settings";

test("legacy settings migrate valid preferences to SettingsV3", () => {
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
    version: 3,
    appearance: {
      theme: "dark",
      sidebarWidth: 480,
      sidebarCollapsed: true,
      sidebarDensity: "standard",
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

test("SettingsV2 migration defaults to the standard sidebar density", () => {
  const settings = sanitizeSettings({
    version: 2,
    appearance: {
      theme: "light",
      sidebarWidth: 320,
      sidebarCollapsed: false,
    },
  });

  assert.equal(settings.version, 3);
  assert.equal(settings.appearance.sidebarDensity, "standard");
});

test("SettingsV3 preserves a valid sidebar density", () => {
  const settings = sanitizeSettings({
    version: 3,
    appearance: {
      theme: "system",
      sidebarWidth: 350,
      sidebarCollapsed: false,
      sidebarDensity: "relaxed",
    },
  });

  assert.equal(settings.appearance.sidebarDensity, "relaxed");
});

test("invalid persisted values fall back to safe defaults", () => {
  const settings = sanitizeSettings({
    appearance: {
      theme: "neon",
      sidebarWidth: Number.NaN,
      sidebarCollapsed: "yes",
      sidebarDensity: "tiny",
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

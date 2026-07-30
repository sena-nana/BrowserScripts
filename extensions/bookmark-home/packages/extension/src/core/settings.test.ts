import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  sanitizeHomeBackground,
  sanitizeSettings,
} from "./settings";

test("SettingsV4 preserves valid appearance values", () => {
  const settings = sanitizeSettings({
    version: 4,
    appearance: {
      theme: "system",
      sidebarWidth: 350,
      sidebarCollapsed: false,
      sidebarDensity: "relaxed",
      panelTransparency: 55,
      backdropBlur: 18,
    },
  });

  assert.equal(settings.appearance.sidebarDensity, "relaxed");
  assert.equal(settings.appearance.panelTransparency, 55);
  assert.equal(settings.appearance.backdropBlur, 18);
});

test("appearance ranges are rounded and bounded", () => {
  const settings = sanitizeSettings({
    version: 4,
    appearance: {
      panelTransparency: 120.6,
      backdropBlur: -2.4,
    },
  });

  assert.equal(settings.appearance.panelTransparency, 90);
  assert.equal(settings.appearance.backdropBlur, 0);
});

test("invalid persisted values fall back to safe defaults", () => {
  const settings = sanitizeSettings({
    version: 4,
    appearance: {
      theme: "neon",
      sidebarWidth: Number.NaN,
      sidebarCollapsed: "yes",
      sidebarDensity: "tiny",
      panelTransparency: Number.POSITIVE_INFINITY,
      backdropBlur: "7",
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

test("unsupported settings schemas reset to current defaults", () => {
  const settings = sanitizeSettings({
    version: 0,
    appearance: {
      theme: "dark",
    },
  });

  assert.deepEqual(settings, DEFAULT_SETTINGS);
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

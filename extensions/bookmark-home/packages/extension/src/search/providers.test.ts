import assert from "node:assert/strict";
import test from "node:test";

import type { SettingsV4, Suggestion } from "../core/types";
import {
  buildSearchUrl,
  directNavigationUrl,
  isValidCustomSearchUrl,
  parseBaiduSuggestions,
  parseBingSuggestions,
  parseGoogleSuggestions,
  resolveSearchInput,
} from "./providers";
import { mergeSuggestions } from "./suggestion-engine";

const searchSettings: SettingsV4["search"] = {
  provider: "google",
  customName: "",
  customSearchUrl: "https://example.com/?q={query}",
  historySuggestions: true,
  onlineSuggestions: true,
};

test("search input distinguishes safe addresses from queries", () => {
  assert.equal(
    directNavigationUrl("example.com/docs"),
    "https://example.com/docs",
  );
  assert.equal(
    directNavigationUrl("https://example.com/a"),
    "https://example.com/a",
  );
  assert.equal(directNavigationUrl("javascript:alert(1)"), null);
  assert.equal(directNavigationUrl("data:text/plain,no"), null);
  assert.equal(
    resolveSearchInput("bookmark manager", searchSettings),
    "https://www.google.com/search?q=bookmark%20manager",
  );
});

test("custom search templates require HTTPS and a query placeholder", () => {
  assert.equal(
    isValidCustomSearchUrl("https://search.example/?q={query}"),
    true,
  );
  assert.equal(
    isValidCustomSearchUrl("http://search.example/?q={query}"),
    false,
  );
  assert.equal(isValidCustomSearchUrl("https://search.example/"), false);
  assert.equal(
    buildSearchUrl("a b", {
      ...searchSettings,
      provider: "custom",
      customSearchUrl: "https://search.example/?q={query}",
    }),
    "https://search.example/?q=a%20b",
  );
});

test("provider response adapters return suggestion text without executing JSONP", () => {
  assert.deepEqual(parseGoogleSuggestions(["a", ["alpha", "atlas"]]), [
    "alpha",
    "atlas",
  ]);
  assert.deepEqual(parseBingSuggestions(["a", ["alpha"]]), ["alpha"]);
  assert.deepEqual(
    parseBaiduSuggestions('bookmarkHome({"q":"a","s":["alpha","atlas"]});'),
    ["alpha", "atlas"],
  );
  assert.deepEqual(parseBaiduSuggestions("alert(1)"), []);
});

test("suggestion merging ranks local navigation and removes duplicates", () => {
  const groups: Suggestion[][] = [
    [
      {
        id: "online:one",
        source: "online",
        title: "Example",
        query: "Example",
        score: 100,
      },
    ],
    [
      {
        id: "history:one",
        source: "history",
        title: "Example",
        url: "https://example.com/",
        score: 210,
      },
      {
        id: "bookmark:one",
        source: "bookmark",
        title: "Example bookmark",
        url: "https://example.com",
        score: 320,
      },
    ],
  ];

  const merged = mergeSuggestions(groups);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["bookmark:one", "online:one"],
  );
});

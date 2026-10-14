/**
 * Okpyeon: the worker's Firefox paths (SPEC "Firefox and the English name").
 *
 * Runs in its own process because the worker wires its listeners when the
 * module is first evaluated: the stubs below must exist before the import,
 * and test/lookup.test.mjs imports the same module with no browser globals at
 * all. The stubs model Firefox: `chrome` without sidePanel, and `browser`
 * with sidebarAction. Run: node test/firefox.test.mjs
 */
import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${err && err.message ? err.message : err}`);
  }
}

const listeners = {};
const tabCalls = [];
globalThis.chrome = {
  runtime: {
    onMessage: { addListener(fn) { listeners.message = fn; } },
    onInstalled: { addListener() {} },
    getURL: (path) => `moz-extension://okpyeon/${path}`,
    sendMessage: () => Promise.resolve(),
  },
  omnibox: {
    setDefaultSuggestion() {},
    onInputChanged: { addListener(fn) { listeners.changed = fn; } },
    onInputEntered: { addListener(fn) { listeners.entered = fn; } },
  },
  action: { onClicked: { addListener(fn) { listeners.clicked = fn; } } },
  tabs: {
    create(options) { tabCalls.push(["create", options]); },
    update(options) { tabCalls.push(["update", options]); },
  },
};

// open() behaviour is swapped per test; toggles are counted.
let openImpl = () => Promise.resolve();
let openCalls = 0;
let toggles = 0;
globalThis.browser = {
  sidebarAction: {
    open: () => { openCalls += 1; return openImpl(); },
    toggle: () => { toggles += 1; return Promise.resolve(); },
  },
};

const bg = await import("../extension/background.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

await test("firefoxSidebar finds sidebarAction when chrome.sidePanel is absent", () => {
  assert.equal(bg.firefoxSidebar(), globalThis.browser.sidebarAction);
});

await test("firefoxSidebar is null whenever chrome.sidePanel exists (Chrome)", () => {
  globalThis.chrome.sidePanel = {};
  try {
    assert.equal(bg.firefoxSidebar(), null);
  } finally {
    delete globalThis.chrome.sidePanel;
  }
});

await test("the worker wires the toolbar and omnibox listeners", () => {
  assert.equal(typeof listeners.clicked, "function");
  assert.equal(typeof listeners.entered, "function");
});

await test("toolbar click toggles the sidebar synchronously", () => {
  const before = toggles;
  listeners.clicked();
  assert.equal(toggles, before + 1);
});

await test("omnibox Enter opens the sidebar synchronously with the query pending", async () => {
  await bg.handleGetPendingQuery();          // start clean
  tabCalls.length = 0;
  const before = openCalls;
  openImpl = () => Promise.resolve();
  listeners.entered("국민", "currentTab");
  assert.equal(openCalls, before + 1, "open() ran inside the handler, before any await");
  await settle();
  const pending = await bg.handleGetPendingQuery();
  assert.equal(pending.query, "국민");
  assert.equal(tabCalls.length, 0, "no tab when the sidebar opened");
});

await test("a rejected open() clears the query and opens the search tab", async () => {
  await bg.handleGetPendingQuery();
  tabCalls.length = 0;
  openImpl = () => Promise.reject(new Error("not a user action"));
  listeners.entered("국민", "newForegroundTab");
  await settle();
  const pending = await bg.handleGetPendingQuery();
  assert.equal(pending.query, null);
  assert.equal(tabCalls.length, 1);
  assert.equal(tabCalls[0][0], "create");
  assert.match(tabCalls[0][1].url, /^moz-extension:\/\/okpyeon\/sidepanel\/sidepanel\.html\?q=/);
  assert.equal(tabCalls[0][1].active, true);
});

await test("a throwing open() falls back the same way, honouring currentTab", async () => {
  await bg.handleGetPendingQuery();
  tabCalls.length = 0;
  openImpl = () => { throw new Error("no gesture"); };
  listeners.entered("하늘", "currentTab");
  await settle();
  const pending = await bg.handleGetPendingQuery();
  assert.equal(pending.query, null);
  assert.deepEqual(tabCalls.map((c) => c[0]), ["update"]);
  assert.match(tabCalls[0][1].url, /q=%ED%95%98%EB%8A%98$/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

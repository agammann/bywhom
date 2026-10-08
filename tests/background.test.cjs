const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness(executeScript) {
  const events = {};
  const calls = [];
  const chrome = {
    action: { onClicked: { addListener: (fn) => { events.click = fn; } } },
    sidePanel: { open: (options) => { calls.push(['open', options]); return Promise.resolve(); } },
    scripting: { executeScript: (options) => { calls.push(['executeScript', options]); return executeScript(options); } },
    tabs: {
      onUpdated: { addListener: (fn) => { events.updated = fn; } },
      onActivated: { addListener: (fn) => { events.activated = fn; } },
      onRemoved: { addListener: (fn) => { events.removed = fn; } },
    },
    runtime: {
      sendMessage: (message) => { calls.push(['message', message]); return Promise.resolve(); },
      onMessage: { addListener: (fn) => { events.message = fn; } },
    },
  };
  vm.runInNewContext(source, { chrome, Promise, Number, String, Error, Array, Object }, { filename: 'background.js' });
  let state;
  const readState = () => {
    events.message({ type: 'BYWHOM_GET_STATE' }, {}, (value) => { state = value; });
    return state;
  };
  return { events, calls, readState };
}

test('only the action click injects, and capture starts before opening the panel', async () => {
  const h = harness(() => Promise.resolve([{ result: { url: 'https://example.org/story', visibleLines: [] } }]));
  assert.equal(h.calls.length, 0);
  h.events.click({ id: 3, windowId: 8, url: 'https://example.org/story' });
  assert.deepEqual(h.calls.slice(0, 3).map(([name]) => name), ['message', 'executeScript', 'open']);
  assert.equal(h.calls[1][1].target.tabId, 3);
  assert.deepEqual(Array.from(h.calls[1][1].files), ['capture.js']);
  await flush();
  assert.equal(h.readState().kind, 'ready');
});

test('navigation clears old capture without rereading', async () => {
  const h = harness(() => Promise.resolve([{ result: { url: 'https://example.org/a', visibleLines: [] } }]));
  h.events.click({ id: 3, windowId: 8, url: 'https://example.org/a' });
  await flush();
  const before = h.calls.filter(([name]) => name === 'executeScript').length;
  h.events.updated(3, { status: 'loading', url: 'https://other.example/b' });
  assert.equal(h.readState().kind, 'stale');
  assert.equal(h.readState().capture, null);
  assert.equal(h.calls.filter(([name]) => name === 'executeScript').length, before);
});

test('restricted pages open the paste fallback without injection', async () => {
  const h = harness(() => { throw new Error('Should not inject'); });
  h.events.click({ id: 9, windowId: 8, url: 'chrome://settings/' });
  await flush();
  assert.equal(h.calls.filter(([name]) => name === 'executeScript').length, 0);
  assert.equal(h.calls.filter(([name]) => name === 'open').length, 1);
  assert.equal(h.readState().kind, 'error');
  assert.equal(h.readState().capture, null);
});

test('a late first capture cannot replace a later invocation', async () => {
  let resolveFirst;
  let number = 0;
  const h = harness(() => ++number === 1 ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve([{ result: { url: 'https://example.org/second', visibleLines: [] } }]));
  h.events.click({ id: 3, windowId: 8, url: 'https://example.org/first' });
  h.events.click({ id: 3, windowId: 8, url: 'https://example.org/second' });
  await flush();
  resolveFirst([{ result: { url: 'https://example.org/first', visibleLines: [] } }]);
  await flush();
  assert.equal(h.readState().capture.url, 'https://example.org/second');
});

test('Clear drops in-memory page capture', async () => {
  const h = harness(() => Promise.resolve([{ result: { url: 'https://example.org/story', visibleLines: [] } }]));
  h.events.click({ id: 3, windowId: 8, url: 'https://example.org/story' });
  await flush();
  h.events.message({ type: 'BYWHOM_CLEAR' }, {}, () => {});
  assert.equal(h.readState().kind, 'idle');
  assert.equal(h.readState().capture, null);
});

// Exercises ByWhom's real MV3 action through Chromium's browser-level
// Extensions.triggerAction DevTools command. Never loads normal Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const browserCache = path.resolve(extensionRoot, '..', '.playwright-browsers-bywhom');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browserCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
function loadPlaywright() {
  try { return require('playwright'); } catch (error) {
    const fallback = process.env.PLAYWRIGHT_MODULE_PATH ||
      path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright');
    try { return require(fallback); } catch { throw error; }
  }
}
const { chromium } = loadPlaywright();

const qaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bywhom-action-gesture-'));
const errors = [];
const externalRequests = [];
const results = [];
let context;
let server;

function page(title, body) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title><body><main><article>${body}</article></main></body></html>`;
}
const fixtures = new Map([
  ['/wusf', page('WUSF gesture fixture', '<p class="byline">WUSF | By Darius Tahir - KFF Health News</p><p id="selection">First selection sentinel.</p><p id="other">Second selection sentinel.</p>')],
  ['/second', page('Second gesture fixture', '<p class="byline">By Second Writer</p><p id="selection">New page sentinel.</p>')],
]);

async function waitState(worker, wanted, timeout = 7000) {
  const deadline = Date.now() + timeout;
  let state;
  do {
    state = await worker.evaluate(() => state);
    if (wanted(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 75));
  } while (Date.now() < deadline);
  throw new Error(`Worker state timeout: ${JSON.stringify(state)}`);
}

async function waitActionListener(worker) {
  const deadline = Date.now() + 5000;
  do {
    if (await worker.evaluate(() => chrome.action.onClicked.hasListeners())) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error('Extension action listener was not registered');
}

async function step(name, test) {
  try {
    const detail = await test();
    results.push({ name, status: 'pass', detail });
    process.stdout.write(`PASS ${name}${detail ? `: ${detail}` : ''}\n`);
  } catch (error) {
    const detail = String(error?.stack || error);
    results.push({ name, status: 'fail', detail });
    process.stdout.write(`FAIL ${name}: ${detail}\n`);
  }
}

async function selectText(tab, id) {
  await tab.evaluate((targetId) => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById(targetId));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, id);
}

async function targetIdFor(browserSession, url) {
  // The default CDP target filter excludes browser and tab targets.
  const response = await browserSession.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
  const target = response.targetInfos.find((item) => item.type === 'tab' && item.url === url);
  if (!target) throw new Error(`No CDP page target for ${url}; seen ${response.targetInfos.map((item) => `${item.type}:${item.url}`).join(', ')}`);
  return target.targetId;
}

async function main() {
  server = http.createServer((request, response) => {
    if (request.url === '/favicon.ico') return response.writeHead(204).end();
    const content = fixtures.get(request.url);
    if (!content) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(content);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  context = await chromium.launchPersistentContext(path.join(qaRoot, 'profile'), {
    channel: 'chromium', headless: true, chromiumSandbox: true,
    args: [
      '--enable-unsafe-extension-debugging',
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
    ],
  });
  context.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  context.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('chrome-extension://') && !url.startsWith('data:') && !url.startsWith('chrome://')) externalRequests.push(url);
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  await waitActionListener(worker);
  const extensionId = new URL(worker.url()).hostname;
  const tab = await context.newPage();
  const browserSession = await context.browser().newBrowserCDPSession();
  tab.on('pageerror', (error) => errors.push(String(error)));

  let protocolSupported = false;
  await step('CDP action invocation captures selected WUSF page', async () => {
    await tab.goto(`${base}/wusf`);
    await tab.bringToFront();
    await selectText(tab, 'selection');
    const targetId = await targetIdFor(browserSession, tab.url());
    try {
      await browserSession.send('Extensions.triggerAction', { id: extensionId, targetId });
      protocolSupported = true;
    } catch (error) {
      throw new Error(`Extensions.triggerAction unsupported or rejected: ${error?.message || error}`);
    }
    const state = await waitState(worker, (item) => item?.kind === 'ready' || item?.kind === 'error');
    assert.equal(state.kind, 'ready', JSON.stringify(state));
    assert.equal(state.capture.selection, 'First selection sentinel.');
    assert(state.capture.visibleLines.some((line) => line.text === 'WUSF | By Darius Tahir - KFF Health News'));
    assert.equal(state.capture.url, tab.url());
    return `real onClicked -> executeScript; selection retained; tabId ${state.tabId}`;
  });

  if (protocolSupported) {
    await step('second action refreshes selected text', async () => {
      await selectText(tab, 'other');
      const before = await worker.evaluate(() => generation);
      await browserSession.send('Extensions.triggerAction', { id: extensionId, targetId: await targetIdFor(browserSession, tab.url()) });
      const state = await waitState(worker, (item) => item?.kind === 'ready' && item.capture?.selection === 'Second selection sentinel.');
      assert.equal(await worker.evaluate(() => generation), before + 1);
      return `generation ${before} -> ${before + 1}`;
    });

    await step('navigation clears old capture, next action reads new page', async () => {
      await tab.goto(`${base}/second`);
      const stale = await waitState(worker, (item) => item?.kind === 'stale');
      assert.equal(stale.capture, null);
      await selectText(tab, 'selection');
      await browserSession.send('Extensions.triggerAction', { id: extensionId, targetId: await targetIdFor(browserSession, tab.url()) });
      const ready = await waitState(worker, (item) => item?.kind === 'ready' && item.capture?.url === tab.url());
      assert.equal(ready.capture.selection, 'New page sentinel.');
      assert(ready.capture.visibleLines.some((line) => line.text === 'By Second Writer'));
      return 'stale on navigation, new page captured only after action';
    });

    await step('restricted chrome page gives paste fallback', async () => {
      await tab.goto('chrome://settings/');
      await tab.bringToFront();
      await browserSession.send('Extensions.triggerAction', { id: extensionId, targetId: await targetIdFor(browserSession, tab.url()) });
      const state = await waitState(worker, (item) => item?.kind === 'error');
      assert.equal(state.capture, null);
      assert.match(state.message, /paste/i);
      return state.message;
    });

    await step('side panel opened on action', async () => {
      const targets = (await browserSession.send('Target.getTargets')).targetInfos;
      const panelTargets = targets.filter((item) => item.url.startsWith(`chrome-extension://${extensionId}/panel.html`));
      assert(panelTargets.length > 0, `No side panel target; targets: ${targets.map((item) => `${item.type}:${item.url}`).join(', ')}`);
      return `${panelTargets.length} extension panel target(s): ${panelTargets.map((item) => item.type).join(', ')}`;
    });
  }

  await step('console and network health', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
    return 'no console/page errors or external requests';
  });
  process.stdout.write(`RESULT ${JSON.stringify({ passed: results.filter((item) => item.status === 'pass').length, failed: results.filter((item) => item.status === 'fail').length, protocolSupported, qaRoot })}\n`);
  if (results.some((item) => item.status === 'fail')) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`HARNESS ERROR ${error?.stack || error}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (context) await context.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
});

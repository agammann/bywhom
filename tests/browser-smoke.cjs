// Isolated browser smoke checks for the unpacked ByWhom MV3 extension.
// Capture is evaluated on local fixtures and BYWHOM_STATE is sent from the
// extension worker to its panel. Those are simulations, not a toolbar click.
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

const captureSource = fs.readFileSync(path.join(extensionRoot, 'capture.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
const qaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bywhom-extension-smoke-'));
const checks = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const externalRequests = [];
let context;
let server;

function documentPage(title, head, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body><main><article>${body}</article></main></body></html>`;
}

const fixtures = new Map([
  ['/wusf', documentPage('WUSF local fixture', '',
    '<p class="byline">WUSF | By Darius Tahir - KFF Health News</p><p id="selection">Article body selection sentinel.</p>')],
  ['/conflict', documentPage('Conflicting local fixture',
    '<meta name="author" content="Mae Metadata"><meta property="og:site_name" content="Example Daily"><script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","author":{"@type":"Person","name":"Mae Metadata"}}</script>',
    '<p class="byline">By Vera Visible</p><p>Conflict fixture article body.</p>')],
  ['/origin', documentPage('Republication local fixture', '',
    '<p class="byline">By Avery Sample</p><p>This piece was republished from Example Review under a Creative Commons licence.</p>')],
  ['/editor', documentPage('NASA local fixture', '',
    '<p>NASA</p><p>Dec 07, 2021</p><p>RELEASE 21-166</p><p>Page Editor:</p><p class="author">Beth Ridgeway</p><p>Illustration by Oona Zenda</p>')],
  ['/hidden', documentPage('Hidden byline local fixture', '',
    '<p style="display:none">By Phantom Writer</p><p class="byline" aria-hidden="true">By Ghost Writer</p><p>Ordinary story body.</p>')],
  ['/second', documentPage('Second page local fixture', '',
    '<p class="byline">By Second Writer</p><p>Navigation sentinel.</p>')],
]);

async function step(name, test) {
  try {
    const detail = await test();
    checks.push({ name, status: 'pass', detail });
    process.stdout.write(`PASS ${name}${detail ? `: ${detail}` : ''}\n`);
    return detail;
  } catch (error) {
    const message = String(error?.stack || error);
    checks.push({ name, status: 'fail', detail: message });
    process.stdout.write(`FAIL ${name}: ${message}\n`);
    return undefined;
  }
}

function creditCard(panel, field) {
  return panel.locator(`.credit-card[data-field="${field}"]`);
}

async function sendState(worker, panel, state) {
  await worker.evaluate((payload) => {
    chrome.runtime.sendMessage({ type: 'BYWHOM_STATE', state: payload }).catch(() => {});
  }, state);
  await panel.waitForFunction((kind) => {
    const tag = document.getElementById('case-tag')?.textContent;
    return kind === 'ready' ? tag === 'PAGE READ' : kind === 'stale' ? tag === 'PAGE CHANGED' : tag === 'PASTE FALLBACK';
  }, state.kind);
}

function captureOn(page) {
  // DevTools evaluates the same bundled one-shot IIFE on a fixture page.
  // This checks the reader and engine, but does not grant activeTab.
  return page.evaluate(captureSource);
}

async function main() {
  await step('manifest has narrow permissions', async () => {
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'sidePanel'].sort());
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.content_scripts, undefined);
    assert.equal(manifest.action?.default_popup, undefined);
    return manifest.permissions.join(', ');
  });

  server = http.createServer((request, response) => {
    if (request.url === '/favicon.ico') return response.writeHead(204).end();
    const body = fixtures.get(request.url);
    if (!body) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  context = await chromium.launchPersistentContext(path.join(qaRoot, 'profile'), {
    channel: 'chromium', headless: true, chromiumSandbox: true,
    viewport: { width: 1180, height: 850 },
    args: [
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
    ],
  });
  context.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  context.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  context.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('chrome-extension://') && !url.startsWith('data:')) externalRequests.push(url);
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).hostname;
  const fixturePage = await context.newPage();
  const panel = await context.newPage();
  for (const page of [fixturePage, panel]) page.on('pageerror', (error) => pageErrors.push(String(error)));
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel.locator('.credit-card').first().waitFor();

  let wusfCapture;
  await step('WUSF visible credit and selection capture', async () => {
    await fixturePage.goto(`${base}/wusf`);
    await fixturePage.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('selection'));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    });
    wusfCapture = await captureOn(fixturePage);
    assert.equal(wusfCapture.selection, 'Article body selection sentinel.');
    assert(wusfCapture.visibleLines.some((line) => line.text === 'WUSF | By Darius Tahir - KFF Health News'));
    assert.equal(wusfCapture.metadataAuthors.length, 0);
    await sendState(worker, panel, { kind: 'ready', capture: wusfCapture, message: 'Page read at your request.' });
    assert.match(await creditCard(panel, 'writer').innerText(), /Darius Tahir/);
    assert.match(await creditCard(panel, 'host').innerText(), /WUSF/);
    assert.match(await creditCard(panel, 'origin').innerText(), /Unknown/);
    assert.equal(await panel.locator('#selection-preview').innerText(), 'Article body selection sentinel.');
    return 'writer Darius Tahir; host WUSF; origin unknown';
  });

  await step('evidence dialog keyboard and focus restoration', async () => {
    const button = creditCard(panel, 'writer').getByRole('button', { name: 'Show evidence' });
    await button.focus();
    await panel.keyboard.press('Enter');
    assert.equal(await panel.locator('#evidence-dialog').evaluate((node) => node.open), true);
    assert.equal(await panel.locator('#evidence-content blockquote').first().innerText(), 'WUSF | By Darius Tahir - KFF Health News');
    assert.match(await panel.locator('#evidence-content small').first().innerText(), /Visible page text/);
    await panel.keyboard.press('Escape');
    await panel.waitForFunction(() => !document.getElementById('evidence-dialog').open);
    await panel.waitForFunction(() => document.activeElement?.classList.contains('evidence-button'));
    return 'Enter opens; Escape closes; focus returns to trigger';
  });

  await step('visible and metadata author conflict remains labeled', async () => {
    await fixturePage.goto(`${base}/conflict`);
    const capture = await captureOn(fixturePage);
    assert(capture.metadataAuthors.some((item) => item.name === 'Mae Metadata'));
    assert(capture.visibleLines.some((item) => item.text === 'By Vera Visible'));
    await sendState(worker, panel, { kind: 'ready', capture, message: 'Page read at your request.' });
    const writer = await creditCard(panel, 'writer').innerText();
    assert.match(writer, /Conflicting claims/i);
    assert.match(writer, /Vera Visible/);
    assert.match(writer, /Mae Metadata/);
    await creditCard(panel, 'writer').getByRole('button', { name: 'Show evidence' }).click();
    const sourceText = await panel.locator('#evidence-content').innerText();
    assert.match(sourceText, /Visible page text/);
    assert.match(sourceText, /Article metadata/);
    await panel.getByRole('button', { name: 'Close evidence' }).click();
    return 'both claims and their distinct evidence sources visible';
  });

  await step('explicit republication origin and editor unknown', async () => {
    await fixturePage.goto(`${base}/origin`);
    const originCapture = await captureOn(fixturePage);
    await sendState(worker, panel, { kind: 'ready', capture: originCapture, message: 'Page read at your request.' });
    assert.match(await creditCard(panel, 'writer').innerText(), /Avery Sample/);
    assert.match(await creditCard(panel, 'origin').innerText(), /Example Review/);
    assert.match(await creditCard(panel, 'host').innerText(), /Unknown/);
    await fixturePage.goto(`${base}/editor`);
    const editorCapture = await captureOn(fixturePage);
    await sendState(worker, panel, { kind: 'ready', capture: editorCapture, message: 'Page read at your request.' });
    assert.match(await creditCard(panel, 'writer').innerText(), /Unknown/);
    assert.doesNotMatch(await creditCard(panel, 'writer').innerText(), /Beth Ridgeway|Oona Zenda/);
    return 'origin credited; Page Editor and illustrator not promoted to writer';
  });

  await step('hidden bylines omitted by page capture', async () => {
    await fixturePage.goto(`${base}/hidden`);
    const capture = await captureOn(fixturePage);
    assert(!capture.visibleLines.some((line) => /Phantom Writer|Ghost Writer/.test(line.text)));
    await sendState(worker, panel, { kind: 'ready', capture, message: 'Page read at your request.' });
    assert.match(await creditCard(panel, 'writer').innerText(), /Unknown/);
    return 'display:none and aria-hidden credits ignored';
  });

  await step('hostile evidence is rendered as text', async () => {
    const payload = '<img src=x onerror="window.__bywhomXss=1">';
    const capture = {
      url: `${base}/wusf`, title: 'Adversarial local fixture', selection: '', visibleLines: [],
      metadataAuthors: [{ name: 'Jane Doe', evidence: payload, where: `metadata: ${payload}` }],
      metadataSiteNames: [],
    };
    await sendState(worker, panel, { kind: 'ready', capture, message: 'Page read at your request.' });
    await creditCard(panel, 'writer').getByRole('button', { name: 'Show evidence' }).click();
    assert.equal(await panel.locator('#evidence-content img').count(), 0);
    assert.equal(await panel.evaluate(() => window.__bywhomXss), undefined);
    assert.match(await panel.locator('#evidence-content blockquote').first().innerText(), /<img src=x/);
    await panel.keyboard.press('Escape');
    return 'malicious markup stays inert in metadata evidence';
  });

  await step('paste fallback, repeated submit, and Clear', async () => {
    const input = panel.locator('#article-text');
    await input.fill('By First Writer\nOriginally published by Local Ledger');
    await panel.locator('#context-url').fill('https://example.test/story');
    await panel.getByRole('button', { name: 'Follow the credits' }).click();
    assert.match(await creditCard(panel, 'writer').innerText(), /First Writer/);
    assert.match(await creditCard(panel, 'origin').innerText(), /Local Ledger/);
    assert.match(await creditCard(panel, 'host').innerText(), /Unknown/);
    assert.equal(await panel.locator('#case-tag').innerText(), 'PASTED TEXT ONLY');
    await input.fill('By Second Writer');
    assert.equal(await panel.locator('#case-tag').innerText(), 'RESULTS NEED REFRESH');
    await panel.getByRole('button', { name: 'Follow the credits' }).click();
    assert.match(await creditCard(panel, 'writer').innerText(), /Second Writer/);
    assert.match(await creditCard(panel, 'origin').innerText(), /Unknown/);
    await panel.getByRole('button', { name: 'Clear' }).click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await panel.locator('#context-url').inputValue(), '');
    assert.match(await creditCard(panel, 'writer').innerText(), /Unknown/);
    assert.equal(await panel.locator('#case-tag').innerText(), 'READY');
    return 'URL did not supply a host; second submit replaced results; Clear reset';
  });

  await step('stale-state panel rendering simulation', async () => {
    await sendState(worker, panel, { kind: 'ready', capture: wusfCapture, message: 'Page read at your request.' });
    await fixturePage.goto(`${base}/second`);
    await sendState(worker, panel, { kind: 'stale', capture: null, message: 'The page changed. Click the toolbar button again.' });
    assert.match(await panel.locator('#result-summary').innerText(), /Previous results were cleared/);
    assert.match(await creditCard(panel, 'writer').innerText(), /Unknown/);
    return 'panel clears when worker publishes stale; real navigation event not exercised';
  });

  await step('320 and 390 pixel panel layout', async () => {
    await sendState(worker, panel, { kind: 'ready', capture: wusfCapture, message: 'Page read at your request.' });
    for (const width of [320, 390]) {
      await panel.setViewportSize({ width, height: 850 });
      const bounds = await panel.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        mascotRight: document.querySelector('.mascot').getBoundingClientRect().right,
      }));
      assert(bounds.document <= width, `${width}px panel scrollWidth ${bounds.document}`);
      assert(bounds.mascotRight <= width + 1, `${width}px mascot right ${bounds.mascotRight}`);
      await panel.screenshot({ path: path.join(qaRoot, `panel-${width}.png`), fullPage: true });
    }
    return `screenshots: ${path.join(qaRoot, 'panel-320.png')}, ${path.join(qaRoot, 'panel-390.png')}`;
  });

  await step('console and network health', async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    return 'no page errors, console errors, failed requests, or external requests';
  });

  process.stdout.write(`RESULT ${JSON.stringify({
    passed: checks.filter((item) => item.status === 'pass').length,
    failed: checks.filter((item) => item.status === 'fail').length,
    screenshots: [path.join(qaRoot, 'panel-320.png'), path.join(qaRoot, 'panel-390.png')],
    simulation: 'Capture via page.evaluate and BYWHOM_STATE via worker; genuine toolbar action not tested.',
  })}\n`);
  if (checks.some((item) => item.status === 'fail')) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`HARNESS ERROR ${error?.stack || error}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (context) await context.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
});

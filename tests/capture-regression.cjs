// Uses the project-local Chromium cache when present. PLAYWRIGHT_MODULE_PATH
// and PLAYWRIGHT_BROWSERS_PATH can override the bundled runtime locations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const browserCache = path.resolve(root, '..', '.playwright-browsers-bywhom');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browserCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
function loadPlaywright() {
  try { return require('playwright'); } catch (error) {
    const fallback = process.env.PLAYWRIGHT_MODULE_PATH ||
      path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright');
    try { return require(fallback); } catch { throw error; }
  }
}
const { chromium } = loadPlaywright();
const capture = fs.readFileSync(path.join(root, 'capture.js'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'related-cards.html'), 'utf8');

(async () => {
  const browser = await chromium.launch({
    channel: 'chromium', headless: true, chromiumSandbox: true,
    ...(process.env.BYWHOM_CHROMIUM_PATH ? { executablePath: process.env.BYWHOM_CHROMIUM_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(fixture);
    const output = await page.evaluate(capture);
    const lines = output.visibleLines.map((entry) => entry.text);
    assert(lines.includes('By Darius Tahir'), 'current article byline must remain');
    assert(lines.includes('Illustration by Oona Zenda'), 'role-labeled art credit must remain separate');
    assert(lines.some((line) => line.startsWith('This piece was republished from Example Review')),
      'article footer republication credit must remain');
    for (const unrelated of ['Kate Ruder', 'Paula Span', 'Martha Bebinger', 'Arielle Zionts']) {
      assert(!lines.some((line) => line.includes(unrelated)), `related card imported: ${unrelated}`);
    }
    process.stdout.write('capture related-card regression passed\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

// Uses the project-local Chromium cache when present. PLAYWRIGHT_MODULE_PATH
// and PLAYWRIGHT_BROWSERS_PATH can override the bundled runtime locations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const { chromium, launchOptions } = require('./browser-runtime.cjs');
const capture = fs.readFileSync(path.join(root, 'capture.js'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'related-cards.html'), 'utf8');

(async () => {
  const { analyzeCapture } = await import(pathToFileURL(path.join(root, 'credit-engine.mjs')).href);
  const browser = await chromium.launch(launchOptions());
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

    for (const [markup, writer, host] of [
      ['<p>Harbor Daily | Reported by: Maya Chen</p>', 'Maya Chen', 'Harbor Daily'],
      ['<p>Story by Jordan Ellis</p>', 'Jordan Ellis', null],
    ]) {
      await page.setContent(`<main><article><h1>Local story</h1>${markup}<p>Article body.</p></article></main>`);
      const captured = await page.evaluate(capture);
      assert(captured.visibleLines.some((item) => item.text === markup.replace(/<[^>]*>/g, '')),
        `credit line missing from article markup: ${markup}`);
      const result = analyzeCapture(captured);
      assert.equal(result.writer.status, 'credited');
      assert.deepEqual(result.writer.evidence.map((item) => item.name), [writer]);
      if (host) assert.deepEqual(result.host.evidence.map((item) => item.name), [host]);
    }

    await page.setContent(`<!doctype html><html><head>
      <meta name="author" content="Maya Chen">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","author":[{"@type":"Person","name":"Jordan Ellis"},{"@type":"Person","name":"Alex Kim"}]}</script>
      </head><body><main><article><h1>Local story</h1><p>Article body without a byline.</p></article></main></body></html>`);
    const metadataCapture = await page.evaluate(capture);
    assert.equal(metadataCapture.metadataAuthors.length, 3);
    assert.notEqual(metadataCapture.metadataAuthors[0].claimId, metadataCapture.metadataAuthors[1].claimId);
    assert.equal(metadataCapture.metadataAuthors[1].claimId, metadataCapture.metadataAuthors[2].claimId);
    const metadataResult = analyzeCapture(metadataCapture);
    assert.equal(metadataResult.writer.status, 'conflict');
    assert.deepEqual(metadataResult.writer.evidence.map((item) => item.name), ['Maya Chen', 'Jordan Ellis', 'Alex Kim']);

    process.stdout.write('capture related-card, labeled byline, and metadata-source regressions passed\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

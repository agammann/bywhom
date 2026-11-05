const test = require('node:test');
const assert = require('node:assert/strict');
const { launchOptions, isExternalRequest } = require('./browser-runtime.cjs');

test('explicit browser selection applies alongside each harness options', () => {
  const previousChannel = process.env.BYWHOM_BROWSER_CHANNEL;
  const previousPath = process.env.BYWHOM_CHROMIUM_PATH;
  try {
    process.env.BYWHOM_BROWSER_CHANNEL = 'msedge';
    process.env.BYWHOM_CHROMIUM_PATH = '/isolated/browser';
    const options = launchOptions({ args: ['--load-extension=fixture'] });
    assert.equal(options.channel, 'msedge');
    assert.equal(options.executablePath, '/isolated/browser');
    assert.equal(options.headless, true);
    assert.equal(options.chromiumSandbox, true);
    assert.deepEqual(options.args, ['--load-extension=fixture']);
  } finally {
    if (previousChannel === undefined) delete process.env.BYWHOM_BROWSER_CHANNEL;
    else process.env.BYWHOM_BROWSER_CHANNEL = previousChannel;
    if (previousPath === undefined) delete process.env.BYWHOM_CHROMIUM_PATH;
    else process.env.BYWHOM_CHROMIUM_PATH = previousPath;
  }
});

test('internal browser resources are local but remote traffic remains forbidden', () => {
  const origin = 'http://127.0.0.1:44100';
  for (const url of [origin + '/article', 'chrome://version/', 'edge://version/', 'edge://resources/app.js', 'chrome-extension://fixture/panel.html', 'data:text/plain,fixture']) {
    assert.equal(isExternalRequest(url, origin), false, url);
  }
  for (const url of ['https://example.org/', 'http://127.0.0.1:44101/', 'https://example.org/?url=' + origin, 'file:///tmp/article']) {
    assert.equal(isExternalRequest(url, origin), true, url);
  }
});

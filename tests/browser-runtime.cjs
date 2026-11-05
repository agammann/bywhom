// All browser harnesses use an isolated profile and the same explicit browser.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const browserCache = path.resolve(root, '..', '.playwright-browsers-bywhom');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browserCache)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
}

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) return require(process.env.PLAYWRIGHT_MODULE_PATH);
  try { return require('playwright'); } catch (error) {
    const fallback = path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright');
    try { return require(fallback); } catch { throw error; }
  }
}

function launchOptions(options = {}) {
  return {
    channel: process.env.BYWHOM_BROWSER_CHANNEL || 'chromium',
    headless: true,
    chromiumSandbox: true,
    ...options,
    ...(process.env.BYWHOM_CHROMIUM_PATH ? { executablePath: process.env.BYWHOM_CHROMIUM_PATH } : {}),
  };
}

function isExternalRequest(url, fixtureOrigin) {
  const parsed = new URL(url);
  // Browser-internal resources are not network traffic. HTTPS/HTTP requests to
  // any origin other than the fixture server must still fail the health check.
  if (['chrome-extension:', 'data:', 'chrome:', 'edge:', 'about:'].includes(parsed.protocol)) return false;
  return parsed.origin !== new URL(fixtureOrigin).origin;
}

module.exports = { chromium: loadPlaywright().chromium, launchOptions, isExternalRequest };

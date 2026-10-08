# ByWhom Chrome extension

ByWhom is a local, click-to-read credit detective for article pages. Click its toolbar button while viewing an article. Its side panel shows the credited writer, hosting publication, and credited originating publication, with each supported claim tied to an exact page line or metadata value. Missing credit stays **Unknown**; differing claims stay **Conflicting claims**. You can also paste credit lines into the panel when page reading is unavailable.

This is a Manifest V3 proof of concept with Chrome 116 as its manifest minimum. Automated browser checks used Chromium 151.0.7922.34; earlier Chrome versions have not been individually tested. It is not a source-verification service: a byline or metadata field can make a claim without proving identity, ownership, accuracy, or the earliest publication.

## Try it locally

These are manual instructions; the extension has not been installed in your regular browser by this project work.

1. Keep the repository files together. In Chrome, open `chrome://extensions`, turn on **Developer mode**, and choose **Load unpacked**. Select the cloned repository folder containing `manifest.json`.
2. If the button is hidden, pin **ByWhom** from Chrome's Extensions menu.
3. Open an ordinary `http://` or `https://` article. Optionally highlight article text, then click the **ByWhom** toolbar button. The side panel opens with any supported page credits and the captured selection.
4. Use **Show evidence** on a claim to see the exact captured line or metadata value and where it came from. Close the evidence dialog with its button or Escape.
5. For a page that cannot be read, paste the visible credit lines into **Your text bubble** and select **Follow the credits**. The optional URL is context only; it is not fetched and cannot supply a missing credit. **Clear** resets the panel.

Chrome documents [loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [temporary `activeTab` access](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), and [the side-panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). Chrome controls whether an extension can run on a given page. Chrome internal pages and other restricted pages can fail gracefully into the paste option.

## What the click reads

The `manifest.json` permissions are only `activeTab`, `scripting`, and `sidePanel`. There are no persistent all-sites host permissions, `history`, clipboard, or storage permissions. Chrome grants temporary access to the active page when you invoke the toolbar button; `background.js` then injects `capture.js` into that tab's main frame and opens the bundled side panel. It does not inject a persistent content script or read pages on startup or navigation. The current result is cleared when the page loads again, the active tab changes, or the source tab closes.

The capture checks an article's visible byline and credit-like lines, selected text outside forms/editors, and limited article metadata: author/site meta fields and author/publisher values in Article-family JSON-LD. Each result labels **visible page text**, **selected text**, **article metadata**, or **pasted text**. Metadata-only author or site values are shown as **Metadata claim**, and a disagreement with a visible credit is shown rather than silently resolved. The page URL and title are context, never credit evidence. A selected sentence does not itself create an author or publication credit; the page's separate attribution may provide one after your click.

The parser recognizes a deliberately small set of explicit English credit forms. A bare name, page editor, illustrator, site logo, domain, or link to a matching article is not enough to assign an article writer or origin. It does not search the web for an original source. If the page does not state a role clearly, leave it unknown and inspect the publisher's own credits yourself.

Page reading and parsing run inside the browser using the bundled scripts and image. They do not call an API or send the captured article to ByWhom. The panel stores only the animation pause preference in its local storage; page results live in the extension worker/panel memory until cleared or replaced. Clicking an evidence link is an ordinary user-requested navigation to that credited URL. ByWhom does not bypass paywalls, publisher restrictions, or browser access controls.

## Accessibility and limits

The detective has idle, investigating, and result animations. **Pause animation** stops them, and the system's reduced-motion preference also disables them. Results, buttons, and the evidence dialog support keyboard use; the findings heading receives focus after a result. The side panel is designed for narrow widths.

This first capture is bounded and may miss credits embedded in images, canvas, shadow roots, cross-origin frames, very long text, or unusual markup. It reads only what the page exposes to a permitted extension; it does not make a publisher's claim independently true. See [BUILD-NOTES.md](BUILD-NOTES.md) for the exact boundaries and test coverage.

## Developer checks

The extension itself needs no npm package at runtime. To reproduce the developer checks on another machine, install Node.js 20 or later with npm, then run these commands from this folder. `package.json` pins Playwright to the locally verified version, 1.62.1.

```sh
npm install
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` runs the parser, background-worker, and manifest checks. `npm run test:browser` runs the capture regression, panel smoke, and extension-action harnesses in isolated Chromium profiles. Run an individual browser check with `npm run test:capture`, `npm run test:panel`, or `npm run test:action`. Browser checks need an executable Playwright Chromium and operating-system permission to launch it and bind a local loopback test server. They do not install the extension in your regular browser. If you keep Chromium in a custom cache, set `PLAYWRIGHT_BROWSERS_PATH` before running the browser commands.

On the restricted Windows test host, `node --test` can fail while spawning a child process with `EPERM`. The unit files also run directly with `node tests/credit-engine.test.mjs`, `node tests/background.test.cjs`, and `node tests/manifest.test.mjs`; those direct forms passed there. npm and browser installation commands above are for a normal developer environment and were not run as part of this source preparation.

The page-capture scenarios are listed in [tests/capture-fixtures.md](tests/capture-fixtures.md). An isolated Chromium test also invoked the real extension action through a browser-level DevTools command and confirmed capture, panel opening, repeat use, navigation reset, and a restricted-page fallback. That is a programmatic action event, **not a human toolbar click**. The [1:09 demo video](https://youtu.be/2dNrmiwtEYA) shows an actual toolbar click and docked side panel on labeled fictional local article pages. A separate [public-article compatibility check](LIVE-PAGE-COMPATIBILITY.md) exercised the action on WUSF, KFF Health News, and University of South Carolina pages, recording exact visible and metadata claims and their remaining disagreement. For a manual check, load this extension **unpacked into an isolated Chrome/Chromium profile**, open an article fixture, highlight text, click the actual toolbar button, inspect the three result cards and their evidence, then navigate or switch tabs and click again. Use the paste fallback on a restricted page.

## License and image provenance

The repository's [MIT license](LICENSE) covers its code, documentation, tests, and bundled `detective.png` to the extent the contributors hold rights in them. The detective image was generated with ChatGPT image generation and retains C2PA Content Credentials. [LICENSE-DECISION.md](LICENSE-DECISION.md) records the learner's explicit choice to publish the prepared source and artwork under MIT. Playwright is a separate developer dependency with its own license.

## Project status

This is freshly authored extension source. Substantive scope and feature conversations preceded coding. The Build With AI: Basics event pack guided the work, but no formal `devpost/` scope, PRD, spec, or approved checklist was saved before implementation. Current-date draft [scope](devpost/scope.md), [PRD](devpost/prd.md), [spec](devpost/spec.md), and [planning history](devpost/planning-history.md) are included in this repository; formal approval remains unverified. This work does not certify hackathon eligibility or complete those formal checkpoints. No Chrome Web Store publication or Devpost submission is included.

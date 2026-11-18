# ByWhom Chrome extension

ByWhom is a local, click-to-read credit detective for article pages. Click its toolbar button while viewing an article. Its side panel shows the credited writer, hosting publication, and credited originating publication, with each supported claim tied to an exact page line or metadata value. Missing credit stays **Unknown**; differing claims stay **Conflicting claims**. You can also paste credit lines into the panel when page reading is unavailable.

ByWhom uses Manifest V3 and requires Chrome 116 or later. The original automated browser checks used Chromium 151.0.7922.34. A November 4, 2026 follow-up passed the capture, panel and extension-action checks on Edge 156 in an isolated profile. Earlier Chrome versions have not been individually tested. A byline or metadata field records a stated credit. Verifying identity, ownership, accuracy, or the first publisher requires independent evidence.

## Try it locally

Clone the repository or use **Code → Download ZIP** on GitHub and extract it. Use the folder that directly contains `manifest.json`.

```sh
git clone https://github.com/agammann/bywhom.git
```

1. Keep the extension files together. In Chrome, open `chrome://extensions`, turn on **Developer mode**, and choose **Load unpacked**. Select the repository folder containing `manifest.json`.
2. If the button is hidden, pin **ByWhom** from Chrome's Extensions menu.
3. Open an ordinary `http://` or `https://` article. Optionally highlight article text, then click the **ByWhom** toolbar button. The side panel opens with any supported page credits and the captured selection.
4. Use **Show evidence** on a claim to see the exact captured line or metadata value and where it came from. Close the evidence dialog with its button or Escape.
5. For a page that cannot be read, paste the visible credit lines into **Your text bubble** and select **Follow the credits**. The optional URL is context only; it is not fetched and cannot supply a missing credit. **Clear** resets the panel.

Chrome documents [loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [temporary `activeTab` access](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), and [the side-panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). Chrome controls whether an extension can run on a given page. Chrome internal pages and other restricted pages can fail gracefully into the paste option.

## What the click reads

The `manifest.json` permissions are only `activeTab`, `scripting`, and `sidePanel`. There are no persistent all-sites host permissions, `history`, clipboard, or storage permissions. Chrome grants temporary access to the active page when you invoke the toolbar button. `background.js` starts `capture.js` in that tab's main frame and opens the bundled side panel. Findings appear after both finish successfully. The current result and any open evidence close when the page loads again, the active tab changes, or the source tab closes.

The capture checks an article's visible byline and credit-like lines, selected text outside forms/editors, and limited article metadata: author/site meta fields and author/publisher values in Article-family JSON-LD. Each result labels **visible page text**, **selected text**, **article metadata**, or **pasted text**. Metadata-only author or site values are shown as **Metadata claim**, and a disagreement with a visible credit is shown rather than silently resolved. The page URL and title are context, never credit evidence. A selected sentence does not itself create an author or publication credit; the page's separate attribution may provide one after your click.

The parser recognizes a deliberately small set of explicit English credit forms. A bare `By` prefix must be followed by name-shaped words (including Unicode names, initials and common name particles), not ordinary prose such as “By Friday we expect rainfall.” Short time expressions also stay unknown. This conservative heuristic can miss unusually styled or lowercase bare bylines; the more explicit `Written by`, `Reported by`, `Story by` and `Author:` labels retain their literal names. It is not a general language or identity detector. A bare name, page editor, illustrator, site logo, domain, or link to a matching article is not enough to assign an article writer or origin. It does not search the web for an original source. If the page does not state a role clearly, leave it unknown and inspect the publisher's own credits yourself.

Page reading and parsing run inside the browser using the bundled scripts and image. They do not call an API or send the captured article to ByWhom. The panel stores only the animation pause preference in its local storage; page results live in the extension worker/panel memory until cleared or replaced. Clicking an evidence link is an ordinary user-requested navigation to that credited URL. ByWhom does not bypass paywalls, publisher restrictions, or browser access controls.

## Accessibility and limits

The detective has idle, investigating, and result animations. **Pause animation** stops them, and the system's reduced-motion preference also disables them. Results, buttons, and the evidence dialog support keyboard use; the findings heading receives focus after a result. The side panel is designed for narrow widths.

This first capture is bounded and may miss credits embedded in images, canvas, shadow roots, cross-origin frames, very long text, or unusual markup. It reads only what the page exposes to a permitted extension; it does not make a publisher's claim independently true. See [BUILD-NOTES.md](BUILD-NOTES.md) for the exact boundaries and test coverage.

## Developer checks

The extension itself needs no npm package at runtime. For developer checks, use Node.js 24 with npm, as in GitHub Actions. Run these commands from the repository folder. `package.json` and the lockfile pin Playwright 1.65.0.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` runs the parser, background-worker, and manifest checks. `npm run test:browser` runs the capture regression, panel smoke, and extension-action harnesses in isolated Chromium profiles. Run an individual browser check with `npm run test:capture`, `npm run test:panel`, or `npm run test:action`. Browser checks need an executable Playwright Chromium and operating-system permission to launch it and bind a local loopback test server. They do not install the extension in your regular browser. If you keep Chromium in a custom cache, set `PLAYWRIGHT_BROWSERS_PATH` before running the browser commands.

All three browser harnesses also accept `BYWHOM_BROWSER_CHANNEL=msedge` or `chrome` to use an installed browser in a disposable profile. In PowerShell, set `$env:BYWHOM_BROWSER_CHANNEL = 'msedge'` before `npm run test:browser`. Alternatively, set `BYWHOM_CHROMIUM_PATH` to an executable path; it applies consistently to all three harnesses. The installed browser must support unpacked extensions and the `Extensions.triggerAction` DevTools command for the action check. Unsupported capabilities fail explicitly; the harness does not substitute a simulated action.

The original restricted Windows source-preparation run encountered `EPERM` when spawning some test processes, so its unit files also ran directly. The November 4 follow-up verified `npm ci`, `npm test` and all three browser harnesses with `BYWHOM_BROWSER_CHANNEL=msedge`. This does not retest older Chrome releases or the separately downloaded Chromium executable. Browser-selection and external-request classification checks are included in `npm test`.

The page-capture scenarios are listed in [tests/capture-fixtures.md](tests/capture-fixtures.md). An isolated Chromium test also invoked the real extension action through a browser-level DevTools command and confirmed capture, panel opening, repeat use, navigation reset, and a restricted-page fallback. That is a programmatic action event, **not a human toolbar click**. The [1:09 demo video](https://youtu.be/2dNrmiwtEYA) shows an actual toolbar click and docked side panel on labeled fictional local article pages. A separate [public-article compatibility check](LIVE-PAGE-COMPATIBILITY.md) exercised the action on WUSF, KFF Health News, and University of South Carolina pages, recording exact visible and metadata claims and their remaining disagreement. For a manual check, load this extension **unpacked into an isolated Chrome/Chromium profile**, open an article fixture, highlight text, click the actual toolbar button, inspect the three result cards and their evidence, then navigate or switch tabs and click again. Use the paste fallback on a restricted page.

## License and image provenance

The repository's [MIT license](LICENSE) covers its code, documentation, tests, and bundled `detective.png` to the extent the contributors hold rights in them. [LICENSE-DECISION.md](LICENSE-DECISION.md) records the decision to publish the source and artwork under MIT. Playwright is a separate developer dependency with its own license.

## Project history

The Build With AI: Basics event pack guided the original work. The [scope](devpost/scope.md), [PRD](devpost/prd.md), [spec](devpost/spec.md), and [planning history](devpost/planning-history.md) record the October 2026 project history. Formal event approval remains unverified. Distribution is through the source checkout and Chrome's **Load unpacked** option.

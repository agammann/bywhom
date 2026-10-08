---
doc: spec
status: draft
recorded: 2026-10-08 UTC
---

# ByWhom — technical spec

**Record provenance:** Documented on 2026-10-08 after the v0.1.1 implementation. The [planning history](planning-history.md) records the verified pre-code conversation: the learner chose a Chrome extension with an animated character, selection and explicit paste, and agreed to proceed with a bounded, local credit-evidence flow. The module design, exact limits, and tests below describe the implementation inspected today. This document is **not** a claim that a formal spec was saved or approved before coding; it remains `draft` for learner review. See [scope.md](scope.md) for the product boundary and [../BUILD-NOTES.md](../BUILD-NOTES.md) for the observed build.

## How this works, in plain language

When the reader clicks ByWhom's Chrome toolbar button, Chrome temporarily lets the extension read the open article. The reader may highlight a passage first; the extension captures that selection before opening its side panel. A small page reader gathers visible credit lines and limited article metadata. A local parser then asks three separate questions: **Who is credited with writing it? Which publication hosts this page? Does the page explicitly credit an originating publication?**

The panel shows the answer and the exact line or metadata value behind each claim. If nothing supports a role, it says **Unknown**. If sources disagree, it shows **Conflicting claims**. A URL, similar article elsewhere, or a writer's newsroom affiliation cannot supply an unspoken origin. The reader may instead paste credit text into the panel; that text is analyzed alone. The detective image and its idle, investigating, and result motions are bundled locally, and motion can be paused.

This shape uses the browser's temporary page-access grant and local code. There is no account, server, paid model, web search, passive page watcher, or automatic clipboard read.

## Core journey through the system

1. On an ordinary `http://` or `https://` article, the reader may select a short passage, then clicks the **ByWhom** toolbar action. `background.js` starts one injection of `capture.js` and opens `panel.html` from that same gesture.
2. `capture.js` reads the selection first, then a bounded set of visible credit-like lines and author/publisher metadata from the current page's main frame. It excludes editable controls, hidden and related-story content where detectable, and performs no fetch.
3. The worker holds the capture in memory and sends it to `panel.mjs`. `credit-engine.mjs` converts explicit credit lines and labeled metadata into separate writer, host, and origin records. The page title and URL are context only.
4. The panel renders the three cards and **Show evidence** controls. Each evidence item retains its raw line or metadata value, location label, source type, and safe link where one was present. Missing or differing claims remain visible. The detective changes to its result motion.
5. On a new action, Clear, page load, tab switch, or source-tab closure, the worker replaces or invalidates the old page result. A restricted or unreadable page presents a paste fallback. The user can paste text and optionally provide an unverified context URL; pasted text never inherits the former page's evidence.

This traces `prd.md > The core journey` and `scope.md > The core loop`. The companion [PRD](prd.md) is also a current-dated draft, not a retroactive approval.

## Stack and execution boundary

| Piece | Current implementation and reason | Reference |
| --- | --- | --- |
| Chrome Manifest V3 | Native toolbar action, service worker, and side panel keep the proof of concept browser-local. The learner chose Chrome; Manifest V3 and module boundaries are implementation choices recorded after coding. `minimum_chrome_version` is `116`. | [Chrome extensions overview](https://developer.chrome.com/docs/extensions/overview), [action](https://developer.chrome.com/docs/extensions/reference/api/action), [sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) |
| Temporary page access | Manifest permissions are exactly `activeTab`, `scripting`, and `sidePanel`. There are no host patterns or persistent content scripts. Injection follows an explicit action. | [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) |
| Local JavaScript, HTML, and CSS | No runtime framework or remote dependency. A plain module parses credit evidence, and the panel constructs untrusted text with DOM nodes and `textContent`. | [Extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security) |
| Developer verification | Node.js 20+ runs direct unit checks; Playwright 1.62.1 and its Chromium browser run isolated browser harnesses. Neither is needed to use the packed extension. | [Node.js documentation](https://nodejs.org/docs/latest-v20.x/api/), [Playwright Chrome extension guide](https://playwright.dev/docs/chrome-extensions) |

No third-party service endpoint, key, database, account, cost, or API rate limit is part of the extension. The publisher page can make its own normal network requests; ByWhom does not fetch an article or search other sites. A user-opened evidence link navigates normally to an `http(s)` address.

## Where it runs and how someone tries it

The extension runs locally in Chrome 116 or later, though only isolated Chromium 151.0.7922.34 was exercised in automated browser checks. Keep the repository files together. In an isolated Chrome/Chromium profile, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the repository root containing `manifest.json`. Open an ordinary article, optionally highlight text, click the toolbar button, inspect the cards and evidence, then try a page with an explicit republication line and the paste fallback. [README.md](../README.md) provides the full procedure; [DEMO-RUNBOOK.md](../DEMO-RUNBOOK.md) gives a short recording checklist.

No npm installation is needed to run the extension. To reproduce development checks from the repository root on a normal development machine: `npm install`, `npm test`, `npx playwright install chromium`, then `npm run test:browser`. These commands are for testing, not a requirement for loading the unpacked extension. The browser harness uses an isolated profile; no normal-profile installation was part of the build.

The local event pack calls for a short demo video and public GitHub repository for submission. The prepared source and included artwork are published under MIT at [agammann/bywhom](https://github.com/agammann/bywhom); the initial source commit was verified publicly on 2026-10-08. A [1:09 public demo video](https://youtu.be/2dNrmiwtEYA) shows the actual toolbar action and side panel on labeled fictional local pages. Chrome Web Store publication is outside this proof of concept. This spec does not certify eligibility.

## Look and feel

The earlier discussion chose **one original animated detective** and optional motion; it did not prescribe colors or typography. The current UI uses a light, restrained panel, blue highlights, three evidence cards, and a locally bundled detective image. CSS supplies idle, investigating, and result animation states. The Pause/Play control and `prefers-reduced-motion` disable motion. This describes the built interface rather than attributing unrecorded visual choices to the learner. Implements `prd.md > Surface and look` and `prd.md > States and boundaries`.

## Components

### Toolbar action and in-memory coordinator

`manifest.json` defines the action and permissions; `background.js` listens for clicks, starts the one-shot injection and panel opening from the gesture, and publishes `idle`, `reading`, `ready`, `error`, or `stale` state. A generation counter discards a late read after a newer action or Clear. Navigation and tab listeners only invalidate; they do not collect page text. Implements `prd.md > The core journey`, `prd.md > Selection and paste`, and the repeat/navigation behavior in `prd.md > States and boundaries`.

### One-shot page reader

`capture.js` runs in the permitted tab's main frame and returns `{url, title, selection, visibleLines, metadataAuthors, metadataSiteNames}`. It prefers the article containing the main heading or a substantial article in `main`, reads visible credit candidates, and labels each retained line by element and line number. It also reads author/site meta fields and page-matched Article-family JSON-LD. It avoids forms, hidden elements, navigation and related cards where the DOM exposes those boundaries. It neither changes the page nor fetches another URL. Implements `prd.md > Article credit results` and `prd.md > Selection and paste`.

### Local credit engine

`credit-engine.mjs` parses a deliberately small set of explicit English credit patterns. It returns separate `writer`, `host`, and `origin` fields with `unknown`, `credited`, `metadata`, or `conflict` status and evidence records. Multiple or organization authors can remain together; an editor or illustrator label is not automatically a writer; a republication statement can name an origin. Metadata-only claims remain labeled and distinct claims produce a conflict. `extractPasted()` uses pasted lines only. A title, domain, optional pasted URL, or an independently found matching story is not origin evidence. Implements `prd.md > Article credit results` and `prd.md > Selection and paste`.

### Side panel, evidence dialog, and paste bubble

`panel.html`, `panel.css`, and `panel.mjs` render the current page context, selected-text preview, three credit cards, source trail, evidence dialog, paste form, and Clear. Page text enters the DOM through `textContent`; links are restricted to validated `http(s)` URLs and open with `noopener noreferrer`. Findings receive keyboard focus, and closing the evidence dialog restores focus to its trigger. A changed paste input marks results for refresh. Implements `prd.md > The core journey`, `prd.md > Article credit results`, and `prd.md > Selection and paste`.

### Detective motion and accessibility

`detective.png` is a bundled original project image. CSS applies the three visual states. The side panel has a Pause/Play button, visible keyboard focus, dialog Escape behavior, and a reduced-motion media query. Only the motion preference is retained in panel `localStorage`. Implements `prd.md > Surface and look` and `prd.md > States and boundaries`.

## Data and evidence contract

The one-shot capture contains the page URL/title for context; a selected string of up to 30,000 characters; up to 100 candidate visible lines; up to 24 author and 24 site metadata items; and no more than 60,000 returned text characters in total. It inspects at most 20 JSON-LD scripts. Long visible lines are omitted instead of shortened into misleading exact quotations. The parser limits pasted text to 60,000 characters, individual parsed lines to 500 characters, and candidate names to 120 characters. [BUILD-NOTES.md](../BUILD-NOTES.md) records additional scan limits and omissions.

Each evidence record carries `name`, original `evidence`, `where`, `source` (`visible`, `selected`, `metadata`, or `pasted`), optional `line`, and any validated `links`. A role is **Unknown** with no supported claim; **Metadata claim** with only metadata; **Explicit credit** with a matching selected/visible claim; or **Conflicting claims** when distinct name sets disagree. The panel labels the source of every claim. Selected article prose alone supplies no writer or origin; current-page credit evidence may still do so after the explicit click.

Captured page data lives in the extension worker and open panel memory, and is cleared or replaced on the next action, tab/page change, or Clear. Pasted content stays in the current panel form and is not saved by the extension or joined to an earlier page capture. Clear removes it. Only the motion preference persists. There is no remote storage.

## File structure

```text
bywhom/                        # Repository root; load this folder as the extension
+-- devpost/
|   +-- planning-history.md    # Dated source chronology; no pre-code approval claim
|   +-- scope.md               # Current-dated draft product boundary
|   +-- prd.md                 # Companion draft behavior record
|   +-- spec.md                # This current-dated draft
+-- manifest.json             # MV3 action, worker, side panel, narrow permissions
+-- background.js             # Explicit action and ephemeral page state
+-- capture.js                # One-shot current-page evidence reader
+-- credit-engine.mjs         # Pure role/evidence parser, including paste mode
+-- panel.html                # Side-panel structure and accessible controls
+-- panel.css                 # Visual design and optional detective motion
+-- panel.mjs                 # Safe rendering, evidence dialog, paste, Clear
+-- detective.png             # Bundled character art
+-- package.json              # Developer-only test commands and Playwright pin
+-- LICENSE                   # MIT terms for project source and bundled art
+-- LICENSE-DECISION.md       # Recorded learner choice and art provenance
+-- README.md                 # Local use and developer setup
+-- BUILD-NOTES.md            # Observed data path, limits, and test evidence
+-- LIVE-PAGE-COMPATIBILITY.md # Dated public-page snapshot
+-- DEMO-RUNBOOK.md           # Mechanics and shot checklist, no narration copy
+-- RELEASE-READINESS.md      # Current participation and verification state
+-- tests/                    # Unit, capture, panel, and actual-action harnesses
```

This is the repository arrangement, not a file tree approved before implementation.

## Verification and realistic failure modes

- Direct Node checks passed: 13/13 parser, 5/5 worker, and 1/1 manifest permissions. A related-card capture regression passed. Panel fixture checks passed 11/11 at narrow widths; a real MV3 action event triggered through Chromium DevTools passed 6/6, including selection, repeat use, navigation invalidation, and restricted-page fallback. That automation was a programmatic action, not a human toolbar click.
- An isolated public-page action check reached `ready` on WUSF, KFF Health News, and a University of South Carolina republication page. The WUSF page did **not** establish KFF as origin; KFF exposed a visible byline versus metadata-author disagreement; the South Carolina page explicitly credited The Conversation as origin. See [LIVE-PAGE-COMPATIBILITY.md](../LIVE-PAGE-COMPATIBILITY.md). These are dated page snapshots, not independent verification of authorship or a guarantee against markup changes.
- **Page denied, restricted, or atypical:** Show the paste fallback; do not bypass publisher or Chrome restrictions. Image/canvas credits, unusual markup, shadow content, and cross-origin frames may remain unknown.
- **Missing or contradictory credit:** Show Unknown or all conflicting claims with their source labels. Do not guess from a URL, host name, affiliation, or matching story.
- **Page changes during reading:** Discard the old capture through the generation counter and ask for a new click. No background recapture occurs.

## What was simplified and why

- One explicit toolbar action and a bounded current-page reader keep permission and data flow easy to inspect. Passive collection and publisher-specific crawling would add access and privacy complexity without proving the central credit-evidence loop.
- Literal credit patterns and labeled metadata support a reviewable proof of concept. Web-wide earliest-source search would need a separate discovery and verification method and was excluded from the pre-code plan. Unknown origin remains a valid result.
- One bundled detective image with CSS state animations demonstrates the character interaction without a sprite pipeline or remote animation service. Motion never carries information required to read a result.

## Decisions, provenance, and open issues

- **Verified learner direction before coding:** Chrome; an animated character; highlighted article text or explicit paste; a quick, efficient, fresh-project plan. The assistant's pre-code plan named selection capture, separate evidence cards, paste/missing/conflict handling, one original reduced-motion-friendly detective, then packaging and demo. See [planning-history.md](planning-history.md). The learner's agreement to proceed was not a saved event-pack approval of this technical spec.
- **Clarified ambiguity:** The pre-code discussion distinguished selected text plus the permitted current page's attribution from pasted text alone. Paste with no explicit attribution may leave writer or origin unknown; the observed parser follows that rule. See `prd.md > Selection and paste`.
- **Current implementation choices:** MV3 side panel, `activeTab`/`scripting`, plain local JavaScript, exact scan bounds, CSS motion, and Playwright harnesses. They are recorded here for review, not retroactively assigned to the learner.
- **Still open for a formal pack checkpoint:** Learner review of this draft and its companion scope/PRD; any required learner profile and build-checklist approvals. No stage is marked approved here. The public MIT repository is verified; recording, registration/terms, and submission remain separate decisions and evidence. See [RELEASE-READINESS.md](../RELEASE-READINESS.md).

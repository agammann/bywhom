/*
 * One-shot page capture. Chrome injects this file only after the user clicks
 * the extension action; the value of the final expression is returned by
 * chrome.scripting.executeScript. No page state is changed or network used.
 */
(() => {
  "use strict";

  const MAX_TEXT = 60000;
  const MAX_SELECTION = 30000;
  const MAX_LINE = 800;
  const MAX_VISIBLE_LINES = 100;
  const MAX_METADATA_ITEMS = 24;
  const MAX_JSON_LD_SCRIPTS = 20;
  const MAX_JSON_LD_LENGTH = 500000;

  const clean = (value) => typeof value === "string" ? value.trim() : "";
  const limit = (value, length) => clean(value).slice(0, length);
  const looksLikeUrl = (value) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.\.?\/|www\.)/i.test(clean(value));
  const result = {
    url: limit(location.href, 2048),
    title: limit(document.title, 500),
    selection: "",
    visibleLines: [],
    metadataAuthors: [],
    metadataSiteNames: [],
  };

  // Capture the selection before inspecting the DOM. Form and editable field
  // values are outside the article-reading scope, even when selected.
  try {
    const selected = window.getSelection();
    const anchor = selected?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selected.anchorNode
      : selected?.anchorNode?.parentElement;
    const fromEditor = anchor?.closest("input, textarea, select, [contenteditable], form");
    if (selected && !fromEditor) result.selection = limit(selected.toString(), MAX_SELECTION);
  } catch (_) {
    // Unusual documents can deny selection access. Other evidence still works.
  }

  let remaining = Math.max(0, MAX_TEXT - result.url.length - result.title.length - result.selection.length);
  const takeBudget = (...values) => {
    const needed = values.reduce((sum, value) => sum + String(value).length, 0);
    if (needed > remaining) return false;
    remaining -= needed;
    return true;
  };

  const metadataKeys = new Set();
  function addMetadata(bucket, nameValue, evidenceValue, whereValue) {
    if (bucket.length >= MAX_METADATA_ITEMS) return;
    const name = clean(nameValue);
    const evidence = clean(evidenceValue);
    const where = clean(whereValue);
    if (!name || !evidence || !where || name.length > 300 || evidence.length > 300) return;
    if (looksLikeUrl(name)) return;
    const key = `${bucket === result.metadataAuthors ? "author" : "site"}\u0000${name}\u0000${where}`;
    if (metadataKeys.has(key) || !takeBudget(name, evidence, where)) return;
    metadataKeys.add(key);
    bucket.push({ name, evidence, where });
  }

  // A meta value is a publisher-supplied claim, not a verified author credit.
  try {
    for (const meta of document.querySelectorAll("meta[name], meta[property]")) {
      const key = clean(meta.getAttribute("name") || meta.getAttribute("property")).toLowerCase();
      const value = clean(meta.getAttribute("content"));
      if (!value) continue;
      if (key === "author" || key === "article:author") {
        addMetadata(result.metadataAuthors, value, value, `metadata: meta[${meta.hasAttribute("name") ? "name" : "property"}=${key}]`);
      } else if (key === "og:site_name" || key === "application-name") {
        addMetadata(result.metadataSiteNames, value, value, `metadata: meta[${meta.hasAttribute("name") ? "name" : "property"}=${key}]`);
      }
    }
  } catch (_) {
    // A malformed DOM node should not prevent visible credit capture.
  }

  const isArticleType = (type) => {
    const values = Array.isArray(type) ? type : [type];
    return values.some((value) => typeof value === "string" &&
      /(?:^|[/#])(?:Article|NewsArticle|BlogPosting)$/i.test(value));
  };
  const nonUrlName = (value) => typeof value === "string" && !looksLikeUrl(value);

  function addStructuredNames(target, value, where) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries.slice(0, MAX_METADATA_ITEMS)) {
      if (nonUrlName(entry)) {
        addMetadata(target, entry, entry, where);
      } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const name = entry.name;
        if (nonUrlName(name)) addMetadata(target, name, name, `${where}.name`);
      }
    }
  }

  function structuredArticleMatchesPage(node) {
    const reference = (value) => typeof value === "string" ? value :
      value && typeof value === "object" ? value.url || value["@id"] : "";
    const references = [reference(node.url), reference(node.mainEntityOfPage), reference(node["@id"])]
      .filter((value) => typeof value === "string" && value && value !== "#" &&
        (looksLikeUrl(value) || value.startsWith("#")));
    if (!references.length) return true;
    try {
      const current = new URL(location.href);
      const pageKey = (url) => `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
      return references.some((value) => pageKey(new URL(value, current)) === pageKey(current));
    } catch (_) { return false; }
  }

  function visitStructured(node, scriptNumber, depth, seen) {
    if (!node || depth > 8 || seen.count++ > 2000) return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 200)) visitStructured(item, scriptNumber, depth + 1, seen);
      return;
    }
    if (typeof node !== "object") return;
    if (isArticleType(node["@type"]) && structuredArticleMatchesPage(node)) {
      const type = Array.isArray(node["@type"]) ? node["@type"].find(isArticleType) : node["@type"];
      const label = typeof type === "string" ? type.split(/[/#]/).pop() : "Article";
      const where = `metadata: JSON-LD script ${scriptNumber} ${label}`;
      addStructuredNames(result.metadataAuthors, node.author, `${where}.author`);
      addStructuredNames(result.metadataSiteNames, node.publisher, `${where}.publisher`);
    }
    // Search only schema graph/main-entry containers. Walking arbitrary
    // properties can accidentally import related articles' credit claims.
    if (node["@graph"]) visitStructured(node["@graph"], scriptNumber, depth + 1, seen);
    if (node.mainEntity) visitStructured(node.mainEntity, scriptNumber, depth + 1, seen);
  }

  try {
    let number = 0;
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (++number > MAX_JSON_LD_SCRIPTS) break;
      const raw = script.textContent || "";
      if (!raw || raw.length > MAX_JSON_LD_LENGTH) continue;
      try { visitStructured(JSON.parse(raw), number, 0, { count: 0 }); } catch (_) { /* Invalid JSON-LD is ignored. */ }
    }
  } catch (_) {
    // Metadata is opportunistic. Never let it block visible text capture.
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    try {
      for (let current = element; current && current instanceof Element; current = current.parentElement) {
        if (current.hasAttribute("hidden") || current.hasAttribute("inert") ||
            current.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" ||
            style.visibility === "collapse" || style.contentVisibility === "hidden" ||
            Number(style.opacity) === 0) return false;
      }
      const boxes = element.getClientRects();
      const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
      for (const box of boxes) {
        if (box.width > 0 && box.height > 0 && box.right > 0 && box.left < width) return true;
      }
    } catch (_) { /* A detached or exotic element is not reliable evidence. */ }
    return false;
  }

  function blocked(element) {
    return Boolean(element.closest("form, nav, [role=navigation], [role=search], input, textarea, select, button, [contenteditable], template"));
  }

  // Related-story cards can sit inside an otherwise correct <article> or
  // <main>. Their bylines belong to those cards, not to the open story. Keep
  // this narrower than a blanket footer exclusion so republishing credits at
  // the end of the article remain available.
  const RELATED_CARD_SELECTOR = [
    "aside", "[class*=related i]", "[id*=related i]", "[class*=recommend i]",
    "[class*=recirc i]", "[class*=article-pre-footer__post i]",
    "[class*=story-card i]", "[class*=post-card i]",
  ].join(", ");

  function inRelatedCard(element, primary) {
    const card = element.closest(RELATED_CARD_SELECTOR);
    return Boolean(card && card !== primary && primary.contains(card));
  }

  function label(element) {
    const tag = element.tagName.toLowerCase();
    const id = element.id && /^[a-zA-Z][\w-]{0,45}$/.test(element.id) ? `#${element.id}` : "";
    const className = typeof element.className === "string"
      ? element.className.split(/\s+/).find((item) => /^[a-zA-Z][\w-]{0,45}$/.test(item))
      : "";
    return `<${tag}${id || (className ? `.${className}` : "")}>`;
  }

  const seenVisible = new Set();
  function addVisibleLine(textValue, whereValue, lineNumber) {
    if (result.visibleLines.length >= MAX_VISIBLE_LINES) return;
    const text = clean(textValue);
    const where = clean(whereValue);
    if (!text || text.length > MAX_LINE || seenVisible.has(text)) return;
    if (!takeBudget(text, where)) return;
    seenVisible.add(text);
    result.visibleLines.push({ text, where, line: lineNumber });
  }

  const creditLine = /(?:^|\|\s*)(?:by\s+|written\s+by\s+|reported\s+by\s+|story\s+by\s+)|^\s*(?:(?:hosting|originating)\s+)?publication\s*:\s*\S|^\s*(?:publisher|source publication)\s*:\s*\S|\b(?:originally|first|previously)\s+published\b|\b(?:republished|reprinted|syndicated)\b|\b(?:published|distributed|provided)\s+by\b|\bcourtesy of\b|^\s*source\s*:/i;
  const explicitSelectors = [
    "[rel~=author]", "[itemprop=author]", "[class*=byline i]", "[id*=byline i]",
    "[class*=author i]", "[id*=author i]", "[class*=republish i]",
    "[class*=syndicat i]", "[class*=publisher i]", "[class*=source-credit i]",
    "[class*=article-credit i]", "[data-testid*=byline i]",
  ].join(",");

  // Prefer the article containing the page heading, then the substantial
  // article inside main. This prevents unrelated sidebar cards and teaser
  // articles from donating a byline to the current story.
  let primary = document.body;
  try {
    const main = [...document.querySelectorAll("main, [role=main]")]
      .find((item) => isVisible(item) && !blocked(item));
    const articles = [...document.querySelectorAll("article")]
      .filter((item) => isVisible(item) && !blocked(item)).slice(0, 30);
    const heading = [...document.querySelectorAll("h1")].find((item) => isVisible(item));
    const headingArticle = heading && articles.find((item) => item.contains(heading));
    const candidates = main ? articles.filter((item) => main.contains(item)) : articles;
    const lengthOf = (item) => Math.min((item.innerText || "").length, 100000);
    const substantial = candidates.sort((a, b) => lengthOf(b) - lengthOf(a))[0];
    primary = headingArticle || (substantial && lengthOf(substantial) >= 250 ? substantial : null) ||
      main || document.body;
  } catch (_) { /* Fall back to the document body. */ }

  try {
    let checked = 0;
    // A body-wide class search would import credits from related-story cards.
    const elements = primary && primary !== document.body
      ? primary.querySelectorAll(explicitSelectors) : [];
    for (const element of elements) {
      if (++checked > 500 || result.visibleLines.length >= MAX_VISIBLE_LINES) break;
      if (blocked(element) || inRelatedCard(element, primary) || !isVisible(element)) continue;
      const text = typeof element.innerText === "string" ? element.innerText : "";
      const lines = text.split(/\r?\n/);
      if (lines.length > 12) continue; // A large author archive or menu is not a credit line.
      for (let index = 0; index < lines.length; index++) {
        addVisibleLine(lines[index], `visible text: ${label(element)}`, index + 1);
      }
    }
  } catch (_) { /* Continue with the article text. */ }

  try {
    if (primary && isVisible(primary)) {
      // innerText omits display:none, but it can still contain text marked
      // aria-hidden or text from a form. Drop any whole candidate line that
      // contains such a fragment rather than presenting a mixed false credit.
      const ignored = new Set();
      const ignoreSelector = `[aria-hidden="true"], [inert], [hidden], form, nav, [role="navigation"], [role="search"], [contenteditable], ${RELATED_CARD_SELECTOR}`;
      let ignoredNodes = 0;
      for (const element of primary.querySelectorAll(ignoreSelector)) {
        if (++ignoredNodes > 500) break;
        const raw = (element.innerText || element.textContent || "").slice(0, 3000);
        for (const fragment of raw.split(/\r?\n/)) {
          const normalized = clean(fragment).replace(/\s+/g, " ");
          if (normalized.length >= 3 && normalized.length <= MAX_LINE) ignored.add(normalized);
        }
      }
      const ignoredFragments = [...ignored];
      const lines = (primary.innerText || "").split(/\r?\n/);
      // The body fallback has no reliable story boundary; inspect only its
      // early content rather than importing late related-story lists.
      const count = Math.min(lines.length, primary === document.body ? 120 : 5000);
      for (let index = 0; index < count; index++) {
        if (result.visibleLines.length >= MAX_VISIBLE_LINES || remaining < 100) break;
        const line = clean(lines[index]);
        const normalized = line.replace(/\s+/g, " ");
        if (ignoredFragments.some((fragment) => normalized.includes(fragment))) continue;
        if (line && line.length <= MAX_LINE && creditLine.test(line)) {
          addVisibleLine(line, `visible text: ${label(primary)}`, index + 1);
        }
      }
    }
  } catch (_) {
    // Some documents do not expose innerText; return what was captured.
  }

  return result;
})()

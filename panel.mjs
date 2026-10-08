import { analyzeCapture, extractPasted, safeUrl } from './credit-engine.mjs';

const $ = (id) => document.getElementById(id);
const roles = { writer: 'Credited writer', host: 'Hosting publication', origin: 'Credited originating publication' };
const unknownNotes = {
  writer: 'No supported writer credit found',
  host: 'No supported publication credit found',
  origin: 'No supported originating-publication credit found',
};
const statusLabels = { unknown: 'Unknown', credited: 'Explicit credit', metadata: 'Metadata claim', conflict: 'Conflicting claims' };
let currentResult = null;
let currentCapture = null;
let lastEvidenceTrigger = null;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function emptyResult() {
  return Object.fromEntries(Object.keys(roles).map((key) => [key, { status: 'unknown', evidence: [] }]));
}

function uniqueNames(evidence) {
  return [...new Map(evidence.map((item) => [item.name.toLocaleLowerCase(), item.name])).values()];
}

function showEvidence(role, trigger) {
  const field = currentResult?.[role];
  if (!field?.evidence?.length) return;
  lastEvidenceTrigger = trigger;
  $('evidence-title').textContent = roles[role];
  const content = $('evidence-content');
  content.replaceChildren();
  for (const item of field.evidence) {
    const entry = element('div', undefined, 'evidence-item');
    const source = {
      visible: 'Visible page text',
      selected: 'Selected text',
      metadata: 'Article metadata',
      pasted: 'Pasted text',
    }[item.source] || 'Provided evidence';
    const location = [source, item.where, Number.isInteger(item.line) ? `line ${item.line}` : ''].filter(Boolean).join(' · ');
    entry.append(element('small', location), element('blockquote', item.evidence));
    for (const rawUrl of item.links || []) {
      const url = safeUrl(rawUrl);
      if (!url) continue;
      const link = element('a', `Link in credit: ${new URL(url).hostname}`);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      entry.append(link);
    }
    content.append(entry);
  }
  $('evidence-dialog').showModal();
}

function render(result, contextUrl = null) {
  currentResult = result;
  const cards = $('cards');
  cards.replaceChildren();
  let index = 0;
  for (const [key, label] of Object.entries(roles)) {
    const field = result[key] || { status: 'unknown', evidence: [] };
    const card = element('article', undefined, 'credit-card');
    card.dataset.field = key;
    card.append(element('span', String(++index).padStart(2, '0'), 'card-number'));
    const body = element('div');
    const top = element('div', undefined, 'card-top');
    top.append(element('span', label, 'card-label'), element('span', statusLabels[field.status] || 'Unknown', `status ${field.status}`));
    body.append(top);
    const names = uniqueNames(field.evidence || []);
    body.append(element('div', names.length ? names.join(' / ') : 'Unknown', `card-value ${field.status}`));
    if (field.evidence?.length) {
      const button = element('button', 'Show evidence', 'evidence-button');
      button.type = 'button';
      button.addEventListener('click', () => showEvidence(key, button));
      body.append(button);
    } else {
      body.append(element('p', unknownNotes[key], 'card-note'));
    }
    card.append(body);
    cards.append(card);
  }

  const trail = $('trail-content');
  trail.replaceChildren();
  const list = element('ol');
  for (const key of ['origin', 'host', 'writer']) {
    const field = result[key];
    if (!field || field.status === 'unknown') continue;
    const qualifier = field.status === 'metadata' ? ' (metadata claim)' : field.status === 'conflict' ? ' (unresolved disagreement)' : '';
    list.append(element('li', `${roles[key]}: ${uniqueNames(field.evidence).join(' / ')}${qualifier}`));
  }
  if (list.children.length) trail.append(list);
  else trail.append(element('p', 'No supported credit trail found in this text.'));
  trail.append(element('p', 'These are stated roles and claims, not a verified publishing timeline.'));
  if (contextUrl) {
    const url = safeUrl(contextUrl);
    if (url) trail.append(element('p', `User-supplied page context: ${new URL(url).hostname} (unverified; not used as a credit)`));
  }
}

function setPhase(phase) {
  document.body.dataset.phase = phase;
}

function setPageLabel(text) {
  $('page-url').hidden = !text;
  $('page-url').textContent = text || '';
}

function setSelection(text) {
  const selected = typeof text === 'string' ? text.trim() : '';
  $('selection-block').hidden = !selected;
  $('selection-preview').textContent = selected.length > 400 ? `${selected.slice(0, 400)}…` : selected;
}

function applyState(state) {
  if (!state || typeof state !== 'object') return;
  $('paste-section').classList.toggle('attention', state.kind === 'error');
  $('read-status').textContent = state.message || '';
  if (state.kind === 'reading') {
    currentCapture = null;
    setPhase('reading');
    $('case-tag').textContent = 'INVESTIGATING';
    $('result-summary').textContent = 'Reading the page at your request…';
    setPageLabel(state.pageLabel || '');
    setSelection('');
    render(emptyResult());
    return;
  }
  if (state.kind === 'ready' && state.capture) {
    try {
      currentCapture = state.capture;
      const result = analyzeCapture(state.capture);
      render(result);
      const found = Object.values(result).filter((field) => field.status !== 'unknown').length;
      const conflicts = Object.values(result).filter((field) => field.status === 'conflict').length;
      $('case-tag').textContent = 'PAGE READ';
      $('result-summary').textContent = `${found} of 3 credit roles have evidence.${conflicts ? ' Conflicting claims need a closer look.' : ' Each claim links to its visible line or metadata value.'}`;
      setPageLabel(`Page context: ${state.capture.title || 'Untitled page'} · ${state.capture.url || ''} (not a publication credit)`);
      setSelection(state.capture.selection);
      setPhase('found');
      $('findings-title').focus();
    } catch {
      applyState({ kind: 'error', message: 'The page data could not be analyzed. Paste its visible credit lines below.' });
    }
    return;
  }
  currentCapture = null;
  setPhase('idle');
  $('case-tag').textContent = state.kind === 'stale' ? 'PAGE CHANGED' : state.kind === 'error' ? 'PASTE FALLBACK' : 'READY';
  $('result-summary').textContent = state.kind === 'stale' ? 'Previous results were cleared because the page or tab changed.' : 'Three questions. Only answers the evidence supports.';
  setPageLabel(state.kind === 'error' ? state.pageLabel || '' : '');
  setSelection('');
  render(emptyResult());
}

$('paste-form').addEventListener('submit', (event) => {
  event.preventDefault();
  $('paste-error').hidden = true;
  try {
    const rawUrl = $('context-url').value.trim();
    const url = rawUrl ? safeUrl(rawUrl) : null;
    if (rawUrl && !url) throw new Error('Use a complete http:// or https:// URL, or leave the context blank.');
    const result = extractPasted($('article-text').value);
    currentCapture = null;
    render(result, url);
    const found = Object.values(result).filter((field) => field.status !== 'unknown').length;
    const conflicts = Object.values(result).filter((field) => field.status === 'conflict').length;
    $('case-tag').textContent = 'PASTED TEXT ONLY';
    $('read-status').textContent = 'These findings use only the text you pasted. Page credits were not imported.';
    $('result-summary').textContent = `${found} of 3 credit roles have evidence.${conflicts ? ' Conflicting claims need a closer look.' : ' Missing roles stay unknown.'}`;
    setPageLabel('');
    setSelection('');
    setPhase('found');
    $('paste-section').classList.remove('attention');
    $('findings-title').focus();
  } catch (error) {
    $('paste-error').textContent = error?.message || 'The text could not be analyzed.';
    $('paste-error').hidden = false;
  }
});

$('article-text').addEventListener('input', () => {
  $('character-count').textContent = `${$('article-text').value.length.toLocaleString()} / 60,000`;
  if ($('case-tag').textContent === 'PASTED TEXT ONLY') {
    $('case-tag').textContent = 'RESULTS NEED REFRESH';
    $('result-summary').textContent = 'Text changed. Follow the credits again to update these results.';
  }
});

$('context-url').addEventListener('input', () => {
  if ($('case-tag').textContent === 'PASTED TEXT ONLY') $('case-tag').textContent = 'RESULTS NEED REFRESH';
});

$('clear-all').addEventListener('click', () => {
  $('article-text').value = '';
  $('context-url').value = '';
  $('character-count').textContent = '0 / 60,000';
  $('paste-error').hidden = true;
  $('paste-section').classList.remove('attention');
  currentCapture = null;
  render(emptyResult());
  setPhase('idle');
  $('case-tag').textContent = 'READY';
  $('read-status').textContent = 'Click the toolbar button to read a page, or paste credit lines below.';
  $('result-summary').textContent = 'Three questions. Only answers the evidence supports.';
  setPageLabel('');
  setSelection('');
  chrome.runtime.sendMessage({ type: 'BYWHOM_CLEAR' }).catch(() => {});
  $('article-text').focus();
});

$('close-evidence').addEventListener('click', () => $('evidence-dialog').close());
$('evidence-dialog').addEventListener('close', () => lastEvidenceTrigger?.isConnected && lastEvidenceTrigger.focus());
$('evidence-dialog').addEventListener('click', (event) => {
  if (event.target !== $('evidence-dialog')) return;
  const box = event.target.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
});

function setMotionPaused(paused) {
  document.body.classList.toggle('motion-off', paused);
  $('motion-toggle').textContent = paused ? 'Play animation' : 'Pause animation';
  $('motion-toggle').setAttribute('aria-pressed', String(paused));
  try { localStorage.setItem('bywhom-motion-paused', paused ? '1' : '0'); } catch {}
}

$('motion-toggle').addEventListener('click', () => setMotionPaused(!document.body.classList.contains('motion-off')));
try { setMotionPaused(localStorage.getItem('bywhom-motion-paused') === '1'); } catch { setMotionPaused(false); }
render(emptyResult());
chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'BYWHOM_STATE') applyState(message.state); });
chrome.runtime.sendMessage({ type: 'BYWHOM_GET_STATE' }).then(applyState).catch(() => {
  applyState({ kind: 'idle', message: 'Click the ByWhom toolbar button on an article.' });
});

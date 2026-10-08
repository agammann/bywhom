// A toolbar click is the only entry point that injects the one-shot page reader.
// No page is watched, fetched, or read when this worker starts or a tab navigates.
let generation = 0;
let state = { kind: 'idle', capture: null, message: 'Click the ByWhom toolbar button on an article.' };

function publish() {
  chrome.runtime.sendMessage({ type: 'BYWHOM_STATE', state }).catch(() => {
    // The panel may not exist yet; it requests the current in-memory state on load.
  });
}

function setState(next) {
  state = next;
  publish();
}

function readableUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function stale(message) {
  generation += 1;
  setState({ kind: 'stale', capture: null, message });
}

chrome.action.onClicked.addListener((tab) => {
  const invocation = ++generation;
  const tabId = tab.id;
  const windowId = tab.windowId;
  const pageLabel = typeof tab.url === 'string' ? tab.url : '';
  setState({ kind: 'reading', capture: null, tabId, pageLabel, message: 'Reading this page’s visible credits and article metadata…' });

  // Start selection capture before the panel can take focus. Both API calls begin
  // directly in the click handler so the activeTab grant and user gesture apply.
  const capture = Number.isInteger(tabId) && readableUrl(tab.url)
    ? chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] })
    : Promise.reject(new Error('restricted-page'));
  const open = Number.isInteger(windowId)
    ? chrome.sidePanel.open({ windowId })
    : Promise.reject(new Error('missing-window'));

  open.catch(() => {
    if (invocation === generation) {
      setState({ kind: 'error', capture: null, tabId, pageLabel, message: 'The side panel could not open. Try the toolbar button again.' });
    }
  });

  capture.then((entries) => {
    if (invocation !== generation) return;
    const captured = entries?.[0]?.result;
    if (!captured || typeof captured !== 'object' || !Array.isArray(captured.visibleLines)) {
      throw new Error('invalid-capture');
    }
    setState({ kind: 'ready', capture: captured, tabId, pageLabel: captured.url || pageLabel, message: 'Page read at your request.' });
  }).catch(() => {
    if (invocation === generation) {
      setState({ kind: 'error', capture: null, tabId, pageLabel, message: 'This page could not be read. You can paste its visible credit lines below.' });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (state.tabId === tabId && (changeInfo.status === 'loading' || changeInfo.url)) {
    stale('The page changed. Click the ByWhom toolbar button to read it again.');
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (state.tabId !== undefined && state.tabId !== tabId && state.kind !== 'stale') {
    stale('You switched tabs. Click the ByWhom toolbar button on the page you want to read.');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.tabId === tabId) stale('That page closed. Click the ByWhom toolbar button on another page.');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'BYWHOM_GET_STATE') {
    sendResponse(state);
  } else if (message?.type === 'BYWHOM_CLEAR') {
    generation += 1;
    setState({ kind: 'idle', capture: null, message: 'Click the ByWhom toolbar button on an article.' });
    sendResponse({ ok: true });
  }
});

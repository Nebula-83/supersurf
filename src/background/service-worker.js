const defaults = {
  popups: true,
  links: true,
  downloads: true,
  focus: false,
  diagnostics: true,
  selectionSearch: true,
  notificationPosition: 'top-right',
  focusOutlineColor: 'gold'
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(defaults, values => chrome.storage.local.set(values));
});

const selectionWindows = new Map();

async function closeSelectionSearch(tabId) {
  const windowId = selectionWindows.get(tabId);
  if (!windowId) return;
  selectionWindows.delete(tabId);
  try {
    await chrome.windows.remove(windowId);
  } catch {
    // The user may have already closed the search window.
  }
}

async function openSelectionSearch(message, tabId) {
  const text = typeof message.text === 'string' ? message.text.trim().slice(0, 2000) : '';
  if (!text) return;

  await closeSelectionSearch(tabId);
  const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  const popup = {
    url,
    type: 'popup',
    width: 540,
    height: 800,
    left: 0,
    top: 0,
    focused: true
  };

  if (chrome.windows?.create) {
    const created = await chrome.windows.create(popup);
    if (created?.id) selectionWindows.set(tabId, created.id);
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'selection-search' || !sender.tab?.id) return;
  openSelectionSearch(message, sender.tab.id).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'selection-cleared' || !sender.tab?.id) return;
  closeSelectionSearch(sender.tab.id).catch(() => {});
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-focus') return;
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id) {
    const current = await chrome.storage.local.get({ focus: false });
    const focus = !current.focus;
    await chrome.storage.local.set({ focus });
    const result = chrome.tabs.sendMessage(tab.id, { type: 'apply', settings: { focus } });
    result?.catch?.(() => {});
  }
});

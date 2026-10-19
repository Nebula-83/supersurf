const defaults = {
  popups: true,
  links: true,
  downloads: true,
  focus: false,
  diagnostics: true,
  notificationPosition: 'top-right',
  focusOutlineColor: 'gold'
};

function createSelectionContextMenu() {
  const create = () => chrome.contextMenus.create({
    id: 'supersurf-search',
    title: 'Search selected text with Google',
    contexts: ['selection']
  });
  if (typeof chrome.contextMenus.removeAll === 'function') chrome.contextMenus.removeAll(create);
  else create();
}

chrome.runtime.onInstalled.addListener(() => {
  createSelectionContextMenu();
  chrome.storage.local.get(defaults, values => chrome.storage.local.set(values));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'supersurf-search' || !info.selectionText) return;
  chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(info.selectionText)}` }, () => {
    if (tab?.id) {
      const result = chrome.tabs.sendMessage(tab.id, { type: 'selection-answer' });
      result?.catch?.(() => {});
    }
  });
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

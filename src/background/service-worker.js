chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'clearview-search', title: 'Search ClearView selection with Google', contexts: ['selection'] });
  chrome.storage.sync.set({ popups: true, links: true, downloads: true, focus: false, diagnostics: true });
});
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'clearview-search' && info.selectionText) chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(info.selectionText)}` });
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-focus') return;
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id) {
    const current = await chrome.storage.sync.get({ focus: false });
    const focus = !current.focus;
    await chrome.storage.sync.set({ focus });
    chrome.tabs.sendMessage(tab.id, { type: 'apply', settings: { focus } }).catch(() => {});
  }
});
chrome.runtime.onMessage.addListener((msg, sender) => { if (msg.type === 'page-ready' && sender.tab?.id) chrome.storage.session.set({ [`page-${sender.tab.id}`]: msg.diagnostics }); });

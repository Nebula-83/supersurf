const defaults = { popups: true, links: true, downloads: true, focus: false };
const ids = Object.keys(defaults);
const query = (id) => document.getElementById(id);
chrome.storage.sync.get(defaults, (values) => ids.forEach(id => { query(id).checked = values[id]; }));
ids.forEach(id => query(id).addEventListener('change', async () => {
  const settings = {}; ids.forEach(key => settings[key] = query(key).checked);
  await chrome.storage.sync.set(settings);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'apply', settings }).catch(() => {});
}));
query('diagnostics').onclick = async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'diagnostics' }).catch(() => {}); window.close(); };
query('options').onclick = () => chrome.runtime.openOptionsPage();

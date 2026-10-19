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

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
}

async function openSelectionSearch(message) {
  const text = typeof message.text === 'string' ? message.text.trim().slice(0, 2000) : '';
  if (!text) return;

  const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  const width = clamp(message.width, 320, 620, 420);
  const height = clamp(message.height, 240, 520, 320);
  const popup = {
    url,
    type: 'popup',
    width,
    height,
    left: 0,
    top: 0,
    focused: false
  };

  if (chrome.windows?.create) {
    await chrome.windows.create(popup);
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'selection-search' || !sender.tab?.id) return;
  openSelectionSearch(message).catch(() => {});
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

const defaults = {
  popups: true,
  links: true,
  downloads: true,
  focus: false,
  diagnostics: true,
  riskAlerts: true,
  notificationPosition: 'top-right',
  focusOutlineColor: 'gold'
};

const toggleIds = ['popups', 'links', 'downloads', 'focus', 'riskAlerts'];
const positionIds = ['notification-top-right', 'notification-top-left'];
const colorIds = ['focus-color-gold', 'focus-color-blue', 'focus-color-green'];
const query = (id) => document.getElementById(id);
const extensionApi = globalThis.chrome || {};
const storage = extensionApi.storage?.local;
let currentSettings = { ...defaults };

function callChrome(method, args = []) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const result = method(...args, finish);
      if (result && typeof result.then === 'function') result.then(finish, reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function loadSettings() {
  if (!storage?.get) return { ...defaults };
  try {
    const values = await callChrome(storage.get.bind(storage), [defaults]);
    const settings = { ...defaults, ...(values || {}) };
    if (!['top-right', 'top-left'].includes(settings.notificationPosition)) settings.notificationPosition = defaults.notificationPosition;
    if (!['gold', 'blue', 'green'].includes(settings.focusOutlineColor)) settings.focusOutlineColor = defaults.focusOutlineColor;
    return settings;
  } catch {
    return { ...defaults };
  }
}

function readControls() {
  const settings = { ...currentSettings };
  toggleIds.forEach((id) => {
    const control = query(id);
    if (control) settings[id] = Boolean(control.checked);
  });
  const position = document.querySelector('input[name="notificationPosition"]:checked');
  const color = document.querySelector('input[name="focusOutlineColor"]:checked');
  if (position?.value) settings.notificationPosition = position.value;
  if (color?.value) settings.focusOutlineColor = color.value;
  return settings;
}

function applyControls(settings) {
  toggleIds.forEach((id) => {
    const control = query(id);
    if (control) control.checked = Boolean(settings[id]);
  });
  positionIds.forEach((id) => {
    const control = query(id);
    if (control) control.checked = control.value === settings.notificationPosition;
  });
  colorIds.forEach((id) => {
    const control = query(id);
    if (control) control.checked = control.value === settings.focusOutlineColor;
  });
}

function setStatus(message) {
  const status = query('saveStatus');
  if (status) status.textContent = message;
}

async function sendToActiveTab(settings) {
  if (!extensionApi.tabs?.query || !extensionApi.tabs?.sendMessage) return;
  try {
    const tabs = await callChrome(extensionApi.tabs.query.bind(extensionApi.tabs), [{ active: true, currentWindow: true }]);
    const tab = tabs?.[0];
    if (tab?.id) await callChrome(extensionApi.tabs.sendMessage.bind(extensionApi.tabs), [tab.id, { type: 'apply', settings }]);
  } catch {
    // Chrome pages and closed tabs do not accept content-script messages.
  }
}

async function saveSettings() {
  const settings = readControls();
  currentSettings = settings;
  setStatus('Saving settings…');
  try {
    if (!storage?.set) throw new Error('Local storage is unavailable');
    await callChrome(storage.set.bind(storage), [settings]);
    await sendToActiveTab(settings);
    setStatus('Saved on this device.');
  } catch {
    setStatus('Could not save settings. Please try again.');
  }
}

async function runDiagnostics() {
  try {
    if (extensionApi.tabs?.query && extensionApi.tabs?.sendMessage) {
      const tabs = await callChrome(extensionApi.tabs.query.bind(extensionApi.tabs), [{ active: true, currentWindow: true }]);
      const tab = tabs?.[0];
      if (tab?.id) await callChrome(extensionApi.tabs.sendMessage.bind(extensionApi.tabs), [tab.id, { type: 'diagnostics' }]);
    }
  } catch {
    // Diagnostics are unavailable on browser-managed pages.
  } finally {
    window.close();
  }
}

async function openOptions() {
  try {
    if (extensionApi.runtime?.openOptionsPage) {
      await extensionApi.runtime.openOptionsPage();
      return;
    }
  } catch {
    // Fall back to the extension-relative page below.
  }
  window.location.href = '../options/options.html';
}

async function openRemovalPage() {
  const message = 'Chrome requires you to confirm removal in its extensions manager. Open chrome://extensions now?';
  const confirmed = typeof window.confirm === 'function' ? window.confirm(message) : true;
  if (!confirmed) return;
  const status = query('removeStatus');
  if (status) status.textContent = 'Opening Chrome extension settings…';
  try {
    if (extensionApi.tabs?.create) {
      await extensionApi.tabs.create({ url: 'chrome://extensions' });
      return;
    }
  } catch {
    // Use the browser navigation fallback when the tabs API is unavailable.
  }
  window.location.href = 'chrome://extensions';
}

toggleIds.concat(positionIds, colorIds).forEach((id) => query(id)?.addEventListener('change', saveSettings));
query('diagnostics')?.addEventListener('click', runDiagnostics);
query('options')?.addEventListener('click', openOptions);
query('removeClearView')?.addEventListener('click', openRemovalPage);

(async () => {
  currentSettings = await loadSettings();
  applyControls(currentSettings);
  setStatus('Saved on this device.');
})();

(function () {
  const A = globalThis.ClearViewAnalyzers;
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
  const scanDebounceMs = 250;
  const minScanIntervalMs = 800;
  let settings = { ...defaults };
  let scanTimer = 0;
  let lastScanAt = 0;
  let riskNoticeShown = false;
  const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});

  function toast(title, body, kind = 'alert') {
    document.querySelector('.cv-panel')?.remove();
    const box = document.createElement('aside'); box.className = 'cv-panel';
    const position = kind === 'selection' ? 'bottom-right' : A.normalizeNotificationPosition(settings.notificationPosition);
    box.dataset.cvPosition = position;
    box.dataset.cvNoticeKind = kind;
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close notification');
    close.textContent = '×';
    close.onclick = () => box.remove();
    const heading = document.createElement('strong');
    heading.textContent = title;
    const message = document.createElement('div');
    message.textContent = body;
    box.append(close, heading, message);
    document.body.append(box);
  }

  function dismissPopups() {
    let count = 0;
    document.querySelectorAll('body *').forEach(el => {
      if (!A.isLikelyOverlay(el)) return;
      const close = [...el.querySelectorAll('button,[role="button"],a')].find(b => A.isSafeDismissLabel(b.innerText || b.getAttribute('aria-label') || ''));
      if (close) { close.click(); count++; }
    });
    if (count) toast('Ad overlays cleared', `${count} ad-focused overlay${count === 1 ? '' : 's'} dismissed. Cookie, consent, login, payment and security dialogs stay untouched.`);
  }

  function performScan() {
    lastScanAt = Date.now();
    if (settings.links) document.querySelectorAll('a').forEach(link => { const c = A.classifyLink(link.getAttribute('href'), location.href); link.classList.toggle('cv-broken-link', c.status === 'broken'); if (c.status === 'broken') link.title = `ClearView: ${c.reason}`; });
    if (settings.downloads) document.querySelectorAll('a,button,[role="button"]').forEach(el => { const c = A.scoreDownload(el.innerText || el.getAttribute('aria-label') || '', el.href || el.getAttribute('data-href') || '', el.dataset); el.classList.toggle('cv-download-link', c.likely); if (c.likely) el.title = `ClearView: ${c.reasons.join(', ')}`; });
  }

  function scheduleScan(immediate = false) {
    if (scanTimer) window.clearTimeout(scanTimer);
    const elapsed = Date.now() - lastScanAt;
    const delay = immediate ? 0 : Math.max(scanDebounceMs, minScanIntervalMs - elapsed);
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      performScan();
    }, delay);
  }

  function focus(enabled, outlineColor) {
    const root = document.documentElement;
    const color = A.normalizeFocusOutlineColor(outlineColor || settings.focusOutlineColor);
    root.classList.toggle('cv-focus-mode', Boolean(enabled));
    if (enabled) root.dataset.cvFocusColor = color;
    else delete root.dataset.cvFocusColor;
  }

  function reportRisk() {
    if (!settings.riskAlerts) {
      document.querySelector('.cv-panel[data-cv-notice-kind="risk"]')?.remove();
      riskNoticeShown = false;
      return;
    }
    if (riskNoticeShown) return;
    const risk = A.analyzePageRisk(location.href);
    if (!risk.flagged) return;
    riskNoticeShown = true;
    toast('Heuristic safety signal', `Local heuristic only: ${risk.signals.join(', ')}. This is not proof of phishing or malware; ClearView sends no URL or page text.`, 'risk');
  }

  function report() {
    const d = A.diagnostics();
    toast('Page health (observed)', `${d.resources} resources · ${d.slowResources} slow · ${d.failedResources} possibly failed. These are local signals, not proof of an ISP or server issue.`, 'alert');
  }

  function apply(next = {}) {
    settings = {
      ...settings,
      ...next,
      notificationPosition: A.normalizeNotificationPosition(next.notificationPosition || settings.notificationPosition),
      focusOutlineColor: A.normalizeFocusOutlineColor(next.focusOutlineColor || settings.focusOutlineColor)
    };
    focus(settings.focus, settings.focusOutlineColor);
    if (settings.popups) dismissPopups();
    scheduleScan(true);
    reportRisk();
  }

  chrome.storage.local.get(defaults, apply);
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'apply') { apply(msg.settings); reply({ ok: true }); }
    if (msg.type === 'diagnostics') report();
    if (msg.type === 'selection-answer') toast('Search selected text', 'A Google results tab was opened by your context-menu action. ClearView sends no selected text to a private AI service.', 'selection');
  });
  new MutationObserver(() => scheduleScan()).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { if (settings.diagnostics) send('page-ready', { diagnostics: A.diagnostics() }); }, { once: true });
})();

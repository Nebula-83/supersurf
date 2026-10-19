(function () {
  const A = globalThis.SuperSurfAnalyzers;
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
  const candidateSelector = 'a,button,[role="button"]';
  const scanDebounceMs = 250;
  const minScanIntervalMs = 800;
  let settings = { ...defaults };
  let scanTimer = 0;
  let lastScanAt = 0;
  let lastScanSignature = '';
  let lastSelectionKey = '';
  let lastSelectionSearchAt = 0;
  const focusMarkers = new Map();

  function send(type, payload = {}) {
    try {
      const result = chrome.runtime.sendMessage({ type, ...payload });
      result?.catch?.(() => {});
    } catch {
      // Restricted or closed pages can reject extension messages.
    }
  }

  function toast(title, body) {
    document.querySelector('.ss-panel')?.remove();
    const box = document.createElement('aside');
    box.className = 'ss-panel';
    const position = A.normalizeNotificationPosition(settings.notificationPosition);
    box.dataset.ssPosition = position;

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close notification');
    close.textContent = '×';
    close.onclick = () => box.remove();

    const heading = document.createElement('strong');
    heading.textContent = String(title);
    const message = document.createElement('div');
    message.textContent = String(body);
    box.append(close, heading, message);
    document.body?.append(box);
  }

  function dismissPopups() {
    let count = 0;
    document.querySelectorAll('body *').forEach(el => {
      if (!el.isConnected || el.matches?.('.ss-panel,.ss-panel *') || !A.isLikelyOverlay(el)) return;
      const close = [...el.querySelectorAll('button,[role="button"],a')].find(button => {
        if (A.isProtectedElement(button)) return false;
        if (button.hasAttribute('download')) return false;
        const likelyDownload = A.scoreDownload(
          button.innerText || button.getAttribute('aria-label') || '',
          button.getAttribute('href') || button.getAttribute('data-href') || '',
          button.dataset
        );
        if (likelyDownload.likely) return false;
        return A.isSafeDismissLabel(button.innerText || button.getAttribute('aria-label') || '');
      });
      if (close) {
        close.click();
        count++;
      }
    });
    if (count) toast('Ad overlays cleared', `${count} ad-focused overlay${count === 1 ? '' : 's'} dismissed. Protected cookie, consent, login, payment and security content was left alone.`);
  }

  function candidateText(el) {
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  function candidateFingerprint(el) {
    const download = el.getAttribute('download');
    const attrs = [
      el.tagName,
      el.getAttribute('href') || '',
      el.getAttribute('data-href') || '',
      download === null ? '' : `download:${download}`,
      el.getAttribute('aria-label') || '',
      candidateText(el),
      A.isProtectedElement(el) ? 'protected' : 'normal'
    ];
    return attrs.join('\u001f');
  }

  function scanSignature() {
    const candidates = [...document.querySelectorAll(candidateSelector)];
    return `${settings.links ? 'links' : 'no-links'}|${settings.downloads ? 'downloads' : 'no-downloads'}|${candidates.map(candidateFingerprint).join('\u001e')}`;
  }

  function scanCandidate(el) {
    const protectedContent = A.isProtectedElement(el);
    const isLink = el.matches('a');

    if (settings.links && isLink && !protectedContent) {
      const result = A.classifyLink(el.getAttribute('href'), location.href);
      el.classList.toggle('ss-broken-link', result.status === 'broken');
    } else if (isLink) {
      el.classList.remove('ss-broken-link');
    }

    if (settings.downloads && !protectedContent) {
      const attrs = { ...el.dataset };
      if (el.hasAttribute('download')) attrs.download = el.getAttribute('download') || '';
      const result = A.scoreDownload(
        el.innerText || el.getAttribute('aria-label') || '',
        el.getAttribute('href') || el.getAttribute('data-href') || '',
        attrs
      );
      el.classList.toggle('ss-download-link', result.likely);
    } else {
      el.classList.remove('ss-download-link');
    }
  }

  function performScan() {
    lastScanAt = Date.now();
    const signature = scanSignature();
    if (signature === lastScanSignature) return;
    lastScanSignature = signature;
    document.querySelectorAll(candidateSelector).forEach(scanCandidate);
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

  function addFocusMarker(el, className) {
    if (!el || el.nodeType !== 1) return;
    if (!el.classList.contains(className)) {
      el.classList.add(className);
      const classes = focusMarkers.get(el) || new Set();
      classes.add(className);
      focusMarkers.set(el, classes);
    }
  }

  function clearFocusMarkers() {
    focusMarkers.forEach((classes, el) => classes.forEach(className => el.classList.remove(className)));
    focusMarkers.clear();
  }

  function findFocusTarget() {
    return [...document.querySelectorAll('main,article,[role="main"],[itemprop="articleBody"]')]
      .find(el => !A.isProtectedElement(el));
  }

  function focus(enabled, outlineColor) {
    const root = document.documentElement;
    clearFocusMarkers();
    root.classList.toggle('ss-focus-mode', Boolean(enabled));
    root.classList.remove('ss-focus-has-target');
    if (!enabled) {
      delete root.dataset.ssFocusColor;
      return;
    }

    const target = findFocusTarget();
    if (target) {
      root.classList.add('ss-focus-has-target');
      addFocusMarker(target, 'ss-focus-main');
      let current = target;
      while (current && current !== document.body) {
        addFocusMarker(current, 'ss-focus-content');
        current = current.parentElement;
      }
    }
    root.dataset.ssFocusColor = A.normalizeFocusOutlineColor(outlineColor || settings.focusOutlineColor);
  }

  function report() {
    if (!settings.diagnostics) return;
    const d = A.diagnostics();
    toast('Page health (observed)', `${d.resources} resources · ${d.slowResources} slow · ${d.failedResources} possibly failed. These are local signals, not proof of an ISP or server issue.`);
  }

  function clearSelectionSearch() {
    if (document.hasFocus?.() !== false) send('selection-cleared');
  }

  function searchSelectionAfterMouseUp(event) {
    if (!settings.selectionSearch || event.button !== 0) return;
    if (event.target?.closest?.('input,textarea,select,[contenteditable="true"],.ss-panel')) return;

    window.setTimeout(() => {
      const selection = window.getSelection?.();
      const text = selection?.toString?.().replace(/\s+/g, ' ').trim().slice(0, 2000) || '';
      if (!text || !selection || selection.rangeCount === 0) {
        clearSelectionSearch();
        return;
      }

      const now = Date.now();
      const key = `${text}\u001f${selection.anchorOffset}\u001f${selection.focusOffset}`;
      if (key === lastSelectionKey && now - lastSelectionSearchAt < 1500) return;
      lastSelectionKey = key;
      lastSelectionSearchAt = now;
      send('selection-search', { text });
    }, 0);
  }

  function apply(next = {}) {
    const incoming = next && typeof next === 'object' ? next : {};
    settings = {
      ...settings,
      ...incoming,
      notificationPosition: A.normalizeNotificationPosition(incoming.notificationPosition || settings.notificationPosition),
      focusOutlineColor: A.normalizeFocusOutlineColor(incoming.focusOutlineColor || settings.focusOutlineColor)
    };
    focus(settings.focus, settings.focusOutlineColor);
    if (settings.popups) dismissPopups();
    scheduleScan(true);
  }

  function hasCandidate(node) {
    if (!node) return false;
    if (node.nodeType === 1) return Boolean(node.matches?.(candidateSelector) || node.querySelector?.(candidateSelector));
    return Boolean(node.parentElement?.closest?.(candidateSelector));
  }

  function onlySuperSurfClassChange(record) {
    if (record.attributeName !== 'class') return false;
    const superSurfClasses = /\b(?:ss-broken-link|ss-download-link|ss-focus-mode|ss-focus-has-target|ss-focus-main|ss-focus-content)\b/g;
    const strip = value => String(value || '').replace(superSurfClasses, '').replace(/\s+/g, ' ').trim();
    return strip(record.oldValue) === strip(record.target.getAttribute('class'));
  }

  function mutationNeedsScan(record) {
    if (record.target?.closest?.('.ss-panel')) return false;
    if (record.type === 'childList') {
      if (record.target?.matches?.(candidateSelector) || record.target?.closest?.(candidateSelector)) return true;
      return [...record.addedNodes, ...record.removedNodes].some(hasCandidate);
    }
    if (record.type === 'attributes' && onlySuperSurfClassChange(record)) return false;
    if (record.target?.matches?.(candidateSelector) || record.target?.closest?.(candidateSelector)) return true;
    if (record.attributeName === 'id') return true;
    return record.attributeName !== 'class' && record.attributeName !== 'id' ? false : hasCandidate(record.target);
  }

  chrome.storage.local.get(defaults, apply);
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'apply') {
      apply(msg.settings);
      reply({ ok: true });
    }
    if (msg.type === 'diagnostics') report();
  });

  document.addEventListener('mouseup', searchSelectionAfterMouseUp, true);
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection?.();
    if (selection?.toString?.().trim()) return;
    window.setTimeout(clearSelectionSearch, 120);
  });

  if (typeof MutationObserver === 'function') {
    new MutationObserver(records => {
      if (records.some(mutationNeedsScan)) scheduleScan();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['href', 'download', 'data-href', 'aria-label', 'role', 'id', 'class']
    });
  }
})();

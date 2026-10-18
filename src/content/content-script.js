(function () {
  const A = globalThis.ClearViewAnalyzers;
  const defaults = { popups: true, links: true, downloads: true, focus: false, diagnostics: true };
  let settings = { ...defaults };
  const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
  function toast(title, body) {
    document.querySelector('.cv-panel')?.remove();
    const box = document.createElement('aside'); box.className = 'cv-panel';
    box.innerHTML = `<button aria-label="Close">×</button><strong>${title}</strong><div>${body}</div>`;
    box.querySelector('button').onclick = () => box.remove(); document.body.append(box);
  }
  function dismissPopups() {
    let count = 0;
    document.querySelectorAll('body *').forEach(el => {
      if (!A.isLikelyOverlay(el)) return;
      const close = [...el.querySelectorAll('button,[role="button"],a')].find(b => /^(×|x|close|dismiss|no thanks|not now|got it)$/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
      if (close) { close.click(); count++; }
    });
    if (count) toast('Popups cleared', `${count} non-essential overlay${count === 1 ? '' : 's'} dismissed. Login, payment and security dialogs are left untouched.`);
  }
  function scan() {
    if (settings.links) document.querySelectorAll('a').forEach(link => { const c = A.classifyLink(link.getAttribute('href'), location.href); link.classList.toggle('cv-broken-link', c.status === 'broken'); if (c.status === 'broken') link.title = `ClearView: ${c.reason}`; });
    if (settings.downloads) document.querySelectorAll('a,button,[role="button"]').forEach(el => { const c = A.scoreDownload(el.innerText || el.getAttribute('aria-label') || '', el.href || el.getAttribute('data-href') || '', el.dataset); el.classList.toggle('cv-download-link', c.likely); if (c.likely) el.title = `ClearView: ${c.reasons.join(', ')}`; });
  }
  function focus(enabled) { document.documentElement.classList.toggle('cv-focus-mode', enabled); }
  function report() { const d = A.diagnostics(); toast('Page health (observed)', `${d.resources} resources · ${d.slowResources} slow · ${d.failedResources} possibly failed. These are local signals, not proof of an ISP or server issue.`); }
  function apply(next) { settings = { ...settings, ...next }; focus(settings.focus); if (settings.popups) dismissPopups(); scan(); }
  chrome.storage.sync.get(defaults, apply);
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => { if (msg.type === 'apply') { apply(msg.settings); reply({ ok: true }); } if (msg.type === 'diagnostics') report(); if (msg.type === 'selection-answer') toast('Search selected text', 'A Google results tab was opened. ClearView does not send selected text to a private AI service.'); });
  new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { if (settings.diagnostics) send('page-ready', { diagnostics: A.diagnostics() }); }, { once: true });
})();

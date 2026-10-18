(function (root) {
  const badSchemes = /^(javascript|data|mailto):/i;
  const downloadWords = /\b(download|export|save|pdf|csv|xlsx|zip|install)\b/i;
  function classifyLink(href, base = 'https://example.test/') {
    if (!href || href === '#') return { status: 'broken', reason: 'missing destination' };
    if (badSchemes.test(href)) return { status: 'broken', reason: 'unsupported link scheme' };
    try {
      const url = new URL(href, base);
      const pageDocument = typeof document !== 'undefined' ? document : null;
      if (url.hash && url.pathname === new URL(base).pathname && pageDocument && !pageDocument.getElementById(url.hash.slice(1))) return { status: 'broken', reason: 'missing in-page target' };
      return { status: 'unknown', reason: 'needs a network check' };
    } catch { return { status: 'broken', reason: 'invalid URL' }; }
  }
  function scoreDownload(label, href = '', attrs = {}) {
    const text = `${label} ${href} ${Object.values(attrs).join(' ')}`;
    let score = 0; const reasons = [];
    if (attrs.download !== undefined) { score += 5; reasons.push('download attribute'); }
    if (downloadWords.test(text)) { score += 3; reasons.push('action wording'); }
    if (/\.(pdf|zip|csv|xlsx?|docx?|png|jpe?g)(?:$|[?#])/i.test(href)) { score += 3; reasons.push('file extension'); }
    return { score, likely: score >= 4, reasons };
  }
  function isLikelyOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el); const text = (el.innerText || '').slice(0, 300);
    return (el.matches('[role="dialog"],[aria-modal="true"]') || (style.position === 'fixed' && Number(style.zIndex || 0) > 10 && el.getBoundingClientRect().width > 240)) && !/password|payment|checkout|sign in|log in/i.test(text);
  }
  function diagnostics() {
    const entries = performance.getEntriesByType('resource');
    const slow = entries.filter(e => e.duration > 3000).length;
    return { readyState: document.readyState, resources: entries.length, slowResources: slow, failedResources: entries.filter(e => e.transferSize === 0 && e.duration > 0).length, observedAt: new Date().toISOString() };
  }
  root.ClearViewAnalyzers = { classifyLink, scoreDownload, isLikelyOverlay, diagnostics };
  if (typeof module !== 'undefined') module.exports = root.ClearViewAnalyzers;
})(typeof globalThis !== 'undefined' ? globalThis : window);

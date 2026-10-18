(function (root) {
  const badSchemes = /^(javascript|data|mailto):/i;
  const downloadWords = /\b(download|export|save|pdf|csv|xlsx|zip|install)\b/i;
  const protectedOverlayWords = /\b(?:cookie(?:s| policy)?|consent|privacy(?: policy| settings?)?|gdpr|ccpa|terms(?: of service)?|accept all|reject all|manage preferences|sign[ -]?in|log[ -]?in|login|password|payment|checkout|billing|credit card|security|security warning|captcha|verification|two[ -]?factor|2fa|one[ -]?time code|account recovery|authorize|permission)\b/i;
  const adOverlayWords = /\b(?:ad|ads|advert(?:isement|ising)?|sponsored|sponsor|promo(?:tion)?|special offer|sale|deal|newsletter|subscribe|free trial|upgrade|marketing|interstitial|banner)\b/i;
  const safeDismissLabels = /^(?:×|x|close|dismiss|no thanks|not now|got it|skip ad|close ad)$/i;
  const notificationPositions = new Set(['bottom-right', 'top-right', 'top-left']);
  const focusOutlineColors = new Set(['gold', 'blue', 'green']);
  const riskBrandWords = /(?:^|[.-])(?:paypal|apple|microsoft|google|amazon|facebook|instagram|netflix|bank)(?:[.-]|$)/i;
  const riskAccountWords = /(?:^|[.-])(?:login|signin|sign-in|verify|verification|secure|security|account|support|billing|wallet|password|unlock)(?:[.-]|$)/i;
  const executablePath = /\.(?:exe|scr|msi|bat|cmd|com|js|vbs|apk|dmg)(?:$|[?#])/i;

  function textValue(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function isProtectedOverlayText(text = '') {
    return protectedOverlayWords.test(textValue(text));
  }

  function isAdFocusedOverlayText(text = '') {
    const normalized = textValue(text);
    return Boolean(normalized) && !isProtectedOverlayText(normalized) && adOverlayWords.test(normalized);
  }

  function isSafeDismissLabel(label = '') {
    const normalized = textValue(label);
    return normalized.length <= 32 && safeDismissLabels.test(normalized) && !isProtectedOverlayText(normalized);
  }

  function normalizeNotificationPosition(position, fallback = 'top-right') {
    return notificationPositions.has(position) ? position : fallback;
  }

  function normalizeFocusOutlineColor(color, fallback = 'gold') {
    return focusOutlineColors.has(color) ? color : fallback;
  }

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
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : (el.style || {});
    const text = textValue((el.innerText || el.textContent || '')).slice(0, 500);
    const attributes = textValue(`${el.id || ''} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute?.('aria-label') || ''}`);
    const hasDialogSemantics = typeof el.matches === 'function' && el.matches('[role="dialog"],[aria-modal="true"]');
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { width: 0 };
    const isFixedOverlay = style.position === 'fixed' && Number(style.zIndex || 0) > 10 && rect.width > 240;
    if ((!hasDialogSemantics && !isFixedOverlay) || isProtectedOverlayText(`${text} ${attributes}`)) return false;
    if (typeof el.querySelector === 'function' && el.querySelector('form,input,textarea,select,[autocomplete="cc-number"],[autocomplete="current-password"]')) return false;
    return isAdFocusedOverlayText(`${text} ${attributes}`);
  }

  function analyzePageRisk(href = '') {
    let url;
    try { url = new URL(href); } catch { return { flagged: false, heuristic: true, signals: [] }; }
    const hostname = url.hostname.toLowerCase();
    const signals = [];
    if (/(?:^|\.)xn--/i.test(hostname)) signals.push('encoded hostname');
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) signals.push('numeric host');
    if (hostname.split('.').filter(Boolean).length > 4) signals.push('deep hostname');
    if (riskBrandWords.test(hostname) && riskAccountWords.test(hostname)) signals.push('brand and account terms in hostname');
    if (url.username || url.password) signals.push('credentials in URL');
    if (executablePath.test(url.pathname)) signals.push('executable download path');
    return { flagged: signals.length > 0, heuristic: true, signals };
  }

  function diagnostics() {
    const entries = performance.getEntriesByType('resource');
    const slow = entries.filter(e => e.duration > 3000).length;
    return { readyState: document.readyState, resources: entries.length, slowResources: slow, failedResources: entries.filter(e => e.transferSize === 0 && e.duration > 0).length, observedAt: new Date().toISOString() };
  }
  root.ClearViewAnalyzers = {
    classifyLink,
    scoreDownload,
    isLikelyOverlay,
    isProtectedOverlayText,
    isAdFocusedOverlayText,
    isSafeDismissLabel,
    normalizeNotificationPosition,
    normalizeFocusOutlineColor,
    analyzePageRisk,
    diagnostics
  };
  if (typeof module !== 'undefined') module.exports = root.ClearViewAnalyzers;
})(typeof globalThis !== 'undefined' ? globalThis : window);

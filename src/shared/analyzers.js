(function (root) {
  const badSchemes = /^(javascript|data):/i;
  const externalHandlerSchemes = /^(mailto|tel):/i;
  const downloadWords = /\b(download|export|save|pdf|csv|xlsx|zip|install)\b/i;
  const protectedOverlayWords = /\b(?:cookie(?:s| policy)?|consent|privacy(?: policy| settings?)?|gdpr|ccpa|terms(?: of service)?|accept all|reject all|manage preferences|sign[ -]?in|log[ -]?in|login|password|payment|checkout|billing|credit card|security|security warning|captcha|verification|two[ -]?factor|2fa|one[ -]?time code|account recovery|authorize|permission)\b/i;
  const adOverlayWords = /\b(?:ad|ads|advert(?:isement|ising)?|sponsored|sponsor|promo(?:tion)?|special offer|sale|deal|newsletter|subscribe|free trial|upgrade|marketing|interstitial|banner)\b/i;
  const safeDismissLabels = /^(?:×|x|close|dismiss|no thanks|not now|got it|skip ad|close ad)$/i;
  const notificationPositions = new Set(['top-right', 'top-left']);
  const focusOutlineColors = new Set(['gold', 'blue', 'green']);

  function textValue(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function elementAttributeText(el) {
    if (!el || el.nodeType !== 1) return '';
    const className = typeof el.className === 'string' ? el.className : '';
    const getAttribute = typeof el.getAttribute === 'function' ? (name) => el.getAttribute(name) || '' : () => '';
    return textValue([
      el.id || '',
      className,
      getAttribute('aria-label'),
      getAttribute('name'),
      getAttribute('type'),
      getAttribute('autocomplete'),
      getAttribute('placeholder'),
      getAttribute('title'),
      getAttribute('role')
    ].join(' '));
  }

  function elementText(el, limit = 500) {
    return textValue(el?.innerText || el?.textContent || '').slice(0, limit);
  }

  function matches(el, selector) {
    return typeof el?.matches === 'function' && el.matches(selector);
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
    const safeFallback = notificationPositions.has(fallback) ? fallback : 'top-right';
    return notificationPositions.has(position) ? position : safeFallback;
  }

  function normalizeFocusOutlineColor(color, fallback = 'gold') {
    return focusOutlineColors.has(color) ? color : fallback;
  }

  function classifyLink(href, base = 'https://example.test/') {
    const normalizedHref = typeof href === 'string' ? href.trim() : '';
    if (!normalizedHref || normalizedHref === '#') return { status: 'broken', reason: 'missing destination' };
    if (externalHandlerSchemes.test(normalizedHref)) return { status: 'unknown', reason: 'external handler link' };
    if (badSchemes.test(normalizedHref)) return { status: 'broken', reason: 'unsupported link scheme' };
    try {
      const baseUrl = new URL(base);
      const url = new URL(normalizedHref, baseUrl);
      if (externalHandlerSchemes.test(url.protocol)) return { status: 'unknown', reason: 'external handler link' };
      const pageDocument = typeof document !== 'undefined' ? document : null;
      if (url.hash && url.origin === baseUrl.origin && url.pathname === baseUrl.pathname && pageDocument && !pageDocument.getElementById(decodeURIComponent(url.hash.slice(1)))) return { status: 'broken', reason: 'missing in-page target' };
      return { status: 'unknown', reason: 'needs a network check' };
    } catch {
      return { status: 'broken', reason: 'invalid URL' };
    }
  }

  function scoreDownload(label, href = '', attrs = {}) {
    const text = `${textValue(label)} ${typeof href === 'string' ? href : ''} ${Object.values(attrs || {}).join(' ')}`;
    let score = 0; const reasons = [];
    if (attrs && attrs.download !== undefined) { score += 5; reasons.push('download attribute'); }
    if (downloadWords.test(text)) { score += 3; reasons.push('action wording'); }
    if (/\.(pdf|zip|csv|xlsx?|docx?|png|jpe?g)(?:$|[?#])/i.test(typeof href === 'string' ? href : '')) { score += 3; reasons.push('file extension'); }
    return { score, likely: score >= 4, reasons };
  }

  function hasProtectedFormControl(el) {
    return Boolean(typeof el?.querySelector === 'function' && el.querySelector('input[type="password"],input[autocomplete*="password" i],input[autocomplete*="cc-" i],input[name*="card" i],input[name*="payment" i],input[name*="security" i],textarea[name*="security" i]'));
  }

  function isProtectedElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const controlSelector = 'a,button,input,textarea,select,[role="button"],[role="link"]';
    let current = el;
    while (current && current.nodeType === 1) {
      const attributes = elementAttributeText(current);
      if (isProtectedOverlayText(attributes)) return true;

      const isControl = current === el && matches(current, controlSelector);
      if (isControl && isProtectedOverlayText(elementText(current, 180))) return true;

      const isDialog = matches(current, 'dialog,[role="dialog"],[aria-modal="true"]');
      if (isDialog && isProtectedOverlayText(`${attributes} ${elementText(current)}`)) return true;
      if (matches(current, 'form') && hasProtectedFormControl(current)) return true;

      current = current.parentElement;
    }
    return false;
  }

  function isLikelyOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isProtectedElement(el)) return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : (el.style || {});
    const text = elementText(el);
    const attributes = elementAttributeText(el);
    const hasDialogSemantics = matches(el, 'dialog,[role="dialog"],[aria-modal="true"]');
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { width: 0 };
    const isFixedOverlay = style.position === 'fixed' && Number(style.zIndex || 0) > 10 && rect.width > 240;
    if ((!hasDialogSemantics && !isFixedOverlay) || isProtectedOverlayText(`${text} ${attributes}`)) return false;
    if (hasProtectedFormControl(el) || (typeof el.querySelector === 'function' && el.querySelector('form,input,textarea,select'))) return false;
    return isAdFocusedOverlayText(`${text} ${attributes}`);
  }

  function diagnostics() {
    let entries = [];
    try {
      entries = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('resource') : [];
    } catch {
      entries = [];
    }
    const slow = entries.filter(e => e.duration > 3000).length;
    return {
      readyState: typeof document !== 'undefined' ? document.readyState : 'unknown',
      resources: entries.length,
      slowResources: slow,
      failedResources: entries.filter(e => e.transferSize === 0 && e.duration > 0).length,
      observedAt: new Date().toISOString()
    };
  }

  root.SuperSurfAnalyzers = {
    classifyLink,
    scoreDownload,
    isLikelyOverlay,
    isProtectedElement,
    isProtectedOverlayText,
    isAdFocusedOverlayText,
    isSafeDismissLabel,
    normalizeNotificationPosition,
    normalizeFocusOutlineColor,
    diagnostics
  };
  if (typeof module !== 'undefined') module.exports = root.SuperSurfAnalyzers;
})(typeof globalThis !== 'undefined' ? globalThis : window);

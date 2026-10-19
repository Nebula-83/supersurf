import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const analyzerSource = await readFile('src/shared/analyzers.js', 'utf8');
const analyzerContext = { globalThis: {}, URL, console };
vm.runInNewContext(analyzerSource, analyzerContext);
const A = analyzerContext.globalThis.SuperSurfAnalyzers;

test('manifest is a Chrome MV3 extension with local entry points', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'SuperSurf');
  assert.equal(manifest.version, '1.3.0');
  assert.equal(manifest.background.service_worker, 'src/background/service-worker.js');
  assert.ok(manifest.content_scripts[0].js.includes('src/shared/analyzers.js'));
  assert.ok(!manifest.permissions.includes('contextMenus'));
  assert.ok(!manifest.content_scripts.some(script => script.js.some(file => /^https?:/.test(file))));
});

test('classifies only obvious local link failures', () => {
  assert.equal(A.classifyLink('', 'https://example.test/').status, 'broken');
  assert.equal(A.classifyLink('javascript:alert(1)', 'https://example.test/').status, 'broken');
  assert.equal(A.classifyLink('data:text/plain,hello', 'https://example.test/').status, 'broken');
  assert.notEqual(A.classifyLink('mailto:person@example.test', 'https://example.test/').status, 'broken');
  assert.notEqual(A.classifyLink('tel:+15551234567', 'https://example.test/').status, 'broken');
  assert.equal(A.classifyLink('/article', 'https://example.test/').status, 'unknown');
});

test('scores download controls from explainable signals without taking action', () => {
  assert.equal(A.scoreDownload('Download report', '/report.pdf').likely, true);
  assert.equal(A.scoreDownload('Read more', '/article').likely, false);
  assert.equal(A.scoreDownload('Open file', '/report.pdf').likely, true);
  assert.match(A.scoreDownload('Export', '/x').reasons.join(','), /action wording/);
});

test('overlay helpers only allow ad-focused, non-sensitive dismissal', () => {
  assert.equal(A.isAdFocusedOverlayText('Sponsored offer — close ad'), true);
  assert.equal(A.isAdFocusedOverlayText('Cookie consent — accept all'), false);
  assert.equal(A.isAdFocusedOverlayText('Security warning — close'), false);
  assert.equal(A.isSafeDismissLabel('Close'), true);
  assert.equal(A.isSafeDismissLabel('Accept all'), false);
  assert.equal(A.isProtectedOverlayText('Log in to continue'), true);
  assert.equal(A.isProtectedOverlayText('Payment security check'), true);
  const passwordControl = {
    nodeType: 1,
    parentElement: null,
    innerText: '',
    textContent: '',
    id: '',
    className: '',
    getAttribute: name => name === 'type' ? 'password' : '',
    matches: selector => selector.includes('input')
  };
  assert.equal(A.isProtectedElement(passwordControl), true);
});

test('notification and focus settings normalize to safe local choices', () => {
  assert.equal(A.normalizeNotificationPosition('top-left'), 'top-left');
  assert.equal(A.normalizeNotificationPosition('top-right'), 'top-right');
  assert.equal(A.normalizeNotificationPosition('bottom-right'), 'top-right');
  assert.equal(A.normalizeNotificationPosition('center'), 'top-right');
  assert.equal(A.normalizeFocusOutlineColor('green'), 'green');
  assert.equal(A.normalizeFocusOutlineColor('purple'), 'gold');
});

test('diagnostics are conservative and local', () => {
  const isolated = vm.runInNewContext(`(${A.diagnostics.toString()})()`, {
    document: { readyState: 'complete' },
    performance: { getEntriesByType: () => [{ duration: 4000, transferSize: 0 }, { duration: 20, transferSize: 100 }] },
    Date
  });
  assert.deepEqual({ slowResources: isolated.slowResources, failedResources: isolated.failedResources }, { slowResources: 1, failedResources: 1 });
});

test('the reduced contract uses local storage and automatic selection search', async () => {
  const content = await readFile('src/content/content-script.js', 'utf8');
  const background = await readFile('src/background/service-worker.js', 'utf8');
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  assert.match(content, /chrome\.storage\.local\.get/);
  assert.doesNotMatch(content, /chrome\.storage\.(?:sync|session)/);
  assert.match(background, /chrome\.storage\.local/);
  assert.doesNotMatch(background, /chrome\.storage\.(?:sync|session)/);
  assert.doesNotMatch(background, /contextMenus/);
  assert.match(content, /document\.addEventListener\('mouseup'/);
  assert.match(content, /window\.getSelection/);
  assert.match(content, /send\('selection-search'/);
  assert.match(background, /chrome\.windows\?\.create/);
  assert.match(background, /type: 'popup'/);
  assert.match(background, /left: 0/);
  assert.match(background, /top: 0/);
  assert.match(background, /https:\/\/www\.google\.com\/search\?q=/);
  assert.ok(!manifest.permissions.includes('contextMenus'));
});

test('scans are debounced, skip unchanged pages, and protect sensitive controls', async () => {
  const content = await readFile('src/content/content-script.js', 'utf8');
  assert.match(content, /scanDebounceMs/);
  assert.match(content, /lastScanSignature/);
  assert.match(content, /A\.isProtectedElement\(el\)/);
  assert.match(content, /button\.hasAttribute\('download'\)/);
  assert.match(content, /likelyDownload/);
   assert.match(content, /onlySuperSurfClassChange/);
  assert.match(content, /attributeFilter/);
  assert.doesNotMatch(content, /innerHTML|insertAdjacentHTML/);
});

test('markers and notices stay visual, reversible, and positioned by contract', async () => {
  const content = await readFile('src/content/content-script.js', 'utf8');
  const css = await readFile('src/content/content.css', 'utf8');
   assert.match(css, /\.ss-broken-link/);
  assert.match(css, /#f6c453/);
   assert.match(css, /\.ss-download-link/);
  assert.match(css, /#52b788/);
  assert.doesNotMatch(css, /content\s*:/);
   assert.doesNotMatch(content, /selection-answer|context-menu/);
   assert.match(content, /root\.classList\.toggle\('ss-focus-mode'/);
   assert.match(content, /delete root\.dataset\.ssFocusColor/);
   assert.match(css, /data-ss-position="top-right"/);
   assert.match(css, /data-ss-position="top-left"/);
});

test('home and settings expose automatic selection search as a safe toggle', async () => {
  const popup = await readFile('src/popup/popup.html', 'utf8');
  const options = await readFile('src/options/options.html', 'utf8');
  const popupScript = await readFile('src/popup/popup.js', 'utf8');
  assert.match(popup, /id="selectionSearch"/);
  assert.match(options, /id="selectionSearch"/);
  assert.match(popupScript, /selectionSearch: true/);
  assert.match(popupScript, /'selectionSearch'/);
});

test('analyzer exports contain only the focused local tools', () => {
  assert.deepEqual(Object.keys(A).sort(), [
    'classifyLink',
    'diagnostics',
    'isAdFocusedOverlayText',
    'isLikelyOverlay',
    'isProtectedElement',
    'isProtectedOverlayText',
    'isSafeDismissLabel',
    'normalizeFocusOutlineColor',
    'normalizeNotificationPosition',
    'scoreDownload'
  ]);
});

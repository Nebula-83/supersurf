import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/shared/analyzers.js', 'utf8');
const context = { globalThis: {}, URL, console };
vm.runInNewContext(source, context);
const A = context.globalThis.ClearViewAnalyzers;

test('manifest is a Chrome MV3 extension with local entry points', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'src/background/service-worker.js');
  assert.ok(manifest.content_scripts[0].js.includes('src/shared/analyzers.js'));
  assert.ok(!manifest.content_scripts.some(script => script.js.some(file => /^https?:/.test(file))));
});

test('classifies unsafe or missing links without network access', () => {
  assert.deepEqual(A.classifyLink('', 'https://example.test/').status, 'broken');
  assert.deepEqual(A.classifyLink('javascript:alert(1)', 'https://example.test/').status, 'broken');
  assert.equal(A.classifyLink('/article', 'https://example.test/').status, 'unknown');
});

test('scores download controls from explainable signals', () => {
  assert.equal(A.scoreDownload('Download report', '/report.pdf').likely, true);
  assert.equal(A.scoreDownload('Read more', '/article').likely, false);
  assert.match(A.scoreDownload('Export', '/x').reasons.join(','), /action wording/);
});

test('overlay helpers only allow ad-focused, non-sensitive dismissal', () => {
  assert.equal(A.isAdFocusedOverlayText('Sponsored offer — close ad'), true);
  assert.equal(A.isAdFocusedOverlayText('Cookie consent — accept all'), false);
  assert.equal(A.isAdFocusedOverlayText('Security warning — close'), false);
  assert.equal(A.isSafeDismissLabel('Close'), true);
  assert.equal(A.isSafeDismissLabel('Accept all'), false);
  assert.equal(A.isProtectedOverlayText('Log in to continue'), true);
});

test('notification and focus settings normalize to safe local choices', () => {
  assert.equal(A.normalizeNotificationPosition('top-left'), 'top-left');
  assert.equal(A.normalizeNotificationPosition('center'), 'top-right');
  assert.equal(A.normalizeFocusOutlineColor('green'), 'green');
  assert.equal(A.normalizeFocusOutlineColor('purple'), 'gold');
});

test('page risk analysis is heuristic and does not expose page content', () => {
  const suspicious = A.analyzePageRisk('https://secure-paypal-login.example.test/verify.exe');
  assert.equal(suspicious.flagged, true);
  assert.equal(suspicious.heuristic, true);
  assert.ok(suspicious.signals.includes('brand and account terms in hostname'));
  assert.equal(A.analyzePageRisk('https://docs.example.test/article').flagged, false);
  assert.equal(Object.prototype.hasOwnProperty.call(suspicious, 'url'), false);
});

test('diagnostics are conservative and local', () => {
  const isolated = vm.runInNewContext(`(${A.diagnostics.toString()})()`, { document: { readyState: 'complete' }, performance: { getEntriesByType: () => [{ duration: 4000, transferSize: 0 }, { duration: 20, transferSize: 100 }] }, Date });
  assert.deepEqual({ slowResources: isolated.slowResources, failedResources: isolated.failedResources }, { slowResources: 1, failedResources: 1 });
});

test('settings are read and written in local storage, with one selection menu', async () => {
  const content = await readFile('src/content/content-script.js', 'utf8');
  const background = await readFile('src/background/service-worker.js', 'utf8');
  assert.match(content, /chrome\.storage\.local\.get/);
  assert.doesNotMatch(content, /chrome\.storage\.sync/);
  assert.match(background, /chrome\.storage\.local/);
  assert.doesNotMatch(background, /chrome\.storage\.sync/);
  assert.equal((background.match(/contextMenus\.create/g) || []).length, 1);
  assert.match(background, /contexts: \['selection'\]/);
});

test('risk alerts are opt-out and dismissible without changing page data', async () => {
  const content = await readFile('src/content/content-script.js', 'utf8');
  assert.match(content, /riskAlerts: true/);
  assert.match(content, /if \(!settings\.riskAlerts\)/);
  assert.match(content, /data-cv-notice-kind="risk"/);
  assert.match(content, /close\.onclick = \(\) => box\.remove\(\)/);
});

test('home and settings pages keep the release controls wired', async () => {
  const popup = await readFile('src/popup/popup.html', 'utf8');
  const options = await readFile('src/options/options.html', 'utf8');
  const popupScript = await readFile('src/popup/popup.js', 'utf8');
  for (const id of ['popups', 'links', 'downloads', 'focus', 'riskAlerts', 'diagnostics', 'options']) assert.match(popup, new RegExp(`id="${id}"`));
  for (const id of ['notification-top-right', 'notification-top-left', 'focus-color-gold', 'focus-color-blue', 'focus-color-green', 'removeClearView']) assert.match(options, new RegExp(`id="${id}"`));
  assert.match(popupScript, /chrome:\/\/extensions/);
});

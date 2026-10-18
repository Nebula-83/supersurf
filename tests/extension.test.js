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

test('diagnostics are conservative and local', () => {
  const isolated = vm.runInNewContext(`(${A.diagnostics.toString()})()`, { document: { readyState: 'complete' }, performance: { getEntriesByType: () => [{ duration: 4000, transferSize: 0 }, { duration: 20, transferSize: 100 }] }, Date });
  assert.deepEqual({ slowResources: isolated.slowResources, failedResources: isolated.failedResources }, { slowResources: 1, failedResources: 1 });
});

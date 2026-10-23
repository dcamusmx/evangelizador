import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function run(file, items) {
  const code = readFileSync(new URL(file, import.meta.url), 'utf8');
  const result = runInNewContext(`(function () { ${code}\n})()`, { $input: { all: () => items } });
  return JSON.parse(JSON.stringify(result));
}
const publish = items => run('publication-input.code.js', items);
const monthly = items => run('monthly-input.code.js', items);
test('publication allowlist discards headers, nested extras, binary and query', () => {
  const item = { json: { headers: { 'x-n8n-api-key': 'fictional-not-a-secret' }, query: { unwanted: true },
    body: { fecha: '2026-10-22', headers: { unwanted: true }, arbitrary: true } }, binary: { unwanted: true } };
  assert.deepEqual(publish([item]), [{ json: { body: { fecha: '2026-10-22' } } }]);
  assert.equal(item.json.headers['x-n8n-api-key'], 'fictional-not-a-secret'); // upstream remains intact!
});
test('publication rejects absent, impossible, inherited or nonstring date', () => {
  for (const body of [{}, { fecha: '2026-02-30' }, { fecha: 20261022 }, Object.create({ fecha: '2026-10-22' })]) {
    assert.throws(() => publish([{ json: { body } }]), /Invalid publication input/);
  }
});
test('publication rejects multiple or no items rather than propagating extras', () => {
  assert.throws(() => publish([]));
  assert.throws(() => publish([{ json: {} }, { json: {} }]));
});
test('monthly allowlist retains only validated application contract', () => {
  assert.deepEqual(monthly([{ json: { headers: { unwanted: true }, body: {
    mes: 2, anio: 2028, inicio: '2028-02-01', fin: '2028-02-29', extra: true,
  } } }]), [{ json: { mes: 2, anio: 2028, inicio: '2028-02-01', fin: '2028-02-29' } }]);
});
test('monthly rejects invalid month types and mismatched boundaries', () => {
  const body = { mes: 2, anio: 2026, inicio: '2026-02-01', fin: '2026-02-28' };
  for (const changes of [{ mes: '2' }, { mes: 13 }, { mes: 1.5 }, { anio: 1999 }, { fin: '2026-02-29' }]) {
    assert.throws(() => monthly([{ json: { body: { ...body, ...changes } } }]), /Invalid monthly input/);
  }
});

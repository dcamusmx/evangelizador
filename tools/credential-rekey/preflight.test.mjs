import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sessionConfig, verifyTLS } from './preflight.mjs';

const valid = () => ({ target: 'grjxcsngfnxdkkdkkujh', readOnlyInspectionAuthorized: true, sessionPoolerConfirmed: true,
  connection: { mode: 'session', host: 'aws-0-us-west-2.pooler.supabase.com', port: 5432,
    user: 'postgres.grjxcsngfnxdkkdkkujh', database: 'postgres', password: 'FICTIONAL_PREFLIGHT_ONLY' } });
test('Session pooler config requires exact project, explicit mode/port and verified TLS', () => {
  const config = sessionConfig(valid());
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.minVersion, 'TLSv1.2');
  for (const patch of [{ mode: 'transaction' }, { port: 6543 }, { host: 'db.grjxcsngfnxdkkdkkujh.supabase.co' },
    { user: 'postgres.other-project' }, { database: 'other' }, { password: '' }]) {
    const input = valid(); Object.assign(input.connection, patch);
    assert.throws(() => sessionConfig(input));
  }
  assert.throws(() => sessionConfig({ ...valid(), sessionPoolerConfirmed: false }));
  assert.throws(() => sessionConfig({ ...valid(), readOnlyInspectionAuthorized: false }));
  assert.throws(() => sessionConfig({ ...valid(), oldKey: 'NOT_NEEDED' }));
});
test('TLS verification rejects cleartext, untrusted certificates and old protocols', () => {
  const socket = { encrypted: true, authorized: true, getProtocol: () => 'TLSv1.3' };
  assert.equal(verifyTLS({ connection: { stream: socket } }).protocol, 'TLSv1.3');
  for (const patch of [{ encrypted: false }, { authorized: false }, { getProtocol: () => 'TLSv1' }]) {
    assert.throws(() => verifyTLS({ connection: { stream: { ...socket, ...patch } } }));
  }
});
test('preflight CLI rejects invalid authorization without printing supplied password', () => {
  const input = valid(); input.readOnlyInspectionAuthorized = false;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./preflight-cli.mjs', import.meta.url))],
    { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(input.connection.password));
  assert.ok(result.stderr.includes('PREFLIGHT_FAILED'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { decrypt, encrypt, inspectSchema, readProtected, rekey, recover } from './rekey.mjs';

const target = 'grjxcsngfnxdkkdkkujh';
const oldKey = 'fictional-old-key-for-isolated-tests-only';
const newKey = 'fictional-new-key-for-isolated-tests-only';
const backupKey = 'fictional-independent-backup-key-for-tests';
const queryRows = async db => (await db.query('SELECT to_jsonb(c) AS row FROM credenciales c ORDER BY id')).rows.map(r => r.row);
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'rekey-fictional-'));
  const db = new PGlite();
  t.after(async () => { await db.close(); await rm(dir, { recursive: true, force: true }); });
  await db.exec(`CREATE TABLE public.credenciales (
    id uuid PRIMARY KEY, servicio text NOT NULL, nombre text NOT NULL, descripcion text,
    valor_cifrado text NOT NULL, pista text, activo boolean NOT NULL DEFAULT true,
    actualizado_por uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(servicio,nombre));
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $function$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $function$;
    CREATE TRIGGER trg_credenciales_updated_at BEFORE UPDATE ON public.credenciales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ALTER TABLE public.credenciales ENABLE ROW LEVEL SECURITY;`);
  for (let i = 1; i <= 2; i++) {
    await db.query(`INSERT INTO credenciales (id,servicio,nombre,descripcion,valor_cifrado,pista,activo)
      VALUES ($1,'fictional',$2,'fixture',$3,'fictional hint',$4)`, [
      `00000000-0000-0000-0000-00000000000${i}`, `KEY_${i}`, encrypt(Buffer.from(`fictional credential ${i} áé\n`), oldKey), i === 1,
    ]);
  }
  const options = { target, oldKey, newKey, backupKey, approvedSchema: await inspectSchema(db),
    backupFile: join(dir, 'before.rekey-backup'), receiptFile: join(dir, 'receipt.rekey-backup'), maintenanceConfirmed: true };
  return { db, dir, options };
}

test('format interoperates with actual application encrypt/decrypt functions', async () => {
  const require = createRequire(import.meta.url);
  const ts = require('../../node_modules/typescript');
  const source = await readFile(new URL('../../src/lib/credenciales.server.ts', import.meta.url), 'utf8');
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (name === 'node:crypto') return require(name); throw new Error('NO_NETWORK'); }, Buffer, process: { env: { CREDENCIALES_ENC_KEY: oldKey } } });
  const text = 'fictional unicode áé\n';
  assert.equal(decrypt(exports.cifrar(text), oldKey).toString(), text);
  assert.equal(exports.descifrar(encrypt(Buffer.from(text), oldKey)), text);
});
test('exact key text retained; malformed and tampered ciphertext rejected', () => {
  const value = encrypt(Buffer.from('fictional'), ` ${oldKey} `);
  assert.equal(decrypt(value, ` ${oldKey} `).toString(), 'fictional');
  assert.throws(() => decrypt(value, oldKey));
  assert.throws(() => decrypt('not base64!', oldKey));
  const bytes = Buffer.from(value, 'base64'); bytes[20] ^= 1;
  assert.throws(() => decrypt(bytes.toString('base64'), ` ${oldKey} `));
});
test('simulation decrypts inactive rows, creates independent encrypted backup, rolls back', async t => {
  const { db, options } = await fixture(t);
  const before = await queryRows(db);
  assert.deepEqual(await rekey(db, options), { mode: 'simulate', rows: 2, committed: false });
  assert.deepEqual(await queryRows(db), before);
  const backup = await readProtected(options.backupFile, backupKey);
  assert.deepEqual(backup.before, before);
  const disk = await readFile(options.backupFile, 'utf8');
  assert.ok(!disk.includes('fictional credential'));
  assert.ok(!disk.includes(before[0].valor_cifrado));
  await assert.rejects(readProtected(options.backupFile, oldKey));
});
test('apply verifies all rows and recovery restores ciphertext/metadata without disabling trigger', async t => {
  const { db, dir, options } = await fixture(t);
  const before = await queryRows(db);
  const result = await rekey(db, { ...options, mode: 'apply' });
  assert.equal(result.committed, true);
  const after = await queryRows(db);
  for (let i = 0; i < after.length; i++) {
    assert.equal(decrypt(after[i].valor_cifrado, newKey).toString(), decrypt(before[i].valor_cifrado, oldKey).toString());
    assert.throws(() => decrypt(after[i].valor_cifrado, oldKey));
    assert.equal(after[i].activo, before[i].activo);
  }
  await recover(db, { ...options, backupFile: join(dir, 'pre-recovery.rekey-backup') });
  const restored = await queryRows(db);
  for (let i = 0; i < restored.length; i++) {
    assert.deepEqual({ ...restored[i], updated_at: null }, { ...before[i], updated_at: null });
  }
  await assert.rejects(recover(db, { ...options, backupFile: join(dir, 'again.rekey-backup') }), /RECOVERY_WOULD_LOSE_CHANGES/);
});
test('corrupt last row aborts before first update or backup', async t => {
  const { db, options } = await fixture(t);
  await db.exec("UPDATE credenciales SET valor_cifrado='broken' WHERE nombre='KEY_2'");
  const before = await queryRows(db);
  await assert.rejects(rekey(db, { ...options, mode: 'apply' }));
  assert.deepEqual(await queryRows(db), before);
  await assert.rejects(readFile(options.backupFile));
});
test('failure on second update rolls back first update and timestamps', async t => {
  const { db, options } = await fixture(t);
  const before = await queryRows(db); let writes = 0;
  const wrapper = { query(sql, params) { if (sql.startsWith('UPDATE') && ++writes === 2) throw new Error('INJECTED'); return db.query(sql, params); } };
  await assert.rejects(rekey(wrapper, { ...options, mode: 'apply' }), /INJECTED/);
  assert.deepEqual(await queryRows(db), before);
});
test('existing backup never overwritten and no updates occur', async t => {
  const { db, options } = await fixture(t);
  const before = await queryRows(db);
  await writeFile(options.backupFile, 'fictional-existing-file');
  await assert.rejects(rekey(db, { ...options, mode: 'apply' }));
  assert.deepEqual(await queryRows(db), before);
  assert.equal(await readFile(options.backupFile, 'utf8'), 'fictional-existing-file');
});
test('failure persisting receipt rolls back database', async t => {
  const { db, options } = await fixture(t);
  const before = await queryRows(db);
  await writeFile(options.receiptFile, 'already-exists');
  await assert.rejects(rekey(db, { ...options, mode: 'apply' }));
  assert.deepEqual(await queryRows(db), before);
});
test('commit acknowledgement lost: receipt can reconcile and recover committed state', async t => {
  const { db, dir, options } = await fixture(t);
  const wrapper = { async query(sql, params) { const result = await db.query(sql, params); if (sql === 'COMMIT') throw new Error('ACK_LOST'); return result; } };
  await assert.rejects(rekey(wrapper, { ...options, mode: 'apply' }), /ACK_LOST/);
  assert.equal((await recover(db, { ...options, backupFile: join(dir, 'recover.rekey-backup') })).committed, true);
});
test('recovery refuses to overwrite subsequent editorial or credential changes', async t => {
  const { db, dir, options } = await fixture(t);
  await rekey(db, { ...options, mode: 'apply' });
  await db.exec("UPDATE credenciales SET descripcion='legitimate later edit' WHERE nombre='KEY_1'");
  const current = await queryRows(db);
  await assert.rejects(recover(db, { ...options, backupFile: join(dir, 'recover.rekey-backup') }), /RECOVERY_WOULD_LOSE_CHANGES/);
  assert.deepEqual(await queryRows(db), current);
});
test('unapproved schema, unsafe trigger and rowset changes fail closed', async t => {
  const { db, options } = await fixture(t);
  await assert.rejects(rekey(db, { ...options, approvedSchema: null }), /SCHEMA_REVIEW_REQUIRED/);
  await db.exec('ALTER TABLE credenciales ADD COLUMN unexpected text');
  await assert.rejects(rekey(db, options), /SCHEMA_REVIEW_REQUIRED/);
  await assert.rejects(rekey(db, { ...options, approvedSchema: await inspectSchema(db) }), /UNSUPPORTED_SCHEMA/);
});
test('trigger with extra side effects rejected even when approved schema supplied', async t => {
  const { db, options } = await fixture(t);
  await db.exec(`CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $function$
    BEGIN NEW.updated_at = now(); RETURN NEW; RAISE NOTICE 'unexpected'; END;
    $function$;`);
  await assert.rejects(rekey(db, { ...options, approvedSchema: await inspectSchema(db) }), /UNSUPPORTED_TRIGGER/);
});
test('keys must be nonempty, distinct and new material sufficiently long', async () => {
  const db = { query() { throw new Error('DB_MUST_NOT_BE_TOUCHED'); } };
  for (const keys of [{ oldKey: '' }, { newKey: oldKey }, { backupKey: newKey }, { newKey: 'short' }]) {
    await assert.rejects(rekey(db, { oldKey, newKey, backupKey, ...keys }), /KEY/);
  }
});
test('apply requires maintenance and lock precedes schema/data access', async t => {
  const { db, options } = await fixture(t); const statements = [];
  const wrapper = { query(sql, params) { statements.push(sql); return db.query(sql, params); } };
  await assert.rejects(rekey(wrapper, { ...options, mode: 'apply', maintenanceConfirmed: false }), /MAINTENANCE/);
  assert.equal(statements[0], 'BEGIN');
  assert.ok(statements.indexOf('LOCK TABLE public.credenciales IN EXCLUSIVE MODE') < statements.findIndex(s => s.includes('jsonb_build_object')));
  assert.ok(!statements.some(s => s.startsWith('UPDATE')));
  assert.ok(statements.includes("SET LOCAL lock_timeout = '5s'"));
});
test('backup authentication rejects modified receipt before SQL operations', async t => {
  const { db, options } = await fixture(t);
  await rekey(db, { ...options, mode: 'apply' });
  const envelope = JSON.parse(await readFile(options.receiptFile, 'utf8'));
  const bytes = Buffer.from(envelope.data, 'base64'); bytes[30] ^= 1;
  envelope.data = bytes.toString('base64');
  await writeFile(options.receiptFile, JSON.stringify(envelope));
  const noDB = { query() { throw new Error('DB_MUST_NOT_BE_TOUCHED'); } };
  await assert.rejects(recover(noDB, options), error => !error.message.includes('DB_MUST_NOT_BE_TOUCHED'));
});
test('CLI rejects missing authorization, other project and secret arguments without disclosure', () => {
  const cli = new URL('./cli.mjs', import.meta.url);
  for (const input of [
    { target, oldKey: 'FAKE_SENSITIVE_SENTINEL', connection: {} },
    { target: 'wrong-project', operatorAuthorized: true, oldKey: 'FAKE_SENSITIVE_SENTINEL' },
  ]) {
    const result = spawnSync(process.execPath, [cli.pathname.replace(/^\/([A-Za-z]:)/, '$1')], { input: JSON.stringify(input), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('FAKE_SENSITIVE_SENTINEL'));
    assert.ok(result.stderr.includes('REKEY_FAILED'));
  }
  const result = spawnSync(process.execPath, [cli.pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'simulate', 'FAKE_SENSITIVE_SENTINEL'], { input: '{}', encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.ok(!result.stderr.includes('FAKE_SENSITIVE_SENTINEL'));
});

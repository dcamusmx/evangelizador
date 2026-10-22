// Native PostgreSQL only, fresh disposable loopback cluster; never reads .env/PGHOST/PGDATABASE.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import pg from 'pg';
import { decrypt, encrypt, inspectSchema, readProtected, rekey, recover } from './rekey.mjs';
import { inspectReadOnly } from './preflight.mjs';

const run = promisify(execFile);
const target = 'grjxcsngfnxdkkdkkujh';
const oldKey = 'fictional-old-key-only-native-postgres-test';
const newKey = 'fictional-new-key-only-native-postgres-test';
const backupKey = 'fictional-independent-backup-native-test';
const binaryDir = process.env.REKEY_TEST_PG_BIN;
const executable = name => join(binaryDir, name + (process.platform === 'win32' ? '.exe' : ''));
let root, data, port, running = false;
const schemaSQL = `CREATE TABLE public.credenciales (
  id uuid PRIMARY KEY, servicio text NOT NULL, nombre text NOT NULL, descripcion text,
  valor_cifrado text NOT NULL, pista text, activo boolean NOT NULL DEFAULT true,
  actualizado_por uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(servicio,nombre));
  CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $function$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $function$;
  CREATE TRIGGER trg_credenciales_updated_at BEFORE UPDATE ON public.credenciales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  ALTER TABLE public.credenciales ENABLE ROW LEVEL SECURITY;`;

before(async () => {
  if (!binaryDir || !isAbsolute(binaryDir)) throw new Error('REKEY_TEST_PG_BIN must identify local PostgreSQL binaries');
  root = await mkdtemp(join(tmpdir(), 'evangelizador-native-rekey-'));
  data = join(root, 'data');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  await run(executable('initdb'), ['-D', data, '--username=postgres', '--auth=trust', '--no-locale', '--encoding=UTF8'], { windowsHide: true, timeout: 30000 });
  try {
    await run(executable('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', '-t', '20', '-o',
      `-h 127.0.0.1 -p ${port} -F -c log_statement=none -c log_min_error_statement=panic`, 'start'], { windowsHide: true, timeout: 30000 });
  } catch {
    const log = await readFile(join(root, 'postgres.log'), 'utf8').catch(() => 'No local startup log');
    throw new Error(`Disposable fixture startup failed: ${log}`);
  }
  running = true;
});
after(async () => {
  if (running) {
    await run(executable('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', '-t', '20', 'stop'], { windowsHide: true, timeout: 30000 });
    running = false;
  }
  if (root) {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel.startsWith('..') || isAbsolute(rel) || !rel.startsWith('evangelizador-native-rekey-')) throw new Error('Unsafe cleanup target');
    await rm(root, { recursive: true, force: true });
  }
});

async function connect(database = 'postgres') {
  const db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: '', database, ssl: false,
    connectionTimeoutMillis: 5000, application_name: 'fictional-rekey-test' });
  await db.connect();
  return db;
}
async function fixture(t) {
  const a = await connect(), b = await connect();
  t.after(async () => { await b.end(); await a.end(); });
  await a.query('DROP TABLE IF EXISTS credenciales CASCADE; DROP FUNCTION IF EXISTS set_updated_at() CASCADE');
  await a.query(schemaSQL);
  for (let i = 1; i <= 2; i++) await a.query(`INSERT INTO credenciales(id,servicio,nombre,valor_cifrado,activo)
    VALUES($1,'fictional',$2,$3,$4)`, [`00000000-0000-0000-0000-00000000000${i}`, `KEY_${i}`,
    encrypt(Buffer.from(`fictional credential ${i} áé`), oldKey), i === 1]);
  const pidA = (await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const pidB = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.notEqual(pidA, pidB);
  const options = { target, oldKey, newKey, backupKey, approvedSchema: await inspectSchema(a), mode: 'apply', maintenanceConfirmed: true,
    backupFile: join(root, `${pidA}-before.rekey-backup`), receiptFile: join(root, `${pidA}-receipt.rekey-backup`) };
  return { a, b, pidA, pidB, options };
}
const getRows = async db => (await db.query('SELECT to_jsonb(c) AS row FROM credenciales c ORDER BY id')).rows.map(r => r.row);
function gate() {
  let release, entered;
  const wait = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  return { release, entered, wait, reached };
}
async function assertBlocked(a, pidB, pidA) {
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    const result = await a.query("SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1", [pidB]);
    if (result.rows[0]?.wait_event_type === 'Lock' && result.rows[0].blockers.includes(pidA)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Independent session did not wait for table lock');
}

test('catalog capture is read-only and does not select credential rows', async t => {
  const { a } = await fixture(t);
  const sql = await readFile(new URL('./capture-schema.sql', import.meta.url), 'utf8');
  const before = await getRows(a);
  const results = await a.query(sql);
  assert.ok(results.filter(r => r.command === 'SELECT').length >= 10);
  assert.deepEqual(await getRows(a), before);
  const version = (await a.query('SHOW server_version')).rows[0].server_version;
  console.log(`Native PostgreSQL version: ${version}; catalog capture passed (fixture only).`);
});

test('two independent sessions: EXCLUSIVE lock blocks INSERT/UPDATE/DELETE, allows SELECT', async t => {
  const { a, b, options } = await fixture(t);
  const hold = gate();
  const wrapper = { async query(sql, params) { const result = await a.query(sql, params); if (sql.startsWith('LOCK TABLE')) { hold.entered(); await hold.wait; } return result; } };
  const operation = rekey(wrapper, options);
  await hold.reached;
  try {
    await b.query("SET lock_timeout='200ms'; SET statement_timeout='3s'");
    assert.equal((await b.query('SELECT count(*)::int AS n FROM credenciales')).rows[0].n, 2);
    for (const sql of [
      "INSERT INTO credenciales(id,servicio,nombre,valor_cifrado) VALUES('00000000-0000-0000-0000-000000000003','fictional','KEY_3','fictional-invalid')",
      "UPDATE credenciales SET descripcion='concurrent' WHERE nombre='KEY_1'",
      "DELETE FROM credenciales WHERE nombre='KEY_1'",
    ]) await assert.rejects(b.query(sql), error => error.code === '55P03');
  } finally { hold.release(); }
  assert.equal((await operation).committed, true);
  assert.equal((await getRows(b)).length, 2);
});

test('waiting writer proceeds after rollback; failed second update leaves no partial rekey', async t => {
  const { a, b, pidA, pidB, options } = await fixture(t);
  const before = await getRows(a), hold = gate(); let writes = 0;
  const wrapper = { async query(sql, params) {
    if (sql.startsWith('UPDATE') && ++writes === 2) { hold.entered(); await hold.wait; throw new Error('FICTIONAL_FAILURE'); }
    return a.query(sql, params);
  } };
  const operation = rekey(wrapper, options);
  const rejected = assert.rejects(operation, /FICTIONAL_FAILURE/);
  await hold.reached;
  await b.query("SET lock_timeout='5s'");
  const write = b.query("UPDATE credenciales SET descripcion='legitimate edit after rollback' WHERE nombre='KEY_1'");
  const writeResult = write.then(result => result, error => { throw new Error(`Local concurrent write failed: ${error.code}`); });
  try { await assertBlocked(a, pidB, pidA); } finally { hold.release(); }
  await rejected; await writeResult;
  const after = await getRows(a);
  assert.deepEqual(after.map(r => r.valor_cifrado), before.map(r => r.valor_cifrado));
  assert.equal(after[0].descripcion, 'legitimate edit after rollback');
  for (const row of after) { const plain = decrypt(row.valor_cifrado, oldKey); plain.fill(0); }
});

test('writer released after COMMIT changes snapshot; recovery refuses to lose that change', async t => {
  const { a, b, pidA, pidB, options } = await fixture(t);
  const hold = gate();
  const wrapper = { async query(sql, params) { if (sql === 'COMMIT') { hold.entered(); await hold.wait; } return a.query(sql, params); } };
  const operation = rekey(wrapper, options);
  await hold.reached;
  const write = b.query("UPDATE credenciales SET descripcion='legitimate edit after commit' WHERE nombre='KEY_1'");
  try { await assertBlocked(a, pidB, pidA); } finally { hold.release(); }
  await operation; await write;
  const current = await getRows(b);
  await assert.rejects(recover(a, { ...options, backupFile: join(root, 'refused-recovery.rekey-backup') }), /RECOVERY_WOULD_LOSE_CHANGES/);
  assert.deepEqual(await getRows(b), current);
});

test('independent backup key restores exact snapshot in clean database; old data key still required', async t => {
  const { a, options } = await fixture(t);
  const before = await getRows(a);
  await rekey(a, options);
  const backup = await readProtected(options.backupFile, backupKey);
  assert.deepEqual(backup.before, before);
  await assert.rejects(readProtected(options.backupFile, oldKey));
  await assert.rejects(readProtected(options.backupFile, newKey));
  const database = `rekey_restore_${Date.now()}`;
  await a.query(`CREATE DATABASE ${database}`);
  const restored = await connect(database);
  try {
    await restored.query(schemaSQL);
    await restored.query('BEGIN');
    for (const row of backup.before) await restored.query(`INSERT INTO credenciales
      SELECT * FROM jsonb_populate_record(NULL::credenciales,$1::jsonb)`, [JSON.stringify(row)]);
    await restored.query('COMMIT');
    const recoveredRows = await getRows(restored);
    assert.deepEqual(recoveredRows, before);
    for (let i = 0; i < before.length; i++) {
      const recovered = decrypt(recoveredRows[i].valor_cifrado, oldKey);
      const original = decrypt(before[i].valor_cifrado, oldKey);
      try { assert.ok(recovered.equals(original)); assert.throws(() => decrypt(recoveredRows[i].valor_cifrado, backupKey)); }
      finally { recovered.fill(0); original.fill(0); }
    }
  } finally { await restored.end(); await a.query(`DROP DATABASE ${database}`); }
  const result = await recover(a, { ...options, backupFile: join(root, 'before-recover.rekey-backup') });
  assert.equal(result.committed, true);
  assert.deepEqual((await getRows(a)).map(r => ({ ...r, updated_at: null })), before.map(r => ({ ...r, updated_at: null })));
});

test('pre-existing writer causes tool lock_timeout before backup or rekey writes', async t => {
  const { a, b, options } = await fixture(t);
  const before = await getRows(a);
  await b.query('BEGIN');
  await b.query("UPDATE credenciales SET descripcion='uncommitted concurrent edit' WHERE nombre='KEY_1'");
  try { await assert.rejects(rekey(a, options), error => error.code === '55P03'); }
  finally { await b.query('ROLLBACK'); }
  assert.deepEqual(await getRows(a), before);
  await assert.rejects(readFile(options.backupFile), error => error.code === 'ENOENT');
});

test('read-only preflight captures permissions/catalogs without credential row access or EXCLUSIVE lock', async t => {
  const { a } = await fixture(t);
  const before = await getRows(a), statements = [];
  const wrapper = { query(sql, params) { statements.push(sql); return a.query(sql, params); } };
  const { report, schema } = await inspectReadOnly(wrapper);
  assert.equal(report.connectionPermissionsSatisfied, true);
  assert.equal(report.rekeyExecuted, false);
  assert.equal(report.context.read_only, 'on');
  assert.equal(report.exclusiveLockAttempted, false);
  assert.ok(report.metadata.length >= 10);
  assert.equal(schema.columns.length, 10);
  assert.ok(!statements.some(sql => /LOCK TABLE|UPDATE public\.|SELECT to_jsonb\(c\)/.test(sql)));
  assert.deepEqual(await getRows(a), before);
  assert.equal(statements.at(-1), 'ROLLBACK');
});

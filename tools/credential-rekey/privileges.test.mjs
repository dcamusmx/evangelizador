// Disposable loopback PostgreSQL only; never uses .env or production connection settings.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import pg from 'pg';

const run = promisify(execFile);
const binaryDir = process.env.REKEY_TEST_PG_BIN;
const executable = name => join(binaryDir, name + (process.platform === 'win32' ? '.exe' : ''));
const sql = async name => readFile(new URL(`../../supabase/proposals/minimum-credential-privileges/${name}.sql`, import.meta.url), 'utf8');
let root, data, port, running = false;
before(async () => {
  if (!binaryDir || !isAbsolute(binaryDir)) throw new Error('REKEY_TEST_PG_BIN must identify local binaries');
  root = await mkdtemp(join(tmpdir(), 'evangelizador-privileges-test-'));
  data = join(root, 'data');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  await run(executable('initdb'), ['-D', data, '--username=postgres', '--auth=trust', '--no-locale', '--encoding=UTF8'], { windowsHide: true, timeout: 30000 });
  await run(executable('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-w', '-t', '20', '-o',
    `-h 127.0.0.1 -p ${port} -F -c log_statement=none -c log_min_error_statement=panic`, 'start'], { windowsHide: true, timeout: 30000 });
  running = true;
});
after(async () => {
  if (running) await run(executable('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', '-t', '20', 'stop'], { windowsHide: true, timeout: 30000 });
  if (root) {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel.startsWith('..') || isAbsolute(rel) || !rel.startsWith('evangelizador-privileges-test-')) throw new Error('Unsafe cleanup target');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture(t) {
  const db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', password: '', ssl: false });
  await db.connect();
  t.after(async () => { await db.query('ROLLBACK'); await db.end(); });
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='inherited_access') THEN CREATE ROLE inherited_access; END IF;
  END $$;
  REVOKE inherited_access, service_role FROM anon;
  DROP TABLE IF EXISTS public.credenciales CASCADE;
  CREATE TABLE public.credenciales(id uuid PRIMARY KEY, servicio text, nombre text, valor_cifrado text);
  ALTER TABLE public.credenciales ENABLE ROW LEVEL SECURITY;
  CREATE POLICY preserved_policy ON public.credenciales FOR SELECT TO authenticated USING(false);
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.credenciales TO postgres,anon,authenticated,service_role;`);
  return db;
}
const acl = async db => (await db.query(`SELECT pg_get_userbyid(x.grantee) AS grantee,
  pg_get_userbyid(x.grantor) AS grantor,x.privilege_type,x.is_grantable
  FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x WHERE c.oid='public.credenciales'::regclass
  ORDER BY grantee,grantor,privilege_type`)).rows;
const state = async db => (await db.query(`SELECT c.relowner,c.relrowsecurity,c.relforcerowsecurity,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public' AND tablename='credenciales') AS policies
  FROM pg_class c WHERE c.oid='public.credenciales'::regclass`)).rows;
async function rejected(db, statement) {
  await assert.rejects(db.query(statement));
  await db.query('ROLLBACK');
}
test('capture is metadata-only; apply preserves backend CRUD, RLS/policies and protected ACLs; recovery restores grantors/options', async t => {
  const db = await fixture(t);
  const original = await acl(db), originalState = await state(db);
  const capture = await sql('capture-before');
  assert.doesNotMatch(capture, /\bFROM\s+public\.credenciales\b/i);
  await db.query(capture);
  await db.query(await sql('apply'));
  await db.query(await sql('verify'));
  assert.deepEqual(await state(db), originalState);
  assert.deepEqual(await acl(db), original.filter(r => ['postgres', 'service_role'].includes(r.grantee)));
  for (const role of ['anon', 'authenticated']) {
    await db.query(`SET ROLE ${role}`);
    await assert.rejects(db.query('SELECT id FROM public.credenciales'), { code: '42501' });
    await db.query('RESET ROLE');
  }
  await db.query(`SET ROLE service_role;
    INSERT INTO public.credenciales VALUES('00000000-0000-0000-0000-000000000001','fictional','TEST','fictional-only');
    UPDATE public.credenciales SET nombre='UPDATED' WHERE nombre='TEST';`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.credenciales')).rows[0].n, 1);
  await db.query('DELETE FROM public.credenciales; RESET ROLE;');
  await db.query(await sql('recover'));
  assert.deepEqual(await acl(db), original);
  assert.deepEqual(await state(db), originalState);
});
test('apply refuses grant-option drift before revoking anything', async t => {
  const db = await fixture(t);
  await db.query('GRANT SELECT ON public.credenciales TO anon WITH GRANT OPTION');
  const before = await acl(db);
  await rejected(db, await sql('apply'));
  assert.deepEqual(await acl(db), before);
});
test('inherited privilege surviving revocation aborts and rolls back the full apply', async t => {
  const db = await fixture(t);
  await db.query('GRANT service_role TO anon;');
  // Direct baseline still matches; inherited SELECT survives REVOKE and aborts the transaction.
  const before = await acl(db);
  await rejected(db, await sql('apply'));
  assert.deepEqual(await acl(db), before);
});
test('recovery refuses later ACL edits, preserving them', async t => {
  const db = await fixture(t);
  await db.query(await sql('apply'));
  await db.query('GRANT SELECT ON public.credenciales TO anon');
  const before = await acl(db);
  await rejected(db, await sql('recover'));
  assert.deepEqual(await acl(db), before);
});
test('unexpected column grants abort apply without removing table grants', async t => {
  const db = await fixture(t);
  await db.query('GRANT SELECT(nombre) ON public.credenciales TO anon');
  const before = await acl(db);
  await rejected(db, await sql('apply'));
  assert.deepEqual(await acl(db), before);
});

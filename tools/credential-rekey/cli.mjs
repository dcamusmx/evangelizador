import { readFile, open } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { inspectSchema, rekey, recover } from './rekey.mjs';

const project = 'grjxcsngfnxdkkdkkujh';
const repo = fileURLToPath(new URL('../../', import.meta.url));
function externalPath(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('PATH');
  const rel = relative(repo, resolve(path));
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error('PATH');
  return path;
}
let client;
try {
  const mode = process.argv[2] ?? 'simulate';
  if (process.argv.length > 3 || !['inspect', 'simulate', 'apply', 'recover'].includes(mode) || process.stdin.isTTY) throw new Error('INPUT');
  let chunks = [], size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 65536) throw new Error('INPUT');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const input = JSON.parse(bytes.toString('utf8'));
  bytes.fill(0); chunks.forEach(chunk => chunk.fill(0)); chunks = [];
  if (input.target !== project || input.operatorAuthorized !== true) throw new Error('TARGET');
  const connection = input.connection;
  if (!connection || connection.database !== 'postgres' || typeof connection.user !== 'string' || !connection.user ||
      !(connection.host === `db.${project}.supabase.co` ||
        (/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(connection.host) && connection.user === `postgres.${project}`)) ||
      typeof connection.password !== 'string' || !connection.password) throw new Error('CONNECTION');
  // A dedicated single session, pinned project, TLS verification; no connection URI or .env loading.
  client = new pg.Client({ host: connection.host, port: connection.port ?? 5432,
    user: connection.user, database: 'postgres', password: connection.password,
    ssl: { rejectUnauthorized: true, ...(connection.ca ? { ca: connection.ca } : {}) },
    connectionTimeoutMillis: 5000, application_name: 'evangelizador-credential-rekey' });
  client.on('error', () => {}); // Never print driver error objects or connection details.
  await client.connect();
  if (mode === 'inspect') {
    const schema = await inspectSchema(client);
    const handle = await open(externalPath(input.schemaFile), 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(schema, null, 2)); await handle.sync(); }
    finally { await handle.close(); }
    console.log(JSON.stringify({ mode, schemaCaptured: true }));
  } else {
    const approvedSchema = JSON.parse(await readFile(externalPath(input.schemaFile), 'utf8'));
    const options = { mode, target: project, approvedSchema,
      oldKey: input.oldKey, newKey: input.newKey, backupKey: input.backupKey,
      backupFile: externalPath(input.backupFile),
      ...(input.receiptFile ? { receiptFile: externalPath(input.receiptFile) } : {}),
      maintenanceConfirmed: input.maintenanceConfirmed };
    const result = mode === 'recover' ? await recover(client, options) : await rekey(client, options);
    console.log(JSON.stringify(result));
  }
} catch {
  console.error('REKEY_FAILED: no sensitive diagnostics emitted. Keep maintenance active; verify transaction outcome before retry/recovery.');
  process.exitCode = 1;
} finally {
  if (client) { try { await client.end(); } catch { process.exitCode = 1; } }
}

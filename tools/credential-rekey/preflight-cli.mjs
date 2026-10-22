import { open, realpath } from 'node:fs/promises';
import { dirname, basename, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { sessionConfig, verifyTLS, inspectReadOnly } from './preflight.mjs';

let db;
let phase = 'input';
try {
  if (process.argv.length !== 2 || process.stdin.isTTY) throw new Error('STDIN_REQUIRED');
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length; if (size > 65536) throw new Error('INPUT_LIMIT'); chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const input = JSON.parse(bytes.toString('utf8'));
  bytes.fill(0); chunks.forEach(chunk => chunk.fill(0));
  phase = 'configuration';
  const config = sessionConfig(input);
  const repo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const paths = [];
  for (const path of [input.schemaFile, input.reportFile]) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('OUTPUT_PATH');
    const parent = await realpath(dirname(path));
    const rel = relative(repo, parent);
    if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error('OUTPUT_PATH');
    paths.push(resolve(parent, basename(path)));
  }
  if (paths[0] === paths[1]) throw new Error('OUTPUT_PATH');
  phase = 'connection';
  db = new pg.Client(config);
  db.on('error', () => {});
  await db.connect();
  phase = 'tls';
  const tls = verifyTLS(db);
  phase = 'metadata';
  const { schema, report } = await inspectReadOnly(db);
  report.tlsToSessionPooler = tls;
  report.poolerToDatabaseTransport = 'not verified by client TLS handshake';
  phase = 'output';
  for (const [i, data] of [schema, report].entries()) {
    const file = await open(paths[i], 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(data, null, 2)); await file.sync(); }
    finally { await file.close(); }
  }
  console.log(JSON.stringify({ readOnly: true, tlsVerified: true, connectionPermissionsSatisfied: report.connectionPermissionsSatisfied,
    inspectionCaptured: true, rekeyExecuted: false }));
  if (!report.connectionPermissionsSatisfied) process.exitCode = 2;
} catch (error) {
  const safeCodes = new Set(['28P01', '28000', '3D000', '42501', '42P01', '25006', '57014', '55P03',
    'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']);
  const code = safeCodes.has(error?.code) ? error.code : 'REDACTED';
  console.error(`PREFLIGHT_FAILED: phase=${phase}; code=${code}; no sensitive diagnostics emitted; no rekey performed.`);
  process.exitCode = 1;
} finally { if (db) { try { await db.end(); } catch { process.exitCode = 1; } } }

import { readFile } from 'node:fs/promises';
import { inspectSchema } from './rekey.mjs';

const target = 'grjxcsngfnxdkkdkkujh';
export function sessionConfig(input) {
  const c = input?.connection;
  if (input?.target !== target || input.readOnlyInspectionAuthorized !== true || input.sessionPoolerConfirmed !== true ||
      !c || c.mode !== 'session' || !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(c.host ?? '') ||
      c.user !== `postgres.${target}` || c.database !== 'postgres' || c.port !== 5432 ||
      typeof c.password !== 'string' || !c.password || (c.ca !== undefined && typeof c.ca !== 'string') ||
      input.oldKey !== undefined || input.newKey !== undefined || input.backupKey !== undefined) throw new Error('PREFLIGHT_INPUT');
  return { host: c.host, port: c.port, user: c.user, password: c.password, database: c.database,
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(c.ca ? { ca: c.ca } : {}) },
    connectionTimeoutMillis: 5000, application_name: 'evangelizador-rekey-readonly-preflight' };
}
export function verifyTLS(client) {
  // pg 8.16.3 uses this TLSSocket after SSL negotiation. No certificates/keys are printed.
  const socket = client.connection?.stream;
  const protocol = socket?.getProtocol?.();
  if (socket?.encrypted !== true || socket.authorized !== true || !['TLSv1.2', 'TLSv1.3'].includes(protocol)) throw new Error('TLS_NOT_VERIFIED');
  return { encrypted: true, certificateAuthorized: true, protocol };
}
export async function inspectReadOnly(db) {
  try {
    await db.query('BEGIN TRANSACTION READ ONLY');
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '30s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    const context = await db.query(`SELECT current_database() AS database_name, session_user, current_user,
      pg_backend_pid() AS pid, current_setting('transaction_read_only') AS read_only,
      current_setting('server_version') AS server_version`);
    const permission = await db.query(`SELECT c.relkind, pg_get_userbyid(c.relowner) AS owner,
      c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,
      r.rolsuper,r.rolbypassrls, row_security_active(c.oid) AS rls_applies,
      has_schema_privilege(current_user,'public','USAGE') AS schema_usage,
      has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
      has_table_privilege(current_user,c.oid,'UPDATE') AS can_update
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_roles r ON r.rolname=current_user
      WHERE n.nspname='public' AND c.relname='credenciales'`);
    if (permission.rows.length !== 1) throw new Error('TABLE_REQUIRED');
    const p = permission.rows[0];
    const schema = await inspectSchema(db);
    const captureSQL = (await readFile(new URL('./capture-schema.sql', import.meta.url), 'utf8'))
      .replace(/^BEGIN TRANSACTION READ ONLY;$/m, '').replace(/^ROLLBACK;$/m, '');
    const captureResults = await db.query(captureSQL);
    const end = await db.query('SELECT pg_backend_pid() AS pid');
    const c = context.rows[0];
    if (c.read_only !== 'on' || end.rows[0].pid !== c.pid) throw new Error('SESSION_INCONSISTENT');
    return { schema, report: { context: c, permissions: p,
      connectionPermissionsSatisfied: c.database_name === 'postgres' && p.relkind === 'r' &&
        (p.rolsuper || p.rolbypassrls) && !p.rls_applies && p.schema_usage && p.can_select && p.can_update,
      exclusiveLockPrivilegeSufficient: p.can_update,
      exclusiveLockAttempted: false, sessionModeDeclared: true, sessionModeAutomaticallyVerified: false,
      metadata: captureResults.filter(r => r.command === 'SELECT').map(r => ({ fields: r.fields.map(f => f.name), rows: r.rows })),
      schemaCompatibilityEvaluated: false, rekeyApproved: false, rekeyExecuted: false,
    } };
  } finally { await db.query('ROLLBACK'); }
}

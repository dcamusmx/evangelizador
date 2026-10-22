import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const derive = secret => createHash('sha256').update(secret, 'utf8').digest();
function requireKey(secret) {
  if (typeof secret !== 'string' || !secret.trim()) throw new Error('KEY_REQUIRED');
}
export function encrypt(bytes, secret) {
  requireKey(secret);
  const key = derive(secret);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  } finally { key.fill(0); }
}
export function decrypt(encoded, secret) {
  requireKey(secret);
  if (typeof encoded !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('INVALID_CIPHERTEXT');
  const data = Buffer.from(encoded, 'base64');
  if (data.length < 28 || data.toString('base64') !== encoded) throw new Error('INVALID_CIPHERTEXT');
  const key = derive(secret);
  let partial;
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    partial = cipher.update(data.subarray(28));
    return Buffer.concat([partial, cipher.final()]);
  } finally { key.fill(0); partial?.fill(0); }
}
function validateKeys({ oldKey, newKey, backupKey }) {
  for (const key of [oldKey, newKey, backupKey]) requireKey(key);
  const keys = [oldKey, newKey, backupKey].map(derive);
  try {
    if (keys.some((key, i) => keys.slice(i + 1).some(other => timingSafeEqual(key, other)))) throw new Error('KEYS_MUST_BE_INDEPENDENT');
    if (Buffer.byteLength(newKey) < 32 || Buffer.byteLength(backupKey) < 32) throw new Error('NEW_KEYS_TOO_SHORT');
  } finally { keys.forEach(key => key.fill(0)); }
}
const sorted = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
const withoutTime = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at'));

export async function inspectSchema(db) {
  const result = await db.query(`SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),
      'notNull',attnotnull,'generated',attgenerated,'identity',attidentity) ORDER BY attnum)
      FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped),
    'constraints', (SELECT coalesce(jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname),'[]'::jsonb) FROM pg_constraint WHERE conrelid=c.oid),
    'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),
      'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname),'[]'::jsonb)
      FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
    'rules', (SELECT count(*) FROM pg_rewrite WHERE ev_class=c.oid),
    'rls',c.relrowsecurity,'forcedRls',c.relforcerowsecurity,
    'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
    'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb)
      FROM pg_policies p WHERE schemaname='public' AND tablename='credenciales'),
    'bypass',(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)
  ) AS schema FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='credenciales'`);
  if (result.rows.length !== 1) throw new Error('TABLE_REQUIRED');
  return result.rows[0].schema;
}
function checkSchema(schema, approved) {
  if (!approved || !isDeepStrictEqual(schema, approved)) throw new Error('SCHEMA_REVIEW_REQUIRED');
  const expected = { id: 'uuid', servicio: 'text', nombre: 'text', descripcion: 'text', valor_cifrado: 'text', pista: 'text', activo: 'boolean', actualizado_por: 'uuid', created_at: 'timestamp with time zone', updated_at: 'timestamp with time zone' };
  if (schema.kind !== 'r' || !schema.bypass || schema.rules !== 0 || schema.columns.length !== Object.keys(expected).length ||
      schema.columns.some(c => expected[c.name] !== c.type || c.generated || c.identity) ||
      !schema.constraints.includes('PRIMARY KEY (id)')) throw new Error('UNSUPPORTED_SCHEMA');
  // Only the reviewed timestamp trigger is supported. Never disable triggers/RLS.
  for (const trigger of schema.triggers) {
    if (trigger.enabled !== 'O' || !/BEFORE UPDATE ON public\.credenciales FOR EACH ROW EXECUTE FUNCTION (?:public\.)?set_updated_at\(\)$/.test(trigger.definition) ||
        !/\bBEGIN\s+NEW\.updated_at\s*=\s*now\(\);\s*RETURN NEW;\s*END;?/i.test(trigger.function) ||
        !/LANGUAGE plpgsql/.test(trigger.function) || !/SET search_path TO 'public'/.test(trigger.function)) throw new Error('UNSUPPORTED_TRIGGER');
    const body = trigger.function.match(/\$function\$([\s\S]*?)\$function\$/)?.[1];
    if (!body || !/^\s*BEGIN\s+NEW\.updated_at\s*=\s*now\(\);\s*RETURN NEW;\s*END;?\s*$/i.test(body)) throw new Error('UNSUPPORTED_TRIGGER');
  }
}
async function rows(db) {
  const result = await db.query('SELECT to_jsonb(c) AS row FROM public.credenciales c ORDER BY id LIMIT 10001');
  return result.rows.map(record => record.row);
}
async function start(db) {
  await db.query('BEGIN');
  await db.query("SET LOCAL lock_timeout = '5s'");
  await db.query("SET LOCAL statement_timeout = '30s'");
  await db.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
  await db.query('LOCK TABLE public.credenciales IN EXCLUSIVE MODE');
}
export async function writeProtected(file, object, backupKey) {
  if (!file) throw new Error('BACKUP_PATH_REQUIRED');
  const plain = Buffer.from(JSON.stringify(object));
  let payload;
  try { payload = JSON.stringify({ format: 'evangelizador-rekey-v1', data: encrypt(plain, backupKey) }); }
  finally { plain.fill(0); }
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(payload, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  const readBack = await readProtected(file, backupKey);
  if (!isDeepStrictEqual(readBack, object)) throw new Error('BACKUP_VERIFICATION_FAILED');
}
export async function readProtected(file, backupKey) {
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  if (envelope.format !== 'evangelizador-rekey-v1') throw new Error('BACKUP_FORMAT');
  const plain = decrypt(envelope.data, backupKey);
  try { return JSON.parse(plain.toString('utf8')); }
  finally { plain.fill(0); }
}
async function update(db, before, after) {
  const result = await db.query(`UPDATE public.credenciales SET valor_cifrado=$1, updated_at=$2::timestamptz
    WHERE id=$3::uuid AND to_jsonb(credenciales)=$4::jsonb`, [after.valor_cifrado, after.updated_at, before.id, JSON.stringify(before)]);
  if (result.rowCount !== 1 && result.affectedRows !== 1) throw new Error('ROW_CHANGED');
}
function verifyContent(actual, expected, key) {
  if (actual.length !== expected.length) throw new Error('ROWSET_CHANGED');
  for (let i = 0; i < actual.length; i++) {
    if (!isDeepStrictEqual(withoutTime(actual[i]), withoutTime(expected[i]))) throw new Error('ROWSET_CHANGED');
    const plain = decrypt(actual[i].valor_cifrado, key);
    plain.fill(0);
  }
}

/** db is a single dedicated PostgreSQL session, never a REST client or pool query. */
export async function rekey(db, options) {
  validateKeys(options);
  const { oldKey, newKey, backupKey, approvedSchema, backupFile, receiptFile, mode = 'simulate', target } = options;
  if (!['simulate', 'apply'].includes(mode) || target !== 'grjxcsngfnxdkkdkkujh') throw new Error('TARGET_OR_MODE');
  let committed = false;
  try {
    await start(db);
    const schema = await inspectSchema(db);
    checkSchema(schema, approvedSchema);
    const before = sorted(await rows(db));
    if (!before.length || before.length > 10000) throw new Error('ROW_COUNT_LIMIT');
    const planned = [];
    // Complete the entire decrypt/roundtrip pass before any SQL write.
    for (const row of before) {
      const plain = decrypt(row.valor_cifrado, oldKey);
      let roundtrip;
      try {
        const value = encrypt(plain, newKey);
        roundtrip = decrypt(value, newKey);
        if (!plain.equals(roundtrip)) throw new Error('ROUNDTRIP_FAILED');
        planned.push({ ...row, valor_cifrado: value });
      } finally { plain.fill(0); roundtrip?.fill(0); }
    }
    await writeProtected(backupFile, { purpose: 'before', target, schema, before, planned }, backupKey);
    if (mode === 'simulate') {
      await db.query('ROLLBACK');
      return { mode, rows: before.length, committed: false };
    }
    if (!receiptFile || receiptFile === backupFile || options.maintenanceConfirmed !== true) throw new Error('MAINTENANCE_AND_RECEIPT_REQUIRED');
    for (let i = 0; i < before.length; i++) await update(db, before[i], planned[i]);
    const after = sorted(await rows(db));
    verifyContent(after, planned, newKey);
    // Durable recovery receipt contains exact post-trigger state, before COMMIT.
    await writeProtected(receiptFile, { purpose: 'recovery', target, schema, before, after }, backupKey);
    await db.query('COMMIT');
    committed = true;
    return { mode, rows: before.length, committed };
  } finally {
    if (!committed) { try { await db.query('ROLLBACK'); } catch { /* Never expose driver errors. */ } }
  }
}

export async function recover(db, options) {
  validateKeys(options);
  const { oldKey, newKey, backupKey, receiptFile, backupFile, approvedSchema, target } = options;
  if (options.maintenanceConfirmed !== true || target !== 'grjxcsngfnxdkkdkkujh') throw new Error('MAINTENANCE_REQUIRED');
  const receipt = await readProtected(receiptFile, backupKey);
  if (receipt.purpose !== 'recovery' || receipt.target !== target) throw new Error('WRONG_RECEIPT');
  let committed = false;
  try {
    await start(db);
    const schema = await inspectSchema(db);
    checkSchema(schema, approvedSchema);
    if (!isDeepStrictEqual(schema, receipt.schema)) throw new Error('SCHEMA_CHANGED');
    const current = sorted(await rows(db));
    if (!isDeepStrictEqual(current, sorted(receipt.after))) throw new Error('RECOVERY_WOULD_LOSE_CHANGES');
    const before = sorted(receipt.before);
    verifyContent(current, sorted(receipt.after), newKey);
    for (let i = 0; i < current.length; i++) {
      const oldPlain = decrypt(before[i].valor_cifrado, oldKey);
      const newPlain = decrypt(current[i].valor_cifrado, newKey);
      try { if (!oldPlain.equals(newPlain)) throw new Error('RECOVERY_CONTENT_MISMATCH'); }
      finally { oldPlain.fill(0); newPlain.fill(0); }
    }
    await writeProtected(backupFile, { purpose: 'before-recovery', target, schema, current }, backupKey);
    for (let i = 0; i < current.length; i++) await update(db, current[i], before[i]);
    verifyContent(sorted(await rows(db)), before, oldKey);
    await db.query('COMMIT');
    committed = true;
    return { mode: 'recover', rows: before.length, committed };
  } finally { if (!committed) { try { await db.query('ROLLBACK'); } catch { /* Redacted. */ } } }
}

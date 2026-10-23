// Offline JSON transformation only. Never evaluates code/expressions from the export.
import { readFile, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const filterName = 'Filtrar entrada autorizada';
const scrubbed = 'REDACTED_INTERNAL_API_KEY';
const walk = (value, visit, path = []) => {
  if (typeof value === 'string') return visit(value, path);
  if (Array.isArray(value)) return value.map((v, i) => walk(v, visit, [...path, String(i)]));
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, walk(v, visit, [...path, key])]),
  );
  return value;
};
function requireSource(source) {
  const webhooks = source.nodes?.filter(n => n.type === 'n8n-nodes-base.webhook');
  if (webhooks?.length !== 1 || webhooks[0].name !== 'Webhook' ||
      webhooks[0].parameters.authentication !== 'headerAuth' ||
      webhooks[0].credentials?.httpHeaderAuth?.name !== 'Header Auth account 2' ||
      !source.nodes.some(n => n.name === 'HTTP Request' && n.type === 'n8n-nodes-base.httpRequest') ||
      !source.nodes.some(n => n.name === 'Edit Fields') || source.nodes.some(n => n.name === filterName)) {
    throw new Error('EXPORT_STRUCTURE_REVIEW_REQUIRED');
  }
}
export function sanitizePublication(source) {
  requireSource(source);
  const fixedValues = source.nodes.flatMap(n => (n.parameters?.headerParameters?.parameters ?? [])
    .filter(h => typeof h.value === 'string' && h.value && !h.value.startsWith('='))
    .map(h => h.value));
  if (!fixedValues.length) throw new Error('FIXED_HEADER_REVIEW_REQUIRED');
  let result = structuredClone(source);
  // Remove every occurrence of discovered fixed header values, including accidental copies.
  result = walk(result, value => fixedValues.reduce((text, secret) => text.split(secret).join(scrubbed), value));
  for (const key of ['pinData', 'staticData', 'meta', 'id', 'versionId', 'activeVersionId', 'tags', 'nodeGroups', 'shared']) delete result[key];
  result.active = false;
  for (const [index, node] of result.nodes.entries()) {
    node.id = `review-node-${index + 1}`;
    delete node.webhookId;
    delete node.notes;
    if (node.type === 'n8n-nodes-base.webhook') node.parameters.path = 'REPLACE_PUBLICATION_WEBHOOK_PATH';
    for (const [type, credential] of Object.entries(node.credentials ?? {})) {
      credential.id = `REPLACE_${type}_CREDENTIAL_ID`;
      if (type !== 'httpHeaderAuth') credential.name = `REPLACE_${type}_CREDENTIAL_NAME`;
    }
    node.parameters = walk(node.parameters, (value, path) => {
      if (path.at(-1) === 'chatId') return 'REPLACE_TELEGRAM_CHAT_ID';
      if (path.at(-1) === 'bucketName') return 'REPLACE_R2_BUCKET_NAME';
      if (path.includes('youtubeAccounts') || path.includes('facebookAccounts')) return 'REPLACE_SOCIAL_ACCOUNT_ID';
      return value;
    });
  }
  const serialized = JSON.stringify(result);
  if (fixedValues.some(secret => serialized.includes(secret)) ||
      /sb_secret_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(serialized)) {
    throw new Error('ADDITIONAL_SECRET_REVIEW_REQUIRED');
  }
  return result;
}
export function preparePublication(sanitized, filterCode) {
  const result = structuredClone(sanitized);
  const edges = result.connections?.Webhook?.main;
  if (!edges || edges.length !== 1 || edges[0].length !== 1 || edges[0][0].node !== 'Edit Fields') {
    throw new Error('WEBHOOK_CONNECTION_REVIEW_REQUIRED');
  }
  result.nodes.push({ name: filterName, id: 'review-publication-input-filter',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0],
    parameters: { mode: 'runOnceForAllItems', jsCode: filterCode } });
  result.connections.Webhook.main[0][0].node = filterName;
  result.connections[filterName] = { main: [[{ node: 'Edit Fields', type: 'main', index: 0 }]] };
  const webhook = result.nodes.find(n => n.name === 'Webhook');
  const http = result.nodes.find(n => n.name === 'HTTP Request');
  http.parameters.authentication = 'genericCredentialType';
  http.parameters.genericAuthType = 'httpHeaderAuth';
  http.parameters.sendHeaders = false;
  delete http.parameters.headerParameters;
  http.credentials = { httpHeaderAuth: structuredClone(webhook.credentials.httpHeaderAuth) };
  // The supplied export contains a connected cron trigger, contrary to the manual-only inventory.
  // Disable it in the review proposal only; do not alter any publishing/deletion business node.
  for (const node of result.nodes) if (node.type === 'n8n-nodes-base.scheduleTrigger') node.disabled = true;
  return result;
}
export function reviewPublication(source, prepared) {
  const strings = [];
  for (const node of prepared.nodes) walk(node.parameters, value => { strings.push({ node: node.name, value }); return value; });
  const directWebhookReferences = strings.filter(({ value }) =>
    /\$\s*\(\s*['"]Webhook['"]|\$node\s*(?:\[\s*['"]Webhook['"]|\.Webhook)|\$items\s*\(\s*['"]Webhook['"]/.test(value),
  ).map(({ node }) => node);
  const headerReads = strings.filter(({ value }) => /(?:\$json|\$input|\$node|\$\s*\().*(?:\.headers\b|\[['"]headers['"]\])/.test(value)).map(({ node }) => node);
  return { sourceNodeCount: source.nodes.length, preparedNodeCount: prepared.nodes.length,
    sourceActive: source.active === true, preparedActive: prepared.active,
    sourceSchedulePresent: source.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'),
    sourceScheduleEnabled: source.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger' && n.disabled !== true),
    sharedCredential: 'Header Auth account 2', directWebhookReferences, headerReads,
    sourceExplicitExecutionSavingSettings: ['saveDataSuccessExecution', 'saveDataErrorExecution', 'saveManualExecutions', 'saveExecutionProgress']
      .filter(key => Object.hasOwn(source.settings ?? {}, key)),
    sourceDeletionNodePresent: source.nodes.some(n => n.type === 'n8n-nodes-base.s3' && n.name === 'Delete a file'),
    reviewOnly: true, installed: false, keyRotated: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error('INPUT');
    const source = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const sanitized = sanitizePublication(source);
    const prepared = preparePublication(sanitized, await readFile(new URL('publication-input.code.js', import.meta.url), 'utf8'));
    const report = reviewPublication(source, prepared);
    if (report.directWebhookReferences.length || report.headerReads.length) throw new Error('REFERENCE_REVIEW_REQUIRED');
    for (const [name, value] of [['publication.sanitized.before.json', sanitized], ['publication.prepared.json', prepared], ['publication.review.json', report]]) {
      const file = await open(join(process.argv[3], name), 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); } finally { await file.close(); }
    }
    console.log(JSON.stringify({ sanitized: true, prepared: true, referencesChecked: true, reviewOnly: true }));
  } catch {
    console.error('OFFLINE_EXPORT_PREPARATION_FAILED: no sensitive details emitted; source and services unchanged.');
    process.exitCode = 1;
  }
}

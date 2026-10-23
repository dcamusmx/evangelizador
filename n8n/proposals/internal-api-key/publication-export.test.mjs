import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizePublication, preparePublication, reviewPublication } from './publication-export.mjs';

const filter = readFileSync(new URL('publication-input.code.js', import.meta.url), 'utf8');
function source() {
  return { active: true, id: 'fictional-workflow-id', meta: { private: true }, pinData: { private: true },
    settings: { executionOrder: 'v1' }, nodes: [
      { name: 'Webhook', type: 'n8n-nodes-base.webhook', webhookId: 'fictional-webhook-id',
        parameters: { authentication: 'headerAuth', path: 'fictional-route' },
        credentials: { httpHeaderAuth: { id: 'fictional-auth-id', name: 'Header Auth account 2' } } },
      { name: 'Edit Fields', type: 'n8n-nodes-base.set', parameters: { assignments: { assignments: [{ name: '=fecha', value: '={{ $json.body.fecha }}' }] } } },
      { name: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', parameters: {
        method: 'POST', url: '=https://example.invalid/api/public/r2-download-url', sendHeaders: true,
        headerParameters: { parameters: [{ name: 'X-N8N-API-KEY', value: 'fictional-fixed-key-for-test-only' }] },
      } },
      { name: 'Programado', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: {} } },
      { name: 'Delete a file', type: 'n8n-nodes-base.s3', parameters: { operation: 'delete', bucketName: 'fictional-private-bucket' } },
      { name: 'Telegram', type: 'n8n-nodes-base.telegram', parameters: { chatId: '=fictional-private-chat' }, credentials: { telegramApi: { id: 'fictional-telegram-id', name: 'fictional-private-name' } } },
      { name: 'Social', type: 'n8n-nodes-late.late', parameters: { youtubeAccounts: ['fictional-account-id'] } },
    ], connections: { Webhook: { main: [[{ node: 'Edit Fields', type: 'main', index: 0 }]] },
      'Edit Fields': { main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]] },
      Programado: { main: [[{ node: 'Edit Fields', type: 'main', index: 0 }]] } } };
}
test('sanitization removes fixed secrets, credential IDs, pin data and private destinations without mutating source', () => {
  const original = source(), result = sanitizePublication(original), text = JSON.stringify(result);
  for (const value of ['fictional-fixed-key-for-test-only', 'fictional-auth-id', 'fictional-workflow-id', 'fictional-private-chat', 'fictional-private-bucket', 'fictional-account-id']) {
    assert.equal(text.includes(value), false);
  }
  assert.equal(result.pinData, undefined);
  assert.equal(result.meta, undefined);
  assert.equal(result.active, false);
  assert.equal(original.active, true);
  assert.equal(original.nodes[2].parameters.headerParameters.parameters[0].value, 'fictional-fixed-key-for-test-only');
});
test('prepared HTTP uses same managed auth reference, removes manual headers and preserves destination/method', () => {
  const before = sanitizePublication(source()), after = preparePublication(before, filter);
  const http = after.nodes.find(n => n.name === 'HTTP Request');
  assert.deepEqual(http.credentials.httpHeaderAuth, after.nodes[0].credentials.httpHeaderAuth);
  assert.equal(http.credentials.httpHeaderAuth.name, 'Header Auth account 2');
  assert.equal(http.parameters.authentication, 'genericCredentialType');
  assert.equal(http.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(http.parameters.headerParameters, undefined);
  assert.equal(http.parameters.sendHeaders, false);
  assert.equal(http.parameters.method, before.nodes[2].parameters.method);
  assert.equal(http.parameters.url, before.nodes[2].parameters.url);
});
test('filter is immediately after Webhook and body.fecha contract remains compatible with Edit Fields', () => {
  const before = sanitizePublication(source()), after = preparePublication(before, filter);
  assert.equal(after.connections.Webhook.main[0][0].node, 'Filtrar entrada autorizada');
  assert.equal(after.connections['Filtrar entrada autorizada'].main[0][0].node, 'Edit Fields');
  assert.deepEqual(after.nodes.find(n => n.name === 'Edit Fields'), before.nodes.find(n => n.name === 'Edit Fields'));
  assert.deepEqual(after.connections['Edit Fields'], before.connections['Edit Fields']);
});
test('prepared copy is inactive, cron disabled, and deletion logic is preserved rather than silently repaired', () => {
  const before = sanitizePublication(source()), after = preparePublication(before, filter);
  assert.equal(after.active, false);
  assert.equal(after.nodes.find(n => n.name === 'Programado').disabled, true);
  assert.deepEqual(after.nodes.find(n => n.name === 'Delete a file'), before.nodes.find(n => n.name === 'Delete a file'));
});
test('review detects direct Webhook references and header reads', () => {
  const original = source(), prepared = preparePublication(sanitizePublication(original), filter);
  assert.deepEqual(reviewPublication(original, prepared).directWebhookReferences, []);
  for (const expression of ["={{ $('Webhook').first().json.headers }}", "={{ $node['Webhook'].json.body.fecha }}", "={{ $items('Webhook')[0].json }}"]) {
    prepared.nodes[1].parameters.expression = expression;
    assert.deepEqual(reviewPublication(original, prepared).directWebhookReferences, ['Edit Fields']);
  }
  prepared.nodes[1].parameters.expression = '={{ $json.headers }}';
  assert.deepEqual(reviewPublication(original, prepared).headerReads, ['Edit Fields']);
});
test('unreviewed source structure and unexpected bypass edge fail closed', () => {
  const wrong = source(); wrong.nodes[0].parameters.authentication = 'none';
  assert.throws(() => sanitizePublication(wrong), /REVIEW_REQUIRED/);
  const other = sanitizePublication(source());
  other.connections.Webhook.main[0].push({ node: 'HTTP Request', type: 'main', index: 0 });
  assert.throws(() => preparePublication(other, filter), /REVIEW_REQUIRED/);
});

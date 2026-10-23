// Proposal: Code node, Run Once for All Items, immediately after authenticated Webhook.
// Not installed. Keep body.fecha for the existing Edit Fields node; discard everything else.
const items = $input.all();
if (items.length !== 1) throw new Error('Invalid publication input');
const body = items[0]?.json?.body;
if (!body || typeof body !== 'object' || Array.isArray(body) ||
    !Object.hasOwn(body, 'fecha') || typeof body.fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)) {
  throw new Error('Invalid publication input');
}
const date = new Date(body.fecha + 'T00:00:00.000Z');
if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.fecha) {
  throw new Error('Invalid publication input');
}
// Build a fresh object: never spread input/body or copy headers, query, params, binary.
return [{ json: { body: { fecha: body.fecha } } }];

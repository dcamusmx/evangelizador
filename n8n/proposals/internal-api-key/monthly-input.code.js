// Proposal: Code node, Run Once for All Items, after monthly authenticated Webhook.
// Keep this workflow inactive after preparing changes. Not installed.
const items = $input.all();
if (items.length !== 1) throw new Error('Invalid monthly input');
const body = items[0]?.json?.body;
if (!body || typeof body !== 'object' || Array.isArray(body) ||
    !['mes', 'anio', 'inicio', 'fin'].every(key => Object.hasOwn(body, key)) ||
    !Number.isInteger(body.mes) || body.mes < 1 || body.mes > 12 ||
    !Number.isInteger(body.anio) || body.anio < 2000 || body.anio > 2100) {
  throw new Error('Invalid monthly input');
}
const month = String(body.mes).padStart(2, '0');
const lastDay = new Date(Date.UTC(body.anio, body.mes, 0)).getUTCDate();
const inicio = `${body.anio}-${month}-01`;
const fin = `${body.anio}-${month}-${String(lastDay).padStart(2, '0')}`;
if (body.inicio !== inicio || body.fin !== fin) throw new Error('Invalid monthly input');
return [{ json: { mes: body.mes, anio: body.anio, inicio, fin } }];

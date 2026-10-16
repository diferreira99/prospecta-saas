// Porteiro da agenda (api/agenda.js) com Supabase e n8n simulados.
const test = require('node:test');
const assert = require('node:assert');

process.env.N8N_AGENDA_URL = 'https://n8n.test/webhook/secreto';
const chamadas = [];
global.fetch = async (url, opt = {}) => {
  url = String(url); chamadas.push({ url, opt });
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/auth/v1/user')) return opt.headers.Authorization === 'Bearer bom' || opt.headers.Authorization === 'Bearer bom2' ? json({ id: opt.headers.Authorization.slice(7) }) : json({}, 401);
  if (url === 'https://n8n.test/webhook/secreto') return json({ ok: true, eco: JSON.parse(opt.body), auth: opt.headers.Authorization });
  return json({}, 404);
};
const handler = require('../api/agenda.js');
let ipN = 0;
async function chamar({ metodo = 'POST', token, body, ip } = {}) {
  const req = { method: metodo, headers: { 'x-real-ip': ip || ('10.0.0.' + (++ipN)) }, body };
  if (token) req.headers.authorization = 'Bearer ' + token;
  const res = { statusCode: 0, setHeader() {}, end(t) { this.txt = t; } };
  await handler(req, res);
  return { status: res.statusCode, j: JSON.parse(res.txt) };
}

test('sem login não chega no n8n', async () => {
  chamadas.length = 0;
  assert.equal((await chamar({ body: { acao: 'horarios' } })).status, 401);
  assert.equal((await chamar({ token: 'falso', body: { acao: 'horarios' } })).status, 401);
  assert.ok(chamadas.every(c => !c.url.includes('n8n.test')));
});

test('com login repassa só os campos conhecidos e o login no cabeçalho', async () => {
  const r = await chamar({ token: 'bom', body: { acao: 'marcar', dia: '16/10', hora: '10:00', lixo: 'x'.repeat(50), access_token: 'nao' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.j.eco, { acao: 'marcar', dia: '16/10', hora: '10:00' });
  assert.equal(r.j.auth, 'Bearer bom');
});

test('ação desconhecida, corpo gigante e GET são recusados', async () => {
  assert.equal((await chamar({ token: 'bom', body: { acao: 'apagar' } })).status, 400);
  assert.equal((await chamar({ token: 'bom', body: { acao: 'horarios', x: 'y'.repeat(5000) } })).status, 400);
  assert.equal((await chamar({ metodo: 'GET', token: 'bom' })).status, 405);
});

test('limite por minuto: por endereço e por conta', async () => {
  let ultimo;
  for (let i = 0; i < 61; i++) ultimo = await chamar({ ip: '9.9.9.9', body: {} });
  assert.equal(ultimo.status, 429, 'mesmo endereço, sem login, 61 vezes');
  let n429 = 0;
  for (let i = 0; i < 21; i++) if ((await chamar({ token: 'bom2', body: { acao: 'horarios' } })).status === 429) n429++;
  assert.equal(n429, 1, 'a 21ª da mesma conta no minuto é barrada');
});

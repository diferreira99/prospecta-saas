// Busca de perfis do módulo ⚡ Engenharia (api/perfis.js) com Supabase e Serper simulados.
const test = require('node:test');
const assert = require('node:assert');

process.env.SERPER_API_KEY = 'chave-teste';
const chamadas = [];
global.fetch = async (url, opt = {}) => {
  url = String(url); chamadas.push({ url, opt });
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/auth/v1/user')) return /Bearer bom/.test(opt.headers.Authorization) ? json({ id: opt.headers.Authorization.slice(7) }) : json({}, 401);
  if (url === 'https://google.serper.dev/search') return json({ organic: [
    { link: 'https://br.linkedin.com/in/carlos-1?trk=x', title: 'Carlos Souza - Sócio - Sol Forte | LinkedIn', snippet: 'Localização: Goiânia' },
    { link: 'https://www.linkedin.com/in/carlos-1/', title: 'Carlos Souza - Sócio - Sol Forte | LinkedIn' },
    { link: 'https://www.instagram.com/solforte/', title: 'Sol Forte (@solforte) • Instagram photos and videos', snippet: '2.300  Followers' },
    { link: 'https://www.instagram.com/p/XYZ/', title: 'post' },
    { link: 'https://exemplo.com', title: 'outro site' },
  ] });
  return json({}, 404);
};
const handler = require('../api/perfis.js');
let ipN = 0;
async function chamar({ metodo = 'POST', token, body, ip } = {}) {
  const req = { method: metodo, headers: { 'x-real-ip': ip || ('10.1.0.' + (++ipN)) }, body };
  if (token) req.headers.authorization = 'Bearer ' + token;
  const res = { statusCode: 0, setHeader() {}, end(t) { this.txt = t; } };
  await handler(req, res);
  return { status: res.statusCode, j: JSON.parse(res.txt) };
}
const Q = 'site:br.linkedin.com/in ("energia solar") sócio "{cidade}"';

test('sem login não gasta a busca', async () => {
  chamadas.length = 0;
  assert.equal((await chamar({ body: { q: Q } })).status, 401);
  assert.equal((await chamar({ token: 'falso', body: { q: Q } })).status, 401);
  assert.ok(chamadas.every(c => !c.url.includes('serper')));
});

test('só aceita busca dentro do LinkedIn ou do Instagram', async () => {
  assert.equal((await chamar({ token: 'bom', body: { q: 'qualquer coisa' } })).j.erro, 'busca_fora');
  assert.equal((await chamar({ token: 'bom', body: { q: 'site:facebook.com x' } })).status, 400);
  assert.equal((await chamar({ metodo: 'GET', token: 'bom' })).status, 405);
});

test('lê pessoas e perfis, troca a cidade e tira repetidos e posts', async () => {
  chamadas.length = 0;
  const r = await chamar({ token: 'bom', body: { q: Q, cidade: 'Goiânia', pagina: 2 } });
  assert.equal(r.status, 200);
  const enviado = JSON.parse(chamadas.find(c => c.url.includes('serper')).opt.body);
  assert.equal(enviado.q, 'site:br.linkedin.com/in ("energia solar") sócio "Goiânia"');
  assert.equal(enviado.page, 2);
  assert.equal(r.j.itens.length, 2);
  const [li, ig] = r.j.itens;
  assert.deepEqual([li.nome, li.cargo, li.empresa, li.cidade, li.link], ['Carlos Souza', 'Sócio', 'Sol Forte', 'Goiânia', 'https://www.linkedin.com/in/carlos-1/']);
  assert.deepEqual([ig.handle, ig.cargo], ['@solforte', '2.300 seguidores']);
});

test('sem a chave do Serper avisa em vez de quebrar', async () => {
  const k = process.env.SERPER_API_KEY; delete process.env.SERPER_API_KEY;
  try { assert.equal((await chamar({ token: 'bom', body: { q: Q } })).j.erro, 'sem_chave'); }
  finally { process.env.SERPER_API_KEY = k; }
});

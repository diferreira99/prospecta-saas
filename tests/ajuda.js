// Abre o index.html num navegador de verdade (Chromium), com um Supabase falso em memória,
// sem internet: nada sai daqui, nem para o banco nem para o WhatsApp.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Supabase falso: guarda as tabelas em window._db e entende os filtros que o app usa.
function supabaseFalso(db, rpcs) {
  return `window._db = ${JSON.stringify(db || {})}; window._rpcs = ${JSON.stringify(rpcs || {})};
window.supabase = { createClient: () => {
  function Q(t) { const st = { t, f: [], op: 'select', vals: null, head: false };
    const q = {
      select(_c, o){ if (o && o.head) st.head = true; return q }, order(){ return q }, limit(){ return q }, range(){ return q }, gte(){ return q }, lte(){ return q }, neq(){ return q }, ilike(){ return q },
      not(k, op, v){ if (op === 'is' && v === null) st.f.push(r => r[k] !== null && r[k] !== undefined); return q },
      eq(k, v){ st.f.push(r => r[k] === v); return q }, in(k, vs){ st.f.push(r => vs.includes(r[k])); return q },
      insert(v){ st.op = 'insert'; st.vals = Array.isArray(v) ? v : [v]; return q }, update(v){ st.op = 'update'; st.vals = v; return q },
      delete(){ st.op = 'delete'; return q }, upsert(v){ st.op = 'upsert'; st.vals = v; return q },
      maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
      then(res, rej){ const tb = _db[t] = _db[t] || []; let data = [];
        if (st.op === 'insert') { data = st.vals.map((v, i) => Object.assign({ id: 'n' + (tb.length + i + 1) }, v)); tb.push(...data); }
        else if (st.op === 'update') { data = tb.filter(r => st.f.every(f => f(r))); data.forEach(r => Object.assign(r, st.vals)); }
        else if (st.op === 'delete') { _db[t] = tb.filter(r => !st.f.every(f => f(r))); }
        else if (st.op === 'upsert') { (Array.isArray(st.vals) ? st.vals : [st.vals]).forEach(v => { const r = tb.find(x => x.user_id === v.user_id && (x.phone === undefined || x.phone === v.phone)); if (r) Object.assign(r, v); else tb.push(v); }); }
        else data = tb.filter(r => st.f.every(f => f(r)));
        return Promise.resolve({ data: st.head ? null : JSON.parse(JSON.stringify(data)), error: null, count: data.length }).then(res, rej); } };
    return q; }
  return { auth: { getSession: async () => ({ data: { session: { access_token: 'tk', user: { id: 'u1', email: 'teste@x.com', user_metadata: { nome: 'Teste' } } } } }), onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } } }, signOut: async () => ({}), signUp: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }) },
           from(t){ return Q(t) }, rpc: async (n) => ({ data: n in _rpcs ? _rpcs[n] : null, error: null }),
           storage: { from(){ return { upload: async () => ({}), getPublicUrl: () => ({ data: {} }) } } },
           channel(){ return { on(){ return this }, subscribe(){ return this } } }, removeChannel(){} };
} };`;
}

// rotas: [[regex do caminho, (pedido) => resposta json]] para servidores falsos (n8n, WhatsApp, agenda)
async function abrirApp({ db, rpcs, rotas = [], largura = 390 } = {}) {
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 844 } });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on('pageerror', e => erros.push(e.message));
  const pedidos = [];
  const stub = supabaseFalso(db, rpcs);
  await pagina.route('**/*', r => {
    const u = new URL(r.request().url());
    for (const [rx, fn] of rotas) if (rx.test(u.pathname)) {
      const corpo = r.request().postData(); let j = null; try { j = corpo ? JSON.parse(corpo) : null; } catch (e) {}
      pedidos.push({ caminho: u.pathname, corpo: j, headers: r.request().headers() });
      return r.fulfill({ json: fn(j, u), headers: { 'access-control-allow-origin': '*' } });
    }
    if (u.hostname === 'app.test') return r.fulfill({ body: HTML, contentType: 'text/html' });
    if (u.pathname.includes('supabase-js')) return r.fulfill({ body: stub, contentType: 'application/javascript' });
    return r.fulfill({ status: 200, body: '' });   // fontes, CDNs e o resto: vazio, sem internet
  });
  await pagina.goto('https://app.test/');
  await pagina.waitForTimeout(1200);
  await pagina.evaluate(() => { document.getElementById('tela-login').style.display = 'none'; currentUser = { id: 'u1', email: 'teste@x.com' }; });
  // erros esperados do ambiente de teste (sem o banco de verdade)
  const errosReais = () => erros.filter(e => !/carregarDoSupabase/.test(e));
  return { navegador, pagina, errosReais, pedidos, fechar: () => navegador.close() };
}
module.exports = { abrirApp, HTML };

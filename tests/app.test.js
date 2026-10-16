// Testes automáticos do Prospecta+: abrem o app num navegador de verdade e conferem o que não pode quebrar.
// Rodam no GitHub a cada atualização (.github/workflows/testes.yml) e também aqui: cd tests && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { abrirApp, HTML } = require('./ajuda.js');

test('todos os scripts do index.html são JavaScript válido', () => {
  const re = /<script>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(HTML))) { n++; assert.doesNotThrow(() => new Function(m[1]), 'script ' + n + ' com erro de sintaxe'); }
  assert.ok(n >= 3);
});

test('a tela de login abre sem erro, sem "Criar conta" e com Termos e Privacidade', async () => {
  const a = await abrirApp();
  try {
    await a.pagina.evaluate(() => { document.getElementById('tela-login').style.display = ''; });
    const t = await a.pagina.innerText('#tela-login');
    assert.ok(t.includes('Ainda não tenho acesso'));
    assert.ok(!/Criar conta/.test(t));
    assert.ok(t.includes('Termos de uso') && t.includes('Política de privacidade'));
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('nome de lead com código não roda na tela (proteção contra XSS)', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      window.__x = 0;
      const mal = '<img src=x onerror="window.__x++">';
      const lead = { title: mal, address: mal, category: mal, phone: '11999990000', website: 'javascript:window.__x++', rating: 4.5 };
      todosLeads = [lead]; _leadsBase = [lead]; renderPagina(1);
      _filaFollowupsCache = [{ id: 1, lead_nome: mal, phone: '11999990000', dia_etapa: 3, mensagem: 'oi', campanha_nome: mal }]; renderizarFilaFollowups();
      campanhas = [{ id: 1, nome: mal, leads: [lead], criadaEm: Date.now() }]; try { renderCampanhas(); } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
      return { rodou: window.__x, linksPerigosos: [...document.querySelectorAll('a')].filter(x => /javascript:/i.test(x.getAttribute('href') || '')).length };
    });
    assert.strictEqual(r.rodou, 0); assert.strictEqual(r.linksPerigosos, 0);
  } finally { await a.fechar(); }
});

test('produtos: criar, trocar e o texto da IA acompanha o produto', async () => {
  const a = await abrirApp({ db: { produtos: [{ id: 'p1', user_id: 'u1', nome: 'Kaizen', instrucoes: 'Venda o Kaizen', padrao: true }] } });
  try {
    a.pagina.on('dialog', d => d.accept(d.message().startsWith('Nome do produto') ? 'Stone' : ''));
    await a.pagina.evaluate(() => trocarAba('ia', document.querySelector(`.nav-item[onclick*="'ia'"]`)));
    await a.pagina.evaluate(() => prodCarregar()); await a.pagina.waitForTimeout(200);
    assert.strictEqual(await a.pagina.inputValue('#ia-prompt-livre'), 'Venda o Kaizen');
    await a.pagina.evaluate(() => prodNovo()); await a.pagina.waitForTimeout(300);
    await a.pagina.fill('#ia-prompt-livre', 'Maquininha Stone'); await a.pagina.waitForTimeout(1500);
    const db = await a.pagina.evaluate(() => _db.produtos.map(p => p.nome + ':' + p.instrucoes));
    assert.deepStrictEqual(db, ['Kaizen:Venda o Kaizen', 'Stone:Maquininha Stone']);
    await a.pagina.selectOption('#ia-produto', 'p1'); await a.pagina.waitForTimeout(200);
    assert.strictEqual(await a.pagina.inputValue('#ia-prompt-livre'), 'Venda o Kaizen');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('WhatsApp conferido sozinho depois da busca, com limite de 400 por dia', async () => {
  const a = await abrirApp({ largura: 1280, rotas: [[/\/check-number$/, j => ({ exists: j.phone.endsWith('1') })]] });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' };
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`));
      const st = window.setTimeout; window.setTimeout = (f, ms) => st(f, Math.min(ms, 5));
      const mk = (n, b) => Array.from({ length: n }, (_, i) => ({ title: 'Empresa ' + i, phone: '119' + String(b + i).padStart(8, '0'), fonte: 'serper' }));
      const l1 = mk(12, 80000000); todosLeads = l1; _leadsBase = l1.slice(); renderPagina(1);
      await verificarWhatsAppLote({ auto: true });
      const h = document.getElementById('tabela').innerHTML;
      const r1 = { com: (h.match(/📱 WhatsApp/g) || []).length, sem: (h.match(/❌ sem WhatsApp/g) || []).length, filtroForcado: _soComWhats };
      const k = _waContadorHoje(); userSet(k.k, 395);
      const l2 = mk(20, 70000000); todosLeads = l2; _leadsBase = l2.slice();
      await verificarWhatsAppLote({ auto: true });
      return { r1, contador: _waContadorHoje().n };
    });
    assert.strictEqual(r.r1.com + r.r1.sem, 12); assert.strictEqual(r.r1.filtroForcado, false);
    assert.strictEqual(r.contador, 400);
  } finally { await a.fechar(); }
});

test('reunião: propõe horários e marca com Meet, sempre esperando você enviar', async () => {
  const a = await abrirApp({ rpcs: { sou_dono_agenda: true }, rotas: [[/\/api\/agenda$/, j => j.acao === 'horarios'
    ? { ok: true, slots: [{ dia_mes: '16/10', dia_semana: 'sexta-feira', hora: '10:00', texto: 'sexta-feira, 16/10, às 10:00' }] }
    : { ok: true, inicio: '2026-10-16T13:00:00.000Z', meet: 'https://meet.google.com/abc', escolhido: { texto: 'sexta-feira, 16/10, às 10:00' } }]] });
  try {
    await a.pagina.evaluate(() => trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`)));
    await a.pagina.waitForTimeout(1200);
    await a.pagina.evaluate(() => { _filaSugestoesCache = [{ id: 7, phone: '5511999990000', lead_nome: 'Padaria Sol', mensagem_recebida: 'Tenho interesse', classificacao: 'quente', sugestao_ia: 'Posso explicar!', status: 'pendente', criado_em: new Date().toISOString() }]; renderizarFilaSugestoes(); });
    await a.pagina.evaluate(() => [...document.querySelectorAll('.rs-link')].find(b => b.textContent.includes('Marcar reunião')).click());
    await a.pagina.waitForTimeout(600);
    await a.pagina.click('text=💬 Propor estes horários na resposta');
    assert.match(await a.pagina.inputValue('#fila-texto-7'), /sexta-feira, 16\/10, às 10:00/);
    await a.pagina.click('text=sexta-feira, 16/10, às 10:00');
    await a.pagina.locator('.rs-painel .rs-btn.verde').click(); await a.pagina.waitForTimeout(1000);
    assert.match(await a.pagina.inputValue('#fila-texto-7'), /meet\.google\.com\/abc/);
    assert.ok(a.pedidos.every(p => !/send-message|responder-fila/.test(p.caminho)), 'nada pode ir para o lead sozinho');
    const ag = a.pedidos.filter(p => p.caminho === '/api/agenda');
    assert.ok(ag.length >= 2 && ag.every(p => /^Bearer /.test(p.headers.authorization) && !('access_token' in p.corpo)), 'login vai no cabeçalho, não no corpo');
  } finally { await a.fechar(); }
});

test('enviar todos os follow-ups manda as edições e esvazia a fila', async () => {
  const a = await abrirApp({ rotas: [[/\/responder-followup$/, () => ({ ok: true })]] });
  try {
    await a.pagina.evaluate(() => trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`)));
    await a.pagina.waitForTimeout(1200);
    await a.pagina.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms) => st(f, Math.min(ms, 10)); window.confirm = () => true;
      _filaFollowupsCache = [1, 2].map(i => ({ id: i, phone: '1190000000' + i, lead_nome: 'Lead ' + i, dia_etapa: 3, mensagem: 'Oi ' + i, campanha_nome: 'C' })); renderizarFilaFollowups(); });
    await a.pagina.fill('#fu-texto-2', 'Editado');
    await a.pagina.evaluate(() => enviarTodosFollowups()); await a.pagina.waitForTimeout(1000);
    assert.deepStrictEqual(a.pedidos.map(p => p.corpo.filaId + ':' + p.corpo.texto), ['1:Oi 1', '2:Editado']);
    assert.strictEqual(await a.pagina.evaluate(() => _filaFollowupsCache.length), 0);
  } finally { await a.fechar(); }
});

test('Peça ajuda abre o WhatsApp do suporte com a conta e os erros recentes', async () => {
  const a = await abrirApp();
  try {
    await a.pagina.evaluate(() => { window.open = u => { window.__abriu = u; }; registrarErroApp('Falha X no teste'); pedirAjuda(); });
    await a.pagina.locator('.modal-backdrop.active textarea').last().fill('Não consigo enviar');
    await a.pagina.locator('.modal-backdrop.active button', { hasText: 'Abrir no WhatsApp' }).last().click();
    const url = decodeURIComponent(await a.pagina.evaluate(() => window.__abriu));
    assert.ok(url.startsWith('https://wa.me/5511915117743?text='));
    assert.ok(url.includes('teste@x.com') && url.includes('Não consigo enviar') && url.includes('Falha X no teste'));
    const salvos = await a.pagina.evaluate(() => _db.erros_app.map(e => e.mensagem));
    assert.ok(salvos.includes('Falha X no teste') && salvos.some(m => m.startsWith('Pediu ajuda')));
  } finally { await a.fechar(); }
});

test('Painel mostra o resultado por produto', async () => {
  const leads = Array.from({ length: 30 }, (_, i) => ({ user_id: 'u1', phone: '119000000' + String(i).padStart(2, '0'), campanha_id: i < 20 ? 'c1' : 'c2', enviado_em: '2026-10-15', respondeu: i % 4 === 0, resposta_suspeita_bot: false }));
  const a = await abrirApp({ db: { leads, campanhas_produto: [{ campanha_id: 'c1', produto_nome: 'Kaizen', user_id: 'u1' }, { campanha_id: 'c2', produto_nome: 'Stone', user_id: 'u1' }], pipeline_leads: [{ phone: '11900000000', col: 'fechado', user_id: 'u1' }] } });
  try {
    await a.pagina.evaluate(() => prProdutosCarregar()); await a.pagina.waitForTimeout(400);
    const t = await a.pagina.evaluate(() => { const s = document.getElementById('pr-produtos'); return s.hidden ? '' : s.innerText; });
    assert.match(t, /Kaizen \(1 campanha\)\s+20\s+25%\s+0\s+1/);
    assert.match(t, /Stone \(1 campanha\)\s+10/);
  } finally { await a.fechar(); }
});

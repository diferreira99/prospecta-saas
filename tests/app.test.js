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
    await a.pagina.evaluate(() => [...document.querySelectorAll('.rs-link')].find(b => b.textContent.includes('Reunião ou ligação')).click());
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
    await a.pagina.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms) => st(f, Math.min(ms, 10)); window.confirm = () => true; fuIntervalo = () => 0;
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

test('limite de aparelhos: liberado fica; passou do limite sai sozinho e avisa', async () => {
  const a = await abrirApp({ rpcs: { sessao_valida: { ok: true, limite: 2 } } });
  try {
    await a.pagina.evaluate(() => { window._marca = 1; });
    await a.pagina.evaluate(() => conferirLimiteAparelhos());
    await a.pagina.waitForTimeout(400);
    assert.equal(await a.pagina.evaluate(() => window._marca), 1, 'liberado: não pode sair');
    await a.pagina.evaluate(() => { window._rpcs.sessao_valida = { ok: false, limite: 2 }; window._saiu = null; const so = supabaseClient.auth.signOut; supabaseClient.auth.signOut = async (o) => { sessionStorage.setItem('escopo', JSON.stringify(o)); return so(o); }; });
    await a.pagina.evaluate(() => conferirLimiteAparelhos());
    await a.pagina.waitForTimeout(1500);
    assert.equal(await a.pagina.evaluate(() => window._marca), undefined, 'recarregou a página');
    assert.deepEqual(JSON.parse(await a.pagina.evaluate(() => sessionStorage.getItem('escopo'))), { scope: 'local' }, 'sai só deste aparelho');
    assert.match(await a.pagina.textContent('#login-msg'), /outro aparelho.*2 aparelhos/);
  } finally { await a.fechar(); }
});

test('Instagram: botão discreto, DM da IA, copia e abre o perfil, registra e põe no Pipeline', async () => {
  const a = await abrirApp({ largura: 1280, rotas: [[/\/ia$/, () => ({ texto: '"Oi, Clínica Sol! Vi a nota 4,8 no Google. Ajudo clínicas a lotar a agenda. Posso te mostrar em 2 min?"' })]] });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' }; config.iaProvider = 'openai';
      window._abertos = []; window.open = (u) => { window._abertos.push(u); return null; };
      let copiado = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copiado = t; } }, configurable: true });
      window._copiado = () => copiado;
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`));
      const leads = [
        { title: 'Clínica Sol', category: 'Dentista', rating: 4.8, reviews: 120, phone: '1133334444', is_whatsapp: false, instagram: 'https://www.instagram.com/clinicasol/' },
        { title: 'Pet Feliz', category: 'Pet shop', phone: '11988887777', is_whatsapp: true, instagram: 'https://instagram.com/petfeliz' },
        { title: 'Sem Rede', category: 'Padaria', phone: '11977776666', is_whatsapp: true },
      ];
      todosLeads = leads; _leadsBase = leads.slice(); _igFeitos = new Set(); _igHoje = 0;
      renderPagina(1); atualizarAcoesBusca();
      const botoes = document.querySelectorAll('#tabela .tag-igdm').length;
      const coloridos = document.querySelectorAll('#tabela .tag-ig').length;
      const fila = document.getElementById('ps-btn-ig').textContent;
      // filtro "Só Instagram (sem WhatsApp)"
      alternarFiltroExtra('insta'); const soInsta = document.querySelectorAll('#tabela tr .tag-igdm').length; alternarFiltroExtra('insta');
      return { botoes, coloridos, fila, soInsta, primeiro: igFila()[0].title };
    });
    assert.strictEqual(r.botoes, 2, 'botão só em quem tem Instagram');
    assert.strictEqual(r.coloridos, 0, 'sem o logo colorido na linha');
    assert.match(r.fila, /Abordar no Instagram \(2\)/);
    assert.strictEqual(r.soInsta, 1);
    assert.strictEqual(r.primeiro, 'Clínica Sol', 'quem não tem WhatsApp vem primeiro');

    await a.pagina.evaluate(() => igAbrirFila());
    await a.pagina.waitForSelector('.ig-modal .ig-texto:not([disabled])');
    assert.match(await a.pagina.inputValue('.ig-modal .ig-texto'), /^Oi, Clínica Sol!/);
    assert.match(await a.pagina.textContent('.ig-modal'), /1 de 2/);
    await a.pagina.click('.ig-modal button:has-text("Copiar e abrir conversa")');
    await a.pagina.waitForSelector('.ig-modal button:has-text("Mandei")');
    const r2 = await a.pagina.evaluate(() => ({ abertos: window._abertos, copiado: window._copiado() }));
    assert.deepStrictEqual(r2.abertos, ['https://ig.me/m/clinicasol'], 'abre direto a conversa');
    assert.match(r2.copiado, /Clínica Sol/);
    // voltar para o app depois de 4 s registra sozinho
    await a.pagina.waitForTimeout(4200);
    await a.pagina.evaluate(() => window.dispatchEvent(new Event('focus')));
    await a.pagina.waitForTimeout(400);
    assert.match(await a.pagina.textContent('.ig-modal'), /2 de 2/);
    assert.match(await a.pagina.textContent('.ig-modal .ig-feito'), /Clínica Sol registrado ao voltar/);
    const r3 = await a.pagina.evaluate(() => ({
      reg: (_db.abordagens_instagram || []).map(x => x.chave),
      card: pkLeads.find(k => k.name === 'Clínica Sol'),
      hoje: _igHoje,
    }));
    assert.deepStrictEqual(r3.reg, ['clinicasol']);
    assert.strictEqual(r3.card.col, 'contatado');
    assert.strictEqual(r3.card.canal, 'instagram');
    assert.ok(r3.card.proximaAcaoEm > Date.now(), 'lembrete para conferir a resposta');
    assert.strictEqual(r3.hoje, 1);
    // desfazer volta tudo e reabre a Clínica Sol
    await a.pagina.click('.ig-modal .ig-feito button:has-text("desfazer")');
    await a.pagina.waitForTimeout(300);
    const r3b = await a.pagina.evaluate(() => ({ reg: (_db.abordagens_instagram || []).length, card: pkLeads.some(k => k.name === 'Clínica Sol'), hoje: _igHoje, txt: document.querySelector('.ig-modal').innerText }));
    assert.strictEqual(r3b.reg, 0); assert.strictEqual(r3b.card, false); assert.strictEqual(r3b.hoje, 0);
    assert.match(r3b.txt, /1 de 2/);
    // agora pelo botão "Mandei"
    await a.pagina.waitForSelector('.ig-modal .ig-texto:not([disabled])');
    await a.pagina.click('.ig-modal button:has-text("Copiar e abrir conversa")');
    await a.pagina.waitForSelector('.ig-modal button:has-text("Mandei")');
    await a.pagina.click('.ig-modal button:has-text("Mandei")');
    await a.pagina.waitForTimeout(400);
    assert.match(await a.pagina.textContent('.ig-modal'), /2 de 2/);
    // Pular o segundo fecha a fila sem registrar
    await a.pagina.click('.ig-modal button:has-text("Pular")');
    assert.match(await a.pagina.textContent('.ig-modal'), /concluída/);
    await a.pagina.click('.ig-modal button:has-text("Fechar")');
    const r4 = await a.pagina.evaluate(() => ({ fila: igFila().length, feito: document.querySelectorAll('#tabela .tag-igdm.feito').length }));
    assert.strictEqual(r4.fila, 1, 'quem já foi abordado sai da fila');
    assert.strictEqual(r4.feito, 1, 'linha mostra que já foi abordado');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn: acha quem decide, IA escreve convite e mensagem, registra com a mensagem nas notas', async () => {
  const a = await abrirApp({ largura: 1280, rotas: [[/\/ia$/, () => ({ texto: 'CONVITE: Olá! Acompanho empresas de contabilidade em Campinas e gostaria de conectar.\nMENSAGEM: Obrigado por aceitar! Ajudo escritórios a ganhar clientes pelo WhatsApp. Faz sentido conversarmos 10 minutos?' })]] });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' };
      window._abertos = []; window.open = (u) => { window._abertos.push(u); return null; };
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`));
      const leads = [{ title: 'Contábil Alfa', category: 'Contabilidade', phone: '1133334444', linkedin: 'https://br.linkedin.com/company/contabil-alfa?trk=x' }, { title: 'Beta', phone: '11977776666' }];
      todosLeads = leads; _leadsBase = leads.slice(); _liFeitos = new Set(); _liHoje = 0;
      renderPagina(1); atualizarAcoesBusca();
      return { botoes: document.querySelectorAll('#tabela .tag-lidm').length, colorido: document.querySelectorAll('#tabela .tag-in').length, fila: document.getElementById('ps-btn-li').textContent };
    });
    assert.strictEqual(r.botoes, 1); assert.strictEqual(r.colorido, 0); assert.match(r.fila, /Abordar no LinkedIn \(1\)/);
    await a.pagina.evaluate(() => liAbrirFila());
    await a.pagina.waitForSelector('.li-modal textarea:not([disabled])');
    const tx = await a.pagina.$$eval('.li-modal textarea', t => t.map(x => x.value));
    assert.match(tx[0], /^Olá! Acompanho/); assert.match(tx[1], /Obrigado por aceitar/);
    await a.pagina.click('.li-modal button:has-text("Ver sócios e donos")');
    const ab = await a.pagina.evaluate(() => window._abertos[0]);
    assert.strictEqual(ab, 'https://www.linkedin.com/company/contabil-alfa/people/', 'aba Pessoas da empresa, sem termos que zeram a busca');
    await a.pagina.fill('.li-modal .li-perfil', 'https://br.linkedin.com/in/joao-alfa?utm=x');
    await a.pagina.click('.li-modal button:has-text("Mandei o convite")');
    await a.pagina.waitForTimeout(400);
    const r2 = await a.pagina.evaluate(() => ({ reg: (_db.abordagens_linkedin || []).map(x => x.chave), card: pkLeads.find(k => k.name === 'Contábil Alfa') }));
    assert.deepStrictEqual(r2.reg, ['https://www.linkedin.com/company/contabil-alfa/']);
    assert.strictEqual(r2.card.canal, 'linkedin'); assert.strictEqual(r2.card.col, 'contatado');
    assert.match(r2.card.liMensagem, /Obrigado por aceitar/);
    assert.strictEqual(r2.card.liPerfil, 'https://www.linkedin.com/in/joao-alfa/');
    // no Pipeline: um toque copia a mensagem e abre o perfil da pessoa
    const r3 = await a.pagina.evaluate(async () => {
      let copiado = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copiado = t; } }, configurable: true });
      window._abertos = [];
      trocarAba('pipeline', document.querySelector(`.nav-item[onclick*="'pipeline'"]`));
      await new Promise(r => setTimeout(r, 300));
      const bt = [...document.querySelectorAll('.pk-card')].find(c => c.textContent.includes('Contábil Alfa')).querySelector('[data-acao="li"]');
      bt.click(); await new Promise(r => setTimeout(r, 300));
      return { copiado, abertos: window._abertos };
    });
    assert.match(r3.copiado, /Obrigado por aceitar/);
    assert.deepStrictEqual(r3.abertos, ['https://www.linkedin.com/in/joao-alfa/']);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('redes pelo Google e quem decide: completa o que faltou, sugere o dono no LinkedIn e mostra no detalhe', async () => {
  const pedidosGoogle = [];
  const a = await abrirApp({ largura: 1280, rotas: [
    [/\/ia$/, (j) => ({ texto: 'CONVITE: Olá! Gostaria de conectar.\nMENSAGEM: Obrigado por aceitar! Posso te mostrar em 10 minutos?' })],
    [/\/leads\/redes-google$/, (j) => {
      pedidosGoogle.push(j);
      const r = {};
      j.leads.forEach(x => {
        if (x.faltam.includes('decisor')) r[x.id] = { decisores: [{ nome: 'Paula Reis', cargo: 'Sócia', linkedin: 'https://br.linkedin.com/in/paula-reis', fonte: 'google' }] };
        else if (x.nome === 'Pet Feliz') r[x.id] = { instagram: 'https://www.instagram.com/petfeliz/', linkedin: 'https://www.linkedin.com/company/pet-feliz/' };
        else r[x.id] = {};
      });
      return { resultados: r, uso_hoje: 3 };
    }],
  ] });
  try {
    // 1) depois das redes do site, o que faltou vai para o Google (uma vez por lead)
    const r1 = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' };
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`));
      const leads = [
        { title: 'Pet Feliz', category: 'Pet shop', phone: '11977776666', address: 'R. A, 1 - Centro, Campinas - SP, 13000-000' },
        { title: 'Contábil Alfa', category: 'Contabilidade', phone: '1133334444', instagram: 'https://www.instagram.com/alfa/', linkedin: 'https://www.linkedin.com/company/alfa/',
          emails: ['contato@alfa.com.br'], decisores: [{ nome: 'João Silva', cargo: 'Sócio-fundador', linkedin: 'https://www.linkedin.com/in/joao-silva/', fonte: 'site' }] },
      ];
      todosLeads = leads; _leadsBase = leads.slice(); _liFeitos = new Set(); _liHoje = 0;
      renderPagina(1);
      await completarRedesPeloGoogle(_leadsBase);
      await completarRedesPeloGoogle(_leadsBase);   // segunda vez não busca de novo
      return { pet: _leadsBase[0] };
    });
    assert.strictEqual(pedidosGoogle.length, 1, 'uma busca só; quem já tem tudo nem entra');
    assert.deepStrictEqual(pedidosGoogle[0].leads, [{ id: '0', nome: 'Pet Feliz', cidade: 'Campinas', telefone: '11977776666', site: '', faltam: ['instagram', 'linkedin'] }]);
    assert.strictEqual(r1.pet.instagram, 'https://www.instagram.com/petfeliz/');
    assert.strictEqual(r1.pet.linkedin, 'https://www.linkedin.com/company/pet-feliz/');
    assert.strictEqual(r1.pet.googleOk, true);

    // 1b) a API vence o Serper: o que ela já tinha nunca é trocado; o que o Serper pôs, a API corrige depois
    const r1b = await a.pagina.evaluate(() => {
      const alfa = { ..._leadsBase[1] }, pet = _leadsBase[0];
      const n1 = juntarDaApi(alfa, { instagram: 'https://www.instagram.com/outro/', decisores: [{ nome: 'Fulano Tal', cargo: 'CEO', fonte: 'site' }] });
      const n2 = juntarDaApi(pet, { instagram: 'https://www.instagram.com/petfelizoficial/', linkedin: 'https://www.linkedin.com/company/pet-feliz/' });
      const n3 = juntarDaApi(pet, { instagram: 'https://www.instagram.com/petfelizoficial/' });
      return { n1, alfaIg: alfa.instagram, alfaDec: alfa.decisores[0].nome, n2, petIg: pet.instagram, petGoogle: pet.doGoogle || null, n3 };
    });
    assert.strictEqual(r1b.n1, 0, 'nada da API muda o que a API já tinha');
    assert.strictEqual(r1b.alfaIg, 'https://www.instagram.com/alfa/'); assert.strictEqual(r1b.alfaDec, 'João Silva');
    assert.strictEqual(r1b.n2, 1, 'Instagram do Serper trocado pelo da API; LinkedIn igual não conta');
    assert.strictEqual(r1b.petIg, 'https://www.instagram.com/petfelizoficial/');
    assert.deepStrictEqual(r1b.petGoogle, { linkedin: true }, 'só o LinkedIn segue marcado como do Serper');
    assert.strictEqual(r1b.n3, 0, 'repetir não muda nada');

    // 2) decisor do site já vem preenchido na janela do LinkedIn e a IA usa o nome
    await a.pagina.evaluate(() => liAbordar([_leadsBase[1]]));
    await a.pagina.waitForSelector('.li-modal textarea:not([disabled])');
    assert.strictEqual(await a.pagina.inputValue('.li-modal .li-pessoa'), 'João Silva');
    assert.strictEqual(await a.pagina.inputValue('.li-modal .li-perfil'), 'https://www.linkedin.com/in/joao-silva/');
    assert.match(await a.pagina.textContent('.li-modal .li-sug'), /Provável decisor:.*João Silva · Sócio-fundador/);
    const ia = a.pedidos.filter(p => /\/ia$/.test(p.caminho)).pop();
    assert.match(JSON.stringify(ia.corpo), /PESSOA: João Silva/);
    await a.pagina.click('.li-modal button:has-text("Cancelar")');

    // 3) sem decisor: procura no Google ao abrir e um toque preenche nome e perfil
    await a.pagina.evaluate(() => liAbordar([_leadsBase[0]]));
    await a.pagina.waitForSelector('.li-modal .li-sug-p');
    assert.strictEqual(await a.pagina.inputValue('.li-modal .li-pessoa'), '', 'do Google não preenche sozinho');
    await a.pagina.click('.li-modal .li-sug-p');
    assert.strictEqual(await a.pagina.inputValue('.li-modal .li-pessoa'), 'Paula Reis');
    assert.strictEqual(await a.pagina.inputValue('.li-modal .li-perfil'), 'https://www.linkedin.com/in/paula-reis/');
    assert.deepStrictEqual(pedidosGoogle[1].leads[0].faltam, ['decisor']);
    await a.pagina.click('.li-modal button:has-text("Cancelar")');

    // 4) no detalhe do lead: quem decide e e-mail
    const html = await a.pagina.evaluate(() => blocoContatosExtras(_leadsBase[1]));
    assert.match(html, /Quem decide/); assert.match(html, /joao-silva/); assert.match(html, /mailto:contato@alfa\.com\.br/);
    assert.strictEqual(await a.pagina.evaluate(() => blocoContatosExtras({ emails: ['x"><img src=x>@a.com'] })), '', 'e-mail estranho não entra');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('consultor do dia: escolhe pelo interesse (não por qualquer resposta), sugere cidade nova e manda parar o que não funciona', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      const leads = [], pipeline = [], campanhas = [
        { id: 'c1', nicho: 'Contabilidade', local: 'Guarulhos' }, { id: 'c2', nicho: 'Contabilidade', local: 'Campinas, SP' },
        { id: 'c3', nicho: 'Facilities', local: 'Guarulhos' }, { id: 'c4', nicho: 'Suporte de TI', local: 'Osasco' }, { id: 'c5', nicho: 'PetShop', local: 'Barueri' }];
      let n = 0;
      const lote = (cid, qtd, respondem, mornos, quentes, descartam) => {
        for (let i = 0; i < qtd; i++) {
          const phone = '55119' + String(10000000 + n++);
          leads.push({ campanha_id: cid, phone, enviado_em: new Date().toISOString(), respondeu: i < respondem, resposta_suspeita_bot: false, opt_out: false });
          if (i < quentes) pipeline.push({ phone, col: 'negociando', ultima_classificacao: 'quente', moved_at: new Date().toISOString() });
          else if (i < quentes + mornos) pipeline.push({ phone, col: 'respondeu', ultima_classificacao: 'morno', moved_at: new Date(Date.now() - 5 * 86400000).toISOString() });
          else if (i < quentes + mornos + descartam) pipeline.push({ phone, col: 'descartado', ultima_classificacao: 'frio', moved_at: new Date().toISOString() });
        }
      };
      lote('c1', 60, 16, 12, 1, 2);   // contabilidade Guarulhos: 22% interessados
      lote('c2', 40, 14, 2, 0, 12);   // Campinas: responde muito, mas quase tudo "não"
      lote('c3', 25, 9, 8, 1, 0);     // facilities: 36% interessados
      lote('c4', 30, 1, 0, 0, 0);     // suporte de TI: ninguém se interessa
      lote('c5', 30, 12, 2, 0, 12);   // petshop: responde, mas 40% descartam
      const d = { leads, campanhas, interesses: [], pipeline, followups: [{ phone: '1' }, { phone: '2' }] };
      const an = consAnalisar(d);
      consDesenhar(d);
      return { principal: an.principal.nome, cidade: an.cidadePrincipal.nome, teste: an.teste && an.teste.nome, evitar: an.evitar.map(g => g.nome), txt: document.getElementById('cons-dia').innerText, oculto: document.getElementById('cons-dia').hidden };
    });
    assert.strictEqual(r.principal, 'Facilities');
    assert.strictEqual(r.cidade, '', 'Osasco (ninguém se interessa), Campinas e Barueri (muitos dizem não) ficam de fora');
    assert.strictEqual(r.teste, 'Contabilidade', 'segunda opção acima da média');
    assert.deepStrictEqual(r.evitar.sort(), ['PetShop', 'Suporte de TI']);
    assert.strictEqual(r.oculto, false);
    assert.match(r.txt, /2 follow-ups prontos/);
    assert.match(r.txt, /Campanha nova: Facilities · uns 30 leads/);
    assert.match(r.txt, /cidade nova parecida com Guarulhos/);
    assert.match(r.txt, /Pare de prospectar/);
    // botão leva para a Prospecção com nicho e cidade preenchidos (o Consultor mora no Plano de Prospecção)
    await a.pagina.evaluate(() => { document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.getElementById('tab-plano').classList.add('active'); });
    await a.pagina.click('#cons-dia button:has-text("Buscar Facilities")');
    assert.strictEqual(await a.pagina.inputValue('#nicho'), 'Facilities');
    assert.strictEqual(await a.pagina.inputValue('#local'), '', 'cidade fica para a pessoa escolher');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('abas Prospecção Instagram e LinkedIn: menu com os 3 canais, fila da busca na tela + buscas salvas, começar e registrar', async () => {
  const db = {
    buscas: [{ user_id: 'u1', id: 111, nicho: 'Contabilidade', local: 'Guarulhos', criado_em: new Date().toISOString(), leads: [
      { title: 'Contábil Beta', phone: '', instagram: 'https://www.instagram.com/contabilbeta/', linkedin: 'https://www.linkedin.com/company/contabil-beta/', decisores: [{ nome: 'Ana Reis', cargo: 'Sócia', linkedin: 'https://www.linkedin.com/in/ana-reis/' }] },
      { title: 'Pet Já Abordado', phone: '11911112222', instagram: 'https://www.instagram.com/petja/' },
    ] }],
    abordagens_instagram: [{ user_id: 'u1', chave: 'petja', nome: 'Pet Já Abordado', instagram: 'https://www.instagram.com/petja/', criado_em: new Date(Date.now() - 86400000).toISOString() }],
  };
  const a = await abrirApp({ db, largura: 1280, rotas: [[/\/ia$/, () => ({ texto: 'Oi! Vi o perfil de vocês. Posso mostrar uma ideia rápida?' })]] });
  try {
    const menu = await a.pagina.$$eval('.nav-item', bs => bs.map(b => b.textContent.trim()));
    assert.ok(menu.includes('Prospecção WhatsApp') && menu.includes('Prospecção Instagram') && menu.includes('Prospecção LinkedIn'), menu.join(' | '));
    assert.ok(!menu.includes('Prospecção IA'));
    await a.pagina.evaluate(() => {
      config.uazapi = { url: 'https://srv.test', token: 't' };
      window.open = () => null;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
      _leadsBase = [{ title: 'Clínica Sol', phone: '1133334444', is_whatsapp: false, instagram: 'https://www.instagram.com/clinicasol/' },
                    { title: 'Contábil Beta', phone: '', instagram: 'https://www.instagram.com/contabilbeta/' }];   // repetida na busca salva
      todosLeads = _leadsBase.slice();
    });
    // o menu vem recolhido: toca em "Conecte" e os canais aparecem
    assert.strictEqual(await a.pagina.isVisible('.nav-item:has-text("Prospecção Instagram")'), false);
    await a.pagina.click('.nav-trilha:has-text("Conecte")');
    assert.strictEqual(await a.pagina.getAttribute('.nav-trilha:has-text("Conecte")', 'aria-expanded'), 'true');
    await a.pagina.click('.nav-item:has-text("Prospecção Instagram")');
    await a.pagina.click('#canal-insta .canal-sub[data-sub="fila"]');
    await a.pagina.waitForSelector('#canal-insta .canal-lista');
    const ig = await a.pagina.evaluate(() => ({
      titulo: document.getElementById('page-title').textContent,
      nomes: [...document.querySelectorAll('#canal-insta .canal-grade > .ph-card .cl-nome')].map(x => x.textContent),
      fila: document.querySelector('#canal-insta .canal-num:nth-child(2) b').textContent,
      feitos: [...document.querySelectorAll('#canal-insta .canal-lista')].pop().textContent,
    }));
    assert.strictEqual(ig.titulo, 'Prospecção Instagram');
    assert.deepStrictEqual(ig.nomes.sort(), ['Clínica Sol', 'Contábil Beta'], 'sem repetir e sem quem já foi abordado');
    assert.strictEqual(ig.fila, '2');
    assert.match(ig.feitos, /Pet Já Abordado/);
    // começar a fila: abre a janela de abordagem e, ao registrar, a aba se atualiza
    await a.pagina.click('#canal-insta button:has-text("Começar a abordar")');
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    await a.pagina.click('.ig-modal button:has-text("Não deu")').catch(() => {});
    await a.pagina.evaluate(() => document.querySelector('.modal-backdrop.active')?.remove());
    // LinkedIn: só quem tem LinkedIn, com o decisor achado
    await a.pagina.click('.nav-item:has-text("Prospecção LinkedIn")');
    await a.pagina.click('#canal-linkedin .canal-sub[data-sub="fila"]');
    await a.pagina.waitForSelector('#canal-linkedin .canal-lista');
    const li = await a.pagina.evaluate(() => [...document.querySelectorAll('#canal-linkedin .canal-grade > .ph-card li')].map(x => x.textContent));
    assert.strictEqual(li.length, 1);
    assert.match(li[0], /Contábil Beta.*Ana Reis.*decisor achado/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('voltar uma abordagem (abriu e não mandou): sai do registro, volta para a fila e o Pipeline fica como estava', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      window.confirm = () => true;
      pkLeads = [{ id: 7, name: 'Escritório Alfa', col: 'novo', movedAt: 1, nota: '' }]; pkSave();
      const alfa = { title: 'Escritório Alfa', instagram: 'https://www.instagram.com/alfa/' };
      const nova = { title: 'Clínica Nova', instagram: 'https://www.instagram.com/clinicanova/', linkedin: 'https://www.linkedin.com/company/clinica-nova/' };
      _leadsBase = [alfa, nova]; todosLeads = _leadsBase.slice();
      await igCarregarFeitos(true); await liCarregarFeitos(true);
      await igRegistrar(alfa); await igRegistrar(nova); await liRegistrar(nova, 'Ana', 'Oi', '');
      const depois = { alfa: pkLeads.find(k => k.id === 7).col, cards: pkLeads.length, hoje: _igHoje };
      await canalVoltar('insta', { chave: 'alfa', nome: 'Escritório Alfa', criado_em: new Date().toISOString() });
      await canalVoltar('insta', { chave: 'clinicanova', nome: 'Clínica Nova', criado_em: new Date().toISOString() });
      const igFim = { alfa: pkLeads.find(k => k.id === 7), nova: pkLeads.find(k => k.name === 'Clínica Nova'), reg: (_db.abordagens_instagram || []).length, hoje: _igHoje, fila: igFila().map(l => l.title) };
      await canalVoltar('linkedin', { chave: liChave(nova), nome: 'Clínica Nova', criado_em: new Date().toISOString() });
      return { depois, igFim, liReg: (_db.abordagens_linkedin || []).length, cardsFim: pkLeads.map(k => k.name), liFila: liFila().map(l => l.title) };
    });
    assert.deepStrictEqual(r.depois, { alfa: 'contatado', cards: 2, hoje: 2 });
    assert.strictEqual(r.igFim.alfa.col, 'novo', 'card que já existia volta para a etapa de antes');
    assert.ok(!r.igFim.alfa.proximaAcaoEm, 'sem o lembrete da abordagem');
    assert.strictEqual(r.igFim.reg, 0); assert.strictEqual(r.igFim.hoje, 0);
    assert.deepStrictEqual(r.igFim.fila.sort(), ['Clínica Nova', 'Escritório Alfa']);
    assert.strictEqual(r.liReg, 0);
    assert.deepStrictEqual(r.cardsFim, ['Escritório Alfa'], 'card criado só pelas abordagens sai do Pipeline');
    assert.deepStrictEqual(r.liFila, ['Clínica Nova']);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Instagram/LinkedIn: marcar Respondeu/Sem interesse move o Pipeline; Retomar hoje aparece em 3 dias com o 2º contato da IA', async () => {
  const quatroDias = new Date(Date.now() - 4 * 86400000).toISOString();
  const db = { abordagens_instagram: [
    { user_id: 'u1', chave: 'alfa', nome: 'Escritório Alfa', instagram: 'https://www.instagram.com/alfa/', criado_em: new Date().toISOString() },
    { user_id: 'u1', chave: 'beta', nome: 'Contábil Beta', instagram: 'https://www.instagram.com/beta/', criado_em: new Date().toISOString() },
    { user_id: 'u1', chave: 'sol', nome: 'Clínica Sol', instagram: 'https://www.instagram.com/sol/', bio: 'Estética facial em Campinas', criado_em: quatroDias },
  ] };
  const a = await abrirApp({ db, largura: 1280, rotas: [[/\/ia$/, (j) => ({ texto: /SEGUNDO contato/.test(JSON.stringify(j)) ? 'Muitas clínicas lotam a agenda com isso. Quer ver um exemplo?' : 'x' })]] });
  try {
    await a.pagina.evaluate(() => {
      config.uazapi = { url: 'https://srv.test', token: 't' }; window.open = () => null;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
      pkLeads = [{ id: 1, name: 'Escritório Alfa', col: 'contatado', canal: 'instagram', movedAt: 1, proximaAcaoEm: Date.now(), proximaAcaoTxt: 'Ver se respondeu' },
                 { id: 2, name: 'Contábil Beta', col: 'contatado', canal: 'instagram', movedAt: 1 }]; pkSave();
      trocarAba('insta', document.querySelector(`.nav-item[onclick*="'insta'"]`));
    });
    await a.pagina.waitForSelector('#canal-insta .canal-retomar');
    assert.match(await a.pagina.textContent('#canal-insta .canal-retomar'), /Retomar hoje \(1\).*Clínica Sol/s);
    await a.pagina.click('#canal-insta .canal-sub[data-sub="fila"]');
    // 1) marcar resultado
    await a.pagina.click('#canal-insta li:has-text("Escritório Alfa") .cl-res.sim');
    await a.pagina.click('.li-resp-modal .li-resp-so');
    await a.pagina.waitForTimeout(300);
    await a.pagina.click('#canal-insta li:has-text("Contábil Beta") .cl-res.nao');
    await a.pagina.waitForTimeout(400);
    const r1 = await a.pagina.evaluate(() => ({ db: _db.abordagens_instagram.map(r => [r.chave, r.resultado || null]), pk: pkLeads.map(k => [k.name, k.col, k.motivoPerda || null, k.proximaAcaoEm || null]),
      selos: [...document.querySelectorAll('#canal-insta .cl-selo')].map(x => x.textContent), topo: document.querySelector('#canal-insta .canal-num:nth-child(4) b').textContent }));
    assert.deepStrictEqual(r1.db, [['alfa', 'respondeu'], ['beta', 'sem_interesse'], ['sol', null]]);
    assert.deepStrictEqual(r1.pk, [['Escritório Alfa', 'respondeu', null, null], ['Contábil Beta', 'descartado', 'sem_interesse', null]]);
    assert.ok(r1.selos.includes('respondeu') && r1.selos.includes('sem interesse'));
    assert.strictEqual(r1.topo, '1');
    // 2) retomar: a IA escreve o 2º contato usando a bio; "Mandei" tira da lista
    await a.pagina.click('#canal-insta .canal-sub[data-sub="hoje"]');
    await a.pagina.click('#canal-insta .canal-retomar button:has-text("Retomar")');
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    assert.match(await a.pagina.inputValue('.ig-modal textarea'), /Quer ver um exemplo/);
    const ia = a.pedidos.filter(p => /\/ia$/.test(p.caminho)).pop();
    assert.match(JSON.stringify(ia.corpo), /Estética facial em Campinas/);
    await a.pagina.click('.ig-modal button:has-text("Mandei")');
    await a.pagina.waitForTimeout(500);
    const r2 = await a.pagina.evaluate(() => ({ ret: !!_db.abordagens_instagram.find(r => r.chave === 'sol').retomado_em, secao: !!document.querySelector('#canal-insta .canal-retomar') }));
    assert.deepStrictEqual(r2, { ret: true, secao: false });
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('score: LinkedIn vale mais quando o produto é para quem usa LinkedIn; DM do Instagram usa a bio', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      const l = { title: 'Contábil Alfa', phone: '11999990000', linkedin: 'https://www.linkedin.com/company/alfa/' };
      _produtos = [{ id: 'p1', nome: 'Site', instrucoes: 'Vendo sites', padrao: true }];
      const sem = calcScore(l);
      _produtos = [{ id: 'p2', nome: 'Kaizen Connect', instrucoes: 'Automatiza a prospecção no LinkedIn', padrao: true }];
      const com = calcScore(l), semLi = calcScore({ ...l, linkedin: '' }), comDecisor = calcScore({ ...l, decisores: [{ nome: 'Ana' }] });
      const p1 = igPrompt({ title: 'Pet Feliz', instagram: 'https://www.instagram.com/pf/', instagramBio: 'Banho e tosa em Campinas' }, null);
      const p2 = igPrompt({ title: 'Pet Feliz' }, null);
      return { dif: com - sem, semLi: semLi - calcScore({ ...l, linkedin: '' }), decisor: comDecisor - com, extra: blocoContatosExtras(l), p1, p2 };
    });
    assert.strictEqual(r.dif, 12); assert.strictEqual(r.decisor, 3);
    assert.match(r.extra, /\+12 no score/);
    assert.match(r.p1, /Bio do Instagram deles: "Banho e tosa em Campinas"/); assert.match(r.p1, /detalhe real da BIO/);
    assert.ok(!/Bio do Instagram/.test(r.p2));
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('consultor: passo de Instagram/LinkedIn com fila e retomar, e comparação por canal', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const txt = await a.pagina.evaluate(() => {
      const velho = new Date(Date.now() - 5 * 86400000).toISOString();
      const ab = n => Array.from({ length: n }, (_, i) => ({ chave: 'k' + i, criado_em: velho, resultado: i < 2 ? 'respondeu' : null, retomado_em: i < 4 ? velho : null }));
      consDesenhar({ leads: [], campanhas: [], interesses: [], pipeline: [], followups: [],
        canais: { insta: { fila: 30, semZap: 9, ab: ab(10), retomar: 6 }, linkedin: { fila: 4, decisor: 2, ab: ab(2), retomar: 0 } } });
      return document.getElementById('cons-dia').innerText;
    });
    assert.match(txt, /6 para retomar no Instagram · 20 DMs novas no Instagram \(9 na fila sem WhatsApp\) · 4 convites no LinkedIn \(2 com o decisor achado\)/);
    assert.match(txt, /Comece pelos 2º contatos/);
    assert.match(txt, /Instagram: 20% responderam \(10 abordados\)/);
    assert.match(txt, /LinkedIn: 2 abordados/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('busca principal reiniciando: o app insiste antes de ir para a reserva; atalhos de nicho seguem o Consultor', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      let n = 0, avisos = 0;
      _apiOficial = async () => { if (++n === 1) { const e = new Error('HTTP 502'); e.status = 502; throw e; } return { ok: true }; };
      const ok = await _apiOficialInsistente('/leads/buscas', {}, () => avisos++);
      let m = 0, erro = '';
      _apiOficial = async () => { m++; const e = new Error('faça login'); e.status = 401; throw e; };
      try { await _apiOficialInsistente('/leads/buscas', {}); } catch (e) { erro = e.message; }
      _statsNicho = [{ nome: 'PetShop', env: 39, hum: 8, pare: 12, evitar: true }, { nome: 'Facilities', env: 27, hum: 10, pare: 0 }, { nome: 'Agência', env: 61, hum: 7, pare: 2 }];
      pintarSugestoesNicho();
      const atalhos = document.getElementById('prosp-sugestoes').textContent;
      document.getElementById('nicho').value = 'petshop'; avisarNichoFraco();
      return { ok: ok.ok, n, avisos, m, erro, atalhos, aviso: document.getElementById('nicho-aviso').textContent };
    });
    assert.deepStrictEqual([r.ok, r.n, r.avisos], [true, 2, 1], 'tentou de novo depois do 502');
    assert.deepStrictEqual([r.m, r.erro], [1, 'faça login'], 'erro de login não fica tentando');
    assert.match(r.atalhos, /Mais geram interessados:Facilities.*Agência/);
    assert.ok(!/PetShop/.test(r.atalhos), 'nicho que o Consultor manda parar não vira atalho');
    assert.match(r.aviso, /O Consultor do dia recomenda parar este nicho/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('chave "Buscar em 9 regiões" fica à vista antes da busca e manda a busca em grade', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    await a.pagina.evaluate(() => trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)));
    assert.ok(await a.pagina.isVisible('#ps-grade'));
    await a.pagina.click('#ps-grade');
    const r = await a.pagina.evaluate(async () => {
      const antes = { chk: document.getElementById('ps-grade').getAttribute('aria-checked'), lbl: document.querySelector('#btn .btn-label').textContent };
      window._grades = [];
      buscarViaApiOficial = async (n, l, m, g) => { window._grades.push(g); return [{ title: 'Empresa X', phone: '11999990000' }]; };
      document.getElementById('nicho').value = 'Facilities'; document.getElementById('local').value = 'São Paulo';
      await buscar();
      const depois = { chk: document.getElementById('ps-grade').getAttribute('aria-checked'), lbl: document.querySelector('#btn .btn-label').textContent };
      await buscar();
      return { antes, depois, grades: window._grades };
    });
    assert.deepStrictEqual(r.antes, { chk: 'true', lbl: 'Buscar Leads em 9 regiões' });
    assert.deepStrictEqual(r.depois, { chk: 'false', lbl: 'Buscar Leads' }, 'desliga depois de usar');
    assert.deepStrictEqual(r.grades, [true, false]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Painel começa pela campanha ao vivo; o Plano abre pelas Pendências e logo depois o Consultor', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const painel = [...document.getElementById('tab-metricas').children].map(e => e.id).filter(Boolean);
      trocarAba('plano', document.querySelector(`.nav-item[onclick*="'plano'"]`));
      await new Promise(r => setTimeout(r, 1500));
      const plano = document.querySelector('#tab-plano > div').firstElementChild;
      const data = document.getElementById('mc-filtro-data-inicio').getBoundingClientRect();
      return { painel: painel.slice(0, 2), naPlano: plano && plano.id, segundo: plano && plano.nextElementSibling && plano.nextElementSibling.id, visivel: !document.getElementById('cons-dia').hidden, txt: document.getElementById('cons-dia').innerText, noPainel: !!document.querySelector('#tab-metricas #cons-dia'), dataMin: getComputedStyle(document.getElementById('mc-filtro-data-inicio')).minHeight };
    });
    assert.deepStrictEqual(r.painel, ['painel-saudacao', 'painel-aovivo']);
    assert.strictEqual(r.noPainel, false);
    assert.strictEqual(r.naPlano, 'pend-card'); assert.strictEqual(r.segundo, 'cons-dia');
    assert.ok(r.visivel); assert.match(r.txt, /Seu plano de hoje/);
    assert.strictEqual(r.dataMin, '34px');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('menu em etapas: recolhidas, abrem no toque, a etapa da tela atual abre sozinha e o contador de Respostas aparece na etapa', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      const abertas = () => [...document.querySelectorAll('.nav-grupo')].filter(g => !g.hidden).map(g => g.id);
      const inicio = abertas();
      trocarAba('pipeline', document.querySelector(`.nav-item[onclick*="'pipeline'"]`));
      const depoisPipeline = abertas();
      navGrupo(3);   // fecha de novo
      _filaSugestoesCache = [{ id: 1, phone: '11999990000', classificacao: 'quente' }]; _filaFollowupsCache = [{ id: 2 }];
      atualizarBadgeRespostas();
      const b = document.getElementById('nt-respostas-badge');
      return { inicio, depoisPipeline, fechada: abertas(), badge: b.hidden ? null : b.textContent, lembra: JSON.parse(localStorage.getItem('nav_abertos')) };
    });
    assert.deepStrictEqual(r.inicio, []);
    assert.deepStrictEqual(r.depoisPipeline, ['ng-3'], 'abriu Converta porque o Pipeline está lá');
    assert.deepStrictEqual(r.fechada, []);
    assert.strictEqual(r.badge, '2', 'o número de Respostas aparece em Converta mesmo recolhida');
    assert.deepStrictEqual(r.lembra, []);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('completar redes do histórico: site primeiro, Google depois (quem não respondeu no WhatsApp antes), grava nas buscas e nos leads', async () => {
  const db = {
    buscas: [{ user_id: 'u1', id: 11, nicho: 'Contabilidade', local: 'Guarulhos', criado_em: new Date().toISOString(), leads: [
      { title: 'Contábil Alfa', phone: '1133330001', website: 'https://alfa.com.br', address: 'R. A, 1 - Centro, Guarulhos - SP' },
      { title: 'Contábil Beta', phone: '1133330002', address: 'R. B, 2 - Centro, Guarulhos - SP' },
      { title: 'Já Tem', phone: '1133330003', instagram: 'https://www.instagram.com/jatem/', linkedin: 'https://www.linkedin.com/company/jatem/' } ] }],
    leads: [{ id: 'L1', user_id: 'u1', campanha_id: 'c1', title: 'Pet Antigo', phone: '5511988887777', address: 'R. C, 3 - Centro, Campinas - SP', enviado_em: '2026-09-20T10:00:00Z', respondeu: false, opt_out: false }],
    campanhas: [{ id: 'c1', user_id: 'u1', nome: 'PetShop · Campinas', local: 'Campinas' }],
  };
  const pedidos = [];
  const a = await abrirApp({ db, largura: 1280, rotas: [
    [/\/enrich$/, (j) => { pedidos.push(['site', j]); return { results: { 'https://alfa.com.br': { instagram: 'https://www.instagram.com/contabilalfa/', linkedin: '', emails: ['oi@alfa.com.br'], pessoas: [{ nome: 'Ana Reis', cargo: 'Sócia' }] } } }; }],
    [/\/leads\/redes-google$/, (j) => { pedidos.push(['google', j]); const r = {}; j.leads.forEach(x => { r[x.id] = x.nome === 'Pet Antigo' ? { instagram: 'https://www.instagram.com/petantigo/' } : {}; }); return { resultados: r }; }],
  ] });
  try {
    await a.pagina.evaluate(() => hrRodar());
    await a.pagina.waitForFunction(() => _hr && !_hr.rodando, null, { timeout: 15000 });
    const r = await a.pagina.evaluate(() => ({ hr: { ig: _hr.achIg, li: _hr.achLi, fim: _hr.fim }, busca: _db.buscas[0].leads, lead: _db.leads[0] }));
    assert.strictEqual(pedidos[0][0], 'site');
    assert.deepStrictEqual(pedidos[0][1].sites, [{ site: 'https://alfa.com.br', nome: 'Contábil Alfa' }], 'só quem tem site e falta rede; com o nome da empresa');
    assert.strictEqual(pedidos[1][0], 'google');
    assert.strictEqual(pedidos[1][1].leads[0].nome, 'Pet Antigo', 'quem não respondeu no WhatsApp vai primeiro no Google');
    assert.ok(!pedidos[1][1].leads.some(x => x.nome === 'Já Tem'), 'quem já tem as duas redes não gasta busca');
    assert.strictEqual(r.busca[0].instagram, 'https://www.instagram.com/contabilalfa/');
    assert.deepStrictEqual(r.busca[0].emails, ['oi@alfa.com.br']);
    assert.strictEqual(r.busca[0].decisores[0].nome, 'Ana Reis');
    assert.ok(r.busca[0].redesSite && r.busca[0].googleOk);
    assert.strictEqual(r.lead.instagram, 'https://www.instagram.com/petantigo/');
    assert.ok(r.lead.redes_em, 'lead antigo marcado como conferido (não repete)');
    assert.deepStrictEqual([r.hr.ig, r.hr.li], [2, 0]);
    assert.match(r.hr.fim, /Pronto/);
    // rodar de novo não repete ninguém
    pedidos.length = 0;
    await a.pagina.evaluate(() => hrRodar());
    await a.pagina.waitForFunction(() => _hr && !_hr.rodando, null, { timeout: 15000 });
    assert.ok(!pedidos.some(([t, j]) => t === 'site'), 'site não é lido de novo');
    assert.ok(!pedidos.some(([t, j]) => t === 'google' && j.leads.some(x => x.nome === 'Pet Antigo')), 'Google não repete o lead antigo');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('campanha no Instagram com cadência: nasce de quem não respondeu no WhatsApp, Dia 0 → 3 → 7, tarefas do dia e resultado tiram da cadência', async () => {
  const db = {
    leads: [
      { id: 'L1', user_id: 'u1', campanha_id: 'c1', title: 'Pet Um', phone: '5511988880001', instagram: 'https://www.instagram.com/petum/', enviado_em: '2026-10-10T10:00:00Z', respondeu: false, opt_out: false },
      { id: 'L2', user_id: 'u1', campanha_id: 'c1', title: 'Pet Dois', phone: '5511988880002', instagram: 'https://www.instagram.com/petdois/', enviado_em: '2026-10-10T10:00:00Z', respondeu: false, opt_out: false },
      { id: 'L3', user_id: 'u1', campanha_id: 'c1', title: 'Respondeu', phone: '5511988880003', instagram: 'https://www.instagram.com/resp/', enviado_em: '2026-10-10T10:00:00Z', respondeu: true, opt_out: false },
      { id: 'L4', user_id: 'u1', campanha_id: 'c1', title: 'Sem Insta', phone: '5511988880004', enviado_em: '2026-10-10T10:00:00Z', respondeu: false, opt_out: false } ],
    campanhas: [{ id: 'c1', user_id: 'u1', nome: 'PetShop · São Paulo', local: 'São Paulo' }],
  };
  const a = await abrirApp({ db, largura: 1280, rotas: [[/\/ia$/, (j) => ({ texto: /ÚLTIMA mensagem/.test(JSON.stringify(j)) ? 'Vou parar por aqui. Se fizer sentido, me chama!' : /SEGUNDO contato/.test(JSON.stringify(j)) ? 'Um exemplo rápido: pets atendidos dobraram. Quer ver?' : 'Oi! Te chamei no WhatsApp também. Posso mostrar uma ideia?' })]] });
  try {
    await a.pagina.evaluate(() => { config.uazapi = { url: 'https://srv.test', token: 't' }; window.open = () => null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); window.confirm = () => true; });
    // aba Campanhas → Instagram → nova campanha
    await a.pagina.evaluate(() => trocarAba('campanhas', document.querySelector(`.nav-item[onclick*="'campanhas'"]`)));
    await a.pagina.click('#cc-canais button[data-c="instagram"]');
    await a.pagina.click('#cc-box button:has-text("Nova campanha no Instagram")');
    await a.pagina.waitForSelector('.cc-modal select');
    const opcoes = await a.pagina.$$eval('.cc-modal select option', os => os.map(o => o.textContent));
    assert.match(opcoes[0], /Quem não respondeu no WhatsApp · todas as campanhas \(3\)/);
    assert.match(await a.pagina.textContent('.cc-modal'), /2 empresas entram na campanha\. 1 ainda sem Instagram/);
    assert.strictEqual(await a.pagina.isChecked('.cc-modal .cc-opcao:not(.cc-opcao-avulsas) input'), false, 'citar o WhatsApp vem desligado');
    await a.pagina.check('.cc-modal .cc-opcao:not(.cc-opcao-avulsas) input');
    await a.pagina.click('.cc-modal button:has-text("Criar campanha")');
    await a.pagina.waitForTimeout(600);
    const r1 = await a.pagina.evaluate(() => ({ camp: _db.campanhas_canal[0], leads: _db.campanhas_canal_leads.map(x => [x.chave, x.etapa, x.status, x.lead.mencionarWa]), card: document.querySelector('#cc-box .cc-card').innerText }));
    assert.deepStrictEqual(r1.camp.etapas, [0, 3, 7]);
    assert.deepStrictEqual(r1.leads, [['petum', 0, 'pendente', true], ['petdois', 0, 'pendente', true]]);
    assert.match(r1.card, /2\s*empresas/);
    // aba Prospecção Instagram: tarefas de hoje; a fila livre não repete quem está na campanha
    await a.pagina.evaluate(() => trocarAba('insta', document.querySelector(`.nav-item[onclick*="'insta'"]`)));
    await a.pagina.waitForSelector('#canal-insta .cc-hoje');
    assert.match(await a.pagina.textContent('#canal-insta .cc-hoje'), /Campanhas · hoje \(2\).*Pet Um.*Primeira mensagem/s);
    // Dia 0: primeira DM (com o WhatsApp sem resposta no prompt) → registra e agenda o Dia 3
    await a.pagina.click('#canal-insta .cc-hoje li:has-text("Pet Um") button:has-text("Fazer")');
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    const ia1 = a.pedidos.filter(p => /\/ia$/.test(p.caminho)).pop();
    assert.match(JSON.stringify(ia1.corpo), /WhatsApp há alguns dias e não teve resposta/);
    await a.pagina.evaluate(async () => { const l = { title: 'Pet Um', instagram: 'https://www.instagram.com/petum/' }; await igRegistrar(l); });
    await a.pagina.evaluate(async () => { const it = ccHoje('instagram').find(x => x.r.chave === 'petum'); await ccAvancar(it.r, it.camp); document.querySelector('.modal-backdrop.active')?.remove(); });
    let lp = await a.pagina.evaluate(() => _db.campanhas_canal_leads.find(x => x.chave === 'petum'));
    assert.strictEqual(lp.etapa, 1);
    const diasAte = Math.round((new Date(lp.proxima_em) - Date.now()) / 86400000);
    assert.ok(diasAte >= 2 && diasAte <= 3, 'próxima etapa em 3 dias: ' + diasAte);
    // Dia 3 chegou: Retomar → Mandei → Dia 7
    await a.pagina.evaluate(() => { const x = _db.campanhas_canal_leads.find(x => x.chave === 'petum'); x.proxima_em = new Date(Date.now() - 1000).toISOString(); _cc = null; canalAbrir('insta', true); });
    await a.pagina.waitForTimeout(500);
    await a.pagina.click('#canal-insta .cc-hoje li:has-text("Pet Um") button:has-text("Fazer")');
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    assert.match(await a.pagina.inputValue('.ig-modal textarea'), /Quer ver\?/);
    await a.pagina.click('.ig-modal button:has-text("Mandei")');
    await a.pagina.waitForTimeout(500);
    lp = await a.pagina.evaluate(() => _db.campanhas_canal_leads.find(x => x.chave === 'petum'));
    assert.strictEqual(lp.etapa, 2);
    // Dia 7: Último toque → Mandei → concluído
    await a.pagina.evaluate(() => { const x = _db.campanhas_canal_leads.find(x => x.chave === 'petum'); x.proxima_em = new Date(Date.now() - 1000).toISOString(); _cc = null; canalAbrir('insta', true); });
    await a.pagina.waitForTimeout(500);
    assert.match(await a.pagina.textContent('#canal-insta .cc-hoje'), /Último toque/);
    await a.pagina.click('#canal-insta .cc-hoje li:has-text("Pet Um") button:has-text("Fazer")');
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    assert.match(await a.pagina.inputValue('.ig-modal textarea'), /Vou parar por aqui/);
    await a.pagina.click('.ig-modal button:has-text("Mandei")');
    await a.pagina.waitForTimeout(500);
    lp = await a.pagina.evaluate(() => _db.campanhas_canal_leads.find(x => x.chave === 'petum'));
    assert.strictEqual(lp.status, 'concluido');
    // com a opção desligada, a DM não liga ao WhatsApp
    const p0 = await a.pagina.evaluate(() => igPrompt({ title: 'X', waSemResposta: true, mencionarWa: false }, null));
    assert.ok(!/WhatsApp/.test(p0));
    // resultado marcado na aba tira da cadência
    await a.pagina.evaluate(async () => { await ccMarcarResultado('instagram', 'petdois', 'respondeu'); });
    const pd = await a.pagina.evaluate(() => _db.campanhas_canal_leads.find(x => x.chave === 'petdois').status);
    assert.strictEqual(pd, 'respondeu');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('cadência multicanal: etapa de Instagram vira tarefa em Respostas e conta como feita ao registrar', async () => {
  const db = { fila_followups: [
    { id: 5, user_id: 'u1', phone: '5511999990000', lead_nome: 'Clínica Sol', campanha_id: 'c1', campanha_nome: 'Dentistas', dia_etapa: 6, status: 'pendente', canal: 'instagram', extra: { instagram: 'https://www.instagram.com/clinicasol/' }, mensagem: 'Oi! Te mandei um WhatsApp, vi que vocês usam mais o Instagram. Posso te mostrar em 2 min?', criado_em: new Date().toISOString() },
    { id: 6, user_id: 'u1', phone: '5511988880000', lead_nome: 'Pet Feliz', campanha_id: 'c1', campanha_nome: 'Dentistas', dia_etapa: 3, status: 'pendente', mensagem: 'Oi! Passando para retomar.', criado_em: new Date().toISOString() },
  ] };
  const a = await abrirApp({ db, largura: 1280 });
  try {
    await a.pagina.evaluate(() => trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`)));
    await a.pagina.waitForTimeout(1200);
    await a.pagina.evaluate(() => { window._abertos = []; window.open = (u) => { window._abertos.push(u); return null; }; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); _igFeitos = new Set(); _igHoje = 0; });
    const txt = await a.pagina.textContent('#fila-followups-lista');
    assert.match(txt, /Instagram · você envia/); assert.match(txt, /Abrir no Instagram/); assert.match(txt, /Enviar follow-up/);
    await a.pagina.click('#fila-followups-lista button:has-text("Abrir no Instagram")');
    await a.pagina.waitForSelector('.ig-modal');
    assert.match(await a.pagina.inputValue('.ig-modal .ig-texto'), /vi que vocês usam mais o Instagram/);
    await a.pagina.click('.ig-modal button:has-text("Copiar e abrir conversa")');
    await a.pagina.waitForSelector('.ig-modal button:has-text("Mandei")');
    await a.pagina.click('.ig-modal button:has-text("Mandei")');
    await a.pagina.waitForTimeout(500);
    const r = await a.pagina.evaluate(() => ({ abertos: window._abertos, status: _db.fila_followups.find(x => x.id === 5).status, feitos: (_db.followups_enviados || []).map(f => f.dia_etapa), tela: document.getElementById('fila-followups-lista').textContent }));
    assert.deepStrictEqual(r.abertos, ['https://ig.me/m/clinicasol']);
    assert.strictEqual(r.status, 'enviado'); assert.deepStrictEqual(r.feitos, [6]);
    assert.doesNotMatch(r.tela, /Clínica Sol/); assert.match(r.tela, /Pet Feliz/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('produto do dia: o seletor do topo troca o app inteiro, Pipeline separado e 30 dias entre produtos', async () => {
  const dias = d => new Date(Date.now() - d * 86400000).toISOString();
  const a = await abrirApp({ largura: 1280, db: {
    produtos: [{ id: 'pk', user_id: 'u1', nome: 'Kaizen', instrucoes: 'k', padrao: true, criado_em: '2026-01-01' },
               { id: 'ps', user_id: 'u1', nome: 'Stone', instrucoes: 's', padrao: false, criado_em: '2026-02-01' }],
    campanhas_produto: [{ campanha_id: 'c1', user_id: 'u1', produto_id: 'pk' }, { campanha_id: 'c2', user_id: 'u1', produto_id: 'ps' }],
    leads: [{ id: 'l1', user_id: 'u1', campanha_id: 'c1', phone: '5511911110001', status_envio: 'enviado', enviado_em: dias(10) },
            { id: 'l2', user_id: 'u1', campanha_id: 'c1', phone: '5511911110002', status_envio: 'enviado', enviado_em: dias(40) },
            { id: 'l3', user_id: 'u1', campanha_id: 'c2', phone: '5511911110003', status_envio: 'enviado', enviado_em: dias(5) }],
    pipeline_leads: [{ id: 'a', user_id: 'u1', name: 'Padaria K', phone: '11911110001', col: 'novo', produto_id: 'pk' },
                     { id: 'b', user_id: 'u1', name: 'Oficina S', phone: '11911110003', col: 'novo', produto_id: 'ps' }],
  } });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(r => setTimeout(r, ms));
      userSet('produto_atual', 'pk'); userSet('produto_visao', 'pk');
      await prodCarregar(); await carregarLeadsEnviadosDaNuvem(); await pkSincronizarDaNuvem();
      const out = { opcoes: [...document.querySelectorAll('#prod-topo option')].map(o => o.textContent), topoVisivel: !document.getElementById('prod-topo-box').hidden };
      const env = () => ['11911110001', '11911110002', '11911110003'].map(t => leadJaFoiEnviado(t));
      out.kaizen = env(); out.liberaC = envioOutroProdutoDias('11911110003'); out.pipeK = pkVisiveis().map(l => l.name);
      await prodTopoTrocar('ps'); await espera(50);
      out.stone = env(); out.pipeS = pkVisiveis().map(l => l.name); out.atual = prodAtual().nome;
      pkLeads.push({ id: 'n1', name: 'Novo S', phone: '11900000000', col: 'novo' }); pkSave();
      out.novoProd = pkLeads.find(l => l.id === 'n1').produtoId;
      window.confirm = () => true; await pkLimparColuna('novo');
      out.depoisLimpar = pkLeads.map(l => l.name);
      await prodTopoTrocar('todos'); await espera(50);
      out.todos = pkVisiveis().map(l => l.name); out.visao = prodVisao();
      trocarAba('pipeline', document.querySelector(".nav-item[onclick*=\"'pipeline'\"]")); await espera(300);
      out.etiquetas = [...document.querySelectorAll('#pk-board-wrap .prod-tag')].map(e => e.textContent);
      out.filtroLeads = prodFiltrar([{ campanha_id: 'c1' }, { campanha_id: 'c2' }]).length;
      await prodTopoTrocar('pk'); await espera(50);
      out.filtroK = prodFiltrar([{ campanha_id: 'c1' }, { campanha_id: 'c2' }, { campanha_id: null }]).map(x => x.campanha_id);
      return out;
    });
    assert.ok(r.topoVisivel);
    assert.deepStrictEqual(r.opcoes, ['Kaizen', 'Stone', 'Todos os produtos']);
    // Kaizen: os dois que ele mesmo mandou ficam bloqueados para sempre; o da Stone (5 dias) espera os 30 dias
    assert.deepStrictEqual(r.kaizen, [true, true, true]);
    assert.ok(r.liberaC >= 24 && r.liberaC <= 26, 'libera em ~25 dias: ' + r.liberaC);
    // Stone: o de 10 dias do Kaizen ainda espera; o de 40 dias está liberado; o dela mesma, nunca
    assert.deepStrictEqual(r.stone, [true, false, true]);
    assert.deepStrictEqual(r.pipeK, ['Padaria K']);
    assert.deepStrictEqual(r.pipeS, ['Oficina S']);
    assert.strictEqual(r.atual, 'Stone');
    assert.strictEqual(r.novoProd, 'ps');
    assert.deepStrictEqual(r.depoisLimpar, ['Padaria K'], 'limpar a coluna na Stone não apaga o Kaizen');
    assert.strictEqual(r.visao, 'todos');
    assert.deepStrictEqual(r.todos, ['Padaria K']);
    assert.deepStrictEqual(r.etiquetas, ['Kaizen']);
    assert.strictEqual(r.filtroLeads, 2);
    assert.deepStrictEqual(r.filtroK, ['c1', null]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('abrir o app com campanhas e leads salvos no aparelho não quebra a inicialização (Painel não fica zerado)', async () => {
  const a = await abrirApp({ largura: 390, antes: () => {
    localStorage.setItem('prospectaEmail', 'teste@x.com');
    localStorage.setItem('teste@x.com__campanhas', JSON.stringify([{ id: 1792089928944, nome: 'Pet SP', leads: [{ title: 'Pet A', phone: '11911110001' }], criadaEm: Date.now() }, { id: 'camp_1792159244118', nome: 'Odonto', leads: [], criadaEm: Date.now() }]));
    localStorage.setItem('teste@x.com__ultimosLeads', JSON.stringify({ leads: [{ title: 'Pet A', phone: '11911110001', rating: 4.5 }], nicho: 'pet', local: 'SP' }));
  } });
  try {
    const r = await a.pagina.evaluate(() => ({ config: typeof config, cpMedia: typeof cpMedia, enviado: leadJaFoiEnviado('11911110001'), score: typeof calcScore({ title: 'x', rating: 4 }) }));
    assert.deepStrictEqual(r, { config: 'object', cpMedia: 'function', enviado: false, score: 'number' });
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Pipeline: a leitura da nuvem de 45 em 45s não apaga o card criado enquanto ela chegava', async () => {
  const a = await abrirApp({ largura: 1280, db: { pipeline_leads: [{ id: 'velho', user_id: 'u1', name: 'Card antigo', phone: '11900000001', col: 'novo' }] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      await pkSincronizarDaNuvem(); await new Promise(r => setTimeout(r, 100));
      // a nuvem demora a responder; nesse meio tempo uma abordagem cria um card novo
      const orig = supabaseClient.from.bind(supabaseClient);
      supabaseClient.from = t => { const q = orig(t); if (t !== 'pipeline_leads') return q; const th = q.then.bind(q); q.then = (ok, err) => new Promise(r => setTimeout(r, 300)).then(() => th(ok, err)); return q; };
      const leitura = pkSincronizarDaNuvem();
      await new Promise(r => setTimeout(r, 50));
      pkLoad(); pkLeads.push({ id: 'novo1', name: 'Grupo Facility', phone: '11900000002', col: 'contatado', canal: 'instagram' }); pkSave();
      await leitura; await new Promise(r => setTimeout(r, 800));
      supabaseClient.from = orig;
      pkLoad();
      return { local: pkLeads.map(l => l.name).sort(), nuvem: _db.pipeline_leads.map(l => l.name).sort() };
    });
    assert.deepStrictEqual(r.local, ['Card antigo', 'Grupo Facility']);
    assert.deepStrictEqual(r.nuvem, ['Card antigo', 'Grupo Facility']);
  } finally { await a.fechar(); }
});

test('campanha adota as abordagens avulsas no Retomar (contando da 1ª DM) e a DM seguinte respeita o intervalo de segurança', async () => {
  const dois = new Date(Date.now() - 2 * 86400000).toISOString();
  const db = {
    abordagens_instagram: [
      { id: 1, user_id: 'u1', chave: 'gfacility', nome: 'Grupo Facility', telefone: '11911110009', instagram: 'https://www.instagram.com/gfacility/', bio: 'RH e facilities', criado_em: dois, resultado: null },
      { id: 2, user_id: 'u1', chave: 'jarespondeu', nome: 'Já Respondeu', instagram: 'https://www.instagram.com/jarespondeu/', criado_em: dois, resultado: 'respondeu' } ],
  };
  const a = await abrirApp({ db, largura: 1280, rotas: [[/\/ia$/, () => ({ texto: 'Oi! Posso mostrar uma ideia?' })]] });
  try {
    await a.pagina.evaluate(() => { window.open = () => null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); });
    // aba Prospecção Instagram avisa das avulsas sem campanha e o botão já abre a campanha com elas
    await a.pagina.evaluate(() => trocarAba('insta', document.querySelector(`.nav-item[onclick*="'insta'"]`)));
    await a.pagina.click('#canal-insta .canal-sub[data-sub="fila"]');
    await a.pagina.waitForSelector('#canal-insta .cc-avulsas');
    assert.match(await a.pagina.textContent('#canal-insta .cc-avulsas'), /1 abordagem avulsa no Instagram sem campanha/);
    await a.pagina.click('#canal-insta .cc-avulsas button');
    await a.pagina.waitForSelector('.cc-modal select');
    assert.match(await a.pagina.$eval('.cc-modal select', s => s.selectedOptions[0].textContent), /Abordados avulsos no Instagram, sem campanha \(1\)/);
    assert.match(await a.pagina.textContent('.cc-modal'), /1 empresas entram na campanha \(1 já abordadas avulso entram no Retomar\)/);
    await a.pagina.click('.cc-modal button:has-text("Criar campanha")');
    await a.pagina.waitForTimeout(600);
    const r = await a.pagina.evaluate(() => _db.campanhas_canal_leads.map(x => ({ chave: x.chave, etapa: x.etapa, quando: x.proxima_em, primeira: x.lead.primeiraEm })));
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].chave, 'gfacility'); assert.strictEqual(r[0].etapa, 1);
    const dias = (new Date(r[0].quando) - new Date(r[0].primeira)) / 86400000;
    assert.ok(dias > 2 && dias < 4, 'Retomar no 3º dia depois da 1ª DM: ' + dias);
    // intervalo: acabou de mandar uma DM → o botão da próxima espera
    await a.pagina.evaluate(() => { userSet('ig_ultima_dm', Date.now()); userSet('ig_intervalo', 90); igAbordar([{ title: 'Nova', instagram: 'https://www.instagram.com/nova/' }]); });
    await a.pagina.waitForSelector('.ig-modal textarea:not([disabled])');
    const b = await a.pagina.$eval('.ig-modal .modal-btn.primary', x => ({ txt: x.textContent, dis: x.disabled }));
    assert.match(b.txt, /Próxima DM em 1:(2|3)\d/); assert.strictEqual(b.dis, true);
    assert.match(await a.pagina.textContent('.ig-modal'), /Intervalo de segurança: 90s/);
    // passou o intervalo → libera
    await a.pagina.evaluate(() => userSet('ig_ultima_dm', Date.now() - 91000));
    await a.pagina.waitForTimeout(1300);
    const b2 = await a.pagina.$eval('.ig-modal .modal-btn.primary', x => ({ txt: x.textContent, dis: x.disabled }));
    assert.deepStrictEqual(b2, { txt: 'Copiar e abrir conversa', dis: false });
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Manual do Cliente: aba depois de Configuração, com busca e botão que abre a tela', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const itens = [...document.querySelectorAll('nav .nav-item, nav .nav-section')].map(x => x.textContent.trim().replace(/\s+/g, ' '));
      trocarAba('manual', document.querySelector(".nav-item[onclick*=\"'manual'\"]"));
      await new Promise(r => setTimeout(r, 200));
      const box = document.getElementById('manual-box');
      const total = box.querySelectorAll('details').length;
      const busca = box.querySelector('.manual-busca'); busca.value = 'intervalo dm'; busca.dispatchEvent(new Event('input'));
      const visiveis = [...box.querySelectorAll('details')].filter(d => !d.hidden).map(d => d.querySelector('summary').textContent);
      busca.value = 'xyzabc'; busca.dispatchEvent(new Event('input'));
      const vazio = !box.querySelector('.manual-vazio').hidden;
      busca.value = ''; busca.dispatchEvent(new Event('input'));
      const pipe = [...box.querySelectorAll('details')].find(d => /Pipeline/.test(d.querySelector('summary').textContent) && d.querySelector('.manual-ir'));
      pipe.querySelector('.manual-ir').click();
      const abriu = document.getElementById('tab-pipeline').classList.contains('active');
      // rolado lá embaixo no manual: a tela aberta começa do topo, e "Proteção do número" vai direto ao cartão
      trocarAba('manual', document.querySelector(".nav-item[onclick*=\"'manual'\"]"));
      const prot = [...box.querySelectorAll('details')].find(d => /Proteção do número/.test(d.querySelector('summary').textContent));
      prot.open = true; prot.scrollIntoView();
      const mc = document.getElementById('main-content'); const rolado = mc.scrollTop;
      prot.querySelector('.manual-ir').click();
      const topoLogo = mc.scrollTop;
      await new Promise(r => setTimeout(r, 1800));
      const card = document.getElementById('integ-card-protecao').getBoundingClientRect().top;
      return { rolado, topoLogo, card, ultimo: itens[itens.length - 1], penultimo: itens[itens.length - 2], titulo: document.getElementById('page-title').textContent, total, visiveis, vazio, abriu };
    });
    assert.match(r.ultimo, /Manual do Cliente/);
    assert.match(r.penultimo, /Integrações/);
    assert.ok(r.total >= 20, 'seções: ' + r.total);
    assert.ok(r.visiveis.some(t => /Instagram/.test(t)), JSON.stringify(r.visiveis));
    assert.strictEqual(r.vazio, true);
    assert.strictEqual(r.abriu, true);
    assert.ok(r.rolado > 500, 'estava rolado no manual: ' + r.rolado);
    assert.strictEqual(r.topoLogo, 0);
    assert.ok(r.card >= 0 && r.card < 300, 'cartão Proteção da conta no alto da tela: ' + r.card);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Painel: hoje nos 3 canais (enviados, limite, responderam e progresso), igual ao do WhatsApp', async () => {
  const agora = Date.now(), dia = 86400000, hoje = new Date(agora).toISOString(), ontem = new Date(agora - dia).toISOString();
  const leads = [];
  for (let i = 0; i < 6; i++) leads.push({ id: 'w' + i, user_id: 'u1', campanha_id: 'c1', phone: '551190000000' + i, enviado_em: i < 3 ? hoje : ontem, respondeu: i < 2, resposta_suspeita_bot: i === 1, respondido_em: i < 2 ? hoje : null });
  const ig = []; for (let i = 0; i < 11; i++) ig.push({ id: i + 1, user_id: 'u1', chave: 'ig' + i, criado_em: i < 10 ? hoje : ontem, resultado: i === 10 ? 'respondeu' : null, resultado_em: i === 10 ? hoje : null });
  const a = await abrirApp({ largura: 1280, db: { leads, abordagens_instagram: ig, abordagens_linkedin: [] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      await painelCanaisCarregar();
      return { cols: [...document.querySelectorAll('#pc-canais .pc-canal')].map(c => c.innerText.replace(/\s+/g, ' ')), total: document.getElementById('pc-total').innerText, ic: document.querySelectorAll('#pc-canais .pc-ic svg').length };
    });
    assert.strictEqual(r.cols.length, 3); assert.strictEqual(r.ic, 3);
    assert.match(r.cols[0], /WhatsApp Enviados hoje 3 Limite diário 30 Responderam hoje 1 Progresso do dia 10%/, 'robô não conta');
    assert.match(r.cols[1], /Instagram DMs hoje 10 Limite diário 20 Responderam hoje 1 Progresso do dia 50%/);
    assert.match(r.cols[2], /LinkedIn Convites hoje 0 Limite diário 15 Responderam hoje 0 Progresso do dia 0%/);
    assert.match(r.total, /Hoje, somando os 3 canais: 13 contatos e 2 respostas/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Métricas de Envio nos 3 canais: cartões somam WhatsApp, Instagram e LinkedIn, com filtro de canal, tabela e ranking', async () => {
  const agora = new Date(), br = d => d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR');
  const rows = []; for (let i = 0; i < 8; i++) rows.push({ campanhaId: 'c1', status: i < 7 ? 'enviado' : 'erro', data: br(new Date(agora - i * 3600000)), lead: 'Wa ' + i });
  const leads = rows.filter(r => r.status === 'enviado').map((r, i) => ({ id: 'l' + i, user_id: 'u1', campanha_id: 'c1', phone: '55119000000' + i, enviado_em: new Date(agora - i * 3600000).toISOString(), respondeu: i < 2, resposta_suspeita_bot: false, respondido_em: new Date(agora).toISOString() }));
  const ig = []; for (let i = 0; i < 4; i++) ig.push({ id: i + 1, user_id: 'u1', chave: 'ig' + i, nome: 'Insta ' + i, criado_em: new Date(agora - i * 60000).toISOString(), resultado: i === 0 ? 'respondeu' : null });
  const li = [{ id: 1, user_id: 'u1', chave: 'li0', nome: 'Linked 0', criado_em: new Date(agora).toISOString(), resultado: null }];
  const db = { leads, abordagens_instagram: ig, abordagens_linkedin: li,
    campanhas_canal: [{ id: 'k1', user_id: 'u1', canal: 'instagram', nome: 'Facilities SP', status: 'ativa', etapas: [0, 3, 7] }],
    campanhas_canal_leads: [{ id: 1, user_id: 'u1', campanha_id: 'k1', chave: 'ig0', etapa: 1, status: 'respondeu' }, { id: 2, user_id: 'u1', campanha_id: 'k1', chave: 'ig1', etapa: 1, status: 'pendente' }] };
  const a = await abrirApp({ largura: 1280, db, rotas: [[/status-campanha/, () => ({ rows })]] });
  try {
    const ler = () => a.pagina.evaluate(() => ({
      cards: [...document.querySelectorAll('#mc-canais-grid .mc-ccard')].map(c => c.innerText.replace(/\s+/g, ' ')),
      tamanhos: [...document.querySelectorAll('#mc-canais-grid .mc-cnums b')].map(b => getComputedStyle(b).fontSize),
      linhas: document.querySelectorAll('#mc-tabela-body tr').length, canais: [...document.querySelectorAll('#mc-tabela-body .mc-chip-canal')].map(x => x.textContent),
      rank: document.getElementById('mc-ranking-campanhas').innerText.replace(/\s+/g, ' '), hora: (document.querySelector('#mc-horario-conteudo .mc-hgrid') || {}).innerText?.replace(/\s+/g, ' ') || '' }));
    await a.pagina.evaluate(async () => { await carregarMetricas(); }); await a.pagina.waitForTimeout(900);
    let r = await ler();
    assert.deepStrictEqual(r.cards, [
      'Total 12 contatos 3 responderam 25% taxa de resposta',
      'WhatsApp 7 mensagens 2 responderam 28,6% taxa de resposta',
      'Instagram 4 DMs 1 responderam 25% taxa de resposta',
      'LinkedIn 1 convites 0 responderam 0% taxa de resposta']);
    assert.strictEqual(new Set(r.tamanhos).size, 1, 'mesmo tamanho de número nos 4 cartões');
    assert.strictEqual(r.linhas, 13);
    assert.deepStrictEqual([...new Set(r.canais)].sort(), ['Instagram', 'LinkedIn', 'WhatsApp']);
    assert.match(r.rank, /Instagram Facilities SP/);
    assert.match(r.hora, /WhatsApp .*Instagram .*LinkedIn/);
    // só Instagram
    await a.pagina.selectOption('#mc-filtro-canal', 'instagram'); await a.pagina.waitForTimeout(900);
    r = await ler();
    assert.deepStrictEqual(r.cards, ['Instagram 4 DMs 1 responderam 25% taxa de resposta']);
    assert.strictEqual(r.linhas, 4); assert.deepStrictEqual([...new Set(r.canais)], ['Instagram']);
    assert.match(r.rank, /Instagram Facilities SP 2 empresas · 2 já abordadas · ativa 50% responderam/); assert.ok(!/c1/.test(r.rank), 'só Instagram no ranking');
    assert.doesNotMatch(r.hora, /WhatsApp|LinkedIn/);
    // só WhatsApp
    await a.pagina.selectOption('#mc-filtro-canal', 'whatsapp'); await a.pagina.waitForTimeout(900);
    r = await ler();
    assert.deepStrictEqual(r.cards, ['WhatsApp 7 mensagens 2 responderam 28,6% taxa de resposta']);
    // funil do envio à venda com uma coluna por canal
    const f = await a.pagina.evaluate(async () => { await prCarregar(); return document.querySelector('#pr-funil-corpo .mc-ftab').innerText.replace(/\s+/g, ' '); });
    assert.match(f, /Total WhatsApp Instagram LinkedIn Contatos 12 7 4 1 Responderam 3 25% 2 28,6% 1 25% 0 0%/i);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Números do WhatsApp: lista em Integrações, etiqueta no topo e troca do número ligado', async () => {
  let lista = [
    { id: 'principal', apelido: 'Principal', numero: '5511911112222', ativo: true, conectado: true, temSessao: true, ultimaConexao: new Date().toISOString() },
    { id: 'n1', apelido: 'Reserva', numero: '5511933334444', ativo: false, conectado: false, temSessao: true, ultimaConexao: new Date(Date.now() - 12 * 86400000).toISOString() },
  ];
  const a = await abrirApp({ largura: 1280, rotas: [
    [/\/numeros\/usar$/, (j) => { lista = lista.map(n => ({ ...n, ativo: n.id === j.id, conectado: n.id === j.id })); return { ok: true }; }],
    [/\/numeros$/, () => ({ ativo: lista.find(n => n.ativo).id, numeros: lista })],
    [/\/status$/, () => ({ connected: true })],
  ] });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' }; window.confirm = () => true;
      trocarAba('integracoes', document.querySelector(".nav-item[onclick*=\"'integracoes'\"]"));
      await numCarregar();
      const card = document.getElementById('integ-card-numeros');
      const out = { visivel: !card.hidden, itens: [...card.querySelectorAll('.num-item')].map(x => x.innerText.replace(/\s+/g, ' ')), topo: document.getElementById('num-topo').textContent, topoVis: !document.getElementById('num-topo').hidden };
      await numUsar(_nums.numeros[1]); await new Promise(r => setTimeout(r, 300));
      out.depois = document.getElementById('num-topo').textContent;
      return out;
    });
    assert.strictEqual(r.visivel, true);
    assert.match(r.itens[0], /Principal\s*Ligado agora/);
    assert.match(r.itens[1], /Reserva\s*Guardado .*última conexão há 12 dias.*Parado há muito tempo.*Usar este/);
    assert.ok(r.topoVis); assert.strictEqual(r.topo, '📱 Principal · 2222');
    assert.strictEqual(r.depois, '📱 Reserva · 4444');
    const pedido = a.pedidos.find(p => /\/numeros\/usar$/.test(p.caminho));
    assert.deepStrictEqual(pedido.corpo, { id: 'n1' });
    // servidor antigo (sem /numeros): nada aparece
    const r2 = await a.pagina.evaluate(async () => { _nums = { semSuporte: true }; numPintar(); numTopoPintar(); return [document.getElementById('integ-card-numeros').hidden, document.getElementById('num-topo').hidden]; });
    assert.deepStrictEqual(r2, [true, true]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Áudio com a voz da IA (respostas, follow-up e Inbox) e ligação marcada pela agenda', async () => {
  const db = {
    fila_sugestoes: [{ id: 5, user_id: 'u1', phone: '5511999990000', lead_nome: 'Padaria Sol', status: 'pendente', classificacao: 'quente' }],
    fila_followups: [{ id: 9, user_id: 'u1', phone: '5511988880000', lead_nome: 'Pet Um', status: 'pendente', dia_etapa: 3, campanha_id: 'c1', mensagem: 'Oi! Passando para retomar 😊 https://x.com' }],
    pipeline_leads: [],
  };
  const a = await abrirApp({ largura: 1280, db, rpcs: { sou_dono_agenda: true }, rotas: [
    [/\/send-audio$/, () => ({ success: true, id: 'A1' })],
    [/\/api\/agenda$/, (j) => j.acao === 'horarios' ? { ok: true, slots: [{ texto: 'terça (20/10) às 10:00', dia_mes: '20/10', hora: '10:00', dia_semana: 'terça-feira' }] } : { ok: true, inicio: '2026-10-20T13:00:00.000Z', escolhido: { texto: 'terça (20/10) às 10:00' }, meet: 'https://meet.google.com/x' }],
  ] });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = { url: 'https://srv.test', token: 't' }; window.confirm = () => true;
      const w = ms => new Promise(r => setTimeout(r, ms));
      const out = { limpo: audioTexto('Oi *Ana*! 😊 Veja https://site.com\n\n\nAbraço') };
      // follow-up em áudio
      _filaFollowupsCache = JSON.parse(JSON.stringify(_db.fila_followups)); renderizarFilaFollowups();
      const bt = document.querySelector('button[onclick^="fuEnviarAudio(9"]'); out.temBotaoFu = !!bt;
      await fuEnviarAudio(9, bt); await w(100);
      out.fuStatus = _db.fila_followups[0].status; out.fuEnviados = (_db.followups_enviados || []).length;
      // resposta em áudio
      const ta = document.createElement('textarea'); ta.id = 'fila-texto-5'; ta.value = 'Que bom! Posso te explicar em 10 minutos?'; document.body.appendChild(ta);
      _filaSugestoesCache = JSON.parse(JSON.stringify(_db.fila_sugestoes));
      const g = { k: '11999990000', nome: 'Padaria Sol', ultimo: { id: 5, phone: '5511999990000' }, itens: [{ id: 5 }] };
      const painel = document.createElement('div'); document.body.appendChild(painel);
      rsPainelAudio(painel, g);
      [...painel.querySelectorAll('button')].find(b => /Enviar áudio/.test(b.textContent)).click(); await w(400);
      out.rsStatus = _db.fila_sugestoes[0].status;
      // ligação pela agenda
      _rsCtx.leads = {}; _rsAgendaTipo = 'ligacao';
      const p2 = document.createElement('div'); document.body.appendChild(p2);
      ta.value = '';
      rsPainelAgenda(p2, g); await w(300);
      out.tituloLig = p2.innerText.includes('Horários livres para você ligar');
      [...p2.querySelectorAll('button')].find(b => /terça/.test(b.textContent)).click();
      [...p2.querySelectorAll('button')].find(b => /Marcar ligação/.test(b.textContent)).click(); await w(600);
      out.msgLig = (document.getElementById('fila-texto-5') || {}).value;
      pkLoad(); out.card = pkLeads.map(l => [l.col, l.proximaAcaoTxt]);
      return out;
    });
    assert.strictEqual(r.limpo, 'Oi Ana! Veja\nAbraço');
    assert.ok(r.temBotaoFu);
    const envios = a.pedidos.filter(p => /\/send-audio$/.test(p.caminho)).map(p => p.corpo);
    assert.deepStrictEqual(envios[0], { phone: '5511988880000', texto: 'Oi! Passando para retomar', voz: 'feminina' }, 'sem emoji e sem link');
    assert.strictEqual(r.fuStatus, 'enviado'); assert.strictEqual(r.fuEnviados, 1);
    assert.deepStrictEqual(envios[1], { phone: '5511999990000', texto: 'Que bom! Posso te explicar em 10 minutos?', voz: 'feminina' });
    assert.strictEqual(r.rsStatus, 'enviado');
    assert.ok(r.tituloLig);
    const marcar = a.pedidos.filter(p => /\/api\/agenda$/.test(p.caminho)).map(p => p.corpo).find(c => c.acao === 'marcar');
    assert.strictEqual(marcar.tipo, 'ligacao');
    assert.match(r.msgLig, /Te ligo terça \(20\/10\) às 10:00 neste número/);
    assert.ok(r.card.some(([col, txt]) => col === 'negociando' && /Ligar para/.test(txt || '')), JSON.stringify(r.card));
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Dor e solução: o Maps mostra a dor e a solução, a busca filtra por dor e a mensagem segue o produto do topo', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`));
      _produtos = [{ id: 'p1', nome: 'Maquininha Stone', instrucoes: '', padrao: true }, { id: 'p2', nome: 'Site Express', instrucoes: 'Criamos sites' }];
      const leads = [
        { title: 'Padaria <b>Sol</b>', phone: '11999990001', rating: 4.8, reviews: 230, category: 'Padaria', is_whatsapp: true },
        { title: 'Oficina Lua', phone: '11999990002', rating: 3.6, reviews: 12, website: 'https://lua.com.br', instagram: 'https://instagram.com/lua', is_whatsapp: true },
        { title: 'Clínica Mar', phone: '11999990003', rating: 4.9, reviews: 40, website: 'https://mar.com.br', instagram: 'https://instagram.com/mar', is_whatsapp: true },
      ];
      todosLeads = leads.slice(); _leadsBase = leads.slice(); renderPagina(1); atualizarAcoesBusca();
      const sel = document.getElementById('ps-dor-sel');
      const chips = [...sel.options].map(o => o.textContent);
      sel.value = 'semsite'; sel.dispatchEvent(new Event('change'));
      const filtrados = todosLeads.map(l => l.title);
      const botao = document.getElementById('ps-btn-melhores').textContent;
      const badge = document.getElementById('count-badge').textContent;
      const painelFechado = document.getElementById('ps-filtros-painel').hidden;
      psFiltrosAbrir(); alternarFiltroExtra('celular');
      const nFiltros = document.getElementById('ps-filtros-n').textContent;
      psFiltrosLimpar();
      const voltou = todosLeads.length, dorDepois = document.getElementById('ps-dor-sel').value, nDepois = document.getElementById('ps-filtros-n').textContent;
      const padaria = todosLeads.findIndex(l => l.title.startsWith('Padaria'));
      renderPagina(1);
      toggleExpandScore(padaria, document.getElementById('lead-row-' + padaria).querySelector('[onclick^="toggleExpandScore("]'));
      const box = document.querySelector('#expand-' + padaria + ' .dor-box');
      const prompt = iaPromptServidor(leads[0], 'Vendo maquininha', 'A', 'curiosidade');
      return { chips, filtrados, botao, badge, painelFechado, nFiltros, dorDepois, nDepois, voltou, txt: box.innerText, html: box.innerHTML, botoes: box.querySelectorAll('button').length, prompt };
    });
    assert.strictEqual(r.chips[0], '🩺 Dor e solução: todas');
    assert.ok(r.chips.includes('🌐 Sem site (1)'), r.chips.join(' | '));
    assert.ok(r.chips.includes('⭐ Nota baixa ou reclamações (1)'));
    assert.ok(r.chips.includes('📉 Poucas avaliações (1)'));
    assert.ok(r.chips.includes('💰 Movimentados (1)'));
    assert.deepStrictEqual(r.filtrados, ['Padaria <b>Sol</b>']);
    assert.match(r.botao, /Criar campanha com o melhor lead/);
    assert.match(r.badge, /1 de 3/);
    assert.strictEqual(r.painelFechado, true, 'filtros ficam guardados no botão');
    assert.strictEqual(r.nFiltros, '(1)');
    assert.strictEqual(r.voltou, 3); assert.strictEqual(r.dorDepois, ''); assert.strictEqual(r.nDepois, '');
    assert.match(r.txt, /DOR E SOLUÇÃO/i);
    assert.match(r.txt, /Não tem site/);
    assert.match(r.txt, /Movimentado: 230 avaliações/);
    assert.match(r.txt, /Cortar custo fixo.*✅ combina com Maquininha Stone/s, 'combina com o produto do topo');
    assert.ok(!/combina com Site Express/.test(r.txt), 'só o produto do topo');
    assert.strictEqual(r.botoes, 0, 'sem frase pronta nem IA: limpo');
    assert.ok(!r.html.includes('<b>Sol</b>'), 'nome do lead escapado');
    assert.ok(!/SOBRE A DOR|Dor que o Google/.test(r.prompt), 'mensagem segue só o produto');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('histórico guarda as 3 avaliações escritas mais recentes (para ler e para a IA), com texto curto', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      const revs = [1, 2, 3, 4, 5].map(i => ({ nota: 5, data: '2026-10-0' + i, quando: 'x', texto: 'Ótimo atendimento '.repeat(30), autor: 'Fulano' }));
      const s = _histSlim({ title: 'Padaria', hours: 'seg', _tmp: 1, ultimas_avaliacoes: revs });
      const vazio = _histSlim({ title: 'Sem avaliações', ultimas_avaliacoes: [] });
      return { s, vazio };
    });
    assert.strictEqual(r.s.ultimas_avaliacoes.length, 3);
    assert.ok(r.s.ultimas_avaliacoes.every(x => x.texto.length <= 240 && !('autor' in x) && x.nota === 5));
    assert.ok(!('hours' in r.s) && !('_tmp' in r.s));
    assert.ok(!('ultimas_avaliacoes' in r.vazio));
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Dor e solução lê do que as avaliações negativas reclamam (só para você; a mensagem não cita)', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      _produtos = [{ id: 'p1', nome: 'Robô de WhatsApp', instrucoes: 'Atendimento automático no WhatsApp', padrao: true }];
      const lead = { title: 'Clínica Sol', phone: '11999990001', rating: 3.9, reviews: 80, website: 'https://sol.com.br', instagram: 'https://instagram.com/sol',
        avaliacoes_negativas: 3, ultimas_avaliacoes: [
          { nota: 1, data: '2026-10-10', texto: 'Liguei várias vezes e ninguém atende, péssimo!' },
          { nota: 2, data: '2026-10-08', texto: 'Mandei mensagem no WhatsApp e demoraram 3 dias para responder.' },
          { nota: 1, data: '2026-10-05', texto: 'Marquei horário e esperei 1 hora.' },
          { nota: 5, data: '2026-10-04', texto: 'Demora nenhuma, ótimo! Não aceita cartão? Aceita sim.' },
        ] };
      const ids = doresLead(lead).map(d => d.id);
      const box = document.createElement('div'); box.innerHTML = blocoDor(lead); document.body.appendChild(box);
      const prompt = iaPromptServidor(lead, 'Vendo robô', 'A', 'curiosidade');
      return { ids, txt: box.innerText, prompt };
    });
    assert.deepStrictEqual(r.ids.filter(i => i.startsWith('q-')), ['q-atendimento', 'q-agenda'], 'elogio de 5★ não conta');
    assert.ok(r.ids.indexOf('reputacao') === r.ids.indexOf('q-atendimento') - 1, 'logo depois de reputação');
    assert.match(r.txt, /Clientes reclamam de demora ou de não serem atendidos \(2 avaliações\)/);
    assert.match(r.txt, /Atendimento automático no WhatsApp.*✅ combina com Robô de WhatsApp/s);
    assert.match(r.txt, /agendamento ou de espera \(1 avaliação\)/);
    assert.ok(!/ninguém atende|esperei/.test(r.prompt), 'texto das negativas não vai para a mensagem');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Histórico é só o registro das buscas; quem falta contatar continua no card da campanha', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const agora = new Date().toISOString();
      const L = (n, tel) => ({ title: n, phone: tel, place_id: 'p' + tel, is_whatsapp: true });
      _histBuscas = [
        { id: 'b1', nicho: 'Facilities, limpeza', local: 'São Paulo', origem: 'maps', total: 3, criado_em: agora, leads: [L('A', '11999990001'), L('B', '11999990002'), L('C', '11999990003')] },
        { id: 'b2', nicho: 'Padaria', local: 'Campinas', origem: 'maps', total: 2, criado_em: agora, leads: [L('D', '19999990004'), L('E', '19999990005')] },
      ];
      _histRes = { ld: { [pkTel('11999990001')]: { env: true } }, pk: {}, wa: {} };
      trocarAba('historico', document.querySelector(`.nav-item[onclick*="'historico'"]`) || document.body);
      histPintar();
      const cards = [...document.querySelectorAll('#historico-lista .hist-card')].map(c => c.innerText.replace(/\s+/g, ' '));
      const temFunil = !!document.querySelector('#historico-lista .hist-funil'), temRanking = !!document.getElementById('hist-ranking');
      _cpDados = { leads: [{ campanha_id: 'c1', phone: '11999990001', title: 'A', enviado_em: agora }], camps: [{ id: 'c1', nicho: 'Facilities', local: 'São Paulo' }], interesses: [], pipeline: [], fila: [], fuEnv: [] };
      cpMontarGrupos(); cpRender();
      const bt = [...document.querySelectorAll('#cp-lista button')].find(b => /que faltam/.test(b.textContent));
      const btTxt = bt && bt.textContent;
      bt.click();
      await new Promise(r => setTimeout(r, 300));
      return { cards, temFunil, temRanking, btTxt, carregados: todosLeads.map(l => l.title).sort(), aba: document.querySelector('.tab-content.active')?.id };
    });
    const sp = r.cards.find(c => c.includes('Facilities')), pd = r.cards.find(c => c.includes('Padaria'));
    assert.match(sp, /Virou campanha · 1 contatadas · 2 ainda sem mensagem/);
    assert.match(sp, /Abordar as 2 que faltam/);
    assert.ok(!/Continuar|Carregar todas|Planilha/.test(sp), 'resto fica no ⋯');
    assert.match(pd, /Ainda não virou campanha · 2 prontas para abordar/);
    assert.match(pd, /Abordar as 2 empresas/);
    assert.strictEqual(r.temFunil, false); assert.strictEqual(r.temRanking, true);
    assert.strictEqual(r.btTxt, '▶ Enviar para os 2 que faltam');
    assert.deepStrictEqual(r.carregados, ['B', 'C']);
    assert.strictEqual(r.aba, 'tab-prospeccao');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('lista com telefone repetido: a campanha vai para a nuvem com um lead por telefone (antes ia sem nenhum)', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const enviados = [];
      const orig = supabaseClient.from.bind(supabaseClient);
      supabaseClient.from = t => { const q = orig(t); if (t === 'leads') { const up = q.upsert.bind(q); q.upsert = (rows, o) => { enviados.push(...rows); return up(rows, o); }; } return q; };
      await sincronizarCampanhaComTabelas({ id: 'x1', nome: 'Facilities', nicho: 'Facilities', local: 'São Paulo', leads: [
        { title: 'A', phone: '11999990001' }, { title: 'A filial', phone: '(11) 99999-0001' }, { title: 'B', phone: '11999990002' },
        { title: 'Só Instagram 1', phone: '' }, { title: 'Só Instagram 2' } ] });
      const L = (n, tel, id) => ({ title: n, phone: tel, place_id: id, is_whatsapp: true });
      _histBuscas = [{ id: 'b1', nicho: 'Facilities', local: 'São Paulo', origem: 'maps', total: 3, criado_em: new Date().toISOString(),
        leads: [L('A', '11999990001', 'p1'), L('A filial', '11999990001', 'p2'), L('B', '11999990002', 'p3')] }];
      _histRes = { ld: {}, pk: {}, wa: {} };
      return { tels: enviados.map(x => x.phone), faltam: histGrupos()[0].faltam.map(l => l.title) };
    });
    assert.strictEqual(r.tels.length, 2, r.tels.join(','));
    assert.deepStrictEqual(r.faltam, ['A', 'B']);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Ouvir antes: pede MP3 (o iPhone não toca OGG) e prepara o player no próprio toque', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const pedidos = [], tocados = []; config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      _audioReq = async (c, corpo) => { pedidos.push({ c, corpo }); await new Promise(r => setTimeout(r, 50)); return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }), { status: 200 }); };
      const Orig = window.Audio;
      window.Audio = function () { const el = { src: '', play() { tocados.push(this.src.slice(0, 15)); return Promise.resolve(); }, pause() {} }; return el; };
      await audioOuvir('Oi, tudo bem? Aqui é do Prospecta.', null);
      window.Audio = Orig;
      return { pedidos, tocados };
    });
    assert.strictEqual(r.pedidos[0].c, '/tts');
    assert.strictEqual(r.pedidos[0].corpo.formato, 'mp3');
    assert.deepStrictEqual(r.tocados.map(s => s.slice(0, 5)), ['data:', 'blob:'], 'destrava no toque e depois toca o áudio');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Pendências no Plano: automáticas + tarefas com ✅, e campanhas antigas vão para Arquivadas', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      _produtos = [{ id: 'p1', nome: 'Kaizen Connect', instrucoes: 'x', padrao: true }, { id: 'p2', nome: 'Maquininha Stone', instrucoes: '' }];
      campanhas = [{ id: 'l1', nome: 'Serralheiro – SJC', leads: [] }];
      phContar = async (t, f) => t === 'fila_followups' ? 67 : t === 'fila_sugestoes' ? 0 : t === 'pipeline_leads' && f.some(x => x[2] === 'respondeu') ? 12 : 0; pendChecarParou = async () => [];
      _histRes = { ld: {}, pk: {}, wa: {} }; _histBuscas = [];
      trocarAba('plano', document.querySelector(`.nav-item[onclick*="'plano'"]`) || document.body);
      await new Promise(r => setTimeout(r, 300));
      phContar = async (t, f) => t === 'fila_followups' ? 67 : t === 'fila_sugestoes' ? 0 : t === 'pipeline_leads' && f.some(x => x[2] === 'respondeu') ? 12 : 0; pendChecarParou = async () => [];
      await pendCarregar();
      const txt1 = document.getElementById('pend-card').innerText;
      const n1 = document.getElementById('pend-n').textContent;
      // marca a semente do robô e uma automática; adiciona uma nova
      [...document.querySelectorAll('#pend-lista .pend-item')].find(li => /robô respondeu/.test(li.innerText)).querySelector('.pend-chk').click();
      [...document.querySelectorAll('#pend-lista .pend-item')].find(li => /Pipeline/.test(li.innerText)).querySelector('.pend-chk').click();
      document.getElementById('pend-novo').value = 'Ligar para a Facilities X';
      pendAdicionar();
      const txt2 = document.getElementById('pend-lista').innerText, n2 = document.getElementById('pend-n').textContent;
      // campanhas: uma antiga, uma recente
      const velho = new Date(Date.now() - 30 * 86400000).toISOString(), novo = new Date().toISOString();
      _histRes = null;
      _cpDados = { leads: [{ campanha_id: 'c1', phone: '11999990001', enviado_em: velho }, { campanha_id: 'c2', phone: '11999990002', enviado_em: novo }],
        camps: [{ id: 'c1', nicho: 'PetShop', local: 'São Paulo' }, { id: 'c2', nicho: 'Facilities', local: 'São Paulo' }], interesses: [], pipeline: [], fila: [], fuEnv: [] };
      cpMontarGrupos(); cpRender();
      const soltos = [...document.querySelectorAll('#cp-lista > .cp-card h3')].map(h => h.textContent);
      const arq = document.querySelector('#cp-lista .cp-arquivadas');
      return { txt1, n1, txt2, n2, soltos, arqTit: arq && arq.querySelector('summary').textContent, arqCards: arq ? arq.querySelectorAll('.cp-card').length : 0 };
    });
    assert.match(r.txt1, /Aprovar ou descartar 67 follow-ups/);
    assert.match(r.txt1, /12 no Pipeline em "Respondeu" há mais de 14 dias/);
    assert.match(r.txt1, /Disparar a lista salva/);
    assert.match(r.txt1, /instruções da IA de "Maquininha Stone"/);
    assert.match(r.txt1, /robô respondeu/);
    assert.match(r.n1, /^7 em aberto$/);
    assert.ok(!/12 no Pipeline/.test(r.txt2), 'automática marcada some');
    assert.match(r.txt2, /✅[\s\S]*robô respondeu[\s\S]*feito em/);
    assert.match(r.txt2, /Ligar para a Facilities X/);
    assert.match(r.n2, /^6 em aberto$/);
    assert.deepStrictEqual(r.soltos.map(t => t.split('·')[0].trim()), ['Facilities']);
    assert.match(r.arqTit, /Arquivadas \(1\)/);
    assert.strictEqual(r.arqCards, 1);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('follow-ups saem pela fila com intervalo: tocar vários cards rápido não vira rajada (o que derrubou o número em 19/10)', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const envios = [];
      _fuEnviarAgora = async (id, texto) => { envios.push({ id, texto, t: Date.now() }); _filaFollowupsCache = _filaFollowupsCache.filter(i => i.id !== id); renderizarFilaFollowups(); return true; };
      fuIntervalo = () => 250;
      trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`) || document.body);
      await new Promise(r => setTimeout(r, 1500));   // a aba termina de carregar a fila (vazia) do banco de teste
      _filaFollowupsCache = [1, 2, 3, 4].map(id => ({ id, phone: '1199999000' + id, lead_nome: 'Lead ' + id, mensagem: 'Oi ' + id, dia_etapa: 3, campanha_nome: 'Facilities' }));
      renderizarFilaFollowups();
      [1, 2, 3, 4].forEach(id => { document.getElementById('fu-texto-' + id).value = 'Oi ' + id; });
      // toca os 4 "Enviar" em sequência, como no dia 19
      [1, 2, 3, 4].forEach(id => document.querySelector(`.fila-card[data-fu="${id}"] button[onclick^="enviarFollowup("]`).click());
      await new Promise(r => setTimeout(r, 30));
      const aviso = document.getElementById('fu-fila-aviso').textContent;
      const btn3 = document.querySelector('.fila-card[data-fu="3"] button[onclick^="enviarFollowup("]');
      const estado3 = { txt: btn3.textContent, off: btn3.disabled };
      const todos = document.getElementById('fu-todos').textContent;
      // pula o 4 enquanto espera: não pode sair
      await pularFollowup(4);
      await new Promise(r => setTimeout(r, 3500));
      const gaps = envios.slice(1).map((e, i) => e.t - envios[i].t);
      return { ids: envios.map(e => e.id), gaps, aviso, estado3, todos, avisoFim: document.getElementById('fu-fila-aviso').hidden, todosFim: document.getElementById('fu-todos').textContent };
    });
    assert.deepStrictEqual(r.ids, [1, 2, 3], 'na ordem, sem o pulado');
    assert.ok(r.gaps.every(g => g >= 240), 'espaçados: ' + r.gaps.join(','));
    assert.match(r.aviso, /Enviando com intervalo para proteger o número: \d na fila/);
    assert.match(r.estado3.txt, /Na fila \(\d+º\)/); assert.strictEqual(r.estado3.off, true);
    assert.match(r.todos, /Parar \(\d na fila\)/);
    assert.strictEqual(r.avisoFim, true); assert.strictEqual(r.todosFim, '📤 Enviar todos');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('reunião combinada na conversa é reconhecida (dia + hora) e não inventa reunião sem hora', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(() => {
      const seg = new Date(2026, 10, 2, 11, 0).getTime();   // segunda 02/11 11h
      const f = t => { const v = reuniaoDetectar(t, seg); return v ? new Date(v).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null; };
      return [f('Pode ser quinta às 15h?'), f('amanhã 10:30 fica bom'), f('dia 12/11 às 9h'), f('Hoje 14h'), f('segunda 9h'), f('Pode ser quinta?'), f('tenho 3 lojas'), f('ligo às 2h')];
    });
    assert.match(r[0], /qui.*05\/11.*15:00/);
    assert.match(r[1], /ter.*03\/11.*10:30/);
    assert.match(r[2], /12\/11.*09:00/);
    assert.match(r[3], /02\/11.*14:00/);
    assert.match(r[4], /seg.*09\/11.*09:00/, 'segunda 9h já passou hoje: próxima semana');
    assert.deepStrictEqual(r.slice(5), [null, null, null]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('follow-up não envelhece: etapa velha sai quando chega a nova, vencidos ganham selo e botão', async () => {
  const a = await abrirApp({ largura: 390, rotas: [[/\/responder-followup$/, () => ({ ok: true })]] });
  try {
    const r = await a.pagina.evaluate(async () => {
      trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`) || document.body);
      await new Promise(r => setTimeout(r, 1500));
      const velho = new Date(Date.now() - 9 * 86400000).toISOString(), novo = new Date().toISOString();
      _filaFollowupsCache = [
        { id: 1, phone: '5511999990001', lead_nome: 'A', dia_etapa: 3, mensagem: 'x', criado_em: velho },
        { id: 2, phone: '11999990001', lead_nome: 'A', dia_etapa: 7, mensagem: 'y', criado_em: novo },
        { id: 3, phone: '11999990002', lead_nome: 'B', dia_etapa: 3, mensagem: 'z', criado_em: velho },
      ];
      fuTirarSuperados(); renderizarFilaFollowups();
      await new Promise(r => setTimeout(r, 100));
      return { ids: _filaFollowupsCache.map(i => i.id), aviso: document.getElementById('fu-vencidos').innerText, selo: !!document.querySelector('.fila-card[data-fu="3"] .fu-selo-vencido'), seloNovo: !!document.querySelector('.fila-card[data-fu="2"] .fu-selo-vencido') };
    });
    assert.deepStrictEqual(r.ids, [2, 3]);
    assert.ok(a.pedidos.some(p => p.corpo.filaId === 1 && p.corpo.acao === 'pular'), 'etapa velha pulada no servidor');
    assert.match(r.aviso, /1 follow-up esperando há mais de 5 dias[\s\S]*Pular os 1 vencidos/);
    assert.strictEqual(r.selo, true); assert.strictEqual(r.seloNovo, false);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Pendências avisam quando parou (WhatsApp caiu, dias sem campanha) e interessado não é descartado sem motivo', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const seg = new Date(2026, 10, 2, 13, 0);   // segunda 13h
      const dias = diasUteisSem('2026-10-21T14:00:00Z', seg);
      pendChecarParou = async () => [{ id: 'a-wa', n: 1, urgente: true, texto: '📵 WhatsApp desconectado: campanhas e follow-ups não estão saindo', aba: 'integracoes', ir: 'Conectar' }];
      phContar = async (t, f) => t === 'fila_sugestoes' && f.some(x => x[0] === 'in') ? 2 : t === 'pipeline_leads' && f.some(x => x[2] === 'negociando') ? 3 : 0;
      _histRes = { ld: {}, pk: {}, wa: {} }; _histBuscas = [];
      await pendCarregar();
      const itens = [...document.querySelectorAll('#pend-lista .pend-item.urgente')].map(li => li.innerText.replace(/\s+/g, ' '));
      // descartar interessado abre o motivo
      let abriu = false; const orig = rsSemInteresse; rsSemInteresse = (g, v) => { abriu = v === true; };
      await rsDescartar({ interessado: true, itens: [{ id: 9 }], nome: 'X', ultimo: { phone: '11999990001' } });
      rsSemInteresse = orig;
      return { dias, itens, abriu };
    });
    assert.strictEqual(r.dias, 8, 'de 21/10 a segunda 02/11 13h: 22, 23, 26 a 30/10 e hoje = 8 dias úteis');
    assert.match(r.itens[0], /WhatsApp desconectado/);
    assert.ok(r.itens.some(t => /2 interessados esperando sua resposta/.test(t)));
    assert.ok(r.itens.some(t => /3 negociações paradas há mais de 7 dias/.test(t)));
    assert.strictEqual(r.abriu, true);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('criar campanha num nicho fraco oferece trocar pelo melhor nicho', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      _statsNicho = [{ nome: 'PetShop', env: 39, hum: 9 }, { nome: 'Contabilidade', env: 240, hum: 37 }, { nome: 'Facilities', env: 98, hum: 10 }];
      let buscou = null; buscar = () => { buscou = document.getElementById('nicho').value + ' | ' + document.getElementById('local').value; };
      const p = nichoFracoTrocar('Facilities', 'São Paulo');
      await new Promise(r => setTimeout(r, 50));
      const txt = document.getElementById('nicho-fraco-modal').innerText;
      [...document.querySelectorAll('#nicho-fraco-modal button')].find(b => /Buscar PetShop/.test(b.textContent)).click();
      const trocou = await p;
      const semAviso = await nichoFracoTrocar('Contabilidade', 'SP');
      return { txt, trocou, buscou, semAviso };
    });
    assert.match(r.txt, /Facilities trouxe 10,2% de interessados[\s\S]*PetShop, o seu melhor, trouxe 23,1%/);
    assert.strictEqual(r.trocou, true); assert.strictEqual(r.buscou, 'PetShop | São Paulo');
    assert.strictEqual(r.semAviso, false, 'Contabilidade rende 15%: acima de 60% do melhor');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Pesquisa da empresa: lê site e CNPJ, mostra o que faz, quem decide e o gancho, e a DM do Instagram usa', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' }); config.openai = { key: '••••' }; config.iaProvider = 'openai';
      const chamadas = [];
      _srv = async (c, corpo) => { chamadas.push(c); if (c === '/site-texto') return { titulo: 'Sol Facilities', texto: 'Limpeza e portaria para condomínios. CNPJ 11.222.333/0001-81', cnpjs: ['11222333000181'] };
        return { cnpj: '11222333000181', razao_social: 'SOL SERVICOS LTDA', porte: 'MICRO EMPRESA', abertura: '2019-03-10', atividade: 'Limpeza em prédios', situacao: 'ATIVA', socios: [{ nome: 'MARIA DA SILVA', qualificacao: '49-Sócio-Administrador' }, { nome: 'JOAO SOUZA', qualificacao: 'Sócio' }] }; };
      let promptPesq = '';
      iaServidor = async p => { if (/pesquisando uma empresa/.test(p)) { promptPesq = p; return '{"oque_faz":"Limpeza e portaria para condomínios","publico":"síndicos e administradoras","dor":"achar gente para prospectar condomínios","gancho":"Vi que vocês cuidam de portaria e limpeza para condomínios"}'; } return 'DM gerada'; };
      const lead = { title: 'Sol Facilities', phone: '11999990001', website: 'https://sol.com.br', instagram: 'https://instagram.com/solfac', rating: 4.8, reviews: 40, place_id: 'pSol' };
      todosLeads = [lead]; _leadsBase = [lead];
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)); renderPagina(1);
      toggleExpandScore(0, document.getElementById('lead-row-0').querySelector('[onclick^="toggleExpandScore("]'));
      await pesqClicar(0);
      const txt = document.getElementById('pq-0').innerText;
      const ig = igPrompt(lead, { nome: 'Kaizen', instrucoes: 'x' });
      const guardado = (userGet('pesquisas', {}) || {}).pSol;
      return { chamadas, txt, ig, dec: lead.decisores && lead.decisores[0], guardado: !!guardado, promptPesq };
    });
    assert.deepStrictEqual(r.chamadas, ['/site-texto', '/cnpj?n=11222333000181']);
    assert.match(r.txt, /O que faz: Limpeza e portaria para condomínios/);
    assert.match(r.txt, /Quem decide: Maria da Silva \(Sócio-Administrador\)/);
    assert.match(r.txt, /11\.222\.333\/0001-81 · aberta há \d+ anos · MICRO EMPRESA/);
    assert.match(r.txt, /Vi que vocês cuidam de portaria/);
    assert.match(r.ig, /Gancho pesquisado.*portaria e limpeza/);
    assert.strictEqual(r.dec.nome, 'Maria da Silva');
    assert.strictEqual(r.guardado, true);
    assert.match(r.promptPesq, /nunca|sem citar avaliação negativa/i);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('cadência com caminhos: "agora não" vira lembrete em 30/60/90 dias, leu e não respondeu reescreve, Não contatar sai do follow-up', async () => {
  const a = await abrirApp({ largura: 390, rotas: [[/\/responder-followup$/, () => ({ ok: true })]] });
  try {
    const r = await a.pagina.evaluate(async () => {
      const re = ['No momento não, me procura no ano que vem', 'Agora não, quem sabe mais pra frente', 'retorne daqui uns 2 meses', 'Tenho interesse sim', 'Pode ser quinta?'].map(t => RE_DEPOIS.test(t));
      trocarAba('respostas', document.querySelector(`.nav-item[onclick*="'respostas'"]`) || document.body);
      await new Promise(r => setTimeout(r, 1500));
      _naoContatar = [{ phone: '11999990009', nome: 'Bloqueada' }]; _optOutTels = new Set();
      _cpEntregas = { t: Date.now(), m: { [prTel('11999990001')]: { status: 4 } } };
      _filaFollowupsCache = [
        { id: 1, phone: '11999990001', lead_nome: 'Leu', dia_etapa: 3, mensagem: 'oi', criado_em: new Date().toISOString() },
        { id: 2, phone: '11999990009', lead_nome: 'Bloqueada', dia_etapa: 3, mensagem: 'oi', criado_em: new Date().toISOString() },
      ];
      fuTirarSuperados(); renderizarFilaFollowups();
      iaServidor = async () => 'Ângulo novo, posso te mandar um exemplo?';
      const leuTxt = document.querySelector('.fila-card[data-fu="1"] .fu-leu')?.innerText || '';
      await fuReescreverLeu(1, document.querySelector('.fila-card[data-fu="1"] .fu-leu button'));
      await new Promise(r => setTimeout(r, 300));
      return { re, ids: _filaFollowupsCache.map(i => i.id), leuTxt, novo: document.getElementById('fu-texto-1').value };
    });
    assert.deepStrictEqual(r.re, [true, true, true, false, false]);
    assert.deepStrictEqual(r.ids, [1], 'Não contatar sai da fila');
    assert.ok(a.pedidos.some(p => p.corpo.filaId === 2 && p.corpo.acao === 'pular'));
    assert.match(r.leuTxt, /Leu e não respondeu/);
    assert.strictEqual(r.novo, 'Ângulo novo, posso te mandar um exemplo?');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('aquecer antes da DM: seguir e curtir hoje, DM amanhã (quem está aquecendo espera; aquecido vai para o topo)', async () => {
  const a = await abrirApp({ largura: 390, aquecer: true });
  try {
    const r = await a.pagina.evaluate(async () => {
      _igFeitos = new Set(); _igHoje = 0;
      const A = { title: 'Alfa', phone: '', instagram: 'https://instagram.com/alfa', rating: 4.5 }, B = { title: 'Beta', phone: '', instagram: 'https://instagram.com/beta', rating: 4.9 };
      todosLeads = [A, B]; _leadsBase = [A, B];
      window.open = () => null;
      igAbordar([A]);
      await new Promise(r => setTimeout(r, 300));
      const passo = document.querySelector('.ig-modal .aq-box')?.innerText || '';
      [...document.querySelectorAll('.ig-modal .aq-box button')].find(b => /Segui e curti/.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 200));
      const filaHoje = igFila().map(l => l.title);
      const aq = userGet('aquecidos', {}); aq['ig:alfa'] = Date.now() - 21 * 3600000; userSet('aquecidos', aq);
      const filaAmanha = igFila().map(l => l.title);
      iaServidor = async () => 'DM';
      igAbordar([A]);
      await new Promise(r => setTimeout(r, 300));
      const amanha = document.querySelector('.ig-modal')?.innerText || '';
      return { passo, filaHoje, filaAmanha, amanha };
    });
    assert.match(r.passo, /Aquecer primeiro[\s\S]*Seguir e curta 1 ou 2 posts|Aquecer primeiro/);
    assert.deepStrictEqual(r.filaHoje, ['Beta'], 'Alfa aquecendo: só amanhã');
    assert.deepStrictEqual(r.filaAmanha, ['Alfa', 'Beta'], 'aquecido vai para o topo');
    assert.match(r.amanha, /Aquecido: você seguiu e curtiu[\s\S]*Hora da DM/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Pipeline diz o próximo passo: prioridades do dia e o passo em cada negócio', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(() => {
      const agora = Date.now(), dia = 86400000;
      const L = (id, o) => Object.assign({ id, name: 'L' + id, phone: '1199999000' + id, col: 'respondeu', movedAt: agora, valor: null }, o);
      const casos = {
        reuniao: L(1, { col: 'negociando', reuniaoEm: agora + 3 * 3600000 }),
        resultado: L(2, { col: 'negociando', reuniaoEm: agora - dia, movedAt: agora - 2 * dia }),
        ligar: L(3, { col: 'negociando', movedAt: agora - 9 * dia, valor: 500 }),
        proposta: L(4, { col: 'negociando', movedAt: agora - dia }),
        quente: L(5, { ultimaClassificacao: 'quente', movedAt: agora - dia }),
        frio: L(6, { movedAt: agora - 20 * dia }),
        ganho: L(7, { col: 'fechado' }),
      };
      const passos = Object.fromEntries(Object.entries(casos).map(([k, l]) => [k, (pkProximoPasso(l) || {}).txt || null]));
      pkLeads = Object.values(casos); pkSave(); trocarAba('pipeline', document.querySelector(`.nav-item[onclick*="'pipeline'"]`) || document.body); pkRender();
      const prio = [...document.querySelectorAll('#pk-prioridades .pk-prio-item b')].map(b => b.textContent);
      return { passos, prio };
    });
    assert.match(r.passos.reuniao, /Confirmar a reunião/);
    assert.match(r.passos.resultado, /registre o resultado/);
    assert.match(r.passos.ligar, /Ligar: negociação parada há 9 dias/);
    assert.match(r.passos.proposta, /Mandar a proposta/);
    assert.match(r.passos.quente, /Propor reunião/);
    assert.match(r.passos.frio, /Último toque ou Perdido/);
    assert.strictEqual(r.passos.ganho, null);
    assert.deepStrictEqual(r.prio, ['L1', 'L2', 'L3', 'L4', 'L5']);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('proposta pelo WhatsApp: IA escreve, envia e o card vai para Negociando com valor e lembrete', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      _produtos = [{ id: 'p1', nome: 'Kaizen Connect', instrucoes: 'Automação de LinkedIn', padrao: true }];
      pkLeads = [{ id: 'x1', name: 'Padaria Sol', phone: '11999990001', col: 'respondeu', movedAt: Date.now(), nota: 'quer mais clientes' }]; pkSave();
      let promptIA = ''; iaServidor = async p => { promptIA = p; return '*Proposta Kaizen*\n• Item\n*Investimento*: 497/mês'; };
      const env = []; _srv = async (c, corpo) => { env.push({ c, corpo }); return { success: true }; };
      pkProposta('x1');
      const m = document.getElementById('pk-prop-modal');
      m.querySelector('input[inputmode="decimal"]').value = '497';
      await [...m.querySelectorAll('button')].find(b => /Escrever com IA/.test(b.textContent)).onclick();
      const texto = m.querySelector('textarea').value;
      await [...m.querySelectorAll('button')].find(b => /Enviar no WhatsApp/.test(b.textContent)).onclick();
      pkLoad(); const l = pkLeads.find(x => x.id === 'x1');
      return { promptIA, texto, env, col: l.col, valor: l.valor, prox: l.proximaAcaoTxt, nota: l.nota, fechado: m.hidden };
    });
    assert.match(r.promptIA, /Investimento\*: 497[\s\S]*quer mais clientes[\s\S]*Kaizen Connect/);
    assert.match(r.texto, /Proposta Kaizen/);
    assert.strictEqual(r.env[0].c, '/send-message'); assert.match(r.env[0].corpo.message, /Proposta Kaizen/);
    assert.strictEqual(r.col, 'negociando'); assert.strictEqual(r.valor, 497);
    assert.strictEqual(r.prox, 'Cobrar o retorno da proposta'); assert.match(r.nota, /Proposta enviada: 497/);
    assert.strictEqual(r.fechado, true);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Painel do time: ranking por vendedor com tempo de resposta e o que está ficando para trás', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const ontem = new Date(Date.now() - 86400000).toISOString(), velho = new Date(Date.now() - 12 * 86400000).toISOString();
      supabaseClient.rpc = async (nome, args) => nome === 'painel_equipe' ? { data: [
        { nome: 'Você', envios: 272, responderam: 38, interessados: 14, interessados_esperando: 0, minutos_resposta: 149, reunioes: 0, ganhos: 0, valor_ganho: 0, fu_vencidos: 95, ultimo_envio: velho },
        { nome: 'Gustavo', envios: 42, responderam: 11, interessados: 15, interessados_esperando: 0, minutos_resposta: 54, reunioes: 1, ganhos: 1, valor_ganho: 1500, fu_vencidos: 0, ultimo_envio: ontem },
      ], error: null } : { data: null, error: null };
      await ptCarregar();
      return { visivel: !document.getElementById('pt-time').hidden, linhas: [...document.querySelectorAll('#pt-corpo tr')].map(t => t.innerText.replace(/\s+/g, ' ').trim()) };
    });
    assert.strictEqual(r.visivel, true);
    assert.match(r.linhas[1], /🏆 Gustavo 42 26,2% 15 54 min — — 1 1 · R\$ 1\.500 ✅ em dia/);
    assert.match(r.linhas[2], /Você 272 14% 14 2,5 h — — 0 0 ⌛ 95 follow-ups vencidos · ⏸ 12 dias sem envio/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('CNPJ é procurado sozinho no Google quando o site não mostra', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      const chamadas = [];
      _srv = async c => { chamadas.push(c); if (c === '/site-texto') return { titulo: 'X', texto: 'sem cnpj aqui', cnpjs: [] };
        return { cnpj: '11222333000181', razao_social: 'LUA LTDA', porte: 'ME', abertura: '2015-01-01', atividade: 'Oficina', situacao: 'ATIVA', socios: [{ nome: 'ANA LUZ', qualificacao: 'Sócio-Administrador' }] }; };
      let pedidoGoogle = null;
      _apiOficial = async (c, o) => { if (c === '/leads/cnpj-google') pedidoGoogle = { c, corpo: JSON.parse(o.body) }; return c === '/leads/cnpj-google' ? { cnpj: '11222333000181' } : { linkedin: null }; };
      iaServidor = async () => '{"oque_faz":"Oficina","publico":"motoristas","dor":"x","gancho":"y"}';
      const l = { title: 'Oficina Lua', phone: '11999990002', website: 'https://lua.com.br', address: 'Rua A, 10 - Centro, Campinas - SP', place_id: 'pLua' };
      const p = await pesquisarLead(l);
      const semNada = await (async () => { _apiOficial = async () => ({ cnpj: null }); _srv = async c => c === '/site-texto' ? { cnpjs: [] } : null; return pesquisarLead({ title: 'Sem Nada', phone: '11999990003', website: 'https://x.com', place_id: 'pNada' }); })();
      return { chamadas, pedidoGoogle, html: pesqHtml(p), dec: p.decisor && p.decisor.nome, semNada: pesqHtml(semNada) };
    });
    assert.strictEqual(r.pedidoGoogle.c, '/leads/cnpj-google');
    assert.strictEqual(r.pedidoGoogle.corpo.nome, 'Oficina Lua');
    assert.deepStrictEqual(r.chamadas, ['/site-texto', '/cnpj?n=11222333000181']);
    assert.match(r.html, /achado no Google pelo nome/);
    assert.strictEqual(r.dec, 'Ana Luz');
    assert.match(r.semNada, /CNPJ não apareceu no site nem no Google/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('depois da busca, CNPJ das melhores empresas é puxado sozinho (sem IA) e aparece no detalhe', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      let ia = 0; iaServidor = async () => { ia++; return '{}'; };
      _srv = async c => c === '/site-texto' ? { cnpjs: [] } : { cnpj: '11222333000181', porte: 'ME', abertura: '2010-05-01', atividade: 'Padaria', situacao: 'ATIVA', socios: [{ nome: 'JOSE PAO', qualificacao: 'Sócio-Administrador' }] };
      _apiOficial = async (c, o) => JSON.parse(o.body).nome === 'Padaria Sol' ? { cnpj: '11222333000181' } : { cnpj: null };
      const leads = [
        { title: 'Padaria Sol', phone: '11999990001', website: 'https://sol.com.br', rating: 4.9, reviews: 200, is_whatsapp: true, place_id: 'a1' },
        { title: 'Sem Registro', phone: '11999990002', rating: 4.0, reviews: 10, place_id: 'a2' },
      ];
      todosLeads = leads.slice(); _leadsBase = leads.slice();
      await cnpjAutoMelhores(leads);
      const segunda = await (async () => { let n = 0; const orig = _srv; _srv = async (...x) => { n++; return orig(...x); }; await cnpjAutoMelhores(leads); _srv = orig; return n; })();
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)); renderPagina(1);
      const idx = todosLeads.indexOf(leads[0]);
      toggleExpandScore(idx, document.getElementById('lead-row-' + idx).querySelector('[onclick^="toggleExpandScore("]'));
      return { ia, segunda, card: document.getElementById('pq-' + idx).innerText, dec: leads[0].decisores && leads[0].decisores[0].nome, sem: pesqDe(leads[1]).semCnpj };
    });
    assert.strictEqual(r.ia, 0, 'sem gastar IA');
    assert.strictEqual(r.segunda, 0, 'não busca de novo quem já foi tentado');
    assert.match(r.card, /Quem decide: Jose Pao/);
    assert.match(r.card, /aberta há \d+ anos · ME · Padaria \(achado no Google pelo nome\)/);
    assert.match(r.card, /CNPJ puxado sozinho depois da busca[\s\S]*Pesquisar com IA/);
    assert.strictEqual(r.dec, 'Jose Pao');
    assert.strictEqual(r.sem, true);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('decisor no LinkedIn: perfil do sócio confirmado, nome indicado no WhatsApp, fila "Decisores do dia", cargo por produto e placar', async () => {
  const a = await abrirApp({ largura: 390, aquecer: true });
  try {
    const r = await a.pagina.evaluate(async () => {
      // 1) perfil do sócio achado pelo nome
      const pedidos = [];
      _apiOficial = async (c, o) => { pedidos.push({ c, corpo: JSON.parse(o.body) }); return { linkedin: 'https://br.linkedin.com/in/josepao', cargo: 'Sócio' }; };
      const lead = { title: 'Padaria Sol', phone: '11999990001', address: 'Rua A - Centro, Campinas - SP', decisores: [{ nome: 'Jose Pao', cargo: 'Sócio-Administrador', fonte: 'receita' }, { nome: 'Ana Pao', cargo: 'Sócio', fonte: 'receita' }] };
      const url = await decisorPerfil(lead);
      // 2) nome indicado na conversa
      const nomes = ['Quem cuida disso é o Carlos Mendes, ele volta segunda', 'Fala com a Dra. Ana', 'Manda pro e-mail do Ricardo', 'Fale com o comercial', 'Oi, tudo bem?'].map(decisorDoTexto);
      // 4) cargo por produto
      _produtos = [{ id: 'p1', nome: 'Kaizen', instrucoes: 'x', padrao: true }];
      prodCargoTrocar('comercial');
      const termos = prodCargoTermos(); const busca = decodeURIComponent(liPessoasUrl({ title: 'Outra', linkedin: 'https://www.linkedin.com/company/outra/' }));
      // 3) fila: Jose aquecer hoje; Beta convite há 4 dias (aceitou?); Gama 8 dias sem aceitar com 2º sócio
      const B = { title: 'Beta', phone: '11999990002', decisores: [{ nome: 'Bia Beta' }] }, G = { title: 'Gama', phone: '11999990003', decisores: [{ nome: 'Gil Gama' }, { nome: 'Gui Gama' }] };
      todosLeads = [lead, B, G]; _leadsBase = [lead, B, G];
      const dias = d => new Date(Date.now() - d * 86400000).toISOString();
      const feitos = [{ chave: liChave(B), criado_em: dias(4) }, { chave: liChave(G), criado_em: dias(8) }];
      const fila = liDecisoresDia([], feitos).map(x => x.dec.nome + ' | ' + x.etapa.txt);
      const box = document.createElement('div'); liPlacar(box, feitos);
      const placar = box.innerText.replace(/\s+/g, ' ');
      return { url, pedido: pedidos[0], nomes, termos, busca, fila, placar };
    });
    assert.strictEqual(r.url, 'https://www.linkedin.com/in/josepao/');
    assert.deepStrictEqual(r.pedido, { c: '/leads/decisor-perfil', corpo: { pessoa: 'Jose Pao', empresa: 'Padaria Sol', cidade: r.pedido.corpo.cidade } });
    assert.deepStrictEqual(r.nomes, ['Carlos Mendes', 'Ana', 'Ricardo', null, null]);
    assert.deepStrictEqual(r.termos, ['diretor comercial', 'gerente comercial', 'head de vendas']);
    assert.strictEqual(r.busca, 'https://www.linkedin.com/company/outra/people/?keywords=diretor comercial');
    assert.deepStrictEqual(r.fila, ['Jose Pao | Aquecer hoje: ver o perfil e curtir um post', 'Gil Gama | 8 dias sem aceitar: tentar Gui Gama'], '"aceitou?" fica só no lote');
    assert.match(r.placar, /1 de 100\s*convites na semana/); assert.match(r.placar, /aceitaram \(0 de 2\)/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('na lista da busca aparece quem decide (com LinkedIn) e o botão "Decisores no LinkedIn"', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      _srv = async c => c === '/site-texto' ? { cnpjs: ['11222333000181'] } : { cnpj: '11222333000181', porte: 'MICRO EMPRESA', abertura: '2012-01-01', atividade: 'x', situacao: 'ATIVA', socios: [{ nome: 'JOSE PAO', qualificacao: 'Sócio-Administrador' }] };
      _apiOficial = async c => c === '/leads/decisor-perfil' ? { linkedin: 'https://www.linkedin.com/in/josepao/' } : { cnpj: null };
      _liFeitos = new Set();
      const leads = [{ title: 'Padaria Sol', phone: '11999990001', website: 'https://sol.com.br', rating: 4.9, reviews: 120, is_whatsapp: true, place_id: 'z1' }];
      todosLeads = leads.slice(); _leadsBase = leads.slice();
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)); renderPagina(1); atualizarAcoesBusca();
      await cnpjAutoMelhores(leads);
      return { chip: document.querySelector('#lead-row-0 .dec-chip')?.textContent || '', botao: document.getElementById('ps-btn-li')?.textContent || '', visivel: !document.getElementById('ps-btn-li')?.hidden };
    });
    assert.match(r.chip, /👔 Jose Pao · Sócio-Administrador · in ✓ · ME/);
    assert.match(r.botao, /Decisores no LinkedIn \(1\)/); assert.strictEqual(r.visivel, true);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('busca de pessoas no LinkedIn sem aspas nem OR (o LinkedIn dava "Nenhum resultado") e plano B pelo Google', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(() => [
      decodeURIComponent(liPessoasUrl({ title: 'LMC Facilities LTDA', address: 'Rua A - Centro, São Paulo - SP' })),
      decodeURIComponent(liPessoasUrl({ title: 'LMC Facilities', decisores: [{ nome: 'Luiz Melo' }] })),
      decodeURIComponent(liGoogleUrl({ title: 'LMC Facilities LTDA', address: 'Rua A - Centro, São Paulo - SP' })),
    ]);
    assert.strictEqual(r[0], 'https://www.linkedin.com/search/results/people/?keywords=LMC Facilities');
    assert.strictEqual(r[1], 'https://www.linkedin.com/search/results/people/?keywords=Luiz Melo');
    assert.match(r[2], /^https:\/\/www\.google\.com\/search\?q=site:linkedin\.com\/in "LMC Facilities" \(sócio OR sócia OR proprietário/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('abordagem no LinkedIn acha o perfil do decisor e "Abrir perfil" vai direto nele', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      _apiOficial = async (c, o) => c === '/leads/decisor-perfil' ? { linkedin: 'https://www.linkedin.com/in/lucas-martins-lmc/', cargo: 'Sócio' } : {};
      iaServidor = async () => 'CONVITE: Olá!\nMENSAGEM: Oi';
      window._abertos = []; window.open = u => { window._abertos.push(u); return null; };
      _liFeitos = new Set(); _liHoje = 0;
      liAbordar([{ title: 'LMC Facilities', phone: '11999990001', decisores: [{ nome: 'Lucas Martins Costa', fonte: 'receita' }] }]);
      await new Promise(r => setTimeout(r, 400));
      const bt = [...document.querySelectorAll('.li-modal button')].find(b => /Abrir perfil/.test(b.textContent));
      bt && bt.click();
      return { texto: bt && bt.textContent, aberto: window._abertos[0], perfil: document.querySelector('.li-modal .li-perfil').value };
    });
    assert.strictEqual(r.texto, 'Abrir perfil');
    assert.strictEqual(r.aberto, 'https://www.linkedin.com/in/lucas-martins-lmc/');
    assert.strictEqual(r.perfil, 'https://www.linkedin.com/in/lucas-martins-lmc/');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('telefone da Receita: mostra o celular do cadastro e "Usar no WhatsApp" troca o número da campanha', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    const r = await a.pagina.evaluate(() => {
      const l = { title: 'LMC Facilities', phone: '551133334444', place_id: 'lmc', decisores: [{ nome: 'Lucas Martins', fonte: 'receita' }] };
      pesqSalvar(l, { parcial: true, cnpj: { cnpj: '11222333000181', porte: 'ME', telefones: ['11987654321', '1133334444'], email: 'contato@lmc.com.br', socios: [] }, decisor: { nome: 'Lucas Martins' }, em: Date.now() });
      todosLeads = [l]; _leadsBase = [l];
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)); renderPagina(1);
      const chip = document.querySelector('#lead-row-0 .dec-chip').textContent;
      toggleExpandScore(0, document.getElementById('lead-row-0').querySelector('[onclick^="toggleExpandScore("]'));
      const card = document.getElementById('pq-0').innerText;
      [...document.querySelectorAll('#pq-0 button')].find(b => /Usar no WhatsApp/.test(b.textContent)).click();
      return { chip, card, phone: l.phone, antigo: l.telefone_maps, wa: l.is_whatsapp };
    });
    assert.match(r.chip, /📱/);
    assert.match(r.card, /Na Receita: \(11\) 98765-4321 · celular, costuma ser do dono/);
    assert.match(r.card, /Na Receita: \(11\) 3333-4444 · fixo/);
    assert.match(r.card, /E-mail na Receita: contato@lmc\.com\.br/);
    assert.strictEqual(r.phone, '5511987654321'); assert.strictEqual(r.antigo, '551133334444'); assert.strictEqual(r.wa, null);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('recuperação judicial vira aviso no card e no decisor, e o fim da busca avisa com o resumo', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const avisos = []; _notificarSistema = async (t, c, aba) => { avisos.push({ t, c, aba }); };
      const c = { cnpj: '00605377000174', situacao: 'ATIVA', porte: 'DEMAIS', razao_social: 'VIBELPLAST EMBALAGENS PLASTICAS LTDA - EM RECUPERACAO JUDICIAL', socios: [{ nome: 'VITOR COSTA', qualificacao: 'Sócio-Administrador' }] };
      const leads = [
        { title: 'Vibelplast', phone: '11999990001', place_id: 'v1', decisores: [{ nome: 'Vitor Costa', cargo: 'Sócio-Administrador', linkedin: 'https://br.linkedin.com/in/vitorcosta' }] },
        { title: 'Outra', phone: '11999990002', place_id: 'v2' },
      ];
      pesqSalvar(leads[0], { parcial: true, cnpj: c, decisor: { nome: 'Vitor Costa' } });
      todosLeads = leads.slice(); _leadsBase = leads.slice();
      buscaFinalizadaAvisar(leads);
      return {
        chip: decisorChip(leads[0], 0), card: pesqHtml(pesqDe(leads[0]), 0),
        inapta: cnpjAlerta({ situacao: 'INAPTA', razao_social: 'X LTDA' }), ok: cnpjAlerta({ situacao: 'ATIVA', razao_social: 'X LTDA' }),
        avisos,
      };
    });
    assert.match(r.chip, /in ✓.*⚠️ Em recuperação judicial/);
    assert.match(r.card, /⚠️ <b>Em recuperação judicial<\/b>/);
    assert.strictEqual(r.inapta, 'CNPJ inapta na Receita');
    assert.strictEqual(r.ok, '');
    assert.strictEqual(r.avisos.length, 1);
    assert.match(r.avisos[0].t, /Busca finalizada/);
    assert.match(r.avisos[0].c, /2 empresas · 1 com CNPJ · 1 decisor \(1 com LinkedIn ✓\) · ⚠️ 1 com problema na Receita/);
    assert.strictEqual(r.avisos[0].aba, 'prospeccao');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn x WhatsApp: quem respondeu no WhatsApp sai do LinkedIn, WhatsApp recente espera 5 dias e o sem resposta sobe com aviso', async () => {
  const dias = d => new Date(Date.now() - d * 86400000).toISOString();
  const a = await abrirApp({ largura: 390, aquecer: true, db: { leads: [
    { user_id: 'u1', phone: '5511999990001', enviado_em: dias(2), respondeu: false },
    { user_id: 'u1', phone: '5511999990002', enviado_em: dias(6), respondeu: false },
    { user_id: 'u1', phone: '5511999990003', enviado_em: dias(6), respondeu: true },
  ] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      const A = { title: 'Alfa', phone: '11999990001', decisores: [{ nome: 'Ana Alfa' }] };
      const B = { title: 'Beta', phone: '11999990002', decisores: [{ nome: 'Bia Beta' }] };
      const C = { title: 'Gama', phone: '11999990003', decisores: [{ nome: 'Gil Gama' }] };
      // sem decisor no lead, mas com o sócio guardado na pesquisa da empresa
      const D = { title: 'Delta', phone: '11999990004', place_id: 'd1' };
      pesqSalvar(D, { parcial: true, cnpj: { cnpj: '1', socios: [{ nome: 'DIEGO DELTA', qualificacao: 'Sócio-Administrador' }] }, decisor: { nome: 'Diego Delta', cargo: 'Sócio-Administrador' } });
      todosLeads = [A, B, C, D]; _leadsBase = [A, B, C, D]; _liFeitos = new Set();
      await waEstadoCarregar(true);
      const dia = liDecisoresDia([], []).map(x => x.dec.nome + ' | ' + x.etapa.ic + ' ' + x.etapa.txt);
      return { dia, fila: liFila().map(l => l.title), entra: [A, B, C].map(l => CANAIS.linkedin.entra(l)) };
    });
    assert.strictEqual(r.dia.length, 3);
    assert.match(r.dia[0], /^Bia Beta \| 👀 📵 Sem resposta no WhatsApp há 6 dias · Aquecer hoje/);
    assert.ok(r.dia.some(x => /^Diego Delta \| 👀 Aquecer hoje/.test(x)), r.dia.join('\n'));
    assert.ok(r.dia.some(x => /^Ana Alfa \| ⏳ WhatsApp há 2 dias sem resposta: o LinkedIn entra no 5º dia/.test(x)), r.dia.join('\n'));
    assert.ok(!r.dia.some(x => /Gil Gama/.test(x)), 'quem respondeu no WhatsApp não recebe convite frio');
    assert.deepStrictEqual(r.fila.sort(), ['Beta', 'Delta']);
    assert.deepStrictEqual(r.entra, [false, true, false]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn: "Quem aceitou?" em lote, cadência depois do aceite e rotina na aba', async () => {
  const dias = d => new Date(Date.now() - d * 86400000).toISOString();
  const a = await abrirApp({ largura: 390, db: { abordagens_linkedin: [
    { user_id: 'u1', chave: 'k1', nome: 'Alfa', pessoa: 'Ana Alfa', telefone: '11999990001', linkedin: 'https://www.linkedin.com/in/anaalfa/', criado_em: dias(3), etapa: 0 },
    { user_id: 'u1', chave: 'k2', nome: 'Beta', pessoa: 'Bia Beta', telefone: '11999990002', criado_em: dias(25), etapa: 0 },
    { user_id: 'u1', chave: 'k3', nome: 'Gama', pessoa: 'Gil', telefone: '11999990003', criado_em: dias(1), etapa: 0 },
  ] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      iaServidor = async () => 'CONVITE: Olá\nMENSAGEM: Vi que vocês atendem condomínios. Faz sentido conversarmos 15 min?';
      window._abertos = []; window.open = u => { window._abertos.push(u); return null; };
      const espera = ms => new Promise(x => setTimeout(x, ms));
      await liRowsCarregar(true);
      const esperando = liEsperandoAceite(_liRows).map(x => x.chave);
      liAceitesLote(liEsperandoAceite(_liRows));
      const textoLote = document.querySelector('.li-lote-modal').textContent;
      document.querySelector('.li-lote-modal input[data-chave="k1"]').click();
      const botao = [...document.querySelectorAll('.li-lote-modal button')].find(b => /Confirmar/.test(b.textContent));
      const rot = botao.textContent; botao.click(); await espera(300);
      const k1 = _db.abordagens_linkedin.find(x => x.chave === 'k1'), k2 = _db.abordagens_linkedin.find(x => x.chave === 'k2');
      const depoisLote = { k1: { etapa: k1.etapa, aceito: !!k1.aceito_em }, k2: k2.resultado };
      const hoje = liParaHoje(_liRows).map(x => x.chave);
      // mensagem 1 (depois do aceite)
      liMsgModal(_liRows.find(x => x.chave === 'k1')); await espera(200);
      const m1 = document.querySelector('.li-msg-modal .li-msg-texto').value;
      [...document.querySelectorAll('.li-msg-modal button')].find(b => /Copiar e abrir perfil/.test(b.textContent)).click(); await espera(50);
      [...document.querySelectorAll('.li-msg-modal button')].find(b => /Mandei/.test(b.textContent)).click(); await espera(300);
      const prox = (new Date(k1.proxima_em).getTime() - Date.now()) / 86400000;
      // aba LinkedIn: rotina + funil
      trocarAba('linkedin', document.querySelector(`.nav-item[onclick*="'linkedin'"]`)); await canalAbrir('linkedin', true); await espera(200);
      return { esperando, textoLote, rot, depoisLote, hoje, m1, aberto: window._abertos[0], etapa: k1.etapa, prox, retomado: !!k1.retomado_em,
        rotina: (document.querySelector('#canal-linkedin .li-rotina') || {}).textContent || '', funil: ((document.querySelector('#canal-linkedin .li-funil') || {}).textContent || '').replace(/\s+/g, ' ') };
    });
    assert.deepStrictEqual(r.esperando, ['k2', 'k1'], 'convite de 1 dia ainda não entra');
    assert.match(r.textoLote, /Arquivar quem não aceitou em 21 dias \(1\)/);
    assert.strictEqual(r.rot, 'Confirmar 1 aceite');
    assert.deepStrictEqual(r.depoisLote, { k1: { etapa: 1, aceito: true }, k2: 'nao_aceitou' });
    assert.deepStrictEqual(r.hoje, ['k1']);
    assert.match(r.m1, /Faz sentido conversarmos/);
    assert.strictEqual(r.aberto, 'https://www.linkedin.com/in/anaalfa/');
    assert.strictEqual(r.etapa, 2); assert.ok(r.prox > 3 && r.prox < 4.2, 'follow-up no dia 4: ' + r.prox); assert.strictEqual(r.retomado, true);
    assert.match(r.rotina, /Rotina do LinkedIn de hoje/);
    assert.match(r.funil, /3\s*convites/); assert.match(r.funil, /1\s*aceitaram50% de aceite/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn: resposta colada vira reunião no Pipeline, indicação vira decisor, e o WhatsApp para de mandar follow-up', async () => {
  const dias = d => new Date(Date.now() - d * 86400000).toISOString();
  const a = await abrirApp({ largura: 390, db: { abordagens_linkedin: [
    { user_id: 'u1', chave: 'k1', nome: 'Alfa', pessoa: 'Ana Alfa', telefone: '11999990001', criado_em: dias(6), etapa: 2, aceito_em: dias(4) },
    { user_id: 'u1', chave: 'nome:beta|99990002', nome: 'Beta', pessoa: 'Bia Beta', telefone: '11999990002', criado_em: dias(6), etapa: 0 },
  ] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(x => setTimeout(x, ms));
      iaServidor = async () => '{"classe":"interessado","nome_indicado":"","resposta":"Ótimo, Ana! Quinta às 15h fica confirmado."}';
      window.open = () => null;
      pkLeads = [{ id: 1, name: 'Alfa', phone: '11999990001', col: 'contatado', canal: 'linkedin', movedAt: Date.now() }]; pkSave();
      liRespostaModal(null); await espera(200);
      const sel = document.querySelector('.li-resp-quem'); sel.value = 'k1'; sel.dispatchEvent(new Event('change'));
      document.querySelector('.li-resp-texto').value = 'Oi! Tenho interesse sim, pode ser quinta às 15h?';
      [...document.querySelectorAll('.li-resp-modal button')].find(b => /Entender/.test(b.textContent)).click(); await espera(200);
      const classe = document.querySelector('.li-resp-classe').value, sug = document.querySelector('.li-resp-sug').value, data = document.querySelector('.li-resp-data').value;
      document.querySelector('.li-resp-aplicar').click(); await espera(300);
      pkLoad(); const card = pkLeads.find(k => k.name === 'Alfa');
      const k1 = _db.abordagens_linkedin.find(x => x.chave === 'k1');
      // indicação
      await liRowsCarregar(true);
      await liAplicarResposta(_liRows.find(x => x.nome === 'Beta'), 'Quem cuida disso é o Carlos Mendes', 'indicou', { nome: 'Carlos Mendes' });
      const extra = (userGet('li_decisores_extra', []) || []).map(l => l.title + ': ' + l.decisores[0].nome);
      await liRowsCarregar(true);
      const dia = liDecisoresDia([], _liRows).map(x => x.dec.nome + ' | ' + x.etapa.acao);
      // follow-up do WhatsApp de quem respondeu no LinkedIn sai da fila
      _filaFollowupsCache = [{ id: 7, phone: '5511999990001', lead_nome: 'Alfa', canal: null, dia_etapa: 3, criado_em: new Date().toISOString() }, { id: 8, phone: '5511999990009', lead_nome: 'Outra', canal: null, dia_etapa: 3, criado_em: new Date().toISOString() }];
      fuTirarSuperados();
      return { classe, sug, data: !!data, col: card.col, reuniao: !!card.reuniaoEm, eventos: (card.eventos || []).map(e => e.txt), resultado: k1.resultado, k1classe: k1.classe, resposta: k1.resposta, extra, dia, fila: _filaFollowupsCache.map(i => i.id) };
    });
    assert.strictEqual(r.classe, 'reuniao', 'horário na resposta vence a IA');
    assert.match(r.sug, /Quinta às 15h/); assert.strictEqual(r.data, true);
    assert.strictEqual(r.col, 'negociando'); assert.strictEqual(r.reuniao, true);
    assert.ok(r.eventos.some(t => /Respondeu no LinkedIn/.test(t)), r.eventos.join('|'));
    assert.strictEqual(r.resultado, 'respondeu'); assert.strictEqual(r.k1classe, 'reuniao'); assert.match(r.resposta, /quinta às 15h/);
    assert.deepStrictEqual(r.extra, ['Beta: Carlos Mendes']);
    assert.ok(r.dia.includes('Carlos Mendes | indicado'), r.dia.join('\n'));
    assert.deepStrictEqual(r.fila, [8]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn: teste A/B do convite alterna as versões e passa a usar a que mais é aceita; funil no Painel', async () => {
  const dias = d => new Date(Date.now() - d * 86400000).toISOString();
  const linhas = [];
  ['gancho', 'curta', 'sem_nota'].forEach((v, j) => { for (let i = 0; i < 15; i++) linhas.push({ user_id: 'u1', chave: v + i, nome: v + i, criado_em: dias(5), etapa: 0, variante: v, aceito_em: i < [3, 9, 5][j] ? dias(4) : null }); });
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async (linhas) => {
      _liRows = [];
      const inicio = liAbEscolher();
      _liRows = [{ variante: 'gancho', criado_em: new Date(Date.now() - 5 * 86400000).toISOString() }];
      const segundo = liAbEscolher();
      _liRows = linhas;
      const melhor = liAbEscolher();
      const prompt = liPrompt({ title: 'X' }, null, '', '', 'curta');
      const el = liFunilEl(linhas, { env: 100, resp: 12 });
      return { inicio, segundo, melhor, prompt: /110 caracteres/.test(prompt), funil: el.textContent.replace(/\s+/g, ' ') };
    }, linhas);
    assert.strictEqual(r.inicio, 'gancho'); assert.notStrictEqual(r.segundo, 'gancho');
    assert.strictEqual(r.melhor, 'curta'); assert.strictEqual(r.prompt, true);
    assert.match(r.funil, /Nota curta 🏆/); assert.match(r.funil, /No WhatsApp, no mesmo período: 100 mensagens · 12% responderam/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('sinais de compra, canal certo por nicho e dor do Instagram', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const canais = ['Indústria de plástico', 'Clínica de estética', 'Mercado'].map(t => canalRecomendado(t).canal);
      const meses = d => new Date(Date.now() - d * 30.4 * 86400000).toISOString().slice(0, 10);
      const l = { title: 'Plásticos Alfa', phone: '11999990001', place_id: 'pa', decisores: [{ nome: 'João Alfa', cargo: 'Sócio' }] };
      pesqSalvar(l, { parcial: true, cnpj: { cnpj: '1', abertura: meses(6), porte: 'EMPRESA DE PEQUENO PORTE', socios: [] } });
      _apiOficial = async (c) => c === '/leads/vagas' ? { vagas: [{ titulo: 'Vendedor Externo - Plásticos Alfa', link: 'x' }] } : {};
      await vagasMelhores([l]);
      const sinais = liSinais(l).map(s => s.id), prompt = liPrompt(l, null, 'João', '');
      const ig = doresLead({ title: 'Studio X', instagram: 'https://instagram.com/x', website: 'https://x.com', igSeguidores: 300, igPosts: 12 }).find(d => d.id === 'igfraco');
      // filtros de redes na Prospecção
      const leads = [{ title: 'Clínica A', category: 'Clínica de estética', phone: '11999990011', is_whatsapp: true, instagram: 'https://www.instagram.com/clinicaa/' },
        { title: 'Indústria B', category: 'Indústria', phone: '11999990012', is_whatsapp: true, linkedin: 'https://www.linkedin.com/company/industriab/' },
        { title: 'Loja C', category: 'Loja', phone: '11999990013', is_whatsapp: true, decisores: [{ nome: 'Carla C', linkedin: 'https://www.linkedin.com/in/carlac/' }] },
        { title: 'Bar D', category: 'Bar', phone: '11999990014', is_whatsapp: true }];
      todosLeads = leads.slice(); _leadsBase = leads.slice();
      trocarAba('prospeccao', document.querySelector(`.nav-item[onclick*="'prospeccao'"]`)); renderPagina(1); atualizarAcoesBusca();
      const filtrar = k => { alternarFiltroExtra(k); const n = todosLeads.map(l => l.title); alternarFiltroExtra(k); return n; };
      return { canais, sinais, prompt, ig: ig && ig.rot({ igSeguidores: 300, igPosts: 12 }), rec: !!document.getElementById('ps-canal-rec'),
        fInsta: filtrar('cominsta'), fLi: filtrar('comli'), fDec: filtrar('decisor'), todos: todosLeads.length };
    });
    assert.deepStrictEqual(r.canais, ['linkedin', 'instagram', 'whatsapp']);
    assert.deepStrictEqual(r.sinais, ['nova', 'vaga', 'porte']);
    assert.match(r.prompt, /SINAL DE MOMENTO.*empresa nova.*está contratando \(vaga aberta: Vendedor Externo/);
    assert.strictEqual(r.ig, 'Instagram fraco: 300 seguidores · 12 publicações');
    assert.strictEqual(r.rec, false, 'a Prospecção fica como sempre foi');
    assert.deepStrictEqual(r.fInsta, ['Clínica A']); assert.deepStrictEqual(r.fLi.sort(), ['Indústria B', 'Loja C']); assert.deepStrictEqual(r.fDec, ['Loja C']); assert.strictEqual(r.todos, 4);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('prospectar começando pelo LinkedIn (pelo Google): busca, coloca na rotina e puxa CNPJ e telefone', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(x => setTimeout(x, ms));
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      const pedidos = [];
      _apiOficial = async (c, o) => {
        pedidos.push(c);
        if (c === '/leads/linkedin-pessoas') return { pessoas: [
          { nome: 'João Carlos Silva', cargo: 'Sócio-diretor', empresa: 'Plásticos Alfa', linkedin: 'https://www.linkedin.com/in/joaocarlos/', local: 'Guarulhos' },
          { nome: 'Maria Souza', cargo: 'Diretora comercial', empresa: 'Embalagens Beta', linkedin: 'https://www.linkedin.com/in/mariasouza/', local: 'Guarulhos' }] };
        if (c === '/leads/cnpj-google') return { cnpj: JSON.parse(o.body).nome === 'Plásticos Alfa' ? '11222333000181' : null };
        return { vagas: [] };
      };
      _srv = async c => ({ cnpj: '11222333000181', porte: 'MICRO EMPRESA', abertura: '2015-01-01', situacao: 'ATIVA', socios: [{ nome: 'OUTRO SOCIO', qualificacao: 'Sócio' }], telefones: ['11987654321'] });
      _liFeitos = new Set(); _liRows = [];
      const box = liBuscaSecao(); document.body.appendChild(box);
      box.querySelector('.li-busca-setor').value = 'indústria de plástico'; box.querySelector('.li-busca-cidade').value = 'Guarulhos';
      [...box.querySelectorAll('button')].find(b => b.textContent === 'Buscar').click(); await espera(200);
      const lista = box.querySelector('.li-busca-res').textContent;
      [...box.querySelectorAll('button')].find(b => /Colocar 2 na rotina/.test(b.textContent)).click(); await espera(600);
      const extra = (userGet('li_decisores_extra', []) || []).map(l => [l.title, l.decisores[0].nome, l.phone || '', l.origem]);
      const dia = liDecisoresDia([], []).map(x => x.dec.nome);
      return { lista, extra, dia, pedidos: [...new Set(pedidos)] };
    });
    assert.match(r.lista, /João Carlos Silva · Sócio-diretor/); assert.match(r.lista, /Embalagens Beta · Guarulhos/);
    assert.deepStrictEqual(r.extra, [['Embalagens Beta', 'Maria Souza', '', 'busca LinkedIn'], ['Plásticos Alfa', 'João Carlos Silva', '5511987654321', 'busca LinkedIn']]);
    assert.ok(r.dia.includes('João Carlos Silva') && r.dia.includes('Maria Souza'), 'quem foi achado continua sendo o alvo (não troca pelo sócio da Receita)');
    assert.ok(r.pedidos.includes('/leads/linkedin-pessoas') && r.pedidos.includes('/leads/cnpj-google'));
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('comentar post no aquecimento, perfil e posts da semana, link da agenda e pedido de indicação', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(x => setTimeout(x, ms));
      iaServidor = async (p) => /COMENTÁRIO/.test(p) ? 'Esse ponto do prazo de entrega é o que mais pesa. Vocês medem isso por cliente?'
        : /3 posts/.test(p) ? 'Post 1: a dor que custa caro para quem vende para indústria todo mês sem perceber.\n---\nPost 2: um caso prático de como resolver isso em uma semana, com números.\n---\nPost 3: o erro mais comum do setor e por que ninguém fala dele.'
        : 'Obrigado pela confiança! Conhece mais 2 donos de empresa que poderiam ter o mesmo problema?';
      const lead = { title: 'Plásticos Alfa', decisores: [{ nome: 'João Alfa' }] };
      const cb = aqComentarBox('li', lead); document.body.appendChild(cb); cb.open = true;
      cb.querySelector('.aq-post').value = 'Batemos recorde de entregas no prazo este mês!';
      [...cb.querySelectorAll('button')].find(b => /Escrever comentário/.test(b.textContent)).click(); await espera(100);
      const comentario = cb.querySelector('.aq-coment-txt').value;
      _liRows = [{ chave: 'x', criado_em: new Date().toISOString() }];
      const sec = liConteudoSecao(); document.body.appendChild(sec);
      [...sec.querySelectorAll('button')].find(b => /Gerar os 3 posts/.test(b.textContent)).click(); await espera(100);
      const posts = sec.querySelectorAll('.li-post').length;
      [...sec.querySelectorAll('.li-post button')].find(b => b.textContent === 'Postei ✓').click();
      const postados = liPostsSemana().posts.filter(p => p.postado).length;
      userSet('agenda_link', 'https://cal.com/diego');
      const resp = agendaNaResposta('Ótimo, vamos conversar!');
      pkLeads = [{ id: 9, name: 'Cliente Gama', phone: '5511999990009', col: 'fechado', fechadoEm: Date.now() - 10 * 86400000, liPessoa: 'Gil Gama' }]; pkSave();
      const pend = pkIndicacaoPendentes().length;
      await pkIndicacao(9); await espera(100);
      const m = document.querySelector('.pk-ind-modal');
      m.querySelector('.pk-ind-nome').value = 'carla dias'; m.querySelector('.pk-ind-emp').value = 'Distribuidora Delta';
      [...m.querySelectorAll('button')].find(b => /Decisores do dia/.test(b.textContent)).click();
      pkLoad();
      const ind = (userGet('li_decisores_extra', []) || []).find(l => l.title === 'Distribuidora Delta');
      const dia = liDecisoresDia([], []).map(x => x.dec.nome + ' | ' + x.l.title);
      return { comentario, posts, postados, resp, pend, texto: m.querySelector('.pk-ind-texto').value, dec: ind && ind.decisores[0], dia, pedida: !!pkLeads[0].indicacaoPedidaEm, prompt: liPrompt(ind, null, 'Carla Dias', ''), depois: pkIndicacaoPendentes().length };
    });
    assert.match(r.comentario, /prazo de entrega/);
    assert.strictEqual(r.posts, 3); assert.strictEqual(r.postados, 1);
    assert.match(r.resp, /Ótimo, vamos conversar!\n\nSe ficar mais fácil, escolha o melhor horário aqui: https:\/\/cal\.com\/diego/);
    assert.strictEqual(r.pend, 1); assert.match(r.texto, /Conhece mais 2 donos/);
    assert.deepStrictEqual(r.dec, { nome: 'Carla Dias', cargo: '', fonte: 'indicacao', indicadoPor: 'Gil Gama' });
    assert.ok(r.dia.includes('Carla Dias | Distribuidora Delta'), r.dia.join('\n'));
    assert.strictEqual(r.pedida, true); assert.strictEqual(r.depois, 0);
    assert.match(r.prompt, /INDICAÇÃO: Carla Dias foi indicado\(a\) por Gil Gama/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('Instagram com o mesmo motor: A/B da DM, responder story, resposta colada com IA e funil', async () => {
  const a = await abrirApp({ largura: 390, db: { abordagens_instagram: [
    { user_id: 'u1', chave: 'sol', nome: 'Clínica Sol', telefone: '11999990001', instagram: 'https://www.instagram.com/sol/', criado_em: new Date(Date.now() - 4 * 86400000).toISOString(), variante: 'perfil' },
  ] } });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(x => setTimeout(x, ms));
      window.open = () => null;
      iaServidor = async (p) => /STORY/.test(p) ? 'Que vitrine linda! Isso é coleção nova?' : /JSON/.test(p) ? '{"classe":"interessado","nome_indicado":"","resposta":"Que bom! Te mando os detalhes."}' : 'Oi, Clínica Lua! Tudo bem?';
      _igRows = []; const ab = igAbEscolher();
      const pr = igPrompt({ title: 'X' }, null, 'dor');
      _igFeitos = new Set(); _igHoje = 0; _igRows = null;
      igAbordar([{ title: 'Clínica Lua', category: 'Clínica de estética', phone: '', instagram: 'https://www.instagram.com/lua/', igSeguidores: 420, igPosts: 9 }]);
      await espera(300);
      const quem = document.querySelector('.ig-modal .ig-quem').textContent;
      document.querySelector('.ig-modal .ig-story-ger').click(); await espera(200);
      const story = { txt: document.querySelector('.ig-modal textarea.ig-texto').value, botao: [...document.querySelectorAll('.ig-modal .modal-actions button')].map(b => b.textContent).join('|') };
      document.querySelector('.modal-backdrop').remove();
      // resposta colada
      pkLeads = [{ id: 1, name: 'Clínica Sol', col: 'contatado', canal: 'instagram', movedAt: 1 }]; pkSave();
      liRespostaModal(null, null, 'instagram'); await espera(200);
      const sel = document.querySelector('.li-resp-quem'); sel.value = 'sol'; sel.dispatchEvent(new Event('change'));
      document.querySelector('.li-resp-texto').value = 'Tenho interesse, me manda mais detalhes';
      [...document.querySelectorAll('.li-resp-modal button')].find(b => /Entender/.test(b.textContent)).click(); await espera(200);
      document.querySelector('.li-resp-aplicar').click(); await espera(300);
      pkLeads = userGet('pk_leads', []);
      const row = _db.abordagens_instagram[0];
      await igRowsCarregar(true);
      return { ab, pr, quem, story, row: [row.resultado, row.classe, row.resposta], card: pkLeads[0].col, ev: (pkLeads[0].eventos || []).map(e => e.txt).join('|'), funil: igFunilEl(_igRows).textContent };
    });
    assert.strictEqual(r.ab, 'pergunta'); assert.match(r.pr, /VERSÃO DO TESTE: cite com cuidado uma oportunidade/);
    assert.match(r.quem, /420 seguidores · 9 publicações/);
    assert.match(r.story.txt, /coleção nova/); assert.match(r.story.botao, /Copiar e abrir o story/);
    assert.deepStrictEqual(r.row, ['respondeu', 'interessado', 'Tenho interesse, me manda mais detalhes']);
    assert.strictEqual(r.card, 'respondeu'); assert.match(r.ev, /Respondeu no Instagram/);
    assert.match(r.funil, /1\s*responderam100%/); assert.match(r.funil, /Detalhe do perfil \+ pergunta/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('pontas soltas: limite do Google com aviso claro, pesquisa da empresa guardada no banco, campanha do LinkedIn na cadência nova e time com LinkedIn', async () => {
  const a = await abrirApp({ largura: 1280, db: {
    pesquisas_empresa: [{ user_id: 'u1', chave: 'velha', dados: { cnpj: { cnpj: '1', socios: [{ nome: 'ANA VELHA', qualificacao: 'Sócio-Administrador' }] }, decisor: { nome: 'Ana Velha', cargo: 'Sócio-Administrador' } } }],
    campanhas_canal: [{ id: 'c1', user_id: 'u1', canal: 'linkedin', status: 'ativa', nome: 'Indústrias', etapas: [0, 3, 7] }],
    campanhas_canal_leads: [
      { id: 'l1', user_id: 'u1', campanha_id: 'c1', chave: 'k-convite', nome: 'Alfa', etapa: 0, status: 'pendente', proxima_em: new Date(Date.now() - 1000).toISOString() },
      { id: 'l2', user_id: 'u1', campanha_id: 'c1', chave: 'k-aceite', nome: 'Beta', etapa: 1, status: 'pendente', proxima_em: new Date(Date.now() - 1000).toISOString() }],
  }, rpcs: {
    painel_equipe: [{ membro_id: 'u1', nome: 'Você', envios: 10, responderam: 2, interessados: 1, interessados_esperando: 0, minutos_resposta: 30, reunioes: 1, ganhos: 0, valor_ganho: 0, fu_vencidos: 0, ultimo_envio: new Date().toISOString() },
      { membro_id: 'u2', nome: 'Gustavo', envios: 5, responderam: 1, interessados: 0, interessados_esperando: 0, minutos_resposta: null, reunioes: 0, ganhos: 0, valor_ganho: 0, fu_vencidos: 0, ultimo_envio: new Date().toISOString() }],
    painel_equipe_canais: [{ membro_id: 'u2', li_convites: 20, li_aceitos: 8, li_respostas: 3, ig_dms: 12, ig_respostas: 2 }],
  } });
  try {
    const r = await a.pagina.evaluate(async () => {
      // 1) limite do Google: aviso uma vez por dia, e vagas/Instagram ficam para depois
      let toasts = []; const t0 = showToast; showToast = (m, k) => { toasts.push(m); };
      const orig = _apiOficial;
      // o envoltório do aviso fica por fora do que o teste troca
      _apiOficial = async () => { throw new Error('limite diário de buscas no Google atingido; tenta de novo amanhã'); };
      (function () { const o = _apiOficial; _apiOficial = async function () { try { return await o.apply(this, arguments); } catch (e) { avisarLimiteGoogle(e); throw e; } }; })();
      for (let i = 0; i < 2; i++) { try { await _apiOficial('/leads/vagas', {}); } catch (e) {} }
      const avisos = toasts.filter(t => /Acabaram as buscas no Google/.test(t)).length;
      showToast = t0;
      const txt = googleUsoTxt({ usados: 250, limite: 300, restante: 50 });
      // 2) pesquisa guardada no banco aparece mesmo sem estar no aparelho
      await pesqTabCarregar();
      const velha = pesqDe({ title: 'Velha', place_id: 'velha' });
      pesqSalvar({ title: 'Nova', place_id: 'nova' }, { cnpj: { cnpj: '2' } }); await new Promise(x => setTimeout(x, 100));
      // 3) campanha do LinkedIn: só o convite é tarefa da campanha
      await ccCarregar(true);
      const hoje = ccHoje('linkedin').map(x => x.r.chave), ativas = [...ccChavesAtivas('linkedin')];
      return { avisos, txt, velha: velha && velha.decisor.nome, banco: _db.pesquisas_empresa.map(x => x.chave), hoje, ativas };
    });
    assert.strictEqual(r.avisos, 1, 'avisa uma vez só');
    assert.strictEqual(r.txt, '🔎 Buscas no Google hoje: 250 de 300 · guardando o resto para CNPJ e decisor');
    assert.strictEqual(r.velha, 'Ana Velha');
    assert.ok(r.banco.includes('nova'), r.banco.join(','));
    assert.deepStrictEqual(r.hoje, ['k-convite']); assert.deepStrictEqual(r.ativas, ['k-convite']);
    // 4) time com LinkedIn e Instagram
    await a.pagina.evaluate(() => ptCarregar());
    await a.pagina.waitForTimeout(300);
    const time = await a.pagina.evaluate(() => document.getElementById('pt-corpo').textContent);
    assert.match(time, /20 convites · 40% aceite · 3 resp\./); assert.match(time, /12 DMs · 2 resp\./);
    const manual = await a.pagina.evaluate(() => JSON.stringify(typeof MANUAL !== 'undefined' ? MANUAL : document.body.innerHTML).includes('Rotina do LinkedIn'));
    assert.ok(manual);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('LinkedIn: "Já mandei o convite" no aquecer, revisar aquecidos de hoje que receberam convite, CNPJ homônimo de outra cidade e limpeza da prospecção', async () => {
  const a = await abrirApp({ largura: 390, aquecer: true });
  try {
    const r = await a.pagina.evaluate(async () => {
      const espera = ms => new Promise(x => setTimeout(x, ms));
      iaServidor = async () => 'CONVITE: Olá\nMENSAGEM: Oi';
      _liFeitos = new Set(); _liHoje = 0; _liRows = [];
      // 1) no passo aquecer: já mandou o convite
      const A = { title: 'Alfa Contábil', phone: '11999990001', decisores: [{ nome: 'Ana Alfa', fonte: 'receita' }] };
      liAbordar([A]); await espera(300);
      const ja = [...document.querySelectorAll('.li-modal button')].find(b => /Já mandei o convite/.test(b.textContent));
      ja.click(); await espera(400);
      const reg1 = _db.abordagens_linkedin.map(x => x.nome + '|' + x.pessoa);
      // 2) aquecidos hoje que na verdade receberam convite
      const B = { title: 'Beta Contábil', phone: '11999990002', decisores: [{ nome: 'Bia Beta' }] }, C = { title: 'Gama Contábil', phone: '11999990003', decisores: [{ nome: 'Gil Gama' }] };
      todosLeads = [A, B, C]; _leadsBase = [A, B, C];
      aqMarcar('li', B); aqMarcar('li', C);
      const hoje = liAquecidosHoje().map(l => l.title);
      liAquecidosRevisar(liAquecidosHoje());
      const m = document.querySelector('.li-aq-modal');
      m.querySelector(`input[data-chave="${liChave(B)}"]`).click();
      [...m.querySelectorAll('button')].find(b => /Registrar 1 convite/.test(b.textContent)).click(); await espera(400);
      const reg2 = _db.abordagens_linkedin.map(x => x.nome).sort();
      const depois = liAquecidosHoje().map(l => l.title);
      // 3) CNPJ achado pelo nome em outra cidade é descartado
      config.uazapi = Object.assign({}, config.uazapi, { url: 'https://srv.test', token: 't' });
      _apiOficial = async () => ({ cnpj: '11222333000181' });
      _srv = async () => ({ cnpj: '11222333000181', municipio: 'JOINVILLE', telefones: ['4788124014'], socios: [] });
      const homo = await cnpjBuscar({ title: 'M & A Contabilidade', cidade: 'Guarulhos' });
      _srv = async () => ({ cnpj: '11222333000181', municipio: 'GUARULHOS', telefones: ['11987654321'], socios: [] });
      const certo = await cnpjBuscar({ title: 'M & A Contabilidade', cidade: 'Guarulhos' });
      // 4) limpeza do que entrou antes da correção
      userSet('li_decisores_extra', [
        { title: 'Galan Ferreira Contabilidade', origem: 'busca LinkedIn', address: 'Guarulhos', linkedin: 'https://www.linkedin.com/in/galan/', decisores: [{ nome: 'Galan Ferreira Contabilidade' }] },
        { title: 'M & A', origem: 'busca LinkedIn', address: 'Guarulhos', phone: '554788124014', place_id: 'li:ma', linkedin: 'https://www.linkedin.com/in/ligia/', decisores: [{ nome: 'Ligia Macedo' }] }]);
      pesqSalvar({ place_id: 'li:ma' }, { cnpj: { cnpj: '1', fonte: 'Google', municipio: 'JOINVILLE' } });
      liProspectsLimpar();
      const extra = (userGet('li_decisores_extra', []) || []).map(l => [l.title, l.phone, (pesqDe(l) || {}).cnpj || null]);
      return { reg1, hoje, reg2, depois, homo: [homo.cnpj, homo.motivos.join('|')], certo: !!certo.cnpj, extra };
    });
    assert.deepStrictEqual(r.reg1, ['Alfa Contábil|Ana Alfa']);
    assert.deepStrictEqual(r.hoje.sort(), ['Beta Contábil', 'Gama Contábil']);
    assert.deepStrictEqual(r.reg2, ['Alfa Contábil', 'Beta Contábil']);
    assert.deepStrictEqual(r.depois, ['Gama Contábil']);
    assert.strictEqual(r.homo[0], null); assert.match(r.homo[1], /CNPJ de outra cidade \(JOINVILLE\)/);
    assert.strictEqual(r.certo, true);
    assert.deepStrictEqual(r.extra, [['M & A', '', null]]);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

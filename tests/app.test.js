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
    assert.match(ab, /^https:\/\/www\.linkedin\.com\/company\/contabil-alfa\/people\/\?keywords=/);
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
    await a.pagina.click('.nav-item:has-text("Prospecção Instagram")');
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
    // 1) marcar resultado
    await a.pagina.click('#canal-insta li:has-text("Escritório Alfa") .cl-res.sim');
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

test('Painel começa pela campanha ao vivo; o Consultor fica no topo do Plano de Prospecção', async () => {
  const a = await abrirApp({ largura: 390 });
  try {
    const r = await a.pagina.evaluate(async () => {
      const painel = [...document.getElementById('tab-metricas').children].map(e => e.id).filter(Boolean);
      trocarAba('plano', document.querySelector(`.nav-item[onclick*="'plano'"]`));
      await new Promise(r => setTimeout(r, 1500));
      const plano = document.querySelector('#tab-plano > div').firstElementChild;
      const data = document.getElementById('mc-filtro-data-inicio').getBoundingClientRect();
      return { painel: painel.slice(0, 2), naPlano: plano && plano.id, visivel: !document.getElementById('cons-dia').hidden, txt: document.getElementById('cons-dia').innerText, noPainel: !!document.querySelector('#tab-metricas #cons-dia'), dataMin: getComputedStyle(document.getElementById('mc-filtro-data-inicio')).minHeight };
    });
    assert.deepStrictEqual(r.painel, ['painel-saudacao', 'painel-aovivo']);
    assert.strictEqual(r.noPainel, false);
    assert.strictEqual(r.naPlano, 'cons-dia');
    assert.ok(r.visivel); assert.match(r.txt, /Seu plano de hoje/);
    assert.strictEqual(r.dataMin, '34px');
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

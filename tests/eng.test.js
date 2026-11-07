// Módulo ⚡ Engenharia dentro do Prospecta+: aparece para quem ligou, busca, fila, funil e Pipeline.
const { test } = require('node:test');
const assert = require('node:assert');
const { abrirApp } = require('./ajuda.js');

const perfis = () => ({ ok: true, itens: [
  { id: 'a', canal: 'linkedin', tipo: 'pessoa', nome: 'Carlos Souza', cargo: 'Sócio', empresa: 'Sol Forte', cidade: 'Goiânia', link: 'https://www.linkedin.com/in/carlos-1/', trecho: 'Integradora solar' },
  { id: 'b', canal: 'linkedin', tipo: 'empresa', nome: 'Sol Forte', cargo: '', empresa: 'Sol Forte', cidade: 'Goiânia', link: 'https://www.linkedin.com/company/sol-forte/', trecho: '' },
  { id: 'c', canal: 'instagram', tipo: 'empresa', nome: 'Brilho Solar', cargo: '5.100 seguidores', empresa: 'Brilho Solar', cidade: 'Goiânia', link: 'https://www.instagram.com/brilhosolar/', handle: '@brilhosolar', trecho: '' },
] });

test('módulo escondido até ligar em Integrações', async () => {
  const a = await abrirApp({ largura: 1280 });
  try {
    await a.pagina.evaluate(() => engMostrarNav());
    assert.equal(await a.pagina.$eval('#nav-eng', e => e.style.display), 'none');
    await a.pagina.evaluate(() => engModuloLigar(true));
    await a.pagina.waitForTimeout(100);
    assert.equal(await a.pagina.$eval('#nav-eng', e => e.style.display), '');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('buscar → adicionar → fila do dia → enviei → aceitou → Pipeline', async () => {
  const a = await abrirApp({ largura: 1280, rotas: [[/^\/api\/perfis$/, perfis]] });
  const p = a.pagina;
  try {
    await p.evaluate(() => { engModuloLigar(true); trocarAba('eng', document.getElementById('nav-eng')); });
    await p.waitForSelector('#eng-box .eng-abas');
    await p.click('[data-eng-sub="encontrar"]');
    await p.fill('#eng-b-cidade', 'Goiânia'); await p.click('#eng-b-ir');
    await p.waitForSelector('[data-eng-achado]');
    assert.equal(await p.$$eval('[data-eng-achado]:checked', x => x.length), 2, 'pessoa e Instagram vêm marcados; página de empresa não');
    const pedido = a.pedidos.find(x => x.caminho === '/api/perfis');
    assert.match(pedido.corpo.q, /^site:br\.linkedin\.com\/in .*"Goiânia"$/);
    assert.equal(pedido.headers.authorization, 'Bearer tk');
    await p.click('#eng-add');
    assert.equal(await p.$$eval('.eng-tag.ok', x => x.length), 2);
    await p.click('[data-eng-sub="hoje"]');
    const msg = await p.textContent('.eng-contato [data-eng-msg]');
    assert.match(msg, /^Oi Carlos! Sou engenheiro eletricista/);
    assert.ok(msg.length <= 200);
    await p.click('.eng-contato [data-eng="etapa"][data-etapa="abordado"]');
    assert.match(await p.textContent('.eng-kpi b'), /^1\/20$/);
    await p.click('[data-eng-sub="contatos"]');
    await p.click('[data-eng-filtro="abordado"]');
    await p.click('.eng-contato [data-eng="etapa"][data-etapa="conectou"]');
    await p.click('[data-eng-filtro="conectou"]');
    assert.match(await p.textContent('.eng-contato [data-eng-msg]'), /^Obrigado por aceitar, Carlos!.*na Sol Forte/);
    await p.click('.eng-contato [data-eng="etapa"][data-etapa="conversando"]');
    await p.click('[data-eng-filtro="conversando"]');
    await p.click('.eng-contato [data-eng="pipeline"]');
    const pk = await p.evaluate(() => { pkLoad(); return pkLeads.map(l => [l.name, l.col, l.canal, l.website]); });
    assert.deepEqual(pk, [['Carlos Souza (Sol Forte)', 'respondeu', 'linkedin', 'https://www.linkedin.com/in/carlos-1/']]);
    p.once('dialog', d => d.accept('já tem engenheiro'));
    await p.selectOption('.eng-contato select[data-eng="mudar-etapa"]', 'perdido');
    await p.click('[data-eng-filtro="perdido"]');
    assert.match(await p.textContent('.eng-contato'), /Motivo: já tem engenheiro/);
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

test('mensagens e serviço: contador de 200, salvar e sem preço por padrão', async () => {
  const a = await abrirApp({ largura: 390 });
  const p = a.pagina;
  try {
    await p.evaluate(() => { engModuloLigar(true); trocarAba('eng', document.getElementById('nav-eng')); });
    await p.waitForSelector('#eng-box .eng-abas');
    await p.click('[data-eng-sub="mensagens"]');
    await p.fill('[data-eng-tipo="convite"]', 'Oi {primeiroNome}! ' + 'x'.repeat(200));
    assert.match(await p.$eval('[data-eng-contador="convite"]', e => e.className), /passou/);
    await p.fill('[data-eng-tipo="convite"]', 'Oi {primeiroNome}! Teste curto.');
    await p.click('#eng-m-salvar');
    assert.equal(await p.evaluate(() => userGet('eng_ajustes').produtos.solar.mensagens.linkedin.convite), 'Oi {primeiroNome}! Teste curto.');
    await p.click('[data-eng-sub="servicos"]');
    assert.equal(await p.inputValue('[data-eng-servico="solar"] [data-eng-campo="preco"]'), '');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'nada rola de lado no celular');
    assert.deepStrictEqual(a.errosReais(), []);
  } finally { await a.fechar(); }
});

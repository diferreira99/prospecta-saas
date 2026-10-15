// Service worker do Prospecta+ — só a página do próprio app passa por aqui; APIs (Supabase, n8n, WhatsApp,
// Google, OpenAI) vão direto para a rede, sem cache. Serve para: instalar como app, abrir mesmo com a internet
// oscilando (mostra a última versão da página) e mostrar notificações do sistema no Android.
const CACHE = 'prospecta-pagina-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // nada de fora do app
  if (req.mode === 'navigate') {
    // Sempre a versão nova da rede; sem rede, a última que funcionou
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put('/', copia)); }
      return r;
    }).catch(() => caches.match('/').then(r => r || Response.error())));
    return;
  }
  if (url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(r => r || fetch(req).then(n => { if (n.ok) c.put(req, n.clone()); return n; }))));
  }
});

// Tocar na notificação abre (ou traz para frente) o app na aba certa
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const aba = (e.notification.data && e.notification.data.aba) || '';
  const alvo = '/' + (aba ? '?tab=' + aba : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const c of lista) { if ('focus' in c) { c.focus(); if (aba) c.postMessage({ abrirAba: aba }); return; } }
    return self.clients.openWindow(alvo);
  }));
});

self.addEventListener('message', e => { if (e.data === 'update') self.skipWaiting(); });

// Porteiro da agenda: o app chama aqui, e só daqui o pedido segue para o n8n.
// O endereço do n8n fica escondido (N8N_AGENDA_URL na Vercel), cada pedido precisa de login válido
// e há limite de pedidos por minuto, para ninguém encher a fila do n8n.
const SUPABASE_URL = "https://wktvwbmjubiqtbrvnapj.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHZ3Ym1qdWJpcXRicnZuYXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3OTMzNDksImV4cCI6MjA4MjM2OTM0OX0.OUqrIyO7VD1wSUTQdFYpEfDV4JxUW8PcFqpkBPbeNCA";
const POR_MINUTO_IP = 60, POR_MINUTO_CONTA = 20;
const ACOES = ["horarios", "marcar"];

// Contagem por minuto (vale dentro de cada instância da função; junto com o login, basta contra abuso)
const _contas = new Map();
function estourou(chave, max) {
  const agora = Date.now(), min = Math.floor(agora / 60000);
  let c = _contas.get(chave);
  if (!c || c.min !== min) c = { min, n: 0 };
  c.n++;
  _contas.set(chave, c);
  if (_contas.size > 5000) for (const [k, v] of _contas) if (v.min < min) _contas.delete(k);
  return c.n > max;
}
function responder(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
function ipDe(req) {
  const h = req.headers || {};
  return String(h["x-real-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "?").trim();
}

async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "metodo" });
  if (estourou("ip:" + ipDe(req), POR_MINUTO_IP)) return responder(res, 429, { ok: false, erro: "muitos_pedidos" });
  const destino = process.env.N8N_AGENDA_URL || "";
  if (!destino) return responder(res, 503, { ok: false, erro: "agenda_desligada" });

  const token = String((req.headers || {}).authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 4000) return responder(res, 401, { ok: false, erro: "sem_login" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== "object" || JSON.stringify(b).length > 4000) return responder(res, 400, { ok: false, erro: "pedido_invalido" });
  if (!ACOES.includes(String(b.acao || "horarios"))) return responder(res, 400, { ok: false, erro: "acao_desconhecida" });

  // Confere o login no Supabase antes de acordar o n8n
  let uid = "";
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + token }, signal: AbortSignal.timeout(8000) });
    const u = r.ok ? await r.json() : null;
    uid = (u && u.id) || "";
  } catch (e) { uid = ""; }
  if (!uid) return responder(res, 401, { ok: false, erro: "login_invalido" });
  if (estourou("conta:" + uid, POR_MINUTO_CONTA)) return responder(res, 429, { ok: false, erro: "muitos_pedidos" });

  const corpo = {};
  ["acao", "dia", "hora", "nome", "empresa", "phone", "produto"].forEach((k) => { if (b[k] !== undefined) corpo[k] = String(b[k]).slice(0, 120); });
  try {
    const r = await fetch(destino, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(45000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return responder(res, 502, { ok: false, erro: "agenda_falhou" });
    return responder(res, 200, j);
  } catch (e) {
    return responder(res, 504, { ok: false, erro: "agenda_falhou" });
  }
}

module.exports = handler;
module.exports._estourou = estourou;

// Busca de perfis no LinkedIn e no Instagram pelo Google (Serper), para o módulo ⚡ Engenharia.
// Só lê o que o Google mostra (título e trecho): não entra no LinkedIn nem no Instagram.
// Precisa de login válido no Prospecta+, limite por minuto e só aceita buscas dentro do LinkedIn/Instagram.
const crypto = require("crypto");
const SUPABASE_URL = "https://wktvwbmjubiqtbrvnapj.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHZ3Ym1qdWJpcXRicnZuYXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3OTMzNDksImV4cCI6MjA4MjM2OTM0OX0.OUqrIyO7VD1wSUTQdFYpEfDV4JxUW8PcFqpkBPbeNCA";
const POR_MINUTO_IP = 40, POR_MINUTO_CONTA = 12;

const _contas = new Map();
function estourou(chave, max) {
  const min = Math.floor(Date.now() / 60000);
  let c = _contas.get(chave);
  if (!c || c.min !== min) c = { min, n: 0 };
  c.n++; _contas.set(chave, c);
  if (_contas.size > 5000) for (const [k, v] of _contas) if (v.min < min) _contas.delete(k);
  return c.n > max;
}
function responder(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
const ipDe = req => String((req.headers || {})["x-real-ip"] || String((req.headers || {})["x-forwarded-for"] || "").split(",")[0] || "?").trim();
const limpa = s => String(s || "").replace(/\s+/g, " ").trim();

// mesma pessoa com links diferentes (br./www., barra no fim, parâmetros) vira a mesma chave
function chave(link) {
  try {
    const u = new URL(link), h = u.hostname.replace(/^(www|br|pt|m)\./, ""), p = u.pathname.split("/").filter(Boolean);
    if (/linkedin\.com$/.test(h)) return ("li:" + p.slice(0, 2).join("/")).toLowerCase();
    if (/instagram\.com$/.test(h)) return ("ig:" + (p[0] || "")).toLowerCase();
    return (h + "/" + p.join("/")).toLowerCase();
  } catch (e) { return String(link || "").toLowerCase(); }
}
const idDe = link => crypto.createHash("sha1").update(chave(link)).digest("hex").slice(0, 12);

// "Carlos Souza - Sócio - Solar X | LinkedIn"
function lerLinkedIn(o, cidade) {
  let u; try { u = new URL(o.link); } catch (e) { return null; }
  const p = u.pathname.split("/").filter(Boolean);
  const tipo = p[0] === "in" ? "pessoa" : p[0] === "company" ? "empresa" : null;
  if (!tipo || !p[1]) return null;
  const pedacos = limpa(o.title).replace(/\s*[|–-]\s*LinkedIn\s*$/i, "").split(/\s+[-–|]\s+/).map(limpa).filter(Boolean);
  const nome = pedacos[0] || "";
  let cargo = pedacos.slice(1).join(" · "), empresa = "";
  const na = cargo.match(/\b(?:na|no|em|at|@)\s+(.+)$/i);
  if (pedacos.length >= 3) { empresa = pedacos[pedacos.length - 1]; cargo = pedacos.slice(1, -1).join(" · "); } else if (na) empresa = na[1];
  if (tipo === "empresa") { empresa = nome; cargo = ""; }
  const local = limpa((String(o.snippet || "").match(/(?:Localização|Location)\s*:\s*([^·|]+)/i) || [])[1] || "");
  return { canal: "linkedin", tipo, nome, cargo, empresa: limpa(empresa), cidade: local || cidade || "", link: "https://www.linkedin.com/" + p.slice(0, 2).join("/") + "/", trecho: limpa(o.snippet).slice(0, 300) };
}
// "Solar X (@solarx) • Instagram photos and videos"
function lerInstagram(o, cidade) {
  let u; try { u = new URL(o.link); } catch (e) { return null; }
  const p = u.pathname.split("/").filter(Boolean);
  if (!p[0] || /^(p|reel|reels|explore|stories|tv|accounts|about|direct)$/i.test(p[0])) return null;
  const handle = p[0].replace(/[^a-z0-9._]/gi, "");
  if (!handle) return null;
  const t = limpa(o.title).replace(/\s*[•·]\s*Instagram.*$/i, "").replace(/\s*on Instagram.*$/i, "");
  const nome = limpa(t.replace(/\(@[^)]+\)/, "")) || handle;
  const seg = (String(o.snippet || "").match(/([\d.,]+\s*(?:mil|k|m|mi)?)\s*(?:Followers|seguidores)/i) || [])[1] || "";
  const pessoa = /síndic|sindic/i.test((o.title || "") + (o.snippet || "")) && !/administradora|condomínios ltda|imóveis/i.test(o.title || "");
  return { canal: "instagram", tipo: pessoa ? "pessoa" : "empresa", nome, cargo: seg ? limpa(seg) + " seguidores" : "", empresa: nome, cidade: cidade || "", link: "https://www.instagram.com/" + handle + "/", handle: "@" + handle, trecho: limpa(o.snippet).slice(0, 300) };
}
function ler(organic, cidade) {
  const vistos = new Set();
  return (organic || []).map(o => /linkedin\.com/.test(o.link || "") ? lerLinkedIn(o, cidade) : /instagram\.com/.test(o.link || "") ? lerInstagram(o, cidade) : null)
    .filter(Boolean).filter(c => { const k = chave(c.link); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map(c => ({ ...c, id: idDe(c.link) }));
}

async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "metodo" });
  if (estourou("ip:" + ipDe(req), POR_MINUTO_IP)) return responder(res, 429, { ok: false, erro: "muitos_pedidos" });
  const token = String((req.headers || {}).authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 4000) return responder(res, 401, { ok: false, erro: "sem_login" });
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== "object" || JSON.stringify(b).length > 2000) return responder(res, 400, { ok: false, erro: "pedido_invalido" });
  const cidade = limpa(b.cidade).slice(0, 60).replace(/"/g, "");
  const q = limpa(String(b.q || "").replace(/\{cidade\}/g, cidade)).replace(/""/g, "").slice(0, 400);
  if (!/^site:(br\.|www\.)?(linkedin\.com\/(in|company)|instagram\.com)\b/i.test(q)) return responder(res, 400, { ok: false, erro: "busca_fora" });

  let uid = "";
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + token }, signal: AbortSignal.timeout(8000) });
    const u = r.ok ? await r.json() : null;
    uid = (u && u.id) || "";
  } catch (e) { uid = ""; }
  if (!uid) return responder(res, 401, { ok: false, erro: "login_invalido" });
  if (estourou("conta:" + uid, POR_MINUTO_CONTA)) return responder(res, 429, { ok: false, erro: "muitos_pedidos" });
  if (!process.env.SERPER_API_KEY) return responder(res, 503, { ok: false, erro: "sem_chave" });

  try {
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST", headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 20, page: Math.min(10, Math.max(1, Number(b.pagina) || 1)) }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return responder(res, 502, { ok: false, erro: "busca_falhou" });
    const j = await r.json();
    return responder(res, 200, { ok: true, consulta: q, itens: ler(j.organic, cidade) });
  } catch (e) {
    return responder(res, 504, { ok: false, erro: "busca_falhou" });
  }
}

module.exports = handler;
module.exports._ler = ler;
module.exports._estourou = estourou;

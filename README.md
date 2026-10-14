# Prospecta+

SaaS de prospecção B2B (um único `index.html`, sem build). Publicado no Vercel: cada push na `main` gera um deploy.

## Arquivos

- `index.html`: o app inteiro (login Supabase, busca de leads, CRM, campanhas, painel).
- `vercel.json`: URLs sem `.html` e redirecionamento do endereço antigo `/0-PROSPECTA-MAIS-sem-ANA` para `/`.

## Configurar no Vercel

Add New → Project → importar este repositório. Framework: **Other**. Sem build command, sem output directory,
sem variáveis de ambiente.

## Serviços que o app usa

- **Supabase** (`wktvwbmjubiqtbrvnapj`): login e dados. No código fica só a chave pública `anon`.
  Nunca colocar a `service_role` aqui (o repositório é público).
- **API de leads** (Railway, repositório `google-maps-scraper`): fonte "API oficial".
- **n8n** (Railway): fonte "Backup (Serper)", campanhas, status e filas.

Todas as chamadas levam o token de login do Supabase (trecho `anexarLoginNasChamadas`, logo depois do `createClient`).

Contexto completo do projeto: `CONTEXTO.md` no repositório `google-maps-scraper`.

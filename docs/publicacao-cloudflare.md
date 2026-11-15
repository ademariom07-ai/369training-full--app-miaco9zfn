# Publicação no Cloudflare (Workers)

Projeto no painel: **369wellness** (Workers & Pages), ligado a este repositório.

| Configuração | Valor |
| --- | --- |
| Branch de produção | `prep/supabase-vite` |
| Comando de construção | `pnpm build:site` |
| Comando de implantação | `npx wrangler deploy` (lê `wrangler.jsonc`) |
| Variáveis de construção | `NODE_VERSION=22`, `PNPM_VERSION=10.28.0` |
| Endereço | https://369wellness.ademariom07.workers.dev |

- `pnpm build:site` gera `dist-site/`: área real (Supabase) a partir de `acesso.html` + `src/`, mais o pacote estático de `site/`.
- O `name` em `wrangler.jsonc` precisa ser igual ao nome do Worker no painel.
- O projeto usa só pnpm (`packageManager` no `package.json`); não adicionar lockfile de outro gerenciador.
- Cada envio para `prep/supabase-vite` publica automaticamente. O branch `main` é do Skip e não é publicado aqui.

# LAVE AGORA — Landing page

Lavanderia self-service 24h (Unidade Fátima, Canoas). Landing page com preços em destaque, promoção automática por dia/horário, chat de dúvidas, painel admin e WhatsApp.

## Estrutura

```
.
├── backend/                     # API Express (Node)
│   ├── server.js                # rotas, preços, promoções, chat e admin
│   └── storage.js               # persistência (Netlify Blobs / arquivo local)
├── frontend/                    # Site Vite (HTML + CSS + JS)
│   ├── index.html               # página principal
│   ├── admin.html               # painel administrativo
│   ├── public/                  # imagens (hero.jpg, logo.jpg, logo.svg)
│   ├── src/                     # app.js, admin.js, style.css
│   └── vite.config.js           # proxy /api → backend
├── netlify/
│   └── functions/api.js         # API Express empacotada como Netlify Function
├── package.json                 # build + dependências da Function
├── netlify.toml                 # build, publish, functions e redirect /api/*
└── start.sh                     # sobe backend + frontend juntos (dev local)
```

## Como rodar localmente

```bash
# backend
cd backend && npm install && npm run dev

# frontend (em outro terminal)
cd frontend && npm install && npm run dev
```

Ou tudo de uma vez: `./start.sh`

Depois abra http://localhost:5173

### Portas (opcional)

Os padrões são backend `3001` e frontend `5173`. Se já estiverem em uso:

```bash
# backend em 3002
cd backend && PORT=3002 npm run dev

# frontend em 5180 falando com o backend em 3002
cd frontend && FRONTEND_PORT=5180 API_TARGET=http://localhost:3002 npm run dev
```

## Variáveis de ambiente

| Variável | Uso | Padrão (apenas desenvolvimento) |
| --- | --- | --- |
| `ADMIN_USERNAME` | usuário do painel admin | `admin` |
| `ADMIN_PASSWORD` | senha do painel admin | `marco2026` |
| `JWT_SECRET` | assinatura do token de sessão do admin | valor de dev do código |

**Em produção defina `ADMIN_PASSWORD` e `JWT_SECRET`** nas variáveis de ambiente do
site (Netlify → Site configuration → Environment variables). Sem isso o site usa os
valores de desenvolvimento, que são públicos no repositório.

## Persistência

Tudo dentro do Netlify, sem serviço externo:

- **No Netlify:** [Netlify DB](https://docs.netlify.com/build/data-and-storage/netlify-database/)
  (Postgres gerenciado pelo Netlify), acessado via `NETLIFY_DB_URL`. Os dados ficam
  na tabela `kv`, criada pela migração em `netlify/database/migrations/`.
- **Localmente:** arquivos JSON em `backend/data/` (não versionados).

⚠️ O Netlify injeta `NETLIFY_DB_URL` nas Functions apenas em builds feitos pelo
próprio Netlify (deploy conectado ao repositório Git). Enquanto o site não estiver
conectado, gravar pelo painel admin responde `503` com mensagem clara e nada é
salvo — em produção valem os valores padrão de `backend/server.js`. Leitura
(`/api/public`), chat e login funcionam normalmente. O código já está pronto: ao
conectar o repositório e reimplantar, a gravação passa a persistir sem alteração.

## Deploy

O projeto é publicado no Netlify a partir deste repositório. O deploy é automático:
todo push para a branch principal dispara build e publicação.

Para publicar manualmente com o CLI:

```bash
npx netlify deploy --build --prod
```

O que o Netlify faz:

1. `npm install` na raiz (dependências da Function).
2. `npm run build` → instala e builda o frontend em `frontend/dist`.
3. Publica `frontend/dist` como site estático.
4. Publica `netlify/functions/api.js` como Function e reescreve `/api/*` para ela.

## Admin

- URL: `/admin.html`
- Usuário e senha: definidos por `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

No painel você troca o destaque (R$ 14,90), o valor promocional (R$ 12,90), o cupom,
os dias da semana e as janelas de horário. O site aplica sozinho.

WhatsApp padrão: +55 51 8406-6339

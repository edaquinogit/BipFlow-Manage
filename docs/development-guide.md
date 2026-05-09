# Guia De Desenvolvimento

Este guia descreve o fluxo local recomendado para o estado atual do BipFlow.

## Pre-Requisitos

- Python 3.12.x. O backend em Docker usa `python:3.12-slim`; mantenha o
  ambiente local na mesma versao minor.
- Node.js 18+.
- npm 9+.
- Git.

## Aplicacoes Do Repositorio

### Backend principal

- Local: `bipdelivery/`.
- Stack: Django 6, Django REST Framework, Simple JWT e SQLite local.
- Responsabilidades: autenticacao, perfil autenticado, produtos, categorias,
  regioes de entrega, checkout via WhatsApp, pedidos persistidos, historico de
  vendas, bot publico guiado por regras, RBAC de dashboard e media em
  desenvolvimento.

### Frontend principal

- Local: `bipflow-frontend/`.
- Stack: Vue 3, TypeScript, Vite, Vue Router, Axios e Tailwind.
- Responsabilidades: dashboard autenticado, saudacao do usuario, menu
  operacional, gestao de produtos, gestao de frete, alertas de estoque,
  historico recente de vendas, catalogo publico, bot de atendimento do
  catalogo, carrinho e checkout.
- Contrato de auth: tokens JWT persistidos somente por
  `src/services/token-store.ts`.
- Contrato de produtos: mutacoes passam por `ProductFormSchema`,
  `sanitizePayloadForDjango`, `useProducts` e `product.service` antes de chegar
  ao Django.

### Motor Node arquivado

- Local: `legacy/node-engine/` (`index.js`, `src/`, `services/`, `database/`,
  `docs/swagger.js`).
- Stack: Express, Better SQLite3, Pino, Zod e Swagger.
- Status: **arquivado** na Fase 0 da evolucao multi-loja. Nao faz parte do
  runtime canonico Django + Vue. Ver `legacy/README.md`.

### Pacote `api-order-validation/`

- Papel atual: pacote/test harness isolado (avaliacao Jitterbit), independente
  do produto.
- Observacao: nao e o backend principal e nao integra o runtime canonico.

## Setup Com Docker Compose

O runtime containerizado representa o fluxo principal do produto:

- `frontend`: Nginx servindo o build Vue e roteando requisicoes para o backend.
- `backend`: Django em Gunicorn.
- `postgres`: banco relacional persistido em volume Docker.
- `redis`: cache compartilhado para Django e throttling do DRF.

Na raiz:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

URLs:

- Aplicacao: `http://localhost:8080/`
- API: `http://localhost:8080/api/`
- Admin: `http://localhost:8080/admin/`

O backend executa migrations, `collectstatic` e seed dos grupos RBAC no
entrypoint. Para criar um usuario admin de demonstracao no boot, configure no
`.env`:

```env
DJANGO_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
DJANGO_BOOTSTRAP_ADMIN_PASSWORD=troque-esta-senha
DJANGO_BOOTSTRAP_ADMIN_ROLE=admin
```

Se `localhost:8080` retornar conexao recusada, o Nginx do container frontend
nao esta rodando. Verifique:

```powershell
docker compose ps
docker compose logs frontend backend
```

Esse modo e separado do desenvolvimento com Vite. Para dev local sem Docker,
rode o frontend em `http://127.0.0.1:5173/` e o Django em
`http://127.0.0.1:8000/`.

## Setup Do Backend Django

Na raiz do repositorio:

```powershell
.\bootstrap-env.ps1
```

Se ja existir um `bipdelivery\venv` criado com outra versao de Python, recrie o
ambiente:

```powershell
.\bootstrap-env.ps1 -Force
```

Setup manual equivalente:

```powershell
py -3.12 -m venv bipdelivery\venv
bipdelivery\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Depois:

```powershell
cd bipdelivery
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
.\venv\Scripts\python.exe manage.py runserver
```

URLs locais:

- API: `http://127.0.0.1:8000/api/`
- Admin: `http://127.0.0.1:8000/admin/`
- Catalogo servido pelo frontend: `http://127.0.0.1:5173/produtos`

Higiene local:

- `bipdelivery/db.sqlite3` e banco local.
- O schema oficial vive nas migrations em `bipdelivery/api/migrations/`.
- Uploads, logs, staticfiles e bancos SQLite nao devem entrar no Git.

Variaveis relevantes:

- `DJANGO_ENV`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `BASE_URL`
- `FRONTEND_BASE_URL`
- `EMAIL_BACKEND`
- `DEFAULT_FROM_EMAIL`
- `WHATSAPP_ORDER_PHONE`
- `ORDER_DELIVERY_FEE`
- `BIPFLOW_THROTTLE_*`

## Setup Do Frontend

```powershell
cd bipflow-frontend
npm install --ignore-scripts
Copy-Item .env.example .env.local
npm run dev
```

Variaveis:

- `VITE_API_URL=http://127.0.0.1:8000/api/`
- `VITE_DEBUG=true`

Rotas atuais:

- `/`: dashboard autenticado e restrito a papel de dashboard.
- `/produtos`: catalogo publico.
- `/produtos/:slug`: detalhe publico do produto.
- `/products` e `/products/:slug`: aliases em ingles.
- `/login`, `/register`, `/forgot-password`, `/reset-password`: autenticacao.

## Motor Node Arquivado (opcional)

O motor Node nao integra o runtime canonico. Para executa-lo isoladamente:

```bash
cd legacy/node-engine
npm install
npm run dev
```

URLs locais: `GET /health`, `POST /api/v1/orders`, `GET /api-docs`. O banco
local gerado por ele e ignorado pelo Git. Ver `legacy/README.md`.

## Qualidade E Testes

Backend:

```powershell
python bipdelivery\manage.py check
python -m pytest bipdelivery/tests
ruff check bipdelivery/api bipdelivery/tests
```

Frontend:

```powershell
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:test:unit
npm run frontend:test:e2e
```

Documentacao:

```powershell
npm run docs:check
```

Pipeline de frontend:

- `.github/workflows/frontend-tests.yml` roda em `push`, `pull_request` e
  execucao manual.
- O job rapido executa typecheck, lint, Vitest e build de producao.
- O job E2E prepara o Django, cria o usuario `admin@example.com`/`admin123` e
  roda Cypress.
- Testes unitarios novos entram automaticamente seguindo
  `bipflow-frontend/src/**/*.spec.{ts,tsx,vue}`.
- Testes E2E novos entram automaticamente seguindo
  `bipflow-frontend/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`.

Para Cypress, o usuario usado por `cy.loginViaApi()` deve existir no backend e
ter `is_staff=True` ou grupo `admin`/`manager`. Os defaults locais sao
`admin@example.com` e `admin123`, mas podem ser sobrescritos por
`adminUsername` e `adminPassword` na configuracao do Cypress.

Se estiver com um banco limpo, rode antes:

```powershell
python bipdelivery\manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
```

Motor Node arquivado (`legacy/node-engine/`): opcional, fora do runtime.

`api-order-validation/` possui pacote proprio. Rode comandos dentro da pasta
apenas quando estiver trabalhando nesse pacote.

## Cobertura Atual

Backend:

- autenticacao, refresh e throttling;
- endpoint `auth/me`;
- CRUD de categorias e produtos;
- filtros, galeria de imagens e busca por slug;
- regioes de entrega;
- bot publico do catalogo sem IA externa;
- checkout via WhatsApp com persistencia de `SaleOrder`;
- historico de vendas restrito a papel de dashboard;
- servico local de media.

Frontend:

- services de produtos e categorias;
- composables de busca, produtos e carrinho;
- views publicas de produtos;
- widget de bot integrado ao catalogo publico;
- botao flutuante do carrinho;
- formulario administrativo de produto com validacao de categoria obrigatoria,
  coercao numerica de preco/estoque e payload multipart com categoria;
- validacoes unitarias e fluxos E2E existentes.

## Verificacao Local Atual

Ultima verificacao registrada nesta documentacao: 2026-05-09.

Documentacao:

```powershell
npm run docs:check
```

Resultado: checagem Markdown sem issues.

Backend:

```powershell
.\.venv\Scripts\python.exe bipdelivery\manage.py check
```

Resultado: system check sem issues.

Frontend unitario:

```powershell
npm test
```

Resultado: 11 arquivos e 48 testes unitarios passaram.

Frontend completo registrado anteriormente:

```powershell
npm run typecheck
npm run test:unit:run
npm run build
```

Resultado: typecheck, 37 testes unitarios e build de producao passaram.

## Padroes De Codigo

- Centralize HTTP em `src/services/`.
- Mantenha `token-store.ts` como unica fonte de verdade de tokens.
- Atualize `types`, `schemas` e `services` juntos quando o contrato mudar.
- Para o bot, mantenha classificacao e regras no backend; o frontend deve
  renderizar respostas estruturadas sem duplicar regra de negocio.
- Ao adicionar intent do bot, atualize `bot_engine.py`, serializers, types,
  testes e `docs/features/catalog-bot.md`.
- Evite hierarquias de heranca para intents do bot; prefira funcoes pequenas,
  nomeadas e cobertas por teste enquanto o fluxo for deterministico.
- Em backend, mantenha leitura publica e escrita restrita a papel
  administrativo quando alterar recursos do catalogo.
- Use migrations para mudancas estruturais de banco.
- Nao use documentacao para registrar planos futuros como se fossem estado atual.

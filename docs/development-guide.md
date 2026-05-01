# Guia De Desenvolvimento

Este guia descreve o fluxo local recomendado para o estado atual do BipFlow.

## Pre-Requisitos

- Python 3.12+.
- Node.js 18+.
- npm 9+.
- Git.

## Aplicacoes Do Repositorio

### Backend principal

- Local: `bipdelivery/`.
- Stack: Django 6, Django REST Framework, Simple JWT e SQLite local.
- Responsabilidades: autenticacao, perfil autenticado, produtos, categorias,
  regioes de entrega, checkout via WhatsApp, pedidos persistidos, historico de
  vendas, RBAC de dashboard e media em desenvolvimento.

### Frontend principal

- Local: `bipflow-frontend/`.
- Stack: Vue 3, TypeScript, Vite, Vue Router, Axios e Tailwind.
- Responsabilidades: dashboard autenticado, saudacao do usuario, menu
  operacional, gestao de produtos, gestao de frete, alertas de estoque,
  historico recente de vendas, catalogo publico, carrinho e checkout.
- Contrato de auth: tokens JWT persistidos somente por
  `src/services/token-store.ts`.
- Contrato de produtos: mutacoes passam por `ProductFormSchema`,
  `sanitizePayloadForDjango`, `useProducts` e `product.service` antes de chegar
  ao Django.

### Motor Node da raiz

- Local: `index.js`, `src/`, `services/` e `docs/swagger.js`.
- Stack: Express, Better SQLite3, Pino, Zod e Swagger.
- Responsabilidades: endpoint independente `POST /api/v1/orders`, health check
  `/health` e documentacao Swagger em `/api-docs`.
- Observacao: nao faz parte do runtime normal Django + Vue.

### Pacote `api-order-validation/`

- Papel atual: pacote isolado/test harness historico ligado ao motor Node.
- Observacao: nao deve ser tratado como backend principal do produto.

## Setup Do Backend Django

Na raiz do repositorio:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Depois:

```powershell
cd bipdelivery
python manage.py migrate
python manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
python manage.py runserver
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

## Setup Do Motor Node

```powershell
npm install
npm run dev
```

URLs locais:

- `GET /health`
- `POST /api/v1/orders`
- `GET /api-docs`

O banco `db.sqlite3` gerado pelo motor Node e local e ignorado pelo Git.

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

Para Cypress, o usuario usado por `cy.loginViaApi()` deve existir no backend e
ter `is_staff=True` ou grupo `admin`/`manager`. Os defaults locais sao
`admin@example.com` e `admin123`, mas podem ser sobrescritos por
`adminUsername` e `adminPassword` na configuracao do Cypress.

Se estiver com um banco limpo, rode antes:

```powershell
python bipdelivery\manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
```

Motor Node da raiz:

```powershell
npm run dev
```

`api-order-validation/` possui pacote proprio. Rode comandos dentro da pasta
apenas quando estiver trabalhando nesse pacote.

## Cobertura Atual

Backend:

- autenticacao, refresh e throttling;
- endpoint `auth/me`;
- CRUD de categorias e produtos;
- filtros, galeria de imagens e busca por slug;
- regioes de entrega;
- checkout via WhatsApp com persistencia de `SaleOrder`;
- historico de vendas restrito a papel de dashboard;
- servico local de media.

Frontend:

- services de produtos e categorias;
- composables de busca, produtos e carrinho;
- views publicas de produtos;
- botao flutuante do carrinho;
- formulario administrativo de produto com validacao de categoria obrigatoria,
  coercao numerica de preco/estoque e payload multipart com categoria;
- validacoes unitarias e fluxos E2E existentes.

## Verificacao Local Atual

Ultima verificacao registrada nesta documentacao: 2026-04-26.

Frontend:

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
- Em backend, mantenha leitura publica e escrita restrita a papel
  administrativo quando alterar recursos do catalogo.
- Use migrations para mudancas estruturais de banco.
- Nao use documentacao para registrar planos futuros como se fossem estado atual.

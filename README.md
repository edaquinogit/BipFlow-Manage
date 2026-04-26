# BipFlow Manage

Plataforma de gestao de catalogo, frete e pedidos. O fluxo principal do produto
usa backend Django REST, frontend Vue 3 e checkout publico com geracao de pedido
para WhatsApp.

## Estado Atual

O repositorio tem tres superficies de codigo:

- `bipdelivery/`: backend principal em Django REST. Mantem autenticacao JWT,
  produtos, categorias, regioes de entrega, checkout, pedidos persistidos e
  historico de vendas.
- `bipflow-frontend/`: aplicacao Vue 3 + TypeScript. Entrega o dashboard
  autenticado, o menu operacional, o catalogo publico, o carrinho e o checkout.
- `index.js` + `src/` + `docs/swagger.js`: motor Node independente de
  integracao de pedidos em `/api/v1/orders`. Ele nao participa do runtime
  normal Django + Vue.

`api-order-validation/` permanece no repositorio como pacote/test harness
isolado ligado ao motor Node. Ele nao faz parte do fluxo web principal.

## Documentacao Oficial

- [docs/README.md](docs/README.md): indice da documentacao viva.
- [docs/architecture/system-overview.md](docs/architecture/system-overview.md):
  arquitetura real do projeto.
- [docs/development-guide.md](docs/development-guide.md): setup, comandos,
  qualidade e manutencao.
- [docs/api/reference.md](docs/api/reference.md): contrato funcional da API
  Django.
- [bipflow-frontend/README.md](bipflow-frontend/README.md): guia especifico do
  frontend.

O historico de mudancas deve ser consultado pelo Git. Relatorios historicos,
placeholders de OpenAPI e documentos aspiracionais nao sao mantidos como fonte
de verdade.

## Stack

- Python 3.12+ para Django 6.
- Django 6, Django REST Framework e Simple JWT.
- SQLite em desenvolvimento local.
- Node.js 18+ e npm.
- Vue 3, TypeScript, Vite, Vue Router e Axios.
- Vitest, Cypress, ESLint, Ruff e Pytest.

## Estrutura

```text
BipFlow-Manage/
|-- bipdelivery/              # Backend Django REST
|-- bipflow-frontend/         # Frontend Vue 3
|-- api-order-validation/     # Pacote isolado/test harness do motor Node
|-- docs/
|   |-- api/
|   `-- architecture/
|-- src/                      # Suporte do motor Node da raiz
|-- index.js                  # Motor Node de integracao de pedidos
|-- package.json              # Scripts da raiz e motor Node
|-- requirements.txt
`-- .env.example
```

## Setup Rapido

### Backend Django

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
cd bipdelivery
python manage.py migrate
python manage.py runserver
```

API local: `http://127.0.0.1:8000/api/`

### Frontend Vue

```powershell
cd bipflow-frontend
npm install --ignore-scripts
Copy-Item .env.example .env.local
npm run dev
```

Aplicacao local: `http://127.0.0.1:5173/`

### Motor Node Da Raiz

```powershell
npm install
npm run dev
```

Motor local: `http://localhost:3000/`
Swagger local do motor Node: `http://localhost:3000/api-docs`

## Atalhos Na Raiz

```powershell
npm run frontend:dev
npm run frontend:build
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:lint:fix
npm run frontend:test:unit
npm run frontend:test:e2e
```

## Qualidade

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
```

## Convencoes

- `bipdelivery/db.sqlite3`, `db.sqlite3`, `node_modules/`, uploads, logs e
  artefatos de build sao dados locais e nao devem entrar em commits.
- A API Django publica leitura de catalogo e exige JWT para escrita
  administrativa.
- Chamadas HTTP do frontend devem passar por `src/services/`.
- Tokens JWT devem ser persistidos apenas por `token-store.ts`.
- A documentacao deve acompanhar codigo existente, nao roadmap.

# BipFlow Manage

Plataforma full-stack para pequenos negócios que precisam controlar catálogo,
frete, pedidos e checkout via WhatsApp sem depender de planilhas ou mensagens
soltas. O fluxo principal usa backend Django REST, frontend Vue 3 + TypeScript
e checkout público com geração de pedido para WhatsApp.

## Visão Rápida

- Dashboard administrativo com autenticação, papéis de acesso e rotas
  protegidas.
- Catálogo público com produtos, categorias, carrinho e detalhe por slug.
- Frete por região, calculado e validado no backend.
- Checkout via WhatsApp com pedido persistido no histórico de vendas.
- Backend como autoridade para preço, estoque, disponibilidade, frete e totais.
- Qualidade verificada com testes backend, typecheck, lint, testes frontend e
  build.

## Demonstração E Evidências

Este projeto também possui material de apresentação fora do repositório:

- **Vídeo completo no LinkedIn:** [demonstração explicada do fluxo do produto](https://www.linkedin.com/posts/ednaldo-aquino-backend_opentowork-vagasti-desenvolvedor-ugcPost-7455073194668888064-kCBE).
- **Carrossel técnico no LinkedIn:** [9 slides explicando arquitetura, stack e
  decisões de engenharia](https://www.linkedin.com/posts/ednaldo-aquino-backend_estagio-opentowork-desenvolvedor-ugcPost-7454498028276760578-zi7X).
- **Código-fonte:** este repositório mantém a implementação, documentação e
  comandos de validação.

Acesse os materiais pelo perfil:
[LinkedIn - Ednaldo Aquino](https://www.linkedin.com/in/ednaldo-aquino-backend/)

## Para Recrutadores

Este repositório também funciona como evidência prática do meu perfil em
desenvolvimento full-stack junior. Para uma avaliação rápida:

- [Currículo ATS em DOCX](docs/career/Ednaldo_Aquino_Curriculo_ATS.docx):
  versão adequada para envio em processos seletivos e leitura por sistemas ATS.
- [Currículo em Markdown](docs/career/Ednaldo_Aquino_Curriculo_ATS.md):
  versão aberta, revisável e alinhada ao projeto.
- O estudo de caso STAR abaixo resume contexto, responsabilidade técnica,
  ações implementadas e resultado entregue.
- A seção de qualidade lista os comandos usados para validar backend, frontend,
  testes, lint, typecheck e build.

## Por Que Este Projeto Existe

Pequenos negócios que vendem por WhatsApp normalmente precisam controlar
catálogo, disponibilidade, endereço, taxa de entrega, pedido e histórico em
ferramentas separadas. Isso aumenta retrabalho e risco de erro no valor final.

O BipFlow centraliza esse fluxo em uma aplicação operável: o cliente navega no
catálogo público, monta o carrinho, escolhe a entrega, envia o pedido para
WhatsApp e o backend registra a venda para consulta posterior no dashboard.

## Estudo De Caso STAR

**Situação:** vendas por WhatsApp dependem muito de processos manuais para
catálogo, frete, carrinho, pedido e histórico de vendas.

**Tarefa:** construir uma aplicação full-stack que conectasse catálogo público,
dashboard administrativo, cálculo de frete, checkout e persistência de pedidos,
mantendo o backend como fonte de verdade das regras de negócio.

**Ação:** implementei um backend Django REST com autenticação JWT, RBAC,
throttling, produtos, categorias, regiões de entrega, checkout validado no
servidor e histórico de vendas. No frontend, organizei uma aplicação Vue 3 +
TypeScript com services, composables, validação por Zod, dashboard protegido e
fluxo público de compra.

**Resultado:** o projeto entrega administração de catálogo, compra pública,
cálculo de frete, geração de pedido via WhatsApp e registro persistido para
consulta posterior. Também mantém documentação versionada e comandos de
qualidade para validar backend e frontend.

## Diferenciais Técnicos

- Backend Django REST como autoridade para preço, estoque, frete e totais.
- Frontend Vue 3 + TypeScript com services, composables e validação por Zod.
- Autenticação JWT com refresh token e throttling nos fluxos sensíveis.
- RBAC de dashboard: leitura pública, escrita administrativa por papel.
- Upload de imagens com galeria limitada e ordem preservada.
- Testes backend, typecheck, lint, testes unitários frontend e build validado.
- Documentação curta, versionada e alinhada ao código real.

## Estado Atual

O repositório tem três superfícies de código:

- `bipdelivery/`: backend principal em Django REST. Mantém autenticação JWT,
  RBAC, produtos, categorias, regiões de entrega, checkout, pedidos persistidos
  e histórico de vendas.
- `bipflow-frontend/`: aplicação Vue 3 + TypeScript. Entrega o dashboard
  autenticado, o menu operacional, o catálogo público, o carrinho e o checkout.
- `index.js` + `src/` + `docs/swagger.js`: motor Node independente de
  integração de pedidos em `/api/v1/orders`. Ele não participa do runtime
  normal Django + Vue.

`api-order-validation/` permanece no repositório como pacote/test harness
isolado ligado ao motor Node. Ele não faz parte do fluxo web principal.

## Documentação Oficial

- [docs/README.md](docs/README.md): índice da documentação viva.
- [docs/architecture/system-overview.md](docs/architecture/system-overview.md):
  arquitetura real do projeto.
- [docs/development-guide.md](docs/development-guide.md): setup, comandos,
  qualidade e manutenção.
- [docs/api/reference.md](docs/api/reference.md): contrato funcional da API
  Django.
- [bipflow-frontend/README.md](bipflow-frontend/README.md): guia específico do
  frontend.

O histórico de mudanças deve ser consultado pelo Git. Relatórios históricos,
placeholders de OpenAPI e documentos aspiracionais não são mantidos como fonte
de verdade.

## Stack

- Python 3.12+ para Django 6.
- Django 6, Django REST Framework e Simple JWT.
- SQLite em desenvolvimento local.
- Node.js 18+ e npm.
- Vue 3, TypeScript, Vite, Vue Router e Axios.
- Vitest, Cypress, ESLint, Ruff e Pytest.

## Segurança E Acesso

- Cadastro público cria uma conta comum ativa, sem poderes administrativos.
- Produtos, categorias e regiões de entrega têm leitura pública.
- Escrita administrativa exige `is_staff`, `is_superuser` ou grupo
  `admin`/`manager`.
- Histórico de vendas exige papel de dashboard: `staff`, `superuser`, `admin`,
  `manager` ou `viewer`.
- O frontend redireciona usuários sem papel de dashboard para `/403`, mas a
  proteção real fica no backend.

## Estrutura

```text
BipFlow-Manage/
|-- bipdelivery/              # Backend Django REST
|-- bipflow-frontend/         # Frontend Vue 3
|-- api-order-validation/     # Pacote isolado/test harness do motor Node
|-- docs/
|   |-- api/
|   |-- architecture/
|   `-- career/
|-- src/                      # Suporte do motor Node da raiz
|-- index.js                  # Motor Node de integração de pedidos
|-- package.json              # Scripts da raiz e motor Node
|-- requirements.txt
`-- .env.example
```

## Setup Rápido

### Docker Compose

O fluxo containerizado sobe o produto principal com frontend Vue, backend
Django, PostgreSQL e Redis:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Aplicação local: `http://localhost:8080/`
API pelo proxy do frontend: `http://localhost:8080/api/`
Admin Django pelo proxy: `http://localhost:8080/admin/`

Serviços:

- `frontend`: Nginx servindo o build Vue e fazendo proxy de `/api/`, `/admin/`,
  `/static/` e `/media/`.
- `backend`: Django em Gunicorn, com migrations, `collectstatic` e seed de
  grupos RBAC no entrypoint.
- `postgres`: banco relacional do runtime containerizado.
- `redis`: cache compartilhado usado também pelos throttles do DRF.

Para criar um usuário administrativo de demonstração no primeiro boot, defina
no `.env`:

```env
DJANGO_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
DJANGO_BOOTSTRAP_ADMIN_PASSWORD=troque-esta-senha
DJANGO_BOOTSTRAP_ADMIN_ROLE=admin
```

Se `localhost:8080` recusar conexão, o container `frontend` não está em
execução ou a porta está ocupada. Confira com:

```powershell
docker compose ps
docker compose logs frontend backend
```

No modo de desenvolvimento sem Docker, use o frontend em
`http://127.0.0.1:5173/` e suba o Django separadamente em
`http://127.0.0.1:8000/`.

### Backend Django

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
cd bipdelivery
python manage.py migrate
python manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
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

Aplicação local: `http://127.0.0.1:5173/`

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
python bipdelivery\manage.py seed_dashboard_roles
python -m pytest bipdelivery/tests
ruff check bipdelivery/api bipdelivery/tests
```

Frontend:

```powershell
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:test:unit
npm run frontend:build
```

## Convenções

- `bipdelivery/db.sqlite3`, `db.sqlite3`, `node_modules/`, uploads, logs e
  artefatos de build são dados locais e não devem entrar em commits.
- A API Django publica leitura de catálogo e exige papel administrativo para
  escrita.
- Chamadas HTTP do frontend devem passar por `src/services/`.
- Tokens JWT devem ser persistidos apenas por `token-store.ts`.
- A documentação deve acompanhar código existente, não roadmap.

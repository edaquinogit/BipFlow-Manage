# BipFlow Manage

Plataforma de gestao de catalogo e pedidos com backend Django REST, frontend Vue 3 e um servico Node isolado para validacao de pedidos.

## Visao Geral

O repositorio esta organizado em tres frentes principais:

- `bipdelivery/`: backend Django + Django REST Framework responsavel por produtos, categorias, autenticacao JWT e checkout via WhatsApp.
- `bipflow-frontend/`: aplicacao Vue 3 + TypeScript para dashboard autenticado e catalogo publico.
- `api-order-validation/`: servico Node independente, mantido como projeto paralelo de validacao de pedidos.

O fluxo principal do produto hoje acontece entre `bipflow-frontend` e `bipdelivery`. O servico `api-order-validation` nao faz parte do runtime padrao da aplicacao web.

## Documentacao Oficial

Para reduzir divergencia entre documentacao e codigo, estes arquivos sao a documentacao operacional do projeto:

- Arquitetura geral: [docs/architecture/system-overview.md](docs/architecture/system-overview.md)
- Guia de desenvolvimento: [docs/development-guide.md](docs/development-guide.md)
- Contrato da API: [docs/api/reference.md](docs/api/reference.md)
- Frontend: [bipflow-frontend/README.md](bipflow-frontend/README.md)
- Backend: `requirements.txt`, `bipdelivery/core/settings.py`, `bipdelivery/api/`

A raiz mantem apenas documentacao essencial. Relatorios historicos, auditorias pontuais e checklists de entrega foram removidos para evitar conflito com o estado atual do codigo.

## Stack Atual

- Python 3.11+
- Django 6
- Django REST Framework
- Simple JWT
- Node.js 18+
- Vue 3
- TypeScript
- Vite
- Vitest
- Cypress
- SQLite para desenvolvimento local

## Estrutura Do Repositorio

```text
BipFlow-Manage/
|-- bipdelivery/
|   |-- api/
|   |-- core/
|   `-- tests/
|-- bipflow-frontend/
|   |-- src/
|   |-- cypress/
|   `-- package.json
|-- api-order-validation/
|-- docs/
|-- package.json
|-- requirements.txt
`-- .env.example
```

## Setup Rapido

### 1. Backend

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

Observacao sobre banco local:
- `bipdelivery/db.sqlite3` e um artefato de desenvolvimento local.
- Esse arquivo nao deve ser versionado nem entrar em commits.
- Para resetar a base local, prefira remover o arquivo localmente e rodar `python manage.py migrate` novamente.

### 2. Frontend

```powershell
cd bipflow-frontend
npm install --ignore-scripts
Copy-Item .env.example .env.local
npm run dev
```

Aplicacao local: `http://127.0.0.1:5173/`

### 3. Scripts De Orquestracao Na Raiz

A raiz do repositorio nao substitui o ambiente do frontend. Ela oferece atalhos para o time:

```powershell
npm run frontend:dev
npm run frontend:build
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:lint:fix
npm run frontend:test:unit
npm run frontend:test:e2e
```

## Comandos Principais

### Backend

```powershell
cd bipdelivery
pytest
ruff check .
black . --line-length 100
```

### Frontend

```powershell
cd bipflow-frontend
npm run test:unit:run
npm run test:e2e:run
npm run lint
npm run lint:fix
npm run typecheck
```

Observacao sobre qualidade:
- `npm run lint` deve ser usado para auditoria sem alterar arquivos.
- `npm run lint:fix` aplica correcoes automaticas quando apropriado.

## Convencoes Do Projeto

- Leitura publica e escrita autenticada nos endpoints principais de produtos e categorias.
- Endpoints sensiveis de autenticacao usam throttling por IP e por identidade submetida.
- O frontend deve consumir a API via `services/`, nao espalhar chamadas HTTP direto nas views.
- Contratos de resposta devem ser validados por schemas quando o modulo ja segue esse padrao.
- Documentacao deve descrever comportamento real do codigo, nao roadmap, suposicoes ou arquitetura aspiracional.

## Problemas Comuns

### Backend sem dependencias

Se aparecer `ModuleNotFoundError: No module named 'django'`, ative a virtualenv correta antes de executar o servidor ou os testes.

### Banco SQLite aparecendo no Git

Se `bipdelivery/db.sqlite3` aparecer como modificado no `git status`, trate isso como dado local. O fluxo esperado do projeto e manter o schema em migrations e deixar o arquivo SQLite fora do versionamento.

### Frontend com bindings nativos quebrados

Nao compartilhe `node_modules` entre Windows e WSL. Ao trocar de ambiente, reinstale as dependencias no ambiente atual.

### Scripts ausentes na raiz

Os scripts web completos vivem em `bipflow-frontend/package.json`. Use a raiz apenas como atalho de orquestracao.

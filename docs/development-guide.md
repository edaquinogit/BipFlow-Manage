# Guia De Desenvolvimento

Este guia descreve o fluxo local recomendado para trabalhar no BipFlow sem depender de suposicoes sobre o ambiente.

## Pre-Requisitos

- Python 3.11+
- Node.js 18+
- npm 9+
- Git

## Aplicacoes Do Repositorio

### Backend principal

- Local: `bipdelivery/`
- Stack: Django + Django REST Framework
- Responsabilidades: autenticacao JWT, CRUD de produtos, CRUD de categorias, checkout via WhatsApp, servicao de media em desenvolvimento

### Frontend principal

- Local: `bipflow-frontend/`
- Stack: Vue 3 + TypeScript + Vite
- Responsabilidades: dashboard autenticado, catalogo publico, carrinho local, integracao com API Django
- Contrato de auth: tokens JWT persistidos exclusivamente via `bipflow-frontend/src/services/token-store.ts`

### Servico paralelo

- Local: `api-order-validation/`
- Stack: Node + Express
- Papel: projeto isolado de validacao de pedidos
- Observacao: nao participa do fluxo padrao entre frontend e backend Django

## Setup Do Backend

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
python manage.py runserver
```

Variaveis relevantes em `.env`:

- `DJANGO_ENV`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `WHATSAPP_ORDER_PHONE`
- `ORDER_DELIVERY_FEE`

## Setup Do Frontend

```powershell
cd bipflow-frontend
npm install --ignore-scripts
Copy-Item .env.example .env.local
npm run dev
```

Variaveis relevantes em `.env.local`:

- `VITE_API_URL`
- `VITE_DEBUG`

## Fluxo Local

### Backend

- Servidor: `python manage.py runserver`
- API base: `http://127.0.0.1:8000/api/`
- Admin Django: `http://127.0.0.1:8000/admin/`

### Frontend

- Servidor: `npm run dev`
- Aplicacao: `http://127.0.0.1:5173/`
- Catalogo publico: `/produtos`
- Dashboard autenticado: `/`

## Qualidade E Testes

### Backend

```powershell
cd bipdelivery
pytest
ruff check .
black . --line-length 100
```

Cobertura atual do backend inclui:

- saude da API
- CRUD principal
- regras de protecao de categorias
- checkout via WhatsApp
- servicao de media

### Frontend

```powershell
cd bipflow-frontend
npm run test:unit:run
npm run test:e2e:run
npm run lint
npm run typecheck
```

Cobertura atual do frontend inclui:

- services de produtos e categorias
- composables de busca e produtos
- views e componentes da experiencia de produtos
- fluxos E2E para sincronizacao de produto e upload de midia

## Padroes De Codigo

- Prefira nomes orientados ao dominio.
- Mantenha componentes, services e composables com responsabilidade unica.
- Centralize acesso HTTP em `src/services/`.
- Em frontend, trate `token-store.ts` como unica fonte de verdade para persistencia de tokens.
- Sempre que o modulo ja usar schema validation, atualize schema e service juntos.
- Em backend, preserve regras de permissao publica para leitura e autenticada para escrita quando alterar produtos e categorias.

## Regras De Documentacao

- Documente apenas o que ja existe no codigo.
- Se um endpoint, comando ou fluxo mudar, atualize a documentacao no mesmo ciclo da mudanca.
- Evite arquivos de "summary", "final report" ou "complete" como fonte de verdade funcional.
- Quando necessario criar novos documentos, prefira guias curtos por assunto em vez de relatorios extensos.

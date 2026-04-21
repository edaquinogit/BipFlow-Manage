# BipFlow

Plataforma de delivery e gestão operacional com backend Django/DRF, frontend Vue 3 e um conjunto adicional de serviços Node mantidos na raiz do repositório.

## Estado Atual

O projeto está funcional e com a base principal validada:

- Backend Django: testes `pytest` verdes
- Frontend Vue: testes unitários críticos verdes
- API de produtos/categorias: contrato paginado alinhado entre backend, frontend e testes
- Ambiente Node: padronizado com a raiz como orquestradora e `bipflow-frontend` como fonte de verdade do stack web

Ainda assim, este README evita prometer "zero dívida técnica". O objetivo aqui é documentar o estado real do projeto e o fluxo recomendado de desenvolvimento.

## Arquitetura

- `bipdelivery/`: backend Django + Django REST Framework
- `bipflow-frontend/`: aplicação Vue 3 + TypeScript + Vite
- `api-order-validation/`: serviço Node isolado com testes próprios
- `package.json` na raiz: scripts de orquestração e tooling do repositório
- `bipflow-frontend/package.json`: dependências e scripts do frontend

## Fontes de Verdade

- Backend Python: `requirements.txt`
- Frontend web: `bipflow-frontend/package.json`
- Scripts de orquestração do repositório: `package.json` na raiz
- Configuração frontend: `bipflow-frontend/.env.example`
- Configuração backend: `.env.example`

## Pré-requisitos

- Python 3.11+
- Node.js 18+
- npm 9+
- Git

## Setup Recomendado

### Windows / PowerShell

Use o bootstrap da raiz:

```powershell
.\bootstrap-env.ps1
```

Esse script agora:

1. cria ou reutiliza a virtualenv Python
2. instala dependências backend
3. instala dependências Node da raiz
4. instala dependências do frontend com `--ignore-scripts`
5. cria `bipflow-frontend/.env.local` a partir de `.env.example`, se necessário

### WSL / Linux

Use instalação manual para evitar conflitos entre binários Windows e Linux dentro de `node_modules`.

Backend:

```bash
python3 -m venv .venv_linux
source .venv_linux/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd bipflow-frontend
rm -rf node_modules package-lock.json
npm install --ignore-scripts
```

Raiz do repositório:

```bash
cd ..
rm -rf node_modules package-lock.json
npm install --ignore-scripts
```

### Observação Importante Sobre Ambiente

Não compartilhe o mesmo `node_modules` entre PowerShell/Windows e WSL/Linux. Os bindings nativos de ferramentas como Vite, Rolldown e Lightning CSS podem quebrar quando o diretório é reaproveitado entre ambientes.

## Configuração de Ambiente

### Backend

Copie `.env.example` para `.env` na raiz, se precisar sobrescrever os padrões.

### Frontend

O frontend usa `bipflow-frontend/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8000/api/
VITE_DEBUG=true
```

## Rodando Localmente

### Backend Django

```bash
cd bipdelivery
python manage.py migrate
python manage.py runserver
```

API local:

```text
http://127.0.0.1:8000/api/
```

### Frontend Vue

```bash
cd bipflow-frontend
npm run dev
```

Frontend local:

```text
http://127.0.0.1:5173/
```

### Scripts da Raiz

A raiz não é mais fonte de dependências do frontend. Ela apenas orquestra:

```bash
npm run frontend:dev
npm run frontend:build
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:test:unit
npm run frontend:test:e2e
```

## Testes

### Backend

```bash
cd bipdelivery
pytest
```

### Frontend Unitário

```bash
cd bipflow-frontend
npm run test:unit:run
```

Para rodar arquivos específicos:

```bash
npm run test:unit:run -- src/services/__tests__/product.service.spec.ts
npm run test:unit:run -- src/composables/__tests__/useProducts.spec.ts
```

### Frontend E2E

```bash
cd bipflow-frontend
npm run test:e2e:run
```

## Qualidade de Código

### Backend

```bash
cd bipdelivery
ruff check .
black . --line-length 100
```

### Frontend

```bash
cd bipflow-frontend
npm run lint
npm run typecheck
```

## Padrões do Projeto

### Logging

- Backend: não usar `print()`
- Frontend: não usar `console.log()` como telemetria de aplicação
- Use os serviços de logging do projeto

### Contratos de API

- Listagens principais de produtos e categorias usam payload paginado
- O frontend deve consumir serviços, não acessar diretamente formatos crus da API
- Schemas e services devem ser atualizados em conjunto quando o contrato mudar

### Clean Code

- nomes explícitos e orientados ao domínio
- funções pequenas e com responsabilidade clara
- testes cobrindo contrato e comportamento, não detalhes acidentais
- documentação alinhada ao estado real do código

## Estrutura do Repositório

```text
BipFlow-Manage/
|-- bipdelivery/
|   |-- api/
|   |-- core/
|   `-- tests/
|-- bipflow-frontend/
|   |-- src/
|   |-- cypress/
|   |-- package.json
|   `-- vitest.config.ts
|-- api-order-validation/
|-- bootstrap-env.ps1
|-- package.json
|-- requirements.txt
`-- README.md
```

## Troubleshooting

### `ModuleNotFoundError: No module named 'django'`

Ative a virtualenv correta antes de rodar o backend.

### `Missing script` ao rodar testes frontend na raiz

Rode no diretório `bipflow-frontend` ou use os wrappers da raiz:

```bash
npm run frontend:test:unit
```

### `Cannot find native binding` / erros de `rolldown` no WSL

Reinstale `node_modules` dentro do próprio WSL e não reaproveite instalação feita no Windows.

### `husky - .git can't be found`

Husky fica na raiz do repositório. Não rode instalação de hooks a partir de `bipflow-frontend`.

## Próximas Evoluções Técnicas

Os próximos focos recomendados de evolução são:

- consolidar documentação operacional complementar em `docs/`
- revisar dependências deprecated do frontend
- ampliar testes contratuais para endpoints paginados
- reduzir tempo de inicialização do runner de testes frontend

## Licença

Consulte [LICENSE](LICENSE).

# BipFlow Frontend

Aplicação Vue 3 + TypeScript do ecossistema BipFlow.

## Responsabilidade

Este diretório é a fonte de verdade do stack frontend:

- Vue 3
- Vite
- Vitest
- Cypress
- ESLint / Prettier

As dependências web devem ser instaladas e executadas a partir daqui. A raiz do repositório oferece apenas scripts de orquestração.

## Pré-requisitos

- Node.js 18+
- npm 9+

## Instalação

```bash
npm install --ignore-scripts
```

`--ignore-scripts` é recomendado para evitar efeitos colaterais de ambiente durante setup local, especialmente em WSL.

## Ambiente

Copie `.env.example` para `.env.local` se o arquivo ainda não existir:

```bash
cp .env.example .env.local
```

Exemplo:

```env
VITE_API_URL=http://127.0.0.1:8000/api/
VITE_DEBUG=true
```

## Desenvolvimento

```bash
npm run dev
```

Aplicação local:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

## Testes

Todos os testes unitários:

```bash
npm run test:unit:run
```

Arquivos específicos:

```bash
npm run test:unit:run -- src/services/__tests__/product.service.spec.ts
npm run test:unit:run -- src/composables/__tests__/useProducts.spec.ts
```

E2E:

```bash
npm run test:e2e:run
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm run format
```

## Padrões

- use `Logger` para telemetria de aplicação
- não introduza `console.log()` como debug permanente
- use composables e services para encapsular contratos de API
- mantenha schemas e serviços alinhados quando houver mudança de payload

## Observação de Ambiente

Não compartilhe `node_modules` entre Windows e WSL. Se alternar de ambiente, reinstale as dependências no ambiente atual.

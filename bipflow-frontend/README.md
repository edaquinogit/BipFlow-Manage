# BipFlow Frontend

Aplicacao Vue 3 + TypeScript responsavel por duas experiencias principais:

- dashboard autenticado de gestao
- catalogo publico com carrinho e fechamento via WhatsApp

## Escopo

Este diretorio e a fonte de verdade do stack frontend. Dependencias web, scripts de build, testes e configuracoes de qualidade devem ser mantidos aqui.

## Stack

- Vue 3
- TypeScript
- Vite
- Vue Router
- Axios
- Zod
- Vitest
- Cypress
- ESLint
- Prettier

## Estrutura Principal

```text
src/
|-- services/        # integracao com API
|-- composables/     # estado e comportamento reutilizavel
|-- views/
|   |-- dashboard/   # area autenticada
|   `-- products/    # catalogo publico e checkout
|-- router/          # definicao de rotas
|-- schemas/         # validacao e contratos
`-- components/      # componentes reutilizaveis
```

## Ambiente

Crie `bipflow-frontend/.env.local` a partir de `.env.example`:

```env
VITE_API_URL=http://127.0.0.1:8000/api/
VITE_DEBUG=true
```

## Desenvolvimento

```powershell
npm install --ignore-scripts
npm run dev
```

Aplicacao local: `http://127.0.0.1:5173/`

Rotas relevantes:

- `/`: dashboard autenticado
- `/produtos`: catalogo publico
- `/products`: alias para o catalogo publico

## Scripts

```powershell
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run format
npm run test:unit:run
npm run test:e2e:run
```

## Integracao Com A API

O frontend consome a API Django versionada em `/api/v1/`.

Services principais:

- `src/services/product.service.ts`
- `src/services/category.service.ts`
- `src/services/order.service.ts`
- `src/services/auth.service.ts`

Padroes atuais:

- produtos e categorias sao consumidos via camada de service
- respostas podem ser validadas com Zod quando o modulo ja adota esse padrao
- o checkout e concluido via endpoint de WhatsApp, nao por persistencia local no frontend

## Qualidade

```powershell
npm run lint
npm run typecheck
npm run test:unit:run
npm run test:e2e:run
```

Cobertura funcional relevante:

- services e composables ligados a produtos e categorias
- componentes e views do catalogo publico
- cenarios E2E de sincronizacao e upload

## Convencoes

- nao espalhar `axios` direto nas views
- manter contratos alinhados entre `services`, `schemas` e `types`
- usar `Logger` em vez de logs permanentes no console
- preferir componentes pequenos e orientados a responsabilidade

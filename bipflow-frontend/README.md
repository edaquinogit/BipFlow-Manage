# BipFlow Frontend

Aplicacao Vue 3 + TypeScript do BipFlow. Ela entrega o dashboard autenticado e o
catalogo publico de produtos.

## Escopo Atual

- Dashboard em `/` protegido por JWT.
- Saudacao com o usuario autenticado via `GET /api/auth/me/`.
- Menu operacional com atalhos, historico recente de vendas, alertas de estoque
  e gestao de regioes de entrega.
- Catalogo publico em `/produtos` e `/products`.
- Detalhe publico por slug.
- Carrinho local com frete por regiao ativa.
- Checkout via endpoint Django `/api/v1/checkout/whatsapp/`.

## Stack

- Vue 3
- TypeScript
- Vite
- Vue Router
- Axios
- Zod
- Tailwind
- Heroicons
- Vitest
- Cypress
- ESLint
- Prettier

## Estrutura

```text
src/
|-- components/      # componentes reutilizaveis
|-- composables/     # estado e comportamento reutilizavel
|-- router/          # rotas publicas, auth e dashboard
|-- schemas/         # validacao quando o modulo usa Zod
|-- services/        # integracao HTTP
|-- types/           # contratos TypeScript
`-- views/
    |-- auth/
    |-- dashboard/
    `-- products/
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

Rotas:

- `/`: dashboard autenticado.
- `/produtos`: catalogo publico.
- `/produtos/:slug`: detalhe publico.
- `/products` e `/products/:slug`: aliases.
- `/login`, `/register`, `/forgot-password`, `/reset-password`: autenticacao.

## Scripts

```powershell
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run lint:fix
npm run format
npm run test:unit:run
npm run test:e2e:run
```

## Services Principais

- `src/services/api.ts`: instancia Axios, injecao de Bearer token e refresh.
- `src/services/auth.service.ts`: login, cadastro, reset e usuario atual.
- `src/services/token-store.ts`: unica fonte de verdade para tokens.
- `src/services/product.service.ts`: catalogo, dashboard, slug e lote.
- `src/services/category.service.ts`: categorias.
- `src/services/delivery-region.service.ts`: regioes de entrega.
- `src/services/sales.service.ts`: historico recente de vendas.
- `src/services/order.service.ts`: checkout via WhatsApp.

## Qualidade

```powershell
npm run typecheck
npm run lint
npm run test:unit:run
npm run test:e2e:run
```

Uso recomendado:

- `npm run lint` para auditoria sem alterar arquivos.
- `npm run lint:fix` para correcao automatica local.
- `npm run typecheck` antes de commitar mudancas em contratos ou views.

## Convencoes

- Nao usar `axios` diretamente nas views.
- Manter contratos alinhados entre `services`, `types` e `schemas`.
- Guardas de rota e interceptors devem consultar `authService` e `tokenStore`.
- Nao persistir pedido no frontend; o checkout e validado e persistido no
  backend Django.
- Usar `Logger` em vez de logs permanentes no console.

# BipFlow Frontend

Aplicacao Vue 3 + TypeScript do BipFlow. Ela entrega o dashboard autenticado e o
catalogo publico de produtos.

## Escopo Atual

- Dashboard em `/dashboard` protegido por JWT e papel de dashboard, com `/`
  redirecionando para a visao geral.
- Saudacao com o usuario autenticado via `GET /api/auth/me/`.
- Troca de loja no dashboard via `store/mine/` e `X-Store-Slug`.
- Menu operacional com atalhos, historico recente de vendas, alertas de estoque
  e gestao de regioes de entrega.
- PDV por QR/codigo publico, recibo e envio de recibo por email.
- Configuracao do WhatsApp da loja para receber pedidos da vitrine.
- Catalogo publico em `/produtos`, `/products` e rotas por loja
  `/l/:storeSlug/produtos`.
- Detalhe publico por slug ou por `public_code` em `/l/:storeSlug/p/:code`.
- Bot publico no catalogo com atalhos, sugestoes de produtos e regioes de
  entrega retornadas pelo Django.
- Carrinho local separado por loja, com frete por regiao ativa.
- Perfil de cliente por loja para reutilizar identidade e endereco no checkout.
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
VITE_PUBLIC_STOREFRONT_BASE_URL=https://app.bipflow.com
```

`VITE_PUBLIC_STOREFRONT_BASE_URL` e opcional em producao/staging quando admin e
vitrine publica estao em dominios diferentes.

## Desenvolvimento

```powershell
npm install --ignore-scripts
npm run dev
```

Aplicacao local: `http://127.0.0.1:5173/`

Por padrao, o Vite proxy encaminha `/api`, `/media`, `/admin` e `/static` para
`http://127.0.0.1:8000`. Se voce estiver usando o backend via Docker/Compose,
use um dos modos abaixo para evitar 502 no catalogo:

```powershell
npm run dev:docker  # proxy para http://localhost:8080
npm run dev:smoke   # proxy para http://localhost:18088
```

Tambem e possivel apontar manualmente:

```powershell
$env:VITE_DEV_PROXY_TARGET="http://localhost:18088"
npm run dev
```

Rotas:

- `/`: dashboard autenticado e restrito a papel de dashboard.
- `/dashboard`, `/dashboard/produtos`, `/dashboard/pdv`, `/dashboard/pedidos`,
  `/dashboard/atendimento`, `/dashboard/configuracoes`: operacao autenticada.
- `/produtos`: catalogo publico.
- `/produtos/:slug`: detalhe publico.
- `/products` e `/products/:slug`: aliases.
- `/l/:storeSlug/produtos`: catalogo publico de uma loja especifica.
- `/l/:storeSlug/produtos/:slug`: detalhe publico por slug dentro da loja.
- `/l/:storeSlug/p/:code`: detalhe publico por `public_code`/QR.
- `/l/:storeSlug/login`, `/l/:storeSlug/perfil/criar`,
  `/l/:storeSlug/conta`: fluxo de cliente da vitrine.
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
- `src/services/product.service.ts`: catalogo, dashboard, slug, `public_code`,
  QR, etiquetas e movimentacoes de estoque.
- `src/services/category.service.ts`: categorias.
- `src/services/delivery-region.service.ts`: regioes de entrega.
- `src/services/sales.service.ts`: historico recente de vendas.
- `src/services/store.service.ts`: loja atual, lojas do usuario e recibo.
- `src/services/store-settings.service.ts`: configuracoes operacionais da loja.
- `src/services/order.service.ts`: checkout via WhatsApp.
- `src/services/pdvSale.service.ts`: venda de balcao e envio de recibo.
- `src/services/stockMovement.service.ts`: ledger de estoque.
- `src/services/bot.service.ts`: mensagens do bot publico do catalogo.

## Contrato Do Bot Do Catalogo

O bot publico fica em `src/views/products/CatalogBotWidget.vue` e chama
`src/services/bot.service.ts`. O service envia `POST v1/bot/messages/` com a
mensagem trimada e `channel` padrao `web`.

Regras de manutencao:

- a UI renderiza `reply`, `options`, `products` e `delivery_regions`;
- produtos sugeridos com `slug` navegam para o detalhe publico;
- quando a vitrine esta em rota por loja e falta `slug`, `public_code` pode
  abrir `/l/:storeSlug/p/:code`;
- intents e payloads vivem em `src/types/bot.ts`;
- regras de classificacao, disponibilidade, estoque e entrega ficam no backend;
- mudancas de contrato devem atualizar
  `../docs/features/catalog-bot.md` e `../docs/api/reference.md`.

## Contrato Do Fluxo De Produto

O dashboard cria e edita produtos pelo fluxo abaixo:

1. `ProductFormRoot.vue` mantem o estado editavel do formulario.
2. `ProductFormSchema` valida o contrato de escrita antes do submit.
3. `DashboardView.vue` remove campos somente leitura antes de sincronizar.
4. `useProducts.ts` monta `FormData`, preserva arquivos e envia `category`
   como ID para o Django.
5. `product.service.ts` normaliza a resposta do Django para a UI.

Regras atuais:

- categoria e obrigatoria para criar produto;
- o backend recebe `category` como ID numerico;
- o frontend pode exibir categoria como objeto `{ id, name, slug }`;
- preco e estoque sao normalizados como numeros no formulario;
- limpar o campo de preco ou estoque emite `0`, nao string vazia;
- `public_code` e somente leitura, gerado pelo backend e usado por QR/PDV;
- se SKU ficar vazio, o backend usa automaticamente o mesmo codigo do QR;
- mudancas manuais de estoque passam por endpoints de movimentacao, nao por
  edicao direta de `stock_quantity`;
- ate 3 imagens publicas sao preservadas entre capa e galeria.

## Qualidade

```powershell
npm run typecheck
npm run lint
npm run test:unit:run
npm run build
npm run test:e2e:run
```

Para testes E2E, o comando `cy.loginViaApi()` usa um usuario administrativo do
backend. Configure `adminUsername`, `adminPassword`, `apiUrl` e `apiBaseUrl` no
Cypress quando os defaults locais nao forem usados. Em banco limpo, crie o
admin local com:

```powershell
python ..\bipdelivery\manage.py seed_dashboard_roles --email admin@example.com --password admin123 --staff --role admin
```

Uso recomendado:

- `npm run lint` para auditoria sem alterar arquivos.
- `npm run lint:fix` para correcao automatica local.
- `npm run typecheck` antes de commitar mudancas em contratos ou views.
- `npm run test:unit:run` antes de commitar mudancas em services, schemas,
  composables ou componentes de formulario.

## Convencoes

- Nao usar `axios` diretamente nas views.
- Manter contratos alinhados entre `services`, `types` e `schemas`.
- Guardas de rota e interceptors devem consultar `authService` e `tokenStore`.
- Usuarios sem `can_access_dashboard` devem ser enviados para `/403`.
- Nao persistir pedido no frontend; o checkout e validado e persistido no
  backend Django.
- Nao duplicar regra do bot no frontend; renderize o contrato retornado pela
  API.
- Usar `Logger` em vez de logs permanentes no console.

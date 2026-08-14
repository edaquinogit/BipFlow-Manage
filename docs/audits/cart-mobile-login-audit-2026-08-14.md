# Auditoria de refinamento visual: carrinho mobile e login do cliente

Data: 2026-08-14

## Escopo

Auditoria focada na experiencia mobile do carrinho da vitrine publica e na coerencia do fluxo de login do cliente. Foram revisados os componentes de catalogo, cart drawer, botao flutuante, toasts, rotas de cliente e recuperacao de senha.

Arquivos principais:

- `bipflow-frontend/src/views/products/ProductsView.vue`
- `bipflow-frontend/src/views/products/CartDrawer.vue`
- `bipflow-frontend/src/views/products/FloatingCartButton.vue`
- `bipflow-frontend/src/components/common/ToastHost.vue`
- `bipflow-frontend/src/views/customer/CustomerLoginView.vue`
- `bipflow-frontend/src/views/customer/CreateCustomerProfileView.vue`
- `bipflow-frontend/src/views/auth/ForgotPasswordView.vue`
- `bipflow-frontend/src/router/auth.routes.ts`
- `bipflow-frontend/src/router/index.ts`
- `bipflow-frontend/src/services/api.ts`
- `bipflow-frontend/src/composables/useCart.ts`

## Veredito executivo

Status geral: aprovado com ressalvas para mobile pequeno.

O fluxo base esta correto: o carrinho permite checkout convidado, reaproveita perfil de cliente quando existe, persiste dados por loja, limpa PII no logout e o login de cliente nao cai no painel administrativo. Em telas comuns de mobile, como 390 x 844, o carrinho nao apresentou overflow horizontal.

O principal problema esta em telas pequenas, especialmente 320 x 568: o botao de pedido no header estoura a largura da viewport apos adicionar item. Tambem ha polimento necessario na relacao entre toast e carrinho, no rodape do drawer em telas curtas e no fluxo de recuperacao de senha, que ainda leva o cliente para uma experiencia administrativa.

## Evidencias de validacao

Comandos executados:

- `npm run test:unit:run -- CartDrawer CustomerProfileMenuButton CreateCustomerProfileView customerAccountGuard`
- Resultado: 4 arquivos e 18 testes passaram.
- `npm run build`
- Resultado: build passou; Vite alertou apenas sobre chunks grandes.
- `manage.py check`
- Resultado: Django passou sem issues.
- Backend local em `http://localhost:8000/healthz/`
- Resultado: `{"status":"ok"}`.
- API de produtos via Vite proxy
- Resultado: 24 produtos carregados em `/api/v1/products/`.

E2E Cypress: nao foi possivel usar o runner neste ambiente. `npx.cmd cypress verify` falhou com `Cypress.exe: bad option: --smoke-test` e `--ping=...`. Para compensar, foi feita verificacao via Edge headless/CDP com backend e frontend locais.

Capturas temporarias geradas:

- `.codex-tmp/mobile-audit/catalog-added-320x568.png`
- `.codex-tmp/mobile-audit/cart-320x568.png`
- `.codex-tmp/mobile-audit/cart-390x844.png`
- `.codex-tmp/mobile-audit/login-redirect-320x568.png`
- `.codex-tmp/mobile-audit/login-invalid-320x568.png`

Metricas observadas:

- Catalogo/carrinho em 320 x 568: `htmlScrollWidth` e `bodyScrollWidth` ficaram em 343px, gerando overflow horizontal.
- Botao do pedido no header em 320px: largura de 273px, `right: 343`, fora da viewport de 320px.
- Carrinho aberto em 320 x 568: o drawer em si ficou correto, `clientWidth: 320` e `scrollWidth: 320`.
- Carrinho aberto em 390 x 844: sem overflow horizontal, `scrollWidth: 390`.
- Login de cliente em 320 x 568: sem overflow horizontal e mantendo rota `/entrar` apos credencial invalida.

## Achados por severidade

### Alta: header do carrinho estoura em 320px

Onde: `ProductsView.vue`, botao `data-cy="open-cart-button"` com `whitespace-nowrap` e subtotal visivel no header.

Impacto: em celulares estreitos, o cliente ve o conteudo cortado na direita e a pagina cria overflow horizontal. Isso passa uma sensacao de layout quebrado justamente depois do ato principal: adicionar ao pedido.

Evidencia: em 320 x 568, o botao `PEDIDO / 1 ITEM / R$ 99,99` termina em `x=343`, ultrapassando a viewport em 23px.

Recomendacao: criar variante compacta abaixo de 360px. Opcoes:

- ocultar subtotal no header pequeno e deixar subtotal apenas no botao flutuante/drawer;
- transformar o botao do header em icone + badge;
- mover o pedido para uma segunda linha com `w-full` quando houver pouco espaco;
- remover `whitespace-nowrap` dos trechos menos criticos ou usar `max-w` real com truncamento do total.

### Alta: toast cobre cabecalho do cart drawer

Onde: `ToastHost.vue` usa container fixo `top-3 z-50`; `CartDrawer.vue` tambem abre em `z-50`.

Impacto: ao adicionar item e abrir o carrinho imediatamente, o toast de sucesso fica sobre a area superior do drawer. Em mobile, isso esconde ou compete com o cabecalho e o controle de fechamento, deixando a primeira leitura do carrinho pesada.

Evidencia: capturas de 320 x 568 e 390 x 844 mostram o toast ocupando a parte superior do carrinho.

Recomendacao: quando o carrinho abrir, limpar o toast de sucesso ou reduzir sua prioridade visual. Alternativas: baixar o z-index dos toasts atras do drawer, reposicionar toasts em modal aberto, ou trocar o feedback de "adicionado" por estado inline no proprio carrinho/FAB.

### Media: rodape do carrinho ocupa area demais em telas curtas

Onde: `CartDrawer.vue`, footer com resumo, frete, total, nota, alerta de validacao e CTA.

Impacto: em 320 x 568, o footer mediu cerca de 290px de altura, consumindo mais de metade da tela. A area util para revisar itens e preencher dados fica pequena e exige mais rolagem.

Recomendacao: criar footer compacto para alturas pequenas. Opcoes:

- agrupar produtos/frete em uma linha menor;
- exibir validacao acima do primeiro campo invalido em vez de sempre no footer;
- manter apenas total + CTA fixos e deixar detalhes financeiros dentro da area rolavel;
- usar `max-height` no footer com resumo colapsavel.

### Media: erro de login do cliente aparece em ingles

Onde: `CustomerLoginView.vue` retorna `data.detail` antes do fallback em portugues.

Impacto: credencial invalida exibiu "No active account found with the given credentials". Para cliente final, isso reduz confianca e parece erro tecnico.

Recomendacao: mapear respostas 401 conhecidas para `Email ou senha invalidos.` ou priorizar a mensagem local para login de cliente. O detalhe tecnico pode ficar apenas em log.

### Media: recuperacao de senha quebra o contexto de cliente

Onde: `CustomerLoginView.vue` aponta "Esqueci minha senha" para `AuthRouteNames.ForgotPassword`; `ForgotPasswordView.vue` usa `AuthShell`, fala em "email administrativo" e volta para `AuthRouteNames.Login`.

Impacto: cliente que esta na vitrine cai em uma tela com linguagem administrativa. Isso contradiz a separacao bem feita entre login de cliente e login admin.

Recomendacao: criar uma rota/tela de recuperacao de senha do cliente, mantendo storefront shell e redirect de volta para `/entrar` ou `/l/:storeSlug/login`. Se o endpoint for o mesmo, a UI e os redirects ainda devem ser de cliente.

### Baixa: login com conta sem perfil da loja pode parecer inconclusivo

Onde: `CustomerLoginView.vue` chama `fetchCustomerProfile()` e depois redireciona mesmo se o perfil nao existir.

Impacto: se um usuario autenticavel nao tiver perfil naquela loja, ele volta para a vitrine, mas o menu continua oferecendo "Criar perfil/Entrar". Tecnicamente o checkout convidado ainda funciona, mas a pessoa que acabou de entrar pode achar que o login falhou.

Recomendacao: apos login, se `fetchCustomerProfile()` retornar falso, redirecionar para criacao de perfil com aviso calmo ou exibir um estado "complete seu perfil nesta loja".

## Pontos positivos encontrados

- O cart drawer em si e largura-seguro: `w-full max-w-xl`, area central rolavel e footer separado.
- Inputs globais ficam com `font-size: 16px`, evitando zoom automatico no iOS.
- O viewport usa `viewport-fit=cover` e ha `safe-area-inset-bottom` no botao flutuante.
- O carrinho e escopado por loja no localStorage, evitando mistura entre vitrines.
- Dados pessoais do cliente no carrinho tem TTL de 30 dias e sao limpos no logout.
- Checkout convidado esta preservado, reduzindo abandono.
- Perfil completo esconde campos redundantes e perfil sem endereco ainda pede endereco no checkout.
- `/conta` anonimo redireciona para `/entrar`, nao para `/login` administrativo.
- Credencial invalida no login de cliente permanece em `/entrar`, sem cair no admin.

## Compatibilidade por faixa de tela

320px: requer ajuste. O header do pedido estoura horizontalmente; o carrinho cabe, mas fica visualmente pressionado pelo toast e pelo footer alto.

360px: provavel melhora, mas ainda deve ser tratado como faixa critica porque o botao do header tem largura proxima ao limite quando combinado com o icone de conta, gaps e padding.

390px: aprovado na validacao headless. Sem overflow horizontal no carrinho.

414px a 480px: esperado como compativel com os breakpoints atuais, mas ainda se beneficiam da solucao do toast.

Tablet: estrutura de `max-w-xl` para drawer e grids responsivos deve se comportar bem.

## Prioridade recomendada

1. Corrigir overflow do botao de pedido no header abaixo de 360px.
2. Resolver sobreposicao do toast com o cart drawer.
3. Compactar o footer do carrinho em telas curtas.
4. Localizar mensagens de erro do login de cliente.
5. Separar recuperacao de senha do cliente da recuperacao administrativa.
6. Adicionar teste automatizado para viewport 320 x 568 com item no carrinho.

## Criterios de aceite sugeridos

- Em 320 x 568, `document.documentElement.scrollWidth <= window.innerWidth`.
- Nenhum botao visivel do header termina fora da viewport.
- Ao abrir carrinho logo apos adicionar item, o toast nao cobre o cabecalho/fechar do drawer.
- Em 320 x 568, o cliente consegue ver pelo menos parte do item e o CTA sem perder contexto.
- Login invalido do cliente mostra mensagem em portugues.
- "Esqueci minha senha" na vitrine permanece em experiencia de cliente, sem textos administrativos.
- `/conta` anonimo continua redirecionando para `/entrar` ou `/l/:storeSlug/login`.

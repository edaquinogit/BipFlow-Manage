# Evolução: Perfil de Cliente na Vitrine + Checkout com Gate de Login

> **Revisão de 2026-07-09: o gate de login foi revertido.** A decisão 1 abaixo
> ("finalizar no WhatsApp sempre exige perfil/login, sem atalho de continuar
> sem cadastro") foi deliberadamente desfeita a pedido do usuário — checkout
> como convidado voltou a funcionar, sem conta nenhuma, exatamente como
> antes desta evolução. O `CustomerProfile`, o login de cliente, a tela de
> conta e o restante da fundação descrita aqui **continuam existindo e
> funcionando** — viraram conveniência opcional (identidade e, quando
> completo, endereço vêm do perfil automaticamente) em vez de bloqueio.
> Regra de precedência: perfil presente → identidade sempre vem dele;
> endereço vem dele só se completo, senão cai para o campo digitado na hora
> (mesmo pra quem tem conta). Backend: `CheckoutWhatsAppView` não exige mais
> `IsAuthenticated`; `CheckoutCustomerInputSerializer` ganhou de volta
> `full_name`/`phone`/`email`/`address`/`neighborhood`/`city` opcionais.
> Frontend: `CartDrawer.vue` mostra os campos de convidado condicionalmente;
> `useCheckoutProfileGate.ts` (o bloqueio) foi apagado. O resto deste
> documento descreve a decisão original e por que ela foi tomada — mantido
> como registro histórico, não como comportamento atual do gate.

Este documento registra a evolução que permite ao cliente da vitrine criar um
**perfil** (conta) com seus dados de identidade e endereço, acessível por um
ícone minimalista no header público, e que passa a **exigir esse perfil**
antes de finalizar um pedido via WhatsApp — em vez de redigitar nome,
telefone, email e endereço a cada compra. Segue o mesmo padrão de **etapas
verticais** de `docs/architecture/multi-tenant-evolution.md` e
`docs/architecture/qrcode-stock-exit-evolution.md`.

## 0. Estado antes desta evolução (levantamento factual)

Uma fundação parcial já existia, criada num commit anterior
(`a4f78ae`, "feat(auth): harden refresh flow and add context-based profile
onboarding") por outra sessão de trabalho neste repositório:

- `CustomerProfile` (`bipdelivery/api/models.py`): `user` FK + `store` FK
  (`unique_together`), só com `full_name` e `phone`.
- `RegisterUserSerializer`/`RegisterUserView` já aceitavam
  `registration_context=storefront_customer` + `store_slug`, criando um
  `CustomerProfile` em vez de uma `Store` nova.
- `CurrentUserSerializer.get_profile_kinds()` já retornava `"customer"`.

**O que faltava** era justamente o que esta evolução entrega: nenhuma tela
usava esse contexto, o login sempre redirecionava para o dashboard, o
checkout não conhecia `CustomerProfile`, e o resolvedor de tenant
(`store_scope.py`) não reconhecia cliente autenticado como pertencente à
própria loja.

## 1. Decisões confirmadas com o usuário

1. **Finalizar no WhatsApp sempre exige perfil/login** — sem atalho de
   "continuar sem cadastro". O backend também passou a exigir autenticação
   no endpoint de checkout (não só uma trava visual no frontend).
2. **O que sai do checkout e vira dado de perfil é identidade + endereço**:
   nome, telefone, email, endereço, bairro, cidade. Forma de entrega, forma
   de pagamento, região de entrega e observações continuam no checkout, por
   variarem a cada pedido.

## 2. Etapa 0 — Fundação de perfil (backend)

- `CustomerProfile` ganhou `address`, `neighborhood`, `city`,
  `delivery_region` (FK opcional) — migration `0031`. Nenhum campo `email`
  próprio: o `user.email` da conta (já obrigatório/único no registro) serve
  como email de contato do checkout, evitando pedir o mesmo dado duas vezes.
- Novo `GET/PATCH /v1/customers/me/` (`CustomerProfileView`) — único lugar
  onde o cliente lê/edita o próprio perfil depois do registro.
- `store_scope._user_belongs_to()` passou a checar `CustomerProfile`, não só
  `StoreMembership` — sem isso, um cliente autenticado mandando
  `X-Store-Slug` da própria loja não era reconhecido como pertencente a ela.
- `StoreScopedTokenObtainPairSerializer.get_token()` passou a gravar
  `store_id` também a partir do `CustomerProfile` quando não há
  `StoreMembership` (prioridade: dashboard membership vence se o usuário
  tiver os dois).
- `RegisterUserSerializer` ganhou `address`/`neighborhood`/`city` (opcionais)
  e passou a exigir `full_name`/`phone` no contexto `storefront_customer`.

## 3. Etapa 1 — Rota "Criar perfil" na vitrine (frontend)

- `CreateCustomerProfileView.vue` em `/l/:storeSlug/perfil/criar` (+
  `/s/:storeSlug/perfil/criar` e fallback `/perfil/criar`). Formulário com
  nome, telefone, email, endereço, bairro, cidade + senha da conta,
  reaproveitando `RegisterUserSerializer`. Após criar: login automático +
  redireciona de volta pra onde o checkout foi tentado (`?redirect=`),
  carrinho intacto (já persiste em `localStorage`).
- `CartDrawer.vue` perdeu os campos de nome/telefone/email/endereço/bairro/
  cidade — "Dados para finalizar" mostra só entrega, pagamento, região de
  entrega e observações.
- `CheckoutCustomerInputSerializer` (backend) deixou de aceitar esses campos
  no corpo — `CheckoutWhatsAppView` lê tudo do `CustomerProfile` do
  `request.user`.

## 4. Etapa 2 — Ícone de perfil na vitrine

- `CustomerProfileMenuButton.vue`: ícone minimalista (`UserCircleIcon`) ao
  lado do botão "Pedido" em `ProductsView.vue` e `ProductDetailView.vue`.
  Não logado → menu com "Criar perfil"/"Entrar"; logado com perfil → link
  direto pra `CustomerAccountView.vue` (dados do perfil + editar + sair).
  **Ajuste em relação ao plano original**: em vez de extrair um
  `StorefrontHeader.vue` compartilhado (os dois headers têm layouts
  bem diferentes — busca vs. botão voltar), foi extraído só o componente do
  ícone/menu, que é a parte que realmente precisava de uma única fonte de
  verdade para não dessincronizar.
- `LoginView.vue` corrigido: hoje respeita `?redirect=` da query string em
  vez de sempre mandar pro dashboard — sem isso, um cliente clicando
  "Entrar" a partir da vitrine (ou o guard de rota autenticada) caía no
  painel administrativo, onde não tem membership nenhuma.

## 5. Etapa 3 — Gate de perfil antes de finalizar

- `useCheckoutProfileGate()` (composable compartilhado por
  `ProductsView.vue`/`ProductDetailView.vue`): antes de chamar o checkout,
  confere autenticação + perfil; se faltar, redireciona pra criar perfil
  preservando o carrinho.
- `CheckoutWhatsAppView` passou a exigir autenticação
  (`permission_classes=[IsAuthenticated]`) — o gate também vale no backend,
  não só na UI.
- `SaleOrder` ganhou FK opcional `customer_profile` (nullable) — liga o
  pedido ao perfil que o fez, abrindo caminho pra histórico de pedidos
  futuro (fora do escopo desta rodada).
- **Dois throttles reescritos** porque a mudança pra autenticação obrigatória
  os desativaria silenciosamente:
  - `CheckoutIpThrottle` era `AnonRateThrottle`, que **nunca throttla
    requisição autenticada** (`get_cache_key()` retorna `None` = "não
    aplicar limite"). Virou `SimpleRateThrottle` chaveado sempre por IP,
    independente de autenticação.
  - `CheckoutPhoneThrottle` lia `customer.phone` do corpo da requisição —
    campo que não existe mais no payload. Virou `CheckoutCustomerThrottle`
    (`UserRateThrottle`), chaveado pelo usuário autenticado. Mesmo padrão de
    bug já visto neste projeto em `TokenRefreshIdentityThrottle` durante a
    migração pra cookies httpOnly.

## 6. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Fricção/queda de conversão por exigir conta pra comprar | Decisão explícita do usuário; carrinho não se perde no meio do fluxo |
| Bypass do gate direto na API | Backend também exige autenticação, não só trava visual |
| Throttle de checkout parar de funcionar silenciosamente | `CheckoutIpThrottle`/`CheckoutCustomerThrottle` reescritos + testes explícitos cobrindo os dois |
| Header duplicado dessincronizar | Ícone/menu extraído em componente único (`CustomerProfileMenuButton.vue`) |
| Cliente autenticado não reconhecido como dono da própria loja | `_user_belongs_to()` checa `CustomerProfile` |
| Perfil é por loja, não global | Consistente com `StoreMembership` (`unique_together=(user, store)`) — mesmo cliente cria um perfil por loja onde compra |
| Processos zumbi de `runserver` mascarando o estado real do backend | Encontrado durante a verificação ao vivo: processos órfãos de uma sessão anterior ainda escutavam na porta 8000 rodando código desatualizado, produzindo um 500 (`NOT NULL constraint failed: api_customerprofile.address`) que não existia no código atual. Resolvido matando os processos e confirmando com um servidor limpo — não é um bug de código, é uma lição operacional para a próxima verificação ao vivo neste ambiente. |

## 7. Verificação

- Backend: 411 testes pytest verdes (`test_customer_profile.py`,
  `test_checkout_customer_profile.py`, `test_checkout_throttling.py`
  reescrito, `test_store_active_isolation.py` atualizado), migrations
  aplicadas no `db.sqlite3` real de dev.
- Frontend: `typecheck`/`lint`/`vitest` (432 testes, incluindo
  `useCheckoutProfileGate.spec.ts`, `useCustomerProfile.spec.ts`,
  `CustomerProfileMenuButton.spec.ts`, `CartDrawer.spec.ts`) e `build` —
  todos verdes.
- Cypress: novo `customer-profile/checkout-flow.cy.ts` rodado ao vivo contra
  os servidores de dev reais — cobre vitrine → adicionar ao carrinho →
  tentar finalizar sem login → redirecionado pra criar perfil → cria perfil
  (com endereço) → volta pro checkout já logado, carrinho intacto → finaliza
  → pedido real criado com os dados do perfil e link `wa.me` correto.
  Restante da suíte Cypress rodado por completo: `login-flow.cy.ts` e
  `product_sync.cy.ts` continuam 100% verdes; as 3 falhas encontradas em
  `media_upload.cy.ts`, `store-foundation.cy.ts` e `mobile-ux.cy.ts` são
  pré-existentes e não relacionadas a esta evolução (breakpoint responsivo
  da tabela de produtos, campos do serializer público de loja de uma feature
  de recibo não tocada aqui, e um preset de viewport do Cypress
  desatualizado) — confirmado por não tocarem nenhum arquivo desta entrega.

## 8. Fora do escopo desta rodada (fast-follows possíveis)

- Histórico de pedidos por perfil (a FK `SaleOrder.customer_profile` já
  existe, só falta a tela).
- Múltiplos endereços por perfil (hoje é um endereço fixo, igual ao padrão
  já usado no resto do projeto — sem "livro de endereços").
- Override do endereço só para um pedido específico sem editar o perfil.
- Anexar um `CustomerProfile` a uma conta já autenticada para uma loja nova
  (hoje só existe registro de conta nova; um cliente autenticado sem perfil
  na loja atual vê uma mensagem clara em vez de um formulário quebrado, mas
  não tem um caminho de self-service ainda).

## 9. Revisão sênior pós-implementação (`/code-review high`)

Revisão de 8 ângulos (correção linha-a-linha, comportamento removido,
rastreamento entre arquivos, reuso, simplificação, eficiência, altitude) rodada
sobre o diff completo antes do commit. Achados confirmados e corrigidos:

- **[Segurança, crítico]** `_user_belongs_to()` (`store_scope.py`) reconhecer
  `CustomerProfile` abria um vazamento real: um usuário com `StoreMembership`
  na Loja A e `CustomerProfile` na Loja B podia mandar `X-Store-Slug: loja-b`
  e ver os pedidos privados da Loja B, porque `has_dashboard_read_access()`
  só verifica "tem alguma membership em algum lugar", nunca "membership na
  loja resolvida". Corrigido: o fallback por `CustomerProfile` só vale para
  um usuário sem NENHUMA `StoreMembership` em lugar nenhum — um usuário
  dashboard-capable só pode trocar de loja pelo header via `StoreMembership`
  real. Teste de regressão em `test_customer_profile.py`.
- **[Dados, confirmado]** `CustomerProfileSerializer` permitia `PATCH
  {"full_name": "", "phone": ""}` (campos com `allow_blank=True`), e
  `CheckoutWhatsAppView` confiava em `profile.full_name`/`phone` sem
  revalidar — um pedido podia ser criado com nome/telefone em branco.
  Corrigido removendo `allow_blank` desses dois campos (DRF já rejeita
  string vazia nativamente). Testes de regressão adicionados.
- **[Correção]** `useCheckoutProfileGate.ensureCustomerProfile()` confiava no
  cache do singleton `useCustomerProfile`; trocar de loja dentro da SPA sem
  reload total podia deixar `hasProfile` desatualizado. Corrigido: o gate
  sempre busca o perfil de novo antes de liberar o checkout (não é hot path,
  o custo extra é aceitável dado que gateia uma compra real).
- **[UX]** Frontend não distinguia os códigos `profile_address_incomplete`/
  `customer_profile_required` do backend, mostrando sempre o toast genérico.
  Novo `extractCheckoutErrorMessage()` em `order.service.ts`, reusado nos
  dois lugares que finalizam checkout.
- **[UX]** Cliente já autenticado sem perfil na loja atual caía no formulário
  completo de "criar perfil", que falha de forma confusa se reusar o email já
  cadastrado. `CreateCustomerProfileView.vue` agora mostra um estado
  dedicado explicando a limitação em vez de deixar o formulário falhar
  silenciosamente.
- **[Eficiência]** `CustomerProfileView`/`CustomerProfileSerializer.get_email`
  sem `select_related("user")` causava uma query extra pra reler
  `request.user`, já carregado. `CustomerProfileMenuButton.vue` buscava o
  perfil de novo a cada remontagem (troca entre lista e detalhe de produto)
  em vez de confiar no cache do singleton (só o *gate* precisa sempre
  revalidar, o ícone pode confiar no cache). `CustomerAccountView.vue`/
  `CreateCustomerProfileView.vue` faziam duas chamadas em série
  (`fetchCurrentStore` + `fetchCustomerProfile`) que rodam em paralelo sem
  problema — trocado por `Promise.all`.
- **[Reuso/simplificação]** O path `/l/:storeSlug/...` vs. path sem slug
  estava reimplementado à mão em 3 lugares (`useCheckoutProfileGate.ts`,
  `CustomerProfileMenuButton.vue`, `CartDrawer.vue`), cada um com seu próprio
  comentário explicando por que não dá pra usar rota nomeada. Consolidado em
  `createCustomerProfilePath()`/`customerAccountPath()`/`customerLoginPath()`
  em `router/auth.routes.ts`. A ternária de endereço condicional ao método de
  entrega em `CheckoutWhatsAppView` (repetida 6x) virou 3 variáveis locais
  computadas uma vez. `CustomerProfileSerializer.to_representation()` foi
  removido por duplicar exatamente o que o `Serializer` padrão já faz.

**Pedido adicional do usuário durante a revisão:** o link "Entrar" da
vitrine reusava `LoginView.vue` (o login do dashboard, com a marca "Painel
administrativo" e destaques como "Pedidos em tempo real"/"Catálogo e
categorias sempre atualizados") — confuso para um cliente que só quer
comprar. Criado `CustomerLoginView.vue`, um login com a mesma casca visual
da vitrine (`storefront-shell`), registrado nas rotas `/l/:storeSlug/login`,
`/s/:storeSlug/login` e `/entrar` (fallback sem loja) — `/login` (dashboard)
continua intocado. Verificado ao vivo via Cypress descartável: o ícone
"Entrar" agora abre esse login (sem "Painel administrativo" na tela) e, após
autenticar, volta pra vitrine (não pro dashboard).

Todos os fixes verificados: 415 testes pytest, 432 testes vitest,
typecheck/lint/build do frontend, todos verdes.

# Evolução: Código Único + Baixa de Estoque via QR Code

Este documento descreve a estratégia para permitir que o BipFlow gere um
**código único por produto** e use esse código, materializado em **QR Code**,
para dar baixa de estoque tanto na **loja física** (PDV com scanner/câmera)
quanto na **loja virtual** (deep link direto ao produto). Segue o mesmo
padrão de **etapas verticais** de `docs/architecture/multi-tenant-evolution.md`
e `docs/architecture/stock-movement-evolution.md`: cada etapa entrega
backend + frontend juntos, testado, sem quebrar o que já funciona.

## 0. Estado atual (o que já existe e o que falta)

O que já existe e será reaproveitado, não recriado:

- Ledger de estoque auditado (`StockMovement`) e chokepoint atômico
  (`apply_stock_movement()`, `bipdelivery/api/stock.py`) com
  `select_for_update()` — já é exatamente o lugar certo para pendurar uma
  baixa por scan.
- Multi-tenant maduro (`Store`, `StoreScopedViewSetMixin`,
  `resolve_request_store()`) — todo código novo é escopado por loja "de
  graça".
- `Product.sku` (opcional, manual, `UniqueConstraint(["store","sku"])`) —
  **não** é o código que vamos gerar: é o SKU que o lojista já usa no
  fornecedor dele. O código do BipFlow é um conceito novo e paralelo.
- Checkout via WhatsApp (`CheckoutWhatsAppView`) já decrementa estoque em
  lote com lock — é o único canal de venda que existe hoje.

O que não existe e esta evolução constrói:

- Nenhum código gerado automaticamente pelo sistema (o `sku` é manual e
  opcional).
- Nenhuma geração/renderização de QR Code para produtos (o único uso de
  `qrcode` no repo hoje é para MFA/TOTP, `bipdelivery/api/mfa.py`).
- Nenhum canal de venda presencial/PDV — `SaleOrder` só nasce hoje pelo
  checkout do WhatsApp.
- Nenhum scanner de câmera no frontend (nenhuma lib instalada).

## 1. Decisão arquitetural

Três conceitos novos, deliberadamente separados:

1. **Código único (`Product.public_code`)** — gerado automaticamente pelo
   BipFlow na criação do produto, imutável depois, único **por loja**
   (mesmo padrão de `unique_product_sku_per_store`). Formato curto,
   alfanumérico, sem caracteres ambíguos (sem `0/O`, `1/I/L`), ex.
   `7K2M9X4P`. Não é um EAN/UPC — não tentamos emitir código de barras
   comercial (isso exigiria registro em entidade externa, GS1 etc., fora do
   escopo e sem necessidade real aqui). É um identificador interno do
   BipFlow, plotado num QR Code.

2. **QR Code = veículo, não o dado em si.** O QR não codifica só o código
   cru — codifica uma **URL pública** para a página do produto na loja
   virtual (`https://.../l/{store_slug}/p/{public_code}`), com o código como
   último segmento. Isso dá dois comportamentos "de graça" com o mesmo QR
   físico impresso na prateleira:
   - Câmera genérica de celular do cliente → abre a vitrine pública do
     produto (uso "loja virtual").
   - Leitor dedicado do PDV (câmera própria ou leitor USB) → extrai o
     `public_code` do fim da URL decodificada e resolve local/rápido, sem
     depender de navegar (uso "loja física").

3. **PDV físico é uma capacidade nova, não reaproveita o checkout do
   WhatsApp.** Hoje só existe `SaleOrder` nascendo do carrinho
   WhatsApp/e-commerce. Venda presencial precisa de um fluxo próprio
   (scan → carrinho local do caixa → "finalizar venda" → baixa atômica em
   lote), com um campo novo `SaleOrder.channel` (`virtual`/`loja_fisica`)
   para diferenciar nos relatórios. Reaproveita o **padrão** de lock em
   lote do checkout (`_lock_cart_products`/`_reserve_cart_stock`), não o
   código em si (que é fortemente acoplado ao formato do carrinho
   WhatsApp).

Importante sobre leitores de código físicos: a maioria dos leitores baratos
de QR/código de barras de balcão (USB, ~R$100) **emula um teclado** (HID) —
não precisa de biblioteca de câmera nenhuma, só um `<input>` focado que
recebe o texto + Enter. A tela de PDV deve suportar os dois caminhos:
input HID (funciona com qualquer leitor de balcão, sem pedir permissão de
câmera) **e** scanner via câmera do navegador (para tablet/celular sem
leitor dedicado). Isso evita depender só de uma lib de câmera para o caso de
uso principal do lojista.

> **Decisão tomada na implementação (Etapa 3):** o caminho por câmera
> (`html5-qrcode`) foi deliberadamente deixado de fora desta primeira
> entrega. Adicionar uma dependência nova de câmera sem conseguir testá-la
> de verdade neste ambiente (sem hardware de câmera disponível) seria menos
> responsável do que entregar bem o caminho HID sozinho — que já é o fluxo
> principal do lojista com um leitor de balcão de verdade, é 100% testável
> (unit + E2E ao vivo) e não adiciona nenhuma dependência nova. O botão
> "usar câmera" fica como fast-follow explícito, não como parte desta
> entrega.

## 2. Etapa 1 — Fundação: código único gerado pelo BipFlow ✅ (concluída)

Backend:

- Novo campo `Product.public_code` (`bipdelivery/api/models.py`, `CharField`,
  `max_length=12`, `blank=True, default=""`), gerado em `Product.save()`
  quando vazio via `generate_product_public_code()` (alfabeto
  `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, sem `0/O/1/I/L`, 8 caracteres — mesmo
  espírito do alfabeto de `MFABackupCode._generate_plain_code()`).
- `UniqueConstraint(["store", "public_code"],
  name="unique_product_public_code_per_store")` adicionada **em uma
  migration separada** (`0025`), só depois do backfill (`0024`) — dividir em
  3 migrations (`0023` adiciona o campo, `0024` faz o backfill via
  `RunPython`, `0025` adiciona a constraint) evita que a constraint tente
  nascer com linhas antigas todas em branco colidindo entre si.
- Geração com retry: `Product._save_with_generated_public_code()` tenta
  salvar, e se o `IntegrityError` menciona `public_code` (colisão real, ~1
  em 8.5×10¹¹ combinações por loja), gera outro código e tenta de novo (até
  8 vezes); se o erro for sobre **outro** campo (ex. `slug` duplicado), ele
  é relançado imediatamente na primeira tentativa — um código novo nunca
  resolveria esse tipo de conflito, então continuar tentando só mascararia
  o erro real.
- **Backfill obrigatório** (diferente da decisão da Etapa 1 do
  `stock-movement-evolution.md`, que deliberadamente não fabricou
  histórico): aqui é necessário porque um produto sem código não pode ser
  vendido por QR. Migration de dados `0024_backfill_product_public_code.py`
  (histórico não tem acesso ao `save()` real, então a geração é reimplementada
  ali mesmo, de propósito — migrations precisam ficar auto-contidas) +
  management command `generate_missing_product_codes` reutilizável para
  o caso raro de precisar rodar de novo fora de uma migration (ex. import
  em lote que grave `public_code=""` direto).
- `GET /v1/products/by-code/{code}/` (`ProductViewSet.by_code`,
  `views.py`), mesmo padrão do `by_slug` — público, escopado por
  `get_queryset()`, normaliza o código para maiúsculas antes de comparar
  (leitor/teclado pode enviar minúsculas).
- `ProductViewSet.perform_update` ganha a mesma guarda que já existia para
  `stock_quantity`: rejeita PATCH que inclua `public_code` (400).

Frontend:

- Campo "Código BipFlow" (somente leitura, com botão copiar) em
  `IdentitySection.vue` — só aparece editando um produto existente (um
  produto novo ainda não tem código antes de salvar).
- `TableRow.vue`/`TableRowCard.vue`: chip `#CÓDIGO` abaixo do SKU.
- `schemas/product.schema.ts`: novo campo `public_code` no `ProductSchema`
  (não faz parte do `ProductFormSchema` de escrita — é só leitura).

Testes: `bipdelivery/tests/test_product_public_code.py` (geração,
alfabeto, unicidade só por loja — dois produtos em lojas diferentes podem
compartilhar código —, retry em colisão real vs. relançar em colisão de
outro campo, backfill via management command, lookup por código
case-insensitive e isolado por loja, PATCH rejeitado). Frontend:
`IdentitySection.spec.ts` (novo), extensão de `TableRow.spec.ts` e
`product.schema.spec.ts`.

**Achado ao verificar contra o servidor de desenvolvimento real:** nenhum
bug de produção, mas a verificação ao vivo confirmou que produtos já
existentes no banco de dev foram backfilled corretamente e que o lookup
case-insensitive funciona (`curl .../by-code/gs69exds/` resolve o mesmo
produto que `GS69EXDS`).

**Visível para o usuário final:** sim (código aparece no painel).
**Risco:** baixo — aditivo, só cria e expõe um campo novo.

## 3. Etapa 2 — Geração visual do QR Code e etiqueta imprimível ✅ (concluída)

Backend:

- Novo módulo `bipdelivery/api/product_labels.py` (não empilhado em
  `views.py`, que já é grande): `build_product_deep_link_url()` monta
  `f"{FRONTEND_BASE_URL}/l/{store.slug}/p/{product.public_code}"`, e
  `build_product_qr_code_data_uri()` reaproveita a lib `qrcode` (já é
  dependência, usada em `mfa.py`) para gerar um data URI PNG a partir dessa
  URL — mesmo padrão de `build_qr_code_data_uri()` do MFA, sem model novo
  (gerado sob demanda; como o código é imutável, o QR nunca fica "stale").
- `ProductViewSet.qr_code` (`GET /v1/products/{id}/qr-code/`,
  `has_dashboard_read_access`, mesma checagem inline de
  `self.permission_denied()` que `stock_movements` já usa para manter o
  401-vs-403 consistente).
- **Gap conhecido e deliberado:** a URL codificada aponta para a rota
  pública `/l/:storeSlug/p/:code`, que só a Etapa 4 vai criar. Até lá, abrir
  o QR com uma câmera genérica dá 404 no frontend — o PDV (Etapa 3) não é
  afetado, porque ele nunca navega para essa URL, só extrai o
  `public_code` do fim dela. Imprimir etiquetas antes da Etapa 4 existir
  significa que nenhuma etiqueta precisa ser reimpressa quando a Etapa 4
  entrar no ar.

Frontend:

- `ProductLabelModal.vue`: modal com nome, preço, `<img>` do QR (a imagem
  já vem pronta do backend, sem lib de canvas nova) e botão "Imprimir"
  (`window.print()`), com um bloco de CSS **não-scoped** dedicado a
  `@media print` — necessário porque o modal é `Teleport`-ado para
  `<body>`, então o resto do dashboard é irmão, não descendente, de
  qualquer estilo `scoped` deste componente.
- Ação "Imprimir etiqueta" (ícone de QR Code) adicionada em `TableRow.vue`
  e `TableRowCard.vue`, ao lado de "Movimentar estoque"/editar/excluir.
- `ProductService.getQrCode()` + `types/productLabel.ts` (schema Zod
  validando que `qr_code` é mesmo um data URI `image/png`).
- Ação em lote (imprimir etiquetas de vários produtos de uma vez) ficou de
  fora — avaliar depois, não é bloqueante para o caso de uso principal
  (imprimir uma etiqueta por vez ao cadastrar/reabastecer um produto).

Testes: `bipdelivery/tests/test_product_qr_code.py` (payload da URL,
permissão do endpoint — anônimo 401, autenticado sem papel 403, viewer 200
—, isolamento por loja). Frontend: `ProductLabelModal.spec.ts` (novo),
extensão de `product.service.spec.ts`, `TableRow.spec.ts` e
`ProductListing.spec.ts` (propagação do evento `print-label`).

**Visível para o usuário final:** sim (novo botão + modal de impressão).
**Risco:** baixo — leitura aditiva sobre um campo que a Etapa 1 já criou.

## 4. Etapa 3 — PDV físico: baixa de estoque via leitura do código ✅ (concluída)

Backend:

- `SaleOrder.channel` (`CharField`, choices `virtual`/`loja_fisica`,
  default `virtual` — preserva o comportamento atual do WhatsApp sem
  migração de dados retroativa além do default) e
  `StockMovement.SOURCE_PDV = "pdv"` (novo choice ao lado de
  `manual`/`venda`), migration única `0026_pdv_channel_and_source.py`.
- Novo módulo `bipdelivery/api/pdv.py` (não empilhado em `views.py`):
  serializers próprios (`PdvSaleRequestSerializer`,
  `PdvSaleResponseSerializer`) e `PdvSaleView`
  (`POST /v1/pdv/sales/`) — vertical fatiado à parte porque é uma
  capacidade nova e auto-contida, não uma extensão do checkout existente.
  Recebe `{items: [{public_code, quantity}], payment_method,
  customer_name?, notes?}`, resolve produtos por `public_code` (não por
  `id`), reaproveita o **padrão** de lock em lote do checkout do WhatsApp
  (`_lock_cart_products`/`_reserve_cart_stock` → aqui
  `_lock_products`/`_reserve_stock`, mesma forma: lock ordenado por `id`,
  decremento validado sem deixar estoque negativo, `bulk_update` +
  `bulk_create` do `StockMovement`) e cria
  `SaleOrder(channel=CHANNEL_LOJA_FISICA, delivery_method="pickup")` +
  `SaleOrderItem` + `StockMovement` (`source=pdv`, `reason=venda`,
  `performed_by=request.user`) em uma única transação.
- Permissão verificada inline com `self.permission_denied()` (não
  `permission_classes`), mesmo padrão de `SaleOrderViewSet.update_status` e
  `ProductViewSet.stock_movements` — garante 401 para anônimo e 403 para
  autenticado sem papel de escrita, a mesma convenção usada em todo o
  restante do dashboard.
- `customer_name` é opcional (default `"Cliente balcão"`) e não há campos
  de entrega — uma venda de PDV é sempre retirada na hora.

Frontend:

- Nova rota `dashboard/pdv` (`DashboardPdvView.vue`) + item de navegação
  "PDV" em `DashboardHeader.vue`.
- Input HID: um único `<input>` focado (`autofocus`) que aceita tanto um
  leitor de balcão USB (que só "digita" o código + Enter) quanto um
  operador digitando o código manualmente — ver a nota da Seção 1 sobre a
  câmera ter ficado de fora desta entrega.
- `composables/usePdvCart.ts` (deliberadamente **não** singleton, mesmo
  raciocínio de `useStockMovements`): agrega automaticamente um segundo
  scan do mesmo produto na mesma linha em vez de duplicar — espelha
  `_aggregate_quantities()` do backend — e expõe `toSaleItems()` já no
  formato que `PdvSaleService.create()` espera.
- `services/pdvSale.service.ts` (`POST /v1/pdv/sales/`) e
  `ProductService.getByCode()` (`GET /v1/products/by-code/{code}/`,
  reaproveitando o mesmo endpoint da Etapa 1) para resolver cada
  scan/código digitado antes de adicionar ao carrinho.
- "Finalizar venda" chama o endpoint em lote uma única vez (não uma
  chamada por item escaneado); em caso de erro (ex. estoque insuficiente),
  o carrinho **não** é limpo, para o operador poder ajustar a quantidade e
  tentar de novo sem escanear tudo outra vez.

Testes: `bipdelivery/tests/test_pdv_sales.py` (venda de item único, venda
multi-item atômica, scans duplicados do mesmo código agregados, rejeição
de quantidade maior que o estoque sem efeito colateral, **falha parcial em
venda multi-item desfaz tudo** — o item bom não fica com estoque
decrementado se o item ruim falhar —, código desconhecido rejeitado,
lookup case-insensitive, código de outra loja não encontrado, lista vazia
rejeitada, anônimo 401, viewer 403, nome do cliente/observações opcionais
persistidos). Frontend: `usePdvCart.spec.ts`, `pdvSale.service.spec.ts`,
extensão de `product.service.spec.ts`, `DashboardPdvView.spec.ts` (sem
permissão, carrinho vazio, scan bem-sucedido, código não encontrado,
agregação de scan duplicado, venda finalizada com sucesso limpa o
carrinho, venda rejeitada mantém o carrinho).

**Achado ao escrever os testes (não um bug de produção):** a fixture de
teste que cria o produto B com estoque inicial (`self.product_b.stock_quantity
= 10; self.product_b.save(update_fields=["stock_quantity"])`) deixava
`is_available` desatualizado no banco — `Product.save()` recalcula
`is_available` em memória sempre, mas um `update_fields` restrito só
persiste as colunas listadas nele. Esse exato padrão já existe (sem efeito
observável) na fixture de `test_stock_movements.py`, porque nenhum teste
ali lê `is_available` de uma query nova; `PdvSaleView` lê, e por isso
expôs o problema. Corrigido incluindo `"is_available"` no `update_fields`
da fixture deste arquivo — o mesmo cuidado que `apply_stock_movement()` e
`_reserve_cart_stock()` já tomam em produção.

**Verificado contra o servidor de desenvolvimento real:** login com JWT
real, venda de 2 unidades via `POST /v1/pdv/sales/`, estoque confirmado
decrementando de 10 para 8, `StockMovement` conferido no ledger
(`source=pdv`, `reason=venda`, `previous_stock=10`, `new_stock=8`,
`sale_order` e `performed_by` preenchidos), e uma tentativa de venda de
99999 unidades corretamente rejeitada com 400 e sem alterar o estoque. Os
dados de teste foram removidos do banco de dev depois da verificação.

**Visível para o usuário final:** sim (nova tela/capacidade). **Risco:**
médio — é a única etapa que cria um caminho de escrita de venda novo
(analogamente ao checkout, mas com contrato próprio); verificado contra o
servidor de desenvolvimento real (não só testes automatizados), como o
risco médio desta etapa pedia.

## 5. Etapa 4 — Loja virtual: acesso direto ao produto via QR ✅ (concluída)

Backend: **nenhuma mudança** — `GET /v1/products/by-code/{code}/` (Etapa 1)
já é público e escopado por loja; esta etapa só consome o que já existe
(confirmado ao vivo: `curl` anônimo, sem header de autenticação, contra o
servidor de desenvolvimento real).

Frontend:

- Nova rota pública `/l/:storeSlug/p/:code`
  (`PublicRoutes.StoreProductByCode`, `router/public.routes.ts`) — a mesma
  URL que `build_product_deep_link_url()` (Etapa 2) codifica no QR. Reaproveita
  `ProductDetailView.vue`, a mesma tela que `StoreProductDetails` (por
  slug) já usa.
- `ProductService.getPublicByCode()`, espelhando `getPublicBySlug()` (mesmo
  schema `ProductDetailSchema` da vitrine pública, mesmo endpoint `by-code`
  que o PDV usa autenticado — aqui sem `Authorization`, já que é público).
- `ProductDetailView.vue`'s `loadProduct()` ganhou um branch: resolve por
  `route.params.code` quando presente, senão cai para `route.params.slug`
  como antes. Precisou de um **segundo watcher** dedicado a
  `route.params.code` (não só estender o watcher existente de `slug`):
  `watch()` só reage a mudança do valor observado, e navegar entre dois
  produtos por código nunca toca `route.params.slug` (fica `undefined` nos
  dois casos), então esse watcher sozinho não veria a troca.
- Adicionar ao carrinho a partir daí funciona sem nenhuma mudança no fluxo
  de checkout existente, porque o carrinho não sabe (nem precisa saber)
  que o produto chegou via QR em vez de navegação normal pela vitrine.

Testes: extensão de `product.service.spec.ts` (`getPublicByCode`).
**Deliberadamente sem harness de teste novo para `ProductDetailView.vue`**
— mesma decisão já registrada na Etapa 4 do `stock-movement-evolution.md`
para este mesmo arquivo (800+ linhas, múltiplas dependências de
rota/carrinho/serviços): a mudança é um branch pequeno reaproveitando uma
função (`getPublicByCode`) já exaustivamente testada isoladamente, e não
existe nenhum precedente de teste de rota neste repositório
(`router/**/*.spec.ts` não existe) — criar um harness do zero aqui seria
desproporcional ao tamanho da mudança.

**Visível para o usuário final:** sim (QR físico agora funciona também como
link direto pro cliente comprar online). **Risco:** baixo — reaproveita uma
tela e um endpoint já existentes com uma chave de busca diferente.

## 6. Etapa 5 — Relatórios por canal ✅ (concluída)

**Bug real encontrado ao investigar esta etapa (não introduzido por ela):**
o filtro `source` do ledger de estoque (`StockMovementViewSet.get_base_queryset()`)
validava contra uma tupla fixa `(SOURCE_MANUAL, SOURCE_VENDA)` escrita antes
de `SOURCE_PDV` existir. Isso significa que `?source=pdv` nunca aplicava
filtro nenhum — a condição `if source in (...)` era `False` para `"pdv"`,
então a query seguia **sem filtrar**, retornando todas as movimentações
(silenciosamente errado, não um 400 nem uma lista vazia). Corrigido para
validar contra `dict(StockMovement.SOURCE_CHOICES)`, então qualquer novo
`source` futuro passa a ser filtrável automaticamente, sem precisar lembrar
de atualizar essa tupla de novo.

Backend:

- `SaleOrderViewSet.get_base_queryset()` ganhou um filtro `?channel=virtual|loja_fisica`
  (mesmo formato de validação de `?status=`), que alimenta `list`,
  `summary`, `timeseries`, `breakdown` e `customers` — todos constroem
  sobre `get_queryset()`.
- `SaleOrderViewSet.breakdown()` ganhou `by_channel` (novo
  `ChannelBreakdownSerializer`, mesmo formato de `by_payment_method`):
  soma `revenue_total`/`orders_count` por canal dentro do período,
  transformando `SaleOrder.channel` (Etapa 3) na comparação
  loja-física-vs-virtual que esta evolução inteira existe para habilitar.
- `SaleOrderSerializer` ganhou o campo `channel` (não estava exposto desde
  a Etapa 3 — sem isso, a distinção de canal era invisível em qualquer
  lugar do painel, mesmo já estando gravada no banco).
- Fix do bug de `source` descrito acima.

Frontend:

- `types/sales.ts`: `SaleOrderChannel`, `channel` em `SaleOrder`,
  `ChannelBreakdown` e `by_channel` em `SaleOrderBreakdown`.
- `constants/saleOrder.ts`: `getChannelLabel()` (Virtual/Loja física).
- Novo `ChannelBreakdownCard.vue` na grade de análise de vendas
  (`SalesAnalyticsSection.vue`) — lista de progresso (mesmo padrão de
  `RegionBreakdownCard.vue`), não outro donut do apexcharts: são só duas
  categorias, uma comparação binária lê melhor como barra de progresso do
  que como rosca, e evita puxar de novo o bundle pesado do apexcharts para
  esse card especificamente (ele já é `defineAsyncComponent`-carregado por
  outro card, então essa escolha não muda o bundle total, mas mantém o
  componente mais simples).
- Badge de canal (Loja física/Virtual) no card de cada pedido em
  `DashboardOrdersView.vue`, ao lado do badge de método de entrega —
  fecha o loop de "visível pro usuário" também no nível de pedido
  individual, não só no agregado.
- `types/stockMovement.ts`: `STOCK_MOVEMENT_SOURCES` ganhou `'pdv'`;
  `DashboardStockMovementsView.vue`'s filtro "Origem" ganhou a opção
  "PDV".

Testes: `bipdelivery/tests/test_sales_channel_reporting.py` (campo
`channel` exposto, default `virtual` para pedidos sem canal explícito,
filtro de lista por canal, valor de canal inválido ignorado sem erro,
`by_channel` agrupa corretamente, filtro de canal também restringe o
breakdown, e o teste de regressão do bug do `source` do ledger — antes da
correção esse teste falhava confirmando o bug, depois passa). Frontend:
extensão de `saleOrder.spec.ts`, novo `ChannelBreakdownCard.spec.ts`,
extensão de `DashboardOverviewView.spec.ts`/`DashboardOrdersView.spec.ts`/`DashboardStockMovementsView.spec.ts`.

**Verificado contra o servidor de desenvolvimento real:** registrei uma
venda de PDV de verdade, conferi que `by_channel` passou a mostrar as duas
linhas (virtual e loja_fisica) com os totais corretos, que
`?channel=loja_fisica` realmente restringe a lista, e que
`?source=pdv` no ledger agora retorna só a movimentação de PDV (antes da
correção retornaria todas). Dados de teste removidos depois.

**Visível para o usuário final:** sim (badge por pedido + card de análise +
filtro de origem no ledger). **Risco:** baixo — leitura/relatório aditivo
sobre um campo que a Etapa 3 já gravava; o único ponto de atenção real foi
o bug de filtro pré-existente, que a suíte de regressão agora cobre.

## 6.1. Etapa 6 — Impressão em lote de etiquetas ✅ (concluída)

A Etapa 2 deixou explicitamente registrado que "ação em lote (imprimir
etiquetas de vários produtos de uma vez) ficou de fora — avaliar depois,
não é bloqueante". Esta etapa fecha esse gap: seleção de produtos
minimalista (individual, todos ou nenhum), preview em grade das etiquetas
selecionadas com tamanho/variação visível, e imprimir ou baixar um único
PDF com todas as etiquetas.

Backend:

- Novo `build_product_label_payload()` em `product_labels.py` — payload por
  produto mais rico que o de `qr_code` (`id`, `public_code`, `name`,
  `price`, `size`, `url`, `qr_code`), reaproveitando
  `build_product_deep_link_url()`/`build_product_qr_code_data_uri()` sem
  duplicar a geração do QR.
- `ProductViewSet.qr_codes_bulk` (`GET /v1/products/qr-codes-bulk/?ids=1,2,3`,
  detail=False). **Decisão deliberada: GET, não POST**, com a mesma checagem
  inline `has_dashboard_read_access()` de `qr_code` — é uma ação de leitura/
  renderização, não uma mutação de catálogo, então um `viewer` deve poder
  usá-la como já pode ver uma etiqueta individual. `AllowAnyReadDashboardWrite`
  libera qualquer `SAFE_METHODS` (GET incluso) a nível de classe; um POST
  aqui teria exigido `has_dashboard_write_access` no dispatch, bloqueando
  `viewer` incorretamente.
- IDs de outra loja ou inexistentes **nunca derrubam o lote inteiro** —
  diferente de `bulk_update_category`. `qr_codes_bulk` resolve via
  `self.get_queryset().filter(id__in=ids)` (mesmo chokepoint de escopo por
  loja) e reporta `missing_ids` separado de `labels`, para que imprimir
  etiquetas de 48 de 50 produtos selecionados continue funcionando mesmo se
  2 tiverem sido excluídos entretanto.
- Teto de `MAX_BULK_LABEL_IDS = 50` (mesmo valor de
  `ProductListPagination.max_page_size`) evita uma request síncrona lenta ou
  uma tiragem de impressão patológica.

Frontend:

- `useProducts.toggleSelectAll()` fecha o gap real encontrado ao investigar
  esta etapa: o checkbox de cabeçalho "selecionar todos" sempre chamava
  `selectAll()`, mesmo com tudo já selecionado — não existia "clicar de
  novo para desmarcar tudo" nesse controle (só pelo botão "Cancelar" da
  barra de seleção em lote). Agora alterna select-all ↔ clear conforme
  `isAllSelected`; seleção indeterminada (parcial) completa para "todos" em
  vez de limpar, igual ao comportamento nativo de checkbox tri-state.
- Bloco mobile (`TableRowCard.vue`) ganhou seu próprio controle de
  "selecionar todos" — antes só existia na tabela desktop, então um usuário
  de celular só conseguia selecionar produto a produto.
- `ProductLabelModal.vue` ganhou um chip "Tamanho: X" condicional (só
  quando `product.size` existe) — mesmo tratamento no novo modal em lote.
- Novo `BulkQrLabelsModal.vue`: preview em grade (`grid-template-columns:
  repeat(auto-fill, minmax(160px, 1fr))`, reflow automático de 1 coluna no
  celular a 3-4 no desktop), reaproveitando o visual de
  `.qr-printable-label` de `ProductLabelModal.vue`. Espelha o par de ações
  "Imprimir"/"Baixar PDF" que `PdvSaleReceiptModal.vue` já resolve para o
  recibo do PDV (mesmo `Teleport`, `useDialogA11y`, truque de `<style>`
  não-scoped para `@media print`). Aviso não-bloqueante quando `missing_ids`
  não é vazio — as etiquetas encontradas continuam imprimíveis/baixáveis.
- `productIds` é um **snapshot** de IDs (não `Product[]` resolvido de
  `products.value`) tirado na abertura do modal: uma seleção pode sobreviver
  a uma troca de filtro que tira o produto da lista carregada, então o
  modal sempre resolve as etiquetas direto do backend por ID — por isso o
  payload do backend já embute `name`/`price`/`size`, sem depender do
  frontend re-derivar esses campos de uma lista que pode estar desatualizada.
- Novo `utils/productLabelsPdf.ts` (jsPDF, já dependência do projeto via
  `receiptPdf.ts` — nenhuma lib nova): grade fixa A4, 2 colunas × 5 linhas
  (10 etiquetas/página), paginação por aritmética simples
  (`doc.addPage()` a cada 10ª etiqueta). **Sem passe de medição prévia**
  (diferente de `receiptPdf.ts`): a página é sempre A4 fixo com células de
  tamanho fixo, então não há altura desconhecida para medir; nome de
  produto longo é clampado a 2 linhas por célula em vez de deixar a célula
  crescer (cresceria e desalinharia a grade fixa das vizinhas).

Testes: `bipdelivery/tests/test_product_qr_code_bulk.py` (12 casos: labels
retornadas com todos os campos, `size` null quando ausente, exclusão
silenciosa de IDs de outra loja, `missing_ids` sem derrubar o lote, `ids`
vazio/malformado/acima do teto rejeitados com 400, dedupe de IDs
repetidos, anônimo 401, autenticado sem papel 403, `viewer` 200 — esse
último prova a decisão GET-vs-POST contra um request real). Frontend:
extensão de `useProducts.spec.ts` (`toggleSelectAll` nos 3 estados:
nenhum/todos/indeterminado), `ProductListing.spec.ts`, novo
`BulkActionBar.spec.ts` (não existia cobertura nenhuma antes), extensão de
`ProductLabelModal.spec.ts` (chip de tamanho), novo
`BulkQrLabelsModal.spec.ts`, novo `productLabelsPdf.spec.ts` (mirror de
`receiptPdf.spec.ts`), extensão de `product.service.spec.ts`. Novo
`cypress/e2e/product_bulk_labels.cy.ts` (seleção parcial, toggle
select-all/deselect-all, preview em lote, passada mobile 390×844 com
`scrollIntoView`/checagem de bounding-box em vez de `should('be.visible')`
na grade inteira — o container de preview é intencionalmente mais alto que
o viewport do modal rolável, então checar visibilidade do primeiro card em
vez do grid inteiro é o que de fato prova "mobile-safe").

**Verificado contra o servidor de desenvolvimento real:** login real,
seleção de produtos reais (alguns com `size`, outros sem), preview em lote
aberto e grade renderizada corretamente, PDF baixado e o arquivo real
aberto para conferir QR/texto nas células certas (não só "não lança
exceção"), suíte E2E completa (4 testes) rodando contra o servidor real em
desktop e em viewport 390×844, incluindo o toggle select-all/deselect-all.
**Achado durante a verificação:** `media_upload.cy.ts` já falhava de forma
determinística e idêntica contra o código original (confirmado isolando
via `git stash`/`git stash pop`) — bug pré-existente não relacionado a esta
etapa (a suíte roda em viewport `iphone-8` e a asserção final checa a
tabela desktop, que fica `display:none` nesse viewport), não corrigido
aqui por estar fora do escopo deste trabalho.

**Visível para o usuário final:** sim (seleção corrigida + botão "Etiquetas"
na barra de seleção em lote + modal de preview/impressão/PDF em lote).
**Risco:** baixo — leitura aditiva sobre endpoints/componentes já existentes;
o único ponto de atenção real foi a decisão GET-vs-POST do novo endpoint,
verificada contra o comportamento real de `AllowAnyReadDashboardWrite`.

## 7. Riscos e pontos de atenção

| Risco | Onde aparece | Mitigação |
| --- | --- | --- |
| Colisão de código gerado | Etapa 1 | Retry local em `IntegrityError`, sem sequência global — mesmo padrão do sufixo de slug já usado |
| Produtos antigos sem código, inutilizáveis pro QR | Etapa 1 | Backfill obrigatório via management command + migration de dados (ao contrário da decisão de não-backfill do ledger de estoque) |
| QR impresso ficar inválido se o código puder ser regenerado | Etapa 1/2 | `public_code` é imutável por design — nenhum endpoint de "regenerar"; se algum dia for necessário, precisa reimprimir a etiqueta física, então tratar como ação rara e explícita, não parte do fluxo normal |
| Leitor HID de balcão exigir lib de câmera desnecessária | Etapa 3 | Input de texto focado como caminho primário; câmera é o caminho secundário/opcional |
| Duas vendas presenciais simultâneas do mesmo produto | Etapa 3 | Reaproveita o mesmo lock em lote (`select_for_update` ordenado por `id`) que o checkout do WhatsApp já usa hoje |
| `SaleOrder.channel` sem default seguro quebrar relatórios existentes | Etapa 3 | `default="virtual"` preserva o comportamento e os dados atuais sem migração de dados retroativa |
| Confundir `public_code` (gerado, imutável) com `sku` (manual, editável) | Etapa 1 | Campos deliberadamente separados na UI e no modelo — `sku` continua sendo o código do lojista, `public_code` é o código do BipFlow |
| Um `watch()` de rota só reage a *mudança* do valor observado, não à sua presença | Etapa 4 | `route.params.code` precisou do seu próprio watcher — o watcher existente de `route.params.slug` nunca dispara ao navegar entre dois produtos por código, já que esse campo fica `undefined` nos dois casos |
| Filtro `source` do ledger validado contra uma tupla fixa de valores conhecidos *na época em que foi escrito* | Etapa 5 (bug encontrado, não introduzido) | `?source=pdv` silenciosamente não filtrava nada (retornava tudo) em vez de dar erro ou lista vazia — corrigido para validar contra `dict(StockMovement.SOURCE_CHOICES)` dinamicamente, para que um `source` futuro não repita o mesmo problema |

## 8. Definição de pronto

### Etapa 1

- [x] `Product.public_code` + constraint única por loja + migration
      (`0023`/`0024`/`0025`, campo → backfill → constraint, nessa ordem).
- [x] Geração automática sem colisão (retry local, relança na hora se o
      conflito for de outro campo).
- [x] Backfill dos produtos existentes (migration de dados + management
      command `generate_missing_product_codes` reutilizável).
- [x] `GET /v1/products/by-code/{code}/` (público, escopado por loja,
      case-insensitive).
- [x] PATCH com `public_code` rejeitado (imutabilidade).
- [x] Campo exibido em `IdentitySection.vue` (só leitura) e chip em
      `TableRow.vue`/`TableRowCard.vue`.
- [x] Testes backend (`test_product_public_code.py`, 15) e frontend
      (`IdentitySection.spec.ts`, extensões de `TableRow.spec.ts` e
      `product.schema.spec.ts`) verdes.
- [x] Verificado contra o servidor de desenvolvimento real (migração
      aplicada no banco de dev real, produtos existentes backfilled,
      lookup por código minúsculo confirmado).

### Etapa 2

- [x] `GET /v1/products/{id}/qr-code/` (dashboard, data URI PNG) em módulo
      próprio `product_labels.py`.
- [x] Ação "Imprimir etiqueta" (`ProductLabelModal.vue`, `window.print()`
      com CSS de impressão não-scoped) no frontend.
- [x] Testes backend (`test_product_qr_code.py`, 5) e frontend
      (`ProductLabelModal.spec.ts`, extensões de `product.service.spec.ts`,
      `TableRow.spec.ts`, `ProductListing.spec.ts`) verdes.

### Etapa 3

- [x] `SaleOrder.channel` + `StockMovement.SOURCE_PDV` (migration única
      `0026`).
- [x] `POST /v1/pdv/sales/` atômico, resolvendo por `public_code`, em
      módulo próprio `pdv.py`.
- [x] Tela de PDV (`DashboardPdvView.vue`): input HID + carrinho local +
      finalizar venda. Scanner via câmera deliberadamente adiado (ver
      Seção 1) — não bloqueou esta entrega.
- [x] Verificado contra o servidor de desenvolvimento real: venda real via
      JWT + `curl`, estoque decrementado corretamente, `StockMovement`
      conferido no ledger, overselling corretamente rejeitado sem efeito
      colateral. Dados de teste removidos depois.
- [x] Testes backend (`test_pdv_sales.py`, 12, incluindo atomicidade de
      falha parcial em venda multi-item) e frontend (`usePdvCart.spec.ts`,
      `pdvSale.service.spec.ts`, extensão de `product.service.spec.ts`,
      `DashboardPdvView.spec.ts`) verdes.

### Etapa 4

- [x] Rota pública `/l/:storeSlug/p/:code` (`PublicRoutes.StoreProductByCode`)
      reaproveitando `ProductDetailView.vue`.
- [x] `ProductService.getPublicByCode()` (mesmo endpoint `by-code` da
      Etapa 1, validado contra o schema público `ProductDetailSchema`).
- [x] Watcher dedicado para `route.params.code` (o watcher de `slug`
      existente não pega a troca entre dois produtos por código).
- [x] Verificado contra o servidor de desenvolvimento real (lookup por
      código anônimo, sem header de autenticação).
- [x] Testes: extensão de `product.service.spec.ts`. Sem harness novo para
      `ProductDetailView.vue` (mesma decisão já tomada na Etapa 4 do
      `stock-movement-evolution.md` para este arquivo).

### Etapa 5

- [x] `?channel=virtual|loja_fisica` em `SaleOrderViewSet` (list/summary/
      timeseries/breakdown/customers).
- [x] `by_channel` no `breakdown` (`ChannelBreakdownSerializer`).
- [x] `channel` exposto em `SaleOrderSerializer` (não estava desde a
      Etapa 3).
- [x] **Bug corrigido:** filtro `source` do ledger de estoque validava
      contra uma tupla fixa sem `pdv`, então `?source=pdv` não filtrava
      nada — agora valida contra `dict(StockMovement.SOURCE_CHOICES)`.
- [x] `ChannelBreakdownCard.vue` na análise de vendas, badge de canal em
      `DashboardOrdersView.vue`, opção "PDV" no filtro "Origem" do ledger.
- [x] Verificado contra o servidor de desenvolvimento real: venda de PDV
      real, `by_channel` com as duas linhas corretas, filtro `?channel=`
      restringindo a lista, filtro `?source=pdv` do ledger corrigido e
      confirmado. Dados de teste removidos depois.
- [x] Testes backend (`test_sales_channel_reporting.py`, 9, incluindo o
      teste de regressão do bug do `source`) e frontend (extensão de
      `saleOrder.spec.ts`, novo `ChannelBreakdownCard.spec.ts`, extensões
      de `DashboardOverviewView.spec.ts`/`DashboardOrdersView.spec.ts`/
      `DashboardStockMovementsView.spec.ts`) verdes.

### Etapa 6

- [x] `GET /v1/products/qr-codes-bulk/?ids=1,2,3` (`ProductViewSet.qr_codes_bulk`),
      GET com checagem inline `has_dashboard_read_access` (decisão
      deliberada vs. POST, ver Seção 6.1).
- [x] `build_product_label_payload()` + `MAX_BULK_LABEL_IDS = 50` em
      `product_labels.py`, reaproveitando as funções de QR já existentes.
- [x] IDs de outra loja/inexistentes reportados em `missing_ids` sem
      derrubar o lote inteiro.
- [x] `useProducts.toggleSelectAll()` (bug corrigido: checkbox de cabeçalho
      só selecionava, nunca desmarcava) + controle "selecionar todos" no
      bloco mobile (não existia antes).
- [x] Chip "Tamanho: X" condicional em `ProductLabelModal.vue` e no novo
      `BulkQrLabelsModal.vue`.
- [x] `BulkQrLabelsModal.vue` (preview em grade responsiva, imprimir e
      baixar PDF) + `utils/productLabelsPdf.ts` (jsPDF, grade fixa A4,
      2×5 por página, sem lib nova).
- [x] Verificado contra o servidor de desenvolvimento real: seleção real,
      preview em lote, PDF baixado e aberto (QR/texto conferidos célula a
      célula), suíte E2E completa (4/4) em desktop e 390×844.
- [x] Testes backend (`test_product_qr_code_bulk.py`, 12) e frontend
      (extensão de `useProducts.spec.ts`/`ProductListing.spec.ts`/
      `ProductLabelModal.spec.ts`/`product.service.spec.ts`, novo
      `BulkActionBar.spec.ts`/`BulkQrLabelsModal.spec.ts`/
      `productLabelsPdf.spec.ts`, novo `cypress/e2e/product_bulk_labels.cy.ts`)
      verdes.

## 9. Estado da suíte após Etapas 1–6

447 testes backend (pytest) + 506 testes frontend (vitest) verdes,
`vue-tsc --noEmit` limpo, `eslint`/`ruff` limpos nos arquivos tocados.
Nenhuma migration nova nesta etapa (`qr_codes_bulk` é uma action de
leitura pura, sem mudança de schema).

Com isso, as 6 etapas desta evolução (as 5 originais + o fast-follow de
impressão em lote) estão concluídas. Nenhum trabalho adicional foi
identificado como bloqueante; o scanner via câmera no PDV (Etapa 3)
continua registrado como fast-follow explícito, não como pendência.

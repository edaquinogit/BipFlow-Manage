# Evolução: Gestão de Pedidos, Nota Fiscal (NFC-e) e Envio

Este documento descreve o plano para evoluir a **área de Pedidos** do dashboard
de uma tela de listagem simples para um centro de gerenciamento operacional
completo: acompanhar o pedido desde a chegada (WhatsApp/vitrine ou PDV físico)
até a entrega, com **emissão de nota fiscal eletrônica (NFC-e)** e **registro
de envio/rastreio**. Segue o mesmo padrão de **etapas verticais** de
`docs/architecture/multi-tenant-evolution.md` e
`docs/architecture/qrcode-stock-exit-evolution.md`: cada etapa entrega backend
e frontend juntos, testado, sem quebrar o que já funciona.

> **Revisão de 2026-07-08:** cada afirmação da seção 0 foi reconferida
> contra o código atual (models.py, serializers.py, views.py,
> permissions.py, saleOrder.ts, useCurrentUser.ts) antes de iniciar a
> implementação. Todas se mantiveram válidas; 4 lacunas concretas foram
> incorporadas ao plano: (1) decisão 7 tinha um pressuposto de RBAC que não
> existe no código — corrigida para uma fase 1 barata (alias) + fase 2
> restrita (owner/admin só nas ações fiscais); (2) `update_status` não tem
> guarda de transição de estado (Etapa 1); (3) `PaymentBreakdownCard.vue`
> tem um mapa de status duplicado não coberto por nenhuma etapa (Etapa 1);
> (4) `fiscal_provider_token` deve reaproveitar `crypto.py` existente, não
> criar criptografia nova (Etapa 2).

Decisões de escopo confirmadas com o lojista antes deste plano:
- **NF: integração fiscal real** (NFC-e válida perante a SEFAZ), não um
  recibo informativo.
- **Envio: manual** (transportadora + código de rastreio digitados pelo
  operador), sem integração de API de frete/etiqueta nesta rodada.

## 0. Estado atual (levantamento factual, não suposição)

Feito via leitura completa do código antes deste plano — resumo do que existe
e do que falta:

**Frontend (`DashboardOrdersView.vue`, 362 linhas — única tela de pedidos):**
- Sem modal/drawer de detalhe do pedido: tudo é um `<article>` inline num
  card de lista. Não há como ver o endereço completo, observações do
  cliente, ou o histórico do pedido.
- **Paginação quebrada silenciosamente**: sempre busca `pageSize: 20`,
  página 1; `count/next/previous` da resposta paginada nunca são lidos.
  Lojas com mais de 20 pedidos simplesmente não veem o resto.
- Filtro de canal (`virtual`/`loja_fisica`) existe no backend mas não na UI.
- Troca de status é um `<select>` solto no card; só cancelamento tem
  confirmação (por causa da reposição de estoque automática).
- Permissão de escrita reaproveita `canManageCatalog` — não existe papel
  dedicado de gestão de pedidos.
- `PdvSaleReceiptModal.vue` existe, mas é o **cupom não fiscal do PDV**
  (rótulo explícito "Cupom não fiscal"), não tem relação com a tela de
  Pedidos nem serve de base para nota fiscal real.

**Backend (`SaleOrder`, `bipdelivery/api/models.py:625-720`):**
- 3 status apenas: `prepared` ("Novo"), `sent` ("Enviado"), `cancelled`
  ("Cancelado") — não existe `delivered` ("Entregue"). O fluxo é linear
  `prepared → sent`, sem confirmação final de entrega.
- Campos `address`, `neighborhood`, `city`, `notes`, `message`,
  `whatsapp_url` **existem no model mas não são expostos pelo
  `SaleOrderSerializer`** — hoje o dashboard não consegue ver o endereço de
  entrega nem as observações do cliente em lugar nenhum da UI.
- `DeliveryRegion` é só nome + taxa fixa em R$, sem prazo, transportadora ou
  zona calculada.
- Dois pontos de criação de pedido: `CheckoutWhatsAppView` (canal
  `virtual`) e `PdvSaleView` (canal `loja_fisica`), ambos em transação
  atômica com lock de estoque.
- `apply_order_cancellation()` (`bipdelivery/api/stock.py`) já repõe
  estoque de forma idempotente ao cancelar — ponto de integração
  obrigatório para a regra fiscal da Etapa 4 (não deixar pedido cancelado
  com NF-e autorizada "viva").

**Confirmado por grep no repositório inteiro (frontend + backend):** zero
ocorrências de nota fiscal, NFe/NFC-e, invoice, transportadora, Correios,
código de rastreio, ou qualquer campo fiscal em `Product`/`Store`. Não há
fila de tarefas assíncronas no backend (`requirements.txt` só tem
`django-redis` para cache — sem Celery/RQ). Isso é terreno 100% novo, nada a
reaproveitar além do padrão de transação atômica e do link `wa.me/...` já
usado no checkout.

## 1. Decisões arquiteturais

1. **Tipo de documento fiscal: NFC-e (modelo 65), não NF-e (modelo 55).**
   Os dois canais de venda do BipFlow (`virtual` e `loja_fisica`) são venda a
   consumidor final — exatamente o caso de uso da NFC-e. NF-e (modelo 55) é
   para operações B2B/interestaduais mais complexas e não se aplica aqui.
   Se um cliente pedir nota com CNPJ (compra para revenda/empresa), isso é
   caso raro e fica deliberadamente fora do escopo desta evolução.

2. **Emitir via provedor terceirizado, não implementar o webservice da
   SEFAZ diretamente.** Assinar XML com certificado ICP-Brasil e falar com
   os webservices estaduais (um endpoint por UF, contingência, SVC-RS/SVC-SP
   etc.) é um projeto de meses por si só e um risco de compliance alto para
   ser reinventado num projeto solo. Recomendação: **Focus NFe** (ou
   **PlugNotas**/**eNotas** como alternativas equivalentes) — API REST,
   ambiente de homologação próprio, webhook de autorização, cobrança por
   nota emitida. A escolha final do provedor (preço, contrato) é uma decisão
   de negócio do lojista, fora do escopo de engenharia deste documento; o
   desenho abaixo assume uma interface de provedor abstrata
   (`FiscalProvider`) para não acoplar o código a uma API específica antes
   da escolha final.

3. **BipFlow nunca armazena o certificado digital A1 do lojista.** O
   certificado é cadastrado diretamente no painel do provedor fiscal escolhido
   (fora do BipFlow). O BipFlow guarda só a credencial de API do provedor
   (token) e o identificador da empresa/loja naquele provedor — nunca a chave
   privada do certificado. Ponto de segurança não negociável.

4. **Emissão assíncrona via webhook do provedor, sem fila própria
   (Celery/RQ).** O backend hoje não tem infraestrutura de tarefas
   assíncronas, e adicionar Celery+broker só para isso seria
   desproporcional. Em vez disso: `POST /emitir-nf/` dispara a chamada
   síncrona de "solicitar emissão" ao provedor (retorna rápido, em
   "processando"), e um endpoint novo `POST /v1/fiscal/webhook/{provider}/`
   recebe o callback assíncrono do provedor quando a SEFAZ autoriza/rejeita
   — sem exigir um worker próprio. Um botão "verificar status" no frontend
   cobre o caso raro de webhook perdido (reconsulta o provedor sob demanda).

5. **Classificação tributária por produto é decisão do lojista/contador,
   não do BipFlow.** O sistema fornece os campos (NCM, CFOP, CST/CSOSN,
   origem, unidade) e valida formato, mas não infere ou assume valores
   tributários — cada loja deve preencher com orientação contábil própria.
   Produto sem esses campos preenchidos bloqueia a emissão de NF-e para ele
   (erro claro, não emissão silenciosamente incorreta).

6. **Novo status `delivered` ("Entregue")** completando o ciclo de vida:
   `prepared → sent → delivered`, com `cancelled` possível a partir de
   `prepared` ou `sent`. Necessário porque "enviado" e "entregue" são fatos
   diferentes e o envio manual (transportadora + rastreio) só faz sentido
   como uma transição própria, distinta da entrega confirmada.

7. **Papel de permissão dedicado para pedidos (`can_manage_orders`), com
   escopo realista em duas fases — verificado contra `permissions.py` e
   `useCurrentUser.ts` antes desta revisão.** Hoje **não existe RBAC por
   funcionalidade**: `has_dashboard_write_access()` é um único gate binário
   (grupo Django `admin`/`manager`, ou `StoreMembership.role` em
   `owner`/`manager`) reaproveitado por tudo — inclusive
   `SaleOrderViewSet.update_status`, que já chama
   `has_dashboard_write_access()` diretamente, não uma permissão de
   catálogo. `canManageCatalog` no frontend é o mesmo gate sob um nome que
   sugere escopo (catálogo) que ele não tem de fato. `StoreMembership` só
   tem 3 papéis (`owner`/`manager`/`viewer`), sem um 4º nível para separar
   "pode editar produto" de "pode emitir nota fiscal" sem alterar schema.
   Fase 1 (Etapa 0): `can_manage_orders` nasce como um **alias semântico**
   do mesmo gate (`has_dashboard_write_access`) — não inventa papel novo,
   custo baixo, já corrige o nome e prepara o campo no serializer/frontend.
   Fase 2 (Etapas 3/4): as ações fiscais de fato sensíveis (emitir/cancelar
   NF-e) ganham um filtro **mais estrito** dentro do gate existente —
   apenas `StoreMembership.role == owner` ou grupo Django `admin` (exclui
   `manager`) — sem precisar de um papel novo, só uma checagem mais
   restrita reaproveitando a granularidade que já existe. Documentado aqui
   para a Etapa 0 não prometer uma RBAC nova que não vai ser construída
   nesta rodada.

## 2. Etapa 0 — Fundação de gestão de pedidos (pré-requisito para tudo)

Sem isso, nenhuma etapa seguinte tem onde "morar" na UI — hoje não existe
detalhe de pedido, e faltam dados básicos (endereço) que já são necessários
mesmo antes de pensar em NF ou envio.

Backend:
- `SaleOrderSerializer` passa a expor `address`, `neighborhood`, `city`,
  `notes`, `message`, `whatsapp_url` (dashboard-only, atrás de
  `has_dashboard_write_access`/nova permissão da decisão 7).
- Novo `SaleOrderDetailSerializer` (ou o mesmo serializer com campos extra
  no `retrieve`) para popular o modal de detalhe sem inflar o payload da
  listagem.
- `SaleOrderViewSet` vira `list`+`retrieve` de verdade (hoje é
  `ReadOnlyModelViewSet` mas a tela nunca chama `retrieve` porque não existe
  tela de detalhe).
- Novo campo `can_manage_orders` no perfil do usuário (`UserSerializer`),
  alias semântico de `has_dashboard_write_access()` — mesma checagem de
  hoje, nome correto (decisão arquitetural 7, fase 1). Não cria papel novo
  em `StoreMembership`.

Frontend:
- `SaleOrderDetailModal.vue` (ou rota `/dashboard/pedidos/:id`) — endereço
  completo, itens, forma de pagamento, observações do cliente, link
  `wa.me` original, histórico de status.
- Corrigir paginação real: usar `count/next/previous` da resposta paginada
  (paginação por página ou "carregar mais").
- Filtro de canal na UI (o backend já suporta `?channel=`).
- `useCurrentUser()` ganha `canManageOrders` ao lado de `canManageCatalog`.

## 3. Etapa 1 — Envio manual (transportadora + rastreio + entrega)

Backend:
- `SaleOrder` ganha `carrier_name` (texto livre ou lista de transportadoras
  comuns), `tracking_code`, `tracking_url` (opcional — gerado
  automaticamente por padrões conhecidos, ex. Correios, com fallback para
  link genérico se a transportadora não for reconhecida), `shipped_at`,
  `delivered_at`.
- Novo status `STATUS_DELIVERED = "delivered"` no `STATUS_CHOICES`
  (decisão arquitetural 6).
- `update_status` (`views.py`) exige `carrier_name`+`tracking_code` quando a
  transição for para `sent` **e** `delivery_method == "delivery"` (pedidos
  de retirada/`pickup` não têm envio — pulam direto para `delivered` ao
  serem retirados). Migration de dados: pedidos hoje em `sent` continuam
  válidos sem esses campos (`blank=True`), não é retroativo.
- **Guarda de transição de status (gap encontrado nesta revisão):** hoje
  `update_status` aceita qualquer valor de `STATUS_CHOICES` sem checar a
  ordem — nada impede um PATCH direto pulando `prepared → delivered` sem
  passar por `sent`, ou retrocedendo `sent → prepared`. Com 4 estados e
  `delivered` alimentando futuras regras fiscais (Etapa 4), isso deixa de
  ser cosmético. Adicionar um mapa explícito de transições permitidas
  (`prepared → sent|cancelled`, `sent → delivered|cancelled`, terminais:
  `delivered`, `cancelled`) e rejeitar qualquer transição fora dele com erro
  claro, antes de aplicar a regra de carrier/tracking acima.

Frontend:
- No modal de detalhe (Etapa 0): ação "Marcar como enviado" abre formulário
  (transportadora + código de rastreio) em vez do `<select>` solto de hoje;
  ação separada "Marcar como entregue".
- Botão "Notificar cliente" reaproveita o padrão `wa.me/...` já usado no
  checkout, pré-preenchendo mensagem com o código de rastreio.
- Timeline do pedido ganha o 3º passo (Novo → Enviado → Entregue); badge de
  status inclui "Entregue". Fonte única já existe em
  `src/constants/saleOrder.ts` (`SALE_STATUS_OPTIONS`,
  `SALE_STATUS_LABELS`, `SALE_TIMELINE_STEPS`) — adicionar `delivered` lá.
- **`PaymentBreakdownCard.vue` mantém seu próprio `STATUS_LABELS`/
  `STATUS_BADGE_CLASS` duplicado** (card de "status dos pedidos" na home do
  dashboard) em vez de reaproveitar `saleOrder.ts` — não achado em nenhuma
  busca anterior deste plano. Adicionar `delivered` ao tipo
  `SaleOrderStatus` quebra a build TS aqui (faltaria chave no `Record`), o
  que evita esquecer o arquivo, mas já que será tocado mesmo: substituir o
  mapa local por `getSaleStatusLabel`/uma cor derivada, eliminando a
  duplicação para um 5º status não repetir esse quase-erro.

## 4. Etapa 2 — Fundação fiscal (cadastro, sem emitir ainda)

Esta etapa **não emite nenhuma nota** — só constrói o cadastro sem o qual a
Etapa 3 não tem dado válido para enviar à SEFAZ.

Backend:
- `Store` ganha dados fiscais: `cnpj` (ou `cpf` para MEI), `inscricao_estadual`,
  `regime_tributario` (Simples Nacional/MEI/Lucro Presumido/Lucro Real —
  determina se produtos usam CSOSN ou CST), endereço fiscal completo (se
  ainda não existir separado do endereço de exibição pública),
  `fiscal_provider_token` (credencial do provedor, **armazenada
  criptografada reaproveitando `encrypt_secret`/`decrypt_secret` de
  `bipdelivery/api/crypto.py`** — já usado para o segredo TOTP, mesma
  ressalva já documentada lá: a chave deriva de `DJANGO_SECRET_KEY`, então
  rotacionar o secret do Django invalida o token fiscal guardado, exigindo
  recadastro manual no provedor; não introduzir um mecanismo de criptografia
  novo. Nunca exposta em claro em nenhum serializer),
  `fiscal_environment` (`homologacao`/`producao` — homologação por padrão
  até o lojista confirmar que quer emitir nota valendo de verdade).
- `Product` ganha campos fiscais: `ncm`, `cfop` (default `5102` — venda
  dentro do estado a consumidor final, override por produto para casos
  raros), `cest` (opcional, só para produtos sujeitos a substituição
  tributária), `origem` (nacional/importado, lista fechada da tabela do
  SEFAZ), `cst_csosn` (uma ou outra conforme `regime_tributario` da loja),
  `unidade_comercial` (UN, KG, CX, etc.).
- Validação: emitir NF-e para um pedido com item sem NCM/CFOP/CST-CSOSN
  preenchido falha com erro claro apontando qual produto está incompleto —
  nunca emite com valor tributário adivinhado.
- Captura opcional de CPF/CNPJ do cliente no checkout WhatsApp e no PDV
  (novo campo `SaleOrder.customer_document`, opcional — NFC-e permite
  "consumidor não identificado").

Frontend:
- Nova aba "Fiscal" em `DashboardSettingsView.vue` (mesmo padrão de tabs de
  `ReceiptSettingsTab.vue`/`DeliveryRegionsTab.vue`): CNPJ, IE, regime
  tributário, ambiente (homologação/produção com aviso visual forte se for
  produção), credencial do provedor.
- Nova aba "Fiscal" no formulário de produto (mesmo padrão de
  `IdentitySection.vue`): NCM, CFOP, CEST, origem, CST/CSOSN, unidade —
  com indicador visual de "pendente" nos produtos que ainda não têm esses
  campos preenchidos (para o lojista saber o que falta antes de tentar
  emitir).
- Campo opcional "CPF/CNPJ na nota" no checkout público e no PDV.

## 5. Etapa 3 — Emissão real de NFC-e

Backend:
- Interface `FiscalProvider` (abstrata) + implementação concreta do
  provedor escolhido (decisão arquitetural 2).
- `SaleOrder` ganha `nf_status` (`nao_emitida`/`processando`/`autorizada`/
  `rejeitada`/`cancelada`), `nf_chave_acesso`, `nf_numero`, `nf_serie`,
  `nf_protocolo`, `nf_danfe_url`, `nf_xml_url`, `nf_motivo_rejeicao`,
  `nf_emitida_em`.
- `POST /v1/sales-orders/{id}/emitir-nf/` — valida cadastro fiscal
  completo (loja + todos os produtos do pedido), monta o payload, chama o
  provedor, grava `nf_status=processando`. Permissão: gate estrito da
  decisão arquitetural 7 fase 2 (`StoreMembership.role == owner` ou grupo
  `admin` — não basta `can_manage_orders`/`manager`).
- `POST /v1/fiscal/webhook/{provider}/` — recebe autorização/rejeição
  assíncrona, atualiza `nf_status` e os campos derivados; endpoint público
  mas validado por assinatura/token do provedor (nunca confiar em payload
  não autenticado).
- `POST /v1/sales-orders/{id}/verificar-nf/` — reconsulta status sob
  demanda (cobre webhook perdido).
- PDV: opção por loja ("emitir automaticamente ao fechar venda") em
  Configurações → Fiscal, desligada por padrão (nem toda loja física vai
  querer emitir na hora de toda venda).

Frontend:
- Botão "Emitir NF-e" no modal de detalhe do pedido (Etapa 0), desabilitado
  com tooltip explicando o motivo se o cadastro fiscal estiver incompleto.
- Badge de status da nota (Não emitida/Processando/Autorizada/Rejeitada/
  Cancelada); ao rejeitar, mostra o motivo real devolvido pela SEFAZ (nunca
  um erro genérico) com botão "corrigir e reemitir".
- Quando autorizada: links de download do DANFE (PDF) e do XML.

## 6. Etapa 4 — Cancelamento fiscal e integração com o fluxo existente

Backend:
- `POST /v1/sales-orders/{id}/cancelar-nf/` — cancelamento fiscal dentro do
  prazo legal (normalmente 24h da autorização, configurável por UF via o
  próprio provedor). Mesmo gate estrito da Etapa 3 (owner/admin apenas).
- `apply_order_cancellation()` (`stock.py`) ganha uma guarda nova: se o
  pedido tem `nf_status=autorizada`, cancelar o pedido **exige** cancelar a
  NF-e primeiro (bloqueia com erro explícito em vez de deixar um pedido
  cancelado com nota fiscal ainda válida perante o Fisco) — ou, fora do
  prazo legal de cancelamento, orienta para emissão de nota de devolução
  (fluxo manual, fora do escopo automatizado desta etapa).
- Auditoria simples (`FiscalEmissionLog` ou reaproveitar padrão de log
  estruturado já existente) de tentativas de emissão/cancelamento, para
  suporte/debug quando a SEFAZ rejeitar por motivo não óbvio.

Frontend:
- Ação "Cancelar NF-e" no modal de detalhe, só visível dentro do prazo
  legal; ao tentar cancelar um pedido com NF autorizada, o modal de
  confirmação existente (`ConfirmModal.vue`) explica a exigência em vez de
  simplesmente falhar.

## 7. Riscos e pontos de atenção

| Risco | Etapa | Mitigação |
| --- | --- | --- |
| Certificado digital do lojista vazar/ser mal armazenado | 2/3 | BipFlow nunca guarda o certificado — cadastro fica no painel do provedor fiscal, BipFlow só guarda o token de API |
| Emitir NF com dado tributário errado (CST/CSOSN, NCM incorretos) | 2/3 | Sistema não infere valores — bloqueia emissão se campos obrigatórios do produto não estiverem preenchidos; responsabilidade de preenchimento é do lojista/contador |
| Adicionar Celery só para emissão assíncrona | 3 | Webhook do provedor cobre o assíncrono sem fila própria; botão de reconsulta cobre webhook perdido |
| Pedido cancelado com NF-e ainda autorizada (inconsistência fiscal) | 4 | `apply_order_cancellation()` passa a checar `nf_status` antes de permitir cancelamento simples |
| Emitir nota em produção sem querer durante testes | 2 | `fiscal_environment` default `homologacao`; UI com aviso visual forte ao mudar para produção |
| Pedido de retirada (`pickup`) forçado a preencher transportadora/rastreio | 1 | Regra condicional por `delivery_method` — pickup pula para `delivered` sem exigir dados de envio |
| Endpoint de webhook fiscal aceitar payload forjado | 3 | Validação de assinatura/token do provedor obrigatória antes de processar qualquer callback |
| Papel genérico (`canManageCatalog`) permitindo emitir NF/cancelar sem querer | 0/3/4 | `can_manage_orders` (Etapa 0) corrige o nome; emissão/cancelamento de NF (Etapas 3/4) exigem owner/admin, não só `can_manage_orders` — ver decisão 7 fase 2 |
| `update_status` aceita qualquer transição via PATCH direto (pular ou retroceder etapa) | 1 | Mapa explícito de transições permitidas, rejeitando o resto com erro claro |
| Status duplicado em `PaymentBreakdownCard.vue` fica desatualizado quando um novo status é adicionado | 1 | Build TS falha se o `Record<SaleOrderStatus,...>` local não cobrir `delivered` (rede de segurança); eliminar a duplicação reaproveitando `saleOrder.ts` remove o risco de vez |

## 8. Definição de pronto

### Etapa 0
- [ ] `SaleOrderSerializer`/`SaleOrderDetailSerializer` expõem endereço,
      notas, mensagem e link do WhatsApp
- [ ] Modal/rota de detalhe do pedido implementado e testado (Vitest +
      Cypress)
- [ ] Paginação real (sem perder pedidos além da página 1)
- [ ] Filtro de canal disponível na UI
- [ ] `can_manage_orders` exposto no perfil e consumido pelo frontend (alias
      de `has_dashboard_write_access`, sem papel novo — decisão 7 fase 1)

### Etapa 1
- [ ] `STATUS_DELIVERED` adicionado, migration testada contra dados
      existentes
- [ ] Transição para `sent` exige transportadora+rastreio quando aplicável
- [ ] Mapa de transições permitidas rejeita status fora de ordem (ex.
      `prepared → delivered` direto, ou retroceder `sent → prepared`)
- [ ] `PaymentBreakdownCard.vue` sem mapa de status duplicado (reaproveita
      `saleOrder.ts`)
- [ ] Notificação WhatsApp com rastreio funcional (link `wa.me` correto)
- [ ] Testes: `test_sale_order_shipping.py` (backend),
      `DashboardOrdersView.spec.ts` atualizado (frontend)

### Etapa 2
- [ ] Campos fiscais de `Store` e `Product` migrados e validados
- [ ] Abas "Fiscal" em Configurações e no formulário de produto
- [ ] Indicador de produto com cadastro fiscal incompleto
- [ ] Nenhuma emissão real ainda ocorre nesta etapa (só cadastro)

### Etapa 3
- [ ] Integração sandbox/homologação com o provedor escolhido validada
      ponta a ponta (nota de teste autorizada de verdade no ambiente de
      homologação)
- [ ] Webhook de autorização/rejeição funcionando e validado por
      assinatura
- [ ] DANFE/XML baixáveis a partir do pedido
- [ ] Erros de rejeição exibidos com o motivo real da SEFAZ

### Etapa 4
- [ ] Cancelamento de NF-e dentro do prazo legal funcional
- [ ] `apply_order_cancellation()` bloqueia cancelamento simples de pedido
      com NF autorizada
- [ ] Log de auditoria de emissões/cancelamentos consultável para suporte

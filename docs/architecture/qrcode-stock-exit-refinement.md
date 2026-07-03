# Refinamento: Regras de Negócio e UX do PDV/QR Code

Este documento audita o que foi entregue em
`docs/architecture/qrcode-stock-exit-evolution.md` (Etapas 1-5, todas
concluídas e em produção) e propõe uma segunda rodada de evolução — não
features novas, mas **fechar lacunas reais de regra de negócio e de
experiência de uso** encontradas ao reler o código com olhar de quem vai
operar um caixa físico de verdade todo dia. Segue o mesmo padrão de
**etapas verticais** dos documentos anteriores.

Toda lacuna listada abaixo foi **verificada no código atual**, não
suposta — cada item cita o arquivo onde o comportamento hoje é assim.

## 1. Achados (por ordem de risco)

### 1.1 Erro do backend é descartado e substituído por uma mensagem genérica

`DashboardPdvView.vue:98-100` — `handleFinalizeSale` captura qualquer erro
e sempre mostra o mesmo toast: *"Não foi possível registrar a venda.
Verifique o estoque e tente novamente."* Mas o backend
(`bipdelivery/api/pdv.py`) já computa uma mensagem específica e útil —
`Quantidade solicitada para "X" excede o estoque disponível (N)` ou
`Código(s) não encontrado(s) nesta loja: ABC123` — que hoje nunca chega ao
operador do caixa. Quem está com uma fila de clientes esperando não tem
como saber *qual* item do carrinho falhou sem abrir o console do
navegador.

### 1.2 Nenhuma verificação de disponibilidade no momento do scan

`composables/usePdvCart.ts:addProduct()` só verifica se o produto tem `id`
e `public_code` — nunca `is_available`/`stock_quantity`. Um caixa pode
escanear 6 itens diferentes e só descobrir que o 3º estava zerado **depois
de escanear todos e clicar em "Finalizar venda"**, porque a validação de
estoque só existe no backend, no momento do fechamento da venda inteira.
Feedback deveria ser imediato, no momento do scan, não no fim do
atendimento.

### 1.3 Input de scan perde foco e pode "vazar" digitação para o campo errado

`DashboardPdvView.vue` só rechama `focusScanInput()` depois de um scan
(sucesso ou erro) e no reset da venda. Se o operador clicar no campo de
quantidade de uma linha do carrinho para corrigir manualmente (bem comum:
"na verdade são 3, não 2"), o foco fica ali. Um leitor USB físico não sabe
disso — ele só "digita" no que estiver focado. O próximo scan iria
inserir o código como texto dentro do campo de quantidade em vez de
adicionar um novo item ao carrinho. Isso é uma falha de usabilidade
plausível todo dia de operação, não um caso extremo.

### 1.4 PDV é a única tela do dashboard que não reage à troca de loja ativa

Toda outra tela (`DashboardOrdersView.vue`, `DashboardOverviewView.vue`,
`DashboardProductsView.vue`, `DashboardStockMovementsView.vue`,
`DashboardSupportView.vue`) usa `useStoreSwitchEffect()` para resetar seu
próprio estado quando o lojista troca a loja ativa (recurso já existente
para quem administra mais de uma loja). `DashboardPdvView.vue` não usa.
Se a loja ativa mudar com itens já no carrinho, o carrinho continua
"vivo" com produtos de uma loja diferente da que está ativa agora — ao
finalizar, `public_code` é resolvido contra a loja *atual*, então essas
linhas antigas provavelmente dão "código não encontrado", sem nenhuma
explicação de que a causa foi a troca de loja, não um erro do operador.

### 1.5 Cancelar uma venda nunca devolve o estoque

`SaleOrderViewSet.update_status` (`views.py:771`) só troca
`order.status`; não existe nenhum caminho, em nenhum canal (WhatsApp ou
PDV), que estorne `stock_quantity` ou registre um `StockMovement` de
devolução quando um pedido é cancelado. Isso já era assim antes desta
evolução (não é um bug introduzido pelo PDV), mas o PDV torna o problema
**muito mais frequente**: erros de caixa (escanear o item errado, bater
"finalizar" duas vezes, cliente desiste na hora) acontecem na hora, todo
dia — diferente de um pedido de WhatsApp, que raramente é cancelado
depois de finalizado. Hoje, corrigir isso exige que o lojista abra
"Movimentar estoque" manualmente e registre uma entrada avulsa,
desconectada do pedido que originou o erro — funcional, mas nada natural
para quem está no balcão.

### 1.6 Nenhuma confirmação/recibo depois de fechar a venda

`handleFinalizeSale` mostra um toast e limpa o carrinho imediatamente.
Não existe uma tela de confirmação com o resumo itemizado da venda (nem
para o caixa conferir, nem para eventualmente imprimir para o cliente).
Um toast que desaparece em alguns segundos é pouco para o único registro
visual de que a venda foi concluída.

### 1.7 Nenhum indicador de estoque baixo no carrinho do PDV

`utils/stockAlerts.ts` (`isLowStock`/`getLowStockThreshold`) já existe e é
usado na tabela de produtos e na vitrine pública — mas o carrinho do PDV
(`DashboardPdvView.vue`) não usa, então o caixa nunca vê um aviso "últimas
unidades" no momento exato em que mais faz sentido: durante a própria
venda que pode zerar o produto.

### 1.8 Input de quantidade não é otimizado para uso em balcão

`type="number"` cru (`DashboardPdvView.vue:165-172`) exige toque preciso
num campo pequeno — ruim em tablet, que é o dispositivo mais realista
para um caixa físico. Não há botões +/- nem confirmação de que uma
quantidade maior que o estoque conhecido do produto (`availableStock`, já
capturado em `usePdvCart.ts` mas nunca usado em lugar nenhum) seria
rejeitada.

### 1.9 Nenhuma visibilidade de quem operou a venda física

`StockMovement.performed_by` e `SaleOrder` não expõem o operador em
nenhuma tela do dashboard (nem em `DashboardOrdersView.vue`, nem no
ledger). Para um canal novo (loja física, com caixa por trás), saber
"quem" processou cada venda é uma pergunta de negócio natural (conferência
de caixa, responsabilização) que hoje não tem resposta na UI, só no banco.

## 2. Plano de refinamento em etapas verticais

### Etapa R1 — Correções de robustez do próprio PDV ✅ (concluída)

Backend: nenhuma mudança — os dados já existiam (`is_available`,
`stock_quantity`, mensagens de erro específicas); foi só consumo pelo
frontend, como previsto.

Frontend:

- `extractPdvSaleErrorMessage()` (`DashboardPdvView.vue`) extrai a mensagem
  real do backend (formato DRF `{"campo": ["mensagem"]}`, mesmo padrão
  observado em `useProducts.ts`) e só cai no texto genérico quando o
  backend não retorna nada estruturado.
- `usePdvCart.addProduct()` agora retorna um resultado tipado
  (`{ok: true} | {ok: false, reason: 'unavailable' | 'exceeds_stock', ...}`)
  em vez de falhar silenciosamente; `updateQuantity()` faz o mesmo e nunca
  deixa a quantidade ultrapassar `availableStock`. `DashboardPdvView.vue`
  usa esse resultado para mostrar uma mensagem específica no momento do
  scan (`"Estoque insuficiente para X: disponível N."`), não só no
  fechamento da venda.
- Foco do input de scan agora é reafirmado depois de **qualquer** interação
  no carrinho (`adjustQuantity`, `handleRemoveLine`), não só depois de um
  scan — `focusScanInput()` virou o chokepoint único para isso.
- `DashboardPdvView.vue` agora usa `useStoreSwitchEffect()`, limpando o
  carrinho e avisando o operador quando a loja ativa muda.

Testes: extensão de `usePdvCart.spec.ts` (7 casos novos: rejeição de
produto indisponível/zerado, rejeição por exceder estoque em scan único e
agregado, limite ao editar quantidade manualmente) e de
`DashboardPdvView.spec.ts` (mensagem de erro específica por cenário, refoco
após editar quantidade/remover item — verificado via `document.activeElement`
com `attachTo: document.body` —, limpeza do carrinho ao trocar de loja).

**Visível para o usuário final:** sim. **Risco:** baixo, confirmado —
foram correções pontuais e isoladas, sem mudança de contrato de API.

### Etapa R3 — Polish de UX específico do balcão físico ✅ (concluída)

Backend: `SaleOrder.performed_by` (novo `ForeignKey` nullable para o
usuário, migration `0027_saleorder_performed_by.py`), preenchido em
`PdvSaleView.post()` a partir de `request.user`; `SaleOrderSerializer`
ganhou `performed_by_username` (mesmo padrão de
`StockMovementSerializer.performed_by_username`, já existente).

Frontend:

- Badge de estoque baixo no carrinho do PDV, reaproveitando
  `isLowStock()`/`utils/stockAlerts.ts` sem nenhuma lógica nova.
- `<input type="number">` substituído por um stepper +/- (`MinusIcon`/
  `PlusIcon`), com o botão de diminuir desabilitado em quantidade 1 e o de
  aumentar desabilitado no limite de `availableStock` — nunca deixa a
  quantidade num estado inválido, ao contrário de um campo numérico livre.
- **Ajuste em relação ao plano original:** em vez de duplicar o carrinho
  num layout de cards para mobile (como `TableRowCard.vue` faz para a
  tabela de produtos), a tabela do carrinho do PDV só ganhou
  `overflow-x-auto` — ela tem 5 colunas (bem mais estreita que a tabela de
  produtos, que tem imagem, categoria etc.), então duplicar o layout aqui
  seria mais código para o mesmo resultado prático. Os alvos de toque do
  stepper (`h-9 w-9`, 36px) já cobrem a parte que de fato importava em
  tablet.
- Badge "Operador: X" no card de cada pedido em `DashboardOrdersView.vue`,
  só para `channel=loja_fisica` com `performed_by_username` presente.

Testes: extensão de `test_pdv_sales.py` (`performed_by` gravado
corretamente), `DashboardPdvView.spec.ts` (steppers desabilitados nos
limites, badge de estoque baixo presente/ausente) e
`DashboardOrdersView.spec.ts` (badge de operador só aparece para PDV com
operador conhecido).

**Visível para o usuário final:** sim. **Risco:** baixo, confirmado.

### Etapa R2 — Fechar o ciclo da venda: confirmação e cancelamento com estorno ✅ (concluída)

Decisão da Seção 3 confirmada pelo usuário: **canal-agnóstico**.

Backend:

- Novo `apply_order_cancellation()` em `bipdelivery/api/stock.py` (não em
  `views.py` — mesma razão de `apply_stock_movement` viver lá: é regra de
  negócio testável isoladamente, não um detalhe de view). Tranca todos os
  produtos do pedido (`select_for_update`, ordenado por `id`, mesmo padrão
  de `PdvSaleView._reserve_stock`), soma de volta a quantidade de cada
  `SaleOrderItem`, cria um `StockMovement` de entrada por item (`reason=
  venda_cancelada`, novo choice system-only; `source` reaproveitado do
  canal original do pedido — `pdv` ou `venda` —, não um valor novo) e só
  então marca o pedido como cancelado, tudo em uma transação. Idempotente:
  se o pedido já está cancelado, retorna `[]` sem tocar em nada.
  Item sem produto (deletado desde a venda, `SET_NULL`) é pulado sem
  quebrar o resto do estorno.
- **Sem endpoint novo** — a decisão foi dobrar essa lógica dentro de
  `SaleOrderViewSet.update_status` (o único lugar que já muda status
  hoje) em vez de criar `POST /cancel/` ao lado dele. A tela de pedidos já
  deixava cancelar via o mesmo `<select>` de status genérico; um endpoint
  novo e separado deixaria esse caminho antigo **sem** o estorno, criando
  uma forma de cancelar "por acidente" sem devolver estoque. Colocar a
  regra dentro do único chokepoint que já existe fecha essa brecha.
- `update_status` agora também chama `invalidate_dashboard_cache()` após
  qualquer troca de status (não só cancelamento) — outra lacuna
  pré-existente: o cache de 90s do resumo/breakdown do dashboard nunca
  era invalidado por uma troca de status, então cancelar um pedido podia
  deixar o card de receita desatualizado por até 90 segundos.
- `StockMovement.REASON_VENDA_CANCELADA` (system-only, ao lado de
  `entrada_inicial`/`venda`) e `SaleOrder.STATUS_CANCELLED`/`STATUS_SENT`
  (constantes nomeadas, antes só `"cancelled"`/`"sent"` literais) —
  migration `0028_order_cancellation_reason.py`.

Frontend:

- `PdvSaleReceiptModal.vue`: recibo itemizado após o fechamento da venda
  (nome, quantidade, preço, total, forma de pagamento), com impressão via
  `window.print()` — mesmo padrão de CSS de impressão não-scoped de
  `ProductLabelModal.vue`. Um snapshot da venda (`lastCompletedSale`) é
  guardado à parte do carrinho, que já limpa imediatamente.
- `ConfirmModal.vue` ganhou `confirmLabel`/`loadingLabel` opcionais
  (default preserva o texto usado hoje por `DashboardProductsView.vue`),
  reaproveitado em `DashboardOrdersView.vue` para confirmar o cancelamento
  com uma mensagem explícita ("... o estoque de N item(ns) será devolvido
  automaticamente"), interceptando a seleção de "Cancelado" no `<select>`
  de status antes de disparar a chamada.

Testes: `bipdelivery/tests/test_sale_order_cancellation.py` (9 testes:
estorno em canal virtual e PDV com o `source` correto, múltiplos itens,
idempotência, produto deletado não quebra, troca de status não-cancelamento
não estorna, isolamento entre lojas, permissões). Frontend: extensão de
`DashboardOrdersView.spec.ts` (modal de confirmação intercepta a seleção,
cancelamento só ocorre após confirmar, nada acontece ao fechar sem
confirmar) e `DashboardPdvView.spec.ts` (recibo mostra os itens corretos,
fechar o recibo refoca o scan).

**Verificado contra o servidor de desenvolvimento real:** venda de PDV real
com telefone, decremento conferido, cancelamento via `PATCH .../status/`
conferido restaurando o estoque exato, `StockMovement` de estorno com
`reason=venda_cancelada`/`source=pdv` correto, segunda tentativa de
cancelar confirmada como no-op (idempotência), e o `breakdown` por canal
refletindo a remoção da receita imediatamente (cache invalidado). Dados de
teste removidos depois.

**Visível para o usuário final:** sim. **Risco:** médio, como esperado —
foi a única etapa que precisou de verificação ao vivo cuidadosa antes de
considerar pronta, no mesmo espírito da Etapa 3 da evolução original.

### Etapa R4 — Confiança operacional no próprio PDV ✅ (concluída)

Backend:

- `PdvSaleRequestSerializer` ganhou `customer_phone` opcional, passado
  adiante para `SaleOrder.customer_phone` (antes sempre `""`) —
  `SaleOrderCustomerInsightsSerializer` já ignorava telefones vazios, então
  nenhuma mudança foi necessária ali: vendas de PDV com telefone passam a
  contar para "cliente novo vs. recorrente" automaticamente.
- `SaleOrderViewSet.get_base_queryset()` já filtrava por `channel` desde a
  Etapa 5 da evolução original, mas nenhum consumidor no frontend usava
  isso ainda — `types/sales.ts`/`sales.service.ts` ganharam o parâmetro.

Frontend:

- Painel "Últimas vendas" na própria tela de PDV, com as 5 vendas de loja
  física mais recentes (`salesService.list({channel: 'loja_fisica',
  pageSize: 5})`), carregado ao montar a tela, ao trocar de loja e depois
  de cada venda finalizada.
- **Ajuste em relação ao plano original:** o plano falava em "vendas de
  hoje" — implementado como "últimas vendas" sem filtro de data, porque
  filtrar por dia exigiria um novo parâmetro de intervalo em
  `SaleOrderViewSet` (mais superfície de backend do que esse painel de
  reasseguramento precisa); mostrar as últimas 5 vendas físicas, ponto,
  já resolve o objetivo real ("confirmar que a venda que acabei de fazer
  registrou").
- Campo opcional "Telefone" no formulário do PDV, ao lado do nome do
  cliente.

Testes: extensão de `test_pdv_sales.py` (telefone opcional persistido) e
`DashboardPdvView.spec.ts` (telefone repassado ao payload, painel carrega
no mount, não aparece sem dados, não busca sem permissão de catálogo,
atualiza depois de uma venda).

**Visível para o usuário final:** sim. **Risco:** baixo, confirmado —
puramente aditivo.

## 3. Decisão tomada antes da Etapa R2

**Pergunta:** cancelamento com estorno de estoque deveria valer só para
PDV, ou para qualquer canal (incluindo WhatsApp)?

**Resposta do usuário:** canal-agnóstico — a opção recomendada neste
documento. Implementado exatamente assim: `apply_order_cancellation()` não
tem nenhum branch de canal na decisão de estornar, só na escolha de qual
`source` gravar no `StockMovement` gerado (para manter a rastreabilidade de
qual canal originou a venda revertida).

## 4. Ordem executada

R1 → R3 → R2 → R4, na ordem sugerida originalmente. Nenhuma reordenação foi
necessária.

## 5. Estado da suíte após R1–R4

367 testes backend (pytest) + 293 testes frontend (vitest) verdes,
`vue-tsc --noEmit`/`eslint`/`ruff` limpos nos arquivos tocados. Duas
migrations novas (`0027_saleorder_performed_by`,
`0028_order_cancellation_reason`), nenhuma pendente
(`makemigrations --check` confirma paridade). Verificado de ponta a ponta
contra o servidor de desenvolvimento real: venda de PDV com telefone →
cancelamento → estorno conferido no ledger → idempotência confirmada →
breakdown por canal refletindo a mudança imediatamente.

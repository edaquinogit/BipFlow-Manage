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

### Etapa R1 — Correções de robustez do próprio PDV (prioridade alta)

Backend: nenhuma mudança — os dados já existem (`is_available`,
`stock_quantity`, mensagens de erro específicas); é só consumo pelo
frontend.

Frontend:

- `handleFinalizeSale` passa a extrair e mostrar a mensagem real do
  backend (`error.response.data.items[0]`, mesmo padrão de
  `_extractErrorMessage` já usado em `useProducts.ts`), com fallback para
  a mensagem genérica só quando o backend não retornar nada estruturado.
- `usePdvCart.addProduct()` rejeita adicionar um produto com
  `is_available === false` ou `stock_quantity === 0`, e `updateQuantity()`
  passa a não deixar a quantidade de uma linha ultrapassar
  `availableStock` (já capturado, nunca usado) — com uma mensagem inline
  clara ("Estoque disponível: N") em vez de deixar o erro só aparecer no
  fechamento da venda.
- Correção de foco: sempre que qualquer interação no carrinho terminar
  (mudar quantidade, remover item), refocar o input de scan — mesmo
  princípio de `focusScanInput()` já usado após um scan, generalizado
  para todo ponto de interação da tela.
- `DashboardPdvView.vue` passa a usar `useStoreSwitchEffect()` (mesmo
  padrão das outras 5 telas do dashboard) para limpar o carrinho ao trocar
  de loja ativa, com um toast explicando o motivo.

Testes: extensão de `usePdvCart.spec.ts` (rejeição de produto indisponível,
limite de quantidade pelo estoque conhecido), extensão de
`DashboardPdvView.spec.ts` (mensagem de erro específica exibida, refoco
após editar quantidade/remover item, limpeza ao trocar de loja).

**Risco:** baixo — são correções pontuais e isoladas, sem mudança de
contrato de API.

### Etapa R2 — Fechar o ciclo da venda: confirmação e cancelamento com estorno

Esta etapa tem uma decisão de produto que precisa ser tomada antes de
implementar (ver Seção 3): estender o estorno de estoque só para vendas de
PDV canceladas, ou para qualquer canal.

Backend:

- Novo endpoint (ex. `POST /v1/sales-orders/{id}/cancel/`, ou estender
  `update_status` quando o novo status for `cancelled`) que, além de
  trocar o status, **reverte o estoque de cada item do pedido**: um
  `StockMovement` de entrada por item (`reason` novo, ex.
  `venda_cancelada`, `source` preservando o canal original), atômico,
  reaproveitando o mesmo padrão de lock já usado em `apply_stock_movement`/
  `PdvSaleView._reserve_stock`. Idempotente: cancelar um pedido já
  cancelado não deve estornar duas vezes.
- Guarda-corpo: só permite cancelar pedidos que ainda não foram
  cancelados; pedidos muito antigos (ex. de outro dia) podem exigir
  confirmação extra na UI, não necessariamente um bloqueio no backend.

Frontend:

- Tela/modal de confirmação pós-venda no PDV: resumo itemizado, código do
  pedido, total, forma de pagamento — com opção de imprimir (mesmo padrão
  de `window.print()` + CSS de impressão já usado em
  `ProductLabelModal.vue`).
- Ação "Cancelar venda" em `DashboardOrdersView.vue` (hoje só existe
  trocar status via `SALE_STATUS_OPTIONS`) que chama o novo endpoint,
  com confirmação explícita (reaproveitar `ConfirmModal.vue`) explicando
  que o estoque será devolvido.

Testes: backend (estorno correto, idempotência, atomicidade, isolamento
por loja), frontend (tela de confirmação, ação de cancelar, refresh do
estoque na tabela de produtos após cancelar).

**Risco:** médio — é a primeira vez que o sistema estorna estoque
automaticamente; exige verificação cuidadosa contra o servidor de
desenvolvimento real (cancelar uma venda de verdade e conferir o
`StockMovement` gerado) antes de considerar pronta, no mesmo espírito da
Etapa 3 da evolução original.

### Etapa R3 — Polish de UX específico do balcão físico

Frontend apenas:

- Badge de estoque baixo (reaproveitando `isLowStock`/`getLowStockThreshold`
  de `utils/stockAlerts.ts`) em cada linha do carrinho do PDV.
- Substituir o `<input type="number">` cru por um stepper +/- com alvo de
  toque maior (consistente com o já feito para a tabela de produtos mobile
  no commit `08c90c7`, "WCAG touch targets").
- Revisão responsiva da tela de PDV para tablet em retrato (o dispositivo
  mais realista num balcão): carrinho em cards empilhados abaixo de um
  certo breakpoint, em vez da tabela larga atual.
- Exibir o operador (`performed_by`) no card de cada venda de loja física
  em `DashboardOrdersView.vue` (omitir para vendas virtuais, onde não faz
  sentido).

Testes: extensão de `DashboardPdvView.spec.ts` (badge de estoque baixo,
stepper), extensão de `DashboardOrdersView.spec.ts` (operador exibido só
para `channel=loja_fisica`).

**Risco:** baixo — puramente aditivo e visual.

### Etapa R4 (opcional) — Confiança operacional no próprio PDV

- Painel compacto "últimas vendas de hoje" na própria tela de PDV (últimas
  3-5 vendas de loja física do dia, com código do pedido e total), para o
  caixa confirmar que uma venda foi mesmo registrada sem sair da tela.
- Campo opcional de telefone do cliente no PDV (hoje só nome), para que
  vendas físicas também alimentem o cálculo de "cliente novo vs.
  recorrente" (`SaleOrderCustomerInsightsSerializer`), que hoje as ignora
  silenciosamente (telefone sempre vazio nas vendas de PDV).

**Risco:** baixo — aditivo, não bloqueia as etapas anteriores.

## 3. Decisão que precisa de definição antes da Etapa R2

**Cancelamento com estorno de estoque deve valer só para PDV, ou para
qualquer canal (incluindo WhatsApp)?**

- A favor de limitar ao PDV: é onde o problema é agudo (erro acontece na
  hora, todo dia); pedidos de WhatsApp cancelados hoje já convivem sem
  estorno automático há muito tempo, e mudar esse comportamento é uma
  decisão de produto maior, com implicações em conciliação que fogem do
  escopo desta evolução.
- A favor de valer para os dois: consistência — um pedido cancelado
  deveria sempre devolver o estoque, independente de como nasceu, e não
  existe uma razão de negócio real para os dois canais se comportarem
  diferente nesse ponto.

Recomendação: implementar de forma **canal-agnóstica** (o endpoint de
cancelamento não precisa saber se é PDV ou virtual — só itera os itens do
pedido), já que o custo de fazer diferente por canal seria maior do que o
de simplesmente sempre estornar. Mas essa é uma escolha de regra de
negócio do lojista, não só técnica, e deveria ser confirmada antes de
implementar a Etapa R2.

## 4. Ordem sugerida

R1 (robustez, baixo risco) → R3 (polish visual, baixo risco, pode ser
paralelo a R1) → decisão da Seção 3 → R2 (cancelamento com estorno, risco
médio) → R4 (opcional, quando as anteriores estiverem estáveis em
produção).

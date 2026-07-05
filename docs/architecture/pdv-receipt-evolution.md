# Recibo do PDV: dados da loja, formato de impressão, PDF e e-mail

Este documento cobre duas rodadas de evolução do recibo do PDV
(`PdvSaleReceiptModal.vue`), entregues em sequência na mesma sessão. Segue o
padrão de **etapas verticais** dos documentos anteriores deste módulo
(`docs/architecture/qrcode-stock-exit-evolution.md`,
`docs/architecture/qrcode-stock-exit-refinement.md`,
`docs/architecture/pdv-camera-scanner-refinement.md`).

## Rodada 1 — Dados da loja, política de troca e formato de impressão ✅

**Pedido original:** o recibo deveria mostrar, em nível de loja, uma
política de troca (ex.: "aceita troca a partir de 7 dias") e informações
básicas, além de permitir configurar o formato/dimensão de impressão.

**Achados:** `Store` não tinha nenhum campo de endereço/política; a única
forma de escrever em `Store` era `StoreRenameSerializer` +
`MyStoreDetailView.patch`, scoped por slug+membership. Não existia nenhum
conceito de formato de papel em lugar nenhum do projeto.

**Entregue:**

- `Store.receipt_exchange_policy` (`CharField`, blank=True, default
  "Trocas e devoluções em até 7 dias mediante apresentação deste
  comprovante.") e `Store.receipt_paper_format` (choices `58mm`/`80mm`/`a4`,
  default `80mm`) -- migration `0030_store_receipt_exchange_policy_and_more`.
- `StoreSerializer` passa a expor os dois campos (somado ao allowlist
  público testado em `test_store_isolation_security.py` -- não são dados
  sensíveis, mesmo nível de `tagline`/`whatsapp_phone`).
- Novo `StoreReceiptSettingsSerializer` + `StoreReceiptSettingsView`,
  `PATCH /v1/store/mine/<slug>/receipt-settings/`, endpoint dedicado (não
  sobrecarrega `MyStoreDetailView`, que é especificamente sobre renomear e
  já tinha seus próprios testes).
- Nova aba **"Recibo"** em `DashboardSettingsView.vue`
  (`ReceiptSettingsTab.vue`), seguindo o padrão de `StoresTab.vue` (edita
  `Store` direto via slug, não o padrão do singleton `StoreSettings`).
- `PdvSaleReceiptModal.vue`: corrigido bug latente onde `order_reference`
  renderizava **fora** de `.receipt-printable` (não imprimia); adicionado
  nome da loja, data/hora da venda, política de troca (só quando não
  vazia) e uma classe de formato (`format-58mm`/`format-80mm`/`format-a4`)
  que define a largura física no `@media print`.

**Verificado:** 401 testes backend + suíte frontend completa, e uma
passada real em navegador (Cypress) configurando a política/formato na
aba nova e conferindo que aparecem no recibo de uma venda finalizada.

## Rodada 2 — PDF, envio por e-mail e recibo de vendas anteriores ✅

**Pedido:** que "imprimir" produza um PDF de verdade, que esse PDF possa
ser enviado por e-mail ao cliente, e que a lista "Últimas vendas" do PDV
permita ver o recibo de uma venda já registrada.

**Achados:** e-mail já tinha infraestrutura (`EMAIL_BACKEND`/SMTP em
`settings.py`, usado só por `PasswordResetRequestView` com `send_mail()`
síncrono, sem fila assíncrona no projeto). Nenhuma biblioteca de PDF
existia em nenhum dos dois lados. `SaleOrder.customer_email` já existia no
model (usado pelo checkout/WhatsApp) mas o PDV nunca escrevia nele.
`SaleOrderSerializer` (usado tanto para list quanto retrieve) já trazia
`items` completo e `customer_email` -- a lista "Últimas vendas" do PDV já
buscava tudo que o recibo precisa, sem chamada nova.

### Etapa E1 — Capturar e-mail do cliente no PDV

`PdvSaleRequestSerializer` ganhou `customer_email` opcional (mesmo padrão
de `CheckoutCustomerInputSerializer.email`); `PdvSaleResponseSerializer`
passou a devolver esse valor. Campo "E-mail (opcional)" novo em
`DashboardPdvView.vue`, ao lado de Nome/Telefone. Sem migration (campo já
existia no model).

### Etapa E2 — "Baixar PDF" do recibo (client-side)

**Decisão de design:** PDF gerado no cliente (`jspdf`, ~150KB, sem
dependência nativa) em vez de no servidor -- adicionar uma lib Python (ex.
WeasyPrint) puxaria Cairo/Pango sem necessidade real, já que o conteúdo do
recibo já vive no Vue.

- Novo tipo `ReceiptData` (`types/receipt.ts`): o subconjunto comum que
  tanto `PdvSaleResponse` quanto `SaleOrder` já satisfazem
  **estruturalmente**, sem adapter -- `PdvSaleReceiptModal.vue`'s prop
  `sale` deixou de ser `PdvSaleResponse` e passou a ser `ReceiptData`.
- `utils/receiptPdf.ts`: `buildReceiptPdf(sale, store)` monta o PDF na
  largura física do `receipt_paper_format` da loja. Usa duas passadas
  (medição num documento-rascunho + construção do documento real) para
  calcular a altura exata do conteúdo -- item count e quebras de linha
  variam, então um tamanho fixo arriscaria cortar conteúdo.
  **Bug real encontrado e corrigido durante o desenvolvimento:** o jsPDF
  sempre força a orientação (`portrait` = altura >= largura), trocando as
  dimensões se necessário -- um recibo de teste com poucos itens (altura
  calculada menor que a largura) saía com as dimensões invertidas. Corrigido
  garantindo `altura = max(altura_calculada, largura + 10)` antes de criar
  o documento final.
- Botão "Baixar PDF" no modal, ao lado de "Imprimir".

### Etapa E3 — Enviar recibo por e-mail

- Novo `PdvReceiptEmailSerializer` (valida e-mail + PDF em base64: decodifica,
  checa tamanho máximo de 5MB, valida assinatura `%PDF`) e
  `PdvReceiptEmailView`, `POST /v1/pdv/sales/<order_reference>/receipt-email/`
  em `bipdelivery/api/pdv.py` -- *scoped* a um `SaleOrder` real da loja do
  requisitante (não um relay genérico de e-mail), envio síncrono via
  `EmailMessage.attach()` (mesmo padrão do `PasswordResetRequestView`, já
  que não existe fila assíncrona no projeto).
- Novo throttle `PdvReceiptEmailThrottle` (`10/hour` por usuário) para
  limitar abuso do endpoint como relay de e-mail.
- `PdvSaleService.sendReceiptEmail()` + botão "Enviar por e-mail" no modal,
  com um formulário inline (e-mail pré-preenchido com
  `sale.customer_email` quando disponível).

### Etapa E4 — Ver recibo de vendas anteriores

- Sem adapter: como `SaleOrder` já satisfaz `ReceiptData` estruturalmente
  (mesmo motivo da Etapa E2), o botão "Ver recibo" (ícone de olho) em cada
  linha de "Últimas vendas" só precisa reatribuir
  `lastCompletedSale.value = order` e abrir o mesmo modal já usado para uma
  venda recém-finalizada -- nenhuma chamada de API nova.

**Verificado:** 24 testes backend novos em `test_pdv_sales.py` (incluindo
verificação real do `mail.outbox` do Django -- anexo, nome do arquivo,
mimetype, conteúdo `%PDF`), suíte completa (394 testes backend, 416
frontend), e uma passada real em navegador via Cypress: venda finalizada
com e-mail preenchido → "Baixar PDF" produziu um arquivo `.pdf` real (
`%PDF-1.3`, conferido byte a byte) → "Enviar por e-mail" retornou sucesso →
recibo de uma venda anterior reaberto a partir de "Últimas vendas" com os
dados corretos.

## Estado final

Backend: 394 testes (pytest) verdes, `makemigrations --check` limpo
(nenhuma migration pendente). Frontend: 416 testes (vitest) verdes,
`vue-tsc --noEmit` e `eslint` limpos. Verificação manual completa em
navegador real para as duas rodadas.

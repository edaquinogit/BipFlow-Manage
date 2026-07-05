# PDV: leitura do QR pela câmera do celular + refinamento profissional da tela

Este documento fecha o fast-follow deixado em aberto pela entrega original
do PDV (`docs/architecture/qrcode-stock-exit-evolution.md`, Etapa 3):
"camera support is a documented fast-follow, not a gap that blocks the PDV's
main real-world workflow". Segue o mesmo padrão de **etapas verticais** dos
documentos anteriores (evolução original + refinamento R1-R4).

## Contexto e achados

O QR impresso na etiqueta do produto (`bipdelivery/api/product_labels.py`,
usado por `ProductLabelModal.vue`) **não codifica o `public_code` puro** --
codifica a URL pública completa do produto
(`{FRONTEND_BASE_URL}/l/{store.slug}/p/{public_code}`), para que a câmera
genérica de um cliente caia direto na vitrine (Etapa 4 da evolução
original). Isso significa que uma leitura por câmera desta mesma etiqueta
produz uma URL, não um código -- o lookup por `public_code` só funciona se
esse detalhe for tratado no cliente antes de chamar
`GET /v1/products/by-code/{code}/`.

Segundo achado: `getUserMedia` (câmera do navegador) só funciona em
contexto seguro (HTTPS, ou `localhost`/`127.0.0.1`). O `vite.config.ts`
deste projeto já expõe o dev server por IP de LAN em HTTP puro
especificamente para abrir o dashboard num celular na mesma rede -- isso
funciona para todo o resto do app, mas a câmera é bloqueada nesse cenário
(IP de LAN não é origem segura). Testar em celular real via dev/LAN exige
uma URL HTTPS (produção publicada, ou um túnel temporário tipo
`cloudflared`/`ngrok`).

## Etapa C1 -- Extração do código a partir do texto decodificado ✅ (concluída)

`bipflow-frontend/src/utils/pdvScan.ts`:
`extractPublicCodeFromScan(raw: string): string` casa o padrão
`/\/p\/([^/?#]+)(?:[/?#].*)?$/i` (mesmo formato de
`build_product_deep_link_url`); quando não casa (código puro, digitado ou de
um leitor HID), retorna a string original `trim()`ada -- comportamento
preservado. Reaproveitada tanto pelo caminho de câmera quanto pelo texto
manual/HID, via `resolveScannedCode()` (chokepoint único em
`DashboardPdvView.vue`).

Testes: `pdvScan.spec.ts` (URL completa, com barra final, com
query/fragment, código puro, string vazia, lixo).

**Risco:** baixo, confirmado -- função pura, sem efeitos colaterais.

## Etapa C2 -- Scanner via câmera do celular ✅ (concluída)

**Biblioteca:** `qr-scanner` (não `html5-qrcode`, cogitada e descartada na
entrega original) -- pegada leve, worker próprio, sem UI embutida (mantém a
tela 100% com a identidade visual `bip-*`).

Backend: nenhuma mudança -- reaproveita `GET /v1/products/by-code/{code}/`,
já usado pelo caminho manual/HID.

Frontend:

- `composables/usePdvCameraScanner.ts`: encapsula o ciclo de vida da câmera
  (`start()`/`stop()`), recebe um `Ref<HTMLVideoElement | null>` já criado
  pelo componente (mesmo padrão de `containerRef`/`closeButtonRef` já usado
  em todos os outros modais deste projeto, ao invés de o composable criar e
  devolver seu próprio ref -- evita um `noUnusedLocals` falso-positivo e
  mantém a convenção). Erros tipados: `insecure-context | not-supported |
  permission-denied | no-camera | unknown`, cada um com mensagem específica
  e acionável. Cooldown de 1.2s entre leituras aceitas (mirar a câmera
  parada sobre uma etiqueta não deve disparar a mesma leitura várias vezes
  por segundo).
- `components/dashboard/product-table/PdvCameraScannerModal.vue`: overlay
  full-bleed com `<video>`, retícula de mira em CSS puro, botão "trocar
  câmera" (só visível com mais de uma câmera disponível),
  `navigator.vibrate(80)` a cada leitura aceita (confirma que algo foi lido,
  independente do resultado do lookup). Não conhece produtos/carrinho --
  emite `decode(rawText)` para o pai e recebe de volta um `feedback` prop
  (`{ type: 'success' | 'error'; message }`) para exibir inline, já que o
  modal cobre a tela e o `scanError` da página ficaria escondido atrás dele.
- `DashboardPdvView.vue`: botão "Escanear com a câmera" ao lado do input de
  texto; `resolveScannedCode()` é o chokepoint único que tanto
  `handleScanSubmit` (Enter no input) quanto `handleCameraDecode` (evento
  `decode` do modal) chamam -- mesma extração de código, mesmo lookup, mesma
  regra de estoque/disponibilidade, sem duplicação. O modal permanece aberto
  entre leituras (um caixa lança vários itens sem reabrir a câmera a cada
  produto); fechar sempre reforça o foco do input de scan
  (`focusScanInput()`, mesmo chokepoint da Etapa R1 do refinamento
  anterior).

Testes: `usePdvCameraScanner.spec.ts` (contexto inseguro, sem suporte, sem
câmera, erro de permissão/câmera não encontrada mapeados a partir de
`DOMException`, cooldown entre decodes, `stop()`/`switchCamera()`),
`PdvCameraScannerModal.spec.ts` (inicia a câmera ao abrir, mostra erro do
composable, mostra feedback do pai, emite `decode` e vibra, `stop()` +
`close` ao fechar, botão de trocar câmera condicional),
`DashboardPdvView.spec.ts` (extração de código de uma URL decodificada,
mensagem de "não encontrado" como feedback da câmera, fechar reforça o
foco).

**Verificação manual (obrigatória, não simulável em jsdom):** ainda
pendente -- exige um celular real contra uma URL HTTPS (produção ou túnel).
Ver seção "Verificação" abaixo.

**Risco:** médio -- única etapa que depende de hardware/permissão real do
navegador.

## Etapa C3 -- Refinamento profissional da tela do PDV ✅ (concluída)

Achados da tela antes desta etapa: tudo empilhado em uma coluna só mesmo em
telas largas; carrinho sem imagem do produto (nada ajuda a confirmar
visualmente o item escaneado); total pequeno no fim da tabela; sem atalho de
teclado para finalizar/limpar; vibração só na câmera (HID/digitação
silenciosos); erro do scan sem `aria-live`.

Mudanças:

- Layout em grid `lg:grid-cols-[1fr_22rem]`: coluna principal (scan +
  carrinho) e coluna lateral `lg:sticky` (total + pagamento/cliente +
  últimas vendas). Mobile continua empilhado.
- `PdvCartLine` (`usePdvCart.ts`) ganhou `imageUrl: string | null`
  (`product.image_url ?? null`); linha do carrinho mostra a miniatura ou um
  ícone de fallback.
- Card de total redesenhado (`data-cy="pdv-total-card"`): tipografia grande,
  contagem de itens (`cart.itemCount`, já existia e não era usado em
  lugar nenhum), botão "Finalizar venda" na mesma área visual.
- Atalhos: `Ctrl/Cmd+Enter` finaliza a venda (carrinho não vazio, não
  duplica se já estiver enviando); `Esc` limpa o campo de scan quando ele
  está focado e a câmera não está aberta (não interfere com o
  Escape-fecha-modal já existente via `useDialogA11y`).
- `utils/sound.ts`: `playScanSuccessBeep()` via Web Audio API (sem asset de
  áudio), chamado a partir de `resolveScannedCode()` -- unifica o feedback
  sonoro entre HID, digitação manual e câmera.
- `aria-live="polite"`/`role="alert"` no erro do scan; `role="status"` no
  total.

Testes: extensão de `usePdvCart.spec.ts` (implícito via `imageUrl` no
`toMatchObject`), `sound.spec.ts` (Web Audio API ausente/disponível/lança
erro), `DashboardPdvView.spec.ts` (card de total, imagem no carrinho com e
sem `image_url`, atalhos Ctrl+Enter e Esc, Esc não interfere com a câmera
aberta).

**Gotcha de teste encontrado nesta etapa:** o novo listener global de
`keydown` (`window.addEventListener`) expôs uma lacuna de higiene já
existente neste arquivo de teste -- a maioria dos ~30 testes anteriores
nunca chamava `wrapper.unmount()`. Sem problema enquanto o componente não
tinha nenhum efeito colateral fora da própria subárvore do DOM, mas passou a
vazar um listener real por teste não desmontado assim que o atalho de
teclado foi adicionado: um teste novo via `PdvSaleService.create` ser
chamado 12 vezes em vez de 1, porque todas as instâncias anteriores ainda
montadas reagiam ao mesmo evento `keydown` disparado em `window`. Corrigido
rastreando todo `mount()` num array e desmontando todos em `afterEach()`,
em vez de reescrever cada teste antigo individualmente.

**Risco:** baixo a médio (mudança de layout tem mais risco de regressão
visual do que lógica pura) -- suíte de testes verde, mas a passada visual
manual (mobile + desktop) ainda está pendente (ver "Verificação").

## Estado da suíte

`vue-tsc --noEmit`, `eslint` e a suíte completa (`vitest run`) limpos após
as três etapas -- ver seção "Verificação" para os números exatos e o que
ainda falta (verificação manual em dispositivo real).

## Verificação

- Automatizado: `npm run typecheck`, `npm run lint`, `npm run test:unit:run`
  -- todos limpos nos arquivos tocados por esta evolução.
- Manual (pendente, obrigatória antes de considerar a Etapa C2 realmente
  pronta para uso real): abrir o PDV publicado em HTTPS real (produção, ou
  túnel HTTPS temporário se testado antes do deploy) num celular Android e,
  se disponível, iPhone (Safari iOS é historicamente mais restritivo com
  câmera/WebRTC); escanear a etiqueta impressa de um produto de teste
  (gerada via `ProductLabelModal.vue`) e confirmar que o item entra no
  carrinho com nome/preço corretos, exatamente como o input manual já faz.

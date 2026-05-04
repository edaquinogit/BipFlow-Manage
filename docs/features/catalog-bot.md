# Bot Do Catalogo

Este documento descreve o bot integrado ao catalogo publico do BipFlow. O foco
e deixar claro o comportamento entregue, os limites da solucao e os pontos de
manutencao para proximas evolucoes.

## Objetivo

O bot ajuda o cliente a navegar pelo catalogo sem tirar a autoridade do
backend. Ele responde perguntas simples sobre produtos, entrega e checkout,
usando dados reais de produtos disponiveis e regioes ativas.

Esta primeira versao e propositalmente deterministica:

- nao usa IA externa;
- nao conversa com provedor oficial de WhatsApp;
- nao persiste historico de conversa;
- nao calcula preco, frete ou estoque no frontend;
- nao substitui o carrinho nem o checkout validado pelo backend.

## Fluxo Integrado

```text
Cliente no catalogo publico
  |
  v
CatalogBotWidget.vue
  |
  v
bot.service.ts
  |
  v
POST /api/v1/bot/messages/
  |
  v
build_bot_reply()
  |
  v
Produtos disponiveis + regioes ativas
```

O frontend renderiza a conversa, atalhos, produtos sugeridos e regioes de
entrega. O backend classifica a mensagem e retorna uma resposta estruturada para
a interface.

## Responsabilidades

Frontend:

- `bipflow-frontend/src/views/products/CatalogBotWidget.vue`: controla abertura
  do painel, estado local da conversa, envio da mensagem e renderizacao de
  produtos, regioes e atalhos.
- `bipflow-frontend/src/services/bot.service.ts`: centraliza a chamada HTTP do
  bot e envia mensagens com `channel` padrao `web`.
- `bipflow-frontend/src/types/bot.ts`: define o contrato TypeScript consumido
  pela UI.
- `bipflow-frontend/src/views/products/ProductsView.vue`: integra o widget ao
  catalogo e navega para o produto sugerido quando existe `slug`.

Backend:

- `bipdelivery/api/bot_engine.py`: concentra as regras deterministicas de
  classificacao e montagem da resposta.
- `bipdelivery/api/serializers.py`: valida entrada e saida do contrato publico.
- `bipdelivery/api/views.py`: expoe o endpoint publico com throttle por IP.
- `bipdelivery/api/v1_urls.py`: registra `POST /api/v1/bot/messages/`.
- `bipdelivery/api/throttling.py`: limita volume de mensagens anonimas.

Testes:

- `bipdelivery/tests/test_bot_mvp.py`: cobre mensagem vazia, saudacao,
  catalogo, busca de produto e entrega.
- `bipflow-frontend/src/services/__tests__/bot.service.spec.ts`: garante que o
  service trimma a mensagem e usa o contrato esperado.

## Contrato Da API

Endpoint:

```http
POST /api/v1/bot/messages/
```

Payload:

```json
{
  "message": "Quero ver o catalogo",
  "channel": "web"
}
```

Resposta:

- `intent`: `greeting`, `catalog`, `product_search`, `delivery`, `checkout`,
  `human_support` ou `fallback`.
- `reply`: texto curto para exibir ao cliente.
- `options`: atalhos guiados que o frontend pode renderizar como botoes.
- `products`: sugestoes compactas de produtos disponiveis.
- `delivery_regions`: regioes de entrega ativas.

## Regras De Negocio

- Mensagens vazias sao rejeitadas pelo serializer.
- Saudacoes retornam opcoes guiadas para produtos, entrega e pedido.
- Catalogo lista apenas produtos com `is_available=True` e estoque maior que
  zero.
- Busca usa nome, SKU e descricao do produto.
- Entrega lista apenas regioes ativas.
- Checkout orienta o cliente a finalizar pelo carrinho.
- Preco, estoque, frete e total continuam validados no backend pelo fluxo de
  checkout.

## Padroes De Manutencao

- Mantenha a classificacao no backend; o frontend nao deve duplicar regra de
  negocio.
- Ao criar uma nova intencao, atualize `bot_engine.py`, serializers, types do
  frontend, testes backend, teste do service e a referencia da API.
- Use respostas curtas e estruturadas. Evite mensagens longas que misturem
  varias responsabilidades.
- Prefira regras pequenas, nomeadas e testaveis antes de adicionar provider
  externo ou IA.
- Prefira composicao e funcoes explicitas para novas regras. Nao crie
  hierarquias de heranca para intents enquanto o fluxo ainda for simples e
  deterministico.
- Se o bot passar a persistir conversas, modele uma entidade propria em vez de
  reaproveitar `SaleOrder`.
- Se houver integracao com WhatsApp real, trate como adaptador separado do
  motor de regras.

## Criterios De Aceite

Antes de considerar uma mudanca no bot pronta:

- `python -m pytest bipdelivery/tests/test_bot_mvp.py`
- `npm run frontend:test:unit`
- contrato atualizado em `docs/api/reference.md`
- comportamento documentado neste arquivo quando mudar regra, payload ou
  resposta

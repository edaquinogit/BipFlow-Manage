# Bot Do Catalogo

Este documento descreve o chatbot publico do catalogo e a vitrine de
atendimento do dashboard. Ele deve ser lido como referencia de produto,
arquitetura e manutencao para qualquer alteracao no fluxo de atendimento.

## Proposito

O bot reduz atrito na jornada publica de compra. Ele ajuda o cliente a encontrar
produtos, consultar entrega e entender como finalizar o pedido, sem tirar do
backend a responsabilidade por preco, estoque, frete e total.

O atendimento fica dividido em duas superficies:

- `CatalogBotWidget.vue`: experiencia do cliente no catalogo publico.
- `BotConversationPanel.vue`: vitrine administrativa, aberta sob demanda no
  dashboard para leitura de conversas, status e handoff humano.

## Escopo Atual

O bot e propositalmente deterministico nesta fase:

- nao usa IA externa;
- nao integra diretamente com provedor oficial de WhatsApp;
- nao calcula preco, frete, estoque ou total no frontend;
- nao substitui carrinho, checkout ou validacao do backend;
- persiste conversas e mensagens para auditoria operacional no dashboard.

Essa decisao mantem o fluxo previsivel, testavel e adequado para um MVP com
baixo acoplamento.

## Fluxo De Atendimento

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
BotConversation + BotMessage
  |
  v
Produtos disponiveis + regioes ativas
  |
  v
Dashboard: BotConversationPanel.vue
```

O frontend envia a mensagem e o contexto da conversa. O backend classifica a
intencao, consulta dados reais quando necessario, persiste a mensagem do cliente
e a resposta do bot, e devolve um payload estruturado para renderizacao.

## Responsabilidades

Frontend publico:

- `bipflow-frontend/src/views/products/CatalogBotWidget.vue`
  - controla abertura, estado local e envio de mensagens;
  - renderiza atalhos, produtos sugeridos e regioes de entrega;
  - reaproveita `session_id` via `sessionStorage` para continuidade no mesmo
    navegador;
  - emite `openProduct` quando uma sugestao possui `slug`.

Frontend dashboard:

- `bipflow-frontend/src/components/dashboard/bot/BotConversationPanel.vue`
  - abre a vitrine do chatbot sob demanda;
  - carrega conversas de forma lazy para nao poluir nem bloquear o dashboard;
  - permite buscar por sessao, telefone ou conteudo;
  - permite filtrar por status operacional;
  - mostra cards de volume, handoff humano e mensagens da pagina;
  - exibe detalhe read-only da conversa selecionada.

Camada de servico e tipos:

- `bipflow-frontend/src/services/bot.service.ts`
  - centraliza as chamadas HTTP;
  - trimma mensagens antes de enviar;
  - normaliza filtros da vitrine administrativa.
- `bipflow-frontend/src/types/bot.ts`
  - define os contratos TypeScript consumidos pelo catalogo e dashboard.

Backend:

- `bipdelivery/api/bot_engine.py`
  - concentra classificacao de intent e montagem da resposta;
  - consulta produtos disponiveis e regioes ativas por regras explicitas.
- `bipdelivery/api/models.py`
  - modela `BotConversation` e `BotMessage`;
  - mantem estado, canal, telefone, ultima intent e historico.
- `bipdelivery/api/serializers.py`
  - valida entrada publica e saida estruturada;
  - protege o contrato contra payloads ambiguos.
- `bipdelivery/api/views.py`
  - expoe o endpoint publico do bot com throttle;
  - expoe historico read-only para papeis de dashboard.
- `bipdelivery/api/v1_urls.py`
  - registra `POST /api/v1/bot/messages/`;
  - registra `GET /api/v1/bot-conversations/`.
- `bipdelivery/api/throttling.py`
  - limita mensagens publicas por IP.

## Contrato Publico

Endpoint:

```http
POST /api/v1/bot/messages/
```

Payload:

```json
{
  "message": "Quero ver o catalogo",
  "channel": "web",
  "session_id": "opcional-para-continuar-conversa",
  "conversation_id": 1,
  "customer_phone": "5571999999999"
}
```

Campos opcionais:

- `channel`: `web` ou `whatsapp`, com padrao `web`;
- `session_id`: identificador publico opaco para continuidade;
- `conversation_id`: identificador interno quando o cliente ja possui conversa;
- `customer_phone`: telefone do cliente quando disponivel.

Resposta:

- `conversation_id`: ID interno da conversa;
- `session_id`: ID publico opaco;
- `conversation_status`: estado operacional;
- `intent`: intent classificada;
- `reply`: texto curto para interface;
- `options`: atalhos guiados;
- `products`: sugestoes compactas de produtos disponiveis;
- `delivery_regions`: regioes ativas de entrega.

Intents aceitas:

- `greeting`
- `catalog`
- `product_search`
- `delivery`
- `checkout`
- `human_support`
- `fallback`

## Contrato Do Dashboard

Endpoints:

```http
GET /api/v1/bot-conversations/
GET /api/v1/bot-conversations/{id}/
```

Caracteristicas:

- read-only;
- exige papel de dashboard;
- suporta filtro por `status`, `channel`, `intent` e `search`;
- listagem retorna resumo operacional;
- detalhe retorna mensagens persistidas.

A vitrine do dashboard deve continuar leve: ela abre por acao do usuario, busca
dados sob demanda e evita competir visualmente com o fluxo principal de
produtos.

## Regras De Negocio

- Mensagens vazias sao rejeitadas pelo serializer.
- Saudacoes retornam atalhos para produtos, entrega e pedido.
- Catalogo lista apenas produtos com `is_available=True` e estoque maior que
  zero.
- Busca considera nome, SKU e descricao do produto.
- Entrega lista apenas regioes ativas.
- Checkout orienta o cliente a finalizar pelo carrinho.
- Pedido de atendimento humano altera a conversa para `waiting_human`.
- Cada mensagem aceita persiste uma entrada `user` e uma entrada `bot`.
- Preco, estoque, frete e total permanecem sob validacao do checkout no
  backend.

## Padroes De Clean Code

- Mantenha classificacao e regras de negocio no backend.
- Nao duplique logica de preco, estoque, frete ou disponibilidade no frontend.
- Prefira funcoes pequenas, nomeadas e testaveis para novas intents.
- Evite heranca para intents enquanto o fluxo for deterministico.
- Retorne payloads estruturados em vez de strings com dados misturados.
- Mantenha textos do bot curtos e acionaveis.
- Trate integracao futura com WhatsApp ou IA como adaptador separado.
- Nao reaproveite `SaleOrder` para conversa; conversa pertence a
  `BotConversation` e mensagens pertencem a `BotMessage`.
- Ao alterar contrato, atualize backend, frontend, testes e documentacao no
  mesmo ciclo.

## Evolucao Segura

Antes de adicionar uma nova intent:

1. Defina a regra de negocio em linguagem simples.
2. Implemente a classificacao em `bot_engine.py`.
3. Atualize serializers e tipos TypeScript.
4. Atualize `bot.service.ts` se houver novo filtro ou payload.
5. Cubra backend e frontend com testes.
6. Atualize este documento e `docs/api/reference.md`.

Antes de integrar IA externa:

- isole o provider atras de uma interface/adaptador;
- mantenha fallback deterministico;
- registre limites de contexto, timeout e custo;
- preserve auditoria de mensagens em `BotMessage`;
- nunca permita que a IA defina preco, estoque, frete ou total.

## Criterios De Aceite

Uma mudanca no bot so deve ser considerada pronta quando:

- `python -m pytest bipdelivery/tests/test_bot_mvp.py` passar;
- `npm run frontend:test:unit` passar quando contratos frontend mudarem;
- `npm run frontend:typecheck` passar;
- `docs/api/reference.md` estiver alinhado quando payload, resposta ou filtros
  mudarem;
- este documento refletir novas intents, regras ou superficies de UI.

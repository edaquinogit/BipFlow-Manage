# Visao Geral Da Arquitetura

Este documento descreve a arquitetura implementada hoje no repositorio.

## Fluxo Principal

```text
Usuario administrativo ou cliente publico
  |
  v
Frontend Vue 3 (bipflow-frontend)
  |
  | HTTP JSON ou multipart
  v
Backend Django REST (bipdelivery)
  |
  | ORM / File storage local em desenvolvimento
  v
SQLite + MEDIA_ROOT
```

O caminho acima e o produto principal: dashboard autenticado, catalogo publico,
carrinho, frete por regiao, checkout e historico de vendas.

## Sistemas Separados

Tambem existem componentes Node no repositorio:

- `index.js`, `src/`, `services/` e `docs/swagger.js`: motor Node independente
  para integracao de pedidos.
- `api-order-validation/`: pacote/test harness isolado ligado ao motor Node.

Esses componentes nao participam do runtime normal Django + Vue.

## Frontend Vue

Responsabilidades:

- proteger o dashboard por guarda de rota autenticada e papel de dashboard;
- exibir saudacao com o usuario retornado por `GET /api/auth/me/`;
- listar e gerenciar produtos no dashboard;
- abrir menu operacional com historico de vendas, alertas de estoque, atalhos e
  gestao de regioes de entrega e WhatsApp da loja;
- expor catalogo publico em `/produtos`;
- carregar regioes ativas de entrega no carrinho;
- exibir o WhatsApp publico da loja e abrir duvidas frequentes com mensagem
  pronta para `api.whatsapp.com/send`;
- enviar checkout para a API Django e abrir o fluxo de WhatsApp.

Camadas relevantes:

- `src/services/`: acesso HTTP e contratos de API.
- `src/composables/`: estado reutilizavel.
- `src/views/dashboard/`: experiencia administrativa.
- `src/views/products/`: catalogo publico, detalhe e checkout.
- `src/types/` e `src/schemas/`: contratos compartilhados no frontend.

## Backend Django

Responsabilidades:

- autenticar via JWT;
- expor perfil autenticado em `auth/me`;
- aplicar RBAC de dashboard com `is_staff`, `is_superuser` e grupos
  `admin`/`manager`/`viewer`;
- aplicar throttling em endpoints sensiveis de auth;
- manter produtos, categorias e galerias de imagens;
- manter regioes de entrega e taxa por regiao;
- manter configuracoes operacionais da loja, incluindo WhatsApp de atendimento;
- responder mensagens do bot MVP sem IA por regras deterministicas;
- persistir conversas e mensagens do bot em `BotConversation` e `BotMessage`;
- validar checkout no servidor;
- persistir pedidos como `SaleOrder` e `SaleOrderItem`;
- expor historico de vendas para usuarios com papel de dashboard.

Arquivos principais:

- `bipdelivery/api/models.py`
- `bipdelivery/api/bot_engine.py`
- `bipdelivery/api/serializers.py`
- `bipdelivery/api/views.py`
- `bipdelivery/api/v1_urls.py`
- `bipdelivery/core/settings.py`

## Contratos Principais

Produtos:

- `/api/v1/products/`
- leitura publica;
- escrita por `staff`, `superuser`, `admin` ou `manager`;
- filtros por busca, categoria, estoque e preco;
- detalhe publico por slug em `/api/v1/products/by-slug/{slug}/`;
- ate 3 imagens por produto.

Categorias:

- `/api/v1/categories/`
- leitura publica;
- escrita por `staff`, `superuser`, `admin` ou `manager`;
- exclusao bloqueada quando ha produtos associados.

Regioes de entrega:

- `/api/v1/delivery-regions/`
- leitura publica mostra apenas regioes ativas para usuarios anonimos e
  autenticados sem papel de dashboard;
- usuarios com papel de dashboard veem todas;
- `staff`, `superuser`, `admin` e `manager` gerenciam;
- `/api/v1/delivery-regions/active/` alimenta o carrinho publico.

Configuracoes da loja:

- `/api/v1/store-settings/` e privado para papeis de dashboard;
- `/api/v1/store-settings/public/` expoe somente `whatsapp_phone_digits` e
  `is_whatsapp_configured`;
- o catalogo usa esse contrato minimo para mostrar o contato e montar mensagens
  pre-preenchidas de duvidas frequentes;
- o checkout prioriza o numero salvo no dashboard e usa `WHATSAPP_ORDER_PHONE`
  apenas como fallback.

Bot MVP:

- `/api/v1/bot/messages/` recebe mensagens publicas;
- `/api/v1/bot-conversations/` expoe historico apenas para papel de dashboard;
- sem IA e sem provedor externo nesta fase;
- classifica mensagens por regras para saudacao, catalogo, busca de produto,
  entrega, checkout, atendimento humano e fallback;
- persiste mensagens do cliente e respostas do bot;
- retorna `conversation_id` e `session_id` para continuidade da conversa;
- consulta produtos disponiveis e regioes ativas sem duplicar regra de negocio.
- documentacao da feature:
  [docs/features/catalog-bot.md](../features/catalog-bot.md).

Checkout:

- `/api/v1/checkout/whatsapp/`
- publico;
- recalcula totais no backend;
- usa taxa da regiao de entrega quando enviada;
- persiste pedido e itens;
- retorna mensagem e URL `wa.me` quando houver WhatsApp configurado no
  dashboard ou fallback em `WHATSAPP_ORDER_PHONE`.

Vendas:

- `/api/v1/sales-orders/`
- somente papel de dashboard;
- read-only;
- suporta filtros `status` e `search`.

## Decisoes Arquiteturais

- O backend e a autoridade para preco, estoque, disponibilidade, frete e total.
- O backend e a barreira de seguranca: cadastro publico nao concede papel de
  dashboard nem permissao de escrita.
- O frontend nao grava tokens fora de `token-store.ts`.
- O frontend nao deve espalhar chamadas `axios` fora de `src/services/`.
- O dashboard consome historico de vendas persistido pelo checkout publico.
- O bot do catalogo deve continuar fino no frontend: UI chama service, service
  chama API, backend classifica e consulta dados reais.
- Documentacao deve representar o codigo atual e ser removida quando virar
  placeholder, relatorio historico ou plano nao implementado.

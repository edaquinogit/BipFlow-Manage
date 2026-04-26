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

- proteger o dashboard por guarda de rota autenticada;
- exibir saudacao com o usuario retornado por `GET /api/auth/me/`;
- listar e gerenciar produtos no dashboard;
- abrir menu operacional com historico de vendas, alertas de estoque, atalhos e
  gestao de regioes de entrega;
- expor catalogo publico em `/produtos`;
- carregar regioes ativas de entrega no carrinho;
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
- aplicar throttling em endpoints sensiveis de auth;
- manter produtos, categorias e galerias de imagens;
- manter regioes de entrega e taxa por regiao;
- validar checkout no servidor;
- persistir pedidos como `SaleOrder` e `SaleOrderItem`;
- expor historico de vendas para usuarios autenticados.

Arquivos principais:

- `bipdelivery/api/models.py`
- `bipdelivery/api/serializers.py`
- `bipdelivery/api/views.py`
- `bipdelivery/api/v1_urls.py`
- `bipdelivery/core/settings.py`

## Contratos Principais

Produtos:

- `/api/v1/products/`
- leitura publica;
- escrita autenticada;
- filtros por busca, categoria, estoque e preco;
- detalhe publico por slug em `/api/v1/products/by-slug/{slug}/`;
- ate 3 imagens por produto.

Categorias:

- `/api/v1/categories/`
- leitura publica;
- escrita autenticada;
- exclusao bloqueada quando ha produtos associados.

Regioes de entrega:

- `/api/v1/delivery-regions/`
- leitura publica mostra apenas regioes ativas para usuarios anonimos;
- usuarios autenticados veem e gerenciam todas;
- `/api/v1/delivery-regions/active/` alimenta o carrinho publico.

Checkout:

- `/api/v1/checkout/whatsapp/`
- publico;
- recalcula totais no backend;
- usa taxa da regiao de entrega quando enviada;
- persiste pedido e itens;
- retorna mensagem e URL `wa.me` quando `WHATSAPP_ORDER_PHONE` esta configurado.

Vendas:

- `/api/v1/sales-orders/`
- somente autenticado;
- read-only;
- suporta filtros `status` e `search`.

## Decisoes Arquiteturais

- O backend e a autoridade para preco, estoque, disponibilidade, frete e total.
- O frontend nao grava tokens fora de `token-store.ts`.
- O frontend nao deve espalhar chamadas `axios` fora de `src/services/`.
- O dashboard consome historico de vendas persistido pelo checkout publico.
- Documentacao deve representar o codigo atual e ser removida quando virar
  placeholder, relatorio historico ou plano nao implementado.

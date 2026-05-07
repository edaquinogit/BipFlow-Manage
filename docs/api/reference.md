# Referencia Da API Django

Contrato funcional dos endpoints implementados em `bipdelivery/api/`.

## Base

Local:

```text
http://127.0.0.1:8000/api/
```

API versionada:

```text
/api/v1/
```

Esta referencia nao descreve o motor Node da raiz. A documentacao Swagger desse
motor fica em `/api-docs` quando `npm run dev` esta ativo.

## Autenticacao

O backend usa Simple JWT. O frontend guarda `access_token` e `refresh_token`
somente via `bipflow-frontend/src/services/token-store.ts`.

### Login

```http
POST /api/auth/token/
```

```json
{
  "username": "admin@example.com",
  "password": "senha"
}
```

Resposta:

```json
{
  "access": "jwt-access",
  "refresh": "jwt-refresh"
}
```

### Usuario autenticado

```http
GET /api/auth/me/
Authorization: Bearer <access>
```

Resposta:

```json
{
  "id": 1,
  "username": "admin@example.com",
  "email": "admin@example.com",
  "first_name": "Ednaldo",
  "last_name": "Aquino",
  "display_name": "Ednaldo Aquino",
  "is_staff": true,
  "is_superuser": false,
  "roles": ["staff"],
  "can_access_dashboard": true,
  "can_manage_catalog": true
}
```

`display_name` usa nome completo quando existe; caso contrario, usa a parte
local do email ou o `username`.

Os campos `roles`, `can_access_dashboard` e `can_manage_catalog` expoem o RBAC
usado pelo dashboard. Usuarios criados pelo cadastro publico nascem ativos, mas
sem permissao administrativa.

### Renovar token

```http
POST /api/auth/token/refresh/
```

```json
{
  "refresh": "jwt-refresh"
}
```

### Cadastro

```http
POST /api/auth/register/
```

```json
{
  "email": "admin@example.com",
  "password": "senha-segura",
  "confirm_password": "senha-segura"
}
```

O cadastro publico cria uma conta ativa comum. Essa conta nao recebe acesso de
dashboard, escrita administrativa ou historico de vendas ate ser promovida para
`is_staff`/`is_superuser` ou adicionada aos grupos `admin`, `manager` ou
`viewer`.

### Reset de senha

```http
POST /api/auth/password-reset/
POST /api/auth/password-reset/confirm/
```

O reset evita enumeracao de contas e usa token assinado do Django.

### Throttling de auth

| Escopo | Endpoints | Padrao |
| --- | --- | --- |
| IP sensivel | login, cadastro, reset e confirmacao de reset | `10/minute` |
| Login por identidade | `username` ou `email` submetido | `5/minute` |
| Cadastro por email | `email` submetido | `3/hour` |
| Reset por email | `email` submetido | `3/hour` |
| Confirmacao por uid | `uid` submetido | `5/hour` |
| Refresh por IP | token refresh | `30/minute` |
| Refresh por token | `refresh` submetido | `10/minute` |

Quando o limite e excedido, a API retorna `429 Too Many Requests`.

## Permissoes

- Produtos, categorias e regioes de entrega: leitura publica, escrita apenas
  para `is_staff`, `is_superuser` ou usuarios nos grupos `admin`/`manager`.
- Regioes de entrega para usuario anonimo: somente regioes ativas.
- Configuracoes da loja: leitura administrativa para papeis de dashboard;
  escrita apenas para `is_staff`, `is_superuser` ou usuarios nos grupos
  `admin`/`manager`. O catalogo publico consome somente o endpoint seguro
  `/api/v1/store-settings/public/`.
- Checkout WhatsApp: publico.
- Historico de vendas: read-only para `is_staff`, `is_superuser` ou usuarios
  nos grupos `admin`/`manager`/`viewer`.

## Paginacao

Respostas paginadas usam este formato:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "page_size": 20,
  "total_pages": 1,
  "results": []
}
```

Produtos usam `page_size` padrao 12 e maximo 50. As demais listas usam padrao
20 e maximo 100.

## Produtos

```http
GET /api/v1/products/
POST /api/v1/products/
GET /api/v1/products/{id}/
PATCH /api/v1/products/{id}/
DELETE /api/v1/products/{id}/
GET /api/v1/products/by-slug/{slug}/
PATCH /api/v1/products/bulk_update_category/
```

Leitura e publica. Escrita exige `staff`, `superuser`, grupo `admin` ou grupo
`manager`.

Query params de listagem:

- `search`
- `category` por id ou slug
- `in_stock` com `true`, `false`, `1`, `0`, `yes` ou `no`
- `min_price`
- `max_price`
- `page`
- `page_size`

Campos principais:

- `id`
- `sku`
- `name`
- `slug`
- `description`
- `price`
- `size`
- `stock_quantity`
- `is_available`
- `image`
- `images`
- `category`
- `category_name`
- `created_at`

Contrato de escrita:

- `POST` exige `name`, `price`, `stock_quantity` e `category`;
- `category` deve ser o ID numerico de uma categoria existente;
- `price` aceita valor decimal;
- `stock_quantity` deve ser inteiro nao negativo;
- `PATCH` aceita atualizacao parcial, mas o dashboard envia o formulario
  normalizado com os campos de negocio atuais.

Upload e galeria:

- aceita JSON ou `multipart/form-data`;
- `image` define a capa;
- `uploaded_images` e `existing_images` controlam galeria;
- o frontend envia slots ordenados como `existing_images[0]`,
  `uploaded_images[1]` e assim por diante para preservar ordem visual;
- cada produto pode ter no maximo 3 imagens.

Atualizacao em lote:

```json
{
  "product_ids": [1, 2, 3],
  "new_category_id": 5
}
```

## Categorias

```http
GET /api/v1/categories/
POST /api/v1/categories/
GET /api/v1/categories/{id}/
PUT /api/v1/categories/{id}/
PATCH /api/v1/categories/{id}/
DELETE /api/v1/categories/{id}/
```

Leitura e publica. Escrita exige `staff`, `superuser`, grupo `admin` ou grupo
`manager`.

Campos:

- `id`
- `name`
- `slug`
- `description`

Se houver produtos associados, a remocao retorna erro de regra de negocio.

## Regioes De Entrega

```http
GET /api/v1/delivery-regions/
POST /api/v1/delivery-regions/
GET /api/v1/delivery-regions/{id}/
PATCH /api/v1/delivery-regions/{id}/
DELETE /api/v1/delivery-regions/{id}/
GET /api/v1/delivery-regions/active/
```

Campos:

- `id`
- `name`
- `city`
- `neighborhoods`
- `delivery_fee`
- `is_active`
- `created_at`
- `updated_at`

Notas:

- usuarios anonimos e autenticados sem papel de dashboard recebem apenas
  regioes ativas;
- usuarios com papel de dashboard veem todas;
- somente `staff`, `superuser`, grupo `admin` ou grupo `manager` cria, edita e
  remove regioes;
- o carrinho publico usa `/active/` para calcular frete.

## Configuracoes Da Loja

```http
GET /api/v1/store-settings/
PATCH /api/v1/store-settings/
GET /api/v1/store-settings/public/
```

Payload de escrita:

```json
{
  "whatsapp_phone": "+55 71 99999-9999"
}
```

Campos:

- `id`
- `whatsapp_phone`
- `whatsapp_phone_digits`
- `is_whatsapp_configured`
- `created_at`
- `updated_at`

Resposta publica:

```json
{
  "whatsapp_phone_digits": "5571999999999",
  "is_whatsapp_configured": true
}
```

Notas:

- o backend aceita numero formatado, mas persiste somente digitos;
- o WhatsApp deve incluir codigo do pais e DDD;
- o catalogo publico usa apenas `whatsapp_phone_digits` para exibir o contato
  e montar atalhos de duvidas frequentes;
- o checkout usa este numero para montar `whatsapp_url`;
- `WHATSAPP_ORDER_PHONE` fica como fallback quando o dashboard ainda nao tem
  WhatsApp cadastrado.

## Bot MVP Sem IA

```http
POST /api/v1/bot/messages/
```

Endpoint publico para a primeira fatia do bot guiado por regras. Ele nao chama
IA nem conversa com provedor WhatsApp externo, mas persiste conversas e
mensagens em `BotConversation` e `BotMessage`.

Documento de feature:
[docs/features/catalog-bot.md](../features/catalog-bot.md).

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

`channel`, `session_id`, `conversation_id` e `customer_phone` sao opcionais.
`channel` aceita `web` ou `whatsapp`. Quando nenhum identificador de conversa e
enviado, o backend cria uma conversa nova e devolve `conversation_id` e
`session_id`.

Resposta:

- `intent`: `greeting`, `catalog`, `product_search`, `delivery`, `checkout`,
  `human_support` ou `fallback`;
- `conversation_id`: identificador interno da conversa persistida;
- `session_id`: identificador publico opaco para continuidade no cliente;
- `conversation_status`: `waiting_customer` ou `waiting_human` nesta fase;
- `reply`: texto curto para exibir ao cliente;
- `options`: atalhos guiados que o frontend pode renderizar;
- `products`: sugestoes compactas de produtos disponiveis;
- `delivery_regions`: regioes ativas de entrega.

Regras:

- mensagens vazias sao rejeitadas;
- catalogo e busca retornam apenas produtos disponiveis e com estoque;
- entrega retorna apenas regioes ativas;
- cada mensagem util salva uma mensagem `user` e uma mensagem `bot`;
- mensagens seguintes com `conversation_id` ou `session_id` reutilizam a mesma
  conversa;
- pedidos de atendimento humano mudam a conversa para `waiting_human`;
- checkout orienta o cliente a finalizar pelo carrinho, mantendo preco, estoque,
  frete e total sob responsabilidade do backend.
- novas intents devem atualizar backend, serializers, types do frontend, testes
  e esta referencia no mesmo ciclo da mudanca.

## Conversas Do Bot

```http
GET /api/v1/bot-conversations/
GET /api/v1/bot-conversations/{id}/
```

Endpoint read-only para usuarios com papel de dashboard. A listagem retorna um
resumo das conversas persistidas; o detalhe inclui as mensagens.

O dashboard consome este contrato na vitrine do chatbot. Essa UI abre sob
demanda, carrega dados de forma lazy e nao cria ou altera conversas.

Filtros:

- `status`: `open`, `waiting_customer`, `waiting_human` ou `closed`;
- `channel`: `web` ou `whatsapp`;
- `intent`: ultima intent registrada, como `human_support` ou `delivery`;
- `search`: busca por `session_id`, telefone do cliente ou conteudo das
  mensagens.

Campos da listagem:

- `id`
- `session_id`
- `channel`
- `customer_phone`
- `status`
- `last_intent`
- `message_count`
- `last_message_preview`
- `created_at`
- `updated_at`

O detalhe adiciona `messages`, com `role`, `content`, `intent`, `metadata` e
`created_at`.

## Checkout Via WhatsApp

```http
POST /api/v1/checkout/whatsapp/
```

Payload:

```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    }
  ],
  "customer": {
    "full_name": "Cliente Teste",
    "phone": "(71) 99999-0000",
    "email": "cliente@example.com",
    "delivery_method": "delivery",
    "payment_method": "pix",
    "delivery_region_id": 3,
    "address": "Rua A, 123",
    "neighborhood": "Centro",
    "city": "Salvador",
    "notes": "Sem cebola"
  }
}
```

Regras:

- `items` nao pode ser vazio;
- produtos precisam existir, estar disponiveis e ter estoque;
- entrega exige `address`, `neighborhood` e `city`;
- quando `delivery_region_id` ativo e enviado, o backend usa a taxa da regiao;
- sem regiao enviada, entrega usa `ORDER_DELIVERY_FEE`;
- retirada usa taxa `0.00`;
- o pedido e persistido em `SaleOrder` com itens em `SaleOrderItem`;
- `order_reference` segue o prefixo `BPF`.
- `whatsapp_url` aponta para o WhatsApp da loja configurado no dashboard.

Resposta:

- `order_reference`
- `items`
- `customer`
- `subtotal`
- `delivery_fee`
- `total`
- `message`
- `whatsapp_url`

## Historico De Vendas

```http
GET /api/v1/sales-orders/
GET /api/v1/sales-orders/{id}/
```

Somente usuarios com papel de dashboard. O viewset e read-only.

Query params:

- `status`
- `search`
- `page`
- `page_size`

Campos principais:

- `id`
- `order_reference`
- `status`
- `customer_name`
- `customer_phone`
- `customer_email`
- `delivery_method`
- `payment_method`
- `subtotal`
- `delivery_fee`
- `delivery_region_name`
- `total`
- `created_at`
- `item_count`
- `items`

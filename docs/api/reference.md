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
  "display_name": "Ednaldo Aquino"
}
```

`display_name` usa nome completo quando existe; caso contrario, usa a parte
local do email ou o `username`.

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

- Produtos, categorias e regioes de entrega: leitura publica, escrita
  autenticada.
- Regioes de entrega para usuario anonimo: somente regioes ativas.
- Checkout WhatsApp: publico.
- Historico de vendas: autenticado e read-only.

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

- usuarios anonimos recebem apenas regioes ativas;
- usuarios autenticados podem listar, criar, editar e remover regioes;
- o carrinho publico usa `/active/` para calcular frete.

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

Somente autenticado. O viewset e read-only.

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

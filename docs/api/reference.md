# Referencia Da API

Contrato funcional dos endpoints implementados em `bipdelivery/api/`.

## Base URL

Ambiente local:

```text
http://127.0.0.1:8000/api/
```

Versionamento de negocio:

```text
/api/v1/
```

## Autenticacao

O backend usa JWT com Simple JWT.

### Obter token

```http
POST /api/auth/token/
```

Payload esperado:

```json
{
  "username": "seu-usuario",
  "password": "sua-senha"
}
```

### Renovar token

```http
POST /api/auth/token/refresh/
```

Payload esperado:

```json
{
  "refresh": "refresh-token"
}
```

## Politica De Permissao

- `GET`, `HEAD` e `OPTIONS` em produtos e categorias sao publicos.
- `POST`, `PUT`, `PATCH` e `DELETE` exigem usuario autenticado.
- O endpoint de checkout via WhatsApp e publico.

## Produtos

### Listar produtos

```http
GET /api/v1/products/
```

Query params aceitos pelo backend:

- `search`
- `category`
- `in_stock`
- `min_price`
- `max_price`
- `page`
- `page_size`

Resposta paginada:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "page_size": 12,
  "total_pages": 1,
  "results": [
    {
      "id": 1,
      "sku": "LAP-001",
      "name": "Laptop",
      "slug": "laptop-ab12cd34",
      "description": "",
      "price": "999.99",
      "size": null,
      "stock_quantity": 5,
      "is_available": true,
      "image": "http://127.0.0.1:8000/media/products/2026/04/item.png",
      "category": 2,
      "category_name": "Eletronicos",
      "created_at": "2026-04-21T01:00:00Z"
    }
  ]
}
```

Notas importantes:

- `category` retorna o id numerico da categoria.
- `category_name` vem denormalizado para facilitar o consumo no frontend.
- `is_available` e recalculado pelo model a partir de `stock_quantity`.
- A paginacao de produtos usa `12` itens por pagina por padrao.

### Criar produto

```http
POST /api/v1/products/
Authorization: Bearer <token>
```

Campos principais:

- `name`
- `sku`
- `price`
- `stock_quantity`
- `category`
- `description`
- `size`
- `image`

Observacoes:

- aceita payload JSON ou `multipart/form-data`
- gera `slug` automaticamente quando ausente

### Atualizar produto

```http
PATCH /api/v1/products/{id}/
Authorization: Bearer <token>
```

O backend aceita atualizacao parcial.

### Remover produto

```http
DELETE /api/v1/products/{id}/
Authorization: Bearer <token>
```

### Atualizar categoria em lote

```http
PATCH /api/v1/products/bulk_update_category/
Authorization: Bearer <token>
```

Payload:

```json
{
  "product_ids": [1, 2, 3],
  "new_category_id": 5
}
```

## Categorias

### Listar categorias

```http
GET /api/v1/categories/
```

Resposta paginada:

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "page_size": 20,
  "total_pages": 1,
  "results": [
    {
      "id": 1,
      "name": "Lanches",
      "slug": "lanches",
      "description": "Itens do cardapio rapido"
    }
  ]
}
```

### Criar categoria

```http
POST /api/v1/categories/
Authorization: Bearer <token>
```

Campos:

- `name`
- `slug`
- `description`

### Atualizar categoria

```http
PUT /api/v1/categories/{id}/
Authorization: Bearer <token>
```

### Remover categoria

```http
DELETE /api/v1/categories/{id}/
Authorization: Bearer <token>
```

Se a categoria possuir produtos relacionados, a remocao retorna `400 Bad Request`.

## Checkout Via WhatsApp

### Preparar pedido

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
    "email": "cliente@teste.com",
    "delivery_method": "delivery",
    "payment_method": "pix",
    "address": "Rua A, 123",
    "neighborhood": "Centro",
    "city": "Salvador",
    "notes": "Sem cebola"
  }
}
```

Comportamento:

- valida se todos os produtos existem
- valida disponibilidade e estoque
- recalcula subtotal, taxa de entrega e total no servidor
- exige endereco quando `delivery_method = delivery`
- monta a mensagem final e, se configurado, devolve a URL `wa.me`

Campos de resposta:

- `order_reference`
- `items`
- `customer`
- `subtotal`
- `delivery_fee`
- `total`
- `message`
- `whatsapp_url`

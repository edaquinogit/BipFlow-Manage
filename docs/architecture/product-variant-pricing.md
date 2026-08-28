# Evolução: Preço por Variação de Produto

Permite que uma variação (`ProductVariant`) tenha um preço próprio, diferente
do preço base do produto. Segue o padrão de etapas verticais das outras
evoluções: cada fase entrega backend + frontend juntos, testado, sem quebrar
o que já funciona.

## Modelo de domínio

- **`Product.price`** — preço base do produto. Inalterado.
- **`ProductVariant.price`** — `DecimalField(null=True, blank=True)`, override
  **opcional**. `NULL` (o default) significa "herdar o preço base" e é
  semanticamente diferente de `0.00` (que é um preço real). Validação:
  `price >= 0` (`MinValueValidator(0)`), o mesmo piso que o formulário já
  aplica a `Product.price`.

## Regra de preço efetivo — ponto único

```python
Product.get_effective_price(variant=None) -> Decimal
    # variant com price != None  -> variant.price
    # senão                       -> product.price
```

É a **única** fonte da verdade para o fallback. Nenhum outro lugar do backend
(nem o frontend) reimplementa `variant.price or product.price`. Os dois — e
únicos — call-sites de cálculo de preço passam por ela:

- `CheckoutWhatsAppView._normalize_reserved_items` (checkout WhatsApp)
- `PdvSaleView` (venda no PDV / loja física)

## Fonte da verdade

O frontend **nunca** é autoridade do preço. O checkout recebe apenas
`product_id`, `variant_id`, `quantity`; o backend busca `Product`/
`ProductVariant` (escopados pela loja atual), resolve o preço efetivo e
recalcula `unit_price`, `line_total`, `subtotal`, `delivery_fee`, `total`.

## Snapshot histórico

`SaleOrderItem.unit_price` / `line_total` já são snapshot do momento da compra.
Passam a receber `get_effective_price(variant)`. Alterar `variant.price`
depois **não** afeta pedidos antigos.

## Serialização

`ProductVariantSerializer` expõe:

- `price` — o override cru (`"69.90"` ou `null`)
- `effective_price` — já resolvido (`variant.price ?? product.price`), para o
  frontend não precisar aplicar a regra

O queryset de `ProductViewSet` usa
`Prefetch("variants", ProductVariant.objects.select_related("product"))` para
`effective_price` não gerar N+1.

## Fora de escopo

Preço por quantidade, tabela de atacado, cupons/promoções, campos fiscais,
frete automático. Estoque e QR Code não mudam.

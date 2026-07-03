"""Single chokepoint for manual stock_quantity mutations (Etapa 1 of the
stock-movement evolution, see docs/architecture/stock-movement-evolution.md).

Locks the product row, validates the resulting stock can never go negative,
and writes the Product update and its StockMovement audit row in the same
transaction. Checkout's bulk decrement path does NOT go through this
function -- see CheckoutWhatsAppView._reserve_cart_stock, which already
locks/decrements in bulk for its own hot path and only reuses StockMovement
as a plain bulk_create afterwards -- but every other stock_quantity write
should call apply_stock_movement().
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import Product, SaleOrder, StockMovement, Store


class StockMovementError(Exception):
    """Raised when a manual stock movement would be invalid (e.g. negative stock)."""


def apply_stock_movement(
    *,
    product_id: int,
    store: Store,
    movement_type: str,
    quantity: int,
    reason: str,
    performed_by=None,
    notes: str = "",
    source: str = StockMovement.SOURCE_MANUAL,
    sale_order=None,
) -> StockMovement:
    """Atomically adjust a product's stock and record the movement.

    Raises StockMovementError for invalid input (unknown product, zero/negative
    quantity, unknown movement_type, or a "saida" that would drive stock below
    zero). Callers translate that into their own error-response shape.
    """
    if quantity <= 0:
        raise StockMovementError("A quantidade deve ser maior que zero.")

    if movement_type not in (StockMovement.TYPE_ENTRADA, StockMovement.TYPE_SAIDA):
        raise StockMovementError("Tipo de movimento inválido.")

    with transaction.atomic():
        try:
            product = Product.objects.select_for_update().get(id=product_id, store=store)
        except Product.DoesNotExist as exc:
            raise StockMovementError("Produto não encontrado.") from exc

        previous_stock = product.stock_quantity

        if movement_type == StockMovement.TYPE_ENTRADA:
            new_stock = previous_stock + quantity
        else:
            new_stock = previous_stock - quantity
            if new_stock < 0:
                raise StockMovementError(
                    f"Estoque insuficiente. Disponível: {previous_stock}, solicitado: {quantity}."
                )

        product.stock_quantity = new_stock
        product.is_available = new_stock > 0
        product.updated_at = timezone.now()
        product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

        return StockMovement.objects.create(
            store=store,
            product=product,
            movement_type=movement_type,
            quantity=quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reason=reason,
            source=source,
            sale_order=sale_order,
            performed_by=performed_by,
            notes=notes,
        )


def apply_order_cancellation(
    *, order: SaleOrder, store: Store, performed_by=None
) -> list[StockMovement]:
    """Cancel `order` and restock every item it originally decremented.

    Etapa R2 of the QR-code stock-exit refinement (see
    docs/architecture/qrcode-stock-exit-refinement.md): cancelling a sale
    never used to touch stock at all, in either channel -- a WhatsApp order
    rarely gets cancelled after the fact, but a PDV sale can, every day, from
    an ordinary cashier mistake (wrong item, double-tap on "finalizar"). This
    is deliberately channel-agnostic: it restocks a cancelled order the same
    way regardless of whether it came from the storefront or the PDV,
    because there is no real business reason for the two channels to behave
    differently here.

    Idempotent: cancelling an already-cancelled order is a no-op (returns an
    empty list) instead of restocking twice. Locks every affected product row
    (ordered by id, same deadlock-free pattern as
    CheckoutWhatsAppView._lock_cart_products and PdvSaleView._lock_products)
    before mutating any of them.
    """
    if order.status == SaleOrder.STATUS_CANCELLED:
        return []

    with transaction.atomic():
        items = list(order.items.all())
        product_ids = sorted({item.product_id for item in items if item.product_id})
        products_by_id = {
            product.id: product
            for product in Product.objects.select_for_update()
            .filter(id__in=product_ids, store=store)
            .order_by("id")
        }

        timestamp = timezone.now()
        source = (
            StockMovement.SOURCE_PDV
            if order.channel == SaleOrder.CHANNEL_LOJA_FISICA
            else StockMovement.SOURCE_VENDA
        )
        movements = []

        for item in items:
            product = products_by_id.get(item.product_id)
            if product is None:
                # The product was deleted since the sale; nothing left to
                # restock for this line, but the rest of the order still
                # gets cancelled and restocked normally.
                continue

            previous_stock = product.stock_quantity
            product.stock_quantity += item.quantity
            product.is_available = product.stock_quantity > 0
            product.updated_at = timestamp

            movements.append(
                StockMovement(
                    store=store,
                    product=product,
                    movement_type=StockMovement.TYPE_ENTRADA,
                    quantity=item.quantity,
                    previous_stock=previous_stock,
                    new_stock=product.stock_quantity,
                    reason=StockMovement.REASON_VENDA_CANCELADA,
                    source=source,
                    sale_order=order,
                    performed_by=performed_by,
                )
            )

        if products_by_id:
            Product.objects.bulk_update(
                list(products_by_id.values()), ["stock_quantity", "is_available", "updated_at"]
            )

        if movements:
            StockMovement.objects.bulk_create(movements)

        order.status = SaleOrder.STATUS_CANCELLED
        order.save(update_fields=["status", "updated_at"])

    return movements

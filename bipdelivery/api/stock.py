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

from .models import Product, StockMovement, Store


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

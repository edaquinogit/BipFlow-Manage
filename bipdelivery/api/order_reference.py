from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone
from django.utils.crypto import get_random_string


REFERENCE_RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def build_sale_order_reference(prefix: str) -> str:
    """Build a short, human-readable, collision-resistant sale reference."""

    timestamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    suffix = get_random_string(6, allowed_chars=REFERENCE_RANDOM_CHARS).upper()
    return f"{prefix}-{timestamp}-{suffix}"


@dataclass(frozen=True)
class PaymentReferenceDetails:
    """Internal payment tracking details attached to a SaleOrder."""

    status: str
    reference: str
    display_code: str
    instructions: str


def _payment_reference_suffix(order_reference: str) -> str:
    normalized_reference = re.sub(r"[^A-Z0-9]", "", order_reference.upper())
    return normalized_reference[-14:] or get_random_string(
        14, allowed_chars=REFERENCE_RANDOM_CHARS
    ).upper()


def build_payment_reference_details(
    order_reference: str,
    payment_method: str,
    total: Decimal,
    *,
    confirmed: bool = False,
) -> PaymentReferenceDetails:
    """Build the internal payment reference shown to customers/operators.

    This is intentionally an internal store reference. It is not a Pix BR Code
    nor a card-acquirer authorization; those can be plugged in later when the
    store has a payment provider configured.
    """

    suffix = _payment_reference_suffix(order_reference)
    amount_cents = int(
        (Decimal(total).quantize(Decimal("0.01")) * 100).to_integral_value()
    )

    if confirmed:
        reference = f"PDV-{suffix}"
        return PaymentReferenceDetails(
            status="confirmed",
            reference=reference,
            display_code=reference,
            instructions="Pagamento registrado no PDV da loja.",
        )

    if payment_method == "pix":
        reference = f"PIX-{suffix}"
        return PaymentReferenceDetails(
            status="pending",
            reference=reference,
            display_code=f"BIPFLOW-PIX-{suffix}-{amount_cents}",
            instructions=(
                "Codigo Pix interno para conferencia do pedido. Confirme o "
                "recebimento antes de separar ou enviar."
            ),
        )

    if payment_method == "card":
        reference = f"CARD-{suffix}"
        return PaymentReferenceDetails(
            status="pending",
            reference=reference,
            display_code=f"BIPFLOW-CARD-{suffix}",
            instructions=(
                "Referencia interna para pagamento no cartao. Confirme a "
                "transacao no atendimento antes de finalizar a venda."
            ),
        )

    return PaymentReferenceDetails(
        status="pay_at_store",
        reference="",
        display_code="Pagamento na loja",
        instructions="Pagamento em dinheiro apenas na loja.",
    )

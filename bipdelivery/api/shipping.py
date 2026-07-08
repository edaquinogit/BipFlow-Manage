"""Etapa 1 of the pedidos/NF/envio evolution (see
docs/architecture/pedidos-nf-envio-evolution.md): manual shipping -- carrier
name + tracking code typed in by the operator, no freight API.
"""
from __future__ import annotations

from urllib.parse import quote

from .models import SaleOrder

# A delivery order must pass through "sent" before "delivered"; a pickup
# order has no shipping leg at all, so it skips straight from "prepared" to
# "delivered". "sent" stays a valid source for both delivery methods,
# because orders already sitting there from before this evolution shipped
# must keep working (not retroactive -- see the evolution doc's Etapa 1).
_FROM_SENT = frozenset({SaleOrder.STATUS_DELIVERED, SaleOrder.STATUS_CANCELLED})


def get_allowed_next_statuses(order: SaleOrder) -> frozenset[str]:
    """Return the statuses `order` may legally move to from its current status."""
    if order.status == SaleOrder.STATUS_PREPARED:
        if order.delivery_method == "delivery":
            return frozenset({SaleOrder.STATUS_SENT, SaleOrder.STATUS_CANCELLED})
        return frozenset({SaleOrder.STATUS_DELIVERED, SaleOrder.STATUS_CANCELLED})

    if order.status == SaleOrder.STATUS_SENT:
        return _FROM_SENT

    return frozenset()  # delivered/cancelled are terminal


_KNOWN_CARRIER_TRACKING_URL_TEMPLATES = {
    "correios": "https://rastreamento.correios.com.br/app/index.php?objeto={code}",
}


def build_tracking_url(carrier_name: str, tracking_code: str) -> str:
    """Best-effort tracking link: a known carrier's own tracker, or a generic search fallback."""
    normalized_carrier = carrier_name.strip().lower()
    code = quote(tracking_code.strip())

    for known_name, url_template in _KNOWN_CARRIER_TRACKING_URL_TEMPLATES.items():
        if known_name in normalized_carrier:
            return url_template.format(code=code)

    query = quote(f"{carrier_name.strip()} rastreio {tracking_code.strip()}")
    return f"https://www.google.com/search?q={query}"

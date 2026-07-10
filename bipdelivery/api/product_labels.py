"""QR Code generation for printable product labels (Etapa 2 of the QR-code
stock-exit evolution, see docs/architecture/qrcode-stock-exit-evolution.md).

Mirrors mfa.build_qr_code_data_uri()'s approach (same `qrcode` dependency,
same base64 PNG data URI shape) but encodes a public storefront deep-link
URL instead of a TOTP provisioning URI: a generic phone camera scanning the
printed label follows the URL straight to the product's public page (Etapa 4
of this same evolution), while the PDV (Etapa 3) only needs the
`public_code` segment at the end of it, read directly out of the decoded
string without navigating anywhere. Until Etapa 4 ships the storefront route
that resolves it, the URL itself 404s if opened -- a known, deliberate gap:
printing labels ahead of that route means every label keeps working once it
lands, instead of every store having to reprint them.
"""
from __future__ import annotations

import base64
import io

import qrcode
from django.conf import settings

from .models import Product


def build_product_deep_link_url(product: Product) -> str:
    """Return the public storefront URL this product's QR Code encodes."""
    return f"{settings.FRONTEND_BASE_URL}/l/{product.store.slug}/p/{product.public_code}"


def build_product_qr_code_data_uri(product: Product) -> str:
    """Render `product`'s public deep-link URL as a base64 PNG data URI."""
    image = qrcode.make(build_product_deep_link_url(product))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


# Etapa 6 of the QR-code stock-exit evolution (batch label printing --
# explicitly deferred by Etapa 2). Matches ProductListPagination.max_page_size
# (bipdelivery/api/pagination.py), reusing an already-established ceiling for
# "how many products this app is comfortable handling in one request" instead
# of inventing a new number. 50 physical labels is already a large single
# print run.
MAX_BULK_LABEL_IDS = 50


def build_product_label_payload(product: Product) -> dict:
    """Per-product payload for the bulk labels endpoint -- richer than the
    {public_code, url, qr_code} shape qr_code() returns, because a selection
    made in the dashboard can survive a filter change that drops the product
    out of the currently-loaded list. Embedding the label's full display text
    here means the frontend never needs a second per-product round trip to
    render it.
    """
    return {
        "id": product.id,
        "public_code": product.public_code,
        "name": product.name,
        "price": str(product.price),
        "size": product.size or None,
        "url": build_product_deep_link_url(product),
        "qr_code": build_product_qr_code_data_uri(product),
    }

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

from __future__ import annotations

from django.utils import timezone
from django.utils.crypto import get_random_string


REFERENCE_RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def build_sale_order_reference(prefix: str) -> str:
    """Build a short, human-readable, collision-resistant sale reference."""

    timestamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    suffix = get_random_string(6, allowed_chars=REFERENCE_RANDOM_CHARS).upper()
    return f"{prefix}-{timestamp}-{suffix}"

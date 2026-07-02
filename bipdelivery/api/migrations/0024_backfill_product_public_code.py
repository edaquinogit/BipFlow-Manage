"""Backfill public_code for every product that predates Etapa 1 of the
QR-code stock-exit evolution (see
docs/architecture/qrcode-stock-exit-evolution.md).

Unlike the stock-movement ledger's Etapa 1 (which deliberately did NOT
fabricate history for old rows -- see docs/architecture/stock-movement-evolution.md),
a product without a public_code cannot be scanned at all, so backfilling here
is required, not optional.

Historical models returned by apps.get_model() don't carry the real
Product.save() override (migrations only see the fields/state at this point
in history, not app code), so the generation + per-store uniqueness check is
inlined here rather than reusing generate_product_public_code() from
models.py. Kept in sync with bipdelivery.api.models.PRODUCT_PUBLIC_CODE_ALPHABET
by convention, not by import -- migrations must stay self-contained.
"""
import secrets

from django.db import migrations

PRODUCT_PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
PRODUCT_PUBLIC_CODE_LENGTH = 8


def generate_missing_public_codes(apps, schema_editor):
    Product = apps.get_model("api", "Product")

    for product in Product.objects.filter(public_code="").order_by("id"):
        while True:
            candidate = "".join(
                secrets.choice(PRODUCT_PUBLIC_CODE_ALPHABET) for _ in range(PRODUCT_PUBLIC_CODE_LENGTH)
            )
            if not Product.objects.filter(store_id=product.store_id, public_code=candidate).exists():
                break

        product.public_code = candidate
        product.save(update_fields=["public_code"])


def noop_reverse(apps, schema_editor):
    """Irreversible in spirit: a printed/shared code is meant to be permanent."""


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_product_public_code'),
    ]

    operations = [
        migrations.RunPython(generate_missing_public_codes, noop_reverse),
    ]

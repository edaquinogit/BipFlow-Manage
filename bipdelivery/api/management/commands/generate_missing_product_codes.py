from __future__ import annotations

from django.core.management.base import BaseCommand

from bipdelivery.api.models import Product


class Command(BaseCommand):
    """Backfill Product.public_code for rows left without one.

    Etapa 1 of the QR-code stock-exit evolution (see
    docs/architecture/qrcode-stock-exit-evolution.md) migrated existing
    products once via a data migration (0024_backfill_product_public_code).
    This command exists for the rare case where a backfill is needed again
    outside that migration -- e.g. rows restored from an older backup, or a
    bulk import that wrote public_code="" directly. Product.save() already
    generates a code whenever the field is blank, so this only needs to
    trigger a save() per row; it does not duplicate that generation logic.
    """

    help = "Backfill Product.public_code for any product left without one."

    def handle(self, *args, **options) -> None:
        queryset = Product.objects.filter(public_code="").order_by("id")
        total = queryset.count()

        if not total:
            self.stdout.write(self.style.SUCCESS("No products are missing a public_code."))
            return

        for product in queryset.iterator():
            product.save(update_fields=["public_code", "updated_at"])

        self.stdout.write(self.style.SUCCESS(f"Backfilled public_code for {total} product(s)."))

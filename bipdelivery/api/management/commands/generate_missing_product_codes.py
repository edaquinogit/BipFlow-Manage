from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q

from bipdelivery.api.models import Product


class Command(BaseCommand):
    """Backfill Product.public_code and auto SKU for rows left without them.

    Etapa 1 of the QR-code stock-exit evolution (see
    docs/architecture/qrcode-stock-exit-evolution.md) migrated existing
    products once via a data migration (0024_backfill_product_public_code).
    This command exists for the rare case where a backfill is needed again
    outside that migration -- e.g. rows restored from an older backup, or a
    bulk import that wrote public_code="" directly. Product.save() already
    generates a public_code and mirrors it into sku when SKU is blank, so this
    only needs to trigger a save() per row; it does not duplicate that logic.
    """

    help = "Backfill Product.public_code and auto SKU for products left without them."

    def handle(self, *args, **options) -> None:
        queryset = Product.objects.filter(
            Q(public_code="") | Q(sku="") | Q(sku__isnull=True)
        ).order_by("id")
        total = queryset.count()

        if not total:
            self.stdout.write(self.style.SUCCESS("No products are missing public_code/SKU."))
            return

        for product in queryset.iterator():
            if product.public_code and not product.sku:
                has_conflict = (
                    Product.objects.filter(store_id=product.store_id, sku=product.public_code)
                    .exclude(pk=product.pk)
                    .exists()
                )
                if has_conflict:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipped SKU backfill for product {product.id}: code already used as SKU."
                        )
                    )
                    continue

            product.save(update_fields=["public_code", "sku", "updated_at"])

        self.stdout.write(
            self.style.SUCCESS(f"Backfilled public_code/SKU for {total} product(s).")
        )

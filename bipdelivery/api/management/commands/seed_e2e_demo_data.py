from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand

from bipdelivery.api.models import Category, DeliveryRegion, Product, Store


class Command(BaseCommand):
    """Seed the minimum catalog data the E2E suite needs to exercise real flows.

    `seed_dashboard_roles` only provisions an authenticated user -- a freshly
    migrated database still has zero products, so any spec that needs one
    (product listing/image checks, QR label printing, WhatsApp checkout,
    which needs a store phone number to build a wa.me link) fails not
    because of a real bug, but because there is nothing to select. Idempotent
    (get_or_create throughout), safe to run on every CI job and on an
    already-seeded local dev database alike.
    """

    help = "Seed a demo store/category/product/delivery-region for the E2E suite."

    def handle(self, *args, **options) -> None:
        store = Store.get_default()

        if not store.whatsapp_phone:
            store.whatsapp_phone = "71999990000"
            store.save(update_fields=["whatsapp_phone"])

        DeliveryRegion.objects.get_or_create(
            store=store,
            name="Centro",
            defaults={"delivery_fee": Decimal("5.00")},
        )

        category, _ = Category.objects.get_or_create(
            store=store,
            name="Geral",
        )

        Product.objects.get_or_create(
            store=store,
            name="Produto Demo E2E",
            defaults={
                "category": category,
                "price": Decimal("29.90"),
                "stock_quantity": 25,
                "is_available": True,
                "size": "M",
            },
        )

        self.stdout.write(self.style.SUCCESS(f'Demo catalog ready for store "{store.slug}".'))

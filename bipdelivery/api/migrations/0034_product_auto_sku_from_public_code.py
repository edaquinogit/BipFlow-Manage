from django.db import migrations, models
from django.db.models import Q


def backfill_auto_sku_from_public_code(apps, schema_editor):
    Product = apps.get_model("api", "Product")

    queryset = (
        Product.objects.exclude(public_code="")
        .exclude(public_code__isnull=True)
        .filter(Q(sku="") | Q(sku__isnull=True))
        .order_by("id")
    )

    for product in queryset.iterator():
        has_conflict = (
            Product.objects.filter(store_id=product.store_id, sku=product.public_code)
            .exclude(pk=product.pk)
            .exists()
        )
        if has_conflict:
            continue

        Product.objects.filter(pk=product.pk).update(sku=product.public_code)


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0033_alter_botconversation_store_alter_category_store_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="sku",
            field=models.CharField(
                blank=True,
                help_text="Unique product code (SKU/Barcode). Defaults to the QR public code when omitted.",
                max_length=50,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="public_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text=(
                    "Auto-generated, immutable lookup code used by QR Code scans "
                    "(PDV and public storefront deep links, see "
                    "docs/architecture/qrcode-stock-exit-evolution.md). Also used "
                    "as the default SKU when no SKU is provided."
                ),
                max_length=12,
            ),
        ),
        migrations.RunPython(backfill_auto_sku_from_public_code, noop_reverse),
    ]

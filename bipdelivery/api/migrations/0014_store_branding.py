from django.db import migrations, models


def backfill_store_branding(apps, schema_editor):
    Store = apps.get_model("api", "Store")
    Store.objects.filter(tagline="").update(tagline="Catalogo online")


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0013_backfill_default_store"),
    ]

    operations = [
        migrations.AddField(
            model_name="store",
            name="logo_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="store",
            name="tagline",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="store",
            name="theme",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(backfill_store_branding, migrations.RunPython.noop),
    ]

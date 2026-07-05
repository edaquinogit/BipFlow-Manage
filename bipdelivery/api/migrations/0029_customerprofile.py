from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_order_cancellation_reason"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(blank=True, max_length=160)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "store",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="customer_profiles", to="api.store"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="customer_profiles", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["store_id", "user_id"],
                "unique_together": {("user", "store")},
            },
        ),
    ]

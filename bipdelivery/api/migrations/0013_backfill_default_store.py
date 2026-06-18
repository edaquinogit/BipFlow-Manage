from django.conf import settings
from django.db import migrations

DEFAULT_SLUG = "default"
DEFAULT_NAME = "Loja Principal"


def resolve_role(user, group_names: set[str]) -> str | None:
    """Map existing global RBAC into the new store-scoped role, highest wins."""
    if user.is_superuser or user.is_staff or "admin" in group_names:
        return "owner"
    if "manager" in group_names:
        return "manager"
    if "viewer" in group_names:
        return "viewer"
    return None


def backfill_default_store(apps, schema_editor):
    Store = apps.get_model("api", "Store")
    StoreMembership = apps.get_model("api", "StoreMembership")
    StoreSettings = apps.get_model("api", "StoreSettings")
    User = apps.get_model(settings.AUTH_USER_MODEL)

    settings_instance = StoreSettings.objects.filter(singleton_key=1).first()
    whatsapp_phone = settings_instance.whatsapp_phone if settings_instance else ""

    store, _created = Store.objects.get_or_create(
        slug=DEFAULT_SLUG,
        defaults={"name": DEFAULT_NAME, "whatsapp_phone": whatsapp_phone},
    )

    for user in User.objects.prefetch_related("groups").all():
        group_names = set(user.groups.values_list("name", flat=True))
        role = resolve_role(user, group_names)

        if role is None:
            continue

        StoreMembership.objects.get_or_create(
            store=store,
            user=user,
            defaults={"role": role},
        )


def remove_default_store(apps, schema_editor):
    Store = apps.get_model("api", "Store")
    Store.objects.filter(slug=DEFAULT_SLUG).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0012_store_foundation"),
    ]

    operations = [
        migrations.RunPython(backfill_default_store, remove_default_store),
    ]

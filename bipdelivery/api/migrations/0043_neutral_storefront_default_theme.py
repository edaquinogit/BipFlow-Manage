from django.db import migrations


OLD_DEFAULT_THEME = {
    "primary": "#05050A",
    "accent": "#D81B60",
    "background": "#FAFAFA",
    "surface": "#FFFFFF",
    "text": "#05050A",
    "muted": "#6B7280",
}

NEW_DEFAULT_THEME = {
    "primary": "#05050A",
    "accent": "#111827",
    "background": "#FAFAFA",
    "surface": "#FFFFFF",
    "text": "#05050A",
    "muted": "#6B7280",
}

OLD_SECONDARY_COLORS = {"#D81B60", "#E91E63"}
NEW_SECONDARY_COLOR = "#111827"


def _normalize_hex(value):
    normalized = str(value or "").strip()
    return normalized.upper() if normalized.startswith("#") else normalized


def _is_old_default_theme(theme):
    if not isinstance(theme, dict):
        return False

    if _normalize_hex(theme.get("accent")) != OLD_DEFAULT_THEME["accent"]:
        return False

    for key, old_value in OLD_DEFAULT_THEME.items():
        if key == "accent":
            continue

        value = _normalize_hex(theme.get(key))
        if value and value != old_value:
            return False

    return True


def _is_new_default_theme(theme):
    if not isinstance(theme, dict):
        return False

    if _normalize_hex(theme.get("accent")) != NEW_DEFAULT_THEME["accent"]:
        return False

    for key, new_value in NEW_DEFAULT_THEME.items():
        if key == "accent":
            continue

        value = _normalize_hex(theme.get(key))
        if value and value != new_value:
            return False

    return True


def apply_neutral_storefront_defaults(apps, schema_editor):
    Store = apps.get_model("api", "Store")
    StorefrontAppearance = apps.get_model("api", "StorefrontAppearance")

    for store in Store.objects.all():
        if _is_old_default_theme(store.theme):
            next_theme = dict(NEW_DEFAULT_THEME)
            store.theme = next_theme
            store.save(update_fields=["theme", "updated_at"])

    StorefrontAppearance.objects.filter(
        secondary_color__in=OLD_SECONDARY_COLORS
    ).update(secondary_color=NEW_SECONDARY_COLOR)


def restore_legacy_storefront_defaults(apps, schema_editor):
    Store = apps.get_model("api", "Store")
    StorefrontAppearance = apps.get_model("api", "StorefrontAppearance")

    for store in Store.objects.all():
        theme = store.theme
        if _is_new_default_theme(theme):
            next_theme = dict(OLD_DEFAULT_THEME)
            store.theme = next_theme
            store.save(update_fields=["theme", "updated_at"])

    StorefrontAppearance.objects.filter(secondary_color=NEW_SECONDARY_COLOR).update(
        secondary_color="#D81B60"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0042_store_display_name_storefrontappearance_font_preset"),
    ]

    operations = [
        migrations.RunPython(
            apply_neutral_storefront_defaults,
            restore_legacy_storefront_defaults,
        ),
    ]

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "bipdelivery.api"

    def ready(self) -> None:
        from . import signals  # noqa: F401

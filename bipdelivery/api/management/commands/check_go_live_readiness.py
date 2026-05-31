from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from bipdelivery.api.models import Category, DeliveryRegion, Product, StoreSettings
from bipdelivery.api.permissions import DASHBOARD_READ_ROLES, DASHBOARD_WRITE_ROLES


@dataclass(frozen=True)
class ReadinessCheck:
    """Single go-live readiness result."""

    name: str
    ok: bool
    message: str
    warning: bool = False


class Command(BaseCommand):
    """Validate the minimum operational setup required to receive real orders."""

    help = "Check whether BipFlow is ready to receive real storefront orders."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Treat warnings as failures.",
        )

    def handle(self, *args, **options) -> None:
        checks = self._build_checks()
        has_failure = False

        for check in checks:
            if check.ok:
                prefix = self.style.SUCCESS("PASS")
            elif check.warning:
                prefix = self.style.WARNING("WARN")
            else:
                prefix = self.style.ERROR("FAIL")

            self.stdout.write(f"[{prefix}] {check.name}: {check.message}")

            if not check.ok and (options["strict"] or not check.warning):
                has_failure = True

        if has_failure:
            raise CommandError("Go-live readiness checks failed.")

        self.stdout.write(self.style.SUCCESS("Go-live readiness checks passed."))

    def _build_checks(self) -> list[ReadinessCheck]:
        return [
            self._check_debug_disabled(),
            self._check_allowed_hosts(),
            self._check_csrf_trusted_origins(),
            self._check_cors_allowed_origins(),
            self._check_postgres_database(),
            self._check_redis_cache(),
            self._check_dashboard_operator(),
            self._check_store_whatsapp(),
            self._check_catalog(),
            self._check_delivery_regions(),
        ]

    def _check_debug_disabled(self) -> ReadinessCheck:
        if not settings.DEBUG:
            return ReadinessCheck("debug", True, "DJANGO_DEBUG is disabled.")

        return ReadinessCheck("debug", False, "DJANGO_DEBUG must be False before go-live.")

    def _check_allowed_hosts(self) -> ReadinessCheck:
        hosts = set(settings.ALLOWED_HOSTS)
        local_hosts = {"localhost", "127.0.0.1", "backend", "frontend"}

        if not hosts:
            return ReadinessCheck("allowed_hosts", False, "DJANGO_ALLOWED_HOSTS is empty.")

        if "*" in hosts:
            return ReadinessCheck("allowed_hosts", False, "Wildcard host is not safe for go-live.")

        if hosts <= local_hosts:
            return ReadinessCheck(
                "allowed_hosts",
                False,
                "Only local/container hosts are configured; add the production domain.",
            )

        return ReadinessCheck("allowed_hosts", True, "Production host allowlist is configured.")

    def _check_csrf_trusted_origins(self) -> ReadinessCheck:
        origins = list(getattr(settings, "CSRF_TRUSTED_ORIGINS", []))

        if not origins:
            return ReadinessCheck("csrf", False, "CSRF_TRUSTED_ORIGINS is empty.")

        if any(not origin.startswith("https://") for origin in origins):
            return ReadinessCheck(
                "csrf",
                False,
                "All go-live CSRF trusted origins must use HTTPS.",
            )

        return ReadinessCheck("csrf", True, "HTTPS CSRF trusted origins are configured.")

    def _check_cors_allowed_origins(self) -> ReadinessCheck:
        origins = list(getattr(settings, "CORS_ALLOWED_ORIGINS", []))

        if not origins:
            return ReadinessCheck("cors", False, "CORS_ALLOWED_ORIGINS is empty.")

        if any(not origin.startswith("https://") for origin in origins):
            return ReadinessCheck("cors", False, "All go-live CORS origins must use HTTPS.")

        return ReadinessCheck("cors", True, "HTTPS CORS origins are configured.")

    def _check_postgres_database(self) -> ReadinessCheck:
        engine = settings.DATABASES["default"]["ENGINE"]

        if "postgresql" not in engine:
            return ReadinessCheck(
                "database",
                False,
                "Production must use PostgreSQL.",
                warning=not getattr(settings, "IS_PRODUCTION", False),
            )

        return ReadinessCheck("database", True, "PostgreSQL database is configured.")

    def _check_redis_cache(self) -> ReadinessCheck:
        cache_backend = settings.CACHES["default"]["BACKEND"]

        if "django_redis" not in cache_backend:
            return ReadinessCheck(
                "cache",
                False,
                "Production should use Redis cache for throttling and shared state.",
                warning=not getattr(settings, "IS_PRODUCTION", False),
            )

        return ReadinessCheck("cache", True, "Redis cache is configured.")

    def _check_dashboard_operator(self) -> ReadinessCheck:
        UserModel = get_user_model()
        roles = DASHBOARD_READ_ROLES | DASHBOARD_WRITE_ROLES
        has_operator = UserModel.objects.filter(
            Q(is_staff=True) | Q(is_superuser=True) | Q(groups__name__in=roles)
        ).distinct().exists()

        if not has_operator:
            return ReadinessCheck(
                "dashboard_operator",
                False,
                "Create at least one dashboard operator before accepting orders.",
            )

        return ReadinessCheck("dashboard_operator", True, "Dashboard operator exists.")

    def _check_store_whatsapp(self) -> ReadinessCheck:
        if StoreSettings.get_configured_whatsapp_phone():
            return ReadinessCheck("store_whatsapp", True, "Store WhatsApp is configured.")

        return ReadinessCheck(
            "store_whatsapp",
            False,
            "Configure store WhatsApp in the dashboard or WHATSAPP_ORDER_PHONE.",
        )

    def _check_catalog(self) -> ReadinessCheck:
        has_category = Category.objects.exists()
        has_available_product = Product.objects.filter(
            is_available=True,
            stock_quantity__gt=0,
        ).exists()

        if not has_category:
            return ReadinessCheck("catalog", False, "Create at least one category.")

        if not has_available_product:
            return ReadinessCheck(
                "catalog",
                False,
                "Create at least one available product with stock.",
            )

        return ReadinessCheck("catalog", True, "Catalog has sellable products.")

    def _check_delivery_regions(self) -> ReadinessCheck:
        if DeliveryRegion.objects.filter(is_active=True).exists():
            return ReadinessCheck("delivery", True, "At least one active delivery region exists.")

        return ReadinessCheck(
            "delivery",
            False,
            "Create at least one active delivery region for checkout delivery.",
        )

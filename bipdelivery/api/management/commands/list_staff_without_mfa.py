from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q

from bipdelivery.api.models import TOTPDevice


class Command(BaseCommand):
    """List staff/superuser accounts without a confirmed MFA device.

    Run this before setting DJANGO_ADMIN_MFA_ENFORCED=True (see the
    SECURE_HSTS_SECONDS-adjacent ADMIN_MFA_ENFORCED comment in
    core/settings.py) -- enforcing MFA on /admin/login/ while any of these
    accounts still lack a confirmed device would lock them out.
    """

    help = "List staff/superuser accounts that do not have a confirmed MFA (TOTP) device."

    def handle(self, *args, **options) -> None:
        UserModel = get_user_model()
        confirmed_user_ids = TOTPDevice.objects.filter(confirmed=True).values_list("user_id", flat=True)

        missing = (
            UserModel.objects.filter(Q(is_staff=True) | Q(is_superuser=True))
            .exclude(id__in=confirmed_user_ids)
            .order_by("username")
        )

        if not missing.exists():
            self.stdout.write(
                self.style.SUCCESS("Every staff/superuser account has a confirmed MFA device.")
            )
            return

        self.stdout.write(
            self.style.WARNING(
                f"{missing.count()} staff/superuser account(s) without a confirmed MFA device:"
            )
        )
        for user in missing:
            role = "superuser" if user.is_superuser else "staff"
            self.stdout.write(f"  - {user.username} ({user.email or 'no email'}) [{role}]")

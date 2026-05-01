from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from bipdelivery.api.permissions import DASHBOARD_READ_ROLES, DASHBOARD_WRITE_ROLES


class Command(BaseCommand):
    """Create dashboard RBAC groups and optionally provision a development user."""

    help = "Seed dashboard RBAC groups and optionally create/update a dashboard user."

    def add_arguments(self, parser) -> None:
        dashboard_roles = sorted(DASHBOARD_READ_ROLES | DASHBOARD_WRITE_ROLES)

        parser.add_argument(
            "--email",
            help="Optional user email to create or update after seeding groups.",
        )
        parser.add_argument(
            "--password",
            help="Optional password to set for the user. Required when creating a new user.",
        )
        parser.add_argument(
            "--role",
            choices=dashboard_roles,
            default="admin",
            help="Dashboard group assigned to the optional user.",
        )
        parser.add_argument(
            "--staff",
            action="store_true",
            help="Mark the optional user as Django staff.",
        )
        parser.add_argument(
            "--superuser",
            action="store_true",
            help="Mark the optional user as Django superuser and staff.",
        )

    def handle(self, *args, **options) -> None:
        groups = self._seed_groups()

        email = (options.get("email") or "").strip().lower()
        if not email:
            self.stdout.write(self.style.SUCCESS("Dashboard RBAC groups are ready."))
            return

        user = self._create_or_update_user(
            email=email,
            password=options.get("password"),
            role=options["role"],
            staff=options["staff"],
            superuser=options["superuser"],
            groups=groups,
        )

        self.stdout.write(
            self.style.SUCCESS(f'Dashboard user "{user.email or user.username}" is ready.')
        )

    def _seed_groups(self) -> dict[str, Group]:
        roles = sorted(DASHBOARD_READ_ROLES | DASHBOARD_WRITE_ROLES)
        return {role: Group.objects.get_or_create(name=role)[0] for role in roles}

    def _create_or_update_user(
        self,
        *,
        email: str,
        password: str | None,
        role: str,
        staff: bool,
        superuser: bool,
        groups: dict[str, Group],
    ):
        UserModel = get_user_model()
        user = (
            UserModel.objects.filter(email__iexact=email).order_by("id").first()
            or UserModel.objects.filter(username=email).order_by("id").first()
        )

        if user is None:
            if not password:
                raise CommandError("Use --password when creating a new dashboard user.")
            user = UserModel.objects.create_user(username=email, email=email, password=password)
        else:
            user.email = email
            user.username = email
            if password:
                user.set_password(password)

        if superuser:
            user.is_superuser = True
            user.is_staff = True
        elif staff:
            user.is_staff = True

        user.is_active = True
        user.save()
        user.groups.add(groups[role])
        return user

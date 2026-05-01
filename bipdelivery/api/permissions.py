from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser
from rest_framework.permissions import SAFE_METHODS, BasePermission

DASHBOARD_READ_ROLES = {"admin", "manager", "viewer"}
DASHBOARD_WRITE_ROLES = {"admin", "manager"}


def get_user_roles(user: AbstractBaseUser | None) -> list[str]:
    """Return normalized dashboard roles attached to a Django user."""
    if not user or not user.is_authenticated:
        return []

    roles = set(user.groups.values_list("name", flat=True))

    if user.is_staff:
        roles.add("staff")

    if user.is_superuser:
        roles.add("superuser")

    return sorted(roles)


def has_dashboard_read_access(user: AbstractBaseUser | None) -> bool:
    """Allow dashboard data to staff users or explicit read-role members."""
    if not user or not user.is_authenticated:
        return False

    if user.is_staff or user.is_superuser:
        return True

    return bool(set(get_user_roles(user)) & DASHBOARD_READ_ROLES)


def has_dashboard_write_access(user: AbstractBaseUser | None) -> bool:
    """Allow catalog/freight mutations to staff users or write-role members."""
    if not user or not user.is_authenticated:
        return False

    if user.is_staff or user.is_superuser:
        return True

    return bool(set(get_user_roles(user)) & DASHBOARD_WRITE_ROLES)


class AllowAnyReadDashboardWrite(BasePermission):
    """
    Public reads remain open, but mutations require a dashboard write role.

    Accepted write roles:
    - Django staff/superuser
    - group admin
    - group manager
    """

    message = "Voce nao possui permissao administrativa para alterar este recurso."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True

        return has_dashboard_write_access(request.user)


class IsDashboardReadRole(BasePermission):
    """Require an authenticated dashboard role for private dashboard data."""

    message = "Voce nao possui permissao para acessar dados administrativos."

    def has_permission(self, request, view) -> bool:
        return has_dashboard_read_access(request.user)

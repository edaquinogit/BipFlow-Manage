from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser
from rest_framework.permissions import SAFE_METHODS, BasePermission

DASHBOARD_READ_ROLES = {"admin", "manager", "viewer"}
DASHBOARD_WRITE_ROLES = {"admin", "manager"}

# Roles within a StoreMembership row (Etapa 4) that grant dashboard write
# access. A membership of any role grants read access.
STORE_WRITE_ROLES = {"owner", "manager"}


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
    """Allow dashboard data to staff users, global read-role members, or store members.

    The StoreMembership check (Etapa 4) is additive: a self-registered
    store owner has no Django group at all, only a membership row, so
    without it they could create their own store and then get bounced
    from their own dashboard.
    """
    if not user or not user.is_authenticated:
        return False

    if user.is_staff or user.is_superuser:
        return True

    if set(get_user_roles(user)) & DASHBOARD_READ_ROLES:
        return True

    return user.store_memberships.exists()


def has_dashboard_write_access(user: AbstractBaseUser | None) -> bool:
    """Allow catalog/freight mutations to staff users, global write-role members, or store managers/owners."""
    if not user or not user.is_authenticated:
        return False

    if user.is_staff or user.is_superuser:
        return True

    if set(get_user_roles(user)) & DASHBOARD_WRITE_ROLES:
        return True

    return user.store_memberships.filter(role__in=STORE_WRITE_ROLES).exists()


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


class DashboardReadWritePermission(BasePermission):
    """Allow dashboard readers to view settings and writers to mutate them."""

    message = "Voce nao possui permissao administrativa para alterar este recurso."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return has_dashboard_read_access(request.user)

        return has_dashboard_write_access(request.user)

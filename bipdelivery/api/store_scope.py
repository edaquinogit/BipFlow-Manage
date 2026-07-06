"""Request-scoped tenant resolution for the multi-tenant evolution.

Single chokepoint for "which store does this request belong to": public
requests resolve by the `X-Store-Slug` header; authenticated requests trust
the JWT's `store_id` claim by default but may switch to a different store
via the same header (Etapa 4's store switcher) -- only ever to a store the
user actually belongs to, or to any store at all for staff/superusers.
Every path falls back to the single default store, so today's behaviour --
and every public link issued before this landed -- keeps working unchanged.
"""
from .models import CustomerProfile, Store, StoreMembership


def _claim(token, key: str):
    """Read a claim from a simplejwt token, or a plain dict in tests."""
    if token is None:
        return None
    try:
        return token[key]
    except (KeyError, TypeError):
        return None


def _user_belongs_to(user, store: Store) -> bool:
    """Whether `user` may act as `store` -- staff/superusers always may.

    Checks both dashboard membership and storefront customer profiles
    (see docs/architecture/customer-profile-checkout-evolution.md) --
    without the second check, an authenticated customer sending their own
    store's `X-Store-Slug` would be treated as an unrelated tenant and
    silently fall back to the default store.

    The CustomerProfile check is deliberately skipped entirely when the
    user has a StoreMembership *anywhere* (any store, not just this one).
    Dashboard permission helpers (`has_dashboard_read_access` et al. in
    permissions.py) only check "does this user have some StoreMembership",
    never "at the resolved store" -- so without this guard, a dashboard
    user who also happens to be a customer at a different store could send
    that store's slug in the header, have this function honor it via the
    CustomerProfile branch, and land `resolve_request_store()` on a store
    they have no dashboard relationship with at all, while the
    store-agnostic permission check still passes. Real cross-tenant leak,
    caught in review before this shipped -- see
    docs/architecture/customer-profile-checkout-evolution.md.
    """
    if user.is_staff or user.is_superuser:
        return True

    if StoreMembership.objects.filter(user=user, store=store).exists():
        return True

    if StoreMembership.objects.filter(user=user).exists():
        return False

    return CustomerProfile.objects.filter(user=user, store=store).exists()


def resolve_request_store(request) -> Store:
    """Resolve the tenant for any request. The only place this decision is made."""
    user = getattr(request, "user", None)
    slug = request.headers.get("X-Store-Slug")

    if user is not None and getattr(user, "is_authenticated", False):
        if slug:
            requested_store = Store.objects.filter(slug=slug, is_active=True).first()
            if requested_store is not None and _user_belongs_to(user, requested_store):
                return requested_store
            # The header named a store the user doesn't belong to: ignore it
            # rather than honoring an unrelated tenant -- the exact leak
            # Etapa 3 closed -- and fall through to the JWT claim instead.

        store_id = _claim(getattr(request, "auth", None), "store_id")
        if store_id:
            store = Store.objects.filter(id=store_id, is_active=True).first()
            if store is not None:
                return store
        return Store.get_default()

    if slug:
        store = Store.objects.filter(slug=slug, is_active=True).first()
        if store is not None:
            return store

    return Store.get_default()


class StoreScopedViewSetMixin:
    """Scope every queryset this viewset returns to the resolved tenant.

    The single chokepoint that prevents cross-tenant leakage: subclasses
    keep their own filtering logic in `get_base_queryset()`, but DRF only
    ever calls this class's `get_queryset()`, so a future endpoint that
    forgets to filter by store still cannot leak another tenant's rows.
    """

    def get_request_store(self) -> Store:
        return resolve_request_store(self.request)

    def get_base_queryset(self):
        raise NotImplementedError("Subclasses must implement get_base_queryset().")

    def get_queryset(self):
        return self.get_base_queryset().filter(store=self.get_request_store())

    def perform_create(self, serializer) -> None:
        serializer.save(store=self.get_request_store())

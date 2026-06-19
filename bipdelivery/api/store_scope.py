"""Request-scoped tenant resolution for the multi-tenant evolution.

Single chokepoint for "which store does this request belong to": public
requests resolve by the `X-Store-Slug` header; authenticated requests trust
the JWT's `store_id` claim by default but may switch to a different store
via the same header (Etapa 4's store switcher) -- only ever to a store the
user actually belongs to, or to any store at all for staff/superusers.
Every path falls back to the single default store, so today's behaviour --
and every public link issued before this landed -- keeps working unchanged.
"""
from .models import Store, StoreMembership


def _claim(token, key: str):
    """Read a claim from a simplejwt token, or a plain dict in tests."""
    if token is None:
        return None
    try:
        return token[key]
    except (KeyError, TypeError):
        return None


def _user_belongs_to(user, store: Store) -> bool:
    """Whether `user` may act as `store` -- staff/superusers always may."""
    if user.is_staff or user.is_superuser:
        return True

    return StoreMembership.objects.filter(user=user, store=store).exists()


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

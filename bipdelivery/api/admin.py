from django.contrib import admin

from . import admin_auth  # noqa: F401  -- installs the MFA-gated admin login form
from .models import (
    BotConversation,
    BotMessage,
    Category,
    CustomerProfile,
    DeliveryRegion,
    LoginAttempt,
    MFABackupCode,
    Product,
    SaleOrder,
    SaleOrderItem,
    Store,
    StoreMembership,
    StoreSettings,
    TOTPDevice,
)


class StoreScopedAdminMixin:
    """Restrict a store-scoped model's admin to the staff member's own stores (Etapa 4).

    Superusers keep full cross-tenant visibility (administrative override,
    consistent with how permissions.py already treats them); other staff
    only see rows belonging to a store they hold a StoreMembership in.
    """

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(store__memberships__user=request.user).distinct()

    def save_model(self, request, obj, form, change):
        if not change and not obj.store_id and not request.user.is_superuser:
            membership = (
                StoreMembership.objects.filter(user=request.user).select_related("store").first()
            )
            if membership is not None:
                obj.store = membership.store

        super().save_model(request, obj, form, change)


@admin.register(Category)
class CategoryAdmin(StoreScopedAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "store")
    list_filter = ("store",)


@admin.register(Product)
class ProductAdmin(StoreScopedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "store", "category", "price", "is_available")
    list_filter = ("store", "category", "is_available")
    search_fields = ("name", "description")


@admin.register(DeliveryRegion)
class DeliveryRegionAdmin(StoreScopedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "store", "city", "delivery_fee", "is_active")
    list_filter = ("store", "is_active", "city")
    search_fields = ("name", "city", "neighborhoods")


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "tagline", "is_active", "owner")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(memberships__user=request.user).distinct()


@admin.register(StoreMembership)
class StoreMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "user", "role")
    list_filter = ("role", "store")
    search_fields = ("user__username", "user__email")


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "user", "full_name", "phone", "city")
    list_filter = ("store",)
    search_fields = ("user__username", "user__email", "full_name", "phone", "city")


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "whatsapp_phone", "updated_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("identifier", "succeeded", "failure_reason", "ip_address", "user", "created_at")
    list_filter = ("succeeded", "failure_reason", "created_at")
    search_fields = ("identifier", "ip_address", "user__username", "user__email")
    readonly_fields = (
        "user", "identifier", "ip_address", "user_agent", "succeeded",
        "failure_reason", "store_id", "created_at",
    )

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


@admin.register(TOTPDevice)
class TOTPDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "confirmed", "created_at", "confirmed_at")
    list_filter = ("confirmed",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("user", "confirmed", "created_at", "confirmed_at")
    # has_change_permission below makes every field read-only-rendered
    # regardless of readonly_fields, so the ciphertext would otherwise still
    # render on the detail page for any staff with view permission -- not
    # plaintext, but no reason to show it at all.
    exclude = ("encrypted_secret",)

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


@admin.register(MFABackupCode)
class MFABackupCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "used_at", "created_at")
    list_filter = ("used_at",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("user", "used_at", "created_at")
    exclude = ("code_hash",)

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False


class BotMessageInline(admin.TabularInline):
    model = BotMessage
    extra = 0
    readonly_fields = ("role", "content", "intent", "metadata", "created_at")
    can_delete = False


@admin.register(BotConversation)
class BotConversationAdmin(admin.ModelAdmin):
    list_display = ("session_id", "channel", "status", "last_intent", "updated_at")
    list_filter = ("channel", "status", "last_intent", "created_at")
    search_fields = ("session_id", "customer_phone", "messages__content")
    readonly_fields = ("session_id", "created_at", "updated_at")
    inlines = [BotMessageInline]


class SaleOrderItemInline(admin.TabularInline):
    model = SaleOrderItem
    extra = 0
    readonly_fields = ("product", "product_name", "sku", "quantity", "unit_price", "line_total")
    can_delete = False


@admin.register(SaleOrder)
class SaleOrderAdmin(StoreScopedAdminMixin, admin.ModelAdmin):
    list_display = ("order_reference", "store", "customer_name", "total", "status", "created_at")
    list_filter = ("store", "status", "delivery_method", "payment_method", "created_at")
    search_fields = ("order_reference", "customer_name", "customer_phone", "items__product_name")
    readonly_fields = ("order_reference", "created_at", "updated_at")
    inlines = [SaleOrderItemInline]

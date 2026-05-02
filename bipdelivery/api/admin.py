from django.contrib import admin
from .models import Category, DeliveryRegion, Product, SaleOrder, SaleOrderItem, StoreSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "is_available")
    list_filter = ("category", "is_available")
    search_fields = ("name", "description")


@admin.register(DeliveryRegion)
class DeliveryRegionAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "delivery_fee", "is_active")
    list_filter = ("is_active", "city")
    search_fields = ("name", "city", "neighborhoods")


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "whatsapp_phone", "updated_at")
    readonly_fields = ("created_at", "updated_at")


class SaleOrderItemInline(admin.TabularInline):
    model = SaleOrderItem
    extra = 0
    readonly_fields = ("product", "product_name", "sku", "quantity", "unit_price", "line_total")
    can_delete = False


@admin.register(SaleOrder)
class SaleOrderAdmin(admin.ModelAdmin):
    list_display = ("order_reference", "customer_name", "total", "status", "created_at")
    list_filter = ("status", "delivery_method", "payment_method", "created_at")
    search_fields = ("order_reference", "customer_name", "customer_phone", "items__product_name")
    readonly_fields = ("order_reference", "created_at", "updated_at")
    inlines = [SaleOrderItemInline]

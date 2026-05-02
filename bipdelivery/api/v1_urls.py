from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    CheckoutWhatsAppView,
    DeliveryRegionViewSet,
    ProductViewSet,
    SaleOrderViewSet,
    StoreSettingsView,
)

# 🛰️ ROUTER CONFIGURATION
# Usamos o DefaultRouter para gerar automaticamente as rotas de CRUD
router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"delivery-regions", DeliveryRegionViewSet, basename="delivery-region")
router.register(r"sales-orders", SaleOrderViewSet, basename="sales-order")

urlpatterns = [
    # Injeta todas as rotas geradas pelo roteador
    path("checkout/whatsapp/", CheckoutWhatsAppView.as_view(), name="checkout-whatsapp"),
    path("store-settings/", StoreSettingsView.as_view(), name="store-settings"),
    path("", include(router.urls)),
]

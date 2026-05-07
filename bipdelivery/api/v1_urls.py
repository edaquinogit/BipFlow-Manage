from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BotConversationViewSet,
    BotMessageView,
    CategoryViewSet,
    CheckoutWhatsAppView,
    DeliveryRegionViewSet,
    ProductViewSet,
    PublicStoreSettingsView,
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
router.register(r"bot-conversations", BotConversationViewSet, basename="bot-conversation")

urlpatterns = [
    # Injeta todas as rotas geradas pelo roteador
    path("bot/messages/", BotMessageView.as_view(), name="bot-message"),
    path("checkout/whatsapp/", CheckoutWhatsAppView.as_view(), name="checkout-whatsapp"),
    path("store-settings/public/", PublicStoreSettingsView.as_view(), name="public-store-settings"),
    path("store-settings/", StoreSettingsView.as_view(), name="store-settings"),
    path("", include(router.urls)),
]

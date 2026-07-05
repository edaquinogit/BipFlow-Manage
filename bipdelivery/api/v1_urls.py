from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .pdv import PdvSaleView
from .views import (
    BotConversationViewSet,
    BotMessageView,
    CategoryViewSet,
    CheckoutWhatsAppView,
    CurrentStoreView,
    DeliveryRegionViewSet,
    MyStoreDetailView,
    MyStoresView,
    ProductViewSet,
    PublicStoreSettingsView,
    SaleOrderViewSet,
    StockMovementViewSet,
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
router.register(r"stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = [
    # Injeta todas as rotas geradas pelo roteador
    path("bot/messages/", BotMessageView.as_view(), name="bot-message"),
    path("checkout/whatsapp/", CheckoutWhatsAppView.as_view(), name="checkout-whatsapp"),
    path("pdv/sales/", PdvSaleView.as_view(), name="pdv-sale"),
    path("store/current/", CurrentStoreView.as_view(), name="store-current"),
    path("store/mine/", MyStoresView.as_view(), name="store-mine"),
    path("store/mine/<slug:slug>/", MyStoreDetailView.as_view(), name="store-mine-detail"),
    path("store-settings/public/", PublicStoreSettingsView.as_view(), name="public-store-settings"),
    path("store-settings/", StoreSettingsView.as_view(), name="store-settings"),
    path("", include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, CheckoutWhatsAppView, ProductViewSet

# 🛰️ ROUTER CONFIGURATION
# Usamos o DefaultRouter para gerar automaticamente as rotas de CRUD
router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")
router.register(r"categories", CategoryViewSet, basename="category")

urlpatterns = [
    # Injeta todas as rotas geradas pelo roteador
    path("checkout/whatsapp/", CheckoutWhatsAppView.as_view(), name="checkout-whatsapp"),
    path("", include(router.urls)),
]

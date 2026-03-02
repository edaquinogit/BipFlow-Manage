from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CategoryViewSet # <-- Adicione CategoryViewSet aqui

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet) # <-- Esta é a linha mágica!

urlpatterns = [
    path('', include(router.urls)),
]
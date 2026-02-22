from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from .views import (
    CategoryListCreateView, ProductListCreateView,
    CategoryDetailView, ProductDetailView
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('products/', ProductListCreateView.as_view(), name='product-list'),
    
    # Estas são as linhas que faltam para o "Product 1" funcionar:
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

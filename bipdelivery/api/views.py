from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD operations on Product instances.

    Provides standard REST endpoints:
    - GET /products/ - List all products (paginated)
    - POST /products/ - Create new product
    - GET /products/{id}/ - Retrieve specific product
    - PUT /products/{id}/ - Update product
    - DELETE /products/{id}/ - Delete product

    Authentication: Required (JWT token)
    Permissions: IsAuthenticated
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD operations on Category instances.

    Used primarily for dropdown/selection options in product management.

    Provides standard REST endpoints:
    - GET /categories/ - List all categories
    - POST /categories/ - Create new category
    - GET /categories/{id}/ - Retrieve specific category
    - PUT /categories/{id}/ - Update category
    - DELETE /categories/{id}/ - Delete category

    Authentication: Required (JWT token)
    Permissions: IsAuthenticated
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

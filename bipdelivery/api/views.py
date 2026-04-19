from django.db.models import Q
from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD operations on Product instances.

    Provides standard REST endpoints with advanced filtering capabilities:
    - GET /products/ - List all products (requires JWT authentication)
    - GET /products/?search=term - Search by name, SKU, or description
    - GET /products/?category=id - Filter by category
    - GET /products/?search=term&category=id - Combined filters
    - POST /products/ - Create new product (requires JWT authentication)
    - GET /products/{id}/ - Retrieve specific product (requires JWT authentication)
    - PUT /products/{id}/ - Update product (requires JWT authentication)
    - DELETE /products/{id}/ - Delete product (requires JWT authentication)

    Query Parameters:
    - search: Partial match on name, SKU, or description (case-insensitive)
    - category: Filter by category ID or slug
    - in_stock: Boolean filter for availability (true/false)
    - min_price: Minimum price filter
    - max_price: Maximum price filter

    Permissions: IsAuthenticated
    - All operations require valid JWT token

    Performance:
    - Uses select_related() for category to prevent N+1 queries
    - Implements efficient filtering with database-level lookups
    - Supports pagination out-of-the-box via DRF defaults
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Override get_queryset to apply filtering and optimization.

        Implements server-side filtering for:
        - Text search (name, SKU, description)
        - Category filtering
        - Availability filtering
        - Price range filtering

        Returns:
            QuerySet: Optimized queryset with filters and select_related()
        """
        queryset = Product.objects.select_related('category')

        # 🔍 TEXT SEARCH: Search in name, SKU, and description
        search_term = self.request.query_params.get('search', '').strip()
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term) |
                Q(sku__icontains=search_term) |
                Q(description__icontains=search_term)
            )

        # 🏷️ CATEGORY FILTER: By ID or slug
        category_filter = self.request.query_params.get('category', '').strip()
        if category_filter:
            # Try to match by ID first, then by slug
            try:
                category_id = int(category_filter)
                queryset = queryset.filter(category_id=category_id)
            except ValueError:
                # If not an integer, try slug
                queryset = queryset.filter(category__slug=category_filter)

        # 📊 STOCK AVAILABILITY FILTER
        in_stock_param = self.request.query_params.get('in_stock', '').lower()
        if in_stock_param in ('true', '1', 'yes'):
            queryset = queryset.filter(is_available=True, stock_quantity__gt=0)
        elif in_stock_param in ('false', '0', 'no'):
            queryset = queryset.filter(Q(is_available=False) | Q(stock_quantity=0))

        # 💰 PRICE RANGE FILTERS
        min_price = self.request.query_params.get('min_price')
        if min_price:
            try:
                queryset = queryset.filter(price__gte=float(min_price))
            except ValueError:
                pass  # Invalid price format, skip

        max_price = self.request.query_params.get('max_price')
        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except ValueError:
                pass  # Invalid price format, skip

        return queryset

    def get_serializer(self, *args, **kwargs):
        """
        Return serializer instance with partial=True for update operations.

        Allows partial field updates for PUT/PATCH requests.
        Ensures request context is passed to serializer for absolute URL generation.
        """
        if self.request.method in ('PUT', 'PATCH'):
            kwargs['partial'] = True
        kwargs['context'] = {'request': self.request}
        return super().get_serializer(*args, **kwargs)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD operations on Category instances.

    Used primarily for dropdown/selection options in product management.

    Provides standard REST endpoints:
    - GET /categories/ - List all categories (requires JWT authentication)
    - POST /categories/ - Create new category (requires JWT authentication)
    - GET /categories/{id}/ - Retrieve specific category (requires JWT authentication)
    - PUT /categories/{id}/ - Update category (requires JWT authentication)
    - DELETE /categories/{id}/ - Delete category (requires JWT authentication)

    Permissions: IsAuthenticated
    - All operations require valid JWT token
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        """
        Delete category with protection for referenced products.

        Returns 400 Bad Request if category has related products (on_delete=PROTECT).
        """
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete category because it has related products."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

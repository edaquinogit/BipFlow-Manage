from decimal import Decimal
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Product
from .pagination import ProductListPagination, StandardPagination
from .serializers import (
    CategorySerializer,
    CheckoutRequestSerializer,
    CheckoutResponseSerializer,
    ProductSerializer,
)


class AllowAnyReadIsAuthenticatedWrite(BasePermission):
    """
    Custom permission:
    - Allows anonymous GET (list, retrieve)
    - Requires authentication for POST, PUT, PATCH, DELETE

    Perfect for public product catalogs where users can browse
    but only authenticated users can modify.
    """

    def has_permission(self, request, view):
        # Allow anonymous users to read (GET, HEAD, OPTIONS)
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        # Require authentication for mutations (POST, PUT, PATCH, DELETE)
        return bool(request.user and request.user.is_authenticated)


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CRUD operations on Product instances.

    Provides standard REST endpoints with advanced filtering capabilities:
    - GET /products/ - List all products (public, no auth required)
    - GET /products/?search=term - Search by name, SKU, or description (public)
    - GET /products/?category=id - Filter by category (public)
    - GET /products/?search=term&category=id - Combined filters (public)
    - POST /products/ - Create new product (requires JWT authentication)
    - GET /products/{id}/ - Retrieve specific product (public, no auth required)
    - PUT /products/{id}/ - Update product (requires JWT authentication)
    - DELETE /products/{id}/ - Delete product (requires JWT authentication)

    Query Parameters:
    - search: Partial match on name, SKU, or description (case-insensitive)
    - category: Filter by category ID or slug
    - in_stock: Boolean filter for availability (true/false)
    - min_price: Minimum price filter
    - max_price: Maximum price filter

    Permissions: AllowAnyReadIsAuthenticatedWrite
    - GET requests: Anyone (authenticated or anonymous)
    - POST, PUT, PATCH, DELETE: Authenticated users only

    Performance:
    - Uses select_related() for category to prevent N+1 queries
    - Implements efficient filtering with database-level lookups
    - Supports pagination out-of-the-box via DRF defaults
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [AllowAnyReadIsAuthenticatedWrite]
    pagination_class = ProductListPagination

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

    @action(detail=False, methods=['patch'])
    def bulk_update_category(self, request):
        """
        Bulk update category for multiple products.

        Accepts a JSON payload with:
        - product_ids: List of product IDs to update
        - new_category_id: ID of the new category

        Uses atomic transaction to ensure data integrity.
        Returns updated product count and details.

        Payload Example:
        {
            "product_ids": [1, 2, 5],
            "new_category_id": 3
        }

        Response Example:
        {
            "updated_count": 3,
            "updated_products": [1, 2, 5],
            "new_category": {"id": 3, "name": "Electronics"}
        }
        """
        product_ids = request.data.get('product_ids', [])
        new_category_id = request.data.get('new_category_id')

        # Input validation
        if not product_ids or not isinstance(product_ids, list):
            return Response(
                {"detail": "product_ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not new_category_id:
            return Response(
                {"detail": "new_category_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_category_id = int(new_category_id)
        except (ValueError, TypeError):
            return Response(
                {"detail": "new_category_id must be a valid integer"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate category exists
        try:
            new_category = Category.objects.get(id=new_category_id)
        except Category.DoesNotExist:
            return Response(
                {"detail": f"Category with id {new_category_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert product_ids to integers and validate
        try:
            product_ids = [int(pid) for pid in product_ids]
        except (ValueError, TypeError):
            return Response(
                {"detail": "All product_ids must be valid integers"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use atomic transaction for data integrity
        with transaction.atomic():
            # Get products that exist and belong to current user (if needed)
            # Note: Since we're using IsAuthenticated permission, all products are accessible
            products_to_update = Product.objects.filter(id__in=product_ids)

            # Check if all requested products exist
            found_ids = set(products_to_update.values_list('id', flat=True))
            missing_ids = set(product_ids) - found_ids

            if missing_ids:
                return Response(
                    {"detail": f"Products with ids {list(missing_ids)} do not exist"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Perform bulk update using QuerySet.update() for efficiency
            update_count = products_to_update.update(category_id=new_category_id)

            return Response({
                "updated_count": update_count,
                "updated_products": product_ids,
                "new_category": {
                    "id": new_category.id,
                    "name": new_category.name,
                    "slug": new_category.slug
                }
            }, status=status.HTTP_200_OK)

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
    - GET /categories/ - List all categories (public, no auth required)
    - POST /categories/ - Create new category (requires JWT authentication)
    - GET /categories/{id}/ - Retrieve specific category (public, no auth required)
    - PUT /categories/{id}/ - Update category (requires JWT authentication)
    - DELETE /categories/{id}/ - Delete category (requires JWT authentication)

    Permissions: AllowAnyReadIsAuthenticatedWrite
    - GET requests: Anyone (authenticated or anonymous)
    - POST, PUT, PATCH, DELETE: Authenticated users only
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAnyReadIsAuthenticatedWrite]
    pagination_class = StandardPagination

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


class CheckoutWhatsAppView(APIView):
    """
    Prepare a checkout note and WhatsApp redirect for the public catalog.

    This endpoint validates the cart server-side, recalculates totals and
    returns a formatted order message ready to be shared with the configured
    WhatsApp sales number.
    """

    permission_classes = []
    authentication_classes = []

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        return ''.join(character for character in phone if character.isdigit())

    @staticmethod
    def _payment_label(payment_method: str) -> str:
        return {
            'pix': 'Pix',
            'card': 'Cartao',
            'cash': 'Dinheiro',
        }.get(payment_method, payment_method)

    @staticmethod
    def _delivery_label(delivery_method: str) -> str:
        return 'Delivery' if delivery_method == 'delivery' else 'Retirada'

    def post(self, request, *args, **kwargs):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        cart_items = validated_data['items']
        customer = validated_data['customer']
        product_ids = [item['product_id'] for item in cart_items]

        products = Product.objects.select_related('category').filter(id__in=product_ids)
        products_by_id = {product.id: product for product in products}
        missing_ids = [product_id for product_id in product_ids if product_id not in products_by_id]

        if missing_ids:
            raise serializers.ValidationError({
                'items': [f'Products not found: {", ".join(str(product_id) for product_id in missing_ids)}']
            })

        normalized_items = []
        subtotal = Decimal('0.00')

        for item in cart_items:
            product = products_by_id[item['product_id']]
            quantity = item['quantity']

            if not product.is_available or product.stock_quantity <= 0:
                raise serializers.ValidationError({
                    'items': [f'Product "{product.name}" is currently unavailable']
                })

            if quantity > product.stock_quantity:
                raise serializers.ValidationError({
                    'items': [
                        f'Requested quantity for "{product.name}" exceeds available stock ({product.stock_quantity})'
                    ]
                })

            unit_price = Decimal(product.price)
            line_total = unit_price * quantity
            subtotal += line_total

            normalized_items.append({
                'product_id': product.id,
                'product_name': product.name,
                'sku': product.sku or '',
                'quantity': quantity,
                'unit_price': unit_price.quantize(Decimal('0.01')),
                'line_total': line_total.quantize(Decimal('0.01')),
            })

        delivery_fee = (
            settings.ORDER_DELIVERY_FEE
            if customer['delivery_method'] == 'delivery'
            else Decimal('0.00')
        )
        total = subtotal + delivery_fee

        order_reference = timezone.localtime().strftime('BPF-%Y%m%d-%H%M%S')
        customer_name = customer['full_name'].strip()
        customer_phone = customer['phone'].strip()
        customer_email = customer.get('email', '').strip()
        notes = customer.get('notes', '').strip()

        message_lines = [
            'Pedido BipFlow',
            f'Referencia: {order_reference}',
            '',
            'Itens do pedido:',
            *[
                (
                    f'{index + 1}. {item["product_name"]} '
                    f'x{item["quantity"]} - R$ {item["line_total"]:.2f}'
                )
                for index, item in enumerate(normalized_items)
            ],
            '',
            f'Subtotal: R$ {subtotal:.2f}',
            f'Entrega: R$ {delivery_fee:.2f}',
            f'Total: R$ {total:.2f}',
            '',
            f'Cliente: {customer_name}',
            f'WhatsApp: {customer_phone}',
            f'Email: {customer_email or "Nao informado"}',
            f'Entrega: {self._delivery_label(customer["delivery_method"])}',
            f'Pagamento: {self._payment_label(customer["payment_method"])}',
        ]

        if customer['delivery_method'] == 'delivery':
            message_lines.extend([
                f'Endereco: {customer["address"].strip()}',
                f'Bairro: {customer["neighborhood"].strip()}',
                f'Cidade: {customer["city"].strip()}',
            ])

        if notes:
            message_lines.append(f'Observacoes: {notes}')

        message = '\n'.join(message_lines)
        whatsapp_phone = self._normalize_phone(settings.WHATSAPP_ORDER_PHONE)
        whatsapp_url = (
            f'https://wa.me/{whatsapp_phone}?text={quote(message)}'
            if whatsapp_phone
            else ''
        )

        response_payload = {
            'order_reference': order_reference,
            'items': normalized_items,
            'customer': {
                'full_name': customer_name,
                'phone': customer_phone,
                'email': customer_email,
                'delivery_method': customer['delivery_method'],
                'payment_method': customer['payment_method'],
                'address': customer.get('address', '').strip(),
                'neighborhood': customer.get('neighborhood', '').strip(),
                'city': customer.get('city', '').strip(),
                'notes': notes,
            },
            'subtotal': subtotal.quantize(Decimal('0.01')),
            'delivery_fee': delivery_fee.quantize(Decimal('0.01')),
            'total': total.quantize(Decimal('0.01')),
            'message': message,
            'whatsapp_url': whatsapp_url,
        }

        output_serializer = CheckoutResponseSerializer(data=response_payload)
        output_serializer.is_valid(raise_exception=True)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

from decimal import Decimal
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .bot_engine import build_bot_reply
from .errors import business_logic_error, not_found_error, validation_error
from .models import Category, DeliveryRegion, Product, SaleOrder, SaleOrderItem, StoreSettings
from .pagination import ProductListPagination, StandardPagination
from .permissions import (
    AllowAnyReadDashboardWrite,
    DashboardReadWritePermission,
    IsDashboardReadRole,
    has_dashboard_read_access,
)
from .serializers import (
    BotMessageRequestSerializer,
    BotMessageResponseSerializer,
    CategorySerializer,
    CheckoutRequestSerializer,
    CheckoutResponseSerializer,
    CurrentUserSerializer,
    DeliveryRegionSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProductSerializer,
    RegisterUserSerializer,
    SaleOrderSerializer,
    StoreSettingsSerializer,
)
from .throttling import (
    AuthIpThrottle,
    BotMessageIpThrottle,
    CheckoutIpThrottle,
    CheckoutPhoneThrottle,
    LoginIdentityThrottle,
    PasswordResetConfirmIdentityThrottle,
    PasswordResetIdentityThrottle,
    RegistrationIdentityThrottle,
    TokenRefreshIdentityThrottle,
    TokenRefreshIpThrottle,
)

User = get_user_model()


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

    Permissions: AllowAnyReadDashboardWrite
    - GET requests: Anyone (authenticated or anonymous)
    - POST, PUT, PATCH, DELETE: staff, superuser, admin or manager role only

    Performance:
    - Uses select_related() for category to prevent N+1 queries
    - Implements efficient filtering with database-level lookups
    - Supports pagination out-of-the-box via DRF defaults
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [AllowAnyReadDashboardWrite]
    pagination_class = ProductListPagination

    def get_object(self):
        """
        Support standard lookup by ID while keeping queryset optimizations.
        """
        return super().get_object()

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
        queryset = Product.objects.select_related("category").prefetch_related("gallery_images")

        # 🔍 TEXT SEARCH: Search in name, SKU, and description
        search_term = self.request.query_params.get("search", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(sku__icontains=search_term)
                | Q(description__icontains=search_term)
            )

        # 🏷️ CATEGORY FILTER: By ID or slug
        category_filter = self.request.query_params.get("category", "").strip()
        if category_filter:
            # Try to match by ID first, then by slug
            try:
                category_id = int(category_filter)
                queryset = queryset.filter(category_id=category_id)
            except ValueError:
                # If not an integer, try slug
                queryset = queryset.filter(category__slug=category_filter)

        # 📊 STOCK AVAILABILITY FILTER
        in_stock_param = self.request.query_params.get("in_stock", "").lower()
        if in_stock_param in ("true", "1", "yes"):
            queryset = queryset.filter(is_available=True, stock_quantity__gt=0)
        elif in_stock_param in ("false", "0", "no"):
            queryset = queryset.filter(Q(is_available=False) | Q(stock_quantity=0))

        # 💰 PRICE RANGE FILTERS
        min_price = self.request.query_params.get("min_price")
        if min_price:
            try:
                queryset = queryset.filter(price__gte=float(min_price))
            except ValueError:
                pass  # Invalid price format, skip

        max_price = self.request.query_params.get("max_price")
        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except ValueError:
                pass  # Invalid price format, skip

        return queryset

    @action(detail=False, methods=["get"], url_path=r"by-slug/(?P<slug>[^/]+)")
    def by_slug(self, request, slug=None):
        """
        Retrieve a public product detail payload by slug.

        This keeps public storefront links stable and shareable without
        exposing implementation details such as numeric IDs in the URL.
        """
        product = self.get_queryset().filter(slug=slug).first()

        if product is None:
            raise NotFound(detail="Produto nao encontrado.")

        serializer = self.get_serializer(product)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch"])
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
        product_ids = request.data.get("product_ids", [])
        new_category_id = request.data.get("new_category_id")

        # Input validation
        if not product_ids or not isinstance(product_ids, list):
            return validation_error("product_ids deve ser uma lista não vazia.")

        if not new_category_id:
            return validation_error("new_category_id é obrigatório.")

        try:
            new_category_id = int(new_category_id)
        except (ValueError, TypeError):
            return validation_error("new_category_id deve ser um número inteiro válido.")

        # Validate category exists
        try:
            new_category = Category.objects.get(id=new_category_id)
        except Category.DoesNotExist:
            return not_found_error(f"Categoria com id {new_category_id} não existe.")

        # Convert product_ids to integers and validate
        try:
            product_ids = [int(pid) for pid in product_ids]
        except (ValueError, TypeError):
            return validation_error("Todos os product_ids devem ser números inteiros válidos.")

        # Use atomic transaction for data integrity
        with transaction.atomic():
            # Get products that exist and belong to current user (if needed)
            # Note: Since we're using IsAuthenticated permission, all products are accessible
            products_to_update = Product.objects.filter(id__in=product_ids)

            # Check if all requested products exist
            found_ids = set(products_to_update.values_list("id", flat=True))
            missing_ids = set(product_ids) - found_ids

            if missing_ids:
                return business_logic_error(
                    f'Produtos não encontrados: {", ".join(str(pid) for pid in missing_ids)}'
                )

            # Perform bulk update using QuerySet.update() for efficiency
            update_count = products_to_update.update(category_id=new_category_id)

            return Response(
                {
                    "updated_count": update_count,
                    "updated_products": product_ids,
                    "new_category": {
                        "id": new_category.id,
                        "name": new_category.name,
                        "slug": new_category.slug,
                    },
                },
                status=status.HTTP_200_OK,
            )

    def get_serializer(self, *args, **kwargs):
        """
        Return serializer instance with partial=True for update operations.

        Allows partial field updates for PUT/PATCH requests.
        Ensures request context is passed to serializer for absolute URL generation.
        """
        if self.request.method in ("PUT", "PATCH"):
            kwargs["partial"] = True
        kwargs["context"] = {"request": self.request}
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

    Permissions: AllowAnyReadDashboardWrite
    - GET requests: Anyone (authenticated or anonymous)
    - POST, PUT, PATCH, DELETE: staff, superuser, admin or manager role only
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAnyReadDashboardWrite]
    pagination_class = StandardPagination

    def destroy(self, request, *args, **kwargs):
        """
        Delete category with protection for referenced products.

        Returns standardized error response if category has related products.
        """
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return business_logic_error(
                "Não é possível excluir categoria porque ela possui produtos relacionados."
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeliveryRegionViewSet(viewsets.ModelViewSet):
    """Manage delivery pricing by region while exposing active regions publicly."""

    serializer_class = DeliveryRegionSerializer
    permission_classes = [AllowAnyReadDashboardWrite]
    pagination_class = StandardPagination

    def get_queryset(self):
        """Return all regions to dashboard users and only active ones publicly."""
        queryset = DeliveryRegion.objects.all()

        if self.request.method in ("GET", "HEAD", "OPTIONS") and not has_dashboard_read_access(
            self.request.user
        ):
            queryset = queryset.filter(is_active=True)

        return queryset

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Return active delivery regions for the public checkout form."""
        serializer = self.get_serializer(
            DeliveryRegion.objects.filter(is_active=True),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class SaleOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only sales history for authenticated dashboard users."""

    serializer_class = SaleOrderSerializer
    permission_classes = [IsAuthenticated, IsDashboardReadRole]
    pagination_class = StandardPagination

    def get_queryset(self):
        """Return recent sales with optional search and status filters."""
        queryset = SaleOrder.objects.prefetch_related("items").all()

        status_filter = self.request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search_term = self.request.query_params.get("search", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(order_reference__icontains=search_term)
                | Q(customer_name__icontains=search_term)
                | Q(customer_phone__icontains=search_term)
                | Q(items__product_name__icontains=search_term)
            ).distinct()

        return queryset


class StoreSettingsView(APIView):
    """Read and update singleton store settings from the dashboard."""

    permission_classes = [IsAuthenticated, DashboardReadWritePermission]

    def get(self, request, *args, **kwargs):
        settings_instance = StoreSettings.get_solo()
        serializer = StoreSettingsSerializer(settings_instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        settings_instance = StoreSettings.get_solo()
        serializer = StoreSettingsSerializer(
            settings_instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class BotMessageView(APIView):
    """Handle the public rule-based bot MVP without external AI services."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [BotMessageIpThrottle]

    def post(self, request, *args, **kwargs):
        input_serializer = BotMessageRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        bot_reply = build_bot_reply(input_serializer.validated_data["message"])
        output_serializer = BotMessageResponseSerializer(data=bot_reply.as_dict())
        output_serializer.is_valid(raise_exception=True)

        return Response(output_serializer.data, status=status.HTTP_200_OK)


class CheckoutWhatsAppView(APIView):
    """
    Prepare a checkout note and WhatsApp redirect for the public catalog.

    This endpoint validates the cart server-side, recalculates totals and
    returns a formatted order message ready to be shared with the configured
    WhatsApp sales number.
    """

    permission_classes = []
    authentication_classes = []
    throttle_classes = [CheckoutIpThrottle, CheckoutPhoneThrottle]

    @staticmethod
    def _payment_label(payment_method: str) -> str:
        return {
            "pix": "Pix",
            "card": "Cartao",
            "cash": "Dinheiro",
        }.get(payment_method, payment_method)

    @staticmethod
    def _delivery_label(delivery_method: str) -> str:
        return "Delivery" if delivery_method == "delivery" else "Retirada"

    @staticmethod
    def _aggregate_cart_quantities(cart_items) -> dict[int, int]:
        quantities_by_product_id: dict[int, int] = {}

        for item in cart_items:
            product_id = item["product_id"]
            quantities_by_product_id[product_id] = (
                quantities_by_product_id.get(product_id, 0) + item["quantity"]
            )

        return quantities_by_product_id

    @staticmethod
    def _raise_missing_products_error(missing_ids: list[int]) -> None:
        raise serializers.ValidationError(
            {
                "items": [
                    f'Products not found: {", ".join(str(product_id) for product_id in missing_ids)}'
                ]
            }
        )

    def _lock_cart_products(self, quantities_by_product_id: dict[int, int]) -> dict[int, Product]:
        product_ids = list(quantities_by_product_id)
        products = (
            Product.objects.select_for_update()
            .select_related("category")
            .filter(id__in=sorted(product_ids))
            .order_by("id")
        )
        products_by_id = {product.id: product for product in products}
        missing_ids = [product_id for product_id in product_ids if product_id not in products_by_id]

        if missing_ids:
            self._raise_missing_products_error(missing_ids)

        return products_by_id

    @staticmethod
    def _normalize_reserved_items(
        quantities_by_product_id: dict[int, int],
        products_by_id: dict[int, Product],
    ) -> tuple[list[dict], Decimal]:
        normalized_items = []
        subtotal = Decimal("0.00")

        for product_id, quantity in quantities_by_product_id.items():
            product = products_by_id[product_id]

            if not product.is_available or product.stock_quantity <= 0:
                raise serializers.ValidationError(
                    {"items": [f'Product "{product.name}" is currently unavailable']}
                )

            if quantity > product.stock_quantity:
                raise serializers.ValidationError(
                    {
                        "items": [
                            f'Requested quantity for "{product.name}" exceeds available stock ({product.stock_quantity})'
                        ]
                    }
                )

            unit_price = Decimal(product.price).quantize(Decimal("0.01"))
            line_total = (unit_price * quantity).quantize(Decimal("0.01"))
            subtotal += line_total

            normalized_items.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "sku": product.sku or "",
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "line_total": line_total,
                }
            )

        return normalized_items, subtotal

    def _reserve_cart_stock(self, cart_items) -> tuple[list[dict], Decimal, dict[int, Product]]:
        quantities_by_product_id = self._aggregate_cart_quantities(cart_items)
        products_by_id = self._lock_cart_products(quantities_by_product_id)
        normalized_items, subtotal = self._normalize_reserved_items(
            quantities_by_product_id,
            products_by_id,
        )
        timestamp = timezone.now()

        for product_id, quantity in quantities_by_product_id.items():
            product = products_by_id[product_id]
            product.stock_quantity -= quantity
            product.is_available = product.stock_quantity > 0
            product.updated_at = timestamp

        Product.objects.bulk_update(
            list(products_by_id.values()),
            ["stock_quantity", "is_available", "updated_at"],
        )

        return normalized_items, subtotal, products_by_id

    def post(self, request, *args, **kwargs):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        cart_items = validated_data["items"]
        customer = validated_data["customer"]

        delivery_region = None
        delivery_region_id = customer.get("delivery_region_id")

        if customer["delivery_method"] == "delivery" and delivery_region_id:
            delivery_region = DeliveryRegion.objects.filter(
                id=delivery_region_id,
                is_active=True,
            ).first()

            if delivery_region is None:
                raise serializers.ValidationError(
                    {"customer": {"delivery_region_id": "Selected delivery region is unavailable"}}
                )

        order_reference = timezone.localtime().strftime("BPF-%Y%m%d-%H%M%S-%f")
        customer_name = customer["full_name"].strip()
        customer_phone = customer["phone"].strip()
        customer_email = customer.get("email", "").strip()
        notes = customer.get("notes", "").strip()

        with transaction.atomic():
            normalized_items, subtotal, products_by_id = self._reserve_cart_stock(cart_items)

            delivery_fee = Decimal("0.00")
            if customer["delivery_method"] == "delivery":
                delivery_fee = (
                    Decimal(delivery_region.delivery_fee)
                    if delivery_region is not None
                    else settings.ORDER_DELIVERY_FEE
                )
            total = subtotal + delivery_fee

            message_lines = [
                "Pedido BipFlow",
                f"Referencia: {order_reference}",
                "",
                "Itens do pedido:",
                *[
                    (
                        f'{index + 1}. {item["product_name"]} '
                        f'x{item["quantity"]} - R$ {item["line_total"]:.2f}'
                    )
                    for index, item in enumerate(normalized_items)
                ],
                "",
                f"Subtotal: R$ {subtotal:.2f}",
                f"Entrega: R$ {delivery_fee:.2f}",
                f"Total: R$ {total:.2f}",
                "",
                f"Cliente: {customer_name}",
                f"WhatsApp: {customer_phone}",
                f'Email: {customer_email or "Nao informado"}',
                f'Entrega: {self._delivery_label(customer["delivery_method"])}',
                f'Pagamento: {self._payment_label(customer["payment_method"])}',
            ]

            if customer["delivery_method"] == "delivery":
                if delivery_region is not None:
                    message_lines.append(f"Regiao: {delivery_region.name}")

                message_lines.extend(
                    [
                        f'Endereco: {customer["address"].strip()}',
                        f'Bairro: {customer["neighborhood"].strip()}',
                        f'Cidade: {customer["city"].strip()}',
                    ]
                )

            if notes:
                message_lines.append(f"Observacoes: {notes}")

            message = "\n".join(message_lines)
            whatsapp_phone = StoreSettings.get_configured_whatsapp_phone()
            whatsapp_url = (
                f"https://wa.me/{whatsapp_phone}?text={quote(message)}" if whatsapp_phone else ""
            )

            sale_order = SaleOrder.objects.create(
                order_reference=order_reference,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                delivery_method=customer["delivery_method"],
                payment_method=customer["payment_method"],
                delivery_region=delivery_region,
                delivery_region_name=delivery_region.name if delivery_region is not None else "",
                address=customer.get("address", "").strip(),
                neighborhood=customer.get("neighborhood", "").strip(),
                city=customer.get("city", "").strip(),
                notes=notes,
                subtotal=subtotal.quantize(Decimal("0.01")),
                delivery_fee=delivery_fee.quantize(Decimal("0.01")),
                total=total.quantize(Decimal("0.01")),
                message=message,
                whatsapp_url=whatsapp_url,
            )
            SaleOrderItem.objects.bulk_create(
                [
                    SaleOrderItem(
                        order=sale_order,
                        product=products_by_id.get(item["product_id"]),
                        product_name=item["product_name"],
                        sku=item["sku"],
                        quantity=item["quantity"],
                        unit_price=item["unit_price"],
                        line_total=item["line_total"],
                    )
                    for item in normalized_items
                ]
            )

            response_payload = {
                "order_reference": order_reference,
                "items": normalized_items,
                "customer": {
                    "full_name": customer_name,
                    "phone": customer_phone,
                    "email": customer_email,
                    "delivery_method": customer["delivery_method"],
                    "payment_method": customer["payment_method"],
                    "delivery_region_id": (
                        delivery_region.id if delivery_region is not None else None
                    ),
                    "delivery_region_name": (
                        delivery_region.name if delivery_region is not None else ""
                    ),
                    "address": customer.get("address", "").strip(),
                    "neighborhood": customer.get("neighborhood", "").strip(),
                    "city": customer.get("city", "").strip(),
                    "notes": notes,
                },
                "subtotal": subtotal.quantize(Decimal("0.01")),
                "delivery_fee": delivery_fee.quantize(Decimal("0.01")),
                "total": total.quantize(Decimal("0.01")),
                "message": message,
                "whatsapp_url": whatsapp_url,
            }

            output_serializer = CheckoutResponseSerializer(data=response_payload)
            output_serializer.is_valid(raise_exception=True)

        return Response(output_serializer.data, status=status.HTTP_200_OK)


class LoginTokenObtainPairView(TokenObtainPairView):
    """JWT login endpoint protected by IP and submitted-identity throttles."""

    throttle_classes = [AuthIpThrottle, LoginIdentityThrottle]


class RefreshTokenView(TokenRefreshView):
    """JWT refresh endpoint protected against retry storms and token replay abuse."""

    throttle_classes = [TokenRefreshIpThrottle, TokenRefreshIdentityThrottle]


class CurrentUserView(APIView):
    """Return the authenticated user's dashboard profile summary."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RegisterUserView(APIView):
    """Create a new active user account after validating email and password."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [AuthIpThrottle, RegistrationIdentityThrottle]

    def post(self, request, *args, **kwargs):
        serializer = RegisterUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message": "Cadastro realizado com sucesso. Voce ja pode acessar sua conta.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class PasswordResetRequestView(APIView):
    """Send a password reset link when the submitted email belongs to an active user."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [AuthIpThrottle, PasswordResetIdentityThrottle]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).order_by("id").first()

        # Always return the same public response to avoid account enumeration.
        public_response = {
            "message": "Se este email existir, enviaremos um link seguro para redefinir a senha.",
            "email": email,
        }

        if user is not None:
            reset_payload = PasswordResetConfirmSerializer.build_reset_payload(user)
            reset_url = (
                f"{settings.FRONTEND_BASE_URL}/reset-password"
                f'?uid={reset_payload["uid"]}&token={reset_payload["token"]}'
            )

            send_mail(
                subject="Recuperacao de senha BipFlow",
                message=(
                    "Recebemos uma solicitacao para redefinir sua senha.\n\n"
                    f"Acesse o link seguro abaixo para criar uma nova senha:\n{reset_url}\n\n"
                    "Se voce nao solicitou esta alteracao, ignore esta mensagem."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response(public_response, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Reset a user password after validating the signed email token."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [AuthIpThrottle, PasswordResetConfirmIdentityThrottle]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])

        return Response(
            {
                "message": "Senha redefinida com sucesso. Voce ja pode acessar sua conta.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )

from datetime import datetime, timedelta
from datetime import time as time_of_day
from decimal import Decimal
from typing import NamedTuple, Optional
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken, Token
from rest_framework_simplejwt.utils import datetime_from_epoch
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .bot_engine import build_bot_reply
from .captcha import verify_turnstile
from .errors import business_logic_error, not_found_error, permission_denied_error, validation_error
from .mfa import (
    build_mfa_challenge_token,
    build_provisioning_uri,
    build_qr_code_data_uri,
    generate_totp_secret,
    read_mfa_challenge_payload,
    verify_totp_code,
)
from .models import (
    BotConversation,
    BotMessage,
    Category,
    DeliveryRegion,
    LoginAttempt,
    MFABackupCode,
    Product,
    SaleOrder,
    SaleOrderItem,
    StockMovement,
    Store,
    StoreMembership,
    StoreSettings,
    TOTPDevice,
)
from .pagination import ProductListPagination, StandardPagination
from .permissions import (
    AllowAnyReadDashboardWrite,
    DashboardReadWritePermission,
    IsDashboardReadRole,
    has_dashboard_read_access,
    has_dashboard_write_access,
)
from .product_labels import build_product_deep_link_url, build_product_qr_code_data_uri
from .serializers import (
    BotConversationDetailSerializer,
    BotConversationSummarySerializer,
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
    PublicStoreSettingsSerializer,
    RegisterUserSerializer,
    SaleOrderBreakdownSerializer,
    SaleOrderCustomerInsightsSerializer,
    SaleOrderSerializer,
    SaleOrderStatusUpdateSerializer,
    SaleOrderSummarySerializer,
    SaleOrderTimeseriesPointSerializer,
    StockMovementCreateSerializer,
    StockMovementSerializer,
    StoreRenameSerializer,
    StoreScopedTokenObtainPairSerializer,
    StoreSerializer,
    StoreSettingsSerializer,
)
from .stock import StockMovementError, apply_order_cancellation, apply_stock_movement
from .store_scope import StoreScopedViewSetMixin, resolve_request_store
from .throttling import (
    REFRESH_TOKEN_COOKIE_NAME,
    AuthIpThrottle,
    BotMessageIpThrottle,
    CheckoutIpThrottle,
    CheckoutPhoneThrottle,
    LoginIdentityThrottle,
    MfaVerifyIpThrottle,
    PasswordResetConfirmIdentityThrottle,
    PasswordResetIdentityThrottle,
    RegistrationIdentityThrottle,
    TokenRefreshIdentityThrottle,
    TokenRefreshIpThrottle,
)

User = get_user_model()


class ProductViewSet(StoreScopedViewSetMixin, viewsets.ModelViewSet):
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

    def get_base_queryset(self):
        """
        Apply filtering and optimization before the store scope (Etapa 3) is intersected.

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

    @action(detail=False, methods=["get"], url_path=r"by-code/(?P<code>[^/]+)")
    def by_code(self, request, code=None):
        """
        Retrieve a product by its auto-generated public_code (Etapa 1 of the
        QR-code stock-exit evolution).

        Powers QR-code lookups for both channels: the PDV (Etapa 3) resolves
        a scanned/typed code here before adding it to the sale, and a printed
        QR's URL (Etapa 2) resolves to a product page the same way `by_slug`
        does. get_queryset() already scopes the search to the requester's
        store, so a code from another tenant simply 404s like any other
        cross-store lookup in this codebase.
        """
        normalized_code = (code or "").strip().upper()
        product = self.get_queryset().filter(public_code=normalized_code).first()

        if product is None:
            raise NotFound(detail="Produto nao encontrado.")

        serializer = self.get_serializer(product)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="qr-code")
    def qr_code(self, request, pk=None):
        """Render this product's printable QR Code (Etapa 2 of the QR-code
        stock-exit evolution).

        Dashboard-only: printing labels is a catalog-management action,
        unlike the public `by_code` lookup it encodes, which stays open to
        anyone who scans the printed result.
        """
        if not has_dashboard_read_access(request.user):
            self.permission_denied(
                request, message="Voce nao possui permissao para gerar o QR Code deste produto."
            )

        product = self.get_object()

        return Response(
            {
                "public_code": product.public_code,
                "url": build_product_deep_link_url(product),
                "qr_code": build_product_qr_code_data_uri(product),
            },
            status=status.HTTP_200_OK,
        )

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

        # Validate category exists within the requester's store
        try:
            new_category = Category.objects.get(id=new_category_id, store=self.get_request_store())
        except Category.DoesNotExist:
            return not_found_error(f"Categoria com id {new_category_id} não existe.")

        # Convert product_ids to integers and validate
        try:
            product_ids = [int(pid) for pid in product_ids]
        except (ValueError, TypeError):
            return validation_error("Todos os product_ids devem ser números inteiros válidos.")

        # Use atomic transaction for data integrity
        with transaction.atomic():
            # Scoped to the requester's store: bypassing get_queryset() here
            # would let a store-B request bulk-edit store-A's products by ID.
            products_to_update = self.get_queryset().filter(id__in=product_ids)

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

    def perform_create(self, serializer) -> None:
        """Create the product, then log its starting stock as an audited movement.

        Keeps the StockMovement ledger complete from day one: every unit a
        product ever has is explained by exactly one movement, including the
        very first one. A zero starting stock has nothing to explain, so no
        movement is created for it.

        Builds the StockMovement directly (not via apply_stock_movement(),
        which applies a *delta* on top of whatever stock already exists in
        the database) -- the serializer's own save() already persisted the
        product's starting stock_quantity, so this only needs to record that
        already-known value as the "entrada inicial", not add to it again.
        """
        store = self.get_request_store()
        product = serializer.save(store=store)

        if product.stock_quantity > 0:
            StockMovement.objects.create(
                store=store,
                product=product,
                movement_type=StockMovement.TYPE_ENTRADA,
                quantity=product.stock_quantity,
                previous_stock=0,
                new_stock=product.stock_quantity,
                reason=StockMovement.REASON_ENTRADA_INICIAL,
                source=StockMovement.SOURCE_MANUAL,
                performed_by=self.request.user if self.request.user.is_authenticated else None,
            )

    def perform_update(self, serializer) -> None:
        """Reject direct stock_quantity/public_code edits on update.

        stock_quantity must go through a movement (Etapa 1 of the
        stock-movement evolution); public_code is a system-generated,
        immutable identifier (Etapa 1 of the QR-code stock-exit evolution) --
        allowing it to be overwritten would invalidate every QR label already
        printed for that product. read_only_fields already stops public_code
        from being *persisted* even if sent, but rejecting the request
        outright surfaces the mistake instead of silently ignoring it.
        """
        if "stock_quantity" in self.request.data:
            raise serializers.ValidationError(
                {
                    "stock_quantity": (
                        "Estoque não pode ser editado direto. Use o registro de entrada/saída."
                    )
                }
            )
        if "public_code" in self.request.data:
            raise serializers.ValidationError(
                {"public_code": "O código gerado pelo BipFlow não pode ser alterado."}
            )
        serializer.save()

    @action(detail=True, methods=["get", "post"], url_path="stock-movements")
    def stock_movements(self, request, pk=None):
        """
        GET  /v1/products/{id}/stock-movements/ - paginated movement history
        POST /v1/products/{id}/stock-movements/ - register a manual entrada/saida

        Nested under the product (rather than a standalone StockMovementViewSet)
        because every movement in this etapa is always read/written in the
        context of one specific product, which already resolves store scope
        and 404s across tenants via get_object()/get_queryset().
        """
        product = self.get_object()

        if request.method == "GET":
            if not has_dashboard_read_access(request.user):
                # self.permission_denied() (not a bare `raise PermissionDenied`)
                # so DRF applies the same 401-vs-403 distinction as every other
                # dashboard-only endpoint in this codebase: 401 when the
                # request never authenticated at all, 403 once authenticated
                # but lacking the role (see APIView.permission_denied()).
                self.permission_denied(
                    request, message="Voce nao possui permissao para ver o historico de estoque."
                )

            # Override the viewset's pagination_class (ProductListPagination,
            # page_size=12 -- picked for the storefront's 3x4 grid) before the
            # `paginator` property builds and caches it: movement history has
            # no relation to that grid and should use the generic 20/page
            # StandardPagination instead.
            self.pagination_class = StandardPagination
            queryset = product.stock_movements.select_related("product", "performed_by", "sale_order")
            page = self.paginate_queryset(queryset)
            serializer = StockMovementSerializer(
                page if page is not None else queryset, many=True
            )
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data, status=status.HTTP_200_OK)

        if not has_dashboard_write_access(request.user):
            self.permission_denied(
                request,
                message="Voce nao possui permissao para registrar movimentacoes de estoque.",
            )

        input_serializer = StockMovementCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        try:
            movement = apply_stock_movement(
                product_id=product.id,
                store=self.get_request_store(),
                movement_type=validated["movement_type"],
                quantity=validated["quantity"],
                reason=validated["reason"],
                performed_by=request.user if request.user.is_authenticated else None,
                notes=validated.get("notes", ""),
            )
        except StockMovementError as exc:
            return business_logic_error(str(exc))

        product.refresh_from_db()
        return Response(
            {
                "movement": StockMovementSerializer(movement).data,
                "product": ProductSerializer(product, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CategoryViewSet(StoreScopedViewSetMixin, viewsets.ModelViewSet):
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

    All of the above are scoped to the request's resolved store (Etapa 3).
    """

    serializer_class = CategorySerializer
    permission_classes = [AllowAnyReadDashboardWrite]
    pagination_class = StandardPagination

    def get_base_queryset(self):
        return Category.objects.all()

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


class DeliveryRegionViewSet(StoreScopedViewSetMixin, viewsets.ModelViewSet):
    """Manage delivery pricing by region while exposing active regions publicly.

    Scoped to the request's resolved store (Etapa 3).
    """

    serializer_class = DeliveryRegionSerializer
    permission_classes = [AllowAnyReadDashboardWrite]
    pagination_class = StandardPagination

    def get_base_queryset(self):
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
            self.get_queryset().filter(is_active=True),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


VALID_SUMMARY_PERIODS = {"today", "7d", "30d", "90d", "month"}

DASHBOARD_AGGREGATE_CACHE_SECONDS = 90


def _cached_dashboard_aggregate(action_name: str, store_id: int, period: str, compute):
    """Cache a dashboard aggregate response for a short TTL, keyed per store and period.

    These aggregates are read-heavy and recomputed from scratch on every
    request; a short TTL trades a little staleness for not re-running the
    same query on every dashboard refresh/store-switch.
    """
    cache_key = f"dashboard:sales:{action_name}:{store_id}:{period}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    data = compute()
    cache.set(cache_key, data, timeout=DASHBOARD_AGGREGATE_CACHE_SECONDS)
    return data


DASHBOARD_AGGREGATE_ACTIONS = ("summary", "timeseries", "breakdown", "customers")


def invalidate_dashboard_cache(store_id: int) -> None:
    """Bust every cached dashboard aggregate for a store after a SaleOrder write.

    Only the period-shorthand keys are enumerable and cheap to clear this
    way; a custom `?start=&end=` range produces a one-off cache key per
    request and is left to expire via the existing TTL instead.
    """
    keys = [
        f"dashboard:sales:{action}:{store_id}:{period}"
        for action in DASHBOARD_AGGREGATE_ACTIONS
        for period in VALID_SUMMARY_PERIODS
    ]
    cache.delete_many(keys)


def _resolve_summary_period(period: str) -> tuple:
    """Return (start, previous_start) datetimes bounding a dashboard summary period.

    "today" and "month" are calendar boundaries, so they're resolved in the
    server's local time zone (America/Sao_Paulo) rather than UTC midnight --
    otherwise "today" would start three hours off from the store's actual day.
    """
    current_timezone = timezone.get_current_timezone()
    today_local = timezone.localtime(timezone.now()).date()

    if period == "month":
        month_start_date = today_local.replace(day=1)
        if month_start_date.month == 1:
            previous_month_start_date = month_start_date.replace(
                year=month_start_date.year - 1, month=12
            )
        else:
            previous_month_start_date = month_start_date.replace(month=month_start_date.month - 1)
        start = timezone.make_aware(datetime.combine(month_start_date, time_of_day.min), current_timezone)
        previous_start = timezone.make_aware(
            datetime.combine(previous_month_start_date, time_of_day.min), current_timezone
        )
        return start, previous_start

    days = {"today": 1, "7d": 7, "30d": 30, "90d": 90}[period]
    if period == "today":
        start = timezone.make_aware(datetime.combine(today_local, time_of_day.min), current_timezone)
    else:
        start = timezone.now() - timedelta(days=days)
    return start, start - timedelta(days=days)


def _resolve_custom_range(request) -> Optional[tuple]:
    """Return (start, end, start_param, end_param) for a valid `?start=&end=` range, else None.

    `end` is exclusive (the day after `end_param`, at local midnight) so callers can
    always filter with `created_at__lt=end` regardless of time-of-day precision.
    """
    start_param = request.query_params.get("start", "").strip()
    end_param = request.query_params.get("end", "").strip()
    if not start_param or not end_param:
        return None

    try:
        start_date = datetime.strptime(start_param, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_param, "%Y-%m-%d").date()
    except ValueError:
        return None

    if start_date > end_date:
        return None

    current_timezone = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(start_date, time_of_day.min), current_timezone)
    end = timezone.make_aware(datetime.combine(end_date, time_of_day.min), current_timezone) + timedelta(days=1)
    return start, end, start_param, end_param


class PeriodWindow(NamedTuple):
    """A resolved dashboard date window, from either a `period` shorthand or a custom range."""

    label: str
    cache_key: str
    start: datetime
    end: Optional[datetime]
    previous_start: datetime
    previous_end: datetime


def _resolve_period_window(request) -> PeriodWindow:
    """Resolve the dashboard window for `summary`/`breakdown`: a custom range wins over `period`."""
    custom_range = _resolve_custom_range(request)
    if custom_range is not None:
        start, end, start_param, end_param = custom_range
        duration = end - start
        return PeriodWindow(
            label="custom",
            cache_key=f"custom:{start_param}:{end_param}",
            start=start,
            end=end,
            previous_start=start - duration,
            previous_end=start,
        )

    period = request.query_params.get("period", "30d")
    if period not in VALID_SUMMARY_PERIODS:
        period = "30d"
    start, previous_start = _resolve_summary_period(period)
    return PeriodWindow(
        label=period,
        cache_key=period,
        start=start,
        end=None,
        previous_start=previous_start,
        previous_end=start,
    )


def _shift_one_year_back(moment: datetime) -> datetime:
    """Shift a datetime exactly one calendar year back (Feb 29 falls back to Feb 28)."""
    try:
        return moment.replace(year=moment.year - 1)
    except ValueError:
        return moment.replace(year=moment.year - 1, day=28)


def _percentage_change(current: Decimal, previous: Decimal) -> Optional[Decimal]:
    """Return the % change from `previous` to `current`, or None when there's nothing to compare."""
    if not previous:
        return None
    return ((current - previous) / previous * 100).quantize(Decimal("0.01"))


class SaleOrderViewSet(StoreScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """Sales history for authenticated dashboard users, scoped to their store (Etapa 3)."""

    serializer_class = SaleOrderSerializer
    permission_classes = [IsAuthenticated, IsDashboardReadRole]
    pagination_class = StandardPagination

    def get_base_queryset(self):
        """Return recent sales with optional search, status and channel filters."""
        queryset = SaleOrder.objects.prefetch_related("items").all()

        status_filter = self.request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Etapa 5 of the QR-code stock-exit evolution: lets the dashboard
        # narrow every aggregate below (summary/timeseries/breakdown/
        # customers all build on get_queryset()) to just the physical-store
        # PDV or just the virtual/WhatsApp channel.
        channel_filter = self.request.query_params.get("channel", "").strip()
        if channel_filter in (SaleOrder.CHANNEL_VIRTUAL, SaleOrder.CHANNEL_LOJA_FISICA):
            queryset = queryset.filter(channel=channel_filter)

        search_term = self.request.query_params.get("search", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(order_reference__icontains=search_term)
                | Q(customer_name__icontains=search_term)
                | Q(customer_phone__icontains=search_term)
                | Q(items__product_name__icontains=search_term)
            ).distinct()

        return queryset

    def _active_orders_in_window(self, window: "PeriodWindow"):
        """Return non-cancelled orders within the resolved dashboard window.

        Shared by summary/breakdown/customers, which all need the same
        "active orders in this date range" shape; `breakdown.by_status` is
        the one place that deliberately keeps cancelled orders, so it stays
        outside this helper.
        """
        orders = self.get_queryset().exclude(status="cancelled").filter(created_at__gte=window.start)
        if window.end is not None:
            orders = orders.filter(created_at__lt=window.end)
        return orders

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        """Allow dashboard operators to update the operational order status.

        Cancelling (any status -> "cancelled") atomically restocks every
        item the order originally decremented, regardless of channel (Etapa
        R2 of the QR-code stock-exit refinement) -- apply_order_cancellation()
        is the single chokepoint for that, so there is no way to cancel an
        order through this endpoint without the stock reversal happening
        too. Idempotent: re-selecting "cancelled" on an already-cancelled
        order is a no-op, not a double restock.
        """
        if not has_dashboard_write_access(request.user):
            raise PermissionDenied("Voce nao possui permissao para alterar pedidos.")

        order = self.get_object()
        serializer = SaleOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        next_status = serializer.validated_data["status"]
        if order.status != next_status:
            if next_status == SaleOrder.STATUS_CANCELLED:
                apply_order_cancellation(
                    order=order,
                    store=self.get_request_store(),
                    performed_by=request.user if request.user.is_authenticated else None,
                )
            else:
                order.status = next_status
                order.save(update_fields=["status", "updated_at"])

            invalidate_dashboard_cache(self.get_request_store().id)

        return Response(self.get_serializer(order).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregate real sales revenue for the dashboard's revenue card.

        Accepts either `?period=today|7d|30d|90d|month` or an explicit
        `?start=YYYY-MM-DD&end=YYYY-MM-DD` custom range (the latter wins).
        """
        window = _resolve_period_window(request)

        def compute():
            active_orders = self.get_queryset().exclude(status="cancelled")

            current = self._active_orders_in_window(window).aggregate(
                revenue_total=Sum("total"), orders_count=Count("id")
            )
            revenue_total = current["revenue_total"] or Decimal("0.00")
            orders_count = current["orders_count"] or 0
            average_ticket = (revenue_total / orders_count) if orders_count else Decimal("0.00")

            previous_revenue = (
                active_orders.filter(
                    created_at__gte=window.previous_start, created_at__lt=window.previous_end
                ).aggregate(revenue_total=Sum("total"))["revenue_total"]
                or Decimal("0.00")
            )
            comparison_previous_period = _percentage_change(revenue_total, previous_revenue)

            last_year_end = _shift_one_year_back(window.end if window.end is not None else timezone.now())
            last_year_start = _shift_one_year_back(window.start)
            last_year_revenue = (
                active_orders.filter(created_at__gte=last_year_start, created_at__lt=last_year_end).aggregate(
                    revenue_total=Sum("total")
                )["revenue_total"]
                or Decimal("0.00")
            )
            comparison_same_period_last_year = _percentage_change(revenue_total, last_year_revenue)

            serializer = SaleOrderSummarySerializer(
                {
                    "period": window.label,
                    "revenue_total": revenue_total,
                    "orders_count": orders_count,
                    "average_ticket": average_ticket,
                    "comparison_previous_period": comparison_previous_period,
                    "comparison_same_period_last_year": comparison_same_period_last_year,
                }
            )
            return serializer.data

        store_id = self.get_request_store().id
        data = _cached_dashboard_aggregate("summary", store_id, window.cache_key, compute)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="timeseries")
    def timeseries(self, request):
        """Daily revenue and order counts for the dashboard's trend chart.

        Accepts either `?period=7d|30d|90d` or an explicit
        `?start=YYYY-MM-DD&end=YYYY-MM-DD` custom range (the latter wins,
        capped at 366 days so a wide range can't generate an unbounded
        number of points).
        """
        custom_range = _resolve_custom_range(request)
        end_boundary = None
        if custom_range is not None:
            start, end, start_param, end_param = custom_range
            start_date = timezone.localtime(start).date()
            end_date = timezone.localtime(end).date() - timedelta(days=1)
            days = min((end_date - start_date).days + 1, 366)
            end_boundary = end
            cache_period_key = f"custom:{start_param}:{end_param}"
        else:
            period_days = {"7d": 7, "30d": 30, "90d": 90}
            period = request.query_params.get("period", "30d")
            if period not in period_days:
                period = "30d"
            days = period_days[period]

            current_timezone = timezone.get_current_timezone()
            today_local = timezone.localtime(timezone.now()).date()
            start_date = today_local - timedelta(days=days - 1)
            start = timezone.make_aware(datetime.combine(start_date, time_of_day.min), current_timezone)
            cache_period_key = period

        def compute():
            rows_qs = self.get_queryset().exclude(status="cancelled").filter(created_at__gte=start)
            if end_boundary is not None:
                rows_qs = rows_qs.filter(created_at__lt=end_boundary)

            rows = (
                rows_qs.annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(revenue=Sum("total"), orders_count=Count("id"))
            )
            revenue_by_day = {row["day"]: row for row in rows}

            points = []
            for offset in range(days):
                day = start_date + timedelta(days=offset)
                row = revenue_by_day.get(day)
                points.append(
                    {
                        "date": day,
                        "revenue": row["revenue"] if row else Decimal("0.00"),
                        "orders_count": row["orders_count"] if row else 0,
                    }
                )

            serializer = SaleOrderTimeseriesPointSerializer(points, many=True)
            return serializer.data

        store_id = self.get_request_store().id
        data = _cached_dashboard_aggregate("timeseries", store_id, cache_period_key, compute)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="breakdown")
    def breakdown(self, request):
        """Sales breakdown by top products, payment method, region and operational status.

        Accepts either `?period=today|7d|30d|90d|month` or an explicit
        `?start=YYYY-MM-DD&end=YYYY-MM-DD` custom range (the latter wins).
        """
        window = _resolve_period_window(request)
        store = self.get_request_store()

        def compute():
            orders = self.get_queryset().filter(created_at__gte=window.start)
            if window.end is not None:
                orders = orders.filter(created_at__lt=window.end)
            active_orders = self._active_orders_in_window(window)

            items_qs = (
                SaleOrderItem.objects.filter(order__store=store, order__created_at__gte=window.start)
                .exclude(order__status="cancelled")
            )
            if window.end is not None:
                items_qs = items_qs.filter(order__created_at__lt=window.end)

            top_products_rows = (
                items_qs.values("product_id", "product_name")
                .annotate(quantity_total=Sum("quantity"), revenue_total=Sum("line_total"))
                .order_by("-revenue_total")[:5]
            )

            product_ids = [row["product_id"] for row in top_products_rows if row["product_id"] is not None]
            image_by_product_id = {
                product.id: request.build_absolute_uri(product.image.url) if product.image else None
                for product in Product.objects.filter(id__in=product_ids)
            }

            top_products = [
                {
                    "product_id": row["product_id"],
                    "product_name": row["product_name"],
                    "image_url": image_by_product_id.get(row["product_id"]),
                    "quantity_total": row["quantity_total"],
                    "revenue_total": row["revenue_total"] or Decimal("0.00"),
                }
                for row in top_products_rows
            ]

            by_payment_method = list(
                active_orders.values("payment_method")
                .annotate(revenue_total=Sum("total"), orders_count=Count("id"))
                .order_by("-revenue_total")
            )
            by_status = list(
                orders.values("status").annotate(orders_count=Count("id")).order_by("status")
            )
            # Etapa 5 of the QR-code stock-exit evolution: turns
            # SaleOrder.channel (Etapa 3) into the business-facing
            # physical-vs-virtual comparison this whole evolution was meant
            # to enable, the same shape as by_payment_method.
            by_channel = list(
                active_orders.values("channel")
                .annotate(revenue_total=Sum("total"), orders_count=Count("id"))
                .order_by("-revenue_total")
            )

            region_rows = active_orders.values("delivery_method", "delivery_region_name").annotate(
                revenue_total=Sum("total"), orders_count=Count("id")
            )
            region_totals: dict = {}
            for row in region_rows:
                if row["delivery_method"] == "pickup":
                    label = "Retirada na loja"
                else:
                    label = row["delivery_region_name"] or "Sem regiao"
                bucket = region_totals.setdefault(
                    label, {"revenue_total": Decimal("0.00"), "orders_count": 0}
                )
                bucket["revenue_total"] += row["revenue_total"] or Decimal("0.00")
                bucket["orders_count"] += row["orders_count"]
            by_region = sorted(
                (
                    {"region": label, "revenue_total": totals["revenue_total"], "orders_count": totals["orders_count"]}
                    for label, totals in region_totals.items()
                ),
                key=lambda entry: entry["revenue_total"],
                reverse=True,
            )

            serializer = SaleOrderBreakdownSerializer(
                {
                    "period": window.label,
                    "top_products": top_products,
                    "by_payment_method": by_payment_method,
                    "by_status": by_status,
                    "by_region": by_region,
                    "by_channel": by_channel,
                }
            )
            return serializer.data

        data = _cached_dashboard_aggregate("breakdown", store.id, window.cache_key, compute)
        return Response(data)

    @action(detail=False, methods=["get"], url_path="customers")
    def customers(self, request):
        """Bot-to-sale conversion rate and new-vs-returning customer mix.

        Accepts either `?period=today|7d|30d|90d|month` or an explicit
        `?start=YYYY-MM-DD&end=YYYY-MM-DD` custom range (the latter wins).
        """
        window = _resolve_period_window(request)
        store = self.get_request_store()

        def compute():
            base_orders = self.get_queryset().exclude(status="cancelled")
            period_orders = self._active_orders_in_window(window)

            period_phones = {
                normalized
                for normalized in (
                    StoreSettings.normalize_phone(phone)
                    for phone in period_orders.values_list("customer_phone", flat=True)
                )
                if normalized
            }
            earlier_phones = {
                normalized
                for normalized in (
                    StoreSettings.normalize_phone(phone)
                    for phone in base_orders.filter(
                        created_at__lt=window.start
                    ).values_list("customer_phone", flat=True)
                )
                if normalized
            }
            returning_customers = len(period_phones & earlier_phones)
            new_customers = len(period_phones) - returning_customers

            conversations = BotConversation.objects.filter(
                store=store, created_at__gte=window.start
            )
            if window.end is not None:
                conversations = conversations.filter(created_at__lt=window.end)
            bot_conversations_count = conversations.count()
            bot_converted_count = conversations.filter(sale_order__isnull=False).count()
            bot_conversion_rate = (
                (Decimal(bot_converted_count) / Decimal(bot_conversations_count) * 100).quantize(
                    Decimal("0.01")
                )
                if bot_conversations_count
                else None
            )

            serializer = SaleOrderCustomerInsightsSerializer(
                {
                    "period": window.label,
                    "new_customers": new_customers,
                    "returning_customers": returning_customers,
                    "bot_conversations_count": bot_conversations_count,
                    "bot_converted_count": bot_converted_count,
                    "bot_conversion_rate": bot_conversion_rate,
                }
            )
            return serializer.data

        data = _cached_dashboard_aggregate("customers", store.id, window.cache_key, compute)
        return Response(data)


class StockMovementViewSet(StoreScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """Store-wide stock movement ledger for the dashboard (Etapa 2).

    Read-only: creating a movement always happens through
    ProductViewSet.stock_movements (POST), which owns the locking/validation
    workflow against one specific product -- this viewset only ever lists
    what that endpoint (and checkout) already wrote, across the whole store.
    """

    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, IsDashboardReadRole]
    pagination_class = StandardPagination

    def get_base_queryset(self):
        """Apply the ledger's filters: product, type, source, reason, search, date range."""
        queryset = StockMovement.objects.select_related("product", "performed_by", "sale_order")

        product_id = self.request.query_params.get("product", "").strip()
        if product_id:
            try:
                queryset = queryset.filter(product_id=int(product_id))
            except ValueError:
                pass

        movement_type = self.request.query_params.get("movement_type", "").strip()
        if movement_type in (StockMovement.TYPE_ENTRADA, StockMovement.TYPE_SAIDA):
            queryset = queryset.filter(movement_type=movement_type)

        # Validated against every known source (not a hardcoded
        # manual/venda tuple) so a new source -- like SOURCE_PDV, added by
        # Etapa 3 of the QR-code stock-exit evolution -- is filterable the
        # moment it exists, instead of ?source=pdv silently matching
        # nothing being mistaken for "matches every row".
        source = self.request.query_params.get("source", "").strip()
        if source in dict(StockMovement.SOURCE_CHOICES):
            queryset = queryset.filter(source=source)

        reason = self.request.query_params.get("reason", "").strip()
        if reason:
            queryset = queryset.filter(reason=reason)

        search_term = self.request.query_params.get("search", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(product__name__icontains=search_term) | Q(product__sku__icontains=search_term)
            )

        # Reuses the same custom-range resolver as SaleOrderViewSet's
        # summary/breakdown/customers (views.py:587) -- same `?start=&end=`
        # vocabulary, same timezone-aware day boundaries, no need for a
        # second date-parsing helper just for this ledger.
        custom_range = _resolve_custom_range(self.request)
        if custom_range is not None:
            start, end, _start_param, _end_param = custom_range
            queryset = queryset.filter(created_at__gte=start, created_at__lt=end)

        return queryset


class BotConversationViewSet(StoreScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only bot conversation history for authenticated dashboard users."""

    permission_classes = [IsAuthenticated, IsDashboardReadRole]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        """Use compact payloads for lists and full message history for details."""
        if self.action == "retrieve":
            return BotConversationDetailSerializer

        return BotConversationSummarySerializer

    def get_base_queryset(self):
        """Return bot conversations with optional dashboard filters."""
        queryset = BotConversation.objects.select_related("sale_order").annotate(
            message_count=Count("messages")
        )

        if self.action == "retrieve":
            queryset = queryset.prefetch_related("messages")

        status_filter = self.request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        channel_filter = self.request.query_params.get("channel", "").strip()
        if channel_filter:
            queryset = queryset.filter(channel=channel_filter)

        intent_filter = self.request.query_params.get("intent", "").strip()
        if intent_filter:
            queryset = queryset.filter(last_intent=intent_filter)

        search_term = self.request.query_params.get("search", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(session_id__icontains=search_term)
                | Q(customer_phone__icontains=search_term)
                | Q(messages__content__icontains=search_term)
            ).distinct()

        return queryset.order_by("-updated_at", "-id")


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
        settings_instance = serializer.save()
        # Etapa 3: sync to the requester's own store, not always the global
        # default, so a future store-B admin can't overwrite store-A's number.
        Store.objects.filter(id=resolve_request_store(request).id).update(
            whatsapp_phone=settings_instance.whatsapp_phone
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicStoreSettingsView(APIView):
    """Expose safe store contact settings to the public catalog."""

    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        settings_instance = StoreSettings.objects.filter(singleton_key=1).first() or StoreSettings()
        serializer = PublicStoreSettingsSerializer(settings_instance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CurrentStoreView(APIView):
    """Resolve the tenant for this request.

    Etapa 3 of the multi-tenant evolution: resolves by the `X-Store-Slug`
    header, falling back to the single default store when absent -- this
    view runs without authentication, so it always takes that public path
    even for dashboard callers (see resolve_request_store).
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        store = resolve_request_store(request)
        serializer = StoreSerializer(store)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyStoresView(APIView):
    """List the authenticated user's stores, or create a new one (Etapa 4).

    Backs the dashboard's store switcher (GET) and its "new store" action
    (POST) -- the same Store.create_for_owner() registration uses.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        stores = Store.objects.filter(memberships__user=request.user).distinct().order_by("name")
        serializer = StoreSerializer(stores, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        name = str(request.data.get("name", "")).strip()
        if not name:
            return validation_error("name e obrigatorio.")

        store = Store.create_for_owner(name=name, owner=request.user)
        serializer = StoreSerializer(store)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyStoreDetailView(APIView):
    """Rename one of the authenticated user's own stores (Etapa 4).

    Only owner/manager memberships on *this specific store* may rename it --
    `has_dashboard_write_access` alone isn't store-scoped, so a manager of
    store A shouldn't be able to rename store B just because they hold a
    write role somewhere.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        store = Store.objects.filter(slug=kwargs["slug"]).first()
        if store is None:
            return not_found_error("Loja nao encontrada.")

        can_rename = store.memberships.filter(
            user=request.user, role__in=(StoreMembership.ROLE_OWNER, StoreMembership.ROLE_MANAGER)
        ).exists()
        if not can_rename:
            return permission_denied_error("Voce nao possui permissao para renomear esta loja.")

        serializer = StoreRenameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        store.name = serializer.validated_data["name"]
        store.save(update_fields=["name", "updated_at"])

        return Response(StoreSerializer(store).data, status=status.HTTP_200_OK)


class BotMessageView(APIView):
    """Handle the public rule-based bot MVP without external AI services."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [BotMessageIpThrottle]

    @staticmethod
    def _json_safe_payload(value):
        if isinstance(value, Decimal):
            return f"{value:.2f}"

        if isinstance(value, list):
            return [BotMessageView._json_safe_payload(item) for item in value]

        if isinstance(value, dict):
            return {
                key: BotMessageView._json_safe_payload(item)
                for key, item in value.items()
            }

        return value

    @staticmethod
    def _resolve_conversation(validated_data, store: Store) -> BotConversation:
        conversation_id = validated_data.get("conversation_id")
        session_id = validated_data.get("session_id", "").strip()
        channel = validated_data["channel"]
        customer_phone = validated_data.get("customer_phone", "").strip()

        conversation = None

        if conversation_id:
            conversation = BotConversation.objects.filter(id=conversation_id, store=store).first()

        if conversation is None and session_id:
            conversation = BotConversation.objects.filter(session_id=session_id, store=store).first()

        if conversation is None:
            conversation = BotConversation.objects.create(
                store=store,
                channel=channel,
                customer_phone=customer_phone,
            )
        else:
            update_fields = []

            if conversation.channel != channel:
                conversation.channel = channel
                update_fields.append("channel")

            if customer_phone and conversation.customer_phone != customer_phone:
                conversation.customer_phone = customer_phone
                update_fields.append("customer_phone")

            if update_fields:
                conversation.save(update_fields=[*update_fields, "updated_at"])

        return conversation

    def post(self, request, *args, **kwargs):
        store = resolve_request_store(request)
        input_serializer = BotMessageRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        validated_data = input_serializer.validated_data
        user_message = validated_data["message"]
        conversation = self._resolve_conversation(validated_data, store)
        bot_reply = build_bot_reply(user_message)

        next_status = (
            BotConversation.STATUS_WAITING_HUMAN
            if bot_reply.intent == "human_support"
            else BotConversation.STATUS_WAITING_CUSTOMER
        )
        bot_payload = bot_reply.as_dict()

        with transaction.atomic():
            BotMessage.objects.create(
                conversation=conversation,
                role=BotMessage.ROLE_USER,
                content=user_message,
            )
            BotMessage.objects.create(
                conversation=conversation,
                role=BotMessage.ROLE_BOT,
                content=bot_reply.reply,
                intent=bot_reply.intent,
                metadata=self._json_safe_payload(bot_payload),
            )

            conversation.status = next_status
            conversation.last_intent = bot_reply.intent
            conversation.save(update_fields=["status", "last_intent", "updated_at"])

        response_payload = {
            **bot_payload,
            "conversation_id": conversation.id,
            "session_id": conversation.session_id,
            "conversation_status": conversation.status,
        }
        output_serializer = BotMessageResponseSerializer(data=response_payload)
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

    def _lock_cart_products(
        self, quantities_by_product_id: dict[int, int], store: Store
    ) -> dict[int, Product]:
        product_ids = list(quantities_by_product_id)
        products = (
            Product.objects.select_for_update()
            .select_related("category")
            .filter(id__in=sorted(product_ids), store=store)
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

    def _reserve_cart_stock(
        self, cart_items, store: Store
    ) -> tuple[list[dict], Decimal, dict[int, Product]]:
        quantities_by_product_id = self._aggregate_cart_quantities(cart_items)
        products_by_id = self._lock_cart_products(quantities_by_product_id, store)
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
        store = resolve_request_store(request)
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
                store=store,
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
            normalized_items, subtotal, products_by_id = self._reserve_cart_stock(cart_items, store)

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
            whatsapp_phone = store.get_configured_whatsapp_phone()
            whatsapp_url = (
                f"https://wa.me/{whatsapp_phone}?text={quote(message)}" if whatsapp_phone else ""
            )

            sale_order = SaleOrder.objects.create(
                store=store,
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

            # The decrement itself already happened above in
            # _reserve_cart_stock (one bulk_update, inside the same lock) --
            # this just persists the audit trail for it. Built straight from
            # data already in memory (no extra SELECT/lock per product):
            # products_by_id[...].stock_quantity is the post-decrement value,
            # so previous_stock is reconstructed by adding the quantity back.
            StockMovement.objects.bulk_create(
                [
                    StockMovement(
                        store=store,
                        product=products_by_id[item["product_id"]],
                        movement_type=StockMovement.TYPE_SAIDA,
                        quantity=item["quantity"],
                        previous_stock=(
                            products_by_id[item["product_id"]].stock_quantity + item["quantity"]
                        ),
                        new_stock=products_by_id[item["product_id"]].stock_quantity,
                        reason=StockMovement.REASON_VENDA,
                        source=StockMovement.SOURCE_VENDA,
                        sale_order=sale_order,
                    )
                    for item in normalized_items
                ]
            )

            bot_session_id = validated_data.get("bot_session_id", "").strip()
            if bot_session_id:
                BotConversation.objects.filter(
                    session_id=bot_session_id, store=store, sale_order__isnull=True
                ).update(sale_order=sale_order)

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


REFRESH_TOKEN_COOKIE_PATH = "/api/auth/"


def _set_refresh_cookie(response: Response, refresh_token: str, *, remember_me: bool = False) -> None:
    """Store the refresh token as an httpOnly cookie, unreachable from page JS.

    Unchecked "remember me" -> no Max-Age at all (a session cookie the
    browser drops on its own when it fully closes). Checked -> a persistent
    cookie matching REMEMBER_ME_REFRESH_TOKEN_LIFETIME. The token's own
    `exp` claim must already match this (see _apply_remember_me) -- a
    persistent cookie around an expired token would be a no-op.
    """
    cookie_kwargs: dict = {
        "path": REFRESH_TOKEN_COOKIE_PATH,
        "httponly": True,
        # SameSite=None cookies are rejected by browsers unless Secure is
        # also set, regardless of IS_PRODUCTION -- see BIPFLOW_CROSS_ORIGIN_COOKIES.
        "secure": settings.IS_PRODUCTION or settings.BIPFLOW_CROSS_ORIGIN_COOKIES,
        "samesite": settings.REFRESH_COOKIE_SAMESITE,
    }
    if remember_me:
        cookie_kwargs["max_age"] = int(settings.REMEMBER_ME_REFRESH_TOKEN_LIFETIME.total_seconds())

    response.set_cookie(REFRESH_TOKEN_COOKIE_NAME, refresh_token, **cookie_kwargs)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_TOKEN_COOKIE_NAME, path=REFRESH_TOKEN_COOKIE_PATH)


def _apply_remember_me(refresh: Token, remember_me: bool) -> None:
    """Stamp the remember_me claim and (re)apply the matching lifetime.

    Needed because SimpleJWT's own rotation (ROTATE_REFRESH_TOKENS=True)
    calls token.set_exp() with no lifetime argument, which falls back to the
    *class-level* default (SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"], 1 day) --
    silently shrinking a 30-day "remembered" session back down on its very
    first refresh unless every rotation re-stamps the claim and re-applies
    the lifetime explicitly, like this.
    """
    refresh["remember_me"] = remember_me
    lifetime = (
        settings.REMEMBER_ME_REFRESH_TOKEN_LIFETIME
        if remember_me
        else settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    )
    refresh.set_exp(lifetime=lifetime)


def _sync_outstanding_token_expiry(refresh: Token) -> None:
    """Keep OutstandingToken.expires_at honest after _apply_remember_me changes exp.

    Purely a bookkeeping/audit-trail concern: the blacklist app only ever
    checks `jti` membership, never `expires_at`, so a stale value here can't
    let an expired token through -- but it would show a misleading lifetime
    in Django Admin if left unsynced.
    """
    OutstandingToken.objects.filter(jti=refresh["jti"]).update(
        expires_at=datetime_from_epoch(int(refresh["exp"])),
    )


def _blacklist_all_outstanding_tokens(user) -> int:
    """Blacklist every outstanding refresh token for `user`. Returns how many were newly revoked.

    Shared by LogoutAllDevicesView (explicit user request) and
    PasswordResetConfirmView (changing your password should invalidate any
    session minted under the old one, including ones an attacker might
    already be holding).
    """
    outstanding = OutstandingToken.objects.filter(user=user)
    already_blacklisted_jtis = set(
        BlacklistedToken.objects.filter(token__user=user).values_list("token__jti", flat=True)
    )
    newly_blacklisted = [
        BlacklistedToken(token=token) for token in outstanding if token.jti not in already_blacklisted_jtis
    ]
    BlacklistedToken.objects.bulk_create(newly_blacklisted)
    return len(newly_blacklisted)


def _client_ip(request) -> str:
    """Resolve a single, storable client IP from X-Forwarded-For.

    Every caller (Turnstile verification, LoginAttempt.ip_address -- a
    GenericIPAddressField) needs one valid IP, not DRF's raw throttle-ident
    string. DRF's own SimpleRateThrottle.get_ident(), when NUM_PROXIES is
    unset, returns the XFF header essentially verbatim (fine for a
    rate-limit bucket key, which just needs to be a consistent string per
    requester) -- that broke here the moment Render's multi-hop load
    balancer showed up: request.data['ip_address'] became a comma-joined
    string like "203.0.113.1,10.0.0.2", which Postgres rejects outright as
    an IP. Take the left-most hop instead -- by convention each proxy
    *appends* to X-Forwarded-For, so the first entry is the original client
    regardless of how many trusted proxies sit in between. Single-hop/no-XFF
    deploys (the VM+Nginx path) are unaffected either way.

    Note: like the code this replaced, this still trusts client-supplied
    X-Forwarded-For content -- a spoofed left-most entry isn't newly
    possible here, the prior behavior already passed raw XFF content through
    unchecked. Properly rejecting untrusted hops would need to know the
    exact trusted-proxy count per deployment target, which isn't available
    here.
    """
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    remote_addr = request.META.get("REMOTE_ADDR")

    if not xff:
        return remote_addr

    addrs = [addr.strip() for addr in xff.split(",") if addr.strip()]
    return addrs[0] if addrs else remote_addr


def _login_identifier(request) -> str:
    data = request.data if hasattr(request, "data") else {}
    if not hasattr(data, "get"):
        return ""
    return str(data.get("username") or data.get("email") or "").strip()


class LoginTokenObtainPairView(TokenObtainPairView):
    """JWT login endpoint protected by IP and submitted-identity throttles.

    The refresh token is set as an httpOnly cookie and stripped from the
    JSON body so page JavaScript can never read it. Every attempt -- success,
    bad credentials, or throttled -- is recorded to LoginAttempt for audit
    and to feed the conditional CAPTCHA gate.
    """

    serializer_class = StoreScopedTokenObtainPairSerializer
    throttle_classes = [AuthIpThrottle, LoginIdentityThrottle]

    def post(self, request, *args, **kwargs):
        identifier = _login_identifier(request)
        remember_me = bool(request.data.get("remember_me")) if hasattr(request.data, "get") else False

        if LoginAttempt.recent_failure_count(identifier) >= settings.LOGIN_CAPTCHA_FAILURE_THRESHOLD:
            captcha_token = request.data.get("captcha_token") if hasattr(request.data, "get") else None
            if not verify_turnstile(captcha_token, _client_ip(request)):
                self._record(request, identifier, failure_reason=LoginAttempt.FAILURE_CAPTCHA_REQUIRED)
                return validation_error(
                    "Confirme que voce nao e um robo para continuar.",
                    details={"requires_captcha": True},
                )

        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            self._record(request, identifier, failure_reason=LoginAttempt.FAILURE_INVALID_CREDENTIALS)
            raise

        user = User.objects.filter(username__iexact=identifier).first()
        membership = (
            StoreMembership.objects.filter(user=user).select_related("store").first()
            if user is not None
            else None
        )
        store_id = membership.store_id if membership else None

        mfa_device = TOTPDevice.objects.filter(user=user, confirmed=True).first() if user else None
        if mfa_device is not None:
            # Password checked out, but a second factor is still owed --
            # discard the real tokens super().post() already minted and
            # issue a short-lived challenge instead. Recorded as a distinct
            # failure_reason so a completed MFA login still shows as two
            # rows (challenge issued, then a real success/failure) rather
            # than masquerading as a single successful password check.
            # remember_me rides along in the challenge so step two can
            # still honor the choice the user made on the login form.
            self._record(request, identifier, failure_reason=LoginAttempt.FAILURE_MFA_REQUIRED, user=user, store_id=store_id)
            return Response(
                {"mfa_required": True, "mfa_token": build_mfa_challenge_token(user.id, remember_me)},
                status=status.HTTP_200_OK,
            )

        refresh_str = response.data.pop("refresh", None)
        if refresh_str:
            refresh = RefreshToken(refresh_str)
            _apply_remember_me(refresh, remember_me)
            _sync_outstanding_token_expiry(refresh)
            _set_refresh_cookie(response, str(refresh), remember_me=remember_me)

        self._record(request, identifier, succeeded=True, user=user, store_id=store_id)
        return response

    def throttled(self, request, wait) -> None:
        self._record(request, _login_identifier(request), failure_reason=LoginAttempt.FAILURE_THROTTLED)
        super().throttled(request, wait)

    @staticmethod
    def _record(request, identifier: str, *, succeeded: bool = False, failure_reason: str = "", user=None, store_id=None) -> None:
        LoginAttempt.record(
            identifier=identifier,
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            succeeded=succeeded,
            failure_reason=failure_reason,
            user=user,
            store_id=store_id,
        )


class RefreshTokenView(TokenRefreshView):
    """JWT refresh endpoint protected against retry storms and token replay abuse.

    Reads the refresh token from its httpOnly cookie (never the request
    body) and rewrites that same cookie when rotation mints a new one.
    """

    throttle_classes = [TokenRefreshIpThrottle, TokenRefreshIdentityThrottle]

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_TOKEN_COOKIE_NAME)
        if not refresh:
            return validation_error("Sessao expirada. Faca login novamente.")

        # Read remember_me from the incoming token *before* rotation below
        # mints a fresh one with no memory of it -- ROTATE_REFRESH_TOKENS
        # resets exp to the global default on every refresh unless each
        # rotation re-stamps the claim and re-applies the lifetime itself.
        try:
            incoming = RefreshToken(refresh)
            remember_me = bool(incoming.payload.get("remember_me"))
        except TokenError:
            remember_me = False

        serializer = self.get_serializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as error:
            raise InvalidToken(error.args[0])

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        new_refresh_str = response.data.pop("refresh", None)
        if new_refresh_str:
            new_refresh = RefreshToken(new_refresh_str)
            _apply_remember_me(new_refresh, remember_me)
            _sync_outstanding_token_expiry(new_refresh)
            _set_refresh_cookie(response, str(new_refresh), remember_me=remember_me)
        return response


class LogoutView(APIView):
    """Blacklist the caller's refresh cookie so it can no longer mint new access tokens."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_TOKEN_COOKIE_NAME)
        if not refresh:
            return validation_error("Nenhuma sessao para encerrar.")

        try:
            token = RefreshToken(refresh)
        except TokenError:
            return validation_error("Token de atualizacao invalido ou expirado.")

        if str(token.payload.get("user_id")) != str(request.user.id):
            return validation_error("Token de atualizacao invalido ou expirado.")

        token.blacklist()

        response = Response({"message": "Logout realizado com sucesso."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


class LogoutAllDevicesView(APIView):
    """Blacklist every outstanding refresh token for the caller (logout everywhere).

    Built on the 1.1 blacklist infrastructure: without it, there would be no
    way to revoke sessions the caller isn't currently holding a token for.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        revoked_count = _blacklist_all_outstanding_tokens(request.user)

        response = Response(
            {
                "message": "Sessao encerrada em todos os dispositivos.",
                "revoked_count": revoked_count,
            },
            status=status.HTTP_200_OK,
        )
        _clear_refresh_cookie(response)
        return response


class MfaSetupView(APIView):
    """Generate a new, unconfirmed TOTP secret + QR code for the caller.

    Re-running this overwrites any other unconfirmed device (e.g. an
    abandoned setup attempt), but refuses to touch an already-confirmed one
    -- disable first to reconfigure.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        existing = TOTPDevice.objects.filter(user=request.user).first()
        if existing is not None and existing.confirmed:
            return validation_error("MFA ja esta ativado. Desative antes de reconfigurar.")

        secret = generate_totp_secret()
        device, _created = TOTPDevice.objects.update_or_create(
            user=request.user,
            defaults={"confirmed": False, "confirmed_at": None},
        )
        device.set_secret(secret)
        device.save(update_fields=["encrypted_secret", "confirmed", "confirmed_at"])

        account_label = request.user.email or request.user.username
        provisioning_uri = build_provisioning_uri(secret, account_label)

        return Response(
            {
                "secret": secret,
                "provisioning_uri": provisioning_uri,
                "qr_code": build_qr_code_data_uri(provisioning_uri),
            },
            status=status.HTTP_200_OK,
        )


class MfaSetupConfirmView(APIView):
    """Confirm a pending TOTP device with a live code, activating MFA and issuing backup codes."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        device = TOTPDevice.objects.filter(user=request.user, confirmed=False).first()
        if device is None:
            return validation_error("Nenhuma configuracao de MFA pendente. Inicie o setup novamente.")

        code = request.data.get("code") if hasattr(request.data, "get") else None
        if not verify_totp_code(device.get_secret(), str(code or "")):
            return validation_error("Codigo invalido. Confira o app autenticador e tente novamente.")

        device.confirmed = True
        device.confirmed_at = timezone.now()
        device.save(update_fields=["confirmed", "confirmed_at"])

        backup_codes = MFABackupCode.generate_for_user(request.user)

        return Response(
            {"message": "MFA ativado com sucesso.", "backup_codes": backup_codes},
            status=status.HTTP_200_OK,
        )


class MfaDisableView(APIView):
    """Disable MFA for the caller. Requires re-entering the password as a confirmation step."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        password = request.data.get("password") if hasattr(request.data, "get") else None
        if not password or not request.user.check_password(password):
            return validation_error("Senha incorreta.")

        TOTPDevice.objects.filter(user=request.user).delete()
        MFABackupCode.objects.filter(user=request.user).delete()

        return Response({"message": "MFA desativado."}, status=status.HTTP_200_OK)


class MfaVerifyView(APIView):
    """Second step of login when MFA is enabled: exchange an mfa_token + code for real tokens."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [MfaVerifyIpThrottle]

    def post(self, request, *args, **kwargs):
        data = request.data if hasattr(request.data, "get") else {}
        mfa_token = data.get("mfa_token")
        code = str(data.get("code") or "")
        backup_code = data.get("backup_code")

        challenge = read_mfa_challenge_payload(mfa_token) if mfa_token else None
        user_id = challenge.get("user_id") if challenge else None
        remember_me = bool(challenge.get("remember_me")) if challenge else False
        user = User.objects.filter(pk=user_id, is_active=True).first() if user_id else None
        device = TOTPDevice.objects.filter(user=user, confirmed=True).first() if user else None

        if user is None or device is None:
            return validation_error("Sessao de verificacao invalida ou expirada. Faca login novamente.")

        verified = verify_totp_code(device.get_secret(), code) if code else False
        if not verified and backup_code:
            verified = MFABackupCode.consume(user, str(backup_code))

        ip_address = _client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        if not verified:
            LoginAttempt.record(
                identifier=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
                succeeded=False,
                failure_reason=LoginAttempt.FAILURE_MFA_INVALID,
                user=user,
            )
            return validation_error("Codigo invalido.")

        membership = StoreMembership.objects.filter(user=user).select_related("store").first()
        LoginAttempt.record(
            identifier=user.username,
            ip_address=ip_address,
            user_agent=user_agent,
            succeeded=True,
            user=user,
            store_id=membership.store_id if membership else None,
        )

        refresh = StoreScopedTokenObtainPairSerializer.get_token(user)
        _apply_remember_me(refresh, remember_me)
        _sync_outstanding_token_expiry(refresh)
        response = Response({"access": str(refresh.access_token)}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, str(refresh), remember_me=remember_me)
        return response


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
        context = serializer.validated_data.get(
            "registration_context", RegisterUserSerializer.CONTEXT_DASHBOARD_OWNER
        )

        if context == RegisterUserSerializer.CONTEXT_STOREFRONT_CUSTOMER:
            message = "Conta de cliente criada com sucesso."
            profile_kind = "customer"
        else:
            message = "Cadastro realizado com sucesso. Voce ja pode acessar sua conta."
            profile_kind = "dashboard_owner"

        return Response(
            {
                "message": message,
                "email": user.email,
                "profile_kind": profile_kind,
                "registration_context": context,
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

        # A password reset is exactly the moment a session might have been
        # compromised (that's plausibly *why* the user is resetting it) --
        # revoke every existing refresh token so a leaked one stops working
        # the instant the new password takes effect, not just for the next
        # legitimate login.
        _blacklist_all_outstanding_tokens(user)

        response = Response(
            {
                "message": "Senha redefinida com sucesso. Voce ja pode acessar sua conta.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )
        _clear_refresh_cookie(response)
        return response

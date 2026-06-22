from datetime import datetime, time as time_of_day, timedelta
from decimal import Decimal
from typing import NamedTuple, Optional
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .bot_engine import build_bot_reply
from .errors import business_logic_error, not_found_error, validation_error
from .models import (
    BotConversation,
    BotMessage,
    Category,
    DeliveryRegion,
    Product,
    SaleOrder,
    SaleOrderItem,
    Store,
    StoreSettings,
)
from .pagination import ProductListPagination, StandardPagination
from .permissions import (
    AllowAnyReadDashboardWrite,
    DashboardReadWritePermission,
    IsDashboardReadRole,
    has_dashboard_read_access,
    has_dashboard_write_access,
)
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
    SaleOrderStatusUpdateSerializer,
    SaleOrderSerializer,
    SaleOrderSummarySerializer,
    SaleOrderTimeseriesPointSerializer,
    StoreScopedTokenObtainPairSerializer,
    StoreSerializer,
    StoreSettingsSerializer,
)
from .store_scope import StoreScopedViewSetMixin, resolve_request_store
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

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        """Allow dashboard operators to update the operational order status."""
        if not has_dashboard_write_access(request.user):
            raise PermissionDenied("Voce nao possui permissao para alterar pedidos.")

        order = self.get_object()
        serializer = SaleOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        next_status = serializer.validated_data["status"]
        if order.status != next_status:
            order.status = next_status
            order.save(update_fields=["status", "updated_at"])

        return Response(self.get_serializer(order).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregate real sales revenue for the dashboard's revenue card.

        Accepts either `?period=today|7d|30d|90d|month` or an explicit
        `?start=YYYY-MM-DD&end=YYYY-MM-DD` custom range (the latter wins).
        """
        window = _resolve_period_window(request)

        def compute():
            orders = self.get_queryset().exclude(status="cancelled")

            current_qs = orders.filter(created_at__gte=window.start)
            if window.end is not None:
                current_qs = current_qs.filter(created_at__lt=window.end)
            current = current_qs.aggregate(revenue_total=Sum("total"), orders_count=Count("id"))
            revenue_total = current["revenue_total"] or Decimal("0.00")
            orders_count = current["orders_count"] or 0
            average_ticket = (revenue_total / orders_count) if orders_count else Decimal("0.00")

            previous_revenue = (
                orders.filter(
                    created_at__gte=window.previous_start, created_at__lt=window.previous_end
                ).aggregate(revenue_total=Sum("total"))["revenue_total"]
                or Decimal("0.00")
            )
            comparison_previous_period = _percentage_change(revenue_total, previous_revenue)

            last_year_end = _shift_one_year_back(window.end if window.end is not None else timezone.now())
            last_year_start = _shift_one_year_back(window.start)
            last_year_revenue = (
                orders.filter(created_at__gte=last_year_start, created_at__lt=last_year_end).aggregate(
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
            active_orders = orders.exclude(status="cancelled")

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

            period_orders = base_orders.filter(created_at__gte=window.start)
            if window.end is not None:
                period_orders = period_orders.filter(created_at__lt=window.end)

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
        queryset = BotConversation.objects.annotate(message_count=Count("messages"))

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


class LoginTokenObtainPairView(TokenObtainPairView):
    """JWT login endpoint protected by IP and submitted-identity throttles."""

    serializer_class = StoreScopedTokenObtainPairSerializer
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

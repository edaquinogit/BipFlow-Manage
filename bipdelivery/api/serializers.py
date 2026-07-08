import re
from decimal import Decimal
from urllib.parse import urljoin, urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    BotConversation,
    BotMessage,
    Category,
    CustomerProfile,
    DeliveryRegion,
    Product,
    ProductGalleryImage,
    SaleOrder,
    SaleOrderItem,
    StockMovement,
    Store,
    StoreMembership,
    StoreSettings,
    TOTPDevice,
)
from .permissions import (
    get_user_roles,
    has_dashboard_read_access,
    has_dashboard_write_access,
)

User = get_user_model()


class CurrentUserSerializer(serializers.ModelSerializer):
    """Authenticated user summary for dashboard personalization."""

    display_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    can_access_dashboard = serializers.SerializerMethodField()
    can_manage_catalog = serializers.SerializerMethodField()
    can_manage_orders = serializers.SerializerMethodField()
    mfa_enabled = serializers.SerializerMethodField()
    profile_kinds = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "is_staff",
            "is_superuser",
            "roles",
            "can_access_dashboard",
            "can_manage_catalog",
            "can_manage_orders",
            "mfa_enabled",
            "profile_kinds",
        ]
        read_only_fields = fields

    def get_display_name(self, user: User) -> str:
        """Return the best available human-friendly user name."""
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name

        if user.email:
            return user.email.split("@", 1)[0]

        return user.username

    def get_roles(self, user: User) -> list[str]:
        """Return dashboard role labels assigned through Django groups/staff flags."""
        return get_user_roles(user)

    def get_can_access_dashboard(self, user: User) -> bool:
        """Expose whether the user can read private dashboard resources."""
        return has_dashboard_read_access(user)

    def get_can_manage_catalog(self, user: User) -> bool:
        """Expose whether the user can mutate catalog and freight resources."""
        return has_dashboard_write_access(user)

    def get_can_manage_orders(self, user: User) -> bool:
        """Expose whether the user can mutate order status/shipping data.

        Same underlying gate as can_manage_catalog today -- there is no
        per-feature RBAC yet (decisao arquitetural 7, fase 1 of
        docs/architecture/pedidos-nf-envio-evolution.md). A stricter,
        separately-assignable role is deferred to when the truly sensitive
        fiscal actions (NF-e emission/cancellation) ship.
        """
        return has_dashboard_write_access(user)

    def get_mfa_enabled(self, user: User) -> bool:
        """Expose whether a confirmed TOTP device is active for this account."""
        return TOTPDevice.objects.filter(user=user, confirmed=True).exists()

    def get_profile_kinds(self, user: User) -> list[str]:
        """Return a coarse-grained profile map for frontend routing decisions."""
        kinds: list[str] = []

        if user.is_staff or user.is_superuser:
            kinds.append("platform_admin")

        if user.store_memberships.filter(role=StoreMembership.ROLE_OWNER).exists():
            kinds.append("dashboard_owner")
        elif user.store_memberships.exists():
            kinds.append("dashboard_member")

        if user.customer_profiles.exists():
            kinds.append("customer")

        return kinds


class StoreScopedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embed the user's store in the JWT (Etapa 3 of the multi-tenant evolution).

    Resolved once at login from StoreMembership and carried by the refresh
    token, so it also reaches every access token minted via refresh without
    extra wiring. Users without a membership (none exist outside the Etapa 1
    backfill yet) simply get no claim; request-side resolution then falls
    back to the single default store, identical to today's behaviour.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        membership = StoreMembership.objects.filter(user=user).select_related("store").first()

        if membership is not None:
            token["store_id"] = membership.store.id
            return token

        # No dashboard membership: fall back to a storefront customer
        # profile (see docs/architecture/customer-profile-checkout-
        # evolution.md) so a customer's JWT also carries a store_id claim,
        # not just staff/owner logins.
        customer_profile = (
            CustomerProfile.objects.filter(user=user).select_related("store").first()
        )
        if customer_profile is not None:
            token["store_id"] = customer_profile.store.id

        return token


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model with essential fields only."""

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description"]


class ProductSerializer(serializers.ModelSerializer):
    """
    Serializer for Product model with nested category name.

    Handles conversion of ImageField to absolute URI for API responses.
    Includes read-only computed fields for category relationships.
    """

    category_name = serializers.ReadOnlyField(source="category.name")
    images = serializers.SerializerMethodField()
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        max_length=3,
    )
    existing_images = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        max_length=3,
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "public_code",
            "name",
            "slug",
            "description",
            "price",
            "size",
            "stock_quantity",
            "low_stock_threshold",
            "is_available",
            "image",
            "images",
            "uploaded_images",
            "existing_images",
            "category",
            "category_name",
            "created_at",
        ]
        read_only_fields = ["id", "public_code", "slug", "created_at", "category_name"]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        request_images = self._resolve_ordered_request_images(self.instance)

        if request_images is not None:
            total_images = len(request_images)
        else:
            uploaded_images = attrs.get("uploaded_images", [])
            existing_images = attrs.get("existing_images", [])
            direct_image = attrs.get("image")
            total_images = len(uploaded_images) + len(existing_images) + (1 if direct_image else 0)

        if total_images > 3:
            raise serializers.ValidationError(
                {"uploaded_images": "Cada produto pode ter no maximo 3 imagens."}
            )

        return attrs

    def get_images(self, instance):
        request = self.context.get("request")
        image_urls = instance.public_image_urls

        if request is not None:
            return [request.build_absolute_uri(url) for url in image_urls]

        base_url = getattr(settings, "BASE_URL", "http://127.0.0.1:8000")
        return [urljoin(base_url, url) for url in image_urls]

    def _replace_gallery(self, instance: Product, ordered_files: list) -> None:
        """Persist gallery images while keeping the first image as product cover."""
        cover_image = ordered_files[0] if ordered_files else None
        instance.image = cover_image
        instance.save(update_fields=["image"])

        instance.gallery_images.all().delete()

        for index, image_file in enumerate(ordered_files[1:], start=1):
            ProductGalleryImage.objects.create(
                product=instance,
                image=image_file,
                position=index,
            )

    def _build_current_image_lookup(self, instance: Product | None) -> dict[str, object]:
        if not instance:
            return {}

        request = self.context.get("request")
        base_url = getattr(settings, "BASE_URL", "http://127.0.0.1:8000")
        current_by_url: dict[str, object] = {}

        def register_image(image_field) -> None:
            if not image_field:
                return

            relative_url = image_field.url
            absolute_url = (
                request.build_absolute_uri(relative_url)
                if request is not None
                else urljoin(base_url, relative_url)
            )

            current_by_url[relative_url] = image_field
            current_by_url[absolute_url] = image_field
            current_by_url[urlparse(relative_url).path] = image_field
            current_by_url[urlparse(absolute_url).path] = image_field

        register_image(instance.image)

        for gallery_item in instance.gallery_images.all():
            register_image(gallery_item.image)

        return current_by_url

    def _resolve_existing_image(self, instance: Product | None, url: str):
        if not instance or not url:
            return None

        current_by_url = self._build_current_image_lookup(instance)
        normalized_url = url.strip()
        normalized_path = urlparse(normalized_url).path
        return current_by_url.get(normalized_url) or current_by_url.get(normalized_path)

    def _resolve_existing_images(self, instance: Product | None, urls: list[str]) -> list:
        resolved_files = []

        for url in urls:
            resolved_image = self._resolve_existing_image(instance, url)
            if resolved_image is not None:
                resolved_files.append(resolved_image)

        return resolved_files[:3]

    def _collect_indexed_request_values(
        self, request, field_name: str, *, files: bool
    ) -> list[tuple[int, object]]:
        source = request.FILES if files else request.data
        entries: list[tuple[int, object]] = []
        pattern = re.compile(rf"^{re.escape(field_name)}\[(\d+)\]$")

        if not hasattr(source, "keys"):
            return entries

        for key in source.keys():
            match = pattern.match(str(key))
            if not match:
                continue

            index = int(match.group(1))
            values = source.getlist(key) if hasattr(source, "getlist") else [source.get(key)]

            for value in values:
                if value in (None, ""):
                    continue
                entries.append((index, value))

        return sorted(entries, key=lambda item: item[0])

    def _extract_ordered_request_images(self) -> list[object] | None:
        request = self.context.get("request")
        if request is None:
            return None

        ordered_entries: list[tuple[int, object]] = []
        cover_image = request.FILES.get("image")

        if cover_image is not None:
            ordered_entries.append((0, cover_image))

        indexed_existing = self._collect_indexed_request_values(
            request, "existing_images", files=False
        )
        indexed_uploaded = self._collect_indexed_request_values(
            request, "uploaded_images", files=True
        )

        if indexed_existing or indexed_uploaded:
            ordered_entries.extend(indexed_existing)
            ordered_entries.extend(indexed_uploaded)
            ordered_entries.sort(key=lambda item: item[0])
            return [value for _, value in ordered_entries]

        fallback_entries: list[object] = []
        if cover_image is not None:
            fallback_entries.append(cover_image)

        if hasattr(request.data, "getlist"):
            fallback_entries.extend(
                value
                for value in request.data.getlist("existing_images")
                if isinstance(value, str) and value.strip()
            )

        if hasattr(request.FILES, "getlist"):
            fallback_entries.extend(
                value for value in request.FILES.getlist("uploaded_images") if value is not None
            )

        return fallback_entries or None

    def _resolve_ordered_request_images(self, instance: Product | None) -> list | None:
        ordered_entries = self._extract_ordered_request_images()
        if ordered_entries is None:
            return None

        resolved_images = []
        for entry in ordered_entries:
            if isinstance(entry, str):
                resolved_image = self._resolve_existing_image(instance, entry)
                if resolved_image is not None:
                    resolved_images.append(resolved_image)
                continue

            resolved_images.append(entry)

        return resolved_images[:3]

    def create(self, validated_data):
        ordered_request_images = self._resolve_ordered_request_images(None)
        uploaded_images = list(validated_data.pop("uploaded_images", []))
        validated_data.pop("existing_images", [])
        direct_image = validated_data.pop("image", None)

        if ordered_request_images is not None:
            product = super().create(validated_data)
            self._replace_gallery(product, ordered_request_images[:3])
            return product

        if direct_image:
            uploaded_images.insert(0, direct_image)

        product = super().create(validated_data)
        self._replace_gallery(product, uploaded_images[:3])
        return product

    def update(self, instance, validated_data):
        ordered_request_images = self._resolve_ordered_request_images(instance)
        uploaded_images = list(validated_data.pop("uploaded_images", []))
        existing_images = list(validated_data.pop("existing_images", []))
        direct_image = validated_data.pop("image", None)

        product = super().update(instance, validated_data)

        if ordered_request_images is not None:
            self._replace_gallery(product, ordered_request_images[:3])
            return product

        next_images = self._resolve_existing_images(product, existing_images)
        if direct_image:
            next_images.insert(0, direct_image)
        next_images.extend(uploaded_images)

        if existing_images or uploaded_images or direct_image is not None:
            self._replace_gallery(product, next_images[:3])

        return product

    def to_representation(self, instance):
        """
        Override to_representation to return absolute URL for image field.

        Converts the relative image path to an absolute URL for API responses.
        """
        data = super().to_representation(instance)
        request = self.context.get("request")

        if instance.image:
            if request is not None:
                data["image"] = request.build_absolute_uri(instance.image.url)
            else:
                # Fallback: build URL manually if no request context
                base_url = getattr(settings, "BASE_URL", "http://127.0.0.1:8000")
                data["image"] = urljoin(base_url, instance.image.url)
        else:
            data["image"] = None

        return data


class StockMovementSerializer(serializers.ModelSerializer):
    """Read-only representation of a stock movement for history/audit display.

    Used both nested under a product (Etapa 1's per-product history) and by
    the store-wide ledger (Etapa 2) -- product_name/sku are redundant in the
    former (the caller already has the product) but let the ledger render a
    flat table without a second per-row lookup.
    """

    movement_type_display = serializers.CharField(
        source="get_movement_type_display", read_only=True
    )
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    product_name = serializers.ReadOnlyField(source="product.name")
    product_sku = serializers.ReadOnlyField(source="product.sku")
    performed_by_username = serializers.ReadOnlyField(source="performed_by.username")
    sale_order_reference = serializers.ReadOnlyField(source="sale_order.order_reference")

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "movement_type",
            "movement_type_display",
            "quantity",
            "previous_stock",
            "new_stock",
            "reason",
            "reason_display",
            "source",
            "source_display",
            "sale_order",
            "sale_order_reference",
            "performed_by",
            "performed_by_username",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


class StockMovementCreateSerializer(serializers.Serializer):
    """Validates the POST body for a manual stock movement.

    Not a ModelSerializer: the actual write happens through
    stock.apply_stock_movement(), not serializer.save(), since the mutation
    needs to lock the product row and compute previous/new stock atomically.
    """

    movement_type = serializers.ChoiceField(choices=StockMovement.TYPE_CHOICES)
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.ChoiceField(choices=StockMovement.REASON_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate_reason(self, value):
        if value in StockMovement.SYSTEM_ONLY_REASONS:
            raise serializers.ValidationError("Este motivo é de uso exclusivo do sistema.")
        return value


class DeliveryRegionSerializer(serializers.ModelSerializer):
    """Delivery region fee configuration used by dashboard and public checkout."""

    class Meta:
        model = DeliveryRegion
        fields = [
            "id",
            "name",
            "city",
            "neighborhoods",
            "delivery_fee",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


PUBLIC_STORE_SETTINGS_FIELDS = ("whatsapp_phone_digits", "is_whatsapp_configured")


class StoreSerializer(serializers.ModelSerializer):
    """Resolved tenant identity. Etapa 1: always the single default store."""

    status = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            "id",
            "name",
            "slug",
            "logo_url",
            "tagline",
            "whatsapp_phone",
            "theme",
            "is_active",
            "status",
            "receipt_exchange_policy",
            "receipt_paper_format",
        ]
        read_only_fields = fields

    def get_status(self, store: Store) -> str:
        return "active" if store.is_active else "inactive"


class StoreRenameSerializer(serializers.Serializer):
    """Validate a store rename request (Etapa 4: owners can fix a store's name)."""

    name = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate_name(self, value: str) -> str:
        normalized_name = value.strip()
        if len(normalized_name) < 2:
            raise serializers.ValidationError("Informe um nome de loja com pelo menos 2 caracteres.")
        return normalized_name


class StoreReceiptSettingsSerializer(serializers.Serializer):
    """Validate a PDV receipt settings update (exchange policy + print format).

    Both fields are optional so the dashboard's "Recibo" settings tab can
    send just the one field the merchant edited -- a blank
    `receipt_exchange_policy` is a valid, meaningful value (it means "don't
    show a policy line on the printed receipt at all"), not an omission.
    """

    receipt_exchange_policy = serializers.CharField(
        max_length=280, required=False, allow_blank=True, trim_whitespace=True
    )
    receipt_paper_format = serializers.ChoiceField(
        choices=Store.RECEIPT_PAPER_FORMAT_CHOICES, required=False
    )


class PublicStoreSettingsSerializer(serializers.ModelSerializer):
    """Safe public store contact settings exposed to the catalog."""

    whatsapp_phone_digits = serializers.SerializerMethodField()
    is_whatsapp_configured = serializers.SerializerMethodField()

    class Meta:
        model = StoreSettings
        fields = PUBLIC_STORE_SETTINGS_FIELDS
        read_only_fields = PUBLIC_STORE_SETTINGS_FIELDS

    def get_whatsapp_phone_digits(self, settings_instance: StoreSettings) -> str:
        """Return normalized phone digits used by checkout redirects."""
        return settings_instance.whatsapp_phone_digits

    def get_is_whatsapp_configured(self, settings_instance: StoreSettings) -> bool:
        """Expose whether checkout can generate a direct WhatsApp URL."""
        return bool(settings_instance.whatsapp_phone_digits)


class StoreSettingsSerializer(PublicStoreSettingsSerializer):
    """Dashboard-owned store settings used by the public checkout."""

    class Meta(PublicStoreSettingsSerializer.Meta):
        fields = [
            "id",
            "whatsapp_phone",
            "whatsapp_phone_digits",
            "is_whatsapp_configured",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            *PUBLIC_STORE_SETTINGS_FIELDS,
            "created_at",
            "updated_at",
        ]

    def validate_whatsapp_phone(self, value: str) -> str:
        """Accept formatted phone input but persist digits for reliable wa.me links."""
        phone = value.strip()

        if not phone:
            return ""

        phone_digits = StoreSettings.normalize_phone(phone)

        if len(phone_digits) < 10 or len(phone_digits) > 15:
            raise serializers.ValidationError(
                "Informe o WhatsApp com DDD e codigo do pais. Ex.: 5571999999999."
            )

        return phone_digits


class BotMessageRequestSerializer(serializers.Serializer):
    """Incoming public message handled by the rule-based bot MVP."""

    message = serializers.CharField(max_length=500, trim_whitespace=True)
    conversation_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    session_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    customer_phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    channel = serializers.ChoiceField(
        choices=["web", "whatsapp"],
        default="web",
        required=False,
    )


class BotOptionSerializer(serializers.Serializer):
    """Small command option that a frontend widget can render as a quick reply."""

    label = serializers.CharField()
    value = serializers.CharField()
    kind = serializers.ChoiceField(
        choices=["quick_reply", "whatsapp_link"],
        default="quick_reply",
        required=False,
    )
    description = serializers.CharField(required=False, allow_blank=True)
    url = serializers.CharField(required=False, allow_blank=True)


class BotProductSuggestionSerializer(serializers.Serializer):
    """Compact product payload for bot replies."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField(allow_blank=True, allow_null=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = serializers.IntegerField()


class BotDeliveryRegionSuggestionSerializer(serializers.Serializer):
    """Compact active delivery region payload for bot replies."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    city = serializers.CharField(allow_blank=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2)


class BotMessageResponseSerializer(serializers.Serializer):
    """Structured response from the rule-based bot MVP."""

    conversation_id = serializers.IntegerField()
    session_id = serializers.CharField()
    conversation_status = serializers.CharField()
    intent = serializers.ChoiceField(
        choices=[
            "greeting",
            "catalog",
            "product_search",
            "delivery",
            "checkout",
            "human_support",
            "fallback",
        ]
    )
    reply = serializers.CharField()
    options = BotOptionSerializer(many=True)
    products = BotProductSuggestionSerializer(many=True)
    delivery_regions = BotDeliveryRegionSuggestionSerializer(many=True)


class BotConversationMessageSerializer(serializers.ModelSerializer):
    """Read-only persisted bot message for dashboard review."""

    class Meta:
        model = BotMessage
        fields = [
            "id",
            "role",
            "content",
            "intent",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields


class BotConversationOrderSerializer(serializers.Serializer):
    """The order a bot conversation converted into, shown on the dashboard."""

    order_reference = serializers.CharField()
    status = serializers.CharField()
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    created_at = serializers.DateTimeField()


class BotConversationSummarySerializer(serializers.ModelSerializer):
    """Compact bot conversation payload for dashboard lists."""

    message_count = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    sale_order = BotConversationOrderSerializer(read_only=True, allow_null=True)

    class Meta:
        model = BotConversation
        fields = [
            "id",
            "session_id",
            "channel",
            "customer_phone",
            "status",
            "last_intent",
            "message_count",
            "last_message_preview",
            "sale_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_message_count(self, conversation: BotConversation) -> int:
        """Return the number of persisted messages in the conversation."""
        annotated_count = getattr(conversation, "message_count", None)
        if annotated_count is not None:
            return annotated_count

        return conversation.messages.count()

    def get_last_message_preview(self, conversation: BotConversation) -> str:
        """Return a short preview of the latest message for list scanning."""
        latest_message = conversation.messages.order_by("-created_at", "-id").first()
        if latest_message is None:
            return ""

        return latest_message.content[:120]


class BotConversationDetailSerializer(BotConversationSummarySerializer):
    """Detailed bot conversation payload including persisted messages."""

    messages = BotConversationMessageSerializer(many=True, read_only=True)

    class Meta(BotConversationSummarySerializer.Meta):
        fields = [
            *BotConversationSummarySerializer.Meta.fields,
            "messages",
        ]


class CheckoutItemInputSerializer(serializers.Serializer):
    """Serializer for each cart item sent during checkout."""

    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutCustomerInputSerializer(serializers.Serializer):
    """Serializer for the per-order choices still collected at checkout.

    Etapa 1 of docs/architecture/customer-profile-checkout-evolution.md:
    identity/address fields (name, phone, email, address, neighborhood,
    city) moved to `CustomerProfile` and are no longer part of this payload
    -- `CheckoutWhatsAppView` reads them from the authenticated customer's
    profile instead. Only the choices that legitimately vary per order
    (delivery/payment method, region, notes) stay here.
    """

    delivery_method = serializers.ChoiceField(choices=["delivery", "pickup"])
    payment_method = serializers.ChoiceField(choices=["pix", "card", "cash"])
    delivery_region_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


CHECKOUT_HONEYPOT_FIELDS = ("website", "company")


class CheckoutRequestSerializer(serializers.Serializer):
    """Serializer for the public product checkout request."""

    items = CheckoutItemInputSerializer(many=True)
    customer = CheckoutCustomerInputSerializer()
    bot_session_id = serializers.CharField(required=False, allow_blank=True, default="")

    @staticmethod
    def _submitted_text(data, field_name: str) -> str:
        if not hasattr(data, "get"):
            return ""

        value = data.get(field_name)
        if isinstance(value, (list, tuple)):
            value = value[0] if value else None

        return "" if value is None else str(value).strip()

    def validate_items(self, value):
        """Ensure the cart has at least one item."""
        if not value:
            raise serializers.ValidationError("items must contain at least one product")
        return value

    def validate(self, attrs):
        """Reject autofilled honeypot fields without changing the public contract."""
        initial_data = self.initial_data if hasattr(self, "initial_data") else {}
        customer_data = initial_data.get("customer", {}) if hasattr(initial_data, "get") else {}

        for field_name in CHECKOUT_HONEYPOT_FIELDS:
            if self._submitted_text(initial_data, field_name) or self._submitted_text(
                customer_data,
                field_name,
            ):
                raise serializers.ValidationError("Invalid checkout request")

        return attrs


class CheckoutItemResponseSerializer(serializers.Serializer):
    """Normalized item details returned after checkout preparation."""

    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    sku = serializers.CharField(allow_blank=True)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2)


class CheckoutCustomerResponseSerializer(serializers.Serializer):
    """Normalized customer details returned after checkout preparation."""

    full_name = serializers.CharField()
    phone = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    delivery_method = serializers.ChoiceField(choices=["delivery", "pickup"])
    payment_method = serializers.ChoiceField(choices=["pix", "card", "cash"])
    address = serializers.CharField(allow_blank=True)
    neighborhood = serializers.CharField(allow_blank=True)
    city = serializers.CharField(allow_blank=True)
    delivery_region_id = serializers.IntegerField(allow_null=True, required=False)
    delivery_region_name = serializers.CharField(allow_blank=True, required=False)
    notes = serializers.CharField(allow_blank=True)


class CheckoutResponseSerializer(serializers.Serializer):
    """Serializer for the checkout preparation response."""

    order_reference = serializers.CharField()
    items = CheckoutItemResponseSerializer(many=True)
    customer = CheckoutCustomerResponseSerializer()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    delivery_fee = serializers.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    total = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    message = serializers.CharField()
    whatsapp_url = serializers.CharField(allow_blank=True)


class SaleOrderItemSerializer(serializers.ModelSerializer):
    """Read-only sale item snapshot for dashboard history."""

    product_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = SaleOrderItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "line_total",
        ]


class SaleOrderSerializer(serializers.ModelSerializer):
    """Read-only sale order payload for the dashboard menu and history screens."""

    items = SaleOrderItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    performed_by_username = serializers.ReadOnlyField(source="performed_by.username")

    class Meta:
        model = SaleOrder
        fields = [
            "id",
            "order_reference",
            "status",
            "channel",
            "customer_name",
            "customer_phone",
            "customer_email",
            "delivery_method",
            "payment_method",
            "subtotal",
            "delivery_fee",
            "delivery_region_name",
            "total",
            "created_at",
            "item_count",
            "items",
            "performed_by_username",
        ]

    def get_item_count(self, order: SaleOrder) -> int:
        """Return the total number of product units in the order."""
        return sum(item.quantity for item in order.items.all())


class SaleOrderDetailSerializer(SaleOrderSerializer):
    """Full sale order payload for the dashboard's order detail view.

    Adds delivery address, customer notes/message and shipping data on top
    of the list payload (Etapas 0/1 of the pedidos/NF/envio evolution) --
    kept out of SaleOrderSerializer so the list endpoint doesn't inflate
    every row with fields only the detail screen needs.
    """

    class Meta(SaleOrderSerializer.Meta):
        fields = SaleOrderSerializer.Meta.fields + [
            "address",
            "neighborhood",
            "city",
            "notes",
            "message",
            "whatsapp_url",
            "carrier_name",
            "tracking_code",
            "tracking_url",
            "shipped_at",
            "delivered_at",
        ]


class SaleOrderStatusUpdateSerializer(serializers.Serializer):
    """Validate dashboard sale status transitions.

    carrier_name/tracking_code are only required when the transition target
    is "sent" -- that dependency is checked in the view, where the current
    order's delivery_method is known (see get_allowed_next_statuses in
    shipping.py, Etapa 1 of the pedidos/NF/envio evolution).
    """

    status = serializers.ChoiceField(
        choices=[choice[0] for choice in SaleOrder.STATUS_CHOICES],
    )
    carrier_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    tracking_code = serializers.CharField(required=False, allow_blank=True, max_length=64)


class SaleOrderSummarySerializer(serializers.Serializer):
    """Aggregated real sales revenue for the dashboard's revenue card."""

    period = serializers.CharField()
    revenue_total = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    orders_count = serializers.IntegerField()
    average_ticket = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    comparison_previous_period = serializers.DecimalField(
        max_digits=6, decimal_places=2, allow_null=True
    )
    comparison_same_period_last_year = serializers.DecimalField(
        max_digits=6, decimal_places=2, allow_null=True
    )


class SaleOrderTimeseriesPointSerializer(serializers.Serializer):
    """One day of aggregated sales for the dashboard's revenue trend chart."""

    date = serializers.DateField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    orders_count = serializers.IntegerField()


class TopProductBreakdownSerializer(serializers.Serializer):
    """A best-selling product within a dashboard summary period."""

    product_id = serializers.IntegerField(allow_null=True)
    product_name = serializers.CharField()
    image_url = serializers.CharField(allow_null=True)
    quantity_total = serializers.IntegerField()
    revenue_total = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))


class PaymentMethodBreakdownSerializer(serializers.Serializer):
    """Revenue share for a single payment method within the period."""

    payment_method = serializers.CharField()
    revenue_total = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    orders_count = serializers.IntegerField()


class StatusBreakdownSerializer(serializers.Serializer):
    """Order count for a single operational status within the period."""

    status = serializers.CharField()
    orders_count = serializers.IntegerField()


class RegionBreakdownSerializer(serializers.Serializer):
    """Revenue share for a single delivery region (or pickup) within the period."""

    region = serializers.CharField()
    revenue_total = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    orders_count = serializers.IntegerField()


class ChannelBreakdownSerializer(serializers.Serializer):
    """Revenue share for a single sales channel (virtual vs. loja física) within the period.

    Etapa 5 of the QR-code stock-exit evolution: turns SaleOrder.channel
    (Etapa 3) into the same kind of dashboard insight by_payment_method
    already gives for payment methods.
    """

    channel = serializers.CharField()
    revenue_total = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    orders_count = serializers.IntegerField()


class SaleOrderBreakdownSerializer(serializers.Serializer):
    """Sales breakdown by product, payment method, region, status and channel for the dashboard."""

    period = serializers.CharField()
    top_products = TopProductBreakdownSerializer(many=True)
    by_payment_method = PaymentMethodBreakdownSerializer(many=True)
    by_status = StatusBreakdownSerializer(many=True)
    by_region = RegionBreakdownSerializer(many=True)
    by_channel = ChannelBreakdownSerializer(many=True)


class SaleOrderCustomerInsightsSerializer(serializers.Serializer):
    """Bot-to-sale conversion and new-vs-returning customer mix for the dashboard."""

    period = serializers.CharField()
    new_customers = serializers.IntegerField()
    returning_customers = serializers.IntegerField()
    bot_conversations_count = serializers.IntegerField()
    bot_converted_count = serializers.IntegerField()
    bot_conversion_rate = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)


class RegisterUserSerializer(serializers.Serializer):
    """Register a new active user account with password validation.

    Etapa 4 of the multi-tenant evolution: registration also creates the
    user's first Store and an owner StoreMembership, so a self-registered
    account can use the dashboard without an operator manually assigning a
    Django group first.
    """

    CONTEXT_DASHBOARD_OWNER = "dashboard_owner"
    CONTEXT_STOREFRONT_CUSTOMER = "storefront_customer"
    CONTEXT_CHOICES = (
        (CONTEXT_DASHBOARD_OWNER, "Dashboard owner"),
        (CONTEXT_STOREFRONT_CUSTOMER, "Storefront customer"),
    )

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    registration_context = serializers.ChoiceField(
        choices=CONTEXT_CHOICES,
        required=False,
        default=CONTEXT_DASHBOARD_OWNER,
    )
    store_name = serializers.CharField(max_length=120, trim_whitespace=True, required=False)
    store_slug = serializers.SlugField(required=False)
    full_name = serializers.CharField(max_length=160, trim_whitespace=True, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, trim_whitespace=True, required=False, allow_blank=True)
    # Optional at registration for every context; only required for
    # storefront_customer (validated below), and even then only full_name
    # and phone -- address stays optional here the same way it always was
    # optional in the pre-profile checkout form (only required later, at
    # checkout time, if the customer picks delivery over pickup).
    address = serializers.CharField(max_length=255, trim_whitespace=True, required=False, allow_blank=True)
    neighborhood = serializers.CharField(max_length=255, trim_whitespace=True, required=False, allow_blank=True)
    city = serializers.CharField(max_length=255, trim_whitespace=True, required=False, allow_blank=True)

    def validate_store_name(self, value: str) -> str:
        normalized_name = value.strip()
        if not normalized_name:
            raise serializers.ValidationError("Informe o nome da sua loja.")
        return normalized_name

    def validate_email(self, value: str) -> str:
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("Ja existe uma conta cadastrada com este email.")
        return normalized_email

    def validate(self, attrs):
        attrs = super().validate(attrs)

        password = attrs.get("password", "")
        confirm_password = attrs.get("confirm_password", "")

        if password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "As senhas informadas nao coincidem."}
            )

        preview_user = User(
            username=attrs.get("email", ""),
            email=attrs.get("email", ""),
        )

        try:
            validate_password(password, user=preview_user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)}) from error

        context = attrs.get("registration_context", self.CONTEXT_DASHBOARD_OWNER)

        if context == self.CONTEXT_DASHBOARD_OWNER:
            store_name = (attrs.get("store_name") or "").strip()
            if not store_name:
                raise serializers.ValidationError({"store_name": "Informe o nome da sua loja."})
            attrs["store_name"] = store_name

        if context == self.CONTEXT_STOREFRONT_CUSTOMER:
            store_slug = (attrs.get("store_slug") or "").strip().lower()
            if not store_slug:
                raise serializers.ValidationError({"store_slug": "Informe a loja para criar o perfil de cliente."})

            store = Store.objects.filter(slug=store_slug, is_active=True).first()
            if store is None:
                raise serializers.ValidationError({"store_slug": "Loja nao encontrada ou inativa."})

            attrs["store_slug"] = store_slug
            attrs["resolved_store"] = store

            full_name = (attrs.get("full_name") or "").strip()
            if not full_name:
                raise serializers.ValidationError({"full_name": "Informe seu nome."})
            attrs["full_name"] = full_name

            phone = (attrs.get("phone") or "").strip()
            if not phone:
                raise serializers.ValidationError({"phone": "Informe seu WhatsApp."})
            attrs["phone"] = phone

        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        context = validated_data.get("registration_context", self.CONTEXT_DASHBOARD_OWNER)

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                is_active=True,
            )

            full_name = str(validated_data.get("full_name") or "").strip()
            if full_name:
                parts = full_name.split(maxsplit=1)
                user.first_name = parts[0]
                user.last_name = parts[1] if len(parts) > 1 else ""
                user.save(update_fields=["first_name", "last_name"])

            if context == self.CONTEXT_DASHBOARD_OWNER:
                store_name = validated_data["store_name"]
                Store.create_for_owner(name=store_name, owner=user)
            else:
                store = validated_data["resolved_store"]
                CustomerProfile.objects.create(
                    user=user,
                    store=store,
                    full_name=full_name,
                    phone=str(validated_data.get("phone") or "").strip(),
                    address=str(validated_data.get("address") or "").strip(),
                    neighborhood=str(validated_data.get("neighborhood") or "").strip(),
                    city=str(validated_data.get("city") or "").strip(),
                )

        return user


class CustomerProfileSerializer(serializers.Serializer):
    """Read/update a storefront customer's own profile (identity + address).

    Etapa 0 of docs/architecture/customer-profile-checkout-evolution.md:
    `RegisterUserSerializer` already creates this row via the
    `storefront_customer` context; this is the only place it can be read
    back or edited afterwards. `delivery_region_id` is resolved against
    `context["store"]` the same way CheckoutWhatsAppView resolves it for an
    order -- the view must pass the resolved store in. No `email` field:
    the account's own (mandatory, unique) `user.email` already serves as
    the checkout contact email.
    """

    # No allow_blank on full_name/phone: required=False lets a PATCH omit
    # them entirely (partial update), but if the client DOES send one, DRF
    # rejects an empty string outright -- these are core identity fields
    # CheckoutWhatsAppView trusts unconditionally when building an order,
    # so they must never be saved blank (see docs/architecture/customer-
    # profile-checkout-evolution.md).
    full_name = serializers.CharField(max_length=160, required=False)
    phone = serializers.CharField(max_length=32, required=False)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    neighborhood = serializers.CharField(max_length=255, required=False, allow_blank=True)
    city = serializers.CharField(max_length=255, required=False, allow_blank=True)
    delivery_region_id = serializers.IntegerField(required=False, allow_null=True)
    delivery_region_name = serializers.SerializerMethodField(read_only=True)
    email = serializers.SerializerMethodField(read_only=True)

    def get_delivery_region_name(self, instance: "CustomerProfile") -> str:
        return instance.delivery_region.name if instance.delivery_region_id else ""

    def get_email(self, instance: "CustomerProfile") -> str:
        return instance.user.email

    def validate_delivery_region_id(self, value):
        if value is None:
            return value

        store = self.context["store"]
        if not DeliveryRegion.objects.filter(id=value, store=store, is_active=True).exists():
            raise serializers.ValidationError("Selected delivery region is unavailable")
        return value

    def update(self, instance: "CustomerProfile", validated_data):
        for field_name in ("full_name", "phone", "address", "neighborhood", "city"):
            if field_name in validated_data:
                setattr(instance, field_name, validated_data[field_name].strip())

        if "delivery_region_id" in validated_data:
            instance.delivery_region_id = validated_data["delivery_region_id"]

        instance.save()
        return instance


class PasswordResetRequestSerializer(serializers.Serializer):
    """Validate a password reset request without exposing whether the email exists."""

    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Validate a reset token and set a new password for the related user."""

    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    default_error_messages = {
        "invalid_link": "O link de recuperacao e invalido ou expirou.",
    }

    def validate(self, attrs):
        attrs = super().validate(attrs)

        uid = attrs.get("uid", "").strip()
        token = attrs.get("token", "").strip()
        password = attrs.get("password", "")
        confirm_password = attrs.get("confirm_password", "")

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"uid": self.error_messages["invalid_link"]})

        if not default_token_generator.check_token(user, token):
            raise serializers.ValidationError({"token": self.error_messages["invalid_link"]})

        if password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "As senhas informadas nao coincidem."}
            )

        try:
            validate_password(password, user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)}) from error

        attrs["user"] = user
        return attrs

    @staticmethod
    def build_reset_payload(user) -> dict[str, str]:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return {"uid": uid, "token": token}

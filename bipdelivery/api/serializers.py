import re
from decimal import Decimal
from urllib.parse import urljoin, urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

from .models import (
    Category,
    DeliveryRegion,
    Product,
    ProductGalleryImage,
    SaleOrder,
    SaleOrderItem,
    StoreSettings,
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
            "name",
            "slug",
            "description",
            "price",
            "size",
            "stock_quantity",
            "is_available",
            "image",
            "images",
            "uploaded_images",
            "existing_images",
            "category",
            "category_name",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "category_name"]

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


class StoreSettingsSerializer(serializers.ModelSerializer):
    """Dashboard-owned store settings used by the public checkout."""

    whatsapp_phone_digits = serializers.SerializerMethodField()
    is_whatsapp_configured = serializers.SerializerMethodField()

    class Meta:
        model = StoreSettings
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
            "whatsapp_phone_digits",
            "is_whatsapp_configured",
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

    def get_whatsapp_phone_digits(self, settings_instance: StoreSettings) -> str:
        """Return normalized phone digits used by checkout redirects."""
        return settings_instance.whatsapp_phone_digits

    def get_is_whatsapp_configured(self, settings_instance: StoreSettings) -> bool:
        """Expose whether checkout can generate a direct WhatsApp URL."""
        return bool(settings_instance.whatsapp_phone_digits)


class CheckoutItemInputSerializer(serializers.Serializer):
    """Serializer for each cart item sent during checkout."""

    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutCustomerInputSerializer(serializers.Serializer):
    """Serializer for customer checkout data."""

    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    delivery_method = serializers.ChoiceField(choices=["delivery", "pickup"])
    payment_method = serializers.ChoiceField(choices=["pix", "card", "cash"])
    delivery_region_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    neighborhood = serializers.CharField(required=False, allow_blank=True, max_length=255)
    city = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        """Require address details only when delivery is selected."""
        if attrs["delivery_method"] == "delivery":
            required_fields = {
                "address": "address is required for delivery orders",
                "neighborhood": "neighborhood is required for delivery orders",
                "city": "city is required for delivery orders",
            }

            for field_name, error_message in required_fields.items():
                if not attrs.get(field_name, "").strip():
                    raise serializers.ValidationError({field_name: error_message})

        return attrs


CHECKOUT_HONEYPOT_FIELDS = ("website", "company")


class CheckoutRequestSerializer(serializers.Serializer):
    """Serializer for the public product checkout request."""

    items = CheckoutItemInputSerializer(many=True)
    customer = CheckoutCustomerInputSerializer()

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

    class Meta:
        model = SaleOrder
        fields = [
            "id",
            "order_reference",
            "status",
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
        ]

    def get_item_count(self, order: SaleOrder) -> int:
        """Return the total number of product units in the order."""
        return sum(item.quantity for item in order.items.all())


class RegisterUserSerializer(serializers.Serializer):
    """Register a new active user account with password validation."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

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

        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            is_active=True,
        )
        return user


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

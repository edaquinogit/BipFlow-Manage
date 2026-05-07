import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


def generate_bot_session_id() -> str:
    """Return an opaque public identifier for bot conversation continuity."""
    return uuid.uuid4().hex


class Category(models.Model):
    """Product category model for organizational purposes."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)
    description = models.TextField(blank=True, null=True, help_text="Optional category description")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def save(self, *args, **kwargs) -> None:
        """
        Auto-generate slug from category name if not provided.

        Args:
            *args: Variable length argument list for parent save().
            **kwargs: Arbitrary keyword arguments for parent save().
        """
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return the category name as string representation."""
        return self.name


class Product(models.Model):
    """Product model representing items in the inventory system."""

    # Relationship
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        help_text="Product category (deletes protected)",
    )

    # Unique Identification (Essential for Barcode/Scanner)
    sku = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text="Unique product code (SKU/Barcode)",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=False, blank=True, null=True)

    # Details
    description = models.TextField(
        blank=True, help_text="Complete description for online storefront"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    size = models.CharField(
        max_length=50, blank=True, null=True, help_text="E.g: S, M, L or 42, 44"
    )

    # Inventory
    stock_quantity = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)

    # Media
    image = models.ImageField(upload_to="products/%Y/%m/", null=True, blank=True)

    # Audit (Current market standard)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs) -> None:
        """
        Auto-generate slug and manage availability status before saving.

        Generates a unique slug from product name with UUID suffix if not provided.
        Automatically updates is_available based on stock_quantity.

        Args:
            *args: Variable length argument list for parent save().
            **kwargs: Arbitrary keyword arguments for parent save().
        """
        if not self.slug:
            self.slug = slugify(self.name) + "-" + str(uuid.uuid4())[:8]

        # Auto-calculate availability based on stock
        self.is_available = self.stock_quantity > 0
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return product SKU and name as string representation."""
        return f"{self.sku} - {self.name}"

    @property
    def public_image_urls(self) -> list[str]:
        """Return all public-facing product image paths preserving display order."""
        urls: list[str] = []

        if self.image:
            urls.append(self.image.url)

        urls.extend(
            gallery_item.image.url
            for gallery_item in self.gallery_images.all()
            if gallery_item.image
        )

        return urls[:3]


class ProductGalleryImage(models.Model):
    """Additional product images used by the public detail gallery."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="gallery_images",
    )
    image = models.ImageField(upload_to="products/%Y/%m/")
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        """Return a compact identifier for admin/debug purposes."""
        return f"{self.product_id} - gallery image {self.position}"


class DeliveryRegion(models.Model):
    """Configurable delivery fee by operating region."""

    name = models.CharField(max_length=120, unique=True)
    city = models.CharField(max_length=120, blank=True)
    neighborhoods = models.TextField(blank=True, help_text="Optional comma-separated neighborhood hints")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        """Return the region name for admin/debug purposes."""
        return self.name


class StoreSettings(models.Model):
    """Singleton operational settings controlled from the dashboard."""

    singleton_key = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)
    whatsapp_phone = models.CharField(
        max_length=32,
        blank=True,
        help_text="WhatsApp number that receives public storefront orders.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Store settings"
        verbose_name_plural = "Store settings"

    def __str__(self) -> str:
        """Return a readable identifier for admin/debug purposes."""
        return "Store settings"

    @staticmethod
    def normalize_phone(phone: str) -> str:
        """Return only phone digits for WhatsApp deep links."""
        return "".join(character for character in phone if character.isdigit())

    @property
    def whatsapp_phone_digits(self) -> str:
        """Expose the normalized phone currently stored in the dashboard."""
        return self.normalize_phone(self.whatsapp_phone)

    @classmethod
    def get_solo(cls) -> "StoreSettings":
        """Return the single dashboard settings row, creating it when needed."""
        settings_instance, _created = cls.objects.get_or_create(singleton_key=1)
        return settings_instance

    @classmethod
    def get_configured_whatsapp_phone(cls) -> str:
        """Return dashboard WhatsApp phone, falling back to the environment value."""
        settings_instance = cls.objects.filter(singleton_key=1).first()
        dashboard_phone = settings_instance.whatsapp_phone_digits if settings_instance else ""

        if dashboard_phone:
            return dashboard_phone

        return cls.normalize_phone(getattr(settings, "WHATSAPP_ORDER_PHONE", ""))


class BotConversation(models.Model):
    """Conversation state for the public rule-based bot."""

    CHANNEL_WEB = "web"
    CHANNEL_WHATSAPP = "whatsapp"
    CHANNEL_CHOICES = [
        (CHANNEL_WEB, "Web"),
        (CHANNEL_WHATSAPP, "WhatsApp"),
    ]

    STATUS_OPEN = "open"
    STATUS_WAITING_CUSTOMER = "waiting_customer"
    STATUS_WAITING_HUMAN = "waiting_human"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_WAITING_CUSTOMER, "Waiting customer"),
        (STATUS_WAITING_HUMAN, "Waiting human"),
        (STATUS_CLOSED, "Closed"),
    ]

    session_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_bot_session_id,
        help_text="Public opaque identifier used by clients to continue the conversation.",
    )
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default=CHANNEL_WEB)
    customer_phone = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_OPEN)
    last_intent = models.CharField(max_length=32, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["channel", "status"]),
            models.Index(fields=["last_intent"]),
        ]

    def __str__(self) -> str:
        """Return a compact conversation identifier."""
        return f"{self.channel}:{self.session_id}"


class BotMessage(models.Model):
    """Persisted message exchanged inside a bot conversation."""

    ROLE_USER = "user"
    ROLE_BOT = "bot"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_BOT, "Bot"),
    ]

    conversation = models.ForeignKey(
        BotConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    intent = models.CharField(max_length=32, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["role"]),
        ]

    def __str__(self) -> str:
        """Return a compact message summary."""
        return f"{self.role} message in {self.conversation_id}"


class SaleOrder(models.Model):
    """Persisted checkout record used by the management dashboard."""

    STATUS_PREPARED = "prepared"
    STATUS_CHOICES = [
        (STATUS_PREPARED, "Prepared"),
        ("sent", "Sent"),
        ("cancelled", "Cancelled"),
    ]

    DELIVERY_CHOICES = [
        ("delivery", "Delivery"),
        ("pickup", "Pickup"),
    ]

    PAYMENT_CHOICES = [
        ("pix", "Pix"),
        ("card", "Card"),
        ("cash", "Cash"),
    ]

    order_reference = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PREPARED)

    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32)
    customer_email = models.EmailField(blank=True)
    delivery_method = models.CharField(max_length=16, choices=DELIVERY_CHOICES)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES)
    address = models.CharField(max_length=255, blank=True)
    neighborhood = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=255, blank=True)
    delivery_region = models.ForeignKey(
        DeliveryRegion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    delivery_region_name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    message = models.TextField(blank=True)
    whatsapp_url = models.URLField(max_length=2048, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        """Return a readable order identifier for admin/debug purposes."""
        return self.order_reference


class SaleOrderItem(models.Model):
    """Snapshot of a product line at checkout time."""

    order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sale_items",
    )
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=50, blank=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        """Return a compact line summary."""
        return f"{self.product_name} x{self.quantity}"

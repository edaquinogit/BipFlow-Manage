import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def generate_bot_session_id() -> str:
    """Return an opaque public identifier for bot conversation continuity."""
    return uuid.uuid4().hex


def product_image_upload_to(instance: "Product", filename: str) -> str:
    """Scope a product's cover image path by its store (Etapa 4)."""
    return f"products/{instance.store_id}/{timezone.now():%Y/%m}/{filename}"


def product_gallery_image_upload_to(instance: "ProductGalleryImage", filename: str) -> str:
    """Scope a product's gallery image path by its parent product's store (Etapa 4)."""
    return f"products/{instance.product.store_id}/{timezone.now():%Y/%m}/{filename}"


def get_default_store_id() -> int:
    """Resolve the single-tenant default store's PK as a field default.

    Returns the PK (not the Store instance): Django's SQLite schema editor
    resolves FK field defaults through `get_db_prep_value()` when backfilling
    existing rows during a migration, which expects a raw value it can bind
    directly rather than a model instance to introspect.

    Defined ahead of Store's own class body further below so Category,
    Product, DeliveryRegion and SaleOrder can reference it without
    reordering the file: the name only needs to resolve once this module
    has finished loading, never at class-definition time.
    """
    return Store.get_default().id


class Category(models.Model):
    """Product category model for organizational purposes."""

    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="categories",
        default=get_default_store_id,
        help_text="Tenant that owns this category (Etapa 2 of the multi-tenant evolution).",
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(blank=True, null=True)
    description = models.TextField(blank=True, null=True, help_text="Optional category description")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["store", "slug"], name="unique_category_slug_per_store"),
        ]

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
    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="products",
        default=get_default_store_id,
        help_text="Tenant that owns this product (Etapa 2 of the multi-tenant evolution).",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        help_text="Product category (deletes protected)",
    )

    # Unique Identification (Essential for Barcode/Scanner)
    sku = models.CharField(
        max_length=50,
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
    image = models.ImageField(upload_to=product_image_upload_to, null=True, blank=True)

    # Audit (Current market standard)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["store", "sku"], name="unique_product_sku_per_store"),
            models.UniqueConstraint(fields=["store", "slug"], name="unique_product_slug_per_store"),
        ]

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
    image = models.ImageField(upload_to=product_gallery_image_upload_to)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        """Return a compact identifier for admin/debug purposes."""
        return f"{self.product_id} - gallery image {self.position}"


class DeliveryRegion(models.Model):
    """Configurable delivery fee by operating region."""

    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="delivery_regions",
        default=get_default_store_id,
        help_text="Tenant that owns this delivery region (Etapa 2 of the multi-tenant evolution).",
    )
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=120, blank=True)
    neighborhoods = models.TextField(blank=True, help_text="Optional comma-separated neighborhood hints")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["store", "name"], name="unique_delivery_region_name_per_store"),
        ]

    def __str__(self) -> str:
        """Return the region name for admin/debug purposes."""
        return self.name


class Store(models.Model):
    """Tenant root entity. Etapa 3 of the multi-tenant evolution: requests now
    resolve to a specific store (JWT claim for the dashboard, `X-Store-Slug`
    header for the public catalog) and every business queryset is filtered
    by it. See docs/architecture/multi-tenant-evolution.md.
    """

    DEFAULT_SLUG = "default"

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    logo_url = models.URLField(max_length=500, blank=True)
    tagline = models.CharField(max_length=160, blank=True)
    whatsapp_phone = models.CharField(max_length=32, blank=True)
    theme = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    # Nullable: data migrations run before any user exists in a fresh
    # database (seed_dashboard_roles runs after migrate), so a NOT NULL FK
    # would break `manage.py migrate` on first deploy. Etapa 4 (onboarding)
    # assigns a real owner when stores are created through the product flow.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="owned_stores",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        """Return the store name for admin/debug purposes."""
        return self.name

    @property
    def whatsapp_phone_digits(self) -> str:
        """Expose this store's normalized WhatsApp phone digits."""
        return StoreSettings.normalize_phone(self.whatsapp_phone)

    def get_configured_whatsapp_phone(self) -> str:
        """Return this store's WhatsApp phone, falling back to the environment default.

        Mirrors StoreSettings.get_configured_whatsapp_phone() but scoped to
        this specific tenant instead of the single global singleton, for
        CheckoutWhatsAppView once it resolves a request-specific store.
        """
        if self.whatsapp_phone_digits:
            return self.whatsapp_phone_digits

        return StoreSettings.normalize_phone(getattr(settings, "WHATSAPP_ORDER_PHONE", ""))

    @classmethod
    def get_default(cls) -> "Store":
        """Return the single-tenant store, creating it when needed."""
        store, _created = cls.objects.get_or_create(
            slug=cls.DEFAULT_SLUG,
            defaults={
                "name": "Loja Principal",
                "tagline": "Catalogo online",
            },
        )
        return store

    @classmethod
    def create_for_owner(cls, *, name: str, owner) -> "Store":
        """Create a new store with a unique slug and an owner membership (Etapa 4).

        Shared by registration (a user's first store) and the dashboard's
        "new store" action (an existing user adding another one).
        """
        base_slug = slugify(name) or "loja"
        slug = base_slug
        suffix = 1
        while cls.objects.filter(slug=slug).exists():
            suffix += 1
            slug = f"{base_slug}-{suffix}"

        store = cls.objects.create(name=name, slug=slug, owner=owner)
        StoreMembership.objects.create(store=store, user=owner, role=StoreMembership.ROLE_OWNER)
        return store


class StoreMembership(models.Model):
    """Links a user to a store with a store-scoped role.

    Etapa 1 only creates this table and backfills it from the existing
    global RBAC groups; permissions still read global groups until Etapa 3.
    """

    ROLE_OWNER = "owner"
    ROLE_MANAGER = "manager"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_MANAGER, "Manager"),
        (ROLE_VIEWER, "Viewer"),
    ]

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="store_memberships",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("store", "user")
        ordering = ["store_id", "role"]

    def __str__(self) -> str:
        """Return a compact membership identifier for admin/debug purposes."""
        return f"{self.user_id} @ {self.store_id} ({self.role})"


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

    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="bot_conversations",
        default=get_default_store_id,
        help_text="Tenant this conversation belongs to.",
    )
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
    sale_order = models.ForeignKey(
        "SaleOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bot_conversations",
        help_text="The order this conversation converted into, if any.",
    )
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

    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="orders",
        default=get_default_store_id,
        help_text="Tenant that received this order (Etapa 2 of the multi-tenant evolution).",
    )
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

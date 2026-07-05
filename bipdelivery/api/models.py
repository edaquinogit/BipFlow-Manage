import secrets
import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.text import slugify

from .crypto import decrypt_secret, encrypt_secret


def generate_bot_session_id() -> str:
    """Return an opaque public identifier for bot conversation continuity."""
    return uuid.uuid4().hex


# Etapa 1 of the QR-code stock-exit evolution (see
# docs/architecture/qrcode-stock-exit-evolution.md): Product.public_code is a
# system-generated identifier meant to be printed as a QR Code, distinct from
# `sku` (manual, optional, merchant-controlled).
PRODUCT_PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L, easy to read aloud
PRODUCT_PUBLIC_CODE_LENGTH = 8
PRODUCT_PUBLIC_CODE_MAX_ATTEMPTS = 8


def generate_product_public_code() -> str:
    """Return a random public lookup code for QR-code scanning.

    Same alphabet as MFABackupCode._generate_plain_code(). Uniqueness is
    enforced per store by unique_product_public_code_per_store;
    Product._save_with_generated_public_code() retries on a collision rather
    than trusting a plain existence check, which can't be race-safe against a
    concurrent insert.
    """
    return "".join(
        secrets.choice(PRODUCT_PUBLIC_CODE_ALPHABET) for _ in range(PRODUCT_PUBLIC_CODE_LENGTH)
    )


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
    public_code = models.CharField(
        max_length=12,
        blank=True,
        default="",
        db_index=True,
        help_text=(
            "Auto-generated, immutable lookup code used by QR Code scans "
            "(PDV and public storefront deep links, see "
            "docs/architecture/qrcode-stock-exit-evolution.md). Distinct "
            "from `sku`, which stays a manual, optional field the merchant "
            "controls."
        ),
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
    low_stock_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Per-product low-stock alert threshold (Etapa 3 of the "
            "stock-movement evolution). Null means \"use the dashboard's "
            "default threshold\" -- this is a preference, not an audited "
            "quantity, so unlike stock_quantity it stays freely editable."
        ),
    )

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
            models.UniqueConstraint(
                fields=["store", "public_code"], name="unique_product_public_code_per_store"
            ),
        ]

    def save(self, *args, **kwargs) -> None:
        """
        Auto-generate slug, public_code and manage availability status before saving.

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

        if not self.public_code:
            self._save_with_generated_public_code(*args, **kwargs)
            return

        super().save(*args, **kwargs)

    def _save_with_generated_public_code(self, *args, **kwargs) -> None:
        """Assign a fresh public_code and retry the insert on a rare collision.

        A plain "check then use" query isn't race-safe against a concurrent
        insert for the same store, so this instead lets
        unique_product_public_code_per_store reject the save and retries with
        a new random code. Collisions are astronomically unlikely given the
        8-character alphabet's ~8.5e11 combinations per store, so this never
        realistically loops more than once -- but if the IntegrityError turns
        out to be about a *different* constraint (e.g. a duplicate sku), a
        new public_code can't fix that, so it's re-raised immediately instead
        of masking the real conflict behind pointless retries.
        """
        for attempt in range(PRODUCT_PUBLIC_CODE_MAX_ATTEMPTS):
            self.public_code = generate_product_public_code()
            try:
                with transaction.atomic():
                    super().save(*args, **kwargs)
                return
            except IntegrityError as exc:
                is_last_attempt = attempt == PRODUCT_PUBLIC_CODE_MAX_ATTEMPTS - 1
                if "public_code" not in str(exc) or is_last_attempt:
                    raise

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

    # PDV receipt print-format presets (see docs/architecture/
    # pdv-camera-scanner-refinement.md's receipt/print-format follow-up):
    # the two dominant thermal receipt-roll widths in Brazilian retail, plus
    # a plain-sheet fallback for stores printing on a regular printer.
    RECEIPT_PAPER_FORMAT_58MM = "58mm"
    RECEIPT_PAPER_FORMAT_80MM = "80mm"
    RECEIPT_PAPER_FORMAT_A4 = "a4"
    RECEIPT_PAPER_FORMAT_CHOICES = [
        (RECEIPT_PAPER_FORMAT_58MM, "Bobina 58mm"),
        (RECEIPT_PAPER_FORMAT_80MM, "Bobina 80mm"),
        (RECEIPT_PAPER_FORMAT_A4, "Folha A4"),
    ]
    DEFAULT_RECEIPT_EXCHANGE_POLICY = (
        "Trocas e devoluções em até 7 dias mediante apresentação deste comprovante."
    )

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    logo_url = models.URLField(max_length=500, blank=True)
    tagline = models.CharField(max_length=160, blank=True)
    whatsapp_phone = models.CharField(max_length=32, blank=True)
    theme = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    # Etapa PDV receipt refinement: store-level, editable per store (blank
    # means "don't show a policy line on the printed receipt at all") --
    # deliberately not a hardcoded "7 dias" string in the frontend template.
    receipt_exchange_policy = models.CharField(
        max_length=280, blank=True, default=DEFAULT_RECEIPT_EXCHANGE_POLICY
    )
    receipt_paper_format = models.CharField(
        max_length=10,
        choices=RECEIPT_PAPER_FORMAT_CHOICES,
        default=RECEIPT_PAPER_FORMAT_80MM,
    )
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


class CustomerProfile(models.Model):
    """Storefront customer identity scoped to a single store.

    Keeps customer onboarding separate from dashboard memberships: a customer
    can have an authenticated account for ordering and order history without
    gaining dashboard access to catalog/settings resources.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profiles",
    )
    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="customer_profiles",
    )
    full_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "store")
        ordering = ["store_id", "user_id"]

    def __str__(self) -> str:
        """Return a compact customer profile identifier for admin/debug purposes."""
        return f"customer:{self.user_id} @ {self.store_id}"


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
    STATUS_SENT = "sent"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PREPARED, "Prepared"),
        (STATUS_SENT, "Sent"),
        (STATUS_CANCELLED, "Cancelled"),
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

    # Etapa 3 of the QR-code stock-exit evolution (see
    # docs/architecture/qrcode-stock-exit-evolution.md): distinguishes the
    # existing e-commerce/WhatsApp checkout from the new PDV (physical store,
    # scanned QR Code). Default is CHANNEL_VIRTUAL so every order created
    # before this field existed keeps reading as what it always was.
    CHANNEL_VIRTUAL = "virtual"
    CHANNEL_LOJA_FISICA = "loja_fisica"
    CHANNEL_CHOICES = [
        (CHANNEL_VIRTUAL, "Virtual"),
        (CHANNEL_LOJA_FISICA, "Loja física"),
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
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default=CHANNEL_VIRTUAL)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sale_orders",
        help_text=(
            "Etapa R3 of the QR-code stock-exit refinement: the dashboard "
            "operator who rang up this sale, when there is one -- always "
            "set for a PDV sale, always null for a public/WhatsApp "
            "checkout, which has no authenticated staff involved."
        ),
    )

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
        indexes = [
            models.Index(fields=["store", "created_at"]),
            models.Index(fields=["store", "status", "created_at"]),
        ]

    def __str__(self) -> str:
        """Return a readable order identifier for admin/debug purposes."""
        return self.order_reference


class LoginAttempt(models.Model):
    """Audit trail of login attempts, success and failure (Fase 2 of the auth-security plan).

    Feeds the conditional CAPTCHA gate (`recent_failure_count`) and gives an
    admin visibility into credential-stuffing patterns. Retention is the
    operator's responsibility -- nothing here prunes old rows automatically,
    so a periodic cleanup job is needed before this grows unbounded under
    sustained attack traffic.
    """

    FAILURE_INVALID_CREDENTIALS = "invalid_credentials"
    FAILURE_THROTTLED = "throttled"
    FAILURE_CAPTCHA_REQUIRED = "captcha_required"
    FAILURE_MFA_REQUIRED = "mfa_required"
    FAILURE_MFA_INVALID = "mfa_invalid"
    FAILURE_CHOICES = [
        (FAILURE_INVALID_CREDENTIALS, "Invalid credentials"),
        (FAILURE_THROTTLED, "Throttled"),
        (FAILURE_CAPTCHA_REQUIRED, "Captcha required or invalid"),
        (FAILURE_MFA_REQUIRED, "MFA challenge issued"),
        (FAILURE_MFA_INVALID, "MFA code invalid"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_attempts",
        help_text="Resolved user, when the submitted identifier matched one. Null for unknown emails.",
    )
    identifier = models.CharField(
        max_length=255,
        help_text="Normalized (lowercased) submitted username/email.",
    )
    ip_address = models.GenericIPAddressField()
    user_agent = models.CharField(max_length=512, blank=True)
    succeeded = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=32, choices=FAILURE_CHOICES, blank=True)
    store_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["identifier", "created_at"]),
            models.Index(fields=["ip_address", "created_at"]),
        ]

    def __str__(self) -> str:
        """Return a compact, human-readable summary for admin/debug purposes."""
        outcome = "ok" if self.succeeded else (self.failure_reason or "failed")
        return f"{self.identifier} @ {self.created_at:%Y-%m-%d %H:%M} ({outcome})"

    @classmethod
    def record(
        cls,
        *,
        identifier: str,
        ip_address: str,
        user_agent: str = "",
        succeeded: bool = False,
        failure_reason: str = "",
        user=None,
        store_id: int | None = None,
    ) -> "LoginAttempt":
        return cls.objects.create(
            user=user,
            identifier=(identifier or "").strip().lower()[:255],
            ip_address=ip_address,
            user_agent=(user_agent or "")[:512],
            succeeded=succeeded,
            failure_reason=failure_reason,
            store_id=store_id,
        )

    @classmethod
    def recent_failure_count(cls, identifier: str, *, within_minutes: int = 15) -> int:
        """Count recent consecutive-looking failures, used to gate the CAPTCHA challenge."""
        normalized = (identifier or "").strip().lower()
        if not normalized:
            return 0

        since = timezone.now() - timezone.timedelta(minutes=within_minutes)
        return cls.objects.filter(
            identifier=normalized,
            succeeded=False,
            created_at__gte=since,
        ).count()


class TOTPDevice(models.Model):
    """A user's TOTP secret for MFA (Fase 3.1 of the auth-security plan).

    One per user. The secret is encrypted at rest (see crypto.py) since
    whoever holds it can generate valid codes indefinitely -- unlike a
    password, there's no hash-only storage option for a shared secret that
    both sides must reproduce the same codes from.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="totp_device",
    )
    encrypted_secret = models.BinaryField()
    confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        """Return a compact identifier for admin/debug purposes."""
        state = "confirmed" if self.confirmed else "pending"
        return f"TOTP device for {self.user_id} ({state})"

    def get_secret(self) -> str:
        return decrypt_secret(bytes(self.encrypted_secret))

    def set_secret(self, raw_secret: str) -> None:
        self.encrypted_secret = encrypt_secret(raw_secret)


class MFABackupCode(models.Model):
    """Single-use recovery code for when the user's TOTP device is unavailable.

    Stored as a hash via Django's own password hasher -- the same trusted
    primitive already used for account passwords -- never in plaintext.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa_backup_codes",
    )
    code_hash = models.CharField(max_length=255)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "used_at"])]

    def __str__(self) -> str:
        """Return a compact identifier for admin/debug purposes."""
        return f"Backup code for {self.user_id} ({'used' if self.used_at else 'unused'})"

    @staticmethod
    def _generate_plain_code() -> str:
        """Return a human-typeable single-use code, e.g. 'AB3K-9XQ2'."""
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I, easy to read aloud
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        return f"{raw[:4]}-{raw[4:]}"

    @classmethod
    def generate_for_user(cls, user, count: int = 8) -> list[str]:
        """Replace any existing codes with `count` fresh ones, returning the plaintext once."""
        cls.objects.filter(user=user).delete()
        plain_codes = [cls._generate_plain_code() for _ in range(count)]
        cls.objects.bulk_create(
            [cls(user=user, code_hash=make_password(code)) for code in plain_codes]
        )
        return plain_codes

    @classmethod
    def consume(cls, user, submitted_code: str) -> bool:
        """Check `submitted_code` against the user's unused codes, consuming it if it matches."""
        normalized = submitted_code.strip().upper()
        if not normalized:
            return False

        for backup_code in cls.objects.filter(user=user, used_at__isnull=True):
            if check_password(normalized, backup_code.code_hash):
                backup_code.used_at = timezone.now()
                backup_code.save(update_fields=["used_at"])
                return True

        return False


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


class StockMovement(models.Model):
    """Append-only audit trail for every `Product.stock_quantity` change.

    `Product.stock_quantity` stays the fast, denormalized "current value"
    column; this table is the ledger that explains every change to it
    (Etapa 1 of the stock-movement evolution, see
    docs/architecture/stock-movement-evolution.md). `quantity` is always
    positive -- direction comes from `movement_type`, never from sign.
    """

    TYPE_ENTRADA = "entrada"
    TYPE_SAIDA = "saida"
    TYPE_CHOICES = [
        (TYPE_ENTRADA, "Entrada"),
        (TYPE_SAIDA, "Saída"),
    ]

    SOURCE_MANUAL = "manual"
    SOURCE_VENDA = "venda"
    SOURCE_PDV = "pdv"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "Manual"),
        (SOURCE_VENDA, "Venda"),
        (SOURCE_PDV, "PDV"),
    ]

    REASON_COMPRA = "compra"
    REASON_DEVOLUCAO = "devolucao"
    REASON_PERDA_AVARIA = "perda_avaria"
    REASON_AJUSTE_INVENTARIO = "ajuste_inventario"
    REASON_ENTRADA_INICIAL = "entrada_inicial"
    REASON_VENDA = "venda"
    REASON_VENDA_CANCELADA = "venda_cancelada"
    REASON_OUTRO = "outro"
    REASON_CHOICES = [
        (REASON_COMPRA, "Compra"),
        (REASON_DEVOLUCAO, "Devolução"),
        (REASON_PERDA_AVARIA, "Perda/Avaria"),
        (REASON_AJUSTE_INVENTARIO, "Ajuste de inventário"),
        (REASON_ENTRADA_INICIAL, "Entrada inicial"),
        (REASON_VENDA, "Venda"),
        (REASON_VENDA_CANCELADA, "Venda cancelada"),
        (REASON_OUTRO, "Outro"),
    ]

    # System-generated reasons a human can never pick from the manual
    # entrada/saida form -- only `apply_stock_movement()`, the checkout flow
    # and `apply_order_cancellation()` (Etapa R2 of the QR-code stock-exit
    # refinement, see bipdelivery/api/stock.py) are allowed to write these.
    SYSTEM_ONLY_REASONS = {REASON_ENTRADA_INICIAL, REASON_VENDA, REASON_VENDA_CANCELADA}

    store = models.ForeignKey(
        "Store",
        on_delete=models.CASCADE,
        related_name="stock_movements",
        default=get_default_store_id,
        help_text="Tenant that owns this movement.",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stock_movements",
    )
    movement_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    quantity = models.PositiveIntegerField(
        help_text="Always positive; direction comes from movement_type."
    )
    previous_stock = models.PositiveIntegerField()
    new_stock = models.PositiveIntegerField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    sale_order = models.ForeignKey(
        SaleOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "product", "created_at"]),
            models.Index(fields=["store", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(new_stock__gte=0),
                name="stock_movement_new_stock_non_negative",
            ),
        ]

    def __str__(self) -> str:
        """Return a compact movement summary."""
        return f"{self.get_movement_type_display()} {self.quantity} - {self.product.name}"

from django.db import models
from django.utils.text import slugify
import uuid

class Category(models.Model):
    """Product category model for organizational purposes."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

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
        related_name='products',
        help_text="Product category (deletes protected)"
    )

    # Unique Identification (Essential for Barcode/Scanner)
    sku = models.CharField(
    max_length=50,
    unique=True,
    blank=True,
    null=True,
    help_text="Unique product code (SKU/Barcode)"
)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=False, blank=True, null=True)

    # Details
    description = models.TextField(blank=True, help_text="Complete description for online storefront")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    size = models.CharField(max_length=50, blank=True, null=True, help_text="E.g: S, M, L or 42, 44")

    # Inventory
    stock_quantity = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)

    # Media
    image = models.ImageField(upload_to='products/%Y/%m/', null=True, blank=True)

    # Audit (Current market standard)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

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

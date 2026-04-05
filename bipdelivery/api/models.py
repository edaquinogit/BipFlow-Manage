from __future__ import annotations

from typing import Optional
from django.db import models
from django.utils.text import slugify
import uuid


class Category(models.Model):
    """Product category with auto-generated, URL-friendly slug."""
    
    name: models.CharField = models.CharField(
        max_length=100, 
        unique=True,
        help_text="Unique category name for product classification"
    )
    slug: models.SlugField = models.SlugField(
        unique=True,
        blank=True,
        null=True,
        help_text="Auto-generated URL-friendly identifier"
    )
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural: str = "Categories"
        ordering: list[str] = ["name"]

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        """Auto-generate slug if not provided."""
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

class Product(models.Model):
    """Core product entity with inventory tracking and availability management.
    
    Features:
    - Automatic availability calculation based on stock levels
    - UUID-based slug generation to prevent collisions
    - ForeignKey protection to prevent orphaned products
    - Indexed for common query patterns (SKU, category+date)
    """
    
    # ═══════════════════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════════════════
    category: models.ForeignKey = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        help_text="Product classification (protects category deletion)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UNIQUE IDENTIFICATION (Required for barcode/scanner integration)
    # ═══════════════════════════════════════════════════════════════════════════
    sku: models.CharField = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text="Stock Keeping Unit - unique product identifier for scanning"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CORE PRODUCT DETAILS
    # ═══════════════════════════════════════════════════════════════════════════
    name: models.CharField = models.CharField(
        max_length=255,
        help_text="Display name for the product"
    )
    slug: models.SlugField = models.SlugField(
        unique=False,
        blank=True,
        null=True,
        help_text="URL-friendly identifier (auto-generated with UUID)"
    )
    description: models.TextField = models.TextField(
        blank=True,
        help_text="Full product description for storefront display"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PRICING & ATTRIBUTES
    # ═══════════════════════════════════════════════════════════════════════════
    price: models.DecimalField = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Product price in standard currency"
    )
    size: models.CharField = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Product size (e.g., S/M/L/XL or shoe size)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # INVENTORY MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════════════
    stock_quantity: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0,
        help_text="Current available quantity"
    )
    is_available: models.BooleanField = models.BooleanField(
        default=True,
        help_text="Automatically set based on stock_quantity > 0"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MEDIA & ASSETS
    # ═══════════════════════════════════════════════════════════════════════════
    image: models.ImageField = models.ImageField(
        upload_to="products/%Y/%m/",
        null=True,
        blank=True,
        help_text="Product image (stored with year/month structure)"
    )
    
    # ═══════════════════════════════════════════════════════════════════════════
    # AUDIT FIELDS (Following industry standards)
    # ═══════════════════════════════════════════════════════════════════════════
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: list[str] = ["-created_at"]
        verbose_name: str = "Product"
        verbose_name_plural: str = "Products"
        indexes: list = [
            models.Index(fields=["sku"]),
            models.Index(fields=["category", "-created_at"]),
        ]

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        """Auto-generate slug and calculate availability before saving.
        
        Ensures slug is always unique by appending UUID fragment.
        Sets is_available based on stock_quantity > 0.
        """
        if not self.slug:
            uuid_fragment: str = str(uuid.uuid4())[:8]
            self.slug = f"{slugify(self.name)}-{uuid_fragment}"
        
        # Automatic availability calculation
        self.is_available = self.stock_quantity > 0
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return SKU-based display string for admin/logs."""
        sku_display: str = self.sku or "[NO-SKU]"
        return f"{sku_display} - {self.name}"
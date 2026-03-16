from django.db import models
from django.utils.text import slugify
import uuid

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Product(models.Model):
    # Relacionamento
    category = models.ForeignKey(
        Category, 
        on_delete=models.PROTECT, # PROTECT evita deletar categoria com produtos ativos
        related_name='products'
    )
    
    # Identificação Única (Essencial para Código de Barras/Scanner)
    sku = models.CharField(
    max_length=50, 
    unique=True,      
    blank=True,     
    null=True, 
    help_text="Código único do produto (SKU/Barcode)"
)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=False, blank=True, null=True)
    
    # Detalhes
    description = models.TextField(blank=True, help_text="Descrição completa para a vitrine online")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    size = models.CharField(max_length=50, blank=True, null=True, help_text="Ex: P, M, G ou 42, 44")
    
    # Inventário
    stock_quantity = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    
    # Mídia
    image = models.ImageField(upload_to='products/%Y/%m/', null=True, blank=True)
    
    # Auditoria (Padrão de mercado atual)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name) + "-" + str(uuid.uuid4())[:8]
        
        # Lógica de disponibilidade automática
        self.is_available = self.stock_quantity > 0
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sku} - {self.name}"
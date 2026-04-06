from rest_framework import serializers
from typing import Optional
from .models import Product, Category


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model with essential fields only."""

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProductSerializer(serializers.ModelSerializer):
    """
    Serializer for Product model with nested category name.

    Handles conversion of ImageField to absolute URI for API responses.
    Includes read-only computed fields for category relationships.
    """

    category_name = serializers.ReadOnlyField(source='category.name')
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'slug', 'description',
            'price', 'size', 'stock_quantity', 'is_available',
            'image', 'category', 'category_name', 'created_at'
        ]

    def get_image(self, obj: Product) -> Optional[str]:
        """
        Convert relative image URL to absolute URI for API response.

        Args:
            obj: Product instance being serialized.

        Returns:
            Absolute image URI if image exists and request context available,
            relative image URL as fallback, or None if no image.
        """
        if obj.image:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

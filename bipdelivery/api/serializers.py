
from rest_framework import serializers

from .models import Category, Product


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

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'slug', 'description',
            'price', 'size', 'stock_quantity', 'is_available',
            'image', 'category', 'category_name', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'category_name']

    def to_representation(self, instance):
        """
        Override to_representation to return absolute URL for image field.

        Converts the relative image path to an absolute URL for API responses.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')

        if instance.image and request is not None:
            data['image'] = request.build_absolute_uri(instance.image.url)

        return data

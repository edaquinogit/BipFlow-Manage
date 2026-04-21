from decimal import Decimal
from rest_framework import serializers

from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model with essential fields only."""

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description']


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

        if instance.image:
            if request is not None:
                data['image'] = request.build_absolute_uri(instance.image.url)
            else:
                # Fallback: build URL manually if no request context
                import urllib.parse

                from django.conf import settings
                base_url = getattr(settings, 'BASE_URL', 'http://127.0.0.1:8000')
                data['image'] = urllib.parse.urljoin(base_url, instance.image.url)
        else:
            data['image'] = None

        return data


class CheckoutItemInputSerializer(serializers.Serializer):
    """Serializer for each cart item sent during checkout."""

    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutCustomerInputSerializer(serializers.Serializer):
    """Serializer for customer checkout data."""

    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    delivery_method = serializers.ChoiceField(choices=['delivery', 'pickup'])
    payment_method = serializers.ChoiceField(choices=['pix', 'card', 'cash'])
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    neighborhood = serializers.CharField(required=False, allow_blank=True, max_length=255)
    city = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        """Require address details only when delivery is selected."""
        if attrs['delivery_method'] == 'delivery':
            required_fields = {
                'address': 'address is required for delivery orders',
                'neighborhood': 'neighborhood is required for delivery orders',
                'city': 'city is required for delivery orders',
            }

            for field_name, error_message in required_fields.items():
                if not attrs.get(field_name, '').strip():
                    raise serializers.ValidationError({field_name: error_message})

        return attrs


class CheckoutRequestSerializer(serializers.Serializer):
    """Serializer for the public product checkout request."""

    items = CheckoutItemInputSerializer(many=True)
    customer = CheckoutCustomerInputSerializer()

    def validate_items(self, value):
        """Ensure the cart has at least one item."""
        if not value:
            raise serializers.ValidationError('items must contain at least one product')
        return value


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
    delivery_method = serializers.ChoiceField(choices=['delivery', 'pickup'])
    payment_method = serializers.ChoiceField(choices=['pix', 'card', 'cash'])
    address = serializers.CharField(allow_blank=True)
    neighborhood = serializers.CharField(allow_blank=True)
    city = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)


class CheckoutResponseSerializer(serializers.Serializer):
    """Serializer for the checkout preparation response."""

    order_reference = serializers.CharField()
    items = CheckoutItemResponseSerializer(many=True)
    customer = CheckoutCustomerResponseSerializer()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    message = serializers.CharField()
    whatsapp_url = serializers.CharField(allow_blank=True)

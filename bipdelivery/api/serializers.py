from rest_framework import serializers
from .models import Product, Category

# Serializer para o Dropdown do Vue
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']

class ProductSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field='name', 
        queryset=Category.objects.all()
    )

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'category', 'is_available', 'image']
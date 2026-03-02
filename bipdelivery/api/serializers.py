from rest_framework import serializers
from .models import Product, Category

class ProductSerializer(serializers.ModelSerializer):
    # Isso permite que o Vue envie o NOME da categoria e o Django encontre o ID sozinho
    category = serializers.SlugRelatedField(
        slug_field='name', 
        queryset=Category.objects.all()
    )

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'category', 'is_available', 'image']
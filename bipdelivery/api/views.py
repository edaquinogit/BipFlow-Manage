from rest_framework import generics
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer

# View para listar e criar Categorias
class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# View para listar e criar Produtos
class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

from __future__ import annotations

from typing import Type
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from django.db.models import QuerySet
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for full Product CRUD operations.
    
    Endpoint: /api/v1/products/
    Methods: GET (list, retrieve), POST (create), PATCH/PUT (update), DELETE
    Authentication: JWT Bearer token required
    """
    
    queryset: QuerySet[Product] = Product.objects.all()
    serializer_class: Type[ProductSerializer] = ProductSerializer
    permission_classes: list[Type[BasePermission]] = [IsAuthenticated]


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category management.
    
    Endpoint: /api/v1/categories/
    Methods: GET (list, retrieve), POST (create), PATCH/PUT (update), DELETE
    Authentication: JWT Bearer token required
    
    Note: Used by frontend to populate category dropdowns in product forms.
    """
    
    queryset: QuerySet[Category] = Category.objects.all()
    serializer_class: Type[CategorySerializer] = CategorySerializer
    permission_classes: list[Type[BasePermission]] = [IsAuthenticated]
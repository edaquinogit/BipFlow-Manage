from decimal import Decimal
from typing import Any

import pytest
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Category, DeliveryRegion, Product

pytestmark = pytest.mark.django_db


class BotMessageMVPTest(TestCase):
    """Test the first rule-based bot slice exposed through the public API."""

    client: APIClient
    category: Category

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="Lanches", slug="lanches")

    def test_bot_rejects_empty_message(self) -> None:
        """The bot contract should require a useful customer message."""
        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_bot_answers_greeting_with_quick_options(self) -> None:
        """A greeting should return guided next actions instead of free text only."""
        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Oi, bom dia"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["intent"], "greeting")
        self.assertIn("produtos", {option["value"] for option in response.data["options"]})
        self.assertEqual(response.data["products"], [])

    def test_bot_catalog_lists_only_available_products(self) -> None:
        """Catalog replies should respect stock and availability from the backend."""
        available_product = Product.objects.create(
            name="Combo Executivo",
            sku="CMB-001",
            price=Decimal("42.50"),
            stock_quantity=5,
            category=self.category,
        )
        Product.objects.create(
            name="Produto Esgotado",
            sku="OUT-001",
            price=Decimal("19.90"),
            stock_quantity=0,
            category=self.category,
        )

        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Quero ver o catalogo"},
            format="json",
        )

        product_names = [product["name"] for product in response.data["products"]]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["intent"], "catalog")
        self.assertIn(available_product.name, product_names)
        self.assertNotIn("Produto Esgotado", product_names)

    def test_bot_search_returns_matching_product(self) -> None:
        """A specific customer phrase should behave like a product search."""
        Product.objects.create(
            name="Pastel de Queijo",
            sku="PST-001",
            price=Decimal("12.00"),
            stock_quantity=4,
            category=self.category,
        )
        Product.objects.create(
            name="Suco Natural",
            sku="SUC-001",
            price=Decimal("8.00"),
            stock_quantity=7,
            category=self.category,
        )

        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "pastel"},
            format="json",
        )

        product_names = [product["name"] for product in response.data["products"]]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["intent"], "product_search")
        self.assertEqual(product_names, ["Pastel de Queijo"])

    def test_bot_delivery_lists_only_active_regions(self) -> None:
        """Delivery replies should expose only active public delivery regions."""
        DeliveryRegion.objects.create(
            name="Centro",
            city="Salvador",
            delivery_fee=Decimal("12.00"),
        )
        DeliveryRegion.objects.create(
            name="Regiao Pausada",
            city="Salvador",
            delivery_fee=Decimal("25.00"),
            is_active=False,
        )

        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Qual a taxa de entrega?"},
            format="json",
        )

        region_names = [region["name"] for region in response.data["delivery_regions"]]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["intent"], "delivery")
        self.assertEqual(region_names, ["Centro"])

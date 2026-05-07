from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import BotConversation, BotMessage, Category, DeliveryRegion, Product

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

    def test_bot_creates_conversation_and_persists_messages(self) -> None:
        """The first useful message should create a durable bot conversation."""
        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Oi", "channel": "web"},
            format="json",
        )

        conversation = BotConversation.objects.get(id=response.data["conversation_id"])
        messages = list(conversation.messages.order_by("id"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session_id"], conversation.session_id)
        self.assertEqual(response.data["conversation_status"], BotConversation.STATUS_WAITING_CUSTOMER)
        self.assertEqual(conversation.channel, BotConversation.CHANNEL_WEB)
        self.assertEqual(conversation.last_intent, "greeting")
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].role, BotMessage.ROLE_USER)
        self.assertEqual(messages[0].content, "Oi")
        self.assertEqual(messages[1].role, BotMessage.ROLE_BOT)
        self.assertEqual(messages[1].intent, "greeting")
        self.assertEqual(messages[1].metadata["intent"], "greeting")

    def test_bot_reuses_existing_conversation(self) -> None:
        """Follow-up messages should append to the same conversation."""
        first_response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Oi"},
            format="json",
        )

        second_response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {
                "message": "Qual a taxa de entrega?",
                "conversation_id": first_response.data["conversation_id"],
            },
            format="json",
        )

        conversation = BotConversation.objects.get(id=first_response.data["conversation_id"])

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data["conversation_id"], conversation.id)
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(conversation.messages.count(), 4)
        conversation.refresh_from_db()
        self.assertEqual(conversation.last_intent, "delivery")

    def test_bot_can_continue_by_session_id(self) -> None:
        """The public session id should let clients continue after a page reload."""
        first_response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Oi"},
            format="json",
        )

        second_response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {
                "message": "produtos",
                "session_id": first_response.data["session_id"],
            },
            format="json",
        )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data["conversation_id"], first_response.data["conversation_id"])
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 4)

    def test_bot_marks_human_support_conversation_status(self) -> None:
        """Human support intent should put the conversation in a handoff-ready state."""
        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": "Quero falar com atendente"},
            format="json",
        )

        conversation = BotConversation.objects.get(id=response.data["conversation_id"])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["intent"], "human_support")
        self.assertEqual(conversation.status, BotConversation.STATUS_WAITING_HUMAN)

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


class BotConversationDashboardAPITest(TestCase):
    """Test dashboard-only access to persisted bot conversations."""

    client: APIClient

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    def _create_conversation(self, message: str = "Quero falar com atendente") -> int:
        response: Any = self.client.post(
            "/api/v1/bot/messages/",
            {"message": message},
            format="json",
        )
        return response.data["conversation_id"]

    def test_bot_conversation_list_requires_authentication(self) -> None:
        """Conversation history should be private to dashboard users."""
        response: Any = self.client.get("/api/v1/bot-conversations/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_cannot_read_bot_conversations(self) -> None:
        """Authenticated users without dashboard role should not see bot history."""
        regular_user = User.objects.create_user(username="regularbot", password="testpass123")
        self.client.force_authenticate(user=regular_user)

        response: Any = self.client.get("/api/v1/bot-conversations/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_user_can_list_bot_conversations(self) -> None:
        """Dashboard users should receive compact conversation summaries."""
        conversation_id = self._create_conversation()
        dashboard_user = User.objects.create_user(
            username="dashboardbot",
            password="testpass123",
            is_staff=True,
        )
        self.client.force_authenticate(user=dashboard_user)

        response: Any = self.client.get("/api/v1/bot-conversations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], conversation_id)
        self.assertEqual(response.data["results"][0]["message_count"], 2)
        self.assertEqual(response.data["results"][0]["status"], BotConversation.STATUS_WAITING_HUMAN)
        self.assertIn("atendimento humano", response.data["results"][0]["last_message_preview"])
        self.assertNotIn("messages", response.data["results"][0])

    def test_dashboard_user_can_retrieve_bot_conversation_messages(self) -> None:
        """Conversation details should include persisted user and bot messages."""
        conversation_id = self._create_conversation("Oi")
        dashboard_user = User.objects.create_user(
            username="dashboardbotdetail",
            password="testpass123",
            is_staff=True,
        )
        self.client.force_authenticate(user=dashboard_user)

        response: Any = self.client.get(f"/api/v1/bot-conversations/{conversation_id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], conversation_id)
        self.assertEqual(len(response.data["messages"]), 2)
        self.assertEqual(response.data["messages"][0]["role"], BotMessage.ROLE_USER)
        self.assertEqual(response.data["messages"][0]["content"], "Oi")
        self.assertEqual(response.data["messages"][1]["role"], BotMessage.ROLE_BOT)
        self.assertEqual(response.data["messages"][1]["intent"], "greeting")

    def test_dashboard_user_can_filter_bot_conversations(self) -> None:
        """Dashboard filters should support status, intent and search."""
        first_conversation_id = self._create_conversation("Quero falar com atendente")
        self._create_conversation("Oi")
        dashboard_user = User.objects.create_user(
            username="dashboardbotfilters",
            password="testpass123",
            is_staff=True,
        )
        self.client.force_authenticate(user=dashboard_user)

        response: Any = self.client.get(
            "/api/v1/bot-conversations/",
            {
                "status": BotConversation.STATUS_WAITING_HUMAN,
                "intent": "human_support",
                "search": "atendente",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], first_conversation_id)

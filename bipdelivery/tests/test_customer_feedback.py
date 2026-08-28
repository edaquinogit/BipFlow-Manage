"""Customer feedback / problem-report layer for the public storefront.

Covers: anonymous and authenticated submission, store resolution (missing
and inactive slugs falling back to the default store rather than erroring),
input validation (type/message/contact length), cross-tenant product/order
validation, throttling, dashboard tenant isolation, RBAC and status updates,
and that a malicious payload is stored as inert text rather than executed
or mangled.
"""

from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from bipdelivery.api.models import (
    Category,
    CustomerFeedback,
    CustomerProfile,
    Product,
    SaleOrder,
    Store,
    StoreMembership,
)
from bipdelivery.tests.throttle_utils import rest_framework_with_rates

pytestmark = pytest.mark.django_db


def make_sale_order(store: Store, **overrides) -> SaleOrder:
    fields = {
        "store": store,
        "order_reference": f"BPF-TEST-{store.slug}",
        "customer_name": "Cliente Teste",
        "customer_phone": "71999999999",
        "delivery_method": "pickup",
        "payment_method": "pix",
        "subtotal": Decimal("10.00"),
        "delivery_fee": Decimal("0.00"),
        "total": Decimal("10.00"),
    }
    fields.update(overrides)
    return SaleOrder.objects.create(**fields)


class CustomerFeedbackCreateAPITest(TestCase):
    """Public POST /api/v1/feedback/ -- shape validation and tenant resolution."""

    client: APIClient
    store: Store
    other_store: Store
    category: Category
    product: Product

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.store = Store.get_default()
        self.other_store = Store.objects.create(name="Outra Loja", slug="outra-loja")

        self.category = Category.objects.create(
            name="Lanches", slug="lanches", store=self.store
        )
        self.product = Product.objects.create(
            name="Combo Executivo",
            sku="CMB-001",
            price=Decimal("42.50"),
            stock_quantity=8,
            category=self.category,
            store=self.store,
        )
        self.order = make_sale_order(self.store)

        self.other_category = Category.objects.create(
            name="Outra categoria", slug="outra-categoria", store=self.other_store
        )
        self.other_product = Product.objects.create(
            name="Produto de outra loja",
            sku="OUT-001",
            price=Decimal("10.00"),
            category=self.other_category,
            store=self.other_store,
        )
        self.other_order = make_sale_order(self.other_store)

    def _payload(self, **overrides: Any) -> dict[str, Any]:
        payload = {
            "type": CustomerFeedback.TYPE_CHECKOUT,
            "message": "Nao consegui finalizar meu pedido.",
        }
        payload.update(overrides)
        return payload

    # 1. envio anonimo valido
    def test_anonymous_submission_is_accepted_and_persisted(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.store_id, self.store.id)
        self.assertIsNone(feedback.customer_profile)
        self.assertEqual(feedback.feedback_type, CustomerFeedback.TYPE_CHECKOUT)
        self.assertEqual(feedback.status, CustomerFeedback.STATUS_NEW)

    # 2. envio autenticado
    def test_authenticated_submission_links_the_customer_profile(self) -> None:
        user = User.objects.create_user(username="cliente1", password="testpass123")
        profile = CustomerProfile.objects.create(
            user=user, store=self.store, full_name="Cliente Um", phone="71999990000"
        )
        self.client.force_authenticate(user=user, token={"store_id": self.store.id})

        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(type=CustomerFeedback.TYPE_PRODUCT), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.customer_profile_id, profile.id)

    # 3. Store inexistente
    def test_unknown_store_slug_falls_back_to_default_store_without_erroring(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(),
            format="json",
            HTTP_X_STORE_SLUG="loja-que-nao-existe",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.store_id, self.store.id)

    # 4. Store inativa
    def test_inactive_store_slug_falls_back_to_default_store(self) -> None:
        inactive_store = Store.objects.create(
            name="Loja Inativa", slug="loja-inativa", is_active=False
        )

        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(),
            format="json",
            HTTP_X_STORE_SLUG=inactive_store.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertNotEqual(feedback.store_id, inactive_store.id)
        self.assertEqual(feedback.store_id, self.store.id)

    # 5. type invalido
    def test_invalid_type_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(type="not_a_real_type"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", response.data)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    # 6. mensagem vazia
    def test_blank_message_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(message=""), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    def test_whitespace_only_message_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(message="   "), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    # 7. mensagem acima do limite
    def test_message_over_the_length_limit_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(message="x" * 2001), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    def test_contact_over_the_length_limit_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(contact="x" * 161), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("contact", response.data)

    # 8. product da mesma Store
    def test_product_from_the_same_store_is_linked(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(type=CustomerFeedback.TYPE_PRODUCT, product_id=self.product.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.product_id, self.product.id)

    # 9. product de outra Store
    def test_product_from_another_store_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(
                type=CustomerFeedback.TYPE_PRODUCT, product_id=self.other_product.id
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("product_id", response.data)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    # 10. order da mesma Store
    def test_order_from_the_same_store_is_linked(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(order_id=self.order.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.order_id, self.order.id)

    # 11. order de outra Store
    def test_order_from_another_store_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(order_id=self.other_order.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("order_id", response.data)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    def test_unknown_product_id_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(product_id=999999), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    # 16. payload malicioso tratado como texto
    def test_html_in_message_is_stored_as_inert_text(self) -> None:
        malicious_message = '<script>alert("xss")</script> nao consigo pagar'

        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(message=malicious_message), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        # Stored verbatim as plain text -- no server-side execution, and no
        # silent mangling that would make it harder for an operator to read
        # the original report. Escaping on render is the frontend's job.
        self.assertEqual(feedback.message, malicious_message)

    # 17. ausencia de contato sendo valida
    def test_missing_contact_is_valid(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.contact, "")

    def test_honeypot_field_silently_rejects_the_submission(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(website="https://spam.example"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CustomerFeedback.objects.count(), 0)

    def test_page_path_strips_query_and_absolute_origin(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(
                page_path="https://malicious.example/l/loja/produtos?token=secret#frag"
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.page_path, "/l/loja/produtos")
        self.assertNotIn("token", feedback.page_path)

    def test_correlation_id_falls_back_to_the_current_request_id_when_not_submitted(
        self,
    ) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/", self._payload(), format="json"
        )

        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertTrue(feedback.correlation_id)
        self.assertEqual(response["X-Request-ID"], feedback.correlation_id)

    def test_submitted_correlation_id_is_preserved(self) -> None:
        response: Any = self.client.post(
            "/api/v1/feedback/",
            self._payload(correlation_id="abc-123-def"),
            format="json",
        )

        feedback = CustomerFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.correlation_id, "abc-123-def")


CUSTOMER_FEEDBACK_THROTTLE_TEST_REST_FRAMEWORK = rest_framework_with_rates(
    feedback_ip="1/minute",
)


class CustomerFeedbackThrottlingTest(TestCase):
    """12. throttling -- repeated public submissions from the same IP."""

    client: APIClient

    def setUp(self) -> None:
        self.settings_override = override_settings(
            REST_FRAMEWORK=CUSTOMER_FEEDBACK_THROTTLE_TEST_REST_FRAMEWORK,
        )
        self.settings_override.enable()
        api_settings.reload()
        self.original_throttle_rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = CUSTOMER_FEEDBACK_THROTTLE_TEST_REST_FRAMEWORK[
            "DEFAULT_THROTTLE_RATES"
        ]
        cache.clear()
        self.client = APIClient()

    def tearDown(self) -> None:
        cache.clear()
        SimpleRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        self.settings_override.disable()
        api_settings.reload()

    def _payload(self) -> dict[str, Any]:
        return {"type": CustomerFeedback.TYPE_OTHER, "message": "Relato de teste."}

    def test_repeated_submissions_from_the_same_ip_are_throttled(self) -> None:
        first: Any = self.client.post("/api/v1/feedback/", self._payload(), format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second: Any = self.client.post("/api/v1/feedback/", self._payload(), format="json")

        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", second)

    def test_throttle_applies_regardless_of_authentication(self) -> None:
        """CheckoutIpThrottle's own landmine (AnonRateThrottle silently stops
        throttling authenticated requests) must not resurface here."""
        user = User.objects.create_user(username="cliente-auth", password="testpass123")
        self.client.force_authenticate(user=user)

        first: Any = self.client.post("/api/v1/feedback/", self._payload(), format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second: Any = self.client.post("/api/v1/feedback/", self._payload(), format="json")

        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class CustomerFeedbackDashboardAPITest(TestCase):
    """13. tenant isolation, 14. RBAC, 15. status transitions."""

    client: APIClient
    store_a: Store
    store_b: Store

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")

        self.feedback_a = CustomerFeedback.objects.create(
            store=self.store_a,
            feedback_type=CustomerFeedback.TYPE_SHIPPING,
            message="Nao calculou o frete.",
        )
        self.feedback_b = CustomerFeedback.objects.create(
            store=self.store_b,
            feedback_type=CustomerFeedback.TYPE_PRODUCT,
            message="Produto trocado.",
        )

        self.manager_b = User.objects.create_user(
            username="manager_b", password="testpass123", is_staff=True
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.manager_b, role=StoreMembership.ROLE_MANAGER
        )

    # 13. tenant isolation na listagem
    def test_listing_never_leaks_another_stores_feedback(self) -> None:
        self.client.force_authenticate(
            user=self.manager_b, token={"store_id": self.store_b.id}
        )

        response: Any = self.client.get("/api/v1/feedback-reports/")

        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(self.feedback_b.id, ids)
        self.assertNotIn(self.feedback_a.id, ids)

    # 14. RBAC do dashboard
    def test_unauthenticated_request_is_rejected(self) -> None:
        response: Any = self.client.get("/api/v1/feedback-reports/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_authenticated_user_without_dashboard_role_is_forbidden(self) -> None:
        user = User.objects.create_user(username="rando", password="testpass123")
        self.client.force_authenticate(user=user)

        response: Any = self.client.get("/api/v1/feedback-reports/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_reader_can_list_but_cannot_update_status(self) -> None:
        viewer_group, _ = Group.objects.get_or_create(name="viewer")
        reader = User.objects.create_user(username="reader", password="testpass123")
        reader.groups.add(viewer_group)
        self.client.force_authenticate(user=reader)

        list_response: Any = self.client.get("/api/v1/feedback-reports/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        update_response: Any = self.client.patch(
            f"/api/v1/feedback-reports/{self.feedback_a.id}/status/",
            {"status": CustomerFeedback.STATUS_REVIEWING},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)
        self.feedback_a.refresh_from_db()
        self.assertEqual(self.feedback_a.status, CustomerFeedback.STATUS_NEW)

    # 15. alteracao de status
    def test_dashboard_writer_can_update_status(self) -> None:
        writer = User.objects.create_user(
            username="writer", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=writer)

        response: Any = self.client.patch(
            f"/api/v1/feedback-reports/{self.feedback_a.id}/status/",
            {"status": CustomerFeedback.STATUS_RESOLVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], CustomerFeedback.STATUS_RESOLVED)
        self.feedback_a.refresh_from_db()
        self.assertEqual(self.feedback_a.status, CustomerFeedback.STATUS_RESOLVED)

    def test_status_update_rejects_invalid_status(self) -> None:
        writer = User.objects.create_user(
            username="writer2", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=writer)

        response: Any = self.client.patch(
            f"/api/v1/feedback-reports/{self.feedback_a.id}/status/",
            {"status": "not_a_real_status"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.feedback_a.refresh_from_db()
        self.assertEqual(self.feedback_a.status, CustomerFeedback.STATUS_NEW)

    def test_writer_cannot_update_another_stores_feedback(self) -> None:
        """A store-B manager must not even see, let alone mutate, store A's report."""
        self.client.force_authenticate(
            user=self.manager_b, token={"store_id": self.store_b.id}
        )

        response: Any = self.client.patch(
            f"/api/v1/feedback-reports/{self.feedback_a.id}/status/",
            {"status": CustomerFeedback.STATUS_RESOLVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.feedback_a.refresh_from_db()
        self.assertEqual(self.feedback_a.status, CustomerFeedback.STATUS_NEW)

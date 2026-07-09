"""Guest checkout reinstated (see docs/architecture/customer-profile-
checkout-evolution.md for the original evolution this partially reverses).

CheckoutWhatsAppView no longer requires an account: an authenticated
customer with a complete CustomerProfile for the resolved store still gets
their identity/address from that profile, but anyone else (anonymous, or
authenticated without a usable profile) can check out by submitting
full_name/phone/email/address/neighborhood/city directly in the request,
same shape as before that evolution shipped. A profile, when present,
always wins for identity; address specifically falls back to the submitted
fields whenever the profile's own address is incomplete.
"""
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Category, CustomerProfile, Product, SaleOrder, Store

User = get_user_model()


class CheckoutGuestAndProfileTest(TestCase):
    def setUp(self) -> None:
        # LocMemCache persists across test methods within the same run (it
        # isn't reset by TestCase's transaction rollback) -- without this,
        # CheckoutIpThrottle/CheckoutCustomerThrottle accumulate hits across
        # every test in this class and start 429ing real checkout attempts.
        cache.clear()
        self.store = Store.get_default()
        self.category = Category.objects.create(name="Roupas", slug="roupas")
        self.product = Product.objects.create(
            name="Camiseta",
            sku="CAM-001",
            price=Decimal("59.90"),
            stock_quantity=5,
            category=self.category,
        )
        self.user = User.objects.create_user(
            username="cliente@example.com",
            email="cliente@example.com",
            password="testpass123",
        )

    def _payload(self, **customer_overrides: Any) -> dict[str, Any]:
        customer = {
            "delivery_method": "pickup",
            "payment_method": "pix",
            "notes": "",
        }
        customer.update(customer_overrides)
        return {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "customer": customer,
        }

    def _guest_identity(self, **overrides: Any) -> dict[str, Any]:
        guest = {"full_name": "Convidado Teste", "phone": "11977776666"}
        guest.update(overrides)
        return guest

    # -- Anonymous guest -----------------------------------------------

    def test_anonymous_guest_pickup_checkout_succeeds(self) -> None:
        response = APIClient().post(
            "/api/v1/checkout/whatsapp/",
            self._payload(**self._guest_identity(email="convidado@example.com")),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertIsNone(order.customer_profile_id)
        self.assertEqual(order.customer_name, "Convidado Teste")
        self.assertEqual(order.customer_phone, "11977776666")
        self.assertEqual(order.customer_email, "convidado@example.com")

    def test_anonymous_guest_missing_name_or_phone_is_rejected(self) -> None:
        response = APIClient().post(
            "/api/v1/checkout/whatsapp/",
            self._payload(full_name="", phone=""),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "guest_identity_required")
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_anonymous_guest_delivery_requires_address(self) -> None:
        response = APIClient().post(
            "/api/v1/checkout/whatsapp/",
            self._payload(delivery_method="delivery", **self._guest_identity()),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "guest_address_incomplete")
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_anonymous_guest_delivery_with_address_succeeds(self) -> None:
        response = APIClient().post(
            "/api/v1/checkout/whatsapp/",
            self._payload(
                delivery_method="delivery",
                address="Rua Convidado, 10",
                neighborhood="Centro",
                city="Salvador",
                **self._guest_identity(),
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertIsNone(order.customer_profile_id)
        self.assertEqual(order.address, "Rua Convidado, 10")
        self.assertEqual(order.neighborhood, "Centro")
        self.assertEqual(order.city, "Salvador")

    # -- Authenticated without a usable profile --------------------------

    def test_authenticated_user_without_a_profile_checks_out_as_guest(self) -> None:
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(**self._guest_identity(full_name="Fulano Sem Perfil")),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertIsNone(order.customer_profile_id)
        self.assertEqual(order.customer_name, "Fulano Sem Perfil")

    # -- Authenticated with a profile ------------------------------------

    def test_pickup_order_uses_profile_identity_and_links_the_profile(self) -> None:
        profile = CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post("/api/v1/checkout/whatsapp/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_profile_id, profile.id)
        self.assertEqual(order.customer_name, "Maria Cliente")
        self.assertEqual(order.customer_phone, "11988887777")
        self.assertEqual(order.customer_email, "cliente@example.com")
        self.assertIn("Maria Cliente", order.message)

    def test_profile_identity_wins_even_if_guest_fields_are_also_submitted(self) -> None:
        """A logged-in profile is never overridden by submitted guest fields."""
        CustomerProfile.objects.create(
            user=self.user, store=self.store, full_name="Maria Cliente", phone="11988887777"
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(**self._guest_identity(full_name="Outro Nome")),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_name, "Maria Cliente")

    def test_delivery_order_with_incomplete_profile_address_requires_guest_address(self) -> None:
        CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
            # address/neighborhood/city deliberately left blank
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(delivery_method="delivery"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "guest_address_incomplete")
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_delivery_order_with_incomplete_profile_falls_back_to_submitted_address(self) -> None:
        """No account edit required: a one-off address at checkout is enough."""
        CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
            # address/neighborhood/city deliberately left blank
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(
                delivery_method="delivery",
                address="Rua Avulsa, 7",
                neighborhood="Bairro Novo",
                city="Recife",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_name, "Maria Cliente")  # identity still from profile
        self.assertEqual(order.address, "Rua Avulsa, 7")
        self.assertEqual(order.neighborhood, "Bairro Novo")
        self.assertEqual(order.city, "Recife")

    def test_delivery_order_uses_the_complete_profile_address(self) -> None:
        CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
            address="Rua das Flores, 42",
            neighborhood="Jardim",
            city="Sao Paulo",
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(delivery_method="delivery"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.address, "Rua das Flores, 42")
        self.assertEqual(order.neighborhood, "Jardim")
        self.assertEqual(order.city, "Sao Paulo")

    def test_another_customers_profile_is_never_used(self) -> None:
        """Isolation: a customer's checkout never reads a different user's profile."""
        other_user = User.objects.create_user(
            username="outra@example.com", email="outra@example.com", password="testpass123"
        )
        CustomerProfile.objects.create(
            user=other_user, store=self.store, full_name="Outra Pessoa", phone="11900001111"
        )
        CustomerProfile.objects.create(
            user=self.user, store=self.store, full_name="Maria Cliente", phone="11988887777"
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post("/api/v1/checkout/whatsapp/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_name, "Maria Cliente")

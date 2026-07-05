"""Etapa 3 of the QR-code stock-exit evolution: point-of-sale checkout for
the physical store (POST /v1/pdv/sales/), resolving cart items by scanned
`public_code` instead of numeric product id.

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_stock_movements.py / test_product_public_code.py.
"""
import base64
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Product, SaleOrder, StockMovement, StoreMembership
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin

PDV_SALES_URL = "/api/v1/pdv/sales/"


def receipt_email_url(order_reference: str) -> str:
    return f"/api/v1/pdv/sales/{order_reference}/receipt-email/"


def fake_pdf_base64(content: bytes = b"%PDF-1.4 fake receipt content") -> str:
    return base64.b64encode(content).decode("ascii")


class PdvSaleAPITest(TwoStoreFixtureMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        # update_fields must include is_available, not just stock_quantity:
        # Product.save() recomputes is_available in memory regardless, but a
        # restricted update_fields only persists the columns actually listed
        # -- omitting it here would leave the DB row's is_available stuck at
        # the original False from creation with 0 stock, and this view's
        # is_available check reads a fresh row from the database, not this
        # in-memory instance.
        self.product_b.stock_quantity = 10
        self.product_b.save(update_fields=["stock_quantity", "is_available"])

        self.other_product_b = Product.objects.create(
            name="Outro Produto B",
            price=Decimal("15.00"),
            category=self.category_b,
            store=self.store_b,
            stock_quantity=4,
        )

    def test_single_item_sale_decrements_stock_and_creates_order(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 3}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["subtotal"], "60.00")
        self.assertEqual(response.data["total"], "60.00")
        self.assertTrue(response.data["order_reference"].startswith("PDV-"))

        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 7)

        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.channel, SaleOrder.CHANNEL_LOJA_FISICA)
        self.assertEqual(sale_order.store, self.store_b)
        self.assertEqual(sale_order.delivery_method, "pickup")
        self.assertEqual(sale_order.customer_name, "Cliente balcão")
        # Etapa R3 of the QR-code stock-exit refinement: a PDV sale always
        # records who rang it up, unlike a public/WhatsApp checkout.
        self.assertEqual(sale_order.performed_by, self.user_b)

        movement = StockMovement.objects.get(product=self.product_b, sale_order=sale_order)
        self.assertEqual(movement.movement_type, StockMovement.TYPE_SAIDA)
        self.assertEqual(movement.source, StockMovement.SOURCE_PDV)
        self.assertEqual(movement.reason, StockMovement.REASON_VENDA)
        self.assertEqual(movement.previous_stock, 10)
        self.assertEqual(movement.new_stock, 7)
        self.assertEqual(movement.performed_by, self.user_b)

    def test_multi_item_sale_is_atomic_across_products(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 2},
                    {"public_code": self.other_product_b.public_code, "quantity": 4},
                ],
                "payment_method": "pix",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product_b.refresh_from_db()
        self.other_product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 8)
        self.assertEqual(self.other_product_b.stock_quantity, 0)
        self.assertFalse(self.other_product_b.is_available)

    def test_duplicate_scans_of_the_same_code_are_aggregated(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 1},
                    {"public_code": self.product_b.public_code, "quantity": 2},
                ],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["quantity"], 3)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 7)

    def test_quantity_larger_than_stock_is_rejected_without_side_effects(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 999}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertFalse(StockMovement.objects.filter(product=self.product_b).exists())

    def test_partial_failure_in_a_multi_item_sale_rolls_back_everything(self) -> None:
        """One bad item must not leave the first item's stock decremented."""
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 2},
                    {"public_code": self.other_product_b.public_code, "quantity": 999},
                ],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.other_product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertEqual(self.other_product_b.stock_quantity, 4)
        self.assertFalse(SaleOrder.objects.filter(channel=SaleOrder.CHANNEL_LOJA_FISICA).exists())

    def test_unknown_code_is_rejected(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {"items": [{"public_code": "DOESNOTEX", "quantity": 1}], "payment_method": "cash"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_code_lookup_is_case_insensitive(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code.lower(), "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cross_store_code_is_not_found(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_a.public_code, "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 0)

    def test_empty_items_list_is_rejected(self) -> None:
        response = self.client.post(
            PDV_SALES_URL, {"items": [], "payment_method": "cash"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_user_is_unauthorized(self) -> None:
        client = APIClient()

        response = client.post(
            PDV_SALES_URL,
            {"items": [{"public_code": "ANYCODE1", "quantity": 1}], "payment_method": "cash"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_role_cannot_register_a_sale(self) -> None:
        viewer = User.objects.create_user(username="pdv_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_optional_customer_name_and_notes_are_persisted(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "card",
                "customer_name": "Maria",
                "notes": "Cliente preferencial",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.customer_name, "Maria")
        self.assertEqual(sale_order.notes, "Cliente preferencial")
        self.assertEqual(sale_order.payment_method, "card")
        self.assertEqual(sale_order.customer_phone, "")

    def test_optional_customer_phone_is_persisted_when_provided(self) -> None:
        """Etapa R4 of the QR-code stock-exit refinement: capturing the
        customer's phone at the PDV lets that sale count toward the
        new-vs-returning customer insight, same as a virtual checkout."""
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
                "customer_phone": "71999998888",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.customer_phone, "71999998888")

    def test_optional_customer_email_is_persisted_and_returned(self) -> None:
        """PDV receipt PDF/email evolution: SaleOrder.customer_email already
        existed (populated by the WhatsApp/checkout flow) but the PDV never
        wrote to it -- this is what lets the cashier email the receipt."""
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
                "customer_email": "cliente@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["customer_email"], "cliente@example.com")
        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.customer_email, "cliente@example.com")

    def test_customer_email_defaults_to_blank(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["customer_email"], "")

    def test_invalid_customer_email_is_rejected(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
                "customer_email": "not-an-email",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PdvReceiptEmailAPITest(TwoStoreFixtureMixin, TestCase):
    """POST /v1/pdv/sales/<order_reference>/receipt-email/ -- emails an
    already-built receipt PDF (see utils/receiptPdf.ts) to a customer.
    Reuses TwoStoreFixtureMixin's self.order_a/self.order_b instead of
    creating new SaleOrder rows, since this endpoint only needs an existing
    order to scope against, not a fresh PDV sale.
    """

    def test_sends_the_receipt_pdf_as_an_email_attachment(self) -> None:
        response = self.client.post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["cliente@example.com"])
        self.assertIn(self.order_b.order_reference, sent.subject)
        self.assertEqual(len(sent.attachments), 1)
        filename, content, mimetype = sent.attachments[0]
        self.assertEqual(filename, f"{self.order_b.order_reference}.pdf")
        self.assertEqual(mimetype, "application/pdf")
        self.assertTrue(content.startswith(b"%PDF"))

    def test_sale_from_another_store_returns_404(self) -> None:
        response = self.client.post(
            receipt_email_url(self.order_a.order_reference),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_order_reference_returns_404(self) -> None:
        response = self.client.post(
            receipt_email_url("PDV-does-not-exist"),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_email_is_rejected(self) -> None:
        response = self.client.post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "not-an-email", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_non_pdf_payload_is_rejected(self) -> None:
        response = self.client.post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64(b"not a pdf at all")},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_malformed_base64_is_rejected(self) -> None:
        response = self.client.post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "cliente@example.com", "pdf_base64": "not-valid-base64!!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_user_is_unauthorized(self) -> None:
        response = APIClient().post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_role_cannot_send_receipt_email(self) -> None:
        viewer = User.objects.create_user(username="pdv_email_viewer_b", password="testpass123")
        StoreMembership.objects.create(store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER)
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.post(
            receipt_email_url(self.order_b.order_reference),
            {"email": "cliente@example.com", "pdf_base64": fake_pdf_base64()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(mail.outbox), 0)

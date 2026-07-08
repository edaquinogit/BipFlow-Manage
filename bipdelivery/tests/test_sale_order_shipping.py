"""Etapa 1 of the pedidos/NF/envio evolution (see
docs/architecture/pedidos-nf-envio-evolution.md): manual shipping --
carrier name + tracking code typed in by the operator, plus the status
transition guard (prepared -> sent -> delivered for delivery orders,
prepared -> delivered directly for pickup orders, delivered/cancelled
terminal).

Reuses TwoStoreFixtureMixin (test_store_active_isolation.py), same as
test_sale_order_cancellation.py / test_sale_order_detail.py.
"""
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase
from rest_framework import status

from bipdelivery.api.models import SaleOrder
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class SaleOrderShippingAPITest(TwoStoreFixtureMixin, TestCase):
    def _status_url(self, order: SaleOrder) -> str:
        return f"/api/v1/sales-orders/{order.id}/status/"

    def _make_order(self, *, delivery_method: str, status_value: str = SaleOrder.STATUS_PREPARED) -> SaleOrder:
        return SaleOrder.objects.create(
            store=self.store_b,
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            channel=SaleOrder.CHANNEL_VIRTUAL,
            status=status_value,
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method=delivery_method,
            payment_method="pix",
            subtotal=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("10.00"),
        )

    def test_delivery_order_requires_carrier_and_tracking_to_be_marked_sent(self) -> None:
        order = self._make_order(delivery_method="delivery")

        response = self.client.patch(self._status_url(order), {"status": "sent"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_PREPARED)

    def test_delivery_order_marked_sent_records_shipping_data(self) -> None:
        order = self._make_order(delivery_method="delivery")

        response = self.client.patch(
            self._status_url(order),
            {"status": "sent", "carrier_name": "Correios", "tracking_code": "AB123456789BR"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "sent")
        self.assertEqual(response.data["carrier_name"], "Correios")
        self.assertEqual(response.data["tracking_code"], "AB123456789BR")
        self.assertIn("correios.com.br", response.data["tracking_url"])
        self.assertIsNotNone(response.data["shipped_at"])
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_SENT)
        self.assertIsNotNone(order.shipped_at)

    def test_unknown_carrier_falls_back_to_a_generic_tracking_link(self) -> None:
        order = self._make_order(delivery_method="delivery")

        response = self.client.patch(
            self._status_url(order),
            {"status": "sent", "carrier_name": "Transportadora Local", "tracking_code": "XYZ999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("google.com/search", response.data["tracking_url"])

    def test_delivery_order_sent_can_be_marked_delivered(self) -> None:
        order = self._make_order(delivery_method="delivery", status_value=SaleOrder.STATUS_SENT)

        response = self.client.patch(self._status_url(order), {"status": "delivered"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "delivered")
        self.assertIsNotNone(response.data["delivered_at"])
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_DELIVERED)

    def test_pickup_order_cannot_be_marked_sent(self) -> None:
        order = self._make_order(delivery_method="pickup")

        response = self.client.patch(
            self._status_url(order),
            {"status": "sent", "carrier_name": "Correios", "tracking_code": "AB123456789BR"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_PREPARED)

    def test_pickup_order_skips_straight_to_delivered(self) -> None:
        order = self._make_order(delivery_method="pickup")

        response = self.client.patch(self._status_url(order), {"status": "delivered"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_DELIVERED)

    def test_legacy_pickup_order_already_sent_can_still_be_marked_delivered(self) -> None:
        """Not retroactive: a pickup order already sitting in "sent" before this
        evolution shipped must keep working, even though pickup can no longer
        reach "sent" going forward."""
        order = self._make_order(delivery_method="pickup", status_value=SaleOrder.STATUS_SENT)

        response = self.client.patch(self._status_url(order), {"status": "delivered"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_DELIVERED)

    def test_delivered_order_is_terminal(self) -> None:
        order = self._make_order(delivery_method="delivery", status_value=SaleOrder.STATUS_DELIVERED)

        response = self.client.patch(self._status_url(order), {"status": "cancelled"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_DELIVERED)

    def test_cancelled_order_is_terminal(self) -> None:
        order = self._make_order(delivery_method="delivery", status_value=SaleOrder.STATUS_CANCELLED)

        response = self.client.patch(self._status_url(order), {"status": "sent"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_CANCELLED)

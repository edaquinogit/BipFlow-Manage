"""Etapa 5 of the QR-code stock-exit evolution: turning SaleOrder.channel
(Etapa 3) into a dashboard-facing report -- a `channel` filter and
`by_channel` breakdown on SaleOrderViewSet, `channel` exposed on the sale
order payload itself, and a bug fix so the stock-movement ledger's `source`
filter actually recognizes `pdv` instead of silently matching every row.

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for the ledger source
filter test, same as test_stock_movements.py / test_pdv_sales.py.
"""
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import SaleOrder, StockMovement
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class SaleOrderChannelAPITest(TestCase):
    """`channel` field, `?channel=` filter, and the `by_channel` breakdown."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="channel_reporting", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, total: Decimal, channel: str = SaleOrder.CHANNEL_VIRTUAL) -> SaleOrder:
        return SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
            channel=channel,
        )

    def test_channel_field_is_exposed_on_the_sale_order_payload(self) -> None:
        order = self._make_order(Decimal("30.00"), channel=SaleOrder.CHANNEL_LOJA_FISICA)

        response = self.client.get(f"/api/v1/sales-orders/{order.id}/")

        self.assertEqual(response.data["channel"], "loja_fisica")

    def test_orders_created_without_a_channel_default_to_virtual(self) -> None:
        """Every order created before Etapa 3 (and every WhatsApp order today) is virtual."""
        order = self._make_order(Decimal("10.00"))

        self.assertEqual(order.channel, SaleOrder.CHANNEL_VIRTUAL)

    def test_list_filters_by_channel(self) -> None:
        virtual_order = self._make_order(Decimal("10.00"), channel=SaleOrder.CHANNEL_VIRTUAL)
        pdv_order = self._make_order(Decimal("20.00"), channel=SaleOrder.CHANNEL_LOJA_FISICA)

        response = self.client.get("/api/v1/sales-orders/?channel=loja_fisica")

        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(ids, {pdv_order.id})
        self.assertNotIn(virtual_order.id, ids)

    def test_invalid_channel_value_is_ignored_not_erroring(self) -> None:
        order = self._make_order(Decimal("10.00"))

        response = self.client.get("/api/v1/sales-orders/?channel=not-a-real-channel")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(order.id, ids)

    def test_breakdown_groups_revenue_by_channel(self) -> None:
        self._make_order(Decimal("40.00"), channel=SaleOrder.CHANNEL_VIRTUAL)
        self._make_order(Decimal("60.00"), channel=SaleOrder.CHANNEL_LOJA_FISICA)
        self._make_order(Decimal("25.00"), channel=SaleOrder.CHANNEL_LOJA_FISICA)

        response = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        by_channel = {
            row["channel"]: (row["revenue_total"], row["orders_count"])
            for row in response.data["by_channel"]
        }
        self.assertEqual(by_channel["virtual"], ("40.00", 1))
        self.assertEqual(by_channel["loja_fisica"], ("85.00", 2))

    def test_breakdown_channel_filter_narrows_the_comparison(self) -> None:
        self._make_order(Decimal("40.00"), channel=SaleOrder.CHANNEL_VIRTUAL)
        self._make_order(Decimal("60.00"), channel=SaleOrder.CHANNEL_LOJA_FISICA)

        response = self.client.get("/api/v1/sales-orders/breakdown/?period=30d&channel=virtual")

        by_channel = {row["channel"]: row["revenue_total"] for row in response.data["by_channel"]}
        self.assertEqual(by_channel, {"virtual": "40.00"})


class StockMovementSourceFilterRegressionTest(TwoStoreFixtureMixin, TestCase):
    """Regression test for a real bug found while building Etapa 5: the
    ledger's `source` filter hardcoded (manual, venda), so `?source=pdv`
    silently matched every row instead of narrowing to PDV movements --
    the exact opposite of what a filter should do when given a valid,
    known value it just doesn't recognize.
    """

    LEDGER_URL = "/api/v1/stock-movements/"

    def setUp(self) -> None:
        super().setUp()
        self.manual_movement = StockMovement.objects.create(
            store=self.store_b,
            product=self.product_b,
            movement_type=StockMovement.TYPE_ENTRADA,
            quantity=10,
            previous_stock=0,
            new_stock=10,
            reason=StockMovement.REASON_COMPRA,
            source=StockMovement.SOURCE_MANUAL,
        )
        self.pdv_movement = StockMovement.objects.create(
            store=self.store_b,
            product=self.product_b,
            movement_type=StockMovement.TYPE_SAIDA,
            quantity=2,
            previous_stock=10,
            new_stock=8,
            reason=StockMovement.REASON_VENDA,
            source=StockMovement.SOURCE_PDV,
        )

    def test_source_pdv_filter_returns_only_pdv_movements(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"source": "pdv"})

        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(ids, {self.pdv_movement.id})
        self.assertNotIn(self.manual_movement.id, ids)

    def test_source_manual_filter_still_works(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"source": "manual"})

        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(ids, {self.manual_movement.id})

    def test_unknown_source_value_is_ignored_not_erroring(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"source": "not-a-real-source"})

        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(ids, {self.manual_movement.id, self.pdv_movement.id})

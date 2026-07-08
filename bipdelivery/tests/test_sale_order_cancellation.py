"""Etapa R2 of the QR-code stock-exit refinement: cancelling a SaleOrder
atomically restocks every item it originally decremented, regardless of
channel (see docs/architecture/qrcode-stock-exit-refinement.md).

Reuses TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_stock_movements.py / test_pdv_sales.py.
"""
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Product, SaleOrder, SaleOrderItem, StockMovement, StoreMembership
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin

CANCEL_STATUS_PAYLOAD = {"status": "cancelled"}


class SaleOrderCancellationAPITest(TwoStoreFixtureMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.product_b.stock_quantity = 10
        self.product_b.save(update_fields=["stock_quantity", "is_available"])

        self.other_product_b = Product.objects.create(
            name="Outro Produto B",
            price=Decimal("15.00"),
            category=self.category_b,
            store=self.store_b,
            stock_quantity=4,
        )

    def _status_url(self, order: SaleOrder) -> str:
        return f"/api/v1/sales-orders/{order.id}/status/"

    def _make_order(
        self, *, channel: str, quantities: dict[Product, int], delivery_method: str = "pickup"
    ) -> SaleOrder:
        order = SaleOrder.objects.create(
            store=self.store_b,
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            channel=channel,
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method=delivery_method,
            payment_method="pix",
            subtotal=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("10.00"),
        )
        for product, quantity in quantities.items():
            SaleOrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                sku=product.sku or "",
                quantity=quantity,
                unit_price=product.price,
                line_total=product.price * quantity,
            )
            product.stock_quantity -= quantity
            product.is_available = product.stock_quantity > 0
            product.save(update_fields=["stock_quantity", "is_available"])
        return order

    def test_cancelling_a_virtual_order_restocks_its_item(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.product_b: 3})
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 7)

        response = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "cancelled")
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)

        movement = StockMovement.objects.get(product=self.product_b, sale_order=order)
        self.assertEqual(movement.movement_type, StockMovement.TYPE_ENTRADA)
        self.assertEqual(movement.reason, StockMovement.REASON_VENDA_CANCELADA)
        self.assertEqual(movement.source, StockMovement.SOURCE_VENDA)
        self.assertEqual(movement.previous_stock, 7)
        self.assertEqual(movement.new_stock, 10)
        self.assertEqual(movement.performed_by, self.user_b)

    def test_cancelling_a_pdv_order_restocks_with_pdv_source(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_LOJA_FISICA, quantities={self.product_b: 2})

        response = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        movement = StockMovement.objects.get(product=self.product_b, sale_order=order)
        self.assertEqual(movement.source, StockMovement.SOURCE_PDV)
        self.assertEqual(movement.reason, StockMovement.REASON_VENDA_CANCELADA)

    def test_cancelling_a_multi_item_order_restocks_every_item(self) -> None:
        order = self._make_order(
            channel=SaleOrder.CHANNEL_LOJA_FISICA,
            quantities={self.product_b: 3, self.other_product_b: 1},
        )

        response = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product_b.refresh_from_db()
        self.other_product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertEqual(self.other_product_b.stock_quantity, 4)
        self.assertEqual(
            StockMovement.objects.filter(sale_order=order, reason=StockMovement.REASON_VENDA_CANCELADA).count(),
            2,
        )

    def test_cancelling_twice_does_not_double_restock(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.product_b: 3})

        first = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")
        second = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertEqual(
            StockMovement.objects.filter(sale_order=order, reason=StockMovement.REASON_VENDA_CANCELADA).count(),
            1,
        )

    def test_cancelling_an_order_whose_product_was_deleted_does_not_crash(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.other_product_b: 1})
        # SaleOrderItem.product is SET_NULL, matching a real product deletion.
        SaleOrderItem.objects.filter(order=order).update(product=None)

        response = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "cancelled")
        self.assertFalse(StockMovement.objects.filter(sale_order=order).exists())

    def test_non_cancel_status_change_does_not_restock(self) -> None:
        # delivery_method="delivery": a pickup order can no longer reach
        # "sent" at all (Etapa 1 of the pedidos/NF/envio evolution -- pickup
        # orders skip the shipping leg entirely, see
        # test_sale_order_shipping.py for that transition rule).
        order = self._make_order(
            channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.product_b: 3}, delivery_method="delivery"
        )
        self.product_b.refresh_from_db()
        stock_before = self.product_b.stock_quantity

        response = self.client.patch(
            self._status_url(order),
            {"status": "sent", "carrier_name": "Correios", "tracking_code": "AB123456789BR"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "sent")
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, stock_before)
        self.assertFalse(StockMovement.objects.filter(sale_order=order).exists())

    def test_cross_store_order_cannot_be_cancelled(self) -> None:
        order = SaleOrder.objects.create(
            store=self.store_a,
            order_reference="BPF-OTHER-STORE",
            channel=SaleOrder.CHANNEL_VIRTUAL,
            customer_name="Cliente A",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("10.00"),
        )

        response = self.client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_viewer_role_cannot_cancel_an_order(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.product_b: 1})
        viewer = User.objects.create_user(username="cancel_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_cannot_cancel_an_order(self) -> None:
        order = self._make_order(channel=SaleOrder.CHANNEL_VIRTUAL, quantities={self.product_b: 1})
        client = APIClient()

        response = client.patch(self._status_url(order), CANCEL_STATUS_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

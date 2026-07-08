"""Etapa 0 of the pedidos/NF/envio evolution (see
docs/architecture/pedidos-nf-envio-evolution.md): the order detail endpoint
now exposes address/notes/wa.me fields that the list endpoint deliberately
keeps out, so the dashboard has somewhere to show them.

Reuses TwoStoreFixtureMixin (test_store_active_isolation.py), same as
test_sale_order_cancellation.py, for cross-store isolation coverage.
"""
from rest_framework import status

from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin
from django.test import TestCase


class SaleOrderDetailAPITest(TwoStoreFixtureMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.order_b.address = "Rua das Flores, 123"
        self.order_b.neighborhood = "Centro"
        self.order_b.city = "Salvador"
        self.order_b.notes = "Sem cebola, por favor"
        self.order_b.message = "Pedido via WhatsApp"
        self.order_b.whatsapp_url = "https://wa.me/5571999990000"
        self.order_b.save(
            update_fields=["address", "neighborhood", "city", "notes", "message", "whatsapp_url"]
        )

    def test_retrieve_exposes_address_notes_and_whatsapp_link(self) -> None:
        response = self.client.get(f"/api/v1/sales-orders/{self.order_b.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["address"], "Rua das Flores, 123")
        self.assertEqual(response.data["neighborhood"], "Centro")
        self.assertEqual(response.data["city"], "Salvador")
        self.assertEqual(response.data["notes"], "Sem cebola, por favor")
        self.assertEqual(response.data["message"], "Pedido via WhatsApp")
        self.assertEqual(response.data["whatsapp_url"], "https://wa.me/5571999990000")

    def test_list_endpoint_keeps_detail_only_fields_out_of_the_payload(self) -> None:
        response = self.client.get("/api/v1/sales-orders/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(item for item in response.data["results"] if item["id"] == self.order_b.id)
        self.assertNotIn("address", row)
        self.assertNotIn("notes", row)
        self.assertNotIn("whatsapp_url", row)

    def test_retrieve_from_another_store_is_not_found(self) -> None:
        response = self.client.get(f"/api/v1/sales-orders/{self.order_a.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

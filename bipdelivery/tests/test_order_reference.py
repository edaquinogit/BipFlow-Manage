from __future__ import annotations

from datetime import datetime, timezone as datetime_timezone
from unittest.mock import patch

from django.test import SimpleTestCase

from bipdelivery.api.order_reference import build_sale_order_reference


class SaleOrderReferenceTest(SimpleTestCase):
    def test_build_sale_order_reference_keeps_prefix_timestamp_and_random_suffix(self) -> None:
        fixed_time = datetime(2026, 8, 14, 0, 19, 25, tzinfo=datetime_timezone.utc)

        with (
            patch("bipdelivery.api.order_reference.timezone.localtime", return_value=fixed_time),
            patch("bipdelivery.api.order_reference.get_random_string", return_value="AB12CD"),
        ):
            reference = build_sale_order_reference("BPF")

        self.assertEqual(reference, "BPF-20260814-001925-AB12CD")
        self.assertLessEqual(len(reference), 32)

    def test_build_sale_order_reference_applies_to_pdv_prefix(self) -> None:
        reference = build_sale_order_reference("PDV")

        self.assertTrue(reference.startswith("PDV-"))
        self.assertLessEqual(len(reference), 32)

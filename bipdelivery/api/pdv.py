"""Point-of-sale (PDV) checkout for the physical store (Etapa 3 of the
QR-code stock-exit evolution, see
docs/architecture/qrcode-stock-exit-evolution.md).

Kept in its own module rather than folded into the already-large views.py:
this is a self-contained vertical slice (its own input/output serializers,
its own stock-reservation logic, one view) that only needs to import shared
primitives from the rest of the app, not the other way around.

Distinct from CheckoutWhatsAppView (bipdelivery/api/views.py): that endpoint
is public/unauthenticated and resolves cart items by numeric product id for
the e-commerce/WhatsApp flow. This one is dashboard-authenticated, resolves
items by the `public_code` a cashier scans or types, and marks the resulting
SaleOrder with `channel=CHANNEL_LOJA_FISICA`. Both reuse the same shape of
atomic, lock-then-bulk-update stock reservation -- lock every affected
product row in one query ordered by id (deadlock-free), validate, decrement
in memory, and persist with a single bulk_update() plus a bulk_create() of
the StockMovement audit trail -- because a single sale can ring up several
different products in one transaction, so per-item locking (the single-item
apply_stock_movement() chokepoint used by the dashboard's manual
entrada/saida form) isn't the right fit here either.
"""
from __future__ import annotations

import base64
import binascii
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .errors import not_found_error
from .models import Product, SaleOrder, SaleOrderItem, StockMovement, Store
from .permissions import has_dashboard_write_access
from .store_scope import resolve_request_store
from .throttling import PdvReceiptEmailThrottle

DEFAULT_PDV_CUSTOMER_NAME = "Cliente balcão"

# PDV receipt PDF/email evolution: the PDF itself is built client-side (no
# server-side PDF library exists in this project, see utils/receiptPdf.ts)
# and posted here as base64 just to be relayed as an email attachment --
# these guard against an oversized or malformed payload.
MAX_RECEIPT_PDF_BYTES = 5 * 1024 * 1024
PDF_MAGIC_NUMBER = b"%PDF"


class PdvSaleItemInputSerializer(serializers.Serializer):
    """One scanned/typed line of the cashier's running cart."""

    public_code = serializers.CharField(max_length=12)
    quantity = serializers.IntegerField(min_value=1)


class PdvSaleRequestSerializer(serializers.Serializer):
    """Validates the POST body for a physical-store sale.

    No delivery/address fields at all (unlike CheckoutRequestSerializer):
    a PDV sale is always picked up on the spot. customer_name is optional
    because most counter sales have no reason to collect one.
    """

    items = PdvSaleItemInputSerializer(many=True)
    payment_method = serializers.ChoiceField(choices=["pix", "card", "cash"])
    customer_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    # Optional (Etapa R4 of the QR-code stock-exit refinement): capturing it
    # lets a PDV sale feed the same new-vs-returning customer insight
    # (SaleOrderCustomerInsightsSerializer) the virtual channel already gets
    # for free from its required checkout phone -- today every PDV sale has
    # customer_phone="" and is silently excluded from that metric.
    customer_phone = serializers.CharField(
        required=False, allow_blank=True, max_length=32, default=""
    )
    # Optional (PDV receipt PDF/email evolution): SaleOrder.customer_email
    # already exists on the model (populated by the WhatsApp/checkout flow's
    # CheckoutCustomerInputSerializer.email) but the PDV never wrote to it --
    # capturing it here is what lets the cashier email the printed receipt.
    customer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000, default="")

    def validate_items(self, value):
        """Ensure the cart has at least one item."""
        if not value:
            raise serializers.ValidationError("Informe ao menos um item para registrar a venda.")
        return value


class PdvSaleItemResponseSerializer(serializers.Serializer):
    """Normalized item details returned after a PDV sale completes."""

    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    public_code = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2)


class PdvSaleResponseSerializer(serializers.Serializer):
    """Serializer for the PDV sale confirmation response."""

    order_reference = serializers.CharField()
    items = PdvSaleItemResponseSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.CharField()
    created_at = serializers.DateTimeField()
    # Receipt PDF/email evolution: lets the just-finalized receipt modal
    # pre-fill the "send by email" field without a fresh lookup.
    customer_email = serializers.CharField()


class PdvSaleView(APIView):
    """POST /v1/pdv/sales/ -- ring up a physical-store sale by scanned code.

    Dashboard-only (has_dashboard_write_access), scoped to the requester's
    store via resolve_request_store(). Permission is checked inline (like
    SaleOrderViewSet.update_status) rather than through permission_classes,
    using self.permission_denied() so anonymous requests get a 401 and
    authenticated-but-unauthorized requests get a 403 -- the same
    401-vs-403 convention every other dashboard-only endpoint in this
    codebase follows.
    """

    @staticmethod
    def _aggregate_quantities(items: list[dict]) -> dict[str, int]:
        quantities_by_code: dict[str, int] = {}

        for item in items:
            code = item["public_code"].strip().upper()
            quantities_by_code[code] = quantities_by_code.get(code, 0) + item["quantity"]

        return quantities_by_code

    @staticmethod
    def _lock_products(quantities_by_code: dict[str, int], store: Store) -> dict[str, Product]:
        codes = sorted(quantities_by_code)
        products = (
            Product.objects.select_for_update()
            .filter(public_code__in=codes, store=store)
            .order_by("id")
        )
        products_by_code = {product.public_code: product for product in products}
        missing_codes = [code for code in codes if code not in products_by_code]

        if missing_codes:
            raise serializers.ValidationError(
                {"items": [f'Código(s) não encontrado(s) nesta loja: {", ".join(missing_codes)}']}
            )

        return products_by_code

    def _reserve_stock(
        self, items: list[dict], store: Store
    ) -> tuple[list[dict], Decimal, dict[str, Product]]:
        quantities_by_code = self._aggregate_quantities(items)
        products_by_code = self._lock_products(quantities_by_code, store)

        normalized_items = []
        subtotal = Decimal("0.00")
        timestamp = timezone.now()

        for code, quantity in quantities_by_code.items():
            product = products_by_code[code]

            if not product.is_available or product.stock_quantity <= 0:
                raise serializers.ValidationError(
                    {"items": [f'Produto "{product.name}" está indisponível.']}
                )

            if quantity > product.stock_quantity:
                raise serializers.ValidationError(
                    {
                        "items": [
                            f'Quantidade solicitada para "{product.name}" excede o '
                            f"estoque disponível ({product.stock_quantity})."
                        ]
                    }
                )

            unit_price = Decimal(product.price).quantize(Decimal("0.01"))
            line_total = (unit_price * quantity).quantize(Decimal("0.01"))
            subtotal += line_total

            normalized_items.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "public_code": product.public_code,
                    "sku": product.sku or "",
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "line_total": line_total,
                }
            )

            product.stock_quantity -= quantity
            product.is_available = product.stock_quantity > 0
            product.updated_at = timestamp

        Product.objects.bulk_update(
            list(products_by_code.values()), ["stock_quantity", "is_available", "updated_at"]
        )

        return normalized_items, subtotal, products_by_code

    def post(self, request, *args, **kwargs):
        if not has_dashboard_write_access(request.user):
            self.permission_denied(
                request, message="Você não possui permissão para registrar vendas no PDV."
            )

        store = resolve_request_store(request)
        serializer = PdvSaleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        order_reference = timezone.localtime().strftime("PDV-%Y%m%d-%H%M%S-%f")
        customer_name = validated.get("customer_name", "").strip() or DEFAULT_PDV_CUSTOMER_NAME
        customer_phone = validated.get("customer_phone", "").strip()
        customer_email = validated.get("customer_email", "").strip()
        notes = validated.get("notes", "").strip()

        with transaction.atomic():
            normalized_items, subtotal, products_by_code = self._reserve_stock(
                validated["items"], store
            )
            rounded_subtotal = subtotal.quantize(Decimal("0.01"))

            sale_order = SaleOrder.objects.create(
                store=store,
                order_reference=order_reference,
                channel=SaleOrder.CHANNEL_LOJA_FISICA,
                performed_by=request.user if request.user.is_authenticated else None,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                delivery_method="pickup",
                payment_method=validated["payment_method"],
                notes=notes,
                subtotal=rounded_subtotal,
                delivery_fee=Decimal("0.00"),
                total=rounded_subtotal,
            )

            SaleOrderItem.objects.bulk_create(
                [
                    SaleOrderItem(
                        order=sale_order,
                        product=products_by_code.get(item["public_code"]),
                        product_name=item["product_name"],
                        sku=item["sku"],
                        quantity=item["quantity"],
                        unit_price=item["unit_price"],
                        line_total=item["line_total"],
                    )
                    for item in normalized_items
                ]
            )

            # Same reasoning as CheckoutWhatsAppView: the decrement already
            # happened above in _reserve_stock (one bulk_update, inside the
            # same lock) -- this just persists the audit trail for it, built
            # from data already in memory (no extra query/lock per product).
            StockMovement.objects.bulk_create(
                [
                    StockMovement(
                        store=store,
                        product=products_by_code[item["public_code"]],
                        movement_type=StockMovement.TYPE_SAIDA,
                        quantity=item["quantity"],
                        previous_stock=(
                            products_by_code[item["public_code"]].stock_quantity + item["quantity"]
                        ),
                        new_stock=products_by_code[item["public_code"]].stock_quantity,
                        reason=StockMovement.REASON_VENDA,
                        source=StockMovement.SOURCE_PDV,
                        sale_order=sale_order,
                        performed_by=request.user if request.user.is_authenticated else None,
                    )
                    for item in normalized_items
                ]
            )

            response_serializer = PdvSaleResponseSerializer(
                {
                    "order_reference": order_reference,
                    "items": normalized_items,
                    "subtotal": rounded_subtotal,
                    "total": rounded_subtotal,
                    "payment_method": validated["payment_method"],
                    "created_at": sale_order.created_at,
                    "customer_email": customer_email,
                }
            )

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PdvReceiptEmailSerializer(serializers.Serializer):
    """Validates a request to email an already-built PDV receipt PDF."""

    email = serializers.EmailField()
    pdf_base64 = serializers.CharField()

    def validate_pdf_base64(self, value: str) -> bytes:
        try:
            pdf_bytes = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise serializers.ValidationError(
                "Não foi possível decodificar o PDF enviado."
            ) from exc

        if not pdf_bytes:
            raise serializers.ValidationError("O PDF enviado está vazio.")

        if len(pdf_bytes) > MAX_RECEIPT_PDF_BYTES:
            raise serializers.ValidationError("O PDF enviado excede o tamanho máximo permitido (5MB).")

        if not pdf_bytes.startswith(PDF_MAGIC_NUMBER):
            raise serializers.ValidationError("O arquivo enviado não parece ser um PDF válido.")

        return pdf_bytes


class PdvReceiptEmailView(APIView):
    """POST /v1/pdv/sales/<order_reference>/receipt-email/ -- email a
    client-built receipt PDF (see utils/receiptPdf.ts) to a customer.

    Scoped to a real SaleOrder belonging to the requester's store -- not a
    generic "email this file to that address" relay -- so this can't be
    repurposed to send arbitrary mail using the dashboard's own SMTP
    reputation. There is no async task queue in this project (see
    PasswordResetRequestView, the only other email sender, which is also
    synchronous), so this send blocks the request like that one does.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [PdvReceiptEmailThrottle]

    def post(self, request, *args, **kwargs):
        if not has_dashboard_write_access(request.user):
            self.permission_denied(
                request, message="Você não possui permissão para enviar recibos do PDV."
            )

        store = resolve_request_store(request)
        sale_order = SaleOrder.objects.filter(
            order_reference=kwargs["order_reference"], store=store
        ).first()
        if sale_order is None:
            return not_found_error("Venda não encontrada nesta loja.")

        serializer = PdvReceiptEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        pdf_bytes = serializer.validated_data["pdf_base64"]

        message = EmailMessage(
            subject=f"Recibo da compra {sale_order.order_reference}",
            body=(
                f"Olá! Segue em anexo o recibo da sua compra "
                f"{sale_order.order_reference}."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.attach(f"{sale_order.order_reference}.pdf", pdf_bytes, "application/pdf")
        message.send(fail_silently=False)

        return Response({"sent": True}, status=status.HTTP_200_OK)

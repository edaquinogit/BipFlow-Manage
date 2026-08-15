from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

MONEY = Decimal("0.01")
PERCENT = Decimal("100")
MAX_INSTALLMENTS_LIMIT = 24
DEFAULT_MIN_INSTALLMENT_AMOUNT = Decimal("5.00")


@dataclass(frozen=True)
class CardInstallmentOption:
    installments: int
    installment_amount: Decimal
    total: Decimal
    monthly_interest_rate: Decimal
    label: str


@dataclass(frozen=True)
class PaymentGatewaySnapshot:
    payment_link_url: str
    installments: int
    installment_amount: Decimal | None
    installment_total: Decimal | None
    card_options: list[CardInstallmentOption]


def money(value: Decimal | int | str) -> Decimal:
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def _positive_decimal(value: object, default: Decimal) -> Decimal:
    try:
        parsed = Decimal(value)
    except Exception:
        return default

    return parsed if parsed > 0 else default


def get_card_settings(store) -> tuple[int, Decimal, Decimal]:
    configured_max = int(getattr(store, "card_max_installments", 1) or 1)
    max_installments = min(max(configured_max, 1), MAX_INSTALLMENTS_LIMIT)
    min_installment = _positive_decimal(
        getattr(store, "card_min_installment_amount", DEFAULT_MIN_INSTALLMENT_AMOUNT),
        DEFAULT_MIN_INSTALLMENT_AMOUNT,
    )
    monthly_interest_rate = Decimal(getattr(store, "card_monthly_interest_rate", 0) or 0)
    if monthly_interest_rate < 0:
        monthly_interest_rate = Decimal("0.00")

    return max_installments, money(min_installment), monthly_interest_rate.quantize(
        MONEY, rounding=ROUND_HALF_UP
    )


def get_effective_card_max_installments(store, total: Decimal) -> int:
    amount = money(total)
    max_installments, min_installment, _rate = get_card_settings(store)
    if amount <= 0:
        return 1

    by_minimum_amount = int(amount / min_installment) if min_installment > 0 else max_installments
    return max(1, min(max_installments, by_minimum_amount or 1))


def calculate_card_installment(store, total: Decimal, installments: int) -> CardInstallmentOption:
    amount = money(total)
    max_installments = get_effective_card_max_installments(store, amount)
    if installments < 1 or installments > max_installments:
        raise serializers.ValidationError(
            {
                "payment_installments": (
                    f"Esta loja permite parcelar este valor em ate {max_installments}x."
                )
            }
        )

    _configured_max, _min_installment, monthly_interest_rate = get_card_settings(store)
    interest_multiplier = Decimal("1.00")
    if installments > 1 and monthly_interest_rate > 0:
        interest_multiplier = (Decimal("1.00") + (monthly_interest_rate / PERCENT)) ** (
            installments - 1
        )

    installment_total = money(amount * interest_multiplier)
    installment_amount = money(installment_total / installments)
    label = (
        f"{installments}x de R$ {installment_amount:.2f}"
        if installments > 1
        else f"1x de R$ {installment_amount:.2f}"
    )
    if installment_total != amount:
        label = f"{label} (total R$ {installment_total:.2f})"

    return CardInstallmentOption(
        installments=installments,
        installment_amount=installment_amount,
        total=installment_total,
        monthly_interest_rate=monthly_interest_rate,
        label=label,
    )


def build_card_installment_options(store, total: Decimal) -> list[CardInstallmentOption]:
    max_installments = get_effective_card_max_installments(store, total)
    return [
        calculate_card_installment(store, total, installments)
        for installments in range(1, max_installments + 1)
    ]


def build_payment_gateway_snapshot(
    *,
    store,
    payment_method: str,
    total: Decimal,
    requested_installments: int = 1,
) -> PaymentGatewaySnapshot:
    if payment_method == "pix":
        return PaymentGatewaySnapshot(
            payment_link_url=str(getattr(store, "payment_pix_link_url", "") or "").strip(),
            installments=1,
            installment_amount=None,
            installment_total=None,
            card_options=[],
        )

    if payment_method == "card":
        selected = calculate_card_installment(store, total, int(requested_installments or 1))
        return PaymentGatewaySnapshot(
            payment_link_url=str(getattr(store, "payment_card_link_url", "") or "").strip(),
            installments=selected.installments,
            installment_amount=selected.installment_amount,
            installment_total=selected.total,
            card_options=build_card_installment_options(store, total),
        )

    return PaymentGatewaySnapshot(
        payment_link_url="",
        installments=1,
        installment_amount=None,
        installment_total=None,
        card_options=[],
    )


def serialize_installment_options(options: list[CardInstallmentOption]) -> list[dict[str, str | int]]:
    return [
        {
            "installments": option.installments,
            "installment_amount": f"{option.installment_amount:.2f}",
            "total": f"{option.total:.2f}",
            "monthly_interest_rate": f"{option.monthly_interest_rate:.2f}",
            "label": option.label,
        }
        for option in options
    ]

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Q, QuerySet

from .models import DeliveryRegion, Product


@dataclass(frozen=True)
class BotOption:
    label: str
    value: str


@dataclass(frozen=True)
class BotProductSuggestion:
    id: int
    name: str
    slug: str | None
    price: Decimal
    stock_quantity: int


@dataclass(frozen=True)
class BotDeliveryRegionSuggestion:
    id: int
    name: str
    city: str
    delivery_fee: Decimal


@dataclass(frozen=True)
class BotReply:
    intent: str
    reply: str
    options: list[BotOption]
    products: list[BotProductSuggestion]
    delivery_regions: list[BotDeliveryRegionSuggestion]

    def as_dict(self) -> dict:
        return {
            "intent": self.intent,
            "reply": self.reply,
            "options": [option.__dict__ for option in self.options],
            "products": [product.__dict__ for product in self.products],
            "delivery_regions": [region.__dict__ for region in self.delivery_regions],
        }


GREETING_TERMS = {"oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"}
CATALOG_TERMS = {"catalogo", "catálogo", "cardapio", "cardápio", "menu", "produtos"}
DELIVERY_TERMS = {"entrega", "frete", "taxa", "bairro", "regiao", "região", "delivery"}
CHECKOUT_TERMS = {"comprar", "pedido", "finalizar", "fechar", "carrinho"}
HUMAN_SUPPORT_TERMS = {"atendente", "humano", "suporte", "ajuda", "falar com alguem"}


DEFAULT_OPTIONS = [
    BotOption(label="Ver produtos", value="produtos"),
    BotOption(label="Consultar entrega", value="entrega"),
    BotOption(label="Finalizar pedido", value="pedido"),
]


def normalize_message(message: str) -> str:
    """Make rule matching stable for accents and mixed casing."""
    normalized = unicodedata.normalize("NFKD", message)
    without_accents = "".join(character for character in normalized if not unicodedata.combining(character))
    return " ".join(without_accents.lower().split())


def message_has_any(message: str, terms: set[str]) -> bool:
    normalized_terms = {normalize_message(term) for term in terms}
    return any(term in message for term in normalized_terms)


def available_products() -> QuerySet[Product]:
    return Product.objects.filter(is_available=True, stock_quantity__gt=0).select_related("category")


def serialize_products(products: QuerySet[Product]) -> list[BotProductSuggestion]:
    return [
        BotProductSuggestion(
            id=product.id,
            name=product.name,
            slug=product.slug,
            price=product.price,
            stock_quantity=product.stock_quantity,
        )
        for product in products
    ]


def serialize_regions(regions: QuerySet[DeliveryRegion]) -> list[BotDeliveryRegionSuggestion]:
    return [
        BotDeliveryRegionSuggestion(
            id=region.id,
            name=region.name,
            city=region.city,
            delivery_fee=region.delivery_fee,
        )
        for region in regions
    ]


def build_product_search(message: str) -> BotReply:
    products = available_products().filter(
        Q(name__icontains=message) | Q(sku__icontains=message) | Q(description__icontains=message)
    )[:5]
    product_suggestions = serialize_products(products)

    if product_suggestions:
        return BotReply(
            intent="product_search",
            reply="Encontrei alguns produtos que combinam com sua busca.",
            options=DEFAULT_OPTIONS,
            products=product_suggestions,
            delivery_regions=[],
        )

    return BotReply(
        intent="fallback",
        reply=(
            "Ainda nao encontrei esse item. Tente perguntar por produtos, entrega "
            "ou finalize pelo carrinho."
        ),
        options=DEFAULT_OPTIONS,
        products=[],
        delivery_regions=[],
    )


def build_bot_reply(message: str) -> BotReply:
    normalized_message = normalize_message(message)

    if message_has_any(normalized_message, GREETING_TERMS):
        return BotReply(
            intent="greeting",
            reply="Ola! Posso ajudar voce a ver produtos, consultar entrega ou finalizar um pedido.",
            options=DEFAULT_OPTIONS,
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, DELIVERY_TERMS):
        regions = DeliveryRegion.objects.filter(is_active=True).order_by("name")[:8]
        return BotReply(
            intent="delivery",
            reply="Estas sao as regioes de entrega ativas no momento.",
            options=DEFAULT_OPTIONS,
            products=[],
            delivery_regions=serialize_regions(regions),
        )

    if message_has_any(normalized_message, CHECKOUT_TERMS):
        return BotReply(
            intent="checkout",
            reply=(
                "Para finalizar, escolha os produtos no carrinho e informe entrega "
                "e pagamento. Eu mantenho preco e estoque validados pelo sistema."
            ),
            options=DEFAULT_OPTIONS,
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, HUMAN_SUPPORT_TERMS):
        return BotReply(
            intent="human_support",
            reply="Certo. Vou deixar claro que voce quer atendimento humano.",
            options=DEFAULT_OPTIONS,
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, CATALOG_TERMS):
        products = available_products().order_by("-created_at")[:5]
        return BotReply(
            intent="catalog",
            reply="Aqui estao alguns produtos disponiveis agora.",
            options=DEFAULT_OPTIONS,
            products=serialize_products(products),
            delivery_regions=[],
        )

    if len(normalized_message) >= 3:
        return build_product_search(normalized_message)

    return BotReply(
        intent="fallback",
        reply="Ainda estou aprendendo. Tente perguntar por produtos, entrega ou pedido.",
        options=DEFAULT_OPTIONS,
        products=[],
        delivery_regions=[],
    )

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote

from django.db.models import Q, QuerySet

from .models import DeliveryRegion, Product, StoreSettings


@dataclass(frozen=True)
class BotOption:
    label: str
    value: str
    kind: str = "quick_reply"
    description: str = ""
    url: str = ""


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


DEFAULT_QUICK_OPTIONS = [
    BotOption(
        label="Ver produtos",
        value="produtos",
        description="Mostro opcoes disponiveis no catalogo.",
    ),
    BotOption(
        label="Consultar entrega",
        value="entrega",
        description="Vejo regioes atendidas e valores.",
    ),
    BotOption(
        label="Finalizar pedido",
        value="pedido",
        description="Oriento o checkout pelo carrinho.",
    ),
    BotOption(
        label="Falar com atendente",
        value="atendente",
        description="Encaminho para atendimento humano.",
    ),
]

WHATSAPP_HANDOFF_ACTIONS = [
    {
        "id": "products",
        "label": "Produtos e disponibilidade",
        "description": "Tamanhos, estoque, sabores ou detalhes do item.",
        "message": "Ola! Vim pelo catalogo BipFlow e tenho uma duvida sobre produtos e disponibilidade.",
    },
    {
        "id": "delivery",
        "label": "Entrega e retirada",
        "description": "Prazos, bairros atendidos e valor de entrega.",
        "message": "Ola! Vim pelo catalogo BipFlow e quero saber mais sobre entrega ou retirada.",
    },
    {
        "id": "payment",
        "label": "Formas de pagamento",
        "description": "Pix, cartao, dinheiro ou combinacao de pagamento.",
        "message": "Ola! Vim pelo catalogo BipFlow e tenho uma duvida sobre formas de pagamento.",
    },
    {
        "id": "order",
        "label": "Pedido em andamento",
        "description": "Acompanhar, ajustar ou confirmar um pedido.",
        "message": "Ola! Vim pelo catalogo BipFlow e preciso de ajuda com um pedido em andamento.",
    },
    {
        "id": "human",
        "label": "Falar com atendente",
        "description": "Abrir uma conversa direta com a equipe da loja.",
        "message": "Ola! Vim pelo catalogo BipFlow e gostaria de falar com um atendente.",
    },
]


def build_whatsapp_handoff_options() -> list[BotOption]:
    whatsapp_phone = StoreSettings.get_configured_whatsapp_phone()

    if not whatsapp_phone:
        return []

    return [
        BotOption(
            label=action["label"],
            value=f"whatsapp:{action['id']}",
            kind="whatsapp_link",
            description=action["description"],
            url=f"https://wa.me/{whatsapp_phone}?text={quote(action['message'])}",
        )
        for action in WHATSAPP_HANDOFF_ACTIONS
    ]


def default_options() -> list[BotOption]:
    return [*DEFAULT_QUICK_OPTIONS]


def support_options() -> list[BotOption]:
    whatsapp_options = build_whatsapp_handoff_options()

    if whatsapp_options:
        return whatsapp_options

    return [*DEFAULT_QUICK_OPTIONS]


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
            reply="Encontrei algumas opcoes que combinam com o que voce procurou. Da uma olhada e me diga se quer ver entrega ou finalizar.",
            options=default_options(),
            products=product_suggestions,
            delivery_regions=[],
        )

    return BotReply(
        intent="fallback",
        reply=(
            "Nao encontrei esse item com seguranca. Posso te mostrar produtos disponiveis, consultar entrega ou chamar um atendente."
        ),
        options=default_options(),
        products=[],
        delivery_regions=[],
    )


def build_bot_reply(message: str) -> BotReply:
    normalized_message = normalize_message(message)

    if message_has_any(normalized_message, GREETING_TERMS):
        return BotReply(
            intent="greeting",
            reply="Oi! Eu sou o assistente da loja. Posso te ajudar a encontrar produtos, conferir entrega e deixar tudo pronto para o pedido.",
            options=default_options(),
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, DELIVERY_TERMS):
        regions = DeliveryRegion.objects.filter(is_active=True).order_by("name")[:8]
        reply = (
            "Estas sao as regioes de entrega ativas agora."
            if regions
            else "Ainda nao encontrei regioes de entrega ativas. Posso chamar um atendente para confirmar com voce."
        )
        return BotReply(
            intent="delivery",
            reply=reply,
            options=default_options(),
            products=[],
            delivery_regions=serialize_regions(regions),
        )

    if message_has_any(normalized_message, CHECKOUT_TERMS):
        return BotReply(
            intent="checkout",
            reply=(
                "Para finalizar, revise o carrinho, informe entrega e pagamento. Eu mantenho preco, estoque e frete validados pelo sistema."
            ),
            options=default_options(),
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, HUMAN_SUPPORT_TERMS):
        has_whatsapp = bool(StoreSettings.get_configured_whatsapp_phone())
        return BotReply(
            intent="human_support",
            reply=(
                "Claro. Escolha o assunto abaixo e eu abro a conversa no WhatsApp com a mensagem certa."
                if has_whatsapp
                else "Claro. Vou deixar esta conversa marcada para atendimento humano, mas o WhatsApp da loja ainda nao esta configurado."
            ),
            options=support_options(),
            products=[],
            delivery_regions=[],
        )

    if message_has_any(normalized_message, CATALOG_TERMS):
        products = available_products().order_by("-created_at")[:5]
        reply = (
            "Separei alguns produtos disponiveis agora."
            if products
            else "Ainda nao encontrei produtos disponiveis no catalogo. Posso chamar um atendente para te ajudar."
        )
        return BotReply(
            intent="catalog",
            reply=reply,
            options=default_options(),
            products=serialize_products(products),
            delivery_regions=[],
        )

    if len(normalized_message) >= 3:
        return build_product_search(normalized_message)

    return BotReply(
        intent="fallback",
        reply="Ainda estou aprendendo, mas consigo ajudar com produtos, entrega, pedido ou atendimento humano.",
        options=default_options(),
        products=[],
        delivery_regions=[],
    )

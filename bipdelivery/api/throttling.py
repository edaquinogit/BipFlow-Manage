# bipdelivery/api/throttling.py
"""
Rate limiting para proteger a API contra abuse.
Segue padrões de Fintechs (Stone, XP, Itau).
"""

from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page


class UserThrottle(UserRateThrottle):
    """
    Limite de requisições por usuário autenticado.
    - 100 requisições por hora
    - Ideal para: consultas, buscas, filtros
    """
    scope = 'user'
    rate = '100/hour'


class AnonThrottle(AnonRateThrottle):
    """
    Limite para usuários não autenticados.
    - 20 requisições por hora (proteção contra scraping)
    - IP-based rate limiting
    """
    scope = 'anon'
    rate = '20/hour'


class ProductListThrottle(UserRateThrottle):
    """
    Rate limit customizado para listagem de produtos.
    - Mais permissivo que outras ops (reads são baratas)
    - 500/hora para usuários auth
    """
    scope = 'product_list'
    rate = '500/hour'
    
    def get_cache_key(self):
        # Cache key por usuário + endpoint
        user = self.request.user
        return f'throttle_{self.scope}_{user.id if user.is_authenticated else self.get_ident()}'

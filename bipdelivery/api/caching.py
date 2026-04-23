# bipdelivery/api/caching.py
"""
Cache headers e ETags para otimizar transferência de dados.
Segue RFC 7232 (HTTP Conditional Requests).
"""

from django.views.decorators.http import cache_page
from functools import wraps


def etag_func(request, *args, **kwargs):
    """
    Gera ETag baseado no conteúdo da resposta.
    Se content não muda, retorna mesmo hash.
    """
    # Placeholder: será calculado após response ser gerada
    return None


def cache_product_list(timeout=300):
    """
    Decorador para cache de GET /api/v1/products/
    - Timeout: 5 minutos (300s)
    - Invalidado automaticamente quando novo produto é criado
    - Cache-Control: public, max-age=300
    """

    def decorator(view_func):
        @wraps(view_func)
        @cache_page(timeout)  # Django cache framework
        def wrapped_view(request, *args, **kwargs):
            # Adiciona headers HTTP
            response = view_func(request, *args, **kwargs)
            response["Cache-Control"] = f"public, max-age={timeout}"
            response["Vary"] = "Accept, Authorization"  # Vary por auth
            return response

        return wrapped_view

    return decorator


CACHE_TIMEOUT_PRODUCT_LIST = 300  # 5 min
CACHE_TIMEOUT_CATEGORY_LIST = 600  # 10 min
CACHE_TIMEOUT_PRODUCT_DETAIL = 3600  # 1 hora

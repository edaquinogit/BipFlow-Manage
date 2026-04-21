# bipdelivery/api/pagination.py
"""
Paginação cursor-based para APIs REST.
Otimizado para grandes datasets (100k+ items).
"""

from collections import OrderedDict

from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Paginação simples baseada em número de página.
    - Default: 20 items/página
    - Máximo: 100 items/página
    - Query param: ?page=1&page_size=20
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_query_param = 'page'

    def get_paginated_response(self, data):
        return Response(OrderedDict([
            ('count', self.page.paginator.count),
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('page_size', self.page_size),
            ('total_pages', self.page.paginator.num_pages),
            ('results', data),
        ]))


class CursorPaginationLarge(CursorPagination):
    """
    Paginação cursor-based para datasets muito grandes.
    Mais eficiente que offset para queries com 10k+ resultados.
    - Query param: ?cursor=cD0yMDEzLTAxLTAxJmk9MQ%3D%3D
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    ordering = '-created_at'  # Default: ordenar por data descendente


class ProductListPagination(StandardPagination):
    """
    Paginação customizada para listagem de produtos.
    Mantém 12 items por página para sincronização com frontend (grid 3 colunas x 4 linhas).
    """
    page_size = 12
    max_page_size = 50

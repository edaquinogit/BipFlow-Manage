from __future__ import annotations

import logging
import uuid
from typing import Any, Callable

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class CORSMediaMiddleware:
    """
    Middleware to add CORS headers to media files served in development.

    Django's static file serving doesn't include CORS headers by default,
    which can cause issues when the frontend is served from a different port.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        # Add CORS headers to media files in development
        if settings.DEBUG and request.path.startswith(settings.MEDIA_URL):
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response['Access-Control-Allow-Headers'] = '*'

        return response


class GlobalExceptionMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = self._get_request_id(request)
        request.META['HTTP_X_REQUEST_ID'] = request_id

        try:
            response = self.get_response(request)
        except (ValidationError, APIException, PermissionDenied, Http404) as error:
            return self._handle_known_exception(error, request_id)
        except Exception as error:  # pragma: no cover
            return self._handle_server_error(error, request, request_id)

        response.setdefault('X-Request-ID', request_id)
        return response

    @staticmethod
    def _get_request_id(request: HttpRequest) -> str:
        request_id = request.META.get('HTTP_X_REQUEST_ID')
        if request_id:
            return request_id

        new_request_id = str(uuid.uuid4())
        request.META['HTTP_X_REQUEST_ID'] = new_request_id
        return new_request_id

    def _handle_known_exception(self, exception: Exception, request_id: str) -> JsonResponse:
        if isinstance(exception, ValidationError):
            status_code = 400
            error = 'Bad Request'
            message: Any = exception.message_dict if hasattr(exception, 'message_dict') else str(exception)
        elif isinstance(exception, Http404):
            status_code = 404
            error = 'Not Found'
            message = 'The requested resource was not found.'
        elif isinstance(exception, PermissionDenied):
            status_code = 403
            error = 'Permission Denied'
            message = str(exception) or 'You do not have permission to perform this action.'
        elif isinstance(exception, APIException):
            status_code = exception.status_code
            error = exception.default_code.replace('_', ' ').title()
            message = exception.detail
        else:
            status_code = 400
            error = 'Bad Request'
            message = str(exception)

        logger.warning(
            'Handled exception in GlobalExceptionMiddleware',
            extra={
                'request_id': request_id,
                'status_code': status_code,
                'error': error,
                'path': request.path,
            },
            exc_info=isinstance(exception, Exception),
        )

        response = JsonResponse(
            {
                'error': error,
                'message': message,
                'request_id': request_id,
            },
            status=status_code,
        )
        response.setdefault('X-Request-ID', request_id)
        return response

    def _handle_server_error(self, exception: Exception, request: HttpRequest, request_id: str) -> JsonResponse:
        logger.error(
            'Unhandled server exception',
            extra={
                'request_id': request_id,
                'path': request.path,
            },
            exc_info=True,
        )

        response = JsonResponse(
            {
                'error': 'Internal Server Error',
                'message': 'Unexpected error occurred. Please contact support with the request_id.',
                'request_id': request_id,
            },
            status=500,
        )
        response.setdefault('X-Request-ID', request_id)
        return response

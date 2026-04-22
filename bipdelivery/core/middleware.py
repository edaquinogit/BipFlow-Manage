from __future__ import annotations

import logging
import uuid
from typing import Callable

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
    """
    Standardized Error Response Middleware

    Provides consistent error responses across all API endpoints.
    All errors follow the format:
    {
        "error": "ErrorType",
        "message": "Human readable message",
        "request_id": "uuid-for-tracking",
        "details": {...} // Optional additional context
    }
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = self._get_request_id(request)
        request.META['HTTP_X_REQUEST_ID'] = request_id

        try:
            response = self.get_response(request)
        except ValidationError as error:
            return self._handle_known_exception(error, request, request_id)
        except APIException as error:
            return self._handle_known_exception(error, request, request_id)
        except PermissionDenied as error:
            return self._handle_known_exception(error, request, request_id)
        except Http404 as error:
            return self._handle_known_exception(error, request, request_id)
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

    def _handle_known_exception(self, exception: Exception, request: HttpRequest, request_id: str) -> JsonResponse:
        """
        Handle known exception types with standardized error responses.
        """
        if isinstance(exception, ValidationError):
            status_code = 400
            error_type = 'VALIDATION_ERROR'
            message = self._extract_validation_message(exception)
            details = {'fields': exception.message_dict} if hasattr(exception, 'message_dict') else None
        elif isinstance(exception, Http404):
            status_code = 404
            error_type = 'NOT_FOUND'
            message = 'O recurso solicitado não foi encontrado.'
            details = None
        elif isinstance(exception, PermissionDenied):
            status_code = 403
            error_type = 'PERMISSION_DENIED'
            message = str(exception) or 'Você não tem permissão para executar esta ação.'
            details = None
        elif isinstance(exception, APIException):
            status_code = exception.status_code
            error_type = self._get_api_exception_type(exception)
            message = exception.detail
            details = getattr(exception, 'details', None)
        else:
            status_code = 400
            error_type = 'BAD_REQUEST'
            message = str(exception)
            details = None

        logger.warning(
            'Handled exception in GlobalExceptionMiddleware',
            extra={
                'request_id': request_id,
                'status_code': status_code,
                'error_type': error_type,
                'path': request.path,
            },
            exc_info=isinstance(exception, Exception),
        )

        response_data = {
            'error': error_type,
            'message': message,
            'request_id': request_id,
        }

        if details:
            response_data['details'] = details

        response = JsonResponse(response_data, status=status_code)
        response.setdefault('X-Request-ID', request_id)
        return response

    @staticmethod
    def _extract_validation_message(exception: ValidationError) -> str:
        """Extract human-readable message from ValidationError."""
        if hasattr(exception, 'message_dict') and exception.message_dict:
            # Get first error message from first field
            first_field = next(iter(exception.message_dict.keys()))
            first_errors = exception.message_dict[first_field]
            if isinstance(first_errors, list) and first_errors:
                return str(first_errors[0])
        return str(exception) or 'Dados inválidos fornecidos.'

    @staticmethod
    def _get_api_exception_type(exception: APIException) -> str:
        """Map APIException to standardized error type."""
        # Check by status code first for more reliable mapping
        status_mapping = {
            401: 'NOT_AUTHENTICATED',
            403: 'PERMISSION_DENIED',
            404: 'NOT_FOUND',
            405: 'METHOD_NOT_ALLOWED',
            406: 'NOT_ACCEPTABLE',
            415: 'UNSUPPORTED_MEDIA_TYPE',
            429: 'THROTTLED',
        }

        if exception.status_code in status_mapping:
            return status_mapping[exception.status_code]

        # Fallback to default_code mapping
        error_mapping = {
            'authentication_failed': 'AUTHENTICATION_FAILED',
            'not_authenticated': 'NOT_AUTHENTICATED',
            'permission_denied': 'PERMISSION_DENIED',
            'not_found': 'NOT_FOUND',
            'method_not_allowed': 'METHOD_NOT_ALLOWED',
            'not_acceptable': 'NOT_ACCEPTABLE',
            'unsupported_media_type': 'UNSUPPORTED_MEDIA_TYPE',
            'throttled': 'THROTTLED',
        }
        return error_mapping.get(exception.default_code, 'API_EXCEPTION')

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
                'error': 'INTERNAL_SERVER_ERROR',
                'message': 'Erro interno do servidor. Entre em contato com o suporte informando o request_id.',
                'request_id': request_id,
            },
            status=500,
        )
        response.setdefault('X-Request-ID', request_id)
        return response

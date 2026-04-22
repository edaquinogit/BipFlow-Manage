"""
BipFlow Error Response Utilities

Provides standardized error response functions for consistent API error handling.
All error responses follow the format:
{
    "error": "ERROR_TYPE",
    "message": "Human readable message",
    "request_id": "uuid-for-tracking",  # Added by middleware
    "details": {...}  # Optional additional context
}
"""

from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.response import Response


def error_response(
    error_type: str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """
    Create a standardized error response.

    Args:
        error_type: Error type identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
        message: Human-readable error message
        status_code: HTTP status code
        details: Optional additional error context

    Returns:
        DRF Response with standardized error format
    """
    response_data = {
        'error': error_type,
        'message': message,
    }

    if details:
        response_data['details'] = details

    return Response(response_data, status=status_code)


# Convenience functions for common error types

def validation_error(
    message: str = 'Dados inválidos fornecidos.',
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """Return validation error response."""
    return error_response('VALIDATION_ERROR', message, status.HTTP_400_BAD_REQUEST, details)


def not_found_error(
    message: str = 'O recurso solicitado não foi encontrado.',
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """Return not found error response."""
    return error_response('NOT_FOUND', message, status.HTTP_404_NOT_FOUND, details)


def permission_denied_error(
    message: str = 'Você não tem permissão para executar esta ação.',
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """Return permission denied error response."""
    return error_response('PERMISSION_DENIED', message, status.HTTP_403_FORBIDDEN, details)


def conflict_error(
    message: str = 'Conflito com o estado atual do recurso.',
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """Return conflict error response."""
    return error_response('CONFLICT', message, status.HTTP_409_CONFLICT, details)


def business_logic_error(
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> Response:
    """Return business logic error response."""
    return error_response('BUSINESS_LOGIC_ERROR', message, status.HTTP_400_BAD_REQUEST, details)

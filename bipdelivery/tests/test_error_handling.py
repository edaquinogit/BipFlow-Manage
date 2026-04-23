"""
Tests for standardized error handling middleware and utilities.
"""

import json

from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import APIException

from bipdelivery.api.errors import (
    business_logic_error,
    error_response,
)
from bipdelivery.api.errors import (
    validation_error as validation_error_func,
)
from bipdelivery.core.middleware import GlobalExceptionMiddleware


class ErrorResponseTests(TestCase):
    """Test standardized error response utilities."""

    def test_error_response_basic(self):
        """Test basic error response structure."""
        response = error_response("TEST_ERROR", "Test message", status.HTTP_400_BAD_REQUEST)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.data

        self.assertEqual(data["error"], "TEST_ERROR")
        self.assertEqual(data["message"], "Test message")
        # request_id is added by middleware, not by error_response utility

    def test_error_response_with_details(self):
        """Test error response with additional details."""
        details = {"field": "name", "value": "invalid"}
        response = error_response("VALIDATION_ERROR", "Invalid name", details=details)

        data = response.data
        self.assertEqual(data["details"], details)

    def test_validation_error_response(self):
        """Test validation error convenience function."""
        response = validation_error_func("Dados inválidos")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "VALIDATION_ERROR")
        self.assertEqual(response.data["message"], "Dados inválidos")

    def test_business_logic_error_response(self):
        """Test business logic error convenience function."""
        response = business_logic_error("Produto indisponível")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "BUSINESS_LOGIC_ERROR")
        self.assertEqual(response.data["message"], "Produto indisponível")


class GlobalExceptionMiddlewareTests(TestCase):
    """Test GlobalExceptionMiddleware error handling."""

    def setUp(self):
        self.middleware = GlobalExceptionMiddleware(lambda r: None)
        self.mock_request = type("MockRequest", (), {"META": {}, "path": "/test/path"})()

    def test_validation_error_handling(self):
        """Test ValidationError handling."""
        validation_error = DjangoValidationError({"field": ["Error message"]})

        response = self.middleware._handle_known_exception(
            validation_error, self.mock_request, "test-request-id"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = json.loads(response.content)

        self.assertEqual(data["error"], "VALIDATION_ERROR")
        self.assertIn("Error message", data["message"])
        self.assertEqual(data["request_id"], "test-request-id")
        self.assertIn("details", data)

    def test_http404_handling(self):
        """Test Http404 handling."""
        response = self.middleware._handle_known_exception(
            Http404(), self.mock_request, "test-request-id"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = json.loads(response.content)

        self.assertEqual(data["error"], "NOT_FOUND")
        self.assertIn("não foi encontrado", data["message"])

    def test_permission_denied_handling(self):
        """Test PermissionDenied handling."""
        response = self.middleware._handle_known_exception(
            PermissionDenied(), self.mock_request, "test-request-id"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = json.loads(response.content)

        self.assertEqual(data["error"], "PERMISSION_DENIED")
        self.assertIn("permissão", data["message"])

    def test_api_exception_handling(self):
        """Test APIException handling."""
        api_exception = APIException("Custom API error")
        api_exception.status_code = status.HTTP_429_TOO_MANY_REQUESTS

        response = self.middleware._handle_known_exception(
            api_exception, self.mock_request, "test-request-id"
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = json.loads(response.content)

        self.assertEqual(data["error"], "THROTTLED")  # Based on default_code mapping
        self.assertEqual(data["message"], "Custom API error")

    def test_server_error_handling(self):
        """Test server error handling."""
        response = self.middleware._handle_server_error(
            Exception("Test error"), self.mock_request, "test-request-id"
        )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = json.loads(response.content)

        self.assertEqual(data["error"], "INTERNAL_SERVER_ERROR")
        self.assertIn("contato com o suporte", data["message"])
        self.assertEqual(data["request_id"], "test-request-id")

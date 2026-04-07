"""
Pytest configuration and fixtures for Django test suite.

This file is automatically discovered by pytest and ensures Django is properly
configured before any tests run.
"""

import os

import django

# Set up Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

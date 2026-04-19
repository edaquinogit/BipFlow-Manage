"""
Root conftest.py for pytest configuration.

This file ensures that the bipdelivery package is importable
and Django is properly configured before tests run.
"""

import os
import sys
from pathlib import Path

import django

# Add bipdelivery to Python path
project_root = Path(__file__).parent
bipdelivery_path = project_root / "bipdelivery"
if str(bipdelivery_path.parent) not in sys.path:
    sys.path.insert(0, str(bipdelivery_path.parent))

# Set up Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bipdelivery.core.settings')
django.setup()

"""
Root conftest for pytest-django.
Fixtures defined here are available to all test files.
"""

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()

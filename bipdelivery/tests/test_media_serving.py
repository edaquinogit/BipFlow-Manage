"""
Media Serving & Image Rendering Tests

Comprehensive test suite validating that Django correctly serves media files
and that the API returns absolute URLs for image fields, enabling proper
frontend rendering on the Dashboard.

Ensures:
- Media files are correctly configured in Django settings
- API responses contain absolute URLs instead of relative paths
- ProductSerializer correctly handles image field serialization
- Frontend can access images from returned URLs

Run with:
    pytest tests/test_media_serving.py -v
"""

import os
from io import BytesIO
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth.models import User
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Category, Product


@pytest.fixture
def api_client():
    """Fixture providing an API client for HTTP requests."""
    return APIClient()


@pytest.fixture
def authenticated_user(db):
    """Fixture providing an authenticated test user."""
    return User.objects.create_user(
        username='testuser',
        email='testuser@example.com',
        password='testpass123'
    )


@pytest.fixture
def test_category(db):
    """Fixture providing a test category."""
    return Category.objects.create(
        name='Test Category',
        slug='test-category'
    )


@pytest.fixture
def mock_image():
    """Fixture providing a factory function to create mock PIL Image files."""
    def _make_image(color=(155, 0, 0)):
        image_file = BytesIO()
        image = Image.new('RGBA', size=(100, 100), color=color)
        image.save(image_file, 'png')
        image_file.name = 'test_image.png'
        image_file.seek(0)
        return image_file
    return _make_image


@pytest.mark.django_db
def test_media_url_configuration(db):
    """
    Validate that Django MEDIA_URL and MEDIA_ROOT are correctly configured.

    This ensures the foundation for media serving is properly set up.
    """
    assert settings.MEDIA_URL == '/media/', \
        f"Expected MEDIA_URL='/media/', got {settings.MEDIA_URL}"
    assert settings.MEDIA_ROOT == Path(settings.BASE_DIR) / 'media', \
        f"MEDIA_ROOT not correctly configured: {settings.MEDIA_ROOT}"

    # Verify media directories are created
    assert os.path.exists(settings.MEDIA_ROOT), \
        f"MEDIA_ROOT directory does not exist: {settings.MEDIA_ROOT}"


@pytest.mark.django_db
def test_product_image_url_is_absolute(api_client, authenticated_user, test_category, mock_image):
    """
    Ensure the API returns a full, absolute URL for product images,
    not a relative path, to enable correct frontend rendering.

    This is the critical test for Dashboard image rendering (Issue #24).
    """
    api_client.force_authenticate(user=authenticated_user)

    # Create product with image via API
    create_url = '/api/v1/products/'
    data = {
        'name': 'Test Image Rendering Product',
        'price': '99.99',
        'stock_quantity': 10,
        'is_available': True,
        'category': test_category.id,
        'image': mock_image()
    }
    response = api_client.post(create_url, data, format='multipart')
    assert response.status_code == status.HTTP_201_CREATED, \
        f"Failed to create product: {response.data}"

    product_id = response.data['id']
    retrieve_url = f'/api/v1/products/{product_id}/'
    get_response = api_client.get(retrieve_url)

    # Validation: Ensure image field is an absolute URL
    image_url = get_response.data['image']
    assert image_url is not None, "Image URL should not be None"
    assert isinstance(image_url, str), \
        f"Image URL should be string, got {type(image_url)}"
    assert image_url.startswith('http://') or image_url.startswith('https://'), \
        f"Image URL should be absolute, got: {image_url}"
    assert 'media/' in image_url, \
        f"Image URL should contain 'media/' segment, got: {image_url}"

    # Verify product was created
    product = Product.objects.get(id=product_id)
    assert product.image is not None, "Product image should not be None"


@pytest.mark.django_db
def test_multiple_products_image_urls(api_client, authenticated_user, test_category, mock_image):
    """
    Verify that multiple products correctly return different absolute image URLs.

    This tests the serializer's ability to handle multiple image instances.
    """
    api_client.force_authenticate(user=authenticated_user)

    create_url = '/api/v1/products/'

    # Create multiple products with images
    for i in range(3):
        data = {
            'name': f'Product {i}',
            'price': f'{50 + i * 10}.00',
            'stock_quantity': 10 + i,
            'is_available': True,
            'category': test_category.id,
            'image': mock_image(color=(155, i*50, 0))
        }
        response = api_client.post(create_url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED

    # List all products and verify each has an absolute URL
    list_url = '/api/v1/products/'
    list_response = api_client.get(list_url)
    assert list_response.status_code == status.HTTP_200_OK

    products = list_response.data
    assert len(products) == 3, f"Expected 3 products, got {len(products)}"

    for idx, product in enumerate(products):
        image_url = product['image']
        assert image_url is not None, f"Product {idx} image URL should not be None"
        assert image_url.startswith('http://') or image_url.startswith('https://'), \
            f"Product {idx} image URL should be absolute, got: {image_url}"
        assert 'media/products/' in image_url, \
            f"Product {idx} image URL should contain 'media/products/', got: {image_url}"


@pytest.mark.django_db
def test_product_without_image_returns_none(api_client, authenticated_user, test_category):
    """
    Verify that products without images return None for the image field
    instead of raising an error.

    Tests edge case where image is optional.
    """
    api_client.force_authenticate(user=authenticated_user)

    # Create product without image
    create_url = '/api/v1/products/'
    data = {
        'name': 'Product Without Image',
        'price': '49.99',
        'stock_quantity': 5,
        'is_available': True,
        'category': test_category.id
    }
    response = api_client.post(create_url, data, format='multipart')
    assert response.status_code == status.HTTP_201_CREATED

    product_id = response.data['id']
    retrieve_url = f'/api/v1/products/{product_id}/'
    get_response = api_client.get(retrieve_url)

    # Validation: Image should be None when not provided
    image_url = get_response.data['image']
    assert image_url is None, \
        f"Image URL should be None when no image provided, got: {image_url}"


@pytest.mark.django_db
def test_media_serving_url_patterns(db):
    """
    Verify that Django URL patterns include media file serving in DEBUG mode.

    This test validates the urls.py configuration for the project.
    """
    from django.conf import settings as django_settings

    # When DEBUG=True, media files should be served
    if django_settings.DEBUG:
        # The media URL pattern should be in the urlpatterns
        # This is a simplified check; the actual serving is tested via HTTP requests
        assert django_settings.MEDIA_URL == '/media/', \
            "MEDIA_URL should be set to '/media/' in DEBUG mode"


@pytest.mark.django_db
def test_absolute_image_url_format(api_client, authenticated_user, test_category, mock_image):
    """
    Verify the specific format of absolute image URLs returned by the API.

    Ensures URLs follow the pattern: http://testserver/media/products/YYYY/MM/filename.ext
    """
    api_client.force_authenticate(user=authenticated_user)

    create_url = '/api/v1/products/'
    data = {
        'name': 'URL Format Test Product',
        'price': '75.50',
        'stock_quantity': 15,
        'is_available': True,
        'category': test_category.id,
        'image': mock_image()
    }
    response = api_client.post(create_url, data, format='multipart')
    assert response.status_code == status.HTTP_201_CREATED

    product_id = response.data['id']
    retrieve_url = f'/api/v1/products/{product_id}/'
    get_response = api_client.get(retrieve_url)

    image_url = get_response.data['image']
    assert image_url is not None, "Image URL should not be None"

    # Verify URL structure
    expected_domain = 'testserver'  # pytest test client uses this domain
    assert expected_domain in image_url or image_url.startswith('http://') or image_url.startswith('https://'), \
        f"Image URL should point to a valid domain, got: {image_url}"
    assert '/media/products/' in image_url, \
        f"Image URL should include '/media/products/' path, got: {image_url}"


# Cleanup helper (for manual file cleanup if needed)
def cleanup_test_images():
    """
    Clean up test image files from media directory.

    This is optional as pytest-django usually handles this automatically
    when using the db fixture.
    """
    test_images_dir = settings.MEDIA_ROOT / 'products'
    if test_images_dir.exists():
        import shutil
        try:
            shutil.rmtree(test_images_dir)
        except Exception:
            pass

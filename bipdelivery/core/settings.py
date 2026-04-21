import os
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# ðŸ›°ï¸ BASE DIRECTORY & PATHS
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env values into environment variables
load_dotenv(BASE_DIR / '.env')

# ------------------------------------------------------------------------------
# ðŸ”‘ SECURITY & ENVIRONMENT
# ------------------------------------------------------------------------------

def get_bool_env(key: str, default: bool = False) -> bool:
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def is_test_mode() -> bool:
    return bool(
        os.environ.get('PYTEST_CURRENT_TEST')
        or any('pytest' in arg for arg in sys.argv)
    )


ENVIRONMENT = os.environ.get('DJANGO_ENV', 'development').strip().lower()
IS_PRODUCTION = ENVIRONMENT == 'production'
IS_TEST = is_test_mode()


def get_env_or_raise(key: str) -> str:
    value = os.environ.get(key)
    if value:
        return value

    if not IS_PRODUCTION:
        return 'django-insecure-local-key'

    raise ImproperlyConfigured(f'{key} must be set as an environment variable.')


DEBUG = get_bool_env('DJANGO_DEBUG', not IS_PRODUCTION)

if IS_PRODUCTION and DEBUG:
    raise ImproperlyConfigured('DJANGO_DEBUG must be False in production.')

SECRET_KEY = get_env_or_raise('DJANGO_SECRET_KEY')

allowed_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts.split(',') if host.strip()]

if not ALLOWED_HOSTS:
    if not IS_PRODUCTION:
        ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
    else:
        raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS must be defined in production.')

# ------------------------------------------------------------------------------
# ðŸ“¦ APPS CONFIGURATION (Segregated for Clarity)
# ------------------------------------------------------------------------------
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'django_filters',
    # 'rest_framework_simplejwt',  # JWT auth is configured in REST_FRAMEWORK settings, not as installed app
]

LOCAL_APPS = [
    'bipdelivery.api.apps.ApiConfig',
    'bipdelivery.core',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ------------------------------------------------------------------------------
# ðŸ›¡ï¸ MIDDLEWARE (Security Order is Critical)
# ------------------------------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # ðŸš€ Must be first for CORS preflight
    'bipdelivery.core.middleware.CORSMediaMiddleware',  # ðŸ–¼ï¸ CORS for media files
    'django.middleware.security.SecurityMiddleware',
    'bipdelivery.core.middleware.GlobalExceptionMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'bipdelivery.core.urls'
WSGI_APPLICATION = 'bipdelivery.core.wsgi.application'

# ------------------------------------------------------------------------------
# ðŸŽ¨ TEMPLATE ENGINE (Fixes admin.E403 Error)
# ------------------------------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ------------------------------------------------------------------------------
# ðŸ“Š DATABASE & AUTHENTICATION
# ------------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ------------------------------------------------------------------------------
# ðŸŒ INTERNATIONALIZATION
# ------------------------------------------------------------------------------
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------------------
# ðŸ–¼ï¸ STATIC & MEDIA ASSETS (BipFlow Assets Protocol)
# ------------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Automatic directory creation for assets
for path in [STATIC_ROOT, MEDIA_ROOT]:
    os.makedirs(path, exist_ok=True)

# ------------------------------------------------------------------------------
# ðŸ”’ CORS & DRF SECURITY
# ------------------------------------------------------------------------------
# Parse CORS allowed origins from environment or use sensible defaults
cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if DEBUG:
    # In development, allow localhost and common dev ports
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:5173',  # Vite dev server
        'http://localhost:3000',  # Alternative dev port
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        'http://localhost:8000',  # Django dev server
        'http://127.0.0.1:8000',
    ]
elif cors_origins:
    # In production, use environment variable (comma-separated)
    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in cors_origins.split(',')
        if origin.strip()
    ]
else:
    # Fallback for production without env var - no CORS
    CORS_ALLOWED_ORIGINS = []

CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # ðŸ"' Allow public read access by default
    ],    'DEFAULT_PAGINATION_CLASS': 'bipdelivery.api.pagination.StandardPagination',
    'PAGE_SIZE': 12,}

# ðŸ›°ï¸ JWT CONFIGURATION (Token Standards)
# ------------------------------------------------------------------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ------------------------------------------------------------------------------
# ORDER CHECKOUT / WHATSAPP
# ------------------------------------------------------------------------------
WHATSAPP_ORDER_PHONE = os.environ.get('WHATSAPP_ORDER_PHONE', '').strip()
ORDER_DELIVERY_FEE = Decimal(os.environ.get('ORDER_DELIVERY_FEE', '12.00'))

# ------------------------------------------------------------------------------

# ─────────────────────────────────────────────────────────────────────────
# 🕐 CACHE CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'bipflow-cache',
        'TIMEOUT': 300,
        'OPTIONS': {
            'MAX_ENTRIES': 10000,
        }
    }
}




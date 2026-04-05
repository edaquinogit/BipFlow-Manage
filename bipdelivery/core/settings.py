import os
from pathlib import Path
from datetime import timedelta

# ------------------------------------------------------------------------------
# 🛰️ BASE DIRECTORY & PATHS
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------------------
# 🔑 SECURITY & ENVIRONMENT
# ------------------------------------------------------------------------------
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-p#994+*a+ah%p$u=i96^-ntbfax!xc3%1t62kq_1ad0yfj_ka%')

DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*', '127.0.0.1', 'localhost']

# ------------------------------------------------------------------------------
# 📦 APPS CONFIGURATION (Segregated for Clarity)
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
    'rest_framework_simplejwt',
    'drf_spectacular',
]

LOCAL_APPS = [
    'api.apps.ApiConfig',
    'core',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ------------------------------------------------------------------------------
# 🛡️ MIDDLEWARE (Security Order is Critical)
# ------------------------------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # 🚀 Must be first for CORS preflight
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

# ------------------------------------------------------------------------------
# 🎨 TEMPLATE ENGINE (Fixes admin.E403 Error)
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
# 📊 DATABASE & AUTHENTICATION
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
# 🌍 INTERNATIONALIZATION
# ------------------------------------------------------------------------------
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------------------
# 🖼️ STATIC & MEDIA ASSETS (BipFlow Assets Protocol)
# ------------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Absolute URLs for serializers when request context is missing (tasks, shell).
# Example: https://api.bipflow.example — no trailing slash.
# Defaults to localhost:8000 in development (DEBUG=True) and requires env var in production
PUBLIC_BASE_URL = os.environ.get(
    'DJANGO_PUBLIC_BASE_URL',
    'http://127.0.0.1:8000' if DEBUG else ''
).strip().rstrip('/')

# Automatic directory creation for assets
for path in [STATIC_ROOT, MEDIA_ROOT]:
    os.makedirs(path, exist_ok=True)

# ------------------------------------------------------------------------------
# 🔒 CORS & DRF SECURITY
# ------------------------------------------------------------------------------
# In DEBUG mode, allow local Vite development server. In production, set explicitly.
CORS_ALLOW_ALL_ORIGINS = DEBUG  # ⚠️ Restrict in production!
if not DEBUG:
    # Production: Explicitly allow your frontend domain
    CORS_ALLOWED_ORIGINS = os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'https://example.com'
    ).split(',')
else:
    # Development: Allow localhost origins for Vite (port 5173) and any localhost variant
    CORS_ALLOWED_ORIGINS = [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:8000',
        'http://localhost:8000',
    ]

CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # 📡 AUTO-GENERATED DOCUMENTATION (drf-spectacular)
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# 📚 DRF-SPECTACULAR CONFIGURATION (Auto-generate OpenAPI/Swagger docs)
SPECTACULAR_SETTINGS = {
    'TITLE': 'BipFlow API',
    'DESCRIPTION': 'Full-stack asset management system API • Vue 3 + Vite / Django REST Framework',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': '/api/v1/',
    'AUTHENTICATION_WHITELIST': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    # Server definitions for Swagger UI
    'SERVERS': [
        {'url': 'http://127.0.0.1:8000', 'description': 'Local Development'},
        {'url': 'https://api.bipflow.example.com', 'description': 'Production'},
    ],
    # Improve readability: group endpoints by tags
    'TITLE_COMPONENT': 'drf_spectacular.openapi.AutoSchema',
    # Enable request/response examples from docstrings
    'EXAMPLES_USE_INSTANCE': True,
    # Use explicit type hints from ViewSets docstrings
    'ENUM_GENERATE_CHOICE_DESCRIPTION': True,
    'ENUM_NAME_CASE': 'upper',
}

# ------------------------------------------------------------------------------
# 🛰️ JWT CONFIGURATION (Token Standards)
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
import os
from pathlib import Path
from datetime import timedelta

# 🛰️ BASE DIRECTORY SETUP
BASE_DIR = Path(__file__).resolve().parent.parent

# 🔑 SECURITY WARNING: keep the secret key used in production secret!
# Em produção, utilize variáveis de ambiente (.env)
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-p#994+*a+ah%p$u=i96^-ntbfax!xc3%1t62kq_1ad0yfj_ka%')

DEBUG = True

ALLOWED_HOSTS = ['*', '127.0.0.1', 'localhost']

# ==============================================================================
# 📦 APPLICATION DEFINITION
# ==============================================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # 🛠️ THIRD PARTY PLUGINS
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',

    # 🚀 BIPFLOW LOCAL APPS
    'api.apps.ApiConfig',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # 🛡️ MUST BE FIRST
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
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

WSGI_APPLICATION = 'core.wsgi.application'

# ==============================================================================
# 📊 DATABASE & LOCALIZATION
# ==============================================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# ==============================================================================
# 🖼️ STATIC & MEDIA ASSETS (THE IMAGE FIX)
# ==============================================================================
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Criar pasta media se não existir para evitar erros de IO
if not os.path.exists(MEDIA_ROOT):
    os.makedirs(MEDIA_ROOT)

# ==============================================================================
# 🛡️ CORS & SECURITY STANDARDS
# ==============================================================================
CORS_ALLOW_ALL_ORIGINS = True # 🚨 Apenas para desenvolvimento! 
CORS_ALLOW_CREDENTIALS = True

# Permitir que o Vue.js acesse os headers de autenticação
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ==============================================================================
# 🛰️ DRF & JWT CONFIGURATION
# ==============================================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}
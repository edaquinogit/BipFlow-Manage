import os
from pathlib import Path
from datetime import timedelta # Importante para configurar o tempo do token

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-p#994+*a+ah%p$u=i96^-ntbfax!xc3%1t62kq_1ad0yfj_ka%'
DEBUG = True
ALLOWED_HOSTS = ['*', '127.0.0.1', 'localhost']

INSTALLED_APPS = [
    # 1. Apps nativas do Django (OBRIGATÓRIO vir antes)
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # 2. Bibliotecas de terceiros
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',

    # 3. Suas Apps
    'api',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # MOVIDO PARA O TOPO
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

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# --- CONFIGURAÇÕES DE ELITE (NY STANDARDS) ---

# Segurança: Permitir apenas o seu Vue.js
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication', # MUDADO PARA JWT
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated', # Mais seguro que OrReadOnly
    ],
}

# Configuração do tempo de vida do Token (Opcional, mas profissional)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}
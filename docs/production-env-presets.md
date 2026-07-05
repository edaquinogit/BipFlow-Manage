# Production Environment Presets

This file provides copy-ready variable presets for the two supported production topologies.

Use only one topology per deployment.

## 1. Single-Origin (VM + reverse proxy)

Use this when frontend and backend share one HTTPS domain and the proxy serves `/api`.

```env
# Core
DJANGO_ENV=production
DJANGO_SECRET_KEY=<generated-secret>
DJANGO_ALLOWED_HOSTS=app.seudominio.com
BASE_URL=https://app.seudominio.com
FRONTEND_BASE_URL=https://app.seudominio.com

# Browser security
CSRF_TRUSTED_ORIGINS=https://app.seudominio.com
CORS_ALLOWED_ORIGINS=https://app.seudominio.com
# Keep unset/False in single-origin
# BIPFLOW_CROSS_ORIGIN_COOKIES=False

# Frontend build/runtime
VITE_API_URL=/api/

# Infra
POSTGRES_DB=bipflow
POSTGRES_USER=bipflow
POSTGRES_PASSWORD=<postgres-password>
REDIS_PASSWORD=<redis-password>
DATABASE_CONN_MAX_AGE=60

# CAPTCHA
TURNSTILE_SECRET_KEY=<turnstile-secret>

# Media (R2)
R2_ACCOUNT_ID=<r2-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=bipflow-media
R2_PUBLIC_DOMAIN=media.seudominio.com

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.seuprovedor.com
EMAIL_PORT=587
EMAIL_HOST_USER=<smtp-user>
EMAIL_HOST_PASSWORD=<smtp-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=no-reply@seudominio.com
```

## 2. Split-Origin (Cloudflare Pages + Render)

Use this when frontend and backend are on different HTTPS domains.

```env
# Core
DJANGO_ENV=production
DJANGO_SECRET_KEY=<generated-secret>
DJANGO_ALLOWED_HOSTS=bipflow-backend.onrender.com
BASE_URL=https://bipflow-backend.onrender.com
FRONTEND_BASE_URL=https://bipflow.pages.dev

# Browser security (must match exact frontend origin)
CSRF_TRUSTED_ORIGINS=https://bipflow.pages.dev
CORS_ALLOWED_ORIGINS=https://bipflow.pages.dev
BIPFLOW_CROSS_ORIGIN_COOKIES=True

# Frontend build/runtime (Cloudflare Pages env vars)
VITE_API_URL=https://bipflow-backend.onrender.com/api/
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>

# Infra
DATABASE_URL=<neon-pooled-url-with-sslmode-require>
CACHE_URL=<upstash-rediss-url>
DATABASE_CONN_MAX_AGE=60

# CAPTCHA
TURNSTILE_SECRET_KEY=<turnstile-secret>

# Media (R2)
R2_ACCOUNT_ID=<r2-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=bipflow-media
R2_PUBLIC_DOMAIN=<optional-media-domain>

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=<smtp-host>
EMAIL_PORT=587
EMAIL_HOST_USER=<smtp-user>
EMAIL_HOST_PASSWORD=<smtp-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=no-reply@seudominio.com
```

## Apply Order

1. Configure backend variables first.
2. Deploy backend and confirm `/api/health/` (or API root) is reachable.
3. Configure frontend variables and redeploy frontend.
4. Run the authentication and refresh smoke from [docs/production-go-live.md](docs/production-go-live.md).

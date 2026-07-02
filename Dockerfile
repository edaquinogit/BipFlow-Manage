FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY bipdelivery ./bipdelivery
COPY docker/backend-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && adduser --disabled-password --gecos "" appuser \
    && mkdir -p /app/bipdelivery/staticfiles /app/bipdelivery/media /app/bipdelivery/logs \
    && chown -R appuser:appuser /app

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
# Shell form (not exec-form JSON) so ${PORT} expands: PaaS runtimes like
# Render inject their own PORT and expect the container to bind to it. Falls
# back to 8000 -- the docker-compose files never set PORT, so that path is
# unaffected.
CMD gunicorn bipdelivery.core.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 60

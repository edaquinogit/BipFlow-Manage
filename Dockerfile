# Canonical runtime image: Django REST backend (bipdelivery/).
# The frontend (bipflow-frontend/) builds and deploys separately.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /usr/src/app

# Build deps for Pillow / native wheels; removed after install to keep image slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /usr/src/app/bipdelivery

EXPOSE 8000

# Development-oriented entrypoint. For production, front this with a WSGI/ASGI
# server (e.g. gunicorn) and run `python manage.py migrate` on release.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

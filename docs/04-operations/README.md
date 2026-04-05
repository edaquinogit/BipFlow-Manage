# 04 - OPERATIONS & DEPLOYMENT

> Environment setup, Docker configuration, deployment procedures, and runtime operations

## Overview

This level covers **environment configuration**, **Docker orchestration**, **deployment procedures**, **monitoring**, and **operational runbooks**.

## Environment Setup

### Development Environment

#### Installation

```bash
# Clone repository
git clone https://github.com/edaquinogit/BipFlow-Manage.git
cd BipFlow-Oficial

# Backend setup (Django)
cd bipdelivery
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start Django development server
python manage.py runserver 0.0.0.0:8000

# Frontend setup (Vue 3)
cd ../bipflow-frontend
npm install
npm run dev

# API Order Validation Service
cd ../api-order-validation
npm install
npm start
```

#### Backend .env Template

```bash
# Django Settings
DEBUG=True
SECRET_KEY=your-secret-key-here-change-in-production
DJANGO_DEBUG=True

# Database (default: SQLite)
DATABASE_URL=sqlite:///db.sqlite3
# For PostgreSQL: postgresql://user:password@localhost:5432/bipflow

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Media & Static Files
MEDIA_ROOT=/app/media
STATIC_ROOT=/app/staticfiles

# API Documentation
SPECTACULAR_TITLE=BipFlow API
SPECTACULAR_DESCRIPTION=Product Inventory Management System

# JWT Configuration
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

#### Frontend .env Template

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000

# Logging
VITE_LOG_LEVEL=debug

# Feature Flags
VITE_ENABLE_ANALYTICS=false
```

### Production Environment

#### .env for Production

```bash
# Security
DEBUG=False
ALLOWED_HOSTS=api.bipflow.io,bipflow.io
SECRET_KEY=use-strong-random-value-here
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@db.bip flow.io:5432/bipflow_prod
DB_POOL_SIZE=20

# Redis (Optional caching)
REDIS_URL=redis://redis.bipflow.io:6379/0

# CORS
CORS_ALLOWED_ORIGINS=https://bipflow.io,https://app.bipflow.io

# Logging & Monitoring
SENTRY_DSN=https://key@sentry.io/project-id
LOG_LEVEL=info

# JWT
JWT_EXPIRATION_HOURS=8

# Email (for password reset)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-key
```

## Docker & Container Orchestration

### Dockerfile (Multi-stage)

```dockerfile
# Stage 1: Build
FROM python:3.11-slim as builder

WORKDIR /app
COPY bipdelivery/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY bipdelivery/ .

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: bipflow
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./bipdelivery
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:secure_password@db:5432/bipflow
      REDIS_URL: redis://redis:6379/0
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./bipdelivery:/app
      - media_volume:/app/media

  frontend:
    build:
      context: ./bipflow-frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://backend:8000/api
    depends_on:
      - backend

volumes:
  postgres_data:
  media_volume:
```

## Deployment Procedures

### Deployment to AWS (EC2 + RDS + S3)

#### Infrastructure Setup

```bash
# 1. Create EC2 instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name bipflow-key

# 2. Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier bipflow-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username bipflow_user
```

#### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: |
          cd bipdelivery
          python -m pytest
          
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws ecs update-service --cluster bipflow-prod --service backend --force-new-deployment
```

## Running Services

### Start All Services (Development)

```bash
# Terminal 1: Backend
cd bipdelivery
python manage.py runserver

# Terminal 2: Frontend
cd bipflow-frontend
npm run dev

# Terminal 3: API Validation Service (optional)
cd api-order-validation
npm start

# Terminal 4: Celery Worker (if using async tasks)
cd bipdelivery
celery -A core worker -l info
```

### Docker Compose (All-in-One)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down
```

## Database Migrations

### Create Migration

```bash
cd bipdelivery

# Make changes to models.py
python manage.py makemigrations

# Review migration file in api/migrations/
python manage.py sqlmigrate api 0001

# Apply migration
python manage.py migrate
```

### Rollback Migration

```bash
# Show migration history
python manage.py showmigrations

# Rollback to previous migration
python manage.py migrate api 0002  # rolls back to 0002
```

## Backup & Recovery

### Database Backup

```bash
# PostgreSQL dump
pg_dump -U bipflow_user -h localhost bipflow > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U bipflow_user -h localhost bipflow < backup_20260115.sql
```

### Media Files Backup

```bash
# Backup to S3
aws s3 sync ./media s3://bipflow-backups/media/$(date +%Y-%m-%d)/

# Restore from S3
aws s3 sync s3://bipflow-backups/media/latest/ ./media/
```

## Monitoring & Logging

### Application Monitoring

- **Django Debug Toolbar**: Development only
- **Sentry**: Error tracking (production)
- **New Relic**: Performance monitoring
- **CloudWatch**: AWS logs aggregation

### Server Monitoring

- **CPU / Memory**: Use `top`, `htop`, or CloudWatch
- **Disk Space**: Monitor with `df -h` or AWS EBS metrics
- **Network**: Track bandwidth via `nethogs` or VPC Flow Logs

### Log Files

```bash
# Django application logs
tail -f /var/log/bipflow/django.log

# Gunicorn workers
tail -f /var/log/bipflow/gunicorn.log

# Nginx (if using reverse proxy)
tail -f /var/log/nginx/access.log
```

## Health Checks & Uptime

### Endpoint Health Check

```bash
# Check API is running
curl -s http://localhost:8000/api/docs/ > /dev/null && echo "API OK" || echo "API DOWN"

# Check database connection
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/products/ > /dev/null && echo "DB OK" || echo "DB DOWN"
```

### Uptime Monitoring

```bash
# Use external monitoring (e.g., Uptime Robot)
# Configuration:
# - Monitor URL: https://api.bipflow.io/healthz/
# - Check interval: 5 minutes
# - Alert threshold: 2 consecutive failures
```

---

## Navigation

- **Previous**: [03-frontend/](../03-frontend/README.md) - Frontend architecture
- **Quick Start**: [../../QUICK_START.md](../../QUICK_START.md) - Get up and running in 30 minutes

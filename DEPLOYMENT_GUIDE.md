# AutoGrader Backend - Complete Setup & Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Running Tests](#running-tests)
3. [Database Migrations](#database-migrations)
4. [Docker Deployment](#docker-deployment)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Performance Monitoring](#performance-monitoring)

---

## Local Development Setup

### Prerequisites
- Python 3.13+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (optional)
- Git

### Step 1: Clone & Setup

```bash
# Clone repository
git clone <repository-url>
cd autograder

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt
```

### Step 2: Environment Configuration

```bash
# Copy example environment file
cp ../.env.example ../.env

# Edit .env with your local configuration
nano ../.env
```

**Required environment variables:**
```
DJANGO_SECRET_KEY=your-secure-key-here
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
POSTGRES_DB=autograder
POSTGRES_USER=autograder_user
POSTGRES_PASSWORD=secure_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your-openai-key
```

### Step 3: Database Setup

```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Load sample data (optional)
python manage.py loaddata dev_seed.json

# Create initial data
python manage.py shell
```

### Step 4: Run Development Server

```bash
# Start Django development server
python manage.py runserver 0.0.0.0:8000

# In another terminal, start Redis (if not running via Docker)
redis-server

# Server available at: http://localhost:8000
# API Docs: http://localhost:8000/api/docs/swagger/
# Admin: http://localhost:8000/admin/
```

---

## Running Tests

### Unit Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=. --cov-report=html

# Open coverage report
open htmlcov/index.html  # macOS
# or open in browser: htmlcov/index.html

# Run specific test file
pytest accounts/tests.py

# Run specific test class
pytest accounts/tests.py::TestAuthViews

# Run with verbose output
pytest -v

# Run only marked tests
pytest -m unit
pytest -m integration
```

### Integration Tests

```bash
# Run integration tests only
pytest -m integration

# Run integration tests with output
pytest -m integration -v -s
```

### Performance Tests

```bash
# Run slow tests (marked with @pytest.mark.slow)
pytest -m slow

# Run with durations
pytest --durations=10
```

---

## Database Migrations

### Creating Migrations

```bash
# After model changes, create migration
python manage.py makemigrations

# Review migration (recommended)
python manage.py showmigrations

# Create empty migration
python manage.py makemigrations --empty myapp --name my_migration

# Dry run migrations (see what would happen)
python manage.py migrate --plan
```

### Applying Migrations

```bash
# Apply all migrations
python manage.py migrate

# Apply migrations for specific app
python manage.py migrate accounts

# Migrate to specific migration
python manage.py migrate courses 0002_add_indexes

# Rollback migration
python manage.py migrate courses 0001_initial
```

### Migration Troubleshooting

```bash
# Check migration status
python manage.py showmigrations

# List all migrations
python manage.py showmigrations --list

# Squash migrations (for long chains)
python manage.py squashmigrations accounts 0001 0010

# Reset database (DANGER - removes all data)
python manage.py flush
```

---

## Docker Deployment

### Local Docker Development

```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Run migrations in container
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Run tests
docker compose exec backend pytest

# Stop services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```

### Docker Compose Services

The `compose.yaml` includes:
- **PostgreSQL 16** - Database (port 5432)
- **Redis 7** - Cache (port 6379)
- **Backend (Django)** - API server (port 8000)
- **Frontend (React)** - UI (port 5173)

### Rebuilding Containers

```bash
# Rebuild all images
docker compose up --build

# Rebuild specific service
docker compose up --build backend

# Pull latest base images
docker compose up --pull always
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `DJANGO_DEBUG=False`
- [ ] Generate strong `DJANGO_SECRET_KEY`
- [ ] Configure production database
- [ ] Set up Redis for caching
- [ ] Configure CORS_ALLOWED_ORIGINS
- [ ] Set up CSRF_TRUSTED_ORIGINS
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Configure email backend
- [ ] Set up logging
- [ ] Configure backup strategy
- [ ] Set up monitoring/alerting
- [ ] Run security checks

### Environment Setup

```bash
# Generate secure secret key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Production .env example
DJANGO_SECRET_KEY=<generated-key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DJANGO_ENV=production

# Database (use managed RDS/managed PostgreSQL)
POSTGRES_HOST=prod-db.example.com
POSTGRES_DB=autograder_prod
POSTGRES_USER=autograder_prod
POSTGRES_PASSWORD=<strong-password>

# Redis (use managed Redis/ElastiCache)
REDIS_URL=redis://prod-redis.example.com:6379/0

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

OPENAI_API_KEY=<your-key>
```

### Deployment Steps (AWS Example)

#### 1. Using EC2 + RDS + ElastiCache

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3.13 python3.13-venv git nginx supervisor

# Clone repository
git clone <repository-url> /opt/autograder
cd /opt/autograder/backend

# Setup virtual environment
python3.13 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
sudo nano ../.env

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser
python manage.py createsuperuser
```

#### 2. Setup Gunicorn & Nginx

```bash
# Create Gunicorn systemd service
sudo nano /etc/systemd/system/autograder.service
```

Content:
```ini
[Unit]
Description=AutoGrader Django Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/autograder/backend
Environment="PATH=/opt/autograder/backend/venv/bin"
EnvironmentFile=/opt/autograder/.env
ExecStart=/opt/autograder/backend/venv/bin/gunicorn \
    --workers 4 \
    --worker-class sync \
    --bind unix:/run/autograder.sock \
    config.wsgi:application

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable autograder
sudo systemctl start autograder

# Configure Nginx
sudo nano /etc/nginx/sites-available/autograder
```

Nginx config:
```nginx
upstream autograder {
    server unix:/run/autograder.sock fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    client_max_body_size 50M;
    
    location /static/ {
        alias /opt/autograder/backend/static/;
    }
    
    location /media/ {
        alias /opt/autograder/backend/media/;
    }
    
    location / {
        proxy_pass http://autograder;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable Nginx site
sudo ln -s /etc/nginx/sites-available/autograder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 3. Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (runs daily)
sudo certbot renew --quiet
```

#### 4. Setup Monitoring & Logging

```bash
# Create log directory
mkdir -p /var/log/autograder
sudo chown www-data:www-data /var/log/autograder

# Update settings.py with logging configuration
# See logging section below
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql -h localhost -U autograder_user -d autograder -c "SELECT 1"

# Check migrations
python manage.py showmigrations

# Rebuild migrations
python manage.py migrate --fake-initial
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check Redis status
redis-cli info

# Clear Redis cache (use cautiously)
redis-cli FLUSHDB
```

### Permission Issues

```bash
# Fix permissions
sudo chown -R www-data:www-data /opt/autograder
sudo chmod -R 755 /opt/autograder/backend
sudo chmod -R 775 /opt/autograder/backend/media
```

### Static Files Not Loading

```bash
# Collect static files
python manage.py collectstatic --noinput --clear

# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Performance Monitoring

### Database Query Analysis

```bash
# Enable Django Debug Toolbar (development only)
# Automatically enabled when DEBUG=True

# Analyze slow queries
python manage.py shell
```

```python
from django.db import connection
from django.test.utils import CaptureQueriesContext

with CaptureQueriesContext(connection) as context:
    # Run your query here
    pass

for query in context:
    print(f"Time: {query['time']}, SQL: {query['sql']}")
```

### Monitoring Tools

- **New Relic**: APM monitoring
- **Sentry**: Error tracking
- **Datadog**: Infrastructure monitoring
- **CloudWatch** (AWS): Logs and metrics

### Key Metrics to Monitor

1. **Database**
   - Query time
   - Connection count
   - Cache hit ratio

2. **Application**
   - Response time
   - Error rate
   - Request throughput

3. **Infrastructure**
   - CPU usage
   - Memory usage
   - Disk I/O

### Setup Sentry (Error Tracking)

```bash
# Install Sentry SDK
pip install sentry-sdk

# Configure in settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="https://key@sentry.io/project-id",
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    environment="production"
)
```

---

## Maintenance Tasks

### Regular Backups

```bash
# Backup database
pg_dump -h localhost -U autograder_user autograder > backup.sql

# Restore database
psql -h localhost -U autograder_user autograder < backup.sql

# Setup automated backups
# Use: AWS RDS automatic backups, pg_cron, or backup service
```

### Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/autograder
```

```
/var/log/autograder/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload autograder > /dev/null 2>&1 || true
    endscript
}
```

### Cache Cleanup

```bash
# Clear expired sessions
python manage.py clearsessions

# Clear old files
find /opt/autograder/backend/media -type f -mtime +90 -delete
```

---

## Support & Documentation

- **API Docs**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Bug Reports**: [FIXES_APPLIED.md](FIXES_APPLIED.md)
- **GitHub Issues**: File issues with detailed reproduction steps
- **Email**: support@autograder.com

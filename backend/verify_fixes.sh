#!/bin/bash
set -e

# AutoGrader Backend Verification Script
# This script verifies all fixes and configurations are in place

echo "🔍 AutoGrader Backend Verification..."
echo "======================================"

ERRORS=0
WARNINGS=0

# Helper functions
success() {
    echo "✅ $1"
}

error() {
    echo "❌ $1"
    ((ERRORS++))
}

warning() {
    echo "⚠️  $1"
    ((WARNINGS++))
}

# Check Python dependencies
echo ""
echo "📦 Checking Python dependencies..."
if python -c "import pytest" 2>/dev/null; then
    success "pytest installed"
else
    error "pytest not installed - run: pip install -r requirements.txt"
fi

if python -c "import drf_spectacular" 2>/dev/null; then
    success "drf-spectacular installed"
else
    error "drf-spectacular not installed"
fi

if python -c "import django_redis" 2>/dev/null; then
    success "django-redis installed"
else
    error "django-redis not installed"
fi

# Check critical files
echo ""
echo "📋 Checking critical files..."
files=(
    "config/settings.py"
    "config/urls.py"
    "requirements.txt"
    "conftest.py"
    "pytest.ini"
    "../DEPLOYMENT_GUIDE.md"
    "../API_DOCUMENTATION.md"
    "../FIXES_APPLIED.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
    fi
done

# Check for model fixes
echo ""
echo "🔧 Checking model fixes..."
if grep -q "default=SubmissionTrack.BASIC" submissions/models.py; then
    success "submission_track field fixed (no duplicate)"
else
    error "submission_track field issue - duplicate not removed"
fi

if ! grep -q "managed = False" courses/models.py; then
    success "courses models: managed=False removed"
else
    warning "courses models: may still have managed=False"
fi

# Check settings configuration
echo ""
echo "⚙️  Checking settings configuration..."
if grep -q "DJANGO_SECRET_KEY" config/settings.py; then
    success "Secret key uses environment variable"
else
    error "Secret key not using environment variable"
fi

if grep -q "CSRF_COOKIE_HTTPONLY = True" config/settings.py; then
    success "CSRF_COOKIE_HTTPONLY = True (security fix)"
else
    error "CSRF_COOKIE_HTTPONLY not set to True"
fi

if grep -q "drf_spectacular" config/settings.py; then
    success "drf-spectacular configured"
else
    error "drf-spectacular not in INSTALLED_APPS"
fi

if grep -q "django_redis" config/settings.py; then
    success "Redis cache configured"
else
    warning "Redis caching not configured"
fi

# Check OpenAPI endpoints
echo ""
echo "🔐 Checking API documentation..."
if grep -q "SpectacularAPIView" config/urls.py; then
    success "OpenAPI schema endpoint added"
else
    error "OpenAPI schema endpoint missing"
fi

if grep -q "SpectacularSwaggerView" config/urls.py; then
    success "Swagger UI endpoint added"
else
    error "Swagger UI endpoint missing"
fi

# Check test files
echo ""
echo "🧪 Checking test configuration..."
if [ -f "pytest.ini" ]; then
    success "pytest.ini configured"
else
    error "pytest.ini missing"
fi

if [ -f "conftest.py" ]; then
    success "conftest.py with fixtures exists"
else
    error "conftest.py missing"
fi

if grep -q "class.*Tests" accounts/tests.py submissions/tests.py courses/tests.py 2>/dev/null; then
    success "Test files created for main apps"
else
    warning "Test files may be incomplete"
fi

# Check database indexes migration
echo ""
echo "📊 Checking database optimizations..."
if grep -q "add_indexes" courses/migrations/*.py 2>/dev/null; then
    success "Database indexes migration created"
else
    error "Database indexes migration not found"
fi

# Check CI/CD
echo ""
echo "🚀 Checking CI/CD pipeline..."
if [ -f "../.github/workflows/backend-ci.yml" ]; then
    success "GitHub Actions workflow configured"
else
    error "GitHub Actions workflow missing"
fi

# Check OpenAI client
echo ""
echo "🤖 Checking OpenAI API client..."
if grep -q "client.chat.completions.create" grading/services/openai_client.py; then
    success "OpenAI client using correct API method"
else
    error "OpenAI client not fixed (still using old method)"
fi

# Check documentation
echo ""
echo "📖 Checking documentation..."
if grep -q "AutoGrader API" ../API_DOCUMENTATION.md; then
    success "API documentation created"
else
    error "API documentation missing"
fi

if grep -q "Deployment" ../DEPLOYMENT_GUIDE.md; then
    success "Deployment guide created"
else
    error "Deployment guide missing"
fi

if grep -q "Bug Fixes" ../FIXES_APPLIED.md; then
    success "Fixes summary created"
else
    error "Fixes summary missing"
fi

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed!"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  ($WARNINGS warnings)"
    fi
    exit 0
else
    echo "❌ $ERRORS errors found"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  ($WARNINGS warnings)"
    fi
    exit 1
fi

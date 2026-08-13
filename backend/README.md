# AutoGrader Backend - Django REST API

A comprehensive automated grading and assessment management system built with Django REST Framework, PostgreSQL, and Redis.

## 🎯 Features

- ✅ **Role-Based Access Control** - System Admin, Mapping Admin, Faculty, Learner roles
- ✅ **Qualification & Module Management** - Organize courses hierarchically
- ✅ **Assignment Levels** - Foundation, Proficient, Expert levels
- ✅ **File Submission** - PDF/DOCX uploads with automatic page extraction
- ✅ **AI-Powered Grading** - OpenAI integration for automated assessment
- ✅ **Rubric Management** - Define grading criteria and bands
- ✅ **RAG Sources** - Retrieval-Augmented Generation for context-aware grading
- ✅ **Session Caching** - Redis-backed session and query caching
- ✅ **API Documentation** - Swagger UI and ReDoc
- ✅ **Comprehensive Testing** - Unit, integration, and performance tests
- ✅ **CI/CD Pipeline** - GitHub Actions for automated testing

## 📋 Requirements

- Python 3.13+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### With Docker Compose (Recommended)

```bash
cd ..
docker compose up --pull always

# In another terminal:
docker compose exec backend python manage.py createsuperuser

# Visit:
# - API: http://localhost:8000/api
# - Docs: http://localhost:8000/api/docs/swagger/
# - Admin: http://localhost:8000/admin
```

### Local Development

```bash
# Setup
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Configuration
cp ../.env.example ../.env
# Edit .env with your settings

# Database
python manage.py migrate
python manage.py createsuperuser

# Run
python manage.py runserver 0.0.0.0:8000
```

## 📚 Documentation

- [API Documentation](../API_DOCUMENTATION.md) - Complete endpoint reference
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Production setup instructions
- [Bug Fixes Applied](../FIXES_APPLIED.md) - All issues resolved
- [Architecture Overview](#architecture) - Below

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Django REST API                          │
├─────────────────────────────────────────────────────────────┤
│  accounts  │  courses  │  submissions  │  grading  │  lms   │
├─────────────────────────────────────────────────────────────┤
│                  PostgreSQL Database                         │
│              ┌─────────────────────────────────┐            │
│              │  Qualifications  ├─ Modules     │            │
│              │  ├─ Cohorts      ├─ Assignments│            │
│              │  ├─ Submissions   ├─ Rubrics    │            │
│              │  └─ Users/Profiles ├─ Gradings │            │
│              └─────────────────────────────────┘            │
├─────────────────────────────────────────────────────────────┤
│                    Redis Cache Layer                         │
│         (Session storage, query caching)                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/me/` - Current user info
- `POST /api/auth/register/` - Learner registration

### Courses
- `GET/POST /api/courses/qualifications/` - Qualifications
- `GET/POST /api/courses/modules/` - Modules
- `GET/POST /api/courses/cohorts/` - Cohorts
- `GET/POST /api/courses/assignments/` - Assignments
- `GET/POST /api/courses/assignment-levels/` - Assignment Levels

### Submissions
- `POST /api/submissions/context/` - Create submission context
- `GET /api/submissions/context/{id}/` - Get context
- `POST /api/submissions/context/{id}/submit/` - Submit assignment
- `GET /api/submissions/` - List submissions
- `GET /api/submissions/{id}/` - Get submission details
- `GET /api/submissions/pages/{id}/image/` - Get page image

### Grading
- `GET/POST /api/grading/configurations/` - Grading configs
- `GET/POST /api/grading/rubric-criteria/` - Rubric criteria
- `GET/POST /api/grading/rubric-bands/` - Rubric bands
- `GET/POST /api/grading/ai-grading-profiles/` - AI profiles

### LMS Integration
- `GET/POST /api/lms/assessment-mappings/` - Assessment mappings

## 🧪 Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=. --cov-report=html

# Specific markers
pytest -m unit          # Unit tests only
pytest -m integration   # Integration tests only
pytest -m slow          # Slow tests

# Specific file
pytest accounts/tests.py -v

# With output
pytest -s
```

## 📊 Database Schema

### Key Models

**User & Auth**
- `User` - Django auth user
- `UserProfile` - Role assignment (admin, faculty, learner)

**Course Structure**
- `Qualification` - Degree/certificate programs
- `Module` - Individual courses
- `Cohort` - Student groups per module
- `ModuleAssignment` - Assignment definitions
- `AssignmentLevel` - Difficulty levels (foundation/proficient/expert)

**Submissions**
- `SubmissionContext` - Learner-Assignment mapping
- `LearnerSubmission` - Individual submissions
- `SubmissionPage` - Extracted PDF pages

**Grading**
- `GradingConfiguration` - Grading strategy
- `RubricCriterion` - Assessment criteria
- `RubricBand` - Performance levels
- `RagSource` - RAG training documents
- `AIGradingProfile` - AI model configuration

**LMS**
- `AssessmentMapping` - External platform integration

## ⚙️ Configuration

### Environment Variables

```bash
# Core
DJANGO_SECRET_KEY=<secure-key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database
POSTGRES_DB=autograder
POSTGRES_USER=autograder_user
POSTGRES_PASSWORD=<password>
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Cache
REDIS_URL=redis://localhost:6379/0

# AI/OpenAI
OPENAI_API_KEY=<your-key>
OPENAI_API_MODEL=gpt-4o-mini

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

## 🔒 Security Features

- ✅ CSRF protection with secure cookies
- ✅ Session authentication
- ✅ Role-based permissions
- ✅ Password validation
- ✅ Secret key from environment
- ✅ Debug disabled in production
- ✅ HTTPS enforcement
- ✅ Input validation & sanitization

## 📈 Performance Optimizations

- **Database Indexes** - Strategic indexes on frequently queried columns
- **Query Optimization** - `select_related()` and `prefetch_related()`
- **Redis Caching** - Session and query result caching
- **Pagination** - 50 items per page by default
- **Async Processing** - Task queue ready (Celery compatible)

## 🐛 Recent Fixes (v1.0)

See [FIXES_APPLIED.md](../FIXES_APPLIED.md) for detailed list:

1. Fixed duplicate `submission_track` field
2. Fixed OpenAI API client method
3. Unified database model management
4. Fixed Cohort UUID primary key
5. Security: Hardcoded secrets → environment variables
6. Added PDF bounds checking
7. Added validation for module alignment
8. Fixed CSRF security settings

## 🚀 Deployment

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for:
- Local development setup
- Docker deployment
- Production deployment (AWS EC2/RDS)
- SSL/TLS configuration
- Monitoring & logging
- Backup & maintenance

## 📝 API Documentation

- **Swagger UI**: http://localhost:8000/api/docs/swagger/
- **ReDoc**: http://localhost:8000/api/docs/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/
- **Full Docs**: [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)

## 🔄 CI/CD Pipeline

GitHub Actions workflow runs on every push/PR:
- ✅ Linting (black, flake8, isort)
- ✅ Database checks
- ✅ Unit & integration tests
- ✅ Coverage reports
- ✅ Security scans (bandit, safety)
- ✅ Docker image build

## 🛠️ Development Tools

- **pytest** - Testing framework
- **drf-spectacular** - API documentation
- **django-redis** - Cache backend
- **django-debug-toolbar** - Development debugging
- **black** - Code formatting
- **flake8** - Linting
- **isort** - Import sorting

## 📞 Support

- 📧 Issues: GitHub Issues
- 📚 Docs: See links above
- 💬 Questions: Check existing issues first

## 📄 License

See LICENSE file for details.

## 🎉 Status

- ✅ Core functionality complete
- ✅ All bugs fixed
- ✅ Testing suite in place
- ✅ Documentation complete
- ✅ CI/CD pipeline active
- ✅ Ready for production

**Last Updated**: January 2024
**Version**: 1.0.0

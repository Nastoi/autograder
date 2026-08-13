# AutoGrader API Documentation

Welcome to the **AutoGrader API** - an automated grading and assessment management system.

## Overview

The AutoGrader API provides comprehensive endpoints for managing qualifications, modules, assignments, submissions, and grading configurations. All endpoints require authentication via session cookies.

### Base URL
```
http://localhost:8000/api
```

### Authentication
All endpoints (except login and registration) require authentication:
- **Method**: Session-based authentication
- **Cookie**: `sessionid` (set automatically after login)
- **Header**: `X-CSRFToken` (required for state-changing operations)

---

## API Endpoints

### Authentication Endpoints

#### 1. Login
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful.",
  "csrfToken": "token...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "profile": {
      "role": "learner"
    }
  }
}
```

#### 2. Logout
```http
POST /api/auth/logout/
```

**Response (200 OK):**
```json
{
  "message": "Logout successful."
}
```

#### 3. Current User
```http
GET /api/auth/me/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "profile": {
    "role": "learner"
  }
}
```

#### 4. Register Learner
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "newlearner",
  "email": "learner@example.com",
  "password": "password123",
  "password_confirm": "password123"
}
```

---

### Courses Endpoints

#### List Qualifications
```http
GET /api/courses/qualifications/
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Results per page (default: 50)

**Response (200 OK):**
```json
{
  "count": 5,
  "next": "http://localhost:8000/api/courses/qualifications/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid-1234",
      "qualification_code": "QUAL_001",
      "qualification_name": "Diploma in Computer Science",
      "description": "...",
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Qualification Detail
```http
GET /api/courses/qualifications/{id}/
```

#### Create Qualification
```http
POST /api/courses/qualifications/
Content-Type: application/json

{
  "qualification_code": "QUAL_NEW",
  "qualification_name": "New Qualification",
  "description": "Description here",
  "is_active": true
}
```

**Required Roles:** `system_admin`, `mapping_admin`

#### List Modules
```http
GET /api/courses/modules/?qualification_id={qualification_id}
```

#### List Cohorts
```http
GET /api/courses/cohorts/?module_id={module_id}
```

#### List Module Assignments
```http
GET /api/courses/assignments/?module_id={module_id}
```

#### List Assignment Levels
```http
GET /api/courses/assignment-levels/?module_id={module_id}&assignment_id={assignment_id}
```

---

### Submissions Endpoints

#### Create Submission Context
```http
POST /api/submissions/context/
Content-Type: application/json

{
  "cohort": "uuid-cohort",
  "assignment_level": "uuid-level"
}
```

**Response (201 Created):**
```json
{
  "message": "Submission context created successfully.",
  "context_id": "uuid-context",
  "learner": {
    "id": 1,
    "username": "learner",
    "email": "learner@example.com"
  },
  "cohort": {...},
  "assignment": {...},
  "assignment_level": {...}
}
```

#### Get Submission Context
```http
GET /api/submissions/context/{context_id}/
```

#### Submit Assignment
```http
POST /api/submissions/context/{context_id}/submit/
Content-Type: multipart/form-data

file: <binary PDF file>
submission_track: basic
```

**Valid Tracks:** `basic`, `advanced`

**Response (201 Created):**
```json
{
  "id": "uuid-submission",
  "status": "uploaded",
  "attempt_number": 1,
  "submitted_at": "2024-01-15T10:30:00Z",
  "final_score": null,
  "achieved_band": null
}
```

#### List Submissions
```http
GET /api/submissions/
```

**Note:** Learners see only their submissions; admins see all.

#### Get Submission Detail
```http
GET /api/submissions/{submission_id}/
```

**Response:**
```json
{
  "id": "uuid",
  "status": "completed",
  "final_score": 85,
  "maximum_score": 100,
  "achieved_band": "proficient",
  "feedback": "Well done!",
  "pages": [
    {
      "id": "uuid-page",
      "page_number": 1,
      "extracted_text": "Page content...",
      "image_url": "http://localhost:8000/api/submissions/pages/{page_id}/image/"
    }
  ]
}
```

#### Get Page Image
```http
GET /api/submissions/pages/{page_id}/image/
```

**Response:** Binary WebP image file

---

### Grading Endpoints

#### List Grading Configurations
```http
GET /api/grading/configurations/
```

#### Create Grading Configuration
```http
POST /api/grading/configurations/
Content-Type: application/json

{
  "code": "GRADE_001",
  "name": "Hybrid Grading",
  "grading_type": "hybrid",
  "structural_check_enabled": true,
  "ai_grading_enabled": true,
  "manual_review_required": true,
  "confidence_review_threshold": 0.75
}
```

#### List Rubric Criteria
```http
GET /api/grading/rubric-criteria/?assignment_level_id={id}
```

#### List Rubric Bands
```http
GET /api/grading/rubric-bands/?rubric_criterion_id={id}
```

#### List AI Grading Profiles
```http
GET /api/grading/ai-grading-profiles/?assignment_level_id={id}
```

---

### LMS Endpoints

#### List Assessment Mappings
```http
GET /api/lms/assessment-mappings/
```

#### Create Assessment Mapping
```http
POST /api/lms/assessment-mappings/
Content-Type: application/json

{
  "cohort": "uuid-cohort",
  "assignment": "uuid-assignment",
  "external_platform_id": "platform-123",
  "external_context_id": "context-456",
  "external_resource_link_id": "resource-789"
}
```

#### Get Assessment Mapping
```http
GET /api/lms/assessment-mappings/{mapping_id}/
```

#### Update Assessment Mapping
```http
PATCH /api/lms/assessment-mappings/{mapping_id}/
Content-Type: application/json

{
  "is_active": false
}
```

#### Delete Assessment Mapping
```http
DELETE /api/lms/assessment-mappings/{mapping_id}/
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 400 Bad Request
```json
{
  "field_name": ["Error message"]
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 409 Conflict
```json
{
  "detail": "This resource cannot be deleted because..."
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 204 | No Content - Successful deletion |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Permission denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource constraint violation |
| 500 | Server Error - Internal server error |

---

## Submission Workflow

### Complete Flow Example

1. **Create Context** → Get context_id
2. **Submit File** → POST to `/context/{context_id}/submit/`
3. **Extract Pages** → Automatic (in background)
4. **Get Submission** → Check status and feedback
5. **View Pages** → Access extracted pages and images

---

## Interactive API Documentation

- **Swagger UI**: http://localhost:8000/api/docs/swagger/
- **ReDoc**: http://localhost:8000/api/docs/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

---

## Rate Limiting

Currently not implemented. Future versions will include rate limiting.

## Pagination

Default page size: 50 results per page.

Query parameters:
- `page`: Page number (1-indexed)
- `page_size`: Results per page (1-100)

---

## Support

For issues or questions, contact the development team or file an issue on GitHub.

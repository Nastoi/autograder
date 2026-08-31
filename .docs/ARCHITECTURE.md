# AutoGrad3r Architecture

## Overview

AutoGrad3r is split into a Django backend and React frontend. The application manages assessment configuration, learner submissions, grading, and LMS integration.

The current structure favors domain separation while preserving stable URL and page behavior.

## Backend Architecture

### `accounts`

Responsible for:

- authentication
- current-user/session endpoints
- user management
- roles and account-related activity
- activity/log-related endpoints

The public `accounts/views.py` module is kept as a facade. Implementation views are grouped under:

```text
backend/accounts/view_handlers/
├── auth.py
├── users.py
├── activity.py
└── logs.py
```

### `courses`

Responsible for:

- qualifications
- modules
- cohorts
- assignments
- assignment levels
- assignment configuration relationships

Implementation views are grouped under:

```text
backend/courses/view_handlers/
├── qualifications.py
├── modules.py
├── cohorts.py
├── assignments.py
└── assignment_levels.py
```

Assignment delete-impact behavior belongs with the assignment handler rather than a separate standalone view module.

### `grading`

Responsible for:

- rubric criteria
- rubric bands
- assignment tasks
- task-to-criterion mappings
- grading-related serializers and services
- assignment-level rubric CSV import

The active HTTP surface is intentionally narrower than older documentation may suggest. Historical generic CRUD endpoints for grading configuration, AI grading profiles, prompt/response records and similar internal models should not be assumed to exist unless present in `backend/grading/urls.py`.

Implementation views are grouped under:

```text
backend/grading/view_handlers/
```

The exact handler files should be treated as implementation detail; `grading/views.py` remains the stable import facade.

### `submissions`

Responsible for:

- learner submission contexts
- attempt handling
- uploaded files
- processing lifecycle
- submission history
- submission records
- page/media access
- grading-result persistence

Implementation views are grouped under:

```text
backend/submissions/view_handlers/
├── contexts.py
├── history.py
├── media.py
└── submissions.py
```

Submission attempt policy remains in the submissions domain because it controls learner submission behavior.

### `lms`

Responsible for the Open edX / LTI boundary.

This includes:

- assessment mappings
- LTI launch handling
- instructor-facing LMS actions
- grade-related LMS integration
- names/roles or other LTI services when enabled and implemented

Implementation views are grouped under:

```text
backend/lms/view_handlers/
├── mappings.py
├── lti.py
└── instructor.py
```

LTI registration/configuration fields may exist on models even when an older helper endpoint has been removed.

## Stable View Facades

Each Django app keeps its existing `views.py` import surface so URL modules and external imports do not need to know the internal handler layout.

Conceptually:

```python
# app/views.py
from .view_handlers.some_group import SomeView
```

Do not import the same app's facade back into its own handler modules because that can create circular imports.

## Frontend Architecture

The frontend uses page components under:

```text
frontend/src/pages/
```

and shared or feature-specific components under:

```text
frontend/src/components/
```

Assignment-page UI has been split into feature components under:

```text
frontend/src/components/assignments/
```

These components organize display and form sections while state, handlers and API orchestration remain owned by the page where appropriate.

Important assignment components include areas for:

- summary cards
- assignment list content
- workspace shell
- overview
- level requirements
- tasks
- rubric criteria
- rubric bands
- management modals

The purpose of this split is readability and maintainability, not to change business flow.

## Frontend API Layer

The former large LMS API module has been split by domain:

```text
frontend/src/api/
├── assessmentMappings.ts
├── courses.ts
├── grading.ts
├── instructor.ts
├── submissions.ts
├── taskCriteriaMappings.ts
├── adminSubmissionRecords.ts
└── utils.ts
```

`utils.ts` contains common API helpers such as base URL handling and pagination helpers.

The frontend should import from the domain module that owns the operation instead of recreating a large cross-domain API file.

## Styling

Shared CSS remains shared when selectors are used across multiple pages. Page-specific CSS should only contain selectors that are genuinely page-specific.

For example:

- `AssessmentMappings.css` contains shared administration/workspace/modal styles used by multiple pages.
- `AssignmentsPage.css` contains assignment-only styling.
- Other pages retain their existing dedicated CSS files when needed.

Avoid moving a selector into page-specific CSS solely because its name sounds page-specific; confirm actual usage first.

## Core Workflow

At a high level:

```text
Qualification
  -> Module
      -> Cohort
      -> Assignment
          -> Assignment Level
              -> Tasks
              -> Rubric Criteria
                  -> Rubric Bands
              -> Task / Criterion Mapping

Learner
  -> Submission Context
      -> Submission Attempt
          -> Processing / Grading
              -> Criterion Results
              -> Overall Result / Feedback
              -> History / Instructor Review
```

An LMS assessment mapping connects the external LMS activity to the relevant AutoGrad3r assessment context.

## LTI Integration

The project uses LTI 1.3 integration for LMS launches and related services.

Where enabled and configured, LTI services may support:

- launch identity/context
- assignment/grade services
- names and roles provisioning

Actual enabled behavior must be confirmed from the current LMS configuration and `backend/lms/` code.

## Design Principles

1. Keep domain ownership clear.
2. Keep public URL behavior stable during internal organization work.
3. Prefer thin view facades with grouped implementation handlers.
4. Keep frontend API clients domain-based.
5. Move UI sections into components without unnecessarily rewriting working logic.
6. Treat Django models and migrations as the database source of truth.
7. Remove dead code only after confirming there are no active imports, URL registrations or runtime dependencies.

# AutoGrad3r

AutoGrad3r is a Django and React application for managing assessment configuration, learner submissions, rubric-based grading, and LMS integration.

## Repository Structure

```text
autograder/
├── backend/
│   ├── accounts/          # Authentication, users, roles, activity/log-related endpoints
│   ├── config/            # Django project settings and root configuration
│   ├── courses/           # Qualifications, modules, cohorts, assignments, assignment levels
│   ├── grading/           # Rubrics, bands, tasks, task-to-criterion mappings, grading services
│   ├── lms/               # LMS / LTI 1.3 integration and assessment mappings
│   ├── prompts/           # Prompt templates used by grading services
│   ├── submissions/       # Submission contexts, attempts, processing, records, history
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── api/           # Domain-based frontend API clients
│   │   ├── components/    # Shared and feature components
│   │   ├── css/           # Shared and page-specific styles
│   │   └── pages/         # Application pages
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   └── TEAM_SETUP.md
├── compose.yaml
├── .env.example
└── README.md
```

## Main Backend Domains

- **accounts** — authentication, users, roles and account-related activity.
- **courses** — qualifications, modules, cohorts, assignments and assignment levels.
- **grading** — rubric criteria, rubric bands, tasks, task-to-criterion mappings and grading logic.
- **submissions** — learner submission contexts, attempts, processing, grading results and history.
- **lms** — Open edX / LTI 1.3 integration, assessment mappings, instructor-facing LMS actions and grade-related integration.

Backend `views.py` files act as stable facades and re-export views from each app's `view_handlers/` package.

## Main Frontend API Modules

The frontend API layer is split by domain instead of using one large LMS API file.

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

## Local Development

Create the environment file:

```bash
cp .env.example .env
```

Build and start the application:

```bash
docker compose up -d --build
```

Apply migrations:

```bash
docker compose exec backend python manage.py migrate
```

Check the backend:

```bash
docker compose exec backend python manage.py check
```

Build the frontend:

```bash
cd frontend
npm run build
```

Use the ports configured in `compose.yaml` and the environment files for the actual local URLs.

## Development Checks

Before committing backend changes:

```bash
docker compose exec backend python manage.py check
```

If models changed:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Before committing frontend changes:

```bash
cd frontend
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Team setup and Git workflow](docs/TEAM_SETUP.md)

## Source of Truth

Code, Django models, migrations, URL configuration and environment templates are the source of truth.

Documentation should describe the current implementation and should not be treated as a substitute for checking the code when behavior changes.

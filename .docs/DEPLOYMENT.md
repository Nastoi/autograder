# AutoGrad3r Deployment

## Scope

This guide documents the project's Docker-based deployment workflow.

Environment-specific infrastructure details such as cloud provider networking, reverse proxies, certificates and managed database services should be documented separately if they differ between environments.

## Configuration Files

Typical deployment files include:

```text
compose.yaml
.env.example
.env.prod        # local/server secret file; do not commit
```

The exact service names and environment variables must follow the current `compose.yaml` and Django settings.

## Initial Server Setup

Clone the repository:

```bash
git clone <repository-url>
cd autograder
```

Create the production environment file using the approved production values:

```bash
cp .env.example .env.prod
```

Do not commit `.env.prod`.

## Build and Start

From the project root:

```bash
docker compose --env-file .env.prod up -d --build
```

Check service status:

```bash
docker compose --env-file .env.prod ps
```

Review backend logs:

```bash
docker compose --env-file .env.prod logs --tail=100 backend
```

Follow backend logs:

```bash
docker compose --env-file .env.prod logs -f backend
```

## Database Migrations

Before or immediately after deploying code that includes migrations:

```bash
docker compose --env-file .env.prod exec backend python manage.py migrate
```

Verify Django configuration:

```bash
docker compose --env-file .env.prod exec backend python manage.py check
```

Check migration state if needed:

```bash
docker compose --env-file .env.prod exec backend python manage.py showmigrations
```

## Deploying New Code

A typical production update is:

```bash
git pull origin main
```

Then rebuild and restart:

```bash
docker compose --env-file .env.prod up -d --build
```

Apply migrations:

```bash
docker compose --env-file .env.prod exec backend python manage.py migrate
```

Verify:

```bash
docker compose --env-file .env.prod exec backend python manage.py check
```

Then inspect logs:

```bash
docker compose --env-file .env.prod logs --tail=100 backend
```

## Frontend Verification Before Deployment

Before pushing a frontend change:

```bash
cd frontend
npm run build
```

The build must complete successfully.

A Vite chunk-size warning is not automatically a deployment failure. Treat bundle optimization as a separate task unless the warning corresponds to an actual performance requirement.

## Backend Verification Before Deployment

Run:

```bash
docker compose exec backend python manage.py check
```

Run the relevant test suite if available and appropriate for the change.

For structural view refactors, an import sanity check can also be useful:

```bash
docker compose exec backend python manage.py shell -c "import accounts.views, courses.views, grading.views, lms.views, submissions.views; print('view imports ok')"
```

## Environment Variables

Production secrets and environment-specific values must remain outside Git.

Typical categories include:

- Django secret key
- debug setting
- allowed hosts
- database credentials
- Redis configuration
- OpenAI/API credentials
- public backend/frontend URLs
- LTI platform/client/deployment configuration

Use `.env.example` to document required variable names without committing real values.

## Logs and Troubleshooting

Service status:

```bash
docker compose --env-file .env.prod ps
```

Recent logs:

```bash
docker compose --env-file .env.prod logs --tail=200
```

Backend-only logs:

```bash
docker compose --env-file .env.prod logs --tail=200 backend
```

Restart backend:

```bash
docker compose --env-file .env.prod restart backend
```

Open Django shell:

```bash
docker compose --env-file .env.prod exec backend python manage.py shell
```

## Database Safety

Do not run:

```bash
docker compose down -v
```

on production unless intentionally deleting Docker volumes and the data stored in them.

Before destructive database operations, make sure an appropriate backup exists.

## Rollback Approach

For a code-only rollback:

1. identify the last known-good commit
2. restore that revision
3. rebuild the affected containers
4. verify backend checks and logs

Be careful when rolling back code across database migrations. A migration may require a specific reverse migration plan rather than simply checking out older code.

## Production Checklist

Before declaring a deployment successful:

- containers are running
- migrations completed
- `manage.py check` passes
- frontend build passed before release
- login works
- administration/configuration pages load
- assignment configuration works
- learner submission works
- grading completes
- instructor/submission records load
- LMS launch/mapping works if affected by the release
- no unexpected errors appear in browser console or server logs

## Documentation Rule

Keep this file limited to the deployment process that is actually used.

If the project later adopts a reverse proxy, managed database, cloud load balancer, separate worker hosts, automated CI deployment or another infrastructure pattern, add that information when it becomes real rather than documenting a hypothetical architecture.

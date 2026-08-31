# AutoGrad3r Team Setup and Git Workflow

## Required Software

Install:

- Git
- Docker Desktop
- a GitHub account
- a code editor such as Visual Studio Code

Docker is the standard way to run the project locally, so separate local installations of Django, PostgreSQL or Redis are normally unnecessary unless a developer has a specific reason.

## Verify Your Environment

```bash
git --version
docker --version
docker compose version
docker info
```

On Windows, Docker Desktop commonly uses WSL 2.

## Clone the Repository

```bash
git clone <repository-url>
cd autograder
```

## Environment File

Create a local environment file:

```bash
cp .env.example .env
```

Use development values supplied by the project owner.

Never commit `.env`.

## Start the Application

```bash
docker compose up -d --build
```

Check services:

```bash
docker compose ps
```

Apply migrations:

```bash
docker compose exec backend python manage.py migrate
```

Check Django:

```bash
docker compose exec backend python manage.py check
```

If the project provides approved fake development seed data, load it only according to the current repository instructions.

## Logs

```bash
docker compose logs -f
```

Backend:

```bash
docker compose logs -f backend
```

Stop following logs with `Ctrl+C`.

## Git Workflow

Before new work:

```bash
git switch main
git pull origin main
git switch -c feature/<feature-name>
```

Use one focused branch per task.

Examples:

```text
feature/qualification-management
fix/submission-attempt-loading
refactor/assignment-components
docs/deployment
```

## During Development

Check changes:

```bash
git status
git diff
```

If Django models change:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
```

Before committing frontend changes:

```bash
cd frontend
npm run build
```

## Commit

Review first:

```bash
git status
git diff
```

Stage:

```bash
git add .
```

Review staged changes:

```bash
git diff --staged
```

Commit:

```bash
git commit -m "Describe the completed change"
```

## Update Before Push

```bash
git fetch origin
git rebase origin/main
```

If conflicts occur:

```bash
git status
```

Resolve the files, then:

```bash
git add <resolved-file>
git rebase --continue
```

Abort if needed:

```bash
git rebase --abort
```

After a successful rebase, rebuild/test the affected areas.

## Push

First push:

```bash
git push -u origin feature/<feature-name>
```

If an already-pushed branch was rebased:

```bash
git push --force-with-lease
```

Do not use plain `--force`.

## Pull Request

Open a pull request from the feature branch into `main`.

Include:

- summary of changes
- testing performed
- migrations/database changes
- screenshots for UI changes when useful
- deployment or configuration notes

## After Merge

```bash
git switch main
git pull origin main
git branch -d feature/<feature-name>
```

Delete the remote branch if needed:

```bash
git push origin --delete feature/<feature-name>
```

If dependencies, Docker configuration or migrations changed, rebuild/apply them before starting the next task.

## Important Team Rules

1. Do not develop directly on `main`.
2. Pull the latest `main` before creating a feature branch.
3. Commit migration files when model changes require them.
4. Never commit `.env`, passwords, tokens or API keys.
5. Never commit real learner data, production submissions or database dumps.
6. Test affected backend and frontend flows before opening a PR.
7. Use clear commit messages.
8. Use pull requests for review.
9. Use `--force-with-lease`, never plain `--force`, after rebasing your own branch.
10. Do not run `docker compose down -v` unless deleting local Docker volumes is intentional.

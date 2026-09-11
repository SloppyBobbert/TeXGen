# Contributing

## Development Setup

### Backend

Compilation is disabled by default. These commands start the API without a PDF compiler. Use the full-stack setup for compilation, or configure the development-only adapter in [Compiler modes](docs/COMPILER_SUPPORT.md#compiler-modes).

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

Use Node 24. If you do not use nvm, select that version with your installed Node version manager and omit `nvm use`.

```bash
cd frontend
nvm use
npm ci
npm run dev
```

### Full stack with Docker

First stage the verified compiler assets and use a matching Linux ARM64 runtime. Follow [Build prerequisite](docs/COMPILER_SUPPORT.md#build-prerequisite); a clean checkout does not contain the required assets.

```bash
docker compose up --build
```

## Branching

- Create a branch from `main`.
- Keep changes focused and reasonably small.
- Prefer clear commit messages.

## Before Opening a Pull Request

Run the relevant checks for the area you changed.

### Backend

```bash
cd backend
python manage.py check
pytest -v --cov-fail-under=95
ruff check .
pip-audit -r requirements.txt
```

### Frontend

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

SQLite skips the five PostgreSQL quota tests. Use a test PostgreSQL `DATABASE_URL` and `TEXGEN_REQUIRE_POSTGRES_CONCURRENCY=1` to run `pytest tests/test_compile_quota_postgres.py` from `backend/`.

CI also runs `frontend/e2e/real-stack.spec.js` against Compose with the verified ARM64 compiler.

To run that journey locally after starting the stack, use `npm run test:e2e -- e2e/real-stack.spec.js` from `frontend/` with Chromium already installed.

## Pull Request Guidance

- Explain the problem and the change.
- Include screenshots for UI changes.
- Note any migrations, config updates, or environment changes.
- Link related issues when relevant.

## Code Style

- Follow existing project structure and naming conventions.
- Keep diffs minimal unless the change is intentionally a refactor.
- Add tests when behavior changes or bugs are fixed.

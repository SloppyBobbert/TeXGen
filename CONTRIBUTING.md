# Contributing

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
nvm use || true
npm install
npm run dev
```

### Full stack with Docker

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
pytest -v
ruff check .
safety check
```

### Frontend

```bash
cd frontend
npm run build
npx eslint src/
```

## Pull Request Guidance

- Explain the problem and the change.
- Include screenshots for UI changes.
- Note any migrations, config updates, or environment changes.
- Link related issues when relevant.

## Code Style

- Follow existing project structure and naming conventions.
- Keep diffs minimal unless the change is intentionally a refactor.
- Add tests when behavior changes or bugs are fixed.

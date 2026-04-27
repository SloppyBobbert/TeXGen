# Cheat Sheet Generator

<p align="center">
  <img src="frontend/public/math_webicon.png" alt="Cheat Sheet Generator web icon" width="220" />
</p>

<p align="center">
  A full-stack React and Django application for generating LaTeX-based cheat sheets with live preview, saved projects, and PDF export.
</p>

<p align="center">
  <a href="https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml"><img src="https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://chicostate.github.io/cheat-sheet/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fchicostate.github.io%2Fcheat-sheet%2F&up_message=up&down_message=down&label=project%20page" alt="Project page status" /></a>
  <img src="https://img.shields.io/github/languages/top/ChicoState/cheat-sheet" alt="Top language" />
  <img src="https://img.shields.io/github/languages/count/ChicoState/cheat-sheet" alt="Language count" />
  <img src="https://img.shields.io/github/repo-size/ChicoState/cheat-sheet" alt="Repository size" />
  <img src="https://img.shields.io/github/last-commit/ChicoState/cheat-sheet" alt="Last commit" />
  <img src="https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white" alt="Node 24" />
  <img src="https://img.shields.io/badge/python-3.14-3776AB?logo=python&logoColor=white" alt="Python 3.14" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/django-6-092E20?logo=django&logoColor=white" alt="Django 6" />
  <img src="https://img.shields.io/badge/drf-api-A30000" alt="Django REST Framework" />
  <img src="https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose" />
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployments">Deployments</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#contributing">Contributing</a>
</p>

![Cheat Sheet Generator interface preview](current-ui.png)

## Overview

Cheat Sheet Generator helps students and instructors build math reference sheets from structured formula libraries. Users can select topics, generate starter LaTeX, refine layout settings, preview compiled output, and export the final result as source or PDF.

The repository includes:

- a React frontend for the interactive editor and preview workflow
- a Django REST API for formula generation, persistence, and PDF compilation
- a public GitHub Pages site for lightweight project browsing

## Features

### Core workflow

- Multi-class selection across subjects from pre-algebra through calculus
- Category-based formula picking without multi-select keyboard shortcuts
- Drag-and-drop ordering for formulas and grouped sections
- Generated LaTeX editing in the browser
- Live PDF preview alongside the editor
- PDF compilation through the backend using Tectonic
- Download support for both `.tex` and compiled `.pdf`
- Local autosave to preserve in-progress work

### Layout and formatting

- One, two, or three column layouts
- Adjustable margins, font sizing, and spacing
- Layout-aware recompile flow after formatting changes

### Persistence

- Saved cheat sheet projects
- Reusable templates
- Practice problem storage

## Project page

A public project page is available at `https://chicostate.github.io/cheat-sheet/` for lightweight browsing and onboarding.

The hosted project page does not run the full application by itself. The full experience still depends on the Django API.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, react-pdf, dnd-kit |
| Backend | Django 6, Django REST Framework |
| PDF pipeline | Tectonic |
| Database | SQLite in development, PostgreSQL in Docker |
| Container tooling | Docker Compose |
| CI | GitHub Actions |

## Architecture

```text
Frontend (React + Vite)
  ├─ Formula selection UI
  ├─ Layout controls
  ├─ LaTeX editor
  └─ PDF preview
         │
         ▼
Backend (Django + DRF)
  ├─ Formula data and generation
  ├─ Template / cheat sheet APIs
  ├─ Practice problem APIs
  └─ PDF compilation endpoint
```

## Project structure

```text
├── backend/                      # Django REST API
│   ├── api/                      # Models, serializers, views, tests, formula data
│   ├── cheat_sheet/              # Django settings
│   ├── manage.py
│   └── requirements.txt
├── frontend/                     # React + Vite app
│   ├── public/
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── .github/workflows/            # CI workflows
├── docker-compose.yml
└── README.md
```

## Getting started

### Prerequisites

- Python 3.14
- Node.js 24+
- Tectonic
- Docker Desktop or compatible Docker engine for containerized development

### Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend health check:

```text
http://localhost:8000/api/health/
```

### Frontend setup

```bash
cd frontend
nvm use || true
npm install
npm run dev
```

Frontend app:

```text
http://localhost:5173/
```

### Full stack with Docker

```bash
docker compose up --build
```

## Deployments

### GitHub Pages

- Public project page: `https://chicostate.github.io/cheat-sheet/`
- Intended use: project overview and quick links

### Application runtime

The full application is intended to run locally or through container infrastructure because PDF generation and persistence require the backend API.

## API endpoints

### Authentication and health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health/` | Service health check |
| POST | `/api/register/` | Register a user |
| POST | `/api/token/` | Obtain JWT access and refresh tokens |
| POST | `/api/token/refresh/` | Refresh a JWT access token |

### Formula generation

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/classes/` | List classes, categories, and formulas |
| POST | `/api/generate-sheet/` | Generate LaTeX from selected content |
| POST | `/api/compile/` | Compile LaTeX into PDF |

### Resource management

| Method | Endpoint | Description |
| --- | --- | --- |
| GET / POST | `/api/templates/` | List or create templates |
| GET / PUT / PATCH / DELETE | `/api/templates/{id}/` | Retrieve or modify a template |
| GET / POST | `/api/cheatsheets/` | List or create cheat sheets |
| GET / PUT / PATCH / DELETE | `/api/cheatsheets/{id}/` | Retrieve or modify a cheat sheet |
| GET / POST | `/api/problems/` | List or create practice problems |
| GET / PUT / PATCH / DELETE | `/api/problems/{id}/` | Retrieve or modify a practice problem |

## Available formula classes

- **PRE-ALGEBRA**: order of operations, fractions, ratios, properties, area and perimeter, solving equations
- **ALGEBRA I**: linear equations, inequalities, quadratics, polynomials, exponents, radicals, functions, and more
- **ALGEBRA II**: complex numbers, logarithms, exponentials, conics, sequences, matrices, binomial theorem
- **GEOMETRY**: angles, parallel lines, triangles, circles, polygons, coordinate geometry, transformations
- **TRIGONOMETRY**: right-triangle relationships, special angles, identities, laws of sines and cosines
- **PRECALCULUS**: functions, conics, exponentials, logarithms, polar and parametric topics, sequences
- **CALCULUS I**: limits, derivatives, derivative applications, integrals
- **CALCULUS II**: integration techniques, applications, sequences and series
- **CALCULUS III**: vectors, multivariable derivatives, multiple integrals, vector calculus
- **UNIT CIRCLE**: radians, degrees, and coordinate reference data

## Running checks

### Backend

```bash
cd backend
ruff check .
safety check
pytest -v
```

### Frontend

```bash
cd frontend
npx eslint src/
npm run build
```

### Docker

```bash
docker compose build
```

## CI pipeline

GitHub Actions runs:

- backend linting and tests
- frontend dependency install and production build
- Docker image build verification

The frontend and CI are configured around Node.js 24.

## Development notes

### Adding a new API endpoint

1. Add the view in `backend/api/views.py`
2. Add or update serializers in `backend/api/serializers.py`
3. Register the route in `backend/api/urls.py`
4. Add tests in `backend/api/tests.py`

### Adding formula data

Update the appropriate module under `backend/api/formula_data/`.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Contributing

Contributions are welcome through issues and pull requests. For setup, workflow, and review expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

If you find a vulnerability, follow the reporting guidance in [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

No license file is currently included in this repository.

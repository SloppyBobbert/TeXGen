# Cheat Sheet Generator

<p align="center">
  <img src="frontend/public/math_webicon.png" alt="Cheat Sheet Generator web icon" width="220" />
</p>

<p align="center">
  Full-stack React + Django editor for building LaTeX cheat sheets with live PDF preview, local draft recovery, account-backed saves, compile snapshots, and section-based YouTube study picks.
</p>

<p align="center">
  <a href="https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml"><img src="https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <img src="https://img.shields.io/github/languages/top/ChicoState/cheat-sheet" alt="Top language" />
  <img src="https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white" alt="Node 24" />
  <img src="https://img.shields.io/badge/python-3.14-3776AB?logo=python&logoColor=white" alt="Python 3.14" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/django-6-092E20?logo=django&logoColor=white" alt="Django 6" />
  <img src="https://img.shields.io/badge/drf-api-A30000" alt="Django REST Framework" />
  <img src="https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose" />
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#current-editor-ui">Current Editor UI</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#checks-and-validation">Checks and Validation</a>
</p>

![Cheat Sheet Generator interface preview](current-ui.png)

## Overview

Cheat Sheet Generator is a study-sheet editor for math-heavy classes. Users can pick classes and categories, generate starter LaTeX from the formula library, tune layout settings, preview compiled output, restore prior compile snapshots, and export the result as PDF or `.tex`.

The app is split into:

- a **React + Vite frontend** for the editor, dashboard, auth screens, preview controls, and resource rail
- a **Django REST API** for formula generation, persistence, JWT auth, and PDF compilation
- a **Docker Compose setup** for local full-stack development with PostgreSQL

## Current Editor UI

The main editor is a three-region workspace:

### Left rail

- class checklist
- card-style section/category toggles with clearer collapse affordances
- drag-and-drop formula ordering grouped by class
- layout controls for columns, text size, spacing, and margins
- primary actions for compile, save, reset, and downloads

### Center workspace

- top toolbar with subject toggle, snapshot toggle, save, print, video rail toggle, and manual LaTeX editor toggle
- optional split view with LaTeX editor on one side and compiled PDF preview on the other; the editor stays closed until the user opens it
- PDF preview controls for zoom in/out, reset, fit width, fit height, and print
- animated recompilation overlay while the preview refreshes

### Right rail

- compact section-aware study video recommendations
- one curated video shown by default per selected section, with section-level expansion for more curated links
- per-section YouTube search only when the curated picks are not enough
- inline thumbnails with modal playback; video cards live only in the right rail

## Features

### Recent updates

- clearer left-rail section disclosures and a first-compile rail shrink for a wider preview
- curated class/section video links with compact right-rail cards and API search kept as a per-section fallback
- LaTeX editor remains closed by default so the compiled PDF stays front and center
- GitHub Pages project-page assets were removed; the app is now documented as a local/Docker full-stack project
- Animated compile button with shimmer effect while compiling with a green flash on success
- Toast notification now replaces the browser alert on save 
- Keyboard Shortcuts: Ctrl+Enter to compile, Ctrl+S to save, Escape to close the video model
- Browser tab title now updates to reflect the name of the active cheat sheet 
- character counter on the title input with a limit of 80 characters
- New 'last saved' timestamp displayed next to the save button
- Scroll to top button in the PDF Preview
- Empty state illustration in the right panel when no sections are selected
- Section count badge on the right panel header
- Select all/Deselect all option above the subject class list 
- Clear search button for YouTube Search Results
- PDF page number display in the preview toolbar 
- Focus ring styles for keyboard navigation accessibility 
- Improved muted text contrast to meet the WCAG AA standards
- Custom scrollbar styling across all the panels
- Hover transitions on video cards
- Smooth transitions for panel show/hide options
- Improvements for mobile responsiveness for screens under 768px
- Divider lines between the layout option selections 
- Full implementation of YouTube videos across each subject

### Editing and generation

- formula library spanning pre-algebra through calculus
- category-based formula picking
- drag-and-drop ordering for classes and formulas
- generated LaTeX editing in-browser
- compile through the backend with Tectonic
- PDF preview with button-driven zoom controls
- print support from the current compiled PDF
- first compile narrows the subject rail to its minimum width so the preview has more room

### Layout controls

- **1 to 5 columns**
- preset and custom font sizing
- preset and custom spacing
- adjustable page margins
- automatic preview rebuild after layout-only changes

### Persistence and recovery

- browser-local draft persistence for the active sheet
- account-backed save/load for signed-in users
- local compile snapshots for the active draft
- snapshot restore flow that repopulates the editor and rebuilds preview on reopen
- local-only save success message when the user is not signed in

### UI workflow

- resizable left rail, LaTeX pane, and right rail
- hide/show subject and video rails from the toolbar
- LaTeX editor hidden by default after compile to keep the PDF preview as the main focus
- responsive layout cleanup for tighter desktop widths and smaller screens
- compile-state loading shell for preview refreshes

### Study resources

- backend-proxied YouTube search so the API key never reaches the browser
- repo-root `YOUTUBE_API_KEY` support for local runs and Docker Compose passthrough
- curated class/section links in `frontend/src/data/subjectVideos.js` shown before any API call
- section-scoped “search more” behavior so the YouTube API is a last-resort fallback for the clicked section only
- request validation and error handling for missing key, invalid topics, empty results, and upstream failures

### Themes
- Light Mode
- Dark Mode
- Miami Theme
- Forest Theme
- Cool Gray Theme
- Neon Theme
- Galaxy Theme
- Red Theme
- Pink 'Blossom' Inspired Theme

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, react-pdf, dnd-kit, lucide-react, framer-motion |
| Backend | Django 6, Django REST Framework, Simple JWT |
| PDF pipeline | Tectonic |
| Database | SQLite by default, PostgreSQL in Docker |
| Tooling | Docker Compose, ESLint, Vitest, Pytest, Ruff |

## Architecture

```text
Frontend (React + Vite)
  ├─ Auth + dashboard routes
  ├─ Formula selection and ordering UI
  ├─ Layout controls + LaTeX editor
  ├─ PDF preview and export actions
  └─ YouTube resource rail
         │
         ▼
Backend (Django + DRF)
  ├─ JWT auth + registration
  ├─ Formula/class metadata
  ├─ LaTeX generation endpoint
  ├─ LaTeX compile + normalize endpoint
  ├─ YouTube resource proxy endpoint
  └─ Template / cheat sheet / problem CRUD
```

## Project structure

```text
.
├── backend/
│   ├── api/
│   │   ├── formula_data/          # Class/category/formula source data
│   │   ├── models.py              # Template, CheatSheet, PracticeProblem
│   │   ├── serializers.py         # DRF serializers
│   │   ├── tests.py               # Backend API and compile tests
│   │   ├── urls.py                # API routes
│   │   └── views.py               # Generation, compile, resource, CRUD views
│   ├── cheat_sheet/
│   │   ├── settings.py            # Django settings + env loading
│   │   └── urls.py
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/            # Editor, dashboard, auth, UI components
│   │   ├── context/               # Auth context
│   │   ├── data/                  # Curated study video links
│   │   ├── hooks/                 # Formula, latex, YouTube resource hooks
│   │   ├── App.css                # Main application styling
│   │   └── App.jsx                # Routing, shell, save workflow
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
├── .github/workflows/             # CI workflows
├── docker-compose.yml
├── current-ui.png
└── README.md
```

## Getting started

### Prerequisites

- Node.js 24+
- Python 3.14+
- Tectonic
- Docker Desktop or equivalent container runtime

### Environment

The backend reads both, with `/backend/.env` taking precedence over repo-root defaults:

- `/.env`
- `/backend/.env`

For YouTube suggestions, add this in the repo-root `.env`:

```dotenv
YOUTUBE_API_KEY=your_key_here
```

Docker Compose passes `YOUTUBE_API_KEY` into the backend container from the repo-root `.env` (or from your shell environment), so the same key works in local Django runs and containers without mounting the whole root `.env` file into the container.

### Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend URL:

```text
http://localhost:8000/api/
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173/
```

### Full stack with Docker

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000/api/`
- postgres: internal Compose service used by Django

## Editor workflow

1. Select one or more classes.
2. Toggle the categories you want included.
3. Reorder class groups or formulas if needed.
4. Generate/compile the sheet.
5. Adjust columns, spacing, font size, or margins.
6. Open the LaTeX editor only if you need to inspect or edit the generated source.
7. Save locally or, if signed in, save to your account.
8. Restore a compile snapshot if you want to jump back to an earlier draft.
9. Export `.pdf` / `.tex` or print directly from the preview toolbar.

## API endpoints

### Authentication and health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health/` | Service health check |
| POST | `/api/register/` | Register a new user |
| POST | `/api/token/` | Obtain JWT access and refresh tokens |
| POST | `/api/token/refresh/` | Refresh JWT access token |

### Editor and compilation

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/classes/` | List classes, categories, and formulas |
| POST | `/api/generate-sheet/` | Generate LaTeX from selected formulas |
| POST | `/api/compile/` | Normalize and compile LaTeX into PDF |
| POST | `/api/youtube-resources/` | Return top YouTube picks for selected sections |

### Persistence

| Method | Endpoint | Description |
| --- | --- | --- |
| GET / POST | `/api/templates/` | List or create templates |
| GET / PUT / PATCH / DELETE | `/api/templates/{id}/` | Retrieve or modify a template |
| GET / POST | `/api/cheatsheets/` | List or create cheat sheets |
| GET / PUT / PATCH / DELETE | `/api/cheatsheets/{id}/` | Retrieve or modify a cheat sheet |
| GET / POST | `/api/problems/` | List or create practice problems |
| GET / PUT / PATCH / DELETE | `/api/problems/{id}/` | Retrieve or modify a practice problem |

## Available formula coverage

- PRE-ALGEBRA
- ALGEBRA I
- ALGEBRA II
- GEOMETRY
- TRIGONOMETRY
- PRECALCULUS
- CALCULUS I
- CALCULUS II
- CALCULUS III
- UNIT CIRCLE
- PHYSICS I
- PHYSICS II
- STATISTICS I
- STATISTICS II
- LINEAR ALGEBRA I
- LINEAR ALGEBRA II

Each class contains multiple categories and formulas in `backend/api/formula_data/`.

## Checks and validation

### Frontend

```bash
cd frontend
npx eslint src
npm test -- --run
npm run build
```

### Backend

```bash
cd backend
python manage.py check
pytest -v
ruff check .
```

For the Docker-backed backend checks used before release:

```bash
docker compose run --rm backend python manage.py check
docker compose run --rm backend pytest -q
docker compose run --rm backend ruff check .
```

### Docker

```bash
docker compose config
docker compose build
```

## CI pipeline

GitHub Actions verifies:

- frontend install and build
- backend lint/tests
- container build verification

## Development notes

### Add a new API endpoint

1. Add the view in `backend/api/views.py`
2. Register the route in `backend/api/urls.py`
3. Add or update serializers if needed
4. Cover it in `backend/api/tests.py`

### Add formula content

Update the appropriate file under `backend/api/formula_data/`.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Contributing

Open issues or pull requests if you want to improve formula coverage, editor workflow, tests, or docs. For repo workflow expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

If you find a vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

No license file is currently included in this repository.

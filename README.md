# Cheat Sheet Generator

[![CI](https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml)

A full-stack web application for generating LaTeX-based cheat sheets. Users select math classes and formula categories, then view the generated LaTeX code alongside a live PDF preview.

## Features

- **Class Selection**: Choose from PRE-ALGEBRA, ALGEBRA I, ALGEBRA II, and GEOMETRY
- **Formula Selection**: Expand classes to see categories, then select specific formulas
- **Category Selection**: "Select All" option for quick selection of entire categories
- **Live Preview**: Split-view interface with LaTeX code on the left and PDF preview on the right
- **PDF Export**: Compile to PDF using Tectonic LaTeX engine on the backend
- **Download Options**: Download as .tex source or .pdf

## Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (React + Vite)"]
        UI[User Interface]
        SplitView[Split View<br/>LaTeX | PDF]
    end
    
    subgraph Server["Backend (Django)"]
        API[REST API]
        FormulaData[Formula Data<br/>by Class]
        LatexGen[LaTeX Generator]
    end
    
    subgraph Engine["Tectonic LaTeX"]
        Tectonic[Tectonic Binary]
    end
    
    User((User)) --> UI
    UI --> API
    API --> FormulaData
    FormulaData --> LatexGen
    LatexGen --> Tectonic
    Tectonic --> PDF[PDF File]
    API --> SplitView
    SplitView --> User
```

## Planned Features

> These features are not yet implemented

- **Formatting Options**: 
  - Column layout (single, two, three columns)
  - Text sizes (font scaling)
  - Margin adjustments
- **Image Insertion**: Add images directly into your cheat sheet
- **User Accounts**: Register and log in with username and password
- **Database Storage**: Save and manage cheat sheets in database
- **Autosave & Version History**: Every compile is saved automatically; revert to any previous version

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + npm |
| Backend | Django 6 + Django REST Framework |
| LaTeX Engine | Tectonic |
| Database | SQLite (dev) / MariaDB (prod) |
| Container | Docker Compose |

### Backend Dependencies
- django>=6.0
- djangorestframework>=3.15
- django-cors-headers>=4.4
- python-dotenv>=1.0
- dj-database-url>=2.1
- pymysql>=1.1
- pytest>=8.0
- pytest-django>=4.8
- ruff>=0.4.0 (linting)
- safety>=2.0 (security)

### Frontend Dependencies
- react, react-dom
- vite

## Project Structure

```
├── backend/                 # Django REST API
│   ├── cheat_sheet/         # Django project settings
│   ├── api/                 # API app
│   │   ├── views.py         # API endpoints
│   │   ├── models.py        # Database models
│   │   ├── formula_data/    # Hardcoded formula data
│   │   │   ├── pre_algebra.py
│   │   │   ├── algebra_i.py
│   │   │   ├── algebra_ii.py
│   │   │   └── geometry.py
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend container
│   └── manage.py
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── App.jsx          # Main app component
│   │   ├── components/
│   │   │   └── CreateCheatSheet.jsx  # Main UI
│   │   └── App.css
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml       # Container orchestration
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/` | Health check |
| GET | `/api/classes/` | List available classes with categories and formulas |
| POST | `/api/generate-sheet/` | Generate LaTeX for selected formulas |
| POST | `/api/compile/` | Compile LaTeX to PDF |

### Available Formula Classes

- **PRE-ALGEBRA** - Order of Operations, Fractions, Ratios, Properties, Area/Perimeter, Solving Equations
- **ALGEBRA I** - Linear Equations, Inequalities, Integer Rules, Decimals/Percents, Mean/Median/Mode, Quadratics, Polynomials, Exponents, Radicals, Functions, Absolute Value, Rational Expressions
- **ALGEBRA II** - Complex Numbers, Logarithms, Exponential Functions, Polynomial Theorems, Conic Sections, Sequences/Series, Matrices, Binomial Theorem
- **GEOMETRY** - Angle Relationships, Parallel Lines, Triangles, Pythagorean Theorem, Similar/Congruent Triangles, Quadrilaterals, Polygons, Circles, Circle Theorems, Coordinate Geometry, Surface Area/Volume, Transformations

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 20+
- Tectonic (for PDF compilation)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173/`.

### Docker

```bash
docker compose up --build
```

This builds and starts the Django backend, React frontend, and MariaDB database.

The app will be available at `http://localhost:5173/`. API requests are proxied to the Django backend.

## Running Tests

### Backend (pytest)

```bash
cd backend
pytest -v                 # Run with verbose output
pytest -k "test_name"    # Run tests matching pattern
```

### Frontend (ESLint)

```bash
cd frontend
npx eslint src/           # Lint source files
npx eslint --fix src/     # Auto-fix lint issues
```

### CI Pipeline

The project includes GitHub Actions CI that runs:
- Backend: Ruff linting, Safety security scan, pytest
- Frontend: ESLint, build verification
- Docker: Image build verification

## User Flow

1. **Enter Title**: Give your cheat sheet a name
2. **Select Class**: Click on a class (PRE-ALGEBRA, ALGEBRA I, ALGEBRA II, GEOMETRY) to expand
3. **Select Categories**: Expand categories to see formulas, or use "Select All"
4. **Generate**: Click "Generate Cheat Sheet" to create LaTeX
5. **Preview**: Click "Compile & Preview" to see the PDF
6. **Download**: Download as .tex or .pdf

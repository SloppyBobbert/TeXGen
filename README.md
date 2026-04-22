# Cheat Sheet Generator

[![CI](https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ChicoState/cheat-sheet/actions/workflows/ci.yml)

A full-stack web application for generating LaTeX-based cheat sheets. Users select math classes and formula categories, then view the generated LaTeX code alongside a live PDF preview.

## Features

### Core Features
- **Multi-Class Selection**: Choose from 10 different subjects including PRE-ALGEBRA, ALGEBRA I & II, GEOMETRY, TRIGONOMETRY, PRECALCULUS, CALCULUS I-III, and UNIT CIRCLE.
- **Category Selection**: Select categories with checkboxes for each class (no Ctrl/Cmd needed)
- **Drag-and-Drop Reordering**: Intuitively organize your cheat sheet by dragging individual formulas or entire collapsible class groups to reorder them before generating.
- **Formula Generation**: Automatically generates formatted LaTeX for selected formulas
- **Live Preview**: Split-pane interface with line-numbered LaTeX editor (45% width) and PDF preview (45% width)
- **PDF Compilation**: Compile to PDF using Tectonic LaTeX engine on the backend
- **Download Options**: Download as `.tex` source or `.pdf`
- **Auto-Save**: Progress automatically saved to browser localStorage - survives page refresh
- **Version History**: Navigate through last 3 compiled versions with back/forward buttons

### Formatting Options
- **Column Layout**: Single, two, or three column layouts with auto-scaling formulas that fit within column boundaries
- **Margins**: Adjustable page margins
- **Font Size**: Configurable font scaling (8pt - 12pt)
- **Spacing**: Adjustable spacing between formula sections

### Database Features
- **Templates**: Save and manage reusable LaTeX templates
- **Cheat Sheets**: Save and load your cheat sheet projects
- **Practice Problems**: Add practice problems to your sheets

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Backend | Django 6 + Django REST Framework |
| LaTeX Engine | Tectonic |
| Database | SQLite (dev) / PostgreSQL (Docker/prod) |
| Container | Docker Compose |

## Project Structure

```
├── backend/                      # Django REST API
│   ├── cheat_sheet/              # Django project settings
│   ├── api/                      # Main API app
│   │   ├── views.py              # API endpoints
│   │   ├── models.py             # Database models
│   │   ├── latex_utils.py        # LaTeX generation utilities
│   │   ├── urls.py               # URL routing
│   │   ├── serializers.py        # DRF serializers
│   │   ├── tests.py              # Test suite
│   │   └── formula_data/         # Formula definitions
│   │       ├── pre_algebra.py
│   │       ├── algebra_i.py
│   │       ├── algebra_ii.py
│   │       └── geometry.py
│   └── requirements.txt
├── frontend/                      # React + Vite
│   ├── src/
│   │   ├── App.jsx               # Main app
│   │   ├── components/
│   │   │   └── CreateCheatSheet.jsx
│   │   ├── hooks/
│   │   │   ├── formulas.js       # Formula selection logic
│   │   │   └── latex.js          # LaTeX generation & compilation
│   │   └── App.css
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Formula Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes/` | List available classes with categories and formulas |
| POST | `/api/generate-sheet/` | Generate LaTeX for selected formulas |
| POST | `/api/compile/` | Compile LaTeX to PDF |

### Resource Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/templates/` | List/create templates |
| GET/PUT/PATCH/DELETE | `/api/templates/{id}/` | Retrieve/update/delete template |
| GET/POST | `/api/cheatsheets/` | List/create cheat sheets |
| GET/PUT/PATCH/DELETE | `/api/cheatsheets/{id}/` | Retrieve/update/delete cheat sheet |
| GET/POST | `/api/problems/` | List/create practice problems |
| GET/PUT/PATCH/DELETE | `/api/problems/{id}/` | Retrieve/update/delete problem |

### Available Formula Classes

- **PRE-ALGEBRA** - Operations and Properties, Fractions/Ratios/Proportions, Area and Perimeter, Solving Equations
- **ALGEBRA I** - Linear Equations, Inequalities, Integer Rules, Decimals/Percents, Mean/Median/Mode, Quadratics, Polynomials, Exponents, Radicals, Functions, Absolute Value, Rational Expressions
- **ALGEBRA II** - Complex Numbers, Logarithms, Exponential Functions, Polynomial Theorems and Binomial Expansion, Conic Sections, Sequences and Series, Matrices
- **GEOMETRY** - Angle Relationships, Parallel Lines, Triangles, Pythagorean Theorem, Similar/Congruent Triangles, Quadrilaterals, Polygons, Circles, Circle Theorems, Coordinate Geometry, Surface Area/Volume, Transformations
- **TRIGONOMETRY** - Right Triangle Trigonometry, Fundamental Identities, Angle Sum and Multiple-Angle Identities, Product and Power Identities, Inverse Trig Identities, Applications
- **PRECALCULUS** - Functions, Conic Sections, Sequences/Series/Binomial Theorem, Polar and Complex Polar
- **CALCULUS I** - Limits, Derivative Definitions and Rules, Common Derivatives, Core Theorems of Calculus, Basic Antiderivatives
- **CALCULUS II** - Integration Techniques and Improper Integrals, Applications of Integration, Sequences and Series, Power and Taylor Series, Parametric and Polar
- **CALCULUS III** - Vector Formulas, Partial Derivatives and Optimization, Multiple Integrals
- **UNIT CIRCLE** - Complete visual representation of the unit circle with radians, degrees, and coordinates

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 20+
- Tectonic (for PDF compilation)

### Backend Setup

```bash
cd backend 
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

### Frontend Setup

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

This builds and starts the Django backend, React frontend, and PostgreSQL database.

## Running Tests

### Backend (pytest)

```bash
cd backend
pytest                      # Run all tests
pytest -v                   # Run with verbose output
pytest -k "test_name"        # Run tests matching pattern
pytest api/tests.py          # Run specific test file
```

### Frontend (ESLint)

```bash
cd frontend
npx eslint src/             # Lint source files
npx eslint --fix src/       # Auto-fix lint issues
npm run build               # Production build verification
```

## CI Pipeline

The project includes GitHub Actions CI that runs:
- **Backend**: Ruff linting, Safety security scan, pytest
- **Frontend**: ESLint, build verification
- **Docker**: Image build verification

## User Flow

1. **Enter Title**: Give your cheat sheet a name
2. **Select Class**: Click on a class (e.g., CALCULUS I, UNIT CIRCLE, ALGEBRA II)
3. **Select Categories**: Check the categories you want
4. **Reorder**: Drag and drop formulas or entire categories to set their final order
5. **Generate**: Click "Generate Cheat Sheet" - LaTeX generates and PDF compiles automatically
6. **Preview**: View the PDF in the preview pane, or click the circular button to recompile
7. **Customize**: Edit the LaTeX directly or adjust formatting options
8. **Download**: Download as `.tex` or `.pdf`
9. **Save**: Click "Save Progress" to store your cheat sheet to the database

## Development

### Adding a new API endpoint

1. Add view function in `backend/api/views.py`
2. Add serializer in `backend/api/serializers.py` if needed
3. Add URL route in `backend/api/urls.py`
4. Write tests in `backend/api/tests.py`

### Adding formula data

Add formulas to the appropriate file in `backend/api/formula_data/`:
- `pre_algebra.py`
- `algebra_i.py`
- `algebra_ii.py`
- `geometry.py`
- `trig.py`
- `precalculus.py`
- `calculus_i.py`
- `calculus_ii.py`
- `calculus_iii.py`
- `unit_circle.py`

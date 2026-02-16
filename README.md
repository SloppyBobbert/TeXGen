# cheat-sheet

A full-stack web application built with **React** (frontend) and **Django** (backend).

## Project Structure

```
├── backend/          # Django REST API
│   ├── cheat_sheet/  # Django project settings
│   ├── api/          # Main API app
│   ├── manage.py
│   └── requirements.txt
├── frontend/         # React + Vite
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# create a .env file in the backend/ directory with the required settings, for example:
# SECRET_KEY=your-dev-secret-key
# DEBUG=True
# ALLOWED_HOSTS=localhost,127.0.0.1
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

### Docker

```bash
docker compose up --build
```

This will build everything

The app will be available at `http://localhost:5173/`. API requests are proxied to the Django backend.

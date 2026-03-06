"""
Backend tests using pytest-django.
Run with: pytest  (from the backend/ directory)
"""

import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from api.models import Template, CheatSheet, PracticeProblem


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def sample_template(db):
    return Template.objects.create(
        name="Test Algebra",
        subject="algebra",
        description="A test template",
        latex_content="\\section*{Test}\nHello World",
        default_margins="0.5in",
        default_columns=2,
    )


@pytest.fixture
def sample_sheet(db, sample_template):
    return CheatSheet.objects.create(
        title="My Test Sheet",
        template=sample_template,
        latex_content="Some content here",
        margins="0.75in",
        columns=2,
        font_size="10pt",
    )


@pytest.fixture
def sample_problem(db, sample_sheet):
    return PracticeProblem.objects.create(
        cheat_sheet=sample_sheet,
        question_latex="What is $2 + 2$?",
        answer_latex="$4$",
        order=1,
    )


# ── Model Tests ──────────────────────────────────────────────────────


class TestTemplateModel(TestCase):
    def test_str_representation(self):
        t = Template.objects.create(
            name="Algebra Basics",
            subject="algebra",
            latex_content="\\section{Algebra}",
        )
        assert "Algebra" in str(t)
        assert "Algebra Basics" in str(t)


class TestCheatSheetModel(TestCase):
    def test_build_full_latex_wraps_content(self):
        sheet = CheatSheet.objects.create(
            title="Test",
            latex_content="Hello World",
            margins="1in",
            columns=1,
            font_size="10pt",
        )
        full = sheet.build_full_latex()
        assert "\\begin{document}" in full
        assert "\\end{document}" in full
        assert "Hello World" in full
        assert "margin=1in" in full

    def test_build_full_latex_multicolumn(self):
        sheet = CheatSheet.objects.create(
            title="Multi-col",
            latex_content="Col content",
            columns=3,
        )
        full = sheet.build_full_latex()
        assert "\\usepackage{multicol}" in full
        assert "\\begin{multicols}{3}" in full

    def test_build_full_latex_passthrough(self):
        raw = "\\documentclass{article}\n\\begin{document}\nCustom\n\\end{document}"
        sheet = CheatSheet.objects.create(
            title="Raw",
            latex_content=raw,
        )
        assert sheet.build_full_latex() == raw

    def test_build_full_latex_with_problems(self):
        sheet = CheatSheet.objects.create(
            title="With Problems",
            latex_content="Content",
        )
        PracticeProblem.objects.create(
            cheat_sheet=sheet,
            question_latex="What is $1+1$?",
            answer_latex="$2$",
            order=1,
        )
        full = sheet.build_full_latex()
        assert "Practice Problems" in full
        assert "What is $1+1$?" in full
        assert "$2$" in full


# ── API Tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestHealthEndpoint:
    def test_health_returns_ok(self, api_client):
        resp = api_client.get("/api/health/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.django_db
class TestTemplateAPI:
    def test_list_templates(self, api_client, sample_template):
        resp = api_client.get("/api/templates/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Algebra"

    def test_filter_templates_by_subject(self, api_client, sample_template):
        resp = api_client.get("/api/templates/?subject=algebra")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    def test_create_template(self, api_client):
        resp = api_client.post(
            "/api/templates/",
            {
                "name": "New Template",
                "subject": "calculus",
                "latex_content": "\\section{Calc}",
            },
            format="json",
        )
        assert resp.status_code == 201


@pytest.mark.django_db
class TestCheatSheetAPI:
    def test_list_cheatsheets(self, api_client, sample_sheet):
        resp = api_client.get("/api/cheatsheets/")
        assert resp.status_code == 200

    def test_create_cheatsheet(self, api_client):
        resp = api_client.post(
            "/api/cheatsheets/",
            {
                "title": "Brand New Sheet",
                "latex_content": "Hello",
                "margins": "1in",
                "columns": 1,
                "font_size": "12pt",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "Brand New Sheet"
        assert "full_latex" in resp.json()

    def test_retrieve_cheatsheet_has_full_latex(self, api_client, sample_sheet):
        resp = api_client.get(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert "\\begin{document}" in data["full_latex"]

    def test_update_cheatsheet(self, api_client, sample_sheet):
        resp = api_client.patch(
            f"/api/cheatsheets/{sample_sheet.id}/",
            {"margins": "0.25in", "columns": 3},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["margins"] == "0.25in"
        assert resp.json()["columns"] == 3

    def test_delete_cheatsheet(self, api_client, sample_sheet):
        resp = api_client.delete(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 204


@pytest.mark.django_db
class TestCreateFromTemplate:
    def test_create_from_template(self, api_client, sample_template):
        resp = api_client.post(
            "/api/cheatsheets/from-template/",
            {"template_id": sample_template.id, "title": "My Copy"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Copy"
        assert data["template"] == sample_template.id
        assert data["columns"] == sample_template.default_columns

    def test_create_from_template_missing_id(self, api_client):
        resp = api_client.post(
            "/api/cheatsheets/from-template/",
            {"title": "Oops"},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestPracticeProblemAPI:
    def test_create_problem(self, api_client, sample_sheet):
        resp = api_client.post(
            "/api/problems/",
            {
                "cheat_sheet": sample_sheet.id,
                "question_latex": "What is $3+3$?",
                "answer_latex": "$6$",
                "order": 1,
            },
            format="json",
        )
        assert resp.status_code == 201

    def test_filter_problems_by_sheet(self, api_client, sample_problem, sample_sheet):
        resp = api_client.get(f"/api/problems/?cheat_sheet={sample_sheet.id}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.django_db
class TestCompileEndpoint:
    def test_compile_requires_content_or_id(self, api_client):
        resp = api_client.post("/api/compile/", {}, format="json")
        assert resp.status_code == 400

    def test_compile_with_nonexistent_sheet(self, api_client):
        resp = api_client.post(
            "/api/compile/",
            {"cheat_sheet_id": 99999},
            format="json",
        )
        assert resp.status_code == 404

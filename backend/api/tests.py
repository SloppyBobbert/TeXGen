"""
Backend tests using pytest-django.
Run with: pytest  (from the backend/ directory)
"""

import pytest
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from api.models import Template, CheatSheet, PracticeProblem


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(db):
    """Authenticated API client (bypasses JWT for speed)."""
    client = APIClient()
    user = User.objects.create_user(username="testuser", password="testpass123")
    client.force_authenticate(user=user)
    return client


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

    def test_build_full_latex_passthrough_inserts_problems_before_document_end(self):
        raw = "\\documentclass{article}\n\\begin{document}\nCustom\n\\end{document}"
        sheet = CheatSheet.objects.create(
            title="Raw With Problems",
            latex_content=raw,
        )
        PracticeProblem.objects.create(
            cheat_sheet=sheet,
            question_latex="Show that $x^2 \\ge 0$.",
            answer_latex="Because squares are nonnegative.",
            order=1,
        )

        full = sheet.build_full_latex()

        assert "Practice Problems" in full
        assert "Show that $x^2 \\ge 0$." in full
        assert full.index("Practice Problems") < full.index("\\end{document}")

    def test_build_full_latex_passthrough_inserts_problems_before_end_multicols(self):
        raw = (
            "\\documentclass{article}\n"
            "\\usepackage{multicol}\n"
            "\\begin{document}\n"
            "\\begin{multicols}{2}\n"
            "Custom\n"
            "\\end{multicols}\n"
            "\\end{document}"
        )
        sheet = CheatSheet.objects.create(
            title="Raw Multi",
            latex_content=raw,
        )
        PracticeProblem.objects.create(
            cheat_sheet=sheet,
            question_latex="Integrate $x$.",
            answer_latex="$x^2 / 2 + C$",
            order=1,
        )

        full = sheet.build_full_latex()

        assert full.index("Practice Problems") < full.index("\\end{multicols}")

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

    def test_build_full_latex_8pt_uses_extarticle(self):
        sheet = CheatSheet.objects.create(
            title="Small Font",
            latex_content="Content",
            font_size="8pt",
        )

        full = sheet.build_full_latex()

        assert "\\documentclass[8pt]{extarticle}" in full


# ── API Tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestHealthEndpoint:
    def test_health_returns_ok(self, api_client):
        resp = api_client.get("/api/health/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.django_db
class TestTemplateAPI:
    def test_list_templates(self, auth_client, sample_template):
        resp = auth_client.get("/api/templates/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Algebra"

    def test_filter_templates_by_subject(self, auth_client, sample_template):
        resp = auth_client.get("/api/templates/?subject=algebra")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    def test_create_template(self, auth_client):
        resp = auth_client.post(
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
    def test_list_cheatsheets(self, auth_client, sample_sheet):
        resp = auth_client.get("/api/cheatsheets/")
        assert resp.status_code == 200

    def test_create_cheatsheet(self, auth_client):
        resp = auth_client.post(
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

    def test_retrieve_cheatsheet_has_full_latex(self, auth_client, sample_sheet):
        resp = auth_client.get(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert "\\begin{document}" in data["full_latex"]

    def test_update_cheatsheet(self, auth_client, sample_sheet):
        resp = auth_client.patch(
            f"/api/cheatsheets/{sample_sheet.id}/",
            {"margins": "0.25in", "columns": 3},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["margins"] == "0.25in"
        assert resp.json()["columns"] == 3

    def test_delete_cheatsheet(self, auth_client, sample_sheet):
        resp = auth_client.delete(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 204


@pytest.mark.django_db
class TestCreateFromTemplate:
    def test_create_from_template(self, auth_client, sample_template):
        resp = auth_client.post(
            "/api/cheatsheets/from-template/",
            {"template_id": sample_template.id, "title": "My Copy"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Copy"
        assert data["template"] == sample_template.id
        assert data["columns"] == sample_template.default_columns

    def test_create_from_template_missing_id(self, auth_client):
        resp = auth_client.post(
            "/api/cheatsheets/from-template/",
            {"title": "Oops"},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestPracticeProblemAPI:
    def test_create_problem(self, auth_client, sample_sheet):
        resp = auth_client.post(
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

    def test_filter_problems_by_sheet(self, auth_client, sample_problem, sample_sheet):
        resp = auth_client.get(f"/api/problems/?cheat_sheet={sample_sheet.id}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.django_db
class TestGenerateSheetEndpoint:
    def test_generate_sheet_no_formulas(self, auth_client):
        resp = auth_client.post("/api/generate-sheet/", {"formulas": []}, format="json")
        assert resp.status_code == 200
        assert "tex_code" in resp.json()

    def test_generate_sheet_missing_formulas_key(self, auth_client):
        resp = auth_client.post("/api/generate-sheet/", {}, format="json")
        assert resp.status_code == 200
        assert "tex_code" in resp.json()

    def test_generate_sheet_valid_formula(self, auth_client):
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [
                    {"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}
                ]
            },
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tex_code" in data
        assert "\\section*{ALGEBRA I}" in data["tex_code"]
        assert "Slope Formula" in data["tex_code"]

    def test_generate_sheet_preserves_order(self, auth_client):
        """Selected formula order must be preserved in the LaTeX output."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [
                    {"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"},
                    {"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope-Intercept Form"},
                ]
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        slope_pos = tex.find("Slope Formula")
        intercept_pos = tex.find("Slope-Intercept Form")
        assert slope_pos != -1 and intercept_pos != -1
        assert slope_pos < intercept_pos

    def test_generate_sheet_special_class_unit_circle(self, auth_client):
        """Special class (UNIT CIRCLE) with no categories should generate valid LaTeX."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [
                    {"class": "UNIT CIRCLE", "name": "Unit Circle (Key Angles)"}
                ]
            },
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tex_code" in data
        tex = data["tex_code"]
        assert "\\section*{UNIT CIRCLE}" in tex
        assert "\\begin{document}" in tex
        assert "\\end{document}" in tex

    def test_generate_sheet_invalid_formula_returns_400(self, auth_client):
        """Requesting a formula that does not exist should return 400."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [
                    {"class": "NONEXISTENT CLASS", "category": "Fake Category", "name": "Fake Formula"}
                ]
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_generate_sheet_with_columns(self, auth_client):
        """Test that columns parameter produces multicols environment."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "columns": 3
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\begin{multicols}{3}" in tex
        assert "\\end{multicols}" in tex

    def test_generate_sheet_with_font_size(self, auth_client):
        """Test that font_size parameter affects the LaTeX output."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "8pt"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\tiny" in tex

    def test_generate_sheet_with_margins(self, auth_client):
        """Test that margins parameter is reflected in geometry package."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "margins": "0.5in"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "margin=0.5in" in tex

    def test_generate_sheet_with_spacing(self, auth_client):
        """Test that spacing parameter affects titlesec spacing."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "spacing": "tiny"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "titlespacing" in tex

    def test_generate_sheet_invalid_font_size_defaults(self, auth_client):
        """Invalid font_size should be replaced with default."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "invalid-size"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\documentclass[10pt" in tex

    def test_generate_sheet_invalid_margins_defaults(self, auth_client):
        """Invalid margins should be replaced with default."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "margins": "bad-margin"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "margin=0.25in" in tex

    def test_generate_sheet_invalid_spacing_defaults(self, auth_client):
        """Invalid spacing should be replaced with default (large preset)."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "spacing": "huge"
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        # The "large" preset uses 16pt/8pt; assert those values appear in titlespacing
        assert "\\titlespacing*{\\section}{0pt}{16pt}{8pt}" in tex
        assert "\\titlespacing*{\\subsection}{0pt}{8pt}{4pt}" in tex

    def test_generate_sheet_8pt_uses_extarticle(self, auth_client):
        """8pt font size should use extarticle, not article."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "8pt",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\documentclass[8pt,fleqn]{extarticle}" in tex
        assert "\\documentclass[8pt,fleqn]{article}" not in tex

    def test_generate_sheet_9pt_uses_extarticle(self, auth_client):
        """9pt font size should use extarticle, not article."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "9pt",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\documentclass[9pt,fleqn]{extarticle}" in tex
        assert "\\documentclass[9pt,fleqn]{article}" not in tex

    def test_generate_sheet_10pt_uses_article(self, auth_client):
        """10pt font size should use standard article class."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "10pt",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\documentclass[10pt,fleqn]{article}" in tex
        assert "extarticle" not in tex

    def test_generate_sheet_latex_injection_blocked(self, auth_client):
        """LaTeX injection attempts in parameters should be sanitized."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "8pt\\usepackage{hacked}",
                "margins": "0.25in\\input{/etc/passwd}",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\usepackage{hacked}" not in tex
        assert "\\input{/etc/passwd}" not in tex


@pytest.mark.django_db
class TestCompileEndpoint:
    def test_compile_requires_content_or_id(self, auth_client):
        resp = auth_client.post("/api/compile/", {}, format="json")
        assert resp.status_code == 400

    def test_compile_with_nonexistent_sheet(self, auth_client):
        resp = auth_client.post(
            "/api/compile/",
            {"cheat_sheet_id": 99999},
            format="json",
        )
        assert resp.status_code == 404

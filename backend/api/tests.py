"""
Backend tests using pytest-django.
Run with: pytest  (from the backend/ directory)
"""

import pytest
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from api.latex_utils import LATEX_HEADER, build_dynamic_header, normalize_latex_layout
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
def sample_sheet(db, sample_template, auth_client):
    return CheatSheet.objects.create(
        title="My Test Sheet",
        template=sample_template,
        user=auth_client.handler._force_user,  # the user force_authenticate() set
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
    def setUp(self):
        self.user = User.objects.create_user(username="modeluser", password="pass123")

    def test_build_full_latex_wraps_content(self):
        sheet = CheatSheet.objects.create(
            title="Test",
            latex_content="Hello World",
            margins="1in",
            columns=1,
            font_size="10pt",
            user=self.user,
        )
        full = sheet.build_full_latex()
        assert "\\begin{document}" in full
        assert "\\end{document}" in full
        assert "Hello World" in full
        assert "margin=1in" in full
        assert "\\usepackage{adjustbox}" in full

    def test_build_full_latex_multicolumn(self):
        sheet = CheatSheet.objects.create(
            title="Multi-col",
            latex_content="Col content",
            columns=3,
            user=self.user,
        )
        full = sheet.build_full_latex()
        assert "\\usepackage{multicol}" in full
        assert "\\begin{multicols}{3}" in full

    def test_build_full_latex_passthrough(self):
        raw = "\\documentclass{article}\n\\begin{document}\nCustom\n\\end{document}"
        sheet = CheatSheet.objects.create(
            title="Raw",
            latex_content=raw,
            user=self.user,
        )
        assert sheet.build_full_latex() == raw

    def test_build_full_latex_passthrough_inserts_problems_before_document_end(self):
        raw = "\\documentclass{article}\n\\begin{document}\nCustom\n\\end{document}"
        sheet = CheatSheet.objects.create(
            title="Raw With Problems",
            latex_content=raw,
            user=self.user,
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
            user=self.user,
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
            user=self.user,
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
            user=self.user,
        )

        full = sheet.build_full_latex()

        assert "\\documentclass[8pt]{extarticle}" in full

    def test_build_full_latex_custom_font_size_uses_supported_wrapper(self):
        sheet = CheatSheet.objects.create(
            title="Custom Font",
            latex_content="Content",
            font_size="10.5pt",
            user=self.user,
        )

        full = sheet.build_full_latex()

        assert "\\documentclass[10pt]{article}" in full
        assert "\\fontsize{10.5pt}{11.3pt}\\selectfont" in full

    def test_static_latex_header_includes_adjustbox(self):
        assert "\\usepackage{adjustbox}" in LATEX_HEADER


class TestLatexUtils:
    def test_normalize_latex_layout_rewraps_existing_document_with_current_settings(self):
        raw = (
            "\\documentclass{article}\n"
            "\\begin{document}\n"
            "\\footnotesize\n"
            "\\begin{multicols}{2}\n"
            "\\raggedcolumns\n"
            "Body line\n"
            "\\end{multicols}\n"
            "\\end{document}"
        )

        normalized = normalize_latex_layout(raw, columns=4, font_size="8pt", margins="0.5in", spacing="tiny")

        assert "\\documentclass[8pt,fleqn]{extarticle}" in normalized
        assert "margin=0.5in" in normalized
        assert "\\begin{multicols}{4}" in normalized
        assert "\\begin{multicols}{2}" not in normalized
        assert "Body line" in normalized
        assert normalized.count("\\begin{document}") == 1
        assert normalized.count("\\end{document}") == 1

    def test_normalize_latex_layout_replaces_existing_custom_font_multicols_wrapper(self):
        raw = (
            "\\documentclass{article}\n"
            "\\begin{document}\n"
            "\\fontsize{10.5pt}{11.3pt}\\selectfont\n"
            "\\begin{multicols}{5}\n"
            "\\raggedcolumns\n"
            "Body line\n"
            "\\end{multicols}\n"
            "\\end{document}"
        )

        normalized = normalize_latex_layout(raw, columns=5, font_size="10.5pt", margins="0.25in", spacing="0.6pt")

        assert normalized.count("\\fontsize{10.5pt}{11.3pt}\\selectfont") == 1
        assert normalized.count("\\begin{multicols}{5}") == 1
        assert normalized.count("\\end{multicols}") == 1
        assert "Body line" in normalized

    def test_build_dynamic_header_keeps_headers_close_to_body_size(self):
        header = build_dynamic_header(columns=2, font_size="10pt", margins="0.25in", spacing="large")
        assert "\\titleformat{\\section}{\\normalfont\\bfseries\\fontsize{10.8pt}{11.6pt}\\selectfont}{}{0pt}{}" in header
        assert "\\titleformat{\\subsection}{\\normalfont\\bfseries\\fontsize{10.4pt}{11pt}\\selectfont}{}{0pt}{}" in header
        assert "\\titlespacing*{\\section}{0pt}{0pt}{0pt}" in header
        assert "\\titlespacing*{\\subsection}{0pt}{0pt}{0pt}" in header

    def test_build_dynamic_header_accepts_custom_font_and_spacing(self):
        header = build_dynamic_header(columns=5, font_size="10.5pt", margins="0.25in", spacing="0.6pt")
        assert "\\documentclass[10pt,fleqn]{article}" in header
        assert "\\fontsize{10.5pt}{11.3pt}\\selectfont" in header
        assert "\\setlength{\\baselineskip}{11.1pt}" in header
        assert "\\begin{multicols}{5}" in header


# ── API Tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_register_success(api_client):
    payload = {
        "username": "newuser",
        "password": "StrongPass123!",
    }

    response = api_client.post("/api/register/", payload, format="json")

    assert response.status_code in (200, 201)
    assert User.objects.filter(username="newuser").exists()


@pytest.mark.django_db
def test_token_obtain_success_returns_access_and_refresh(api_client):
    User.objects.create_user(username="tokenuser", password="testpass123")

    response = api_client.post(
        "/api/token/",
        {"username": "tokenuser", "password": "testpass123"},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["access"]
    assert response.data["refresh"]


@pytest.mark.django_db
def test_token_refresh_success_returns_new_access_token(api_client):
    User.objects.create_user(username="refreshuser", password="testpass123")
    token_response = api_client.post(
        "/api/token/",
        {"username": "refreshuser", "password": "testpass123"},
        format="json",
    )

    assert token_response.status_code == 200
    assert "refresh" in token_response.data

    refresh_response = api_client.post(
        "/api/token/refresh/",
        {"refresh": token_response.data["refresh"]},
        format="json",
    )

    assert refresh_response.status_code == 200
    assert "access" in refresh_response.data
    assert refresh_response.data["access"]


@pytest.mark.django_db
def test_token_obtain_invalid_credentials_fail(api_client):
    User.objects.create_user(username="badloginuser", password="rightpass123")

    response = api_client.post(
        "/api/token/",
        {"username": "badloginuser", "password": "wrongpass123"},
        format="json",
    )

    assert response.status_code in (400, 401)
    assert "access" not in response.data
    assert "refresh" not in response.data


@pytest.mark.django_db
def test_token_refresh_invalid_token_fails(api_client):
    response = api_client.post(
        "/api/token/refresh/",
        {"refresh": "invalid.refresh.token"},
        format="json",
    )

    assert response.status_code in (400, 401)
    assert "access" not in response.data


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
class TestCheatSheetAccessControl:
    """Ensure users cannot access or modify another user's cheat sheets."""

    @pytest.fixture
    def other_user(self, db):
        return User.objects.create_user(username="otheruser", password="otherpass123")

    @pytest.fixture
    def other_client(self, other_user):
        client = APIClient()
        client.force_authenticate(user=other_user)
        return client

    def test_list_does_not_return_other_users_sheets(
        self, auth_client, other_client, sample_sheet
    ):
        """User B should not see User A's sheets in list response."""
        resp = other_client.get("/api/cheatsheets/")
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert sample_sheet.id not in ids

    def test_retrieve_other_users_sheet_returns_404(
        self, other_client, sample_sheet
    ):
        """User B should get 404 when retrieving User A's sheet by ID."""
        resp = other_client.get(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 404

    def test_update_other_users_sheet_returns_404(
        self, other_client, sample_sheet
    ):
        """User B should get 404 when updating User A's sheet."""
        resp = other_client.patch(
            f"/api/cheatsheets/{sample_sheet.id}/",
            {"title": "Hacked"},
            format="json",
        )
        assert resp.status_code == 404

    def test_delete_other_users_sheet_returns_404(
        self, other_client, sample_sheet
    ):
        """User B should get 404 when deleting User A's sheet."""
        resp = other_client.delete(f"/api/cheatsheets/{sample_sheet.id}/")
        assert resp.status_code == 404

    def test_compile_other_users_sheet_returns_404(
        self, other_client, sample_sheet
    ):
        """User B should get 404 when compiling User A's sheet via cheat_sheet_id."""
        resp = other_client.post(
            "/api/compile/",
            {"cheat_sheet_id": sample_sheet.id},
            format="json",
        )
        assert resp.status_code == 404


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

    def test_generate_sheet_accepts_legacy_category_name_when_formula_name_matches(self, auth_client):
        """Saved sheets with renamed categories should still generate by formula name."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [
                    {
                        "class": "CALCULUS III",
                        "category": "Vector Calculus",
                        "name": "Divergence",
                    }
                ]
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Vector Formulas}" in tex
        assert "\\textbf{Divergence}" in tex

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

    def test_generate_sheet_with_five_columns(self, auth_client):
        """Five-column layouts should be allowed."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "columns": 5,
            },
            format="json",
        )
        assert resp.status_code == 200
        assert "\\begin{multicols}{5}" in resp.json()["tex_code"]

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
        assert "\\fontsize{8pt}{8.8pt}\\selectfont" in tex

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
        assert "\\setlength{\\baselineskip}{10.2pt}" in tex

    def test_generate_sheet_with_custom_font_size(self, auth_client):
        """Custom pt body sizes should be accepted."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "font_size": "10.5pt",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\fontsize{10.5pt}{11.3pt}\\selectfont" in tex

    def test_generate_sheet_with_custom_spacing(self, auth_client):
        """Custom pt spacing values should be accepted."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
                "spacing": "0.6pt",
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\setlength{\\baselineskip}{10.6pt}" in tex
        assert "\\vspace{0.6pt}" in tex

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
        assert "\\titlespacing*{\\section}{0pt}{0pt}{0pt}" in tex
        assert "\\titlespacing*{\\subsection}{0pt}{0pt}{0pt}" in tex
        assert "\\setlength{\\baselineskip}{11.2pt}" in tex

    def test_generate_sheet_10pt_uses_smaller_subsection_titles(self, auth_client):
        """Subsection titles should stay only slightly larger than the body text."""
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
        assert "\\titleformat{\\subsection}{\\normalfont\\bfseries\\fontsize{10.4pt}{11pt}\\selectfont}{}{0pt}{}" in tex

    def test_generate_sheet_adds_readable_block_comments(self, auth_client):
        """Generated LaTeX should include readable source comments around blocks."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "% ===== BEGIN CLASS: ALGEBRA I =====" in tex
        assert "% ===== BEGIN CATEGORY: Linear Equations =====" in tex
        assert "% Formula Block: Slope Formula" in tex
        assert "% ===== END CATEGORY: Linear Equations =====" in tex
        assert "% ===== END CLASS: ALGEBRA I =====" in tex

    def test_generate_sheet_uses_regrouped_calc_three_vector_formulas(self, auth_client):
        """Calc III vector formulas should share one combined category."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "CALCULUS III", "category": "Vector Formulas", "name": "Dot Product"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Vector Formulas}" in tex
        assert "% ===== BEGIN CATEGORY: Vector Formulas =====" in tex
        assert "\\textbf{Dot Product}" in tex

    def test_generate_sheet_uses_regrouped_pre_algebra_fraction_category(self, auth_client):
        """Pre-algebra ratios/proportions should live under the merged fractions category."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "PRE-ALGEBRA", "category": "Fractions, Ratios, and Proportions", "name": "Unit Rate"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Fractions, Ratios, and Proportions}" in tex
        assert "\\textbf{Unit Rate}" in tex

    def test_generate_sheet_uses_regrouped_trig_foundation_category(self, auth_client):
        """Trig foundations taught together should be available under the broader grouped heading."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "TRIGONOMETRY", "category": "Special Triangles and Basic Trig Relationships", "name": "Primary Identity"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Special Triangles and Basic Trig Relationships}" in tex
        assert "\\textbf{Primary Identity}" in tex

    def test_generate_sheet_uses_regrouped_calc_one_theorem_category(self, auth_client):
        """Calc I theorem lookups should use the merged theorem category."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "CALCULUS I", "category": "Core Theorems of Calculus", "name": "Part 1 (Leibniz)"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Core Theorems of Calculus}" in tex
        assert "Part 1 (Leibniz)" in tex

    def test_generate_sheet_uses_regrouped_calc_two_integration_category(self, auth_client):
        """Calc II improper integral formulas should live under the broader integration category."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "CALCULUS II", "category": "Integration Techniques and Improper Integrals", "name": "Infinite Upper Bound"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Integration Techniques and Improper Integrals}" in tex
        assert "\\textbf{Infinite Upper Bound}" in tex

    def test_generate_sheet_uses_regrouped_calc_three_partial_derivative_category(self, auth_client):
        """Calc III optimization formulas should share the partial-derivatives grouping."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "CALCULUS III", "category": "Partial Derivatives and Optimization", "name": "Lagrange Multipliers"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Partial Derivatives and Optimization}" in tex
        assert "\\textbf{Lagrange Multipliers}" in tex

    def test_generate_sheet_uses_regrouped_algebra_two_polynomial_category(self, auth_client):
        """Algebra II binomial formulas should live under the broader polynomial category."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "ALGEBRA II", "category": "Polynomial Theorems and Binomial Expansion", "name": "Expansion"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Polynomial Theorems and Binomial Expansion}" in tex
        assert "\\textbf{Expansion}" in tex

    def test_generate_sheet_uses_regrouped_precalculus_sequence_category(self, auth_client):
        """Precalculus binomial formulas should share the sequences-and-series grouping."""
        resp = auth_client.post(
            "/api/generate-sheet/",
            {
                "formulas": [{"class": "PRECALCULUS", "category": "Sequences, Series, and Binomial Theorem", "name": "Binomial Expansion"}],
            },
            format="json",
        )
        assert resp.status_code == 200
        tex = resp.json()["tex_code"]
        assert "\\subsection*{Sequences, Series, and Binomial Theorem}" in tex
        assert "\\textbf{Binomial Expansion}" in tex

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

    def test_compile_requires_content_or_id_for_anonymous_users(self, api_client):
        resp = api_client.post("/api/compile/", {}, format="json")
        assert resp.status_code == 400

    def test_compile_with_nonexistent_sheet(self, auth_client):
        resp = auth_client.post(
            "/api/compile/",
            {"cheat_sheet_id": 99999},
            format="json",
        )
        assert resp.status_code == 404


# ── Auth Endpoint Tests ──────────────────────────────────────────────


@pytest.mark.django_db
class TestRegisterEndpoint:
    def test_register_success(self, api_client):
        resp = api_client.post(
            "/api/register/",
            {"username": "newuser", "password": "Str0ng!Pass99"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newuser"
        assert "password" not in data

    def test_register_duplicate_username(self, api_client, db):
        User.objects.create_user(username="existing", password="pass1234!")
        resp = api_client.post(
            "/api/register/",
            {"username": "existing", "password": "Str0ng!Pass99"},
            format="json",
        )
        assert resp.status_code == 400

    def test_register_weak_password(self, api_client):
        resp = api_client.post(
            "/api/register/",
            {"username": "weakuser", "password": "123"},
            format="json",
        )
        assert resp.status_code == 400
        assert "password" in resp.json()

    def test_register_common_password(self, api_client):
        resp = api_client.post(
            "/api/register/",
            {"username": "commonuser", "password": "password"},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestTokenEndpoints:
    def test_token_obtain_success(self, api_client, db):
        User.objects.create_user(username="jwtuser", password="Str0ng!Pass99")
        resp = api_client.post(
            "/api/token/",
            {"username": "jwtuser", "password": "Str0ng!Pass99"},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access" in data
        assert "refresh" in data

    def test_token_obtain_invalid_credentials(self, api_client, db):
        User.objects.create_user(username="jwtuser2", password="Str0ng!Pass99")
        resp = api_client.post(
            "/api/token/",
            {"username": "jwtuser2", "password": "wrongpassword"},
            format="json",
        )
        assert resp.status_code == 401

    def test_token_refresh_success(self, api_client, db):
        User.objects.create_user(username="refreshuser", password="Str0ng!Pass99")
        token_resp = api_client.post(
            "/api/token/",
            {"username": "refreshuser", "password": "Str0ng!Pass99"},
            format="json",
        )
        refresh_token = token_resp.json()["refresh"]
        resp = api_client.post(
            "/api/token/refresh/",
            {"refresh": refresh_token},
            format="json",
        )
        assert resp.status_code == 200
        assert "access" in resp.json()

    def test_token_refresh_invalid_token(self, api_client):
        resp = api_client.post(
            "/api/token/refresh/",
            {"refresh": "not-a-valid-token"},
            format="json",
        )
        assert resp.status_code == 401

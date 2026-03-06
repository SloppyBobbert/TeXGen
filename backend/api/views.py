from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import FileResponse
import subprocess
import tempfile
import os


# ------------------------------------------------------------------
# All formula blocks live here in the backend. The frontend never
# stores any LaTeX. Each class maps to a dict of categories, and
# each category is a list of { name, latex } entries.
# ------------------------------------------------------------------
FORMULA_DATA = {
    "Algebra": {
        "Linear Equations": [
            {"name": "Slope-Intercept", "latex": "y = mx + b"},
            {"name": "Point-Slope", "latex": "y - y_1 = m(x - x_1)"},
            {"name": "Standard Form", "latex": "Ax + By = C"},
        ],
        "Quadratic Equations": [
            {"name": "Quadratic Formula", "latex": "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"},
            {"name": "Vertex Form", "latex": "y = a(x-h)^2 + k"},
            {"name": "Standard Form", "latex": "y = ax^2 + bx + c"},
        ],
        "Exponents": [
            {"name": "Product Rule", "latex": "x^a \\cdot x^b = x^{a+b}"},
            {"name": "Quotient Rule", "latex": "\\frac{x^a}{x^b} = x^{a-b}"},
            {"name": "Power Rule", "latex": "(x^a)^b = x^{ab}"},
            {"name": "Negative Exponent", "latex": "x^{-a} = \\frac{1}{x^a}"},
        ],
        "Logarithms": [
            {"name": "Product Rule", "latex": "\\log_b(xy) = \\log_b(x) + \\log_b(y)"},
            {"name": "Quotient Rule", "latex": "\\log_b\\left(\\frac{x}{y}\\right) = \\log_b(x) - \\log_b(y)"},
            {"name": "Power Rule", "latex": "\\log_b(x^k) = k \\log_b(x)"},
            {"name": "Change of Base", "latex": "\\log_b(x) = \\frac{\\log_c(x)}{\\log_c(b)}"},
        ],
    },
    "Geometry": {
        "Area": [
            {"name": "Circle", "latex": "A = \\pi r^2"},
            {"name": "Triangle", "latex": "A = \\frac{1}{2}bh"},
            {"name": "Rectangle", "latex": "A = lw"},
        ],
        "Perimeter": [
            {"name": "Circle (Circumference)", "latex": "C = 2\\pi r"},
            {"name": "Rectangle", "latex": "P = 2l + 2w"},
        ],
        "Volume": [
            {"name": "Sphere", "latex": "V = \\frac{4}{3}\\pi r^3"},
            {"name": "Cylinder", "latex": "V = \\pi r^2 h"},
            {"name": "Cone", "latex": "V = \\frac{1}{3}\\pi r^2 h"},
        ],
    },
    "Calculus": {
        "Derivatives": [
            {"name": "Power Rule", "latex": "\\frac{d}{dx} x^n = nx^{n-1}"},
            {"name": "Product Rule", "latex": "\\frac{d}{dx}[fg] = f'g + fg'"},
            {"name": "Quotient Rule", "latex": "\\frac{d}{dx}\\left[\\frac{f}{g}\\right] = \\frac{f'g - fg'}{g^2}"},
            {"name": "Chain Rule", "latex": "\\frac{d}{dx} f(g(x)) = f'(g(x)) \\cdot g'(x)"},
        ],
        "Integrals": [
            {"name": "Power Rule", "latex": "\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C"},
            {"name": "Substitution", "latex": "\\int f(g(x)) g'(x) \\, dx = \\int f(u) \\, du"},
        ],
        "Limits": [
            {"name": "Definition", "latex": "\\lim_{x \\to a} f(x) = L"},
            {"name": "L'Hopital's Rule", "latex": "\\lim_{x \\to a} \\frac{f(x)}{g(x)} = \\lim_{x \\to a} \\frac{f'(x)}{g'(x)}"},
        ],
    },
    "Trigonometry": {
        "Basic Identities": [
            {"name": "Pythagorean", "latex": "\\sin^2\\theta + \\cos^2\\theta = 1"},
            {"name": "Tangent", "latex": "\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}"},
        ],
        "Common Values": [
            {"name": "sin(0)", "latex": "\\sin(0) = 0"},
            {"name": "sin(pi/6)", "latex": "\\sin\\left(\\frac{\\pi}{6}\\right) = \\frac{1}{2}"},
            {"name": "sin(pi/4)", "latex": "\\sin\\left(\\frac{\\pi}{4}\\right) = \\frac{\\sqrt{2}}{2}"},
            {"name": "sin(pi/3)", "latex": "\\sin\\left(\\frac{\\pi}{3}\\right) = \\frac{\\sqrt{3}}{2}"},
            {"name": "sin(pi/2)", "latex": "\\sin\\left(\\frac{\\pi}{2}\\right) = 1"},
        ],
        "Double Angle": [
            {"name": "sin(2x)", "latex": "\\sin(2\\theta) = 2\\sin\\theta\\cos\\theta"},
            {"name": "cos(2x)", "latex": "\\cos(2\\theta) = \\cos^2\\theta - \\sin^2\\theta"},
        ],
    },
}


def _build_latex_for_classes(selected_classes):
    """
    Given a list of class names (e.g. ["Algebra", "Calculus"]),
    build a complete LaTeX document string with all their formula blocks.
    """
    body_lines = []

    idx = 0
    while idx < len(selected_classes):
        class_name = selected_classes[idx]
        categories = FORMULA_DATA.get(class_name)
        if categories is None:
            idx += 1
            continue

        body_lines.append("\\section{" + class_name + "}")
        body_lines.append("")

        cat_names = list(categories.keys())
        cat_idx = 0
        while cat_idx < len(cat_names):
            cat_name = cat_names[cat_idx]
            formulas = categories[cat_name]

            body_lines.append("\\subsection{" + cat_name + "}")
            body_lines.append("")

            f_idx = 0
            while f_idx < len(formulas):
                formula = formulas[f_idx]
                body_lines.append("\\textbf{" + formula["name"] + "}")
                body_lines.append("\\[ " + formula["latex"] + " \\]")
                body_lines.append("")
                f_idx += 1

            cat_idx += 1

        idx += 1

    body = "\n".join(body_lines)

    tex = (
        "\\documentclass{article}\n"
        "\\usepackage[utf8]{inputenc}\n"
        "\\usepackage{amsmath, amssymb}\n"
        "\\usepackage[a4paper, margin=1in]{geometry}\n"
        "\\begin{document}\n\n"
        + body
        + "\n\\end{document}"
    )

    return tex


# ------------------------------------------------------------------
# API endpoints
# ------------------------------------------------------------------

@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def get_classes(request):
    """
    GET /api/classes/
    Returns the list of available class names for the dropdown.
    """
    class_names = list(FORMULA_DATA.keys())
    return Response({"classes": class_names})


@api_view(["POST"])
def generate_sheet(request):
    """
    POST /api/generate-sheet/
    Accepts { "classes": ["Algebra", "Calculus"] }
    Returns { "tex_code": "\\documentclass{article}..." }
    """
    selected = request.data.get("classes", [])

    if not selected:
        return Response({"error": "No classes selected"}, status=400)

    tex_code = _build_latex_for_classes(selected)
    return Response({"tex_code": tex_code})


@api_view(["POST"])
def compile_latex(request):
    """
    POST /api/compile/
    Accepts { "content": "...full LaTeX code..." }
    Compiles with Tectonic on the backend and returns the PDF.
    """
    content = request.data.get("content", "")

    if r"\begin{document}" not in content:
        content = (
            "\\documentclass{article}\n"
            "\\usepackage[utf8]{inputenc}\n"
            "\\usepackage{amsmath, amssymb, geometry}\n"
            "\\geometry{a4paper, margin=1in}\n"
            "\\begin{document}\n"
            + content
            + "\n\\end{document}"
        )

    with tempfile.TemporaryDirectory() as tempdir:
        tex_file_path = os.path.join(tempdir, "document.tex")
        with open(tex_file_path, "w", encoding="utf-8") as f:
            f.write(content)

        try:
            subprocess.run(
                ["tectonic", tex_file_path],
                cwd=tempdir,
                capture_output=True,
                text=True,
                check=True,
            )
        except subprocess.CalledProcessError as e:
            return Response(
                {"error": "Failed to compile LaTeX", "details": e.stderr},
                status=400,
            )

        pdf_file_path = os.path.join(tempdir, "document.pdf")
        if os.path.exists(pdf_file_path):
            response = FileResponse(
                open(pdf_file_path, "rb"), content_type="application/pdf"
            )
            response["Content-Disposition"] = 'inline; filename="document.pdf"'
            return response
        else:
            return Response({"error": "PDF not generated"}, status=500)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import FileResponse
from django.shortcuts import get_object_or_404
import subprocess
import tempfile
import os

from .models import Template, CheatSheet, PracticeProblem
from .serializers import TemplateSerializer, CheatSheetSerializer, PracticeProblemSerializer
from .formula_data import get_formula_data, get_classes_with_details


# ------------------------------------------------------------------
# LaTeX document template with all packages
# ------------------------------------------------------------------
LATEX_HEADER = r"""\documentclass[fleqn]{article}
\usepackage[margin=0.15in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{enumitem} 
\usepackage{multicol}
\usepackage{titlesec}

\setlength{\mathindent}{0pt}
\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}
\pagestyle{empty}

\titlespacing*{\subsection}{0pt}{2pt}{1pt}
\titlespacing*{\section}{0pt}{4pt}{2pt}

\begin{document}
\scriptsize
"""

LATEX_FOOTER = r"""
\end{document}
"""


def _build_latex_for_formulas(selected_formulas):
    """
    Given a list of selected formulas (each with class_name, category, name, latex),
    build a complete LaTeX document.
    """
    body_lines = []
    
    # Group formulas by class
    by_class = {}
    for formula in selected_formulas:
        class_name = formula.get("class_name") or formula.get("class")
        if class_name not in by_class:
            by_class[class_name] = {}
        
        category = formula.get("category")
        if category not in by_class[class_name]:
            by_class[class_name][category] = []
        
        by_class[class_name][category].append(formula)
    
    # Build LaTeX for each class
    for class_name, categories in by_class.items():
        body_lines.append("\\section*{" + class_name + "}")
        body_lines.append("")
        
        for category_name, formulas in categories.items():
            body_lines.append("\\subsection*{" + category_name + "}")
            body_lines.append("")
            body_lines.append(r"\begin{flushleft}")
            
            for formula in formulas:
                name = formula.get("name", "")
                latex = formula.get("latex", "")
                body_lines.append("\\textbf{" + name + "}")
                body_lines.append("\\[ " + latex + " \\]")
                body_lines.append("\\\\[4pt]")
            
            body_lines.append(r"\end{flushleft}")
            body_lines.append("")
    
    body = "\n".join(body_lines)
    return LATEX_HEADER + body + LATEX_FOOTER


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
    Returns full structure with classes, categories, and formulas.
    Used by frontend to build 3-level selection UI.
    """
    classes_with_details = get_classes_with_details()
    return Response({"classes": classes_with_details})


@api_view(["POST"])
def generate_sheet(request):
    """
    POST /api/generate-sheet/
    Accepts { "formulas": [...] }
    Each formula: { "class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula" }
    Or can also use: { "class_name", "category", "name" }
    Returns { "tex_code": "..." }
    """
    selected = request.data.get("formulas", [])
    
    if not selected:
        return Response({"error": "No formulas selected"}, status=400)
    
    # Get formula details from formula_data
    formula_data = get_formula_data()
    selected_formulas = []
    
    for sel in selected:
        class_name = sel.get("class") or sel.get("class_name")
        category = sel.get("category")
        name = sel.get("name")
        
        if class_name in formula_data:
            categories = formula_data[class_name]
            if category in categories:
                formulas = categories[category]
                for f in formulas:
                    if f.get("name") == name:
                        selected_formulas.append({
                            "class_name": class_name,
                            "category": category,
                            "name": f["name"],
                            "latex": f["latex"]
                        })
    
    if not selected_formulas:
        return Response({"error": "No valid formulas found"}, status=400)
    
    tex_code = _build_latex_for_formulas(selected_formulas)
    return Response({"tex_code": tex_code})


@api_view(["POST"])
def compile_latex(request):
    """
    POST /api/compile/
    Accepts either:
      - { "content": "...full LaTeX code..." }
      - { "cheat_sheet_id": 123 }
    Compiles with Tectonic on the backend and returns the PDF.
    """
    content = request.data.get("content", "")
    cheat_sheet_id = request.data.get("cheat_sheet_id")
    
    # If cheat_sheet_id is provided, get content from the cheat sheet
    if cheat_sheet_id:
        cheatsheet = get_object_or_404(CheatSheet, pk=cheat_sheet_id)
        content = cheatsheet.build_full_latex()
    
    if not content:
        return Response({"error": "No LaTeX content provided"}, status=400)
    
    # Ensure document has proper structure
    if r"\begin{document}" not in content:
        content = LATEX_HEADER + content + LATEX_FOOTER
    
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


# ------------------------------------------------------------------
# CRUD API endpoints for Templates, CheatSheets, and Problems
# ------------------------------------------------------------------

@api_view(["GET", "POST"])
def template_list(request):
    """GET /api/templates/ - List all templates
       POST /api/templates/ - Create a new template"""
    if request.method == "GET":
        subject = request.query_params.get("subject")
        templates = Template.objects.all()
        if subject:
            templates = templates.filter(subject=subject)
        serializer = TemplateSerializer(templates, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = TemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def template_detail(request, pk):
    """GET/PUT/PATCH/DELETE /api/templates/{id}/"""
    template = get_object_or_404(Template, pk=pk)
    
    if request.method == "GET":
        serializer = TemplateSerializer(template)
        return Response(serializer.data)
    
    elif request.method in ["PUT", "PATCH"]:
        serializer = TemplateSerializer(template, data=request.data, partial=(request.method == "PATCH"))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == "DELETE":
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def cheatsheet_list(request):
    """GET /api/cheatsheets/ - List all cheat sheets
       POST /api/cheatsheets/ - Create a new cheat sheet"""
    if request.method == "GET":
        cheatsheets = CheatSheet.objects.all()
        serializer = CheatSheetSerializer(cheatsheets, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = CheatSheetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def cheatsheet_from_template(request):
    """POST /api/cheatsheets/from-template/ - Create cheat sheet from template"""
    template_id = request.data.get("template_id")
    title = request.data.get("title", "Untitled")
    
    if not template_id:
        return Response({"error": "template_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    template = get_object_or_404(Template, pk=template_id)
    
    cheatsheet = CheatSheet.objects.create(
        title=title,
        template=template,
        latex_content=template.latex_content,
        margins=template.default_margins,
        columns=template.default_columns,
    )
    
    serializer = CheatSheetSerializer(cheatsheet)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def cheatsheet_detail(request, pk):
    """GET/PUT/PATCH/DELETE /api/cheatsheets/{id}/"""
    cheatsheet = get_object_or_404(CheatSheet, pk=pk)
    
    if request.method == "GET":
        serializer = CheatSheetSerializer(cheatsheet)
        return Response(serializer.data)
    
    elif request.method in ["PUT", "PATCH"]:
        serializer = CheatSheetSerializer(cheatsheet, data=request.data, partial=(request.method == "PATCH"))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == "DELETE":
        cheatsheet.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def problem_list(request):
    """GET /api/problems/ - List problems (optionally filtered by cheat_sheet)
       POST /api/problems/ - Create a new problem"""
    if request.method == "GET":
        cheat_sheet_id = request.query_params.get("cheat_sheet")
        if cheat_sheet_id:
            problems = PracticeProblem.objects.filter(cheat_sheet=cheat_sheet_id)
        else:
            problems = PracticeProblem.objects.all()
        serializer = PracticeProblemSerializer(problems, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = PracticeProblemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def problem_detail(request, pk):
    """GET/PUT/PATCH/DELETE /api/problems/{id}/"""
    problem = get_object_or_404(PracticeProblem, pk=pk)
    
    if request.method == "GET":
        serializer = PracticeProblemSerializer(problem)
        return Response(serializer.data)
    
    elif request.method in ["PUT", "PATCH"]:
        serializer = PracticeProblemSerializer(problem, data=request.data, partial=(request.method == "PATCH"))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == "DELETE":
        problem.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.http import FileResponse
from django.shortcuts import get_object_or_404
import subprocess
import tempfile
import os

from .models import Template, CheatSheet, PracticeProblem
from .serializers import TemplateSerializer, CheatSheetSerializer, PracticeProblemSerializer
from .formula_data import get_formula_data, get_classes_with_details
from .latex_utils import build_latex_for_formulas, LATEX_HEADER, LATEX_FOOTER

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
    
    tex_code = build_latex_for_formulas(selected_formulas)
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
# CRUD API ViewSets for Templates, CheatSheets, and Problems
# ------------------------------------------------------------------

class TemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Templates
    Get/Post/Put/Delete /api/templates/
    """
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subject=subject)
        return queryset


class CheatSheetViewSet(viewsets.ModelViewSet):
    """
    CRUD API for CheatSheets
    Get/Post/Put/Delete /api/cheatsheets/
    """
    queryset = CheatSheet.objects.all()
    serializer_class = CheatSheetSerializer

    @action(detail=False, methods=['post'], url_path='from-template')
    def from_template(self, request):
        """
        POST /api/cheatsheets/from-template/ 
        Create cheat sheet from template
        """
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
        
        serializer = self.get_serializer(cheatsheet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PracticeProblemViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Practice Problems
    Get/Post/Put/Delete /api/problems/
    """
    queryset = PracticeProblem.objects.all()
    serializer_class = PracticeProblemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        cheat_sheet_id = self.request.query_params.get('cheat_sheet')
        if cheat_sheet_id:
            queryset = queryset.filter(cheat_sheet=cheat_sheet_id)
        return queryset

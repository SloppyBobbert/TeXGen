from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import viewsets, status
from django.http import FileResponse
import subprocess
import tempfile
import os

from .models import Template, CheatSheet, PracticeProblem
from .serializers import (
    TemplateSerializer,
    CheatSheetSerializer,
    PracticeProblemSerializer,
    CompileRequestSerializer,
)


# ---------------------------------------------------------------------------
# Standalone function-based views
# ---------------------------------------------------------------------------

@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def compile_latex(request):
    """Compile raw LaTeX content or a saved CheatSheet into a PDF."""
    serializer = CompileRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    content = serializer.validated_data.get("content", "")
    cheat_sheet_id = serializer.validated_data.get("cheat_sheet_id")

    # Build from a saved cheat sheet if an id was provided
    if cheat_sheet_id:
        try:
            sheet = CheatSheet.objects.get(id=cheat_sheet_id)
            content = sheet.build_full_latex()
        except CheatSheet.DoesNotExist:
            return Response(
                {"error": "CheatSheet not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    # Wrap raw content if it isn't already a full document
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
            result = subprocess.run(
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


@api_view(["POST"])
def create_from_template(request):
    """Create a new CheatSheet pre-populated from a Template."""
    template_id = request.data.get("template_id")
    title = request.data.get("title", "Untitled Cheat Sheet")

    try:
        template = Template.objects.get(id=template_id)
    except Template.DoesNotExist:
        return Response(
            {"error": "Template not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    cheat_sheet = CheatSheet.objects.create(
        title=title,
        latex_content=template.latex_content,
        template=template,
        columns=template.default_columns,
        margins=template.default_margins,
    )

    out = CheatSheetSerializer(cheat_sheet)
    return Response(out.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# ViewSets (registered via the DefaultRouter in urls.py)
# ---------------------------------------------------------------------------

class TemplateViewSet(viewsets.ModelViewSet):
    """CRUD for pre-made Templates."""
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer


class CheatSheetViewSet(viewsets.ModelViewSet):
    """CRUD for user CheatSheets."""
    queryset = CheatSheet.objects.all()
    serializer_class = CheatSheetSerializer


class PracticeProblemViewSet(viewsets.ModelViewSet):
    """CRUD for practice problems attached to a CheatSheet."""
    queryset = PracticeProblem.objects.all()
    serializer_class = PracticeProblemSerializer

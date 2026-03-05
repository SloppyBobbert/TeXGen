from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import FileResponse
import subprocess
import tempfile
import os

@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})

@api_view(["POST"])
def compile_latex(request):
    content = request.data.get("content", "")
    
    # Simple boilerplate to ensure it's a valid document if user just provides text
    if r"\begin{document}" not in content:
        content = r"""\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath, amssymb, geometry}
\geometry{a4paper, margin=1in}
\begin{document}
""" + content + r"""
\end{document}"""

    # Create a temporary directory to run tectonic
    with tempfile.TemporaryDirectory() as tempdir:
        tex_file_path = os.path.join(tempdir, "document.tex")
        with open(tex_file_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        try:
            # Run tectonic
            # VScode will say result is unused but we need to capture it to check for errors, so ignore that warning
            result = subprocess.run(
                ["tectonic", tex_file_path],
                cwd=tempdir,
                capture_output=True,
                text=True,
                check=True
            )
        except subprocess.CalledProcessError as e:
            return Response({"error": "Failed to compile LaTeX", "details": e.stderr}, status=400)
            
        pdf_file_path = os.path.join(tempdir, "document.pdf")
        if os.path.exists(pdf_file_path):
            response = FileResponse(open(pdf_file_path, "rb"), content_type="application/pdf")
            response["Content-Disposition"] = 'inline; filename="document.pdf"'
            return response
        else:
            return Response({"error": "PDF not generated"}, status=500)

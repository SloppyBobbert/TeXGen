import subprocess
import tempfile
import os

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

def build_latex_for_formulas(selected_formulas):
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

def compile_latex_to_pdf(content):
    """
    Compiles LaTeX content to a PDF using Tectonic.
    Returns the path to the generated PDF file or raises an Exception.
    """
    # Ensure document has proper structure
    if r"\begin{document}" not in content:
        content = LATEX_HEADER + content + LATEX_FOOTER
        
    tempdir_obj = tempfile.TemporaryDirectory()
    tempdir = tempdir_obj.name
    
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
        # Keep a reference to tempdir_obj to prevent deletion if needed, but we typically want it returned or cleaned up
        raise e
        
    pdf_file_path = os.path.join(tempdir, "document.pdf")
    if os.path.exists(pdf_file_path):
        return pdf_file_path, tempdir_obj
    else:
        raise FileNotFoundError("PDF not generated")

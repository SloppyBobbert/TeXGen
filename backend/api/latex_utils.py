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
    if not selected_formulas:
        return LATEX_HEADER + LATEX_FOOTER
    
    body_lines = []
    current_class = None
    current_category = None
    in_flushleft = False
    
    for formula in selected_formulas:
        class_name = formula.get("class_name") or formula.get("class", "")
        category = formula.get("category", "")
        name = formula.get("name", "")
        latex = formula.get("latex", "")
        
        if class_name != current_class:
            if in_flushleft:
                body_lines.append(r"\end{flushleft}")
                in_flushleft = False
            if current_class is not None:
                body_lines.append("")
            escaped_class = class_name.replace("&", "\\&")
            body_lines.append("\\section*{" + escaped_class + "}")
            body_lines.append("")
            current_class = class_name
            current_category = None
        
        if category != current_category:
            is_special = (category == class_name)
            if in_flushleft and not is_special:
                body_lines.append(r"\end{flushleft}")
                in_flushleft = False
            if not is_special:
                escaped_category = category.replace("&", "\\&")
                body_lines.append("\\subsection*{" + escaped_category + "}")
                body_lines.append("")
                body_lines.append(r"\begin{flushleft}")
                in_flushleft = True
            current_category = category
        
        if category == class_name:
            body_lines.append(latex)
        else:
            # Escape special LaTeX characters in the formula name
            escaped_name = name.replace("\\", "\\textbackslash ").replace("&", "\\&").replace("%", "\\%").replace("#", "\\#").replace("_", "\\_").replace("^", "\\textasciicircum ").replace("{", "\\{").replace("}", "}")
            body_lines.append("\\textbf{" + escaped_name + "}")
            body_lines.append("\\[ " + latex + " \\]")
            body_lines.append("\\\\[4pt]")
    
    if in_flushleft:
        body_lines.append(r"\end{flushleft}")
    
    body = "\n".join(body_lines)
    return LATEX_HEADER + body + LATEX_FOOTER

def compile_latex_to_pdf(content):
    """
    Compiles LaTeX content to a PDF using Tectonic.
    Returns the generated PDF as bytes or raises an Exception.
    """
    # Ensure document has proper structure
    if r"\begin{document}" not in content:
        content = LATEX_HEADER + content + LATEX_FOOTER

    # Use a context manager so the temporary directory is always cleaned up
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
        except subprocess.CalledProcessError:
            # Propagate the error; the temporary directory will still be cleaned up
            raise

        pdf_file_path = os.path.join(tempdir, "document.pdf")
        if not os.path.exists(pdf_file_path):
            raise FileNotFoundError("PDF not generated")

        # Read and return the PDF bytes before the temporary directory is removed
        with open(pdf_file_path, "rb") as pdf_file:
            return pdf_file.read()

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

# Font size to LaTeX size command mapping for cheat sheet density
FONT_SIZE_MAP = {
    "8pt": "\\tiny",
    "9pt": "\\scriptsize", 
    "10pt": "\\footnotesize",
    "11pt": "\\small",
    "12pt": "\\normalsize",
}

# Spacing presets: (section_before, section_after, subsection_before, subsection_after, formula_spacing)
SPACING_MAP = {
    "tiny": ("0pt", "0pt", "0pt", "0pt", "0pt"),
    "small": ("2pt", "1pt", "1pt", "0.5pt", "2pt"),
    "medium": ("8pt", "4pt", "4pt", "2pt", "8pt"),
    "large": ("16pt", "8pt", "8pt", "4pt", "16pt"),
}


def build_dynamic_header(columns=2, font_size="10pt", margins="0.25in", spacing="large"):
    """
    Build a dynamic LaTeX header based on user-selected options.
    """
    size_command = FONT_SIZE_MAP.get(font_size, "\\footnotesize")
    sec_before, sec_after, subsec_before, subsec_after, _ = SPACING_MAP.get(spacing, SPACING_MAP["large"])

    # The standard `article` class only supports 10pt/11pt/12pt.
    # Use `extarticle` (from the extsizes package) for 8pt and 9pt.
    doc_class = "extarticle" if font_size in ("8pt", "9pt") else "article"

    header_lines = [
        f"\\documentclass[{font_size},fleqn]{{{doc_class}}}",
        f"\\usepackage[margin={margins}]{{geometry}}",
        "\\usepackage{amsmath, amssymb}",
        "\\usepackage{enumitem}",
        "\\usepackage{multicol}",
        "\\usepackage{titlesec}",
        "\\usepackage{adjustbox}",  # For auto-scaling equations to fit column width
        "",
        "\\setlength{\\mathindent}{0pt}",
        "\\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}",
        "\\pagestyle{empty}",
        "",
        "\\titleformat{\\section}{\\normalfont\\footnotesize\\bfseries}{}{0pt}{}",
        "\\titleformat{\\subsection}{\\normalfont\\scriptsize\\bfseries}{}{0pt}{}",
        f"\\titlespacing*{{\\section}}{{0pt}}{{{sec_before}}}{{{sec_after}}}",
        f"\\titlespacing*{{\\subsection}}{{0pt}}{{{subsec_before}}}{{{subsec_after}}}",
        "",
        "\\begin{document}",
        size_command,
    ]
    
    if columns > 1:
        header_lines.append(f"\\begin{{multicols}}{{{columns}}}")
        header_lines.append("\\raggedcolumns")
    
    header_lines.append("")
    return "\n".join(header_lines)


def build_dynamic_footer(columns=2):
    """
    Build a dynamic LaTeX footer based on user-selected options.
    """
    footer_lines = []
    
    if columns > 1:
        footer_lines.append("\\end{multicols}")
    
    footer_lines.append("\\end{document}")
    return "\n".join(footer_lines)


def build_latex_for_formulas(selected_formulas, columns=2, font_size="10pt", margins="0.25in", spacing="large"):
    """
    Given a list of selected formulas (each with class_name, category, name, latex),
    build a complete LaTeX document.
    """
    header = build_dynamic_header(columns, font_size, margins, spacing)
    footer = build_dynamic_footer(columns)
    _, _, _, _, formula_gap = SPACING_MAP.get(spacing, SPACING_MAP["large"])
    
    if not selected_formulas:
        return header + footer
    
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
            escaped_name = name.replace("\\", "\\textbackslash ").replace("&", "\\&").replace("%", "\\%").replace("#", "\\#").replace("_", "\\_").replace("^", "\\textasciicircum ").replace("{", "\\{").replace("}", "\\}")
            body_lines.append("\\textbf{" + escaped_name + "}")
            body_lines.append("\\[ \\adjustbox{max width=\\linewidth}{$" + latex + "$} \\]")
            body_lines.append(f"\\\\[{formula_gap}]")
    
    if in_flushleft:
        body_lines.append(r"\end{flushleft}")
    
    body = "\n".join(body_lines)
    return header + body + footer

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

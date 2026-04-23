import os
import re
import subprocess
import tempfile

LATEX_HEADER = r"""\documentclass[fleqn]{article}
\usepackage[margin=0.15in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{enumitem} 
\usepackage{multicol}
\usepackage{adjustbox}

\setlength{\mathindent}{0pt}
\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}
\pagestyle{empty}

\begin{document}
\scriptsize
"""

LATEX_FOOTER = r"""
\end{document}
"""

# Spacing presets: (formula_gap, baselineskip)
SPACING_MAP = {
    "tiny": ("0pt", "0.2pt"),
    "small": ("0.4pt", "0.4pt"),
    "medium": ("0.8pt", "0.8pt"),
    "large": ("1.2pt", "1.2pt"),
}


FONT_SIZE_PATTERN = re.compile(r"^(\d+(?:\.\d+)?)pt$")
SPACING_PATTERN = re.compile(r"^(\d+(?:\.\d+)?)pt$")
BODY_FONT_COMMAND_PATTERN = re.compile(
    r"^\\fontsize\{[^}]+\}\{[^}]+\}\\selectfont\s*",
    re.MULTILINE,
)
LEGACY_HEADING_PATTERN = re.compile(r"(?m)^\\noindent\\textbf\{([^{}]+)\}\\par\s*$")
LEGACY_FORMULA_LABEL_PATTERN = re.compile(r"(?m)^\\textbf\{([^{}]+)\}\s*$")
LEGACY_PROBLEM_LABEL_PATTERN = re.compile(r"\\textbf\{Problem ([^}]*)\}\s*")
LEGACY_ANSWER_LABEL_PATTERN = re.compile(r"\\textbf\{Answer:\}\s*")


def parse_pt_value(value, default):
    match = FONT_SIZE_PATTERN.match(str(value or "").strip())
    if not match:
        match = SPACING_PATTERN.match(str(value or "").strip())
    if not match:
        return default
    return float(match.group(1))


def format_pt_value(value):
    if float(value).is_integer():
        return f"{int(value)}pt"
    return f"{value:.2f}".rstrip("0").rstrip(".") + "pt"


def get_body_font_command(font_size):
    size_pt = parse_pt_value(font_size, 10.0)
    line_height = max(size_pt + 0.8, size_pt)
    return f"\\fontsize{{{format_pt_value(size_pt)}}}{{{format_pt_value(line_height)}}}\\selectfont"


def get_document_class(font_size):
    size_pt = parse_pt_value(font_size, 10.0)
    if size_pt <= 8.5:
        return "extarticle", "8pt"
    if size_pt <= 9.5:
        return "extarticle", "9pt"
    if size_pt <= 10.5:
        return "article", "10pt"
    if size_pt <= 11.5:
        return "article", "11pt"
    return "article", "12pt"


def get_spacing_values(spacing, font_size):
    if spacing in SPACING_MAP:
        formula_gap, baseline_adjustment = SPACING_MAP[spacing]
    else:
        custom_spacing = format_pt_value(max(parse_pt_value(spacing, 0.8), 0.0))
        formula_gap = custom_spacing
        baseline_adjustment = custom_spacing

    body_size = parse_pt_value(font_size, 10.0)
    baseline_pt = max(body_size + parse_pt_value(baseline_adjustment, 0.8), body_size)
    return {
        "formula_gap": formula_gap,
        "baseline_skip": format_pt_value(baseline_pt),
        "paragraph_skip": formula_gap,
    }


def escape_latex_text(text):
    """Escape plain text before inserting it into LaTeX commands."""
    text = text or ""
    replacements = {
        "\\": "\\textbackslash ",
        "&": "\\&",
        "%": "\\%",
        "#": "\\#",
        "_": "\\_",
        "^": "\\textasciicircum ",
        "{": "\\{",
        "}": "\\}",
    }
    return "".join(replacements.get(char, char) for char in text)


def append_source_comment(lines, comment):
    """Add a full-line LaTeX comment with spacer lines for readability."""
    if lines:
        lines.append("%")
    lines.append(f"% ===== {comment} =====")
    lines.append("%")


def append_text_heading(lines, text):
    lines.append(r"\noindent " + text + r"\par")


def build_dynamic_header(columns=2, font_size="10pt", margins="0.25in", spacing="large"):
    """
    Build a dynamic LaTeX header based on user-selected options.
    """
    size_command = get_body_font_command(font_size)
    spacing_values = get_spacing_values(spacing, font_size)
    doc_class, doc_class_size = get_document_class(font_size)

    header_lines = [
        f"\\documentclass[{doc_class_size},fleqn]{{{doc_class}}}",
        f"\\usepackage[margin={margins}]{{geometry}}",
        "\\usepackage{amsmath, amssymb}",
        "\\usepackage{enumitem}",
        "\\usepackage{multicol}",
        "\\usepackage{adjustbox}",  # For auto-scaling equations to fit column width
        "",
        "\\setlength{\\mathindent}{0pt}",
        "\\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}",
        "\\pagestyle{empty}",
        "",
        f"\\setlength{{\\baselineskip}}{{{spacing_values['baseline_skip']}}}",
        f"\\setlength{{\\parskip}}{{{spacing_values['paragraph_skip']}}}",
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


def normalize_latex_layout(content, columns=2, font_size="10pt", margins="0.25in", spacing="large"):
    """Rebuild document wrappers so current layout controls apply to existing LaTeX content."""
    if not content:
        return content

    header = build_dynamic_header(columns, font_size, margins, spacing)
    footer = build_dynamic_footer(columns)

    if r"\begin{document}" not in content or r"\end{document}" not in content:
        body = content.strip("\n")
        return header + body + ("\n" if body else "") + footer

    body = content.split(r"\begin{document}", 1)[1].split(r"\end{document}", 1)[0].strip()
    body = re.sub(r"^\\(?:tiny|scriptsize|footnotesize|small|normalsize)\b\s*", "", body, count=1)
    body = re.sub(BODY_FONT_COMMAND_PATTERN, "", body, count=1)
    body = re.sub(r"^\\begin\{multicols\}\{\d+\}\s*", "", body, count=1)
    body = re.sub(r"^\\raggedcolumns\s*", "", body, count=1)
    body = re.sub(r"\s*\\end\{multicols\}\s*$", "", body, count=1)
    body = re.sub(LEGACY_HEADING_PATTERN, r"\\noindent \1\\par", body)
    body = re.sub(LEGACY_FORMULA_LABEL_PATTERN, r"\\noindent \1\\par", body)
    body = re.sub(LEGACY_PROBLEM_LABEL_PATTERN, r"Problem \1 ", body)
    body = re.sub(LEGACY_ANSWER_LABEL_PATTERN, "Answer: ", body)
    formula_gap = get_spacing_values(spacing, font_size)["formula_gap"]
    if formula_gap == "0pt":
        body = re.sub(r"(?m)^\\vspace\{[^}]+\}\s*$\n?", "", body)
    else:
        body = re.sub(r"(?m)^\\vspace\{[^}]+\}\s*$", rf"\\vspace{{{formula_gap}}}", body)
    body = body.strip("\n")

    return header + body + ("\n" if body else "") + footer


def build_latex_for_formulas(selected_formulas, columns=2, font_size="10pt", margins="0.25in", spacing="large"):
    """
    Given a list of selected formulas (each with class_name, category, name, latex),
    build a complete LaTeX document.
    """
    header = build_dynamic_header(columns, font_size, margins, spacing)
    footer = build_dynamic_footer(columns)
    formula_gap = get_spacing_values(spacing, font_size)["formula_gap"]
    
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
            if current_category is not None and current_category != current_class:
                append_source_comment(body_lines, f"END CATEGORY: {current_category}")
            if current_class is not None:
                append_source_comment(body_lines, f"END CLASS: {current_class}")
            escaped_class = escape_latex_text(class_name)
            append_source_comment(body_lines, f"BEGIN CLASS: {class_name}")
            append_text_heading(body_lines, escaped_class)
            current_class = class_name
            current_category = None

        if category != current_category:
            is_special = (category == class_name)
            if in_flushleft:
                body_lines.append(r"\end{flushleft}")
                in_flushleft = False
            if current_category is not None and current_category != current_class:
                append_source_comment(body_lines, f"END CATEGORY: {current_category}")
            if not is_special:
                escaped_category = escape_latex_text(category)
                append_source_comment(body_lines, f"BEGIN CATEGORY: {category}")
                append_text_heading(body_lines, escaped_category)
                body_lines.append(r"\begin{flushleft}")
                in_flushleft = True
            current_category = category

        if category == class_name:
            body_lines.append(f"% Formula Block: {name}")
            body_lines.append(latex)
            body_lines.append("%")
        else:
            escaped_name = escape_latex_text(name)
            body_lines.append(f"% Formula Block: {name}")
            body_lines.append(r"\noindent " + escaped_name + r"\par")
            body_lines.append(r"\[" + r" \adjustbox{max width=\linewidth}{$" + latex + r"$} " + r"\]")
            if formula_gap != "0pt":
                body_lines.append(r"\vspace{" + formula_gap + "}")
            body_lines.append("%")

    if in_flushleft:
        body_lines.append(r"\end{flushleft}")
    if current_category is not None and current_category != current_class:
        append_source_comment(body_lines, f"END CATEGORY: {current_category}")
    if current_class is not None:
        append_source_comment(body_lines, f"END CLASS: {current_class}")

    body = "\n".join(body_lines)
    return header + body + "\n" + footer

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

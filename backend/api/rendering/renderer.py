"""The single owner of deterministic TeXGen document composition."""

from dataclasses import dataclass, field
import re
from typing import Mapping, Sequence


GENERATED_MARKER = "% @texgen-generated v1"
LEGACY_GENERATED_MARKER = "% @texgen-generated"
LEGACY_COMPATIBILITY_SOURCE_MODE = "legacy"
GENERATED_MARKER_LINE_PATTERN = re.compile(
    rf"(?m)^(?:{re.escape(GENERATED_MARKER)}|{re.escape(LEGACY_GENERATED_MARKER)})$\n?"
)
SPACING_MAP = {"tiny": ("0pt", "0.2pt"), "small": ("0.4pt", "0.4pt"), "medium": ("0.8pt", "0.8pt"), "large": ("1.2pt", "1.2pt")}
FONT_SIZE_PATTERN = re.compile(r"^(\d+(?:\.\d+)?)pt$")
SPACING_PATTERN = FONT_SIZE_PATTERN
BODY_FONT_COMMAND_PATTERN = re.compile(r"\\fontsize\{[^}]+\}\{[^}]+\}\\selectfont\s*", re.MULTILINE)
NAMED_BODY_FONT_COMMAND_PATTERN = re.compile(r"\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b\s*", re.MULTILINE)
LEGACY_HEADING_PATTERN = re.compile(r"(?m)^\\noindent\\textbf\{([^{}]+)\}\\par\s*$")
LEGACY_FORMULA_LABEL_PATTERN = re.compile(r"(?m)^\\textbf\{([^{}]+)\}\s*$")
LEGACY_PROBLEM_LABEL_PATTERN = re.compile(r"\\textbf\{Problem ([^}]*)\}\s*")
LEGACY_ANSWER_LABEL_PATTERN = re.compile(r"\\textbf\{Answer:\}\s*")
APP_LAYOUT_COMMENT_LINE_PATTERN = re.compile(r"(?m)^% @cheatsheet-layout .*\n?")
APP_LAYOUT_COMMENT_BLOCK_PATTERN = re.compile(r"(?m)(?:^% @cheatsheet-layout .*\n)+^%\n?")


@dataclass(frozen=True)
class LayoutSpec:
    columns: int = 4
    font_size: str = "9pt"
    margins: str = "0.15in"
    spacing: str = "small"
    orientation: str = "portrait"


@dataclass(frozen=True)
class PracticeProblemSpec:
    order: int
    question_latex: str
    answer_latex: str = ""


@dataclass(frozen=True)
class DocumentRenderRequest:
    source_latex: str = ""
    title: str = ""
    layout: LayoutSpec = field(default_factory=LayoutSpec)
    practice_problems: tuple[PracticeProblemSpec, ...] = ()
    source_mode: str = LEGACY_COMPATIBILITY_SOURCE_MODE

    def __post_init__(self):
        object.__setattr__(self, "practice_problems", tuple(self.practice_problems))


def parse_pt_value(value, default):
    match = FONT_SIZE_PATTERN.match(str(value or "").strip())
    return float(match.group(1)) if match else default


def format_pt_value(value):
    return f"{int(value)}pt" if float(value).is_integer() else f"{value:.2f}".rstrip("0").rstrip(".") + "pt"


def get_body_font_command(font_size):
    size_pt = parse_pt_value(font_size, 10.0)
    return f"\\fontsize{{{format_pt_value(size_pt)}}}{{{format_pt_value(max(size_pt + 0.8, size_pt))}}}\\selectfont"


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
    formula_gap, adjustment = SPACING_MAP.get(spacing, (format_pt_value(max(parse_pt_value(spacing, 0.8), 0.0)),) * 2)
    body_size = parse_pt_value(font_size, 10.0)
    return {"formula_gap": formula_gap, "baseline_skip": format_pt_value(max(body_size + parse_pt_value(adjustment, 0.8), body_size)), "paragraph_skip": formula_gap}


def escape_latex_text(text):
    replacements = {"\\": "\\textbackslash ", "&": "\\&", "%": "\\%", "#": "\\#", "_": "\\_", "^": "\\textasciicircum ", "{": "\\{", "}": "\\}"}
    return "".join(replacements.get(char, char) for char in (text or ""))


def append_source_comment(lines, comment):
    if lines:
        lines.append("%")
    lines.extend([f"% ===== {comment} =====", "%"])


def append_text_heading(lines, text):
    lines.append(r"\noindent " + text + r"\par")


def build_layout_comment_block(layout=LayoutSpec()):
    return [
        f"% @cheatsheet-layout columns: {layout.columns} | change layout options up top to update columns",
        f"% @cheatsheet-layout font_size: {layout.font_size} | change layout options up top to update text size",
        f"% @cheatsheet-layout spacing: {layout.spacing} | change layout options up top to update spacing",
        f"% @cheatsheet-layout margins: {layout.margins} | change layout options up top to update margins",
        f"% @cheatsheet-layout orientation: {layout.orientation} | change layout options up top to update orientation", "%",
    ]


def build_dynamic_header(columns=4, font_size="9pt", margins="0.15in", spacing="small", orientation="portrait"):
    layout = LayoutSpec(columns, font_size, margins, spacing, orientation)
    doc_class, class_size = get_document_class(layout.font_size)
    options = f"{class_size},fleqn,letterpaper" + (",landscape" if layout.orientation == "landscape" else "")
    geometry = f"letterpaper,margin={layout.margins}" + (",landscape" if layout.orientation == "landscape" else "")
    values = get_spacing_values(layout.spacing, layout.font_size)
    lines = [f"\\documentclass[{options}]{{{doc_class}}}", f"\\usepackage[{geometry}]{{geometry}}", "\\usepackage{amsmath, amssymb}", "\\usepackage{enumitem}", "\\usepackage{multicol}", "\\usepackage{adjustbox}", "", "\\setlength{\\mathindent}{0pt}", "\\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}", "\\pagestyle{empty}", "", f"\\setlength{{\\baselineskip}}{{{values['baseline_skip']}}}", f"\\setlength{{\\parskip}}{{{values['paragraph_skip']}}}", "", "\\begin{document}", get_body_font_command(layout.font_size)]
    if layout.columns > 1:
        lines.extend([f"\\begin{{multicols}}{{{layout.columns}}}", "\\raggedcolumns"])
    lines.append("")
    return "\n".join(lines)


def build_dynamic_footer(columns=2):
    return "\n".join((["\\end{multicols}"] if columns > 1 else []) + ["\\end{document}"])


def _practice_problems(problems):
    if not problems:
        return ""
    lines = [r"\noindent Practice Problems\par"]
    for problem in problems:
        lines.append(f"Problem {problem.order}: {problem.question_latex}")
        if problem.answer_latex:
            lines.append(f"Answer: {problem.answer_latex}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _insert_problems(document, problems):
    section = _practice_problems(problems)
    if not section:
        return document
    target = r"\end{multicols}" if document.rfind(r"\end{multicols}") < document.rfind(r"\end{document}") and r"\end{multicols}" in document else r"\end{document}"
    index = document.rfind(target)
    return document if index == -1 else f"{document[:index].rstrip()}\n\n{section}\n{document[index:]}"


def is_generated_document(content):
    return bool(GENERATED_MARKER_LINE_PATTERN.search(content))


def render_document(request: DocumentRenderRequest):
    source = request.source_latex or ""
    is_raw = request.source_mode == "raw"
    if r"\begin{document}" in source and r"\end{document}" in source:
        return source if is_raw else _insert_problems(source, request.practice_problems)
    layout = request.layout
    document_class, class_size = get_document_class(layout.font_size)
    options = f"{class_size},fleqn,letterpaper" + (",landscape" if layout.orientation == "landscape" else "")
    geometry = f"letterpaper,margin={layout.margins}" + (",landscape" if layout.orientation == "landscape" else "")
    spacing_values = get_spacing_values(layout.spacing, layout.font_size)
    lines = [
        f"\\documentclass[{options}]{{{document_class}}}",
        "\\usepackage[utf8]{inputenc}",
        "\\usepackage{amsmath, amssymb}",
        "\\usepackage{adjustbox}",
        f"\\usepackage[{geometry}]{{geometry}}",
        f"\\setlength{{\\baselineskip}}{{{spacing_values['baseline_skip']}}}",
        f"\\setlength{{\\parskip}}{{{spacing_values['paragraph_skip']}}}",
    ]
    if layout.columns > 1:
        lines.append("\\usepackage{multicol}")
    lines.extend(["\\begin{document}", get_body_font_command(layout.font_size)])
    if not is_raw:
        lines.append(GENERATED_MARKER)
    if request.title:
        lines.extend([f"\\title{{{escape_latex_text(request.title)}}}", "\\maketitle"])
    if layout.columns > 1:
        lines.append(f"\\begin{{multicols}}{{{layout.columns}}}")
    lines.append(source)
    section = _practice_problems(request.practice_problems)
    if section:
        lines.append(section)
    if layout.columns > 1:
        lines.append("\\end{multicols}")
    lines.append("\\end{document}")
    return "\n".join(lines)


def _layout(columns, font_size, margins, spacing, orientation):
    return LayoutSpec(columns, font_size, margins, spacing, orientation)


def normalize_latex_layout(
    content,
    columns=4,
    font_size="9pt",
    margins="0.15in",
    spacing="small",
    orientation="portrait",
    source_mode=LEGACY_COMPATIBILITY_SOURCE_MODE,
):
    if not content:
        return content
    if source_mode == "raw" or not is_generated_document(content):
        return content
    layout = _layout(columns, font_size, margins, spacing, orientation)
    header = build_dynamic_header(
        layout.columns,
        layout.font_size,
        layout.margins,
        layout.spacing,
        layout.orientation,
    )
    footer = build_dynamic_footer(layout.columns)
    if r"\begin{document}" not in content or r"\end{document}" not in content:
        body = GENERATED_MARKER_LINE_PATTERN.sub("", content).strip("\n")
        layout_block = "\n".join(build_layout_comment_block(layout))
        body = GENERATED_MARKER + "\n" + layout_block + ("\n" + body if body else "")
        return header + body + "\n" + footer
    body = content.split(r"\begin{document}", 1)[1].split(r"\end{document}", 1)[0].strip()
    body = GENERATED_MARKER_LINE_PATTERN.sub("", body)
    for pattern, replacement in ((NAMED_BODY_FONT_COMMAND_PATTERN, ""), (BODY_FONT_COMMAND_PATTERN, ""), (re.compile(r"^\\begin\{multicols\}\{\d+\}\s*"), ""), (re.compile(r"^\\raggedcolumns\s*"), ""), (re.compile(r"\s*\\end\{multicols\}\s*$"), ""), (LEGACY_HEADING_PATTERN, r"\\noindent \1\\par"), (LEGACY_FORMULA_LABEL_PATTERN, r"\\noindent \1\\par"), (LEGACY_PROBLEM_LABEL_PATTERN, r"Problem \1 "), (LEGACY_ANSWER_LABEL_PATTERN, "Answer: "), (APP_LAYOUT_COMMENT_BLOCK_PATTERN, ""), (APP_LAYOUT_COMMENT_LINE_PATTERN, "")):
        body = re.sub(pattern, replacement, body, count=1 if pattern.pattern.startswith((r"^\\begin", r"^\\ragged", r"\s*\\end")) else 0)
    gap = get_spacing_values(layout.spacing, layout.font_size)["formula_gap"]
    body = re.sub(r"(?m)^\\vspace\{[^}]+\}\s*$\n?", "", body) if gap == "0pt" else re.sub(r"(?m)^\\vspace\{[^}]+\}\s*$", rf"\\vspace{{{gap}}}", body)
    body = body.strip("\n")
    body = GENERATED_MARKER + "\n" + "\n".join(build_layout_comment_block(layout)) + ("\n" + body if body else "")
    return header + body + ("\n" if body else "") + footer


def build_latex_for_formulas(selected_formulas: Sequence[Mapping], columns=4, font_size="9pt", margins="0.15in", spacing="small", orientation="portrait"):
    layout = _layout(columns, font_size, margins, spacing, orientation)
    header = build_dynamic_header(
        layout.columns,
        layout.font_size,
        layout.margins,
        layout.spacing,
        layout.orientation,
    )
    footer = build_dynamic_footer(layout.columns)
    if not selected_formulas:
        return header + GENERATED_MARKER + "\n" + footer
    lines, current_class, current_category, in_flushleft = [GENERATED_MARKER, *build_layout_comment_block(layout)], None, None, False
    gap = get_spacing_values(layout.spacing, layout.font_size)["formula_gap"]
    def comment(value):
        if lines:
            lines.append("%")
        lines.extend([f"% ===== {value} =====", "%"])
    for formula in selected_formulas:
        class_name, category, name, latex = formula.get("class_name") or formula.get("class", ""), formula.get("category", ""), formula.get("name", ""), formula.get("latex", "")
        if class_name != current_class:
            if in_flushleft:
                lines.append(r"\end{flushleft}")
                in_flushleft = False
            if current_category is not None and current_category != current_class:
                comment(f"END CATEGORY: {current_category}")
            if current_class is not None:
                comment(f"END CLASS: {current_class}")
            comment(f"BEGIN CLASS: {class_name}")
            lines.append(r"\noindent " + escape_latex_text(class_name) + r"\par")
            current_class, current_category = class_name, None
        if category != current_category:
            special = category == class_name
            if in_flushleft:
                lines.append(r"\end{flushleft}")
                in_flushleft = False
            if current_category is not None and current_category != current_class:
                comment(f"END CATEGORY: {current_category}")
            if not special:
                comment(f"BEGIN CATEGORY: {category}")
                lines.extend([r"\noindent " + escape_latex_text(category) + r"\par", r"\begin{flushleft}"])
                in_flushleft = True
            current_category = category
        lines.append(f"% Formula Block: {name}")
        if category == class_name:
            lines.append(latex)
        else:
            lines.extend([r"\noindent " + escape_latex_text(name) + r"\par", r"\[" + r" \adjustbox{max width=\linewidth}{$" + latex + r"$} " + r"\]"])
            if gap != "0pt":
                lines.append(r"\vspace{" + gap + "}")
        lines.append("%")
    if in_flushleft:
        lines.append(r"\end{flushleft}")
    if current_category is not None and current_category != current_class:
        comment(f"END CATEGORY: {current_category}")
    if current_class is not None:
        comment(f"END CLASS: {current_class}")
    return header + "\n".join(lines) + "\n" + footer

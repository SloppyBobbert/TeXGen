"""Compatibility exports for the rendering boundary.

New code should import from :mod:`api.rendering`.
"""

from .rendering import (
    APP_LAYOUT_COMMENT_BLOCK_PATTERN,
    APP_LAYOUT_COMMENT_LINE_PATTERN,
    BODY_FONT_COMMAND_PATTERN,
    FONT_SIZE_PATTERN,
    LEGACY_ANSWER_LABEL_PATTERN,
    LEGACY_FORMULA_LABEL_PATTERN,
    LEGACY_HEADING_PATTERN,
    LEGACY_PROBLEM_LABEL_PATTERN,
    NAMED_BODY_FONT_COMMAND_PATTERN,
    SPACING_MAP,
    SPACING_PATTERN,
    append_source_comment,
    append_text_heading,
    build_dynamic_footer,
    build_dynamic_header,
    build_latex_for_formulas,
    escape_latex_text,
    format_pt_value,
    get_body_font_command,
    get_document_class,
    get_spacing_values,
    normalize_latex_layout,
    parse_pt_value,
)

__all__ = [
    "LATEX_FOOTER",
    "LATEX_HEADER",
    "APP_LAYOUT_COMMENT_BLOCK_PATTERN",
    "APP_LAYOUT_COMMENT_LINE_PATTERN",
    "BODY_FONT_COMMAND_PATTERN",
    "FONT_SIZE_PATTERN",
    "LEGACY_ANSWER_LABEL_PATTERN",
    "LEGACY_FORMULA_LABEL_PATTERN",
    "LEGACY_HEADING_PATTERN",
    "LEGACY_PROBLEM_LABEL_PATTERN",
    "NAMED_BODY_FONT_COMMAND_PATTERN",
    "SPACING_MAP",
    "SPACING_PATTERN",
    "append_source_comment",
    "append_text_heading",
    "build_dynamic_footer",
    "build_dynamic_header",
    "build_latex_for_formulas",
    "build_layout_comment_block",
    "compile_latex_to_pdf",
    "escape_latex_text",
    "format_pt_value",
    "get_body_font_command",
    "get_document_class",
    "get_spacing_values",
    "normalize_latex_layout",
    "parse_pt_value",
]

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


def build_layout_comment_block(columns=4, font_size="9pt", margins="0.15in", spacing="small", orientation="portrait"):
    from .rendering.renderer import LayoutSpec, build_layout_comment_block as _build

    return _build(LayoutSpec(columns, font_size, margins, spacing, orientation))


def compile_latex_to_pdf(content):
    """Compile through the configured compiler service."""
    from uuid import uuid4

    from .compilation.service import CompilerService, SettingsCompilerSelector, compile_limits_from_settings
    from .compilation.types import CompileRequest
    from .rendering import DocumentRenderRequest, render_document

    limits = compile_limits_from_settings()
    content = render_document(DocumentRenderRequest(source_latex=content, source_mode="raw"))
    return CompilerService(SettingsCompilerSelector(limits)).compile(
        CompileRequest(job_id=uuid4().hex, source=content, limits=limits)
    ).pdf

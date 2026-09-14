import pytest
from django.contrib.auth.models import User

from api.rendering import (
    GENERATED_MARKER,
    DocumentRenderRequest,
    LayoutSpec,
    PracticeProblemSpec,
    build_latex_for_formulas,
    is_generated_document,
    render_document,
)
from api.rendering.renderer import LEGACY_GENERATED_MARKER, normalize_latex_layout


def _without_generated_marker(document):
    return document.replace(f"{GENERATED_MARKER}\n", "")


def test_formula_rendering_golden_layout_and_orientation():
    rendered = build_latex_for_formulas(
        [{"class_name": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula", "latex": r"m=\frac{y_2-y_1}{x_2-x_1}"}],
        columns=3,
        font_size="10.5pt",
        margins="0.5in",
        spacing="0.6pt",
        orientation="landscape",
    )

    assert "\\documentclass[10pt,fleqn,letterpaper,landscape]{article}" in rendered
    assert "\\usepackage[letterpaper,margin=0.5in,landscape]{geometry}" in rendered
    assert "\\fontsize{10.5pt}{11.3pt}\\selectfont" in rendered
    assert "\\begin{multicols}{3}" in rendered
    assert "\\vspace{0.6pt}" in rendered
    assert GENERATED_MARKER in rendered


def test_formula_rendering_preserves_legacy_structure_except_marker():
    rendered = build_latex_for_formulas(
        [{"class_name": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula", "latex": "m=x"}],
        columns=2,
    )

    assert _without_generated_marker(rendered) == """\\documentclass[9pt,fleqn,letterpaper]{extarticle}
\\usepackage[letterpaper,margin=0.15in]{geometry}
\\usepackage{amsmath, amssymb}
\\usepackage{enumitem}
\\usepackage{multicol}
\\usepackage{adjustbox}

\\setlength{\\mathindent}{0pt}
\\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=*}
\\pagestyle{empty}

\\setlength{\\baselineskip}{9.4pt}
\\setlength{\\parskip}{0.4pt}

\\begin{document}
\\fontsize{9pt}{9.8pt}\\selectfont
\\begin{multicols}{2}
\\raggedcolumns
% @cheatsheet-layout columns: 2 | change layout options up top to update columns
% @cheatsheet-layout font_size: 9pt | change layout options up top to update text size
% @cheatsheet-layout spacing: small | change layout options up top to update spacing
% @cheatsheet-layout margins: 0.15in | change layout options up top to update margins
% @cheatsheet-layout orientation: portrait | change layout options up top to update orientation
%
%
% ===== BEGIN CLASS: ALGEBRA I =====
%
\\noindent ALGEBRA I\\par
%
% ===== BEGIN CATEGORY: Linear Equations =====
%
\\noindent Linear Equations\\par
\\begin{flushleft}
% Formula Block: Slope Formula
\\noindent Slope Formula\\par
\\[ \\adjustbox{max width=\\linewidth}{$m=x$} \\]
\\vspace{0.4pt}
%
\\end{flushleft}
%
% ===== END CATEGORY: Linear Equations =====
%
%
% ===== END CLASS: ALGEBRA I =====
%
\\end{multicols}
\\end{document}"""


def test_complete_raw_document_is_preserved_byte_for_byte_without_problems():
    source = "\\documentclass{article}\n\\begin{document}\nRaw $x_1$ & text\n\\end{document}"

    assert render_document(DocumentRenderRequest(source_latex=source, source_mode="raw")) == source
    assert normalize_latex_layout(source, source_mode="raw") == source


def test_raw_fragment_is_wrapped_deterministically_without_generated_marker():
    rendered = render_document(
        DocumentRenderRequest(
            source_latex=r"\textbf{Raw LaTeX} $x_1$",
            source_mode="raw",
            title="A & B_1",
            layout=LayoutSpec(columns=1, font_size="10pt", margins="1in", spacing="tiny"),
        )
    )

    assert r"\title{A \& B\_1}" in rendered
    assert r"\textbf{Raw LaTeX} $x_1$" in rendered
    assert GENERATED_MARKER not in rendered
    assert not is_generated_document(rendered)


def test_plain_text_title_and_formula_names_escape_dollar_and_tilde():
    from api.rendering import escape_latex_text

    title = "Cost $5 ~ estimate"
    escaped = r"Cost \$5 \textasciitilde{} estimate"
    assert escape_latex_text(title) == escaped
    assert f"\\title{{{escaped}}}" in render_document(DocumentRenderRequest(title=title))
    document = build_latex_for_formulas([
        {"class_name": title, "category": title + " category", "name": title + " formula", "latex": "x=1"}
    ])
    assert document.count(r"\noindent " + escaped) == 3


def test_compatibility_compiler_wraps_fragments_but_preserves_complete_documents(monkeypatch):
    from api.compilation.service import CompilerService
    from api.compilation.types import CompileResult
    from api.latex_utils import compile_latex_to_pdf

    received = []
    monkeypatch.setattr(CompilerService, "compile", lambda _, request: received.append(request.source) or CompileResult(b"%PDF-1.7"))
    assert compile_latex_to_pdf("x") == b"%PDF-1.7"
    assert r"\begin{document}" in received[0] and r"\end{document}" in received[0]
    document = "\\documentclass{article}\n\\begin{document}x\\end{document}"
    assert compile_latex_to_pdf(document) == b"%PDF-1.7"
    assert received[1] == document


def test_generated_documents_normalize_only_when_marked():
    generated = build_latex_for_formulas([])

    normalized = normalize_latex_layout(generated, columns=1, source_mode="generated")

    assert GENERATED_MARKER in normalized
    assert "\\begin{multicols}" not in normalized
    unmarked = "\\documentclass{article}\n\\begin{document}\nBody\n\\end{document}"
    assert normalize_latex_layout(unmarked, source_mode="generated") == unmarked


def test_legacy_generated_marker_is_the_only_legacy_normalization_compatibility():
    legacy = f"\\documentclass{{article}}\n\\begin{{document}}\n{LEGACY_GENERATED_MARKER}\nBody\n\\end{{document}}"

    normalized = normalize_latex_layout(legacy, font_size="10pt", source_mode="legacy")

    assert "\\fontsize{10pt}{10.8pt}\\selectfont" in normalized
    assert normalize_latex_layout("Body", source_mode="legacy") == "Body"


def test_marked_documents_rewrap_idempotently_with_one_current_marker():
    legacy = (
        "\\documentclass{article}\n\\begin{document}\n"
        f"{LEGACY_GENERATED_MARKER}\n\\fontsize{{10pt}}{{10.8pt}}\\selectfont\n"
        "\\begin{multicols}{2}\n\\raggedcolumns\nBody\n\\end{multicols}\n\\end{document}"
    )

    normalized = normalize_latex_layout(legacy, columns=3, source_mode="generated")
    normalized_twice = normalize_latex_layout(normalized, columns=3, source_mode="generated")

    assert normalized_twice == normalized
    assert normalized.count(GENERATED_MARKER) == 1
    assert LEGACY_GENERATED_MARKER not in normalized.replace(GENERATED_MARKER, "")
    assert normalized.count("\\begin{multicols}{3}") == 1
    assert normalized.count("\\end{multicols}") == 1
    assert normalized.count("% @cheatsheet-layout columns:") == 1


def test_marker_like_comments_are_not_recognized_or_removed():
    source = "\\documentclass{article}\n\\begin{document}\n% @texgen-generated v1 extra\nBody\n\\end{document}"

    assert normalize_latex_layout(source, source_mode="generated") == source


@pytest.mark.parametrize("columns", [1, 3])
def test_fragment_wrapping_balances_multicols_with_source_and_problems_inside(columns):
    rendered = render_document(
        DocumentRenderRequest(
            source_latex="Source body",
            layout=LayoutSpec(columns=columns),
            practice_problems=(PracticeProblemSpec(1, "Problem body"),),
        )
    )

    assert rendered.count(r"\begin{multicols}") == (1 if columns > 1 else 0)
    assert rendered.count(r"\end{multicols}") == (1 if columns > 1 else 0)
    if columns > 1:
        assert rendered.index(r"\begin{multicols}") < rendered.index("Source body")
        assert rendered.index("Problem body") < rendered.index(r"\end{multicols}")


def test_normalization_preserves_unmarked_legacy_documents():
    from api.rendering import normalize_latex_layout

    normalized = normalize_latex_layout(
        "\\documentclass{article}\n\\begin{document}\n\\small\nBody\n\\end{document}",
        columns=1,
        font_size="10pt",
        margins="0.5in",
        spacing="tiny",
        orientation="landscape",
    )

    assert normalized == "\\documentclass{article}\n\\begin{document}\n\\small\nBody\n\\end{document}"


def test_practice_problem_latex_stays_raw_and_is_inserted_before_multicols_end():
    source = "\\documentclass{article}\n\\begin{document}\n\\begin{multicols}{2}\nBody\n\\end{multicols}\n\\end{document}"
    rendered = render_document(
        DocumentRenderRequest(source_latex=source, practice_problems=(PracticeProblemSpec(1, r"Show $x_1 & y$", r"$\frac{1}{2}$"),))
    )

    assert r"Show $x_1 & y$" in rendered
    assert r"$\frac{1}{2}$" in rendered
    assert rendered.index("Practice Problems") < rendered.index(r"\end{multicols}")


@pytest.mark.django_db
def test_cheatsheet_compatibility_renderer_preserves_layout_and_problem_insertion():
    from api.models import CheatSheet, PracticeProblem

    sheet = CheatSheet.objects.create(
        title="A & B_1",
        latex_content="Body",
        columns=2,
        margins="0.5in",
        orientation="landscape",
        user=User.objects.create_user("rendering-boundary-user"),
    )
    PracticeProblem.objects.create(cheat_sheet=sheet, order=1, question_latex=r"Show $x_1$.")

    rendered = sheet.build_full_latex()

    assert "\\documentclass[9pt,fleqn,letterpaper,landscape]{extarticle}" in rendered
    assert "margin=0.5in,landscape" in rendered
    assert r"\title{A \& B\_1}" in rendered
    assert rendered.index(r"\begin{multicols}{2}") < rendered.index("Body")
    assert rendered.index("Practice Problems") < rendered.index(r"\end{multicols}")

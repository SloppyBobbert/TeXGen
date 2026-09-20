"""Run with manage.py shell in the disposable E2E database only."""

from api.document_sections import validate_generated_sections
from api.formula_catalog import get_formula_by_id
from api.models import Template
from api.rendering import build_latex_for_formulas

ids = ["algebra-i.slope-formula", "algebra-i.slope-intercept-form"]
records = [get_formula_by_id(formula_id) for formula_id in ids]
assert all(record is not None for record in records)
source = build_latex_for_formulas([record for record in records if record is not None])
sections = validate_generated_sections({"version": 1, "baseline": source})
Template.objects.get_or_create(
    name="E2E safe sections",
    subject="E2E fixture",
    defaults={
        "latex_content": source,
        "source_mode": "generated",
        "formula_selections": [{"formula_id": formula_id} for formula_id in ids],
        "generated_sections": sections,
    },
)

import pytest

from api.document_sections import validate_generated_sections
from api.formula_catalog import get_formula_by_id
from api.rendering import build_latex_for_formulas, normalize_latex_layout


@pytest.fixture
def baseline():
    record = get_formula_by_id("algebra-i.slope-formula")
    assert record is not None
    return build_latex_for_formulas([record])


def test_saved_baseline_is_not_regenerated_from_the_catalog(baseline):
    metadata = {"version": 1, "baseline": baseline.replace("Slope Formula", "An older catalog label")}
    assert validate_generated_sections(metadata) == metadata
    assert validate_generated_sections(None) is None


def test_section_owned_source_and_damaged_markers_are_never_normalized(baseline):
    edited = baseline.replace("Slope Formula", "Manual label")
    for source in (edited, edited.replace("end f:", "end c:")):
        assert normalize_latex_layout(source, columns=1, font_size="12pt", source_mode="generated") == source


def test_empty_group_cannot_grant_section_authority():
    source = "% @texgen-section v1 begin c:algebra-i.slope-formula\n% @texgen-section v1 end c:algebra-i.slope-formula\n"
    with pytest.raises(ValueError, match="Empty generated group"):
        validate_generated_sections({"version": 1, "baseline": source})


@pytest.mark.parametrize("damage", [
    lambda source: source.replace("end f:", "end g:"),
    lambda source: source.replace("begin f:", "begin c:"),
    lambda source: source.replace("algebra-i.slope-formula", "unknown.formula"),
    lambda source: source.replace("% @texgen-section v1 end c:algebra-i.slope-formula\n", ""),
    lambda source: source + "\n% @texgen-section damaged\n",
    lambda source: source.replace("% @texgen-section v1 begin f:algebra-i.slope-formula\n", "% @texgen-section v1 begin f:algebra-i.slope-formula\n" * 2),
])
def test_invalid_baseline_boundaries_cannot_be_saved(baseline, damage):
    with pytest.raises(ValueError):
        validate_generated_sections({"version": 1, "baseline": damage(baseline)})

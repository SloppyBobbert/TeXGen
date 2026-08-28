"""Formula catalog identity contract tests."""

from api.formula_catalog import (
    FORMULA_ID_PATTERN,
    FORMULAS,
    FORMULAS_BY_ID,
    FORMULAS_BY_LEGACY_KEY,
    get_formula_by_id,
    get_formula_by_legacy_key,
    get_formula_by_legacy_alias,
)
from api.formula_data import FORMULA_DATA, SPECIAL_CLASSES, get_classes_with_details


def test_catalog_contains_every_formula_once():
    assert len(FORMULAS) == 402
    assert len(FORMULAS_BY_ID) == 402
    assert all(FORMULA_ID_PATTERN.fullmatch(record["id"]) for record in FORMULAS)
    assert all(
        set(record) == {"id", "class", "category", "name", "latex"}
        for record in FORMULAS
    )


def test_duplicate_display_names_have_distinct_ids_and_exact_legacy_lookup():
    standard_forms = [
        record
        for record in FORMULAS
        if record["class"] == "ALGEBRA I" and record["name"] == "Standard Form"
    ]

    assert [record["id"] for record in standard_forms] == [
        "algebra-i.standard-form",
        "algebra-i.standard-form-quadratic-equations",
    ]
    assert get_formula_by_legacy_key(
        "ALGEBRA I", "Linear Equations", "Standard Form"
    ) == standard_forms[0]
    assert get_formula_by_legacy_key(
        "ALGEBRA I", "Quadratic Equations", "Standard Form"
    ) == standard_forms[1]


def test_legacy_triples_are_one_to_one():
    legacy_triples = [
        (record["class"], record["category"], record["name"]) for record in FORMULAS
    ]

    assert len(legacy_triples) == len(set(legacy_triples))
    assert len(FORMULAS_BY_LEGACY_KEY) == len(FORMULAS)


def test_catalog_order_matches_source_order():
    source_order = [
        (class_name, category, formula["name"])
        for class_name, categories in FORMULA_DATA.items()
        for category, formulas in categories.items()
        for formula in formulas
    ] + [
        (class_name, class_name, formula["name"])
        for class_name, formula in SPECIAL_CLASSES.items()
    ]

    assert [
        (record["class"], record["category"], record["name"]) for record in FORMULAS
    ] == source_order


def test_classes_output_remains_additive_for_unit_circle():
    unit_circle = next(
        class_data
        for class_data in get_classes_with_details()
        if class_data["name"] == "UNIT CIRCLE"
    )

    assert unit_circle["is_special"] is True
    assert unit_circle["categories"][0]["name"] == "UNIT CIRCLE"
    assert unit_circle["categories"][0]["formulas"][0]["id"] == (
        "unit-circle.unit-circle-key-angles"
    )


def test_representative_ids_are_snapshot_stable():
    assert get_formula_by_id("pre-algebra.pemdas-definition") is FORMULAS_BY_ID[
        "pre-algebra.pemdas-definition"
    ]
    assert FORMULAS_BY_ID["pre-algebra.pemdas-definition"]["name"] == "PEMDAS Definition"
    assert FORMULAS_BY_ID["calculus-iii.lagrange-multipliers"]["category"] == (
        "Partial Derivatives and Optimization"
    )
    assert FORMULAS_BY_ID["unit-circle.unit-circle-key-angles"]["class"] == (
        "UNIT CIRCLE"
    )


def test_legacy_alias_falls_back_to_unique_class_and_name_only():
    record = get_formula_by_legacy_alias("CALCULUS III", "Vector Calculus", "Divergence")

    assert record["id"] == "calculus-iii.divergence"


def test_legacy_alias_rejects_ambiguous_or_unknown_class_and_name():
    assert get_formula_by_legacy_alias("ALGEBRA I", "Old category", "Standard Form") is None
    assert get_formula_by_legacy_alias("ALGEBRA I", "Old category", "Missing") is None

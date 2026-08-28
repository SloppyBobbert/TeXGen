"""Immutable formula catalog indexes.

Formula IDs are checked-in literals with the syntax
``<class-slug>.<formula-slug>``. A duplicate display name in a class has a
fixed ``-<initial-category-slug>`` suffix. IDs are never derived at runtime.
"""

from re import compile as compile_regex
from types import MappingProxyType

from .formula_data import FORMULA_DATA, SPECIAL_CLASSES


FORMULA_ID_PATTERN = compile_regex(
    r"^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$"
)


class FormulaCatalogError(ValueError):
    """Raised when checked-in formula catalog data is invalid."""


def _build_catalog(formula_data, special_classes):
    records = []
    for class_name, categories in formula_data.items():
        for category, formulas in categories.items():
            records.extend(
                {
                    "id": formula.get("id"),
                    "class": class_name,
                    "category": category,
                    "name": formula.get("name"),
                    "latex": formula.get("latex"),
                }
                for formula in formulas
            )

    for class_name, formula in special_classes.items():
        records.append(
            {
                "id": formula.get("id"),
                "class": class_name,
                "category": class_name,
                "name": formula.get("name"),
                "latex": formula.get("latex"),
            }
        )

    by_id = {}
    by_legacy_key = {}
    by_class_and_name = {}
    immutable_records = []
    for record in records:
        formula_id = record["id"]
        legacy_key = (record["class"], record["category"], record["name"])
        if not isinstance(formula_id, str) or not FORMULA_ID_PATTERN.fullmatch(formula_id):
            raise FormulaCatalogError(f"Invalid formula ID: {formula_id!r}")
        if formula_id in by_id:
            raise FormulaCatalogError(f"Duplicate formula ID: {formula_id}")
        if legacy_key in by_legacy_key:
            raise FormulaCatalogError(f"Duplicate legacy formula key: {legacy_key!r}")

        immutable_record = MappingProxyType(record)
        immutable_records.append(immutable_record)
        by_id[formula_id] = immutable_record
        by_legacy_key[legacy_key] = immutable_record
        by_class_and_name.setdefault((record["class"], record["name"]), []).append(
            immutable_record
        )

    return (
        tuple(immutable_records),
        MappingProxyType(by_id),
        MappingProxyType(by_legacy_key),
        MappingProxyType({key: tuple(value) for key, value in by_class_and_name.items()}),
    )


FORMULAS, FORMULAS_BY_ID, FORMULAS_BY_LEGACY_KEY, FORMULAS_BY_CLASS_AND_NAME = _build_catalog(
    FORMULA_DATA, SPECIAL_CLASSES
)


def get_formula_by_id(formula_id):
    """Return the immutable catalog record for ``formula_id``, if present."""
    return FORMULAS_BY_ID.get(formula_id)


def get_formula_by_legacy_key(class_name, category, name):
    """Return the immutable record for an exact legacy class/category/name key."""
    return FORMULAS_BY_LEGACY_KEY.get((class_name, category, name))


def get_formula_by_legacy_alias(class_name, category, name):
    """Resolve an exact legacy key, then an unambiguous class/name alias."""
    record = get_formula_by_legacy_key(class_name, category, name)
    if record:
        return record
    matches = FORMULAS_BY_CLASS_AND_NAME.get((class_name, name), ())
    return matches[0] if len(matches) == 1 else None


def get_catalog_formulas():
    """Return catalog records in the checked-in source order."""
    return FORMULAS

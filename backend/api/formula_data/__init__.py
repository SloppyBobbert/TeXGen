"""
Formula data organized by class and category.
Each module exports FORMULAS dict and CLASS_NAME.
"""

from .pre_algebra import FORMULAS as PRE_ALGEBRA, CLASS_NAME as PRE_ALGEBRA_NAME
from .algebra_i import FORMULAS as ALGEBRA_I, CLASS_NAME as ALGEBRA_I_NAME
from .algebra_ii import FORMULAS as ALGEBRA_II, CLASS_NAME as ALGEBRA_II_NAME
from .geometry import FORMULAS as GEOMETRY, CLASS_NAME as GEOMETRY_NAME

AVAILABLE_CLASSES = [PRE_ALGEBRA_NAME, ALGEBRA_I_NAME, ALGEBRA_II_NAME, GEOMETRY_NAME]

FORMULA_DATA = {
    PRE_ALGEBRA_NAME: PRE_ALGEBRA,
    ALGEBRA_I_NAME: ALGEBRA_I,
    ALGEBRA_II_NAME: ALGEBRA_II,
    GEOMETRY_NAME: GEOMETRY,
}


def get_formula_data():
    """Return the full formula data structure."""
    return FORMULA_DATA


def get_available_classes():
    """Return list of available class names."""
    return AVAILABLE_CLASSES


def get_classes_with_details():
    """Return full structure with classes, categories, and formulas."""
    return [
        {
            "name": class_name,
            "categories": [
                {"name": cat_name, "formulas": formulas}
                for cat_name, formulas in categories.items()
            ]
        }
        for class_name, categories in FORMULA_DATA.items()
    ]

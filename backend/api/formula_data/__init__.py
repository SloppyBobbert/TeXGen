"""
Formula data organized by class and category.
Each module exports FORMULAS dict and CLASS_NAME.
"""

from .pre_algebra import FORMULAS as PRE_ALGEBRA, CLASS_NAME as PRE_ALGEBRA_NAME
from .algebra_i import FORMULAS as ALGEBRA_I, CLASS_NAME as ALGEBRA_I_NAME
from .algebra_ii import FORMULAS as ALGEBRA_II, CLASS_NAME as ALGEBRA_II_NAME
from .geometry import FORMULAS as GEOMETRY, CLASS_NAME as GEOMETRY_NAME
from .trig import FORMULAS as TRIG, CLASS_NAME as TRIG_NAME
from .precalculus import FORMULAS as PRECALCULUS, CLASS_NAME as PRECALCULUS_NAME
from .calculus_i import FORMULAS as CALCULUS_I, CLASS_NAME as CALCULUS_I_NAME
from .calculus_ii import FORMULAS as CALCULUS_II, CLASS_NAME as CALCULUS_II_NAME
from .calculus_iii import FORMULAS as CALCULUS_III, CLASS_NAME as CALCULUS_III_NAME
from .unit_circle import FORMULA as UNIT_CIRCLE, CLASS_NAME as UNIT_CIRCLE_NAME
from .physics_i import FORMULAS as PHYSICS_I, CLASS_NAME as PHYSICS_I_NAME
from .physics_ii import FORMULAS as PHYSICS_II, CLASS_NAME as PHYSICS_II_NAME
from .statistics_i import FORMULAS as STATISTICS_I, CLASS_NAME as STATISTICS_I_NAME
from .statistics_ii import FORMULAS as STATISTICS_II, CLASS_NAME as STATISTICS_II_NAME
from .linear_algebra_i import FORMULAS as LINEAR_ALGEBRA_I, CLASS_NAME as LINEAR_ALGEBRA_I_NAME
from .linear_algebra_ii import FORMULAS as LINEAR_ALGEBRA_II, CLASS_NAME as LINEAR_ALGEBRA_II_NAME

AVAILABLE_CLASSES = [
    PRE_ALGEBRA_NAME,
    ALGEBRA_I_NAME,
    ALGEBRA_II_NAME,
    GEOMETRY_NAME,
    TRIG_NAME,
    PRECALCULUS_NAME,
    CALCULUS_I_NAME,
    CALCULUS_II_NAME,
    CALCULUS_III_NAME,
    UNIT_CIRCLE_NAME,
    PHYSICS_I_NAME,
    PHYSICS_II_NAME,
    STATISTICS_I_NAME,
    STATISTICS_II_NAME,
    LINEAR_ALGEBRA_I_NAME,
    LINEAR_ALGEBRA_II_NAME,
]

# Classes that have categories (normal structure)
CLASSES_WITH_CATEGORIES = [
    PRE_ALGEBRA_NAME,
    ALGEBRA_I_NAME,
    ALGEBRA_II_NAME,
    GEOMETRY_NAME,
    TRIG_NAME,
    PRECALCULUS_NAME,
    CALCULUS_I_NAME,
    CALCULUS_II_NAME,
    CALCULUS_III_NAME,
    PHYSICS_I_NAME,
    PHYSICS_II_NAME,
    STATISTICS_I_NAME,
    STATISTICS_II_NAME,
    LINEAR_ALGEBRA_I_NAME,
    LINEAR_ALGEBRA_II_NAME,
]

# Special classes with no categories (single toggle)
SPECIAL_CLASSES = {
    UNIT_CIRCLE_NAME: UNIT_CIRCLE,
}

FORMULA_DATA = {
    PRE_ALGEBRA_NAME: PRE_ALGEBRA,
    ALGEBRA_I_NAME: ALGEBRA_I,
    ALGEBRA_II_NAME: ALGEBRA_II,
    GEOMETRY_NAME: GEOMETRY,
    TRIG_NAME: TRIG,
    PRECALCULUS_NAME: PRECALCULUS,
    CALCULUS_I_NAME: CALCULUS_I,
    CALCULUS_II_NAME: CALCULUS_II,
    CALCULUS_III_NAME: CALCULUS_III,
    PHYSICS_I_NAME: PHYSICS_I,
    PHYSICS_II_NAME: PHYSICS_II,
    STATISTICS_I_NAME: STATISTICS_I,
    STATISTICS_II_NAME: STATISTICS_II,
    LINEAR_ALGEBRA_I_NAME: LINEAR_ALGEBRA_I,
    LINEAR_ALGEBRA_II_NAME: LINEAR_ALGEBRA_II,
}


def get_formula_data():
    """Return the full formula data structure."""
    return FORMULA_DATA


def get_available_classes():
    """Return list of available class names."""
    return AVAILABLE_CLASSES


def get_classes_with_details():
    """Return full structure with classes, categories, and formulas."""
    result = []
    
    # Add classes with categories
    for class_name, categories in FORMULA_DATA.items():
        result.append({
            "name": class_name,
            "categories": [
                {"name": cat_name, "formulas": formulas}
                for cat_name, formulas in categories.items()
            ]
        })
    
    # Add special classes (no categories)
    for class_name, formula in SPECIAL_CLASSES.items():
        result.append({
            "name": class_name,
            "categories": [
                {"name": class_name, "formulas": [formula]}  # Single "category" that's really just the formula
            ],
            "is_special": True
        })
    
    return result


def get_special_class_formula(class_name):
    """Return the formula for a special class (no categories)."""
    return SPECIAL_CLASSES.get(class_name)


def is_special_class(class_name):
    """Check if a class is a special class (no categories)."""
    return class_name in SPECIAL_CLASSES
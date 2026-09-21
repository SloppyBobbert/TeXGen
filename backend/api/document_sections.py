"""Bounded validation for application-owned generated sections, not a TeX parser."""

import re

from .compiler import validate_source_text
from .formula_catalog import get_formula_by_id

MARKER = re.compile(r"(?m)^% @texgen-section v1 (begin|end) ([cgf]):([a-z0-9.-]+)\n")


def validate_generated_sections(value):
    """Validate the saved generation baseline; current source may contain edits."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != {"version", "baseline"} or type(value["version"]) is not int or value["version"] != 1:
        raise ValueError("Unsupported generated section metadata.")
    source = value["baseline"]
    if not isinstance(source, str) or validate_source_text(source):
        raise ValueError("Invalid generated baseline source.")
    matches = list(MARKER.finditer(source))
    if not matches or source.count("@texgen-section") != len(matches) or len(matches) > 6000:
        raise ValueError("Invalid generated section boundaries.")
    seen, stack, formulas, child_counts = set(), [], [], {}
    for match in matches:
        action, kind, formula_id = match.groups()
        key = (kind, formula_id)
        if not get_formula_by_id(formula_id):
            raise ValueError("Unknown generated section identity.")
        if action == "begin":
            expected = {0: "c", 1: "g", 2: "f"}.get(len(stack))
            if key in seen or kind != expected:
                raise ValueError("Duplicate or unordered generated section boundary.")
            seen.add(key)
            if stack:
                child_counts[stack[-1]] = child_counts.get(stack[-1], 0) + 1
            stack.append(key)
            if kind == "f":
                formulas.append(formula_id)
        elif not stack or stack.pop() != key:
            raise ValueError("Unmatched generated section boundary.")
        elif kind != "f" and not child_counts.get(key):
            raise ValueError("Empty generated group boundary.")
    if stack or not formulas:
        raise ValueError("Generated baseline is incomplete.")
    return value

"""
Reads .tex formula files from the templates_data/ directory.
Returns a nested dict  { subject: { category: [ {name, latex}, ... ] } }

Each .tex file has lines in the format:
    Formula Name | \\latex_code_here
"""

import os
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates_data"


def _prettify_name(raw_name):
    """Turn 'linear_eq' into 'Linear Eq' or 'linear_algebra' into 'Linear Algebra'."""
    return raw_name.replace("_", " ").title()


def load_all_formulas():
    formulas = {}

    if not TEMPLATES_DIR.is_dir():
        return formulas

    subject_dirs = sorted(
        entry
        for entry in TEMPLATES_DIR.iterdir()
        if entry.is_dir() and not entry.name.startswith(".")
    )

    idx = 0
    while idx < len(subject_dirs):
        subject_path = subject_dirs[idx]
        subject_name = _prettify_name(subject_path.name)
        formulas[subject_name] = {}

        tex_files = sorted(subject_path.glob("*.tex"))
        file_idx = 0
        while file_idx < len(tex_files):
            tex_file = tex_files[file_idx]
            category_name = _prettify_name(tex_file.stem)
            entries = []

            with open(tex_file, "r", encoding="utf-8") as fh:
                lines = fh.readlines()

            line_idx = 0
            while line_idx < len(lines):
                line = lines[line_idx].strip()
                if line and "|" in line:
                    parts = line.split("|", 1)
                    name = parts[0].strip()
                    latex = parts[1].strip()
                    if name and latex:
                        entries.append({"name": name, "latex": latex})
                line_idx += 1

            if entries:
                formulas[subject_name][category_name] = entries

            file_idx += 1

        idx += 1

    return formulas

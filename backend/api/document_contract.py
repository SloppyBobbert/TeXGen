"""Canonical/legacy document API translation and validation."""

from rest_framework import serializers

from .compiler import validate_source_text
from .formula_catalog import get_formula_by_id, get_formula_by_legacy_alias

VALID_FONT_SIZES = {"8pt", "9pt", "10pt", "11pt", "12pt"}
VALID_SPACING = {"tiny", "small", "medium", "large"}
VALID_MARGINS = {"0.15in", "0.25in", "0.5in", "0.75in", "1in", "1.5in", "2in"}
VALID_ORIENTATION = {"portrait", "landscape"}
MAX_SELECTIONS = 1000


def _custom_pt(value, minimum, maximum):
    if not isinstance(value, str) or not value.endswith("pt"):
        return False
    try:
        amount = float(value[:-2])
    except ValueError:
        return False
    return minimum <= amount <= maximum


def validate_layout(layout):
    if not isinstance(layout, dict) or set(layout) - {"columns", "font_size", "spacing", "margins", "orientation"}:
        raise serializers.ValidationError("layout must contain only supported layout fields")
    required = {"columns", "font_size", "spacing", "margins", "orientation"}
    if set(layout) != required:
        raise serializers.ValidationError("layout must contain all supported layout fields")
    columns = layout["columns"]
    if type(columns) is not int or not 1 <= columns <= 5:
        raise serializers.ValidationError({"columns": "Must be an integer from 1 through 5."})
    for key, allowed, minimum, maximum in (
        ("font_size", VALID_FONT_SIZES, 6, 18),
        ("spacing", VALID_SPACING, 0, 6),
    ):
        value = layout[key]
        if not isinstance(value, str) or not value or (value not in allowed and not _custom_pt(value, minimum, maximum)):
            raise serializers.ValidationError({key: "Unsupported layout value."})
    if layout["margins"] not in VALID_MARGINS:
        raise serializers.ValidationError({"margins": "Unsupported layout value."})
    if layout["orientation"] not in VALID_ORIENTATION:
        raise serializers.ValidationError({"orientation": "Unsupported layout value."})
    return layout


def canonical_selections(value):
    if not isinstance(value, list) or len(value) > MAX_SELECTIONS:
        raise serializers.ValidationError("formula_selections must be a list with at most 1000 entries")
    ids, result = set(), []
    for selection in value:
        if not isinstance(selection, dict) or set(selection) != {"formula_id"} or not isinstance(selection["formula_id"], str):
            raise serializers.ValidationError("Each formula selection must contain exactly formula_id")
        formula_id = selection["formula_id"]
        if formula_id in ids:
            raise serializers.ValidationError("Duplicate formula selection")
        if not get_formula_by_id(formula_id):
            raise serializers.ValidationError("Unknown formula_id")
        ids.add(formula_id)
        result.append({"formula_id": formula_id})
    return result


def legacy_selections(value):
    if not isinstance(value, list) or len(value) > MAX_SELECTIONS:
        raise serializers.ValidationError("selected_formulas must be a list with at most 1000 entries")
    ids, result = set(), []
    for selection in value:
        if not isinstance(selection, dict) or set(selection) - {"class", "class_name", "category", "name"}:
            raise serializers.ValidationError("Each selected formula must be an object")
        record = get_formula_by_legacy_alias(selection.get("class") or selection.get("class_name"), selection.get("category"), selection.get("name"))
        if not record:
            raise serializers.ValidationError("Unknown selected formula")
        if record["id"] in ids:
            raise serializers.ValidationError("Duplicate formula selection")
        ids.add(record["id"])
        result.append({"formula_id": record["id"]})
    return result


def to_legacy_selections(selections):
    return [
        {"class": record["class"], "category": record["category"], "name": record["name"]}
        for selection in selections
        if (record := get_formula_by_id(selection.get("formula_id")))
    ]


class DocumentContractSerializer(serializers.ModelSerializer):
    """Adds canonical fields while accepting either API representation."""

    source_latex = serializers.SerializerMethodField()
    layout = serializers.SerializerMethodField()

    def _legacy_mode(self, source_mode):
        return "manual" if source_mode == "raw" else source_mode

    def _legacy_layout(self, obj):
        prefix = "default_" if hasattr(obj, "default_columns") else ""
        return {
            "columns": getattr(obj, f"{prefix}columns"),
            "font_size": getattr(obj, f"{prefix}font_size", "9pt"),
            "spacing": getattr(obj, f"{prefix}spacing", "small"),
            "margins": getattr(obj, f"{prefix}margins"),
            "orientation": getattr(obj, f"{prefix}orientation", "portrait"),
        }

    def get_source_latex(self, obj):
        return obj.latex_content

    def get_layout(self, obj):
        return self._legacy_layout(obj)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        legacy = None
        try:
            selections = canonical_selections(obj.formula_selections) if obj.formula_selections is not None else legacy_selections(obj.selected_formulas)
        except serializers.ValidationError:
            # Pre-contract rows can contain old, incomplete display records. They
            # remain readable while new writes must use catalog-backed records.
            selections, legacy = [], obj.selected_formulas
        data["formula_selections"] = selections
        data["selected_formulas"] = legacy if legacy is not None else to_legacy_selections(selections)
        data["source_mode"] = obj.source_mode
        data["content_source"] = self._legacy_mode(obj.source_mode)
        layout = self._legacy_layout(obj)
        data["layout"] = layout
        data.update(layout)
        return data

    def to_internal_value(self, data):
        data = data.copy()
        errors = {}
        canonical_source = data.pop("source_latex", serializers.empty)
        legacy_source = data.get("latex_content", serializers.empty)
        if canonical_source is not serializers.empty:
            if legacy_source is not serializers.empty and canonical_source != legacy_source:
                errors["source_latex"] = "Conflicts with latex_content."
            data["latex_content"] = canonical_source

        canonical_mode = data.get("source_mode", serializers.empty)
        legacy_mode = data.pop("content_source", serializers.empty)
        if canonical_mode is not serializers.empty and canonical_mode not in {"empty", "generated", "raw"}:
            errors["source_mode"] = "Must be empty, generated, or raw."
        mapped_legacy_mode = {"manual": "raw", "empty": "empty", "generated": "generated"}.get(legacy_mode)
        if legacy_mode is not serializers.empty and mapped_legacy_mode is None:
            errors["content_source"] = "Must be empty, generated, or manual."
        if canonical_mode is not serializers.empty and mapped_legacy_mode and canonical_mode != mapped_legacy_mode:
            errors["source_mode"] = "Conflicts with content_source."
        if canonical_mode is serializers.empty and mapped_legacy_mode:
            data["source_mode"] = mapped_legacy_mode

        canonical = data.get("formula_selections", serializers.empty)
        legacy = data.get("selected_formulas", serializers.empty)
        try:
            canonical_value = canonical_selections(canonical) if canonical is not serializers.empty else None
            legacy_value = legacy_selections(legacy) if legacy is not serializers.empty else None
            if canonical_value is not None and legacy_value is not None and canonical_value != legacy_value:
                errors["formula_selections"] = "Conflicts with selected_formulas."
            if canonical_value is None and legacy_value is not None:
                canonical_value = legacy_value
            if canonical_value is not None:
                data["formula_selections"] = canonical_value
                data["selected_formulas"] = to_legacy_selections(canonical_value)
        except serializers.ValidationError as exc:
            errors["formula_selections"] = exc.detail

        layout = data.pop("layout", serializers.empty)
        prefix = "default_" if self.Meta.model.__name__ == "Template" else ""
        legacy_layout = {
            key: data.get(f"{prefix}{key}", data.get(key, serializers.empty))
            for key in ("columns", "font_size", "spacing", "margins", "orientation")
        }
        if layout is not serializers.empty:
            try:
                layout = validate_layout(layout)
                for key, value in layout.items():
                    legacy_value = legacy_layout[key]
                    if legacy_value is not serializers.empty and legacy_value != value:
                        errors["layout"] = f"Conflicts with {key}."
                    data[f"{prefix}{key}"] = value
            except serializers.ValidationError as exc:
                errors["layout"] = exc.detail
        else:
            supplied = {key: value for key, value in legacy_layout.items() if value is not serializers.empty}
            if supplied:
                current = self._legacy_layout(self.instance) if self.instance else {"columns": 4, "font_size": "9pt", "spacing": "small", "margins": "0.15in", "orientation": "portrait"}
                try:
                    validate_layout({**current, **supplied})
                except serializers.ValidationError as exc:
                    errors["layout"] = exc.detail
        if prefix:
            for key in ("columns", "font_size", "spacing", "margins", "orientation"):
                if key in data:
                    data[f"default_{key}"] = data.pop(key)
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def validate(self, attrs):
        schema_version = attrs.get("schema_version", getattr(self.instance, "schema_version", 1))
        if schema_version != 1:
            raise serializers.ValidationError({"schema_version": "Only schema version 1 is supported."})
        source = attrs.get("latex_content", getattr(self.instance, "latex_content", ""))
        source_mode = attrs.get("source_mode", getattr(self.instance, "source_mode", "empty"))
        # Only legacy payloads without either mode preserve the old inference.
        if "source_mode" not in attrs and "source_mode" not in self.initial_data and "content_source" not in self.initial_data and "latex_content" in attrs:
            source_mode = "empty" if not source.strip() else "raw"
            attrs["source_mode"] = source_mode
        source_error = validate_source_text(source)
        if source_error:
            raise serializers.ValidationError({"source_latex": source_error})
        if not source.strip() and source_mode != "empty":
            raise serializers.ValidationError({"source_mode": "Blank source requires empty mode."})
        if source_mode == "empty" and source.strip():
            raise serializers.ValidationError({"source_mode": "Empty mode requires blank source."})
        return attrs

    def create(self, validated_data):
        validated_data["schema_version"] = 1
        validated_data["revision"] = 1
        if "source_mode" in validated_data and hasattr(self.Meta.model, "content_source"):
            validated_data["content_source"] = self._legacy_mode(validated_data["source_mode"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "source_mode" in validated_data and hasattr(instance, "content_source"):
            validated_data["content_source"] = self._legacy_mode(validated_data["source_mode"])
        return super().update(instance, validated_data)

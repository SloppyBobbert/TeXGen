from typing import cast

import pytest
from rest_framework.response import Response
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_generate_accepts_equivalent_canonical_and_legacy_selections_in_order():
    client = APIClient()
    legacy = [
        {"class": "CALCULUS III", "category": "Vector Calculus", "name": "Divergence"},
        {"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"},
    ]
    canonical = [
        {"formula_id": "calculus-iii.divergence"},
        {"formula_id": "algebra-i.slope-formula"},
    ]

    legacy_response = cast(Response, client.post("/api/generate-sheet/", {"formulas": legacy}, format="json"))
    canonical_response = cast(Response, client.post("/api/generate-sheet/", {"formula_selections": canonical}, format="json"))

    assert canonical_response.status_code == legacy_response.status_code == 200
    assert canonical_response.data == legacy_response.data


@pytest.mark.django_db
def test_generated_sections_keep_checked_in_ids_and_exact_baseline_on_save_reload():
    from django.contrib.auth import get_user_model

    client = APIClient()
    selections = [{"formula_id": "algebra-i.slope-formula"}]
    generated = cast(Response, client.post("/api/generate-sheet/", {"formula_selections": selections}, format="json")).data
    assert isinstance(generated, dict)
    source = generated["tex_code"]
    assert "% @texgen-section v1 begin f:algebra-i.slope-formula\n" in source
    assert generated["generated_sections"] == {"version": 1, "baseline": source}
    client.force_authenticate(get_user_model().objects.create_user(username="sections-owner"))
    saved = cast(Response, client.post("/api/cheatsheets/", {
        "title": "Sections", "source_latex": source, "source_mode": "generated",
        "formula_selections": selections, "generated_sections": generated["generated_sections"],
    }, format="json"))
    assert saved.status_code == 201, saved.data
    assert isinstance(saved.data, dict)
    reloaded = cast(Response, client.get(f"/api/cheatsheets/{saved.data['id']}/")).data
    assert isinstance(reloaded, dict)
    assert reloaded["generated_sections"] == generated["generated_sections"]
    assert reloaded["source_latex"] == source


@pytest.mark.django_db
@pytest.mark.parametrize("metadata", [
    {"version": 2, "baseline": "x"},
    {"version": True, "baseline": "x"},
    {"version": 1, "baseline": "x", "extra": 1},
    {"version": 1, "baseline": "x" * 262145},
    {"version": 1, "baseline": 42},
    {"version": 1, "baseline": "% @texgen-section v1 begin f:unknown.formula\n"},
])
def test_save_rejects_invalid_section_metadata(metadata):
    from django.contrib.auth import get_user_model

    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user(username="invalid-sections"))
    result = cast(Response, client.post("/api/cheatsheets/", {
        "title": "Invalid", "source_latex": "keep me", "source_mode": "raw",
        "generated_sections": metadata,
    }, format="json"))
    assert result.status_code == 400
    assert isinstance(result.data, dict)
    assert "generated_sections" in result.data


@pytest.mark.django_db
def test_template_creation_keeps_the_generation_baseline():
    from django.contrib.auth import get_user_model

    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user(username="template-sections", is_staff=True))
    selection = [{"formula_id": "algebra-i.slope-formula"}]
    generated = cast(Response, client.post("/api/generate-sheet/", {"formula_selections": selection}, format="json")).data
    assert isinstance(generated, dict)
    template = cast(Response, client.post("/api/templates/", {
        "name": "Sections", "subject": "Math", "source_latex": generated["tex_code"],
        "source_mode": "generated", "formula_selections": selection,
        "generated_sections": generated["generated_sections"],
    }, format="json"))
    assert template.status_code == 201, template.data
    assert isinstance(template.data, dict)
    sheet = cast(Response, client.post("/api/cheatsheets/from-template/", {"template_id": template.data["id"]}, format="json"))
    assert sheet.status_code == 201, sheet.data
    assert isinstance(sheet.data, dict)
    assert sheet.data["generated_sections"] == generated["generated_sections"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"formula_selections": [{"formula_id": "missing.nope"}]},
        {"formula_selections": [{"formula_id": "algebra-i.slope-formula"}, {"formula_id": "algebra-i.slope-formula"}]},
        {"formula_selections": [{"id": "algebra-i.slope-formula"}]},
        {"formula_selections": [{"formula_id": "algebra-i.slope-formula"}], "formulas": [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}]},
    ],
)
def test_generate_rejects_invalid_or_duplicate_resolved_selections(payload):
    response = cast(Response, APIClient().post("/api/generate-sheet/", payload, format="json"))
    assert response.status_code == 400

import pytest
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

    legacy_response = client.post("/api/generate-sheet/", {"formulas": legacy}, format="json")
    canonical_response = client.post("/api/generate-sheet/", {"formula_selections": canonical}, format="json")

    assert canonical_response.status_code == legacy_response.status_code == 200
    assert canonical_response.data == legacy_response.data


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
    response = APIClient().post("/api/generate-sheet/", payload, format="json")
    assert response.status_code == 400

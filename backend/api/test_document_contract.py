import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient

from api.formula_catalog import FORMULAS


@pytest.fixture
def client(db):
    user = User.objects.create_user("contract-user", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def payload(formula_id=None, **extra):
    data = {
        "title": "  Contract sheet  ",
        "source_latex": "x+y",
        "source_mode": "raw",
        "layout": {"columns": 2, "font_size": "10pt", "spacing": "small", "margins": "0.5in", "orientation": "portrait"},
        "formula_selections": [] if formula_id is None else [{"formula_id": formula_id}],
    }
    data.update(extra)
    return data


@pytest.mark.django_db
def test_canonical_create_emits_dual_contract_and_legacy_round_trips(client):
    formula = FORMULAS[0]
    response = client.post("/api/cheatsheets/", payload(formula["id"]), format="json")
    assert response.status_code == 201
    document = response.data
    assert document["schema_version"] == document["revision"] == 1
    assert document["source_mode"] == "raw"
    assert document["content_source"] == "manual"
    assert document["source_latex"] == document["latex_content"] == "x+y"
    assert document["formula_selections"] == [{"formula_id": formula["id"]}]
    assert document["selected_formulas"] == [{"class": formula["class"], "category": formula["category"], "name": formula["name"]}]
    assert document["layout"]["columns"] == document["columns"] == 2


@pytest.mark.django_db
def test_empty_selection_is_authoritative_and_dual_conflicts_are_rejected(client):
    created = client.post("/api/cheatsheets/", payload(), format="json").data
    response = client.patch(f"/api/cheatsheets/{created['id']}/", {"revision": 1, "formula_selections": []}, format="json")
    assert response.status_code == 200
    assert response.data["formula_selections"] == []
    response = client.patch(
        f"/api/cheatsheets/{created['id']}/",
        {"revision": 2, "source_latex": "one", "latex_content": "two"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_template_id_is_canonical_alias_and_conflicts_with_template(client):
    from api.models import Template

    first = Template.objects.create(name="First", subject="math", latex_content="", source_mode="empty")
    second = Template.objects.create(name="Second", subject="math", latex_content="", source_mode="empty")
    response = client.post("/api/cheatsheets/", payload(template_id=first.id), format="json")
    assert response.status_code == 201
    assert response.data["template_id"] == response.data["template"] == first.id

    conflict = client.post(
        "/api/cheatsheets/", payload(template_id=first.id, template=second.id), format="json"
    )
    assert conflict.status_code == 400
    assert "template_id" in conflict.data


@pytest.mark.django_db
def test_unknown_or_duplicate_formula_ids_are_rejected(client):
    response = client.post("/api/cheatsheets/", payload("missing.nope"), format="json")
    assert response.status_code == 400
    formula_id = FORMULAS[0]["id"]
    response = client.post("/api/cheatsheets/", payload(formula_selections=[{"formula_id": formula_id}, {"formula_id": formula_id}]), format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_classes_include_stable_formula_ids(client):
    response = client.get("/api/classes/")
    formulas = [formula for class_data in response.data["classes"] for category in class_data.get("categories", []) for formula in category.get("formulas", [])]
    assert formulas and all("id" in formula for formula in formulas)


@pytest.mark.django_db
@override_settings(COMPILER_SOURCE_MAX_BYTES=4)
def test_document_source_obeys_utf8_byte_limit(client):
    assert client.post("/api/cheatsheets/", payload(source_latex="éé"), format="json").status_code == 201
    assert client.post("/api/cheatsheets/", payload(source_latex="ééé"), format="json").status_code == 400

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from api.models import Template


@pytest.fixture
def client(db):
    user = User.objects.create_user("revision-user", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def create(client):
    response = client.post("/api/cheatsheets/", {"title": "Sheet", "source_latex": "x", "source_mode": "raw", "layout": {"columns": 1, "font_size": "9pt", "spacing": "small", "margins": "0.15in", "orientation": "portrait"}, "formula_selections": []}, format="json")
    assert response.status_code == 201
    return response.data


@pytest.mark.django_db
def test_updates_require_matching_revision_and_return_current_document(client):
    sheet = create(client)
    missing = client.patch(f"/api/cheatsheets/{sheet['id']}/", {"title": "No revision"}, format="json")
    assert missing.status_code == 428 and missing.data["code"] == "revision_required"
    updated = client.patch(f"/api/cheatsheets/{sheet['id']}/", {"revision": 1, "title": "Updated"}, format="json")
    assert updated.status_code == 200 and updated.data["revision"] == 2
    stale = client.patch(f"/api/cheatsheets/{sheet['id']}/", {"revision": 1, "title": "Stale"}, format="json")
    assert stale.status_code == 409
    assert stale.data["code"] == "revision_conflict"
    assert stale.data["document"]["revision"] == 2
    assert stale.data["current"]["revision"] == 2
    assert "detail" in stale.data


@pytest.mark.django_db
def test_validation_failure_does_not_increment_revision(client):
    sheet = create(client)
    failed = client.patch(f"/api/cheatsheets/{sheet['id']}/", {"revision": 1, "layout": {"columns": 99}}, format="json")
    assert failed.status_code == 400
    current = client.get(f"/api/cheatsheets/{sheet['id']}/")
    assert current.data["revision"] == 1


@pytest.mark.django_db
def test_reads_compile_and_generate_do_not_increment_revision(client):
    sheet = create(client)

    assert client.get(f"/api/cheatsheets/{sheet['id']}/").status_code == 200
    assert client.post("/api/generate-sheet/", {"formula_selections": []}, format="json").status_code == 200
    assert client.post(
        "/api/compile/", {"cheat_sheet_id": sheet["id"], "normalize_only": True}, format="json"
    ).status_code == 200
    assert client.get(f"/api/cheatsheets/{sheet['id']}/").data["revision"] == 1


@pytest.mark.django_db
def test_other_owner_update_is_not_found_without_revision_increment(client):
    owner = APIClient()
    user = User.objects.create_user("owner", password="password123")
    owner.force_authenticate(user=user)
    sheet = create(owner)

    assert client.patch(f"/api/cheatsheets/{sheet['id']}/", {"revision": 1, "title": "Nope"}, format="json").status_code == 404
    assert owner.get(f"/api/cheatsheets/{sheet['id']}/").data["revision"] == 1


@pytest.mark.django_db
def test_template_writes_are_staff_only_and_from_template_copies_canonical_state(client):
    template = Template.objects.create(
        name="Template", subject="math", latex_content="x", source_mode="raw",
        formula_selections=[], selected_formulas=[], default_columns=2, default_font_size="10pt",
        default_spacing="tiny", default_margins="0.5in", default_orientation="landscape",
    )
    assert client.patch(f"/api/templates/{template.id}/", {"revision": 1, "name": "No"}, format="json").status_code == 403
    copied = client.post("/api/cheatsheets/from-template/", {"template_id": template.id}, format="json")
    assert copied.status_code == 201
    assert copied.data["revision"] == 1
    assert copied.data["source_mode"] == "raw"
    assert copied.data["layout"] == {"columns": 2, "font_size": "10pt", "spacing": "tiny", "margins": "0.5in", "orientation": "landscape"}


@pytest.mark.django_db
def test_staff_template_update_uses_revision_and_rejects_stale(client):
    user = client.handler._force_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    template = Template.objects.create(name="Template", subject="math", latex_content="", source_mode="empty")

    updated = client.patch(f"/api/templates/{template.id}/", {"revision": 1, "name": "Updated"}, format="json")
    assert updated.status_code == 200
    assert updated.data["revision"] == 2
    stale = client.patch(f"/api/templates/{template.id}/", {"revision": 1, "name": "Stale"}, format="json")
    assert stale.status_code == 409
    assert stale.data["current"]["revision"] == 2


@pytest.mark.django_db
def test_template_flat_layout_aliases_map_to_defaults_and_conflict_with_layout(client):
    user = client.handler._force_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    template = Template.objects.create(name="Template", subject="math", latex_content="", source_mode="empty")

    updated = client.patch(
        f"/api/templates/{template.id}/",
        {"revision": 1, "columns": 2, "font_size": "10pt", "spacing": "tiny", "margins": "0.5in", "orientation": "landscape"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["layout"] == {"columns": 2, "font_size": "10pt", "spacing": "tiny", "margins": "0.5in", "orientation": "landscape"}
    conflict = client.patch(
        f"/api/templates/{template.id}/",
        {"revision": 2, "columns": 3, "layout": {"columns": 2, "font_size": "10pt", "spacing": "tiny", "margins": "0.5in", "orientation": "landscape"}},
        format="json",
    )
    assert conflict.status_code == 400


@pytest.mark.django_db
def test_from_template_rejects_invalid_canonical_selection(client):
    template = Template.objects.create(
        name="Invalid", subject="math", latex_content="", source_mode="empty",
        formula_selections=[{"formula_id": "missing.nope"}], selected_formulas=[],
    )

    response = client.post("/api/cheatsheets/from-template/", {"template_id": template.id}, format="json")
    assert response.status_code == 400

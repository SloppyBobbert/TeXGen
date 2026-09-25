"""Regression coverage for expanded-audit B1-B3 trust boundaries."""

import json

import pytest
from django.contrib.auth.models import User

from api.models import Template
from api.serializers import CheatSheetSerializer, TemplateSerializer

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("endpoint", ["generate-sheet", "compile"])
@pytest.mark.parametrize("field", ["font_size", "margins", "spacing", "orientation"])
@pytest.mark.parametrize("value", [[], {}, None, 3, True])
def test_layout_types_return_400(api_client, endpoint, field, value):
    api_client.force_authenticate(User.objects.create_user(username="layout-user"))
    response = api_client.post(
        f"/api/{endpoint}/",
        {"content": "hello", "normalize_only": True, field: value},
        format="json",
    )
    assert response.status_code == 400
    assert field in response.json()


@pytest.mark.parametrize("endpoint", ["generate-sheet", "compile", "cheatsheets", "templates", "cheatsheets/from-template"])
@pytest.mark.parametrize("body", [[], ["template"], "text", 42, None])
def test_non_object_api_body_returns_400(api_client, endpoint, body):
    api_client.force_authenticate(User.objects.create_user(username="body-user", is_staff=True))
    response = api_client.post(
        f"/api/{endpoint}/", json.dumps(body), content_type="application/json"
    )
    assert response.status_code == 400


@pytest.mark.parametrize("serializer_class", [CheatSheetSerializer, TemplateSerializer])
@pytest.mark.parametrize("body", [[], ["template"], "text", 42, None])
def test_document_serializer_rejects_non_object(serializer_class, body):
    serializer = serializer_class(data=body)
    assert not serializer.is_valid()


@pytest.mark.parametrize("serializer_class", [CheatSheetSerializer, TemplateSerializer])
@pytest.mark.parametrize("field", ["margins", "orientation", "source_mode", "content_source"])
@pytest.mark.parametrize("value", [[], {}])
def test_document_preprocessing_rejects_unhashable_fields(serializer_class, field, value):
    serializer = serializer_class(data={"name": "Template", "title": "Sheet", field: value})
    assert not serializer.is_valid()
    assert ("layout" if field in {"margins", "orientation"} else field) in serializer.errors


@pytest.mark.parametrize("serializer_class", [CheatSheetSerializer, TemplateSerializer])
@pytest.mark.parametrize("field", ["margins", "orientation"])
def test_canonical_layout_rejects_unhashable_fields(serializer_class, field):
    layout = {"columns": 4, "font_size": "9pt", "spacing": "small", "margins": "0.15in", "orientation": "portrait"}
    layout[field] = []
    serializer = serializer_class(data={"name": "Template", "title": "Sheet", "layout": layout})
    assert not serializer.is_valid()
    assert "layout" in serializer.errors


@pytest.mark.parametrize("endpoint,serializer_class", [("templates", TemplateSerializer), ("cheatsheets", CheatSheetSerializer)])
@pytest.mark.parametrize("body", [[], "text", 42, None])
def test_non_object_document_update_returns_400(api_client, endpoint, serializer_class, body):
    user = User.objects.create_user(username="update-user", is_staff=True)
    api_client.force_authenticate(user)
    serializer = serializer_class(data={"name": "Template", "title": "Sheet", "subject": "Math", "latex_content": "hello"})
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save(**({"user": user} if endpoint == "cheatsheets" else {}))
    response = api_client.patch(f"/api/{endpoint}/{instance.pk}/", json.dumps(body), content_type="application/json")
    assert response.status_code == 400


@pytest.mark.parametrize("field,valid,invalid", [
    ("columns", 4, 99), ("font_size", "9pt", "99pt"),
    ("spacing", "small", "99pt"), ("margins", "0.15in", "99in"),
    ("orientation", "portrait", "diagonal"),
])
@pytest.mark.parametrize("update", [False, True])
def test_template_alias_conflicts_rejected(field, valid, invalid, update):
    instance = Template.objects.create(name="Existing", subject="Math", latex_content="hello") if update else None
    serializer = TemplateSerializer(instance, data={
        "name": "Template", "subject": "Math", "latex_content": "hello",
        f"default_{field}": valid, field: invalid,
    }, partial=update)
    assert not serializer.is_valid()
    assert "layout" in serializer.errors
    if instance:
        instance.refresh_from_db()
        assert getattr(instance, f"default_{field}") == valid
    else:
        assert not Template.objects.exists()


@pytest.mark.parametrize("alias_form", ["bare", "default", "matching", "canonical_matching"])
def test_template_supported_aliases_persist(alias_form):
    layout = {"columns": 3, "font_size": "10.5pt", "spacing": "0.6pt", "margins": "0.5in", "orientation": "landscape"}
    data = {"name": "Template", "subject": "Math", "latex_content": "hello"}
    if alias_form != "default":
        data.update(layout)
    if alias_form != "bare":
        data.update({f"default_{key}": value for key, value in layout.items()})
    if alias_form == "canonical_matching":
        data["layout"] = layout
    serializer = TemplateSerializer(data=data)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()
    instance.refresh_from_db()
    assert TemplateSerializer(instance).data["layout"] == layout


def test_template_canonical_and_hidden_bare_alias_conflict():
    serializer = TemplateSerializer(data={
        "name": "Template", "subject": "Math", "latex_content": "hello",
        "layout": {"columns": 4, "font_size": "9pt", "spacing": "small", "margins": "0.15in", "orientation": "portrait"},
        "default_margins": "0.15in", "margins": "0.5in",
    })
    assert not serializer.is_valid()
    assert "layout" in serializer.errors


@pytest.mark.parametrize("password", ["OrchidNebula8472x", "short", "password"])
def test_registration_rejects_weak_password_without_saving(api_client, password):
    response = api_client.post("/api/register/", {"username": "OrchidNebula8472x", "password": password}, format="json")
    assert response.status_code == 400
    assert set(response.json()) == {"password"}
    assert isinstance(response.json()["password"], list)
    assert response.json()["password"]
    assert not User.objects.filter(username="OrchidNebula8472x").exists()


def test_registration_accepts_unrelated_password_and_hashes_it(api_client):
    password = "CobaltRiver!9537"
    response = api_client.post("/api/register/", {"username": "OrchidNebula8472x", "password": password}, format="json")
    assert response.status_code == 201
    assert "password" not in response.json()
    user = User.objects.get(username="OrchidNebula8472x")
    assert user.password != password
    assert user.check_password(password)

from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APIClient

from api.models import CheatSheet
from api.views import CompileUserThrottle, compile_latex


@pytest.fixture
def authenticated_client(db):
    client = APIClient()
    user = User.objects.create_user(username="compiler-user", password="testpass123")
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"content": "raw content"},
        {"cheat_sheet_id": "not-an-id"},
        {"content": "raw content", "normalize_only": True},
    ],
)
def test_unauthenticated_compilation_stops_before_downstream_work(payload):
    client = APIClient()

    with (
        patch("api.views.is_truthy") as is_truthy,
        patch("api.views.validate_layout_params") as validate_layout,
        patch("api.views.validate_cheat_sheet_id") as validate_sheet_id,
        patch("api.views.get_object_or_404") as get_sheet,
        patch("api.views.validate_source_text") as validate_source,
        patch("api.views.normalize_latex_layout") as normalize,
        patch("api.views.tempfile.TemporaryDirectory") as temporary_directory,
        patch("api.views.subprocess.run") as compile_process,
    ):
        response = client.post("/api/compile/", payload, format="json")

    assert response.status_code == 401
    for downstream_call in (
        is_truthy,
        validate_layout,
        validate_sheet_id,
        get_sheet,
        validate_source,
        normalize,
        temporary_directory,
        compile_process,
    ):
        downstream_call.assert_not_called()


@pytest.mark.django_db
def test_authenticated_raw_content_reaches_normalize_only_branch(authenticated_client):
    with (
        patch("api.views.validate_source_text", return_value=None) as validate_source,
        patch("api.views.normalize_latex_layout", return_value="normalized") as normalize,
    ):
        response = authenticated_client.post(
            "/api/compile/",
            {"content": "raw content", "normalize_only": True},
            format="json",
        )

    assert response.status_code == 200
    assert response.json()["tex_code"] == "normalized"
    validate_source.assert_called_once_with("raw content")
    normalize.assert_called_once()


@pytest.mark.django_db
def test_authenticated_sheet_compile_uses_owner_scoped_sheet(authenticated_client):
    user = authenticated_client.handler._force_user
    sheet = CheatSheet.objects.create(title="Owned", latex_content="sheet content", user=user)

    with patch("api.views.normalize_latex_layout", return_value="normalized") as normalize:
        response = authenticated_client.post(
            "/api/compile/",
            {"cheat_sheet_id": sheet.id, "normalize_only": True},
            format="json",
        )

    assert response.status_code == 200
    normalize.assert_called_once()


@pytest.mark.django_db
def test_authenticated_sheet_compile_returns_404_for_another_owner(authenticated_client):
    other_user = User.objects.create_user(username="sheet-owner", password="testpass123")
    sheet = CheatSheet.objects.create(title="Private", latex_content="content", user=other_user)

    with patch("api.views.normalize_latex_layout") as normalize:
        response = authenticated_client.post(
            "/api/compile/",
            {"cheat_sheet_id": sheet.id, "normalize_only": True},
            format="json",
        )

    assert response.status_code == 404
    normalize.assert_not_called()


@pytest.mark.django_db
def test_authenticated_raw_content_reaches_compilation_branch(authenticated_client, tmp_path):
    def create_pdf(*args, **kwargs):
        (tmp_path / "document.pdf").write_bytes(b"%PDF-1.4")

    with (
        patch("api.views.normalize_latex_layout", return_value="normalized"),
        patch("api.views.tempfile.TemporaryDirectory") as temporary_directory,
        patch("api.views.subprocess.run", side_effect=create_pdf) as compile_process,
    ):
        temporary_directory.return_value.__enter__.return_value = str(tmp_path)
        response = authenticated_client.post(
            "/api/compile/", {"content": "raw content"}, format="json"
        )

    assert response.status_code == 200
    compile_process.assert_called_once()


def test_compile_uses_only_the_authenticated_user_throttle():
    cache.clear()
    assert compile_latex.cls.throttle_classes == [CompileUserThrottle]

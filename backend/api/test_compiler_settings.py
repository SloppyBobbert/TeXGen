import runpy
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

SETTINGS_PATH = Path(__file__).parents[1] / "cheat_sheet" / "settings.py"


@pytest.mark.parametrize(("debug", "connection_age"), [("True", 0), ("False", 600)])
def test_database_connections_close_per_request_in_development_only(monkeypatch, debug, connection_age):
    monkeypatch.setenv("DJANGO_DEBUG", debug)
    monkeypatch.setenv("DJANGO_SECRET_KEY", "settings-regression-test-only")
    loaded = runpy.run_path(str(SETTINGS_PATH))
    assert loaded["DATABASES"]["default"]["CONN_MAX_AGE"] == connection_age


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("COMPILER_SOURCE_MAX_BYTES", str(256 * 1024 + 1)),
        ("COMPILER_DIAGNOSTICS_MAX_BYTES", str(4 * 1024 + 1)),
        ("COMPILER_TIMEOUT_SECONDS", "nan"),
        ("COMPILER_TIMEOUT_SECONDS", "inf"),
        ("COMPILER_TIMEOUT_SECONDS", "-inf"),
    ],
)
def test_settings_reject_compiler_nonfinite_and_protocol_hard_maximum_values(monkeypatch, name, value):
    monkeypatch.setenv(name, value)

    with pytest.raises(ImproperlyConfigured):
        runpy.run_path(str(SETTINGS_PATH))


def test_settings_accepts_512_mib_address_space_limit_and_rejects_one_byte_more(monkeypatch):
    maximum = 512 * 1024 * 1024
    monkeypatch.delenv("COMPILER_ADDRESS_SPACE_BYTES", raising=False)
    assert runpy.run_path(str(SETTINGS_PATH))["COMPILER_ADDRESS_SPACE_BYTES"] == maximum

    monkeypatch.setenv("COMPILER_ADDRESS_SPACE_BYTES", str(maximum))
    assert runpy.run_path(str(SETTINGS_PATH))["COMPILER_ADDRESS_SPACE_BYTES"] == maximum

    monkeypatch.setenv("COMPILER_ADDRESS_SPACE_BYTES", str(maximum + 1))
    with pytest.raises(ImproperlyConfigured, match="COMPILER_ADDRESS_SPACE_BYTES"):
        runpy.run_path(str(SETTINGS_PATH))

import socket
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager, nullcontext
from dataclasses import asdict
from functools import partial
from threading import Thread
from unittest.mock import Mock, patch

import pytest
from django.core.cache import cache
from django.db import DatabaseError, close_old_connections, connection
from rest_framework.test import APIClient

from api.compilation.sidecar import SidecarCompilerClient
from api.compilation.types import CompileResult, CompilerResourceLimit, CompilerSyntaxError, CompilerTimeout
from compiler_sidecar import protocol
from compiler_sidecar.server import SidecarServer
from api.guest_quota import COOKIE, reserve
from api.models import GuestCompileBalance

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def limits(settings):
    cache.clear()
    settings.REQUEST_THROTTLE_ENABLED = False
    settings.COMPILER_USER_RATE = "1000/hour"


def compiler():
    execute = Mock(return_value=CompileResult(pdf=b"%PDF-1.4 guest"))
    service = Mock()
    service.prepare.return_value = nullcontext(execute)
    return service, execute


def post(client):
    return client.post("/api/compile/", {"content": "source", "source_mode": "raw"}, format="json")


def test_three_successes_then_login_required_across_reopened_browser():
    client = APIClient()
    assert client.get("/api/compile/").json() == {"remaining": 3}
    identity = client.cookies[COOKIE].value
    service, execute = compiler()
    with patch("api.views.get_compiler_service", return_value=service):
        for remaining in [2, 1, 0]:
            response = post(client)
            assert response.status_code == 200
            assert response["X-Guest-Compiles-Remaining"] == str(remaining)
            assert client.cookies[COOKIE].value.split(":")[0] == identity.split(":")[0]
            reopened = APIClient()
            reopened.cookies = client.cookies
            client = reopened
            assert client.get("/api/compile/").json() == {"remaining": remaining}
        denied = post(client)
    assert denied.status_code == 403
    assert denied.json()["reason"] == "guest_login_required"
    assert execute.call_count == 3
    assert GuestCompileBalance.objects.get().used == 3
    with patch("api.views.get_compiler_service") as unavailable:
        denied = post(client)
        assert denied.status_code == 403
        assert denied.json()["reason"] == "guest_login_required"
        unavailable.assert_not_called()


def test_failures_validation_normalization_and_status_do_not_spend():
    client = APIClient()
    client.get("/api/compile/")
    assert client.post("/api/compile/", {"content": ""}, format="json").status_code == 400
    assert client.post("/api/compile/", {"content": "x", "normalize_only": True}, format="json").status_code == 200
    service, execute = compiler()
    execute.side_effect = CompilerSyntaxError
    with patch("api.views.get_compiler_service", return_value=service):
        assert post(client).status_code == 400
    assert client.get("/api/compile/").json() == {"remaining": 3}
    assert GuestCompileBalance.objects.get().used == 0


@contextmanager
def sidecar_job(runner, request):
    """Exercise real READY/START and response framing without a running service."""
    client, peer = socket.socketpair()
    server = SidecarServer("unused", runner)

    def serve():
        with peer:
            server.handle(peer)

    worker = Thread(target=serve)
    worker.start()
    try:
        with client:
            client.settimeout(2)
            request_id = uuid.uuid4().bytes
            protocol.send_message(client, request_id, {
                "job_id": request.job_id, "source": request.source, "limits": asdict(request.limits),
            })
            protocol.receive_control(client, request_id, protocol.READY)
            yield partial(SidecarCompilerClient._execute, client, request_id, request)
    finally:
        worker.join(timeout=3)
        assert not worker.is_alive()


def test_successful_third_runner_with_lost_reply_cannot_admit_fourth():
    client = APIClient()
    runner = Mock()
    runner.compile.return_value = CompileResult(pdf=b"%PDF-1.4 guest")
    service = Mock()
    service.prepare.side_effect = partial(sidecar_job, runner)
    with patch("api.views.get_compiler_service", return_value=service):
        assert post(client).status_code == 200
        assert post(client).status_code == 200
        # Runner succeeds, but the peer closes without delivering its response.
        with patch("compiler_sidecar.server.send_response", return_value=None):
            assert post(client).status_code == 503
        assert client.get("/api/compile/").json() == {"remaining": 0}
        assert post(client).status_code == 403
    assert runner.compile.call_count == 3
    assert GuestCompileBalance.objects.get().used == 3


@pytest.mark.parametrize("failure,status", [
    (CompilerSyntaxError, 400), (CompilerResourceLimit, 422), (CompilerTimeout, 408),
])
def test_confirmed_sidecar_terminal_failures_refund(failure, status):
    client = APIClient()
    runner = Mock()
    runner.compile.side_effect = failure("confirmed terminal failure")
    service = Mock()
    service.prepare.side_effect = partial(sidecar_job, runner)
    with patch("api.views.get_compiler_service", return_value=service):
        assert post(client).status_code == status
    assert client.get("/api/compile/").json() == {"remaining": 3}


@pytest.mark.parametrize("failure,status", [(socket.timeout, 408), (OSError, 503), (RuntimeError, 500)])
def test_uncertain_transport_or_unexpected_exception_retains_reservation(failure, status):
    client = APIClient(raise_request_exception=False)
    client.get("/api/compile/")
    service = Mock()
    request_id = uuid.uuid4().bytes
    service.prepare.side_effect = lambda request: nullcontext(partial(
        SidecarCompilerClient._execute, Mock(), request_id, request,
    ))
    with patch("api.views.get_compiler_service", return_value=service), patch(
        "api.compilation.sidecar.receive_message", side_effect=failure("unknown outcome"),
    ):
        assert post(client).status_code == status
    assert client.get("/api/compile/").json() == {"remaining": 2}


@pytest.mark.parametrize("operation", ["create", "filter"])
def test_balance_storage_failure_is_closed(operation):
    client = APIClient()
    if operation == "filter":
        client.get("/api/compile/")
    with patch(f"api.guest_quota.GuestCompileBalance.objects.{operation}", side_effect=DatabaseError), patch("api.views.get_compiler_service") as service:
        assert post(client).status_code == 503
        service.assert_not_called()


@pytest.mark.parametrize("failure_stage", ["reserve", "release"])
def test_reservation_storage_errors_fail_closed(failure_stage):
    client = APIClient()
    client.get("/api/compile/")
    service, execute = compiler()
    if failure_stage == "release":
        execute.side_effect = CompilerSyntaxError
    with patch("api.views.get_compiler_service", return_value=service), patch(f"api.views.{failure_stage}", side_effect=DatabaseError):
        assert post(client).status_code == 503
    assert GuestCompileBalance.objects.get().used == (1 if failure_stage == "release" else 0)
    assert execute.call_count == (1 if failure_stage == "release" else 0)


def test_missing_durable_balance_does_not_reset_existing_identity():
    client = APIClient()
    client.get("/api/compile/")
    GuestCompileBalance.objects.all().delete()
    service, execute = compiler()
    with patch("api.views.get_compiler_service", return_value=service):
        assert post(client).status_code == 503
    execute.assert_not_called()


def test_cleared_or_tampered_cookie_creates_new_identity_without_periodic_reset():
    client = APIClient()
    client.get("/api/compile/")
    balance = GuestCompileBalance.objects.get()
    balance.used = 3
    balance.save()
    assert client.get("/api/compile/").json()["remaining"] == 0
    client.cookies[COOKIE] = "tampered"
    assert client.get("/api/compile/").json()["remaining"] == 3
    assert GuestCompileBalance.objects.count() == 2


def test_logged_in_has_no_guest_balance(django_user_model):
    client = APIClient()
    client.force_authenticate(django_user_model.objects.create_user(username="member"))
    service, execute = compiler()
    with patch("api.views.get_compiler_service", return_value=service), patch("api.views.admit_compile") as admit:
        admit.return_value.allowed = True
        for _ in range(4):
            assert post(client).status_code == 200
    assert execute.call_count == 4
    assert admit.call_count == 4
    assert client.get("/api/compile/").json() == {"remaining": None}
    assert not GuestCompileBalance.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_postgresql_atomic_reservations_never_exceed_three():
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL; SQLite is not evidence for production concurrency")
    import uuid
    balance = GuestCompileBalance.objects.create(identity=uuid.uuid4())

    def attempt(_):
        close_old_connections()
        try:
            return reserve(balance)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(12))) == 3
    balance.refresh_from_db()
    assert balance.used == 3

"""Permanent browser allowance; interrupted reservations are conservatively spent."""
from functools import wraps
import uuid

from django.db import DatabaseError
from django.db.models import F
from rest_framework.response import Response

from .models import GuestCompileBalance

COOKIE = "texgen_guest"
SALT = "guest-compile-v1"


def guest_identity(view):
    @wraps(view)
    def wrapped(request):
        if request.user.is_authenticated:
            return view(request)
        try:
            identity = request.get_signed_cookie(COOKIE, default=None, salt=SALT)
            if identity:
                balance = GuestCompileBalance.objects.filter(identity=identity).first()
                if balance is None:
                    return Response({"error": "Compilation service is unavailable"}, status=503)
            else:
                balance = GuestCompileBalance.objects.create(identity=uuid.uuid4())
            request.guest_balance = balance
            response = view(request)
            balance.refresh_from_db()
            response["X-Guest-Compiles-Remaining"] = str(3 - balance.used)
            response["Cache-Control"] = "no-store"
            response.set_signed_cookie(COOKIE, str(balance.identity), salt=SALT, max_age=10 * 365 * 86400,
                                       httponly=True, secure=request.is_secure(), samesite="Lax")
            return response
        except DatabaseError:
            return Response({"error": "Compilation service is unavailable"}, status=503)
    return wrapped


def reserve(balance):
    return GuestCompileBalance.objects.filter(identity=balance.identity, used__lt=3).update(used=F("used") + 1) == 1


def release(balance):
    GuestCompileBalance.objects.filter(identity=balance.identity, used__gt=0).update(used=F("used") - 1)

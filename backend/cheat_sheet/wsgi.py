"""
WSGI config for cheat_sheet project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cheat_sheet.settings")
application = get_wsgi_application()

"""Private WSGI server. Only the Nginx container may access this socket."""

bind = "unix:/run/texgen-web/app.sock"
workers = 2
worker_class = "sync"
timeout = 30
graceful_timeout = 30
umask = 0o007
worker_tmp_dir = "/tmp"
raw_env = ["DJANGO_SETTINGS_MODULE=cheat_sheet.production"]

# Unix peers are trusted by Gunicorn; socket permissions are the boundary.
# Nginx must overwrite forwarded headers. Do not trust any TCP forwarder.
forwarded_allow_ips = ""
forwarder_headers = ""
secure_scheme_headers = {"X-FORWARDED-PROTO": "https"}

reload = False
preload_app = False
accesslog = None
errorlog = "-"

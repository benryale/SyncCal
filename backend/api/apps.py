from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        # app registry isn't ready at import time
        from . import signals  # noqa: F401

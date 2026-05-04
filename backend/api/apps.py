from django.apps import AppConfig
"""Thsi file defines config for the api app and imports signals to register post_save handlers"""

class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        import api.signals  # noqa: F401 – registers post_save handlers
